import { sendLeadEmails } from "../../../lib/email/sendgrid.js";

export const runtime = "nodejs";

const buckets = new Map();
const identityBuckets = new Map();
const LIMIT = 3;
const WINDOW_MS = 10 * 60 * 1000;
const IDENTITY_LIMIT = 2;
const MAX_BODY_BYTES = 32 * 1024;
const REQUIRED_FIELDS = ["name", "phone", "email", "timeline", "message"];
const MARKETING_PATTERNS = [
  /\bseo\b/i,
  /\bindex(?:ing|ed|ation)?\b/i,
  /\bsearch engine optimization\b/i,
  /\b(?:google|search engine|website|site)\s+rank(?:ing|ings)?\b/i,
  /\b(?:first|1st)\s+page\s+(?:of\s+)?google\b/i,
  /\bbacklinks?\b/i,
  /\blink[\s-]?building\b/i,
  /\bdomain authority\b/i,
  /\borganic (?:traffic|visibility|growth)\b/i,
  /\bwebsite traffic\b/i,
  /\b(?:digital|online|internet|content|affiliate|email|social media|performance)\s+marketing\b/i,
  /\bmarketing (?:agency|services?|strategy|campaign|partner|proposal)\b/i,
  /\b(?:ppc|pay[\s-]?per[\s-]?click|google ads?|facebook ads?|meta ads?)\b/i,
  /\bweb(?:site)? (?:design|development|redesign|audit)\b/i,
  /\bguest posts?\b/i,
  /\bsponsored (?:posts?|content|links?)\b/i,
  /\blead generation\b/i,
  /\b(?:get|generate|bring|deliver)\s+(?:you\s+)?more leads?\b/i,
  /\breputation management\b/i,
  /\bcold outreach\b/i
];

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

function consumeBucket(store, key, limit) {
  const now = Date.now();
  const current = store.get(key) || { count: 0, reset: now + WINDOW_MS };
  if (current.reset <= now) {
    current.count = 0;
    current.reset = now + WINDOW_MS;
  }
  current.count += 1;
  store.set(key, current);
  return {
    allowed: current.count <= limit,
    remaining: Math.max(0, limit - current.count),
    reset: current.reset
  };
}

function rateLimit(request) {
  return consumeBucket(buckets, clientIp(request), LIMIT);
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

function isMarketingSpam(lead) {
  const content = [
    lead.name,
    lead.email,
    lead.serviceType,
    lead.message
  ].join("\n");
  if (MARKETING_PATTERNS.some((pattern) => pattern.test(content))) return true;
  const urls = content.match(/(?:https?:\/\/|www\.)\S+/gi) || [];
  return urls.length > 2;
}

export async function POST(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json({ ok: false, success: false, error: "Request payload is too large." }, 413);
  }

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
  if (isMarketingSpam(lead)) {
    return json({ ok: true, success: true, message: "Your request has been received." }, 200, headers);
  }

  const validationError = validateLead(lead);
  if (validationError) {
    return json({ ok: false, success: false, message: validationError, error: validationError }, 400, headers);
  }

  const identityKey = `${lead.email.toLowerCase()}|${lead.phone.replace(/\D/g, "")}`;
  const identityRate = consumeBucket(identityBuckets, identityKey, IDENTITY_LIMIT);
  if (!identityRate.allowed) {
    const retryAfter = Math.ceil((identityRate.reset - Date.now()) / 1000);
    return json({ ok: false, success: false, error: "Rate limit exceeded. Please try again later.", retryAfter }, 429, {
      ...headers,
      "Retry-After": String(retryAfter)
    });
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
