export const runtime = "nodejs";

const SITE = {
  name: "Commercial Roofing Contractors of Laredo",
  domain: "commercialroofingcontractorslaredo.com",
  email: "sales@commercialroofingcontractorslaredo.com",
  phone: "555-555-6150"
};

const buckets = new Map();
const clean = (value) => String(value || "").trim();
const escapeHtml = (value) => clean(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

function allowed(request) {
  const key = clean(request.headers.get("cf-connecting-ip"))
    || clean(request.headers.get("x-forwarded-for")).split(",")[0]
    || "unknown";
  const now = Date.now();
  const state = buckets.get(key) || { count: 0, reset: now + 60_000 };
  if (state.reset <= now) {
    state.count = 0;
    state.reset = now + 60_000;
  }
  state.count += 1;
  buckets.set(key, state);
  return state.count <= 5;
}

async function requestBody(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return request.json();
  if (type.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(await request.text()).entries());
  }
  return Object.fromEntries((await request.formData()).entries());
}

function normalize(body) {
  const first = clean(body.firstName || body.first_name);
  const last = clean(body.lastName || body.last_name);
  return {
    name: clean(body.name || [first, last].filter(Boolean).join(" ")),
    email: clean(body.email || body.emailAddress),
    phone: clean(body.phone || body.phoneNumber),
    service: clean(body.roofingNeed || body.service || "Commercial Roofing"),
    address: clean(body.propertyAddress || body.address),
    details: clean(body.projectDetails || body.message || body.details),
    submittedAt: new Date().toISOString()
  };
}

function validationError(lead) {
  if (!lead.name || !lead.email || !lead.phone) return "Name, email, and phone are required.";
  if (!/^\S+@\S+\.\S+$/.test(lead.email)) return "Please enter a valid email address.";
  if (lead.phone.replace(/\D/g, "").length < 7) return "Please enter a valid phone number.";
  return "";
}

function recipients() {
  return clean(process.env.CONTACT_NOTIFICATION_RECIPIENTS || process.env.LEAD_NOTIFICATION_EMAIL || "rankhoundseo@gmail.com")
    .split(/[;,\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

async function sendEmail({ to, subject, html, replyTo }) {
  const apiKey = clean(process.env.SENDGRID_API_KEY);
  if (!apiKey) throw new Error("SENDGRID_API_KEY is missing.");
  const fromEmail = clean(process.env.SENDGRID_FROM_EMAIL || process.env.BUSINESS_EMAIL || SITE.email);
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: { email: fromEmail, name: SITE.name },
      reply_to: { email: replyTo || SITE.email, name: SITE.name },
      personalizations: [{ to: to.map((email) => ({ email })) }],
      subject,
      content: [{ type: "text/html", value: html }],
      categories: ["contact-form", "commercialroofingcontractorslaredo-com"]
    })
  });
  if (!response.ok) throw new Error(`SendGrid request failed (${response.status}).`);
}

function leadHtml(lead) {
  const rows = [
    ["Name", lead.name],
    ["Email", lead.email],
    ["Phone", lead.phone],
    ["Roofing need", lead.service],
    ["Property address", lead.address],
    ["Project details", lead.details],
    ["Submitted", lead.submittedAt]
  ];
  return `<h1>New commercial roofing inquiry</h1>${rows.map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value) || "Not provided"}</p>`).join("")}`;
}

function respond(request, data, status = 200) {
  if ((request.headers.get("accept") || "").includes("text/html") && data.ok) {
    return Response.redirect(new URL("/contact?submitted=1", request.url), 303);
  }
  return Response.json(data, { status });
}

export async function POST(request) {
  if (!allowed(request)) {
    return respond(request, { ok: false, error: "Too many requests. Please try again shortly." }, 429);
  }
  let body;
  try {
    body = await requestBody(request);
  } catch {
    return respond(request, { ok: false, error: "Invalid request." }, 400);
  }
  if (clean(body.website) || clean(body._company) || clean(body.honeypot)) {
    return respond(request, { ok: true });
  }
  const lead = normalize(body);
  const error = validationError(lead);
  if (error) return respond(request, { ok: false, error }, 400);

  try {
    await Promise.all([
      sendEmail({
        to: recipients(),
        subject: `New ${lead.service} inquiry from ${lead.name}`,
        html: leadHtml(lead),
        replyTo: lead.email
      }),
      sendEmail({
        to: [lead.email],
        subject: `We received your roofing request — ${SITE.name}`,
        html: `<h1>Thanks, ${escapeHtml(lead.name)}.</h1><p>We received your commercial roofing request and will follow up shortly.</p><p>If the issue is urgent, call <a href="tel:${SITE.phone.replace(/\D/g, "")}">${SITE.phone}</a>.</p>`,
        replyTo: SITE.email
      })
    ]);
  } catch (sendError) {
    console.error("Contact email send failed", sendError);
    return respond(request, { ok: false, error: "We could not submit your request. Please call us directly." }, 500);
  }
  return respond(request, { ok: true, message: "Your request has been received." });
}

