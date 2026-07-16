import { sendLeadEmails } from "../../../lib/email/sendgrid.js";

export const runtime = "nodejs";

const buckets = new Map();
const LIMIT = 5;
const WINDOW_MS = 60 * 1000;
const REQUIRED_FIELDS = ["name", "phone", "email", "timeline", "message"];

function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers });
}

function clean(value) {
  return String(value || "").trim();
}

function clientIp(request) {
  return clean(request.headers.get("cf-connecting-ip")) ||
    clean(request.headers.get("x-forwarded-for")).split(",")[0] ||
    clean(request.headers.get("x-real-ip")) ||
    "unknown";
}

function rateLimit(request) {
  const key = clientIp(request);
  const now = Date.now();
  const current = buckets.get(key) || { count: 0, reset: now + WINDOW_MS };
  if (current.reset <= now) {
    current.count = 0;
    current.reset = now + WINDOW_MS;
  }
  current.count += 1;
  buckets.set(key, current);
  return {
    allowed: current.count <= LIMIT,
    remaining: Math.max(0, LIMIT - current.count),
    reset: current.reset
  };
}

async function readPayload(request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return await request.json();
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(await request.text()).entries());
  }
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

function normalizeLead(body, request) {
  const first = clean(body.firstName || body.first_name || body.first);
  const last = clean(body.lastName || body.last_name || body.last);
  const name = clean(body.name || body.fullName || body.full_name || [first, last].filter(Boolean).join(" "));
  const message = clean(body.message || body.projectDetails || body.project_details || body.details || body.info || body.comments || body.notes);
  const address = clean(
    body.address ||
    body.propertyAddress ||
    body.property_address ||
    body["property-address"] ||
    body.streetAddress ||
    body.street_address ||
    body["street-address"] ||
    body.buildingAddress ||
    body.building_address ||
    body["building-address"] ||
    body.organization
  );
  const page = clean(body.page || body.sourcePage || request.headers.get("referer"));
  const serviceType = clean(body.serviceType || body.service || body.projectType || body.project_type) || "Commercial Roofing";
  const timeline = clean(body.timeline || body.projectTimeline || body.project_timeline || body.when || body.timeframe);
  return {
    name,
    fullName: name,
    phone: clean(body.phone || body.phoneNumber || body.phone_number || body.telephone || body.tel),
    email: clean(body.email || body.emailAddress || body.email_address),
    address,
    propertyAddress: address,
    serviceType,
    projectType: serviceType,
    timeline,
    projectTimeline: timeline,
    message,
    projectDetails: message,
    page,
    submittedAt: new Date().toISOString()
  };
}

function validateLead(lead) {
  const missing = REQUIRED_FIELDS.filter((key) => !clean(lead[key]));
  if (missing.length) return `Missing required field: ${missing.join(", ")}`;
  if (!/^\S+@\S+\.\S+$/.test(lead.email)) return "Please enter a valid email address.";
  const phoneDigits = lead.phone.replace(/\D/g, "");
  if (phoneDigits.length < 7 || !/^[0-9()+\-\s.]+$/.test(lead.phone)) return "Please enter a valid phone number.";
  return "";
}

export async function POST(request) {
  const rate = rateLimit(request);
  const headers = {
    "X-RateLimit-Limit": String(LIMIT),
    "X-RateLimit-Remaining": String(rate.remaining),
    "X-RateLimit-Reset": String(rate.reset)
  };
  if (!rate.allowed) {
    const retryAfter = Math.ceil((rate.reset - Date.now()) / 1000);
    return json({ ok: false, success: false, error: "Rate limit exceeded. Please try again later.", retryAfter }, 429, { ...headers, "Retry-After": String(retryAfter) });
  }

  let body;
  try {
    body = await readPayload(request);
  } catch {
    return json({ ok: false, success: false, message: "Invalid request payload.", error: "Invalid request payload." }, 400, headers);
  }

  if (clean(body._company) || clean(body.website)) return json({ ok: true, success: true }, 200, headers);

  const lead = normalizeLead(body, request);
  const validationError = validateLead(lead);
  if (validationError) {
    return json({ ok: false, success: false, message: validationError, error: validationError }, 400, headers);
  }

  try {
    await sendLeadEmails(lead, request);
  } catch (error) {
    console.error("Contact email send failed", error);
    const message = error?.message === "SENDGRID_API_KEY is missing."
      ? "Email service is not configured."
      : "We could not submit your request right now. Please call us directly.";
    return json({ ok: false, success: false, message, error: "email-send-failed" }, 500, headers);
  }

  return json({ ok: true, success: true, message: "Your request has been received. Our team will follow up shortly." }, 200, headers);
}
