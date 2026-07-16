import { contactConfig } from "../contact-config.js";
import { emailTheme } from "./theme.js";

const DEFAULT_TEMPLATE_ID = "d-15217ab1c55347b5847c2421b1a82847";

function clean(value) {
  return String(value || "").trim();
}

function unique(values) {
  return [...new Set(values.map((value) => clean(value).toLowerCase()).filter(Boolean))];
}

function absUrl(siteUrl, url) {
  const u = clean(url);
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  return `${clean(siteUrl).replace(/\/+$/, "")}/${u.replace(/^\/+/, "")}`;
}

function getSiteUrl(request) {
  const configured = clean(process.env.NEXT_PUBLIC_SITE_URL);
  if (configured) return configured.replace(/\/+$/, "");
  const host = clean(request?.headers?.get("x-forwarded-host") || request?.headers?.get("host")) || contactConfig.domain;
  const protocol = clean(request?.headers?.get("x-forwarded-proto")) || "https";
  return host ? `${protocol}://${host}` : `https://${contactConfig.domain}`;
}

function getSiteHost(siteUrl) {
  try {
    return new URL(siteUrl).hostname;
  } catch {
    return clean(siteUrl).replace(/^https?:\/\//, "").replace(/\/.*$/, "") || contactConfig.domain;
  }
}

function getFromAddress(siteUrl) {
  const siteHost = getSiteHost(siteUrl);
  return {
    email: clean(process.env.SENDGRID_FROM_EMAIL) || clean(process.env.BUSINESS_EMAIL) || contactConfig.email || `info@${siteHost}`,
    name: clean(process.env.SENDGRID_FROM_NAME) || clean(process.env.BUSINESS_NAME) || contactConfig.name
  };
}

function getReplyTo(fromEmail) {
  return clean(process.env.SENDGRID_REPLY_TO) || clean(process.env.BUSINESS_EMAIL) || contactConfig.email || fromEmail;
}

function parseRecipients(value) {
  return clean(value)
    .split(/[\n,;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getInternalRecipients(fromEmail) {
  const recipients = unique([
    process.env.RANKHOUND_NOTIFICATION_EMAIL || "rankhoundseo@gmail.com",
    ...parseRecipients(process.env.CONTACT_NOTIFICATION_RECIPIENTS),
    process.env.CONTRACTOR_EMAIL,
    process.env.LEAD_NOTIFICATION_EMAIL
  ]);
  return recipients.length ? recipients : [fromEmail.toLowerCase()];
}

function getTemplateId() {
  return clean(process.env.SENDGRID_TEMPLATE_ID || process.env.SENDGRID_TEMPLATE_CONFIRMATION || DEFAULT_TEMPLATE_ID);
}

function buildTemplateData(request, lead) {
  const siteUrl = getSiteUrl(request);
  const siteHost = getSiteHost(siteUrl);
  const from = getFromAddress(siteUrl);
  const replyTo = getReplyTo(from.email);
  const callPhone = clean(process.env.BUSINESS_PHONE || process.env.CONTRACTOR_PHONE || process.env.NEXT_PUBLIC_BUSINESS_PHONE || process.env.NEXT_PUBLIC_PHONE || contactConfig.phone);
  const callPhonePlain = callPhone.replace(/\D/g, "") || clean(contactConfig.phoneTel).replace(/\D/g, "");
  // Keep the service label exactly as submitted (proper case, e.g. "TPO Roof Replacement").
  const serviceLabel = clean(lead.serviceType || lead.projectType) || "Commercial Roofing";
  const preheaderName = lead.name ? ` ${lead.name}` : "";
  const submittedDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  // Per-site brand theme (colors, fonts, logo) — env vars win if explicitly set, else the site's theme.js.
  const logoUrl = absUrl(siteUrl, clean(process.env.SENDGRID_LOGO_URL) || emailTheme.logoUrl);
  const leadData = {
    name: lead.name,
    fullName: lead.name,
    email: lead.email,
    emailAddress: lead.email,
    phone: lead.phone,
    phoneNumber: lead.phone,
    phone_plain: lead.phone.replace(/\D/g, ""),
    address: lead.address,
    propertyAddress: lead.address,
    projectType: serviceLabel,
    serviceType: serviceLabel,
    timeline: lead.timeline,
    // NOTE: business city is intentionally omitted (never show business city/address in the email).
    projectTimeline: lead.timeline,
    projectDescription: lead.message,
    projectDetails: lead.message,
    message: lead.message,
    page: lead.page,
    submittedAt: lead.submittedAt
  };
  return {
    from,
    replyTo,
    siteHost,
    dynamicTemplateData: {
      lead: leadData,
      ...leadData,
      subject: `Thanks for your ${serviceLabel} Inquiry`,
      preheader: `Thanks${preheaderName}, we received your ${serviceLabel} inquiry and will follow up shortly.`,
      company_name: from.name,
      companyName: from.name,
      brand_title: from.name,
      logo_url: logoUrl,
      logoUrl: logoUrl,
      header_bg: process.env.SENDGRID_HEADER_BG || emailTheme.headerBg || "",
      city_state: "",
      brand_accent: process.env.SENDGRID_BRAND_ACCENT || emailTheme.accent,
      accent_text: process.env.SENDGRID_ACCENT_TEXT || emailTheme.accentText,
      cta_dark_bg: process.env.SENDGRID_CTA_DARK_BG || emailTheme.ctaDarkBg,
      bg_color: process.env.SENDGRID_BG_COLOR || emailTheme.bg,
      text_dark: process.env.SENDGRID_TEXT_DARK || emailTheme.textDark,
      text_muted: process.env.SENDGRID_TEXT_MUTED || emailTheme.textMuted,
      text_body: process.env.SENDGRID_TEXT_BODY || emailTheme.textBody,
      text_faint: process.env.SENDGRID_TEXT_FAINT || emailTheme.textFaint,
      border_color: process.env.SENDGRID_BORDER_COLOR || emailTheme.border,
      card_header_bg: process.env.SENDGRID_CARD_HEADER_BG || emailTheme.footerBg,
      font_family: process.env.SENDGRID_FONT_FAMILY || emailTheme.fontBody,
      heading_font_family: process.env.SENDGRID_HEADING_FONT || emailTheme.fontHeading,
      body_font_family: process.env.SENDGRID_BODY_FONT || emailTheme.fontBody,
      font_import: process.env.SENDGRID_FONT_IMPORT || emailTheme.fontImport,
      hero_title: lead.name ? `Thanks, ${lead.name}. We received your ${serviceLabel} inquiry.` : `We received your ${serviceLabel} inquiry.`,
      hero_subtitle: "Our team will review your details and reach out shortly.",
      details_title: "Your project details",
      call_cta_label: "Call Now",
      call_phone: callPhone,
      call_phone_plain: callPhonePlain,
      site_cta_label: "Go To Site",
      site_url: siteUrl,
      siteUrl: siteUrl,
      site_host: siteHost,
      supportEmail: replyTo,
      supportPhone: callPhone,
      address_line: "",
      footer_note: "This confirmation is a transactional email related to your request.",
      submitted_date: submittedDate,
      source: siteUrl,
      page: lead.page
    }
  };
}

async function sendTemplateEmail(params) {
  const apiKey = clean(process.env.SENDGRID_API_KEY);
  if (!apiKey) throw new Error("SENDGRID_API_KEY is missing.");
  const siteCategory = params.siteHost.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "website-contact";
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: { email: params.fromEmail, name: params.fromName },
      reply_to: { email: params.replyTo, name: params.fromName },
      template_id: params.templateId,
      categories: ["contact-form", siteCategory, params.notificationType],
      personalizations: [
        {
          to: [{ email: params.to }],
          dynamic_template_data: params.dynamicTemplateData
        }
      ],
      custom_args: {
        notification_type: params.notificationType,
        site_host: params.siteHost,
        from_name: params.fromName
      }
    })
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`SendGrid request failed (${response.status}): ${details}`);
  }
}

export async function sendLeadEmails(lead, request) {
  const templateId = getTemplateId();
  const { from, replyTo, siteHost, dynamicTemplateData } = buildTemplateData(request, lead);
  const internalRecipients = getInternalRecipients(from.email);
  await Promise.all([
    sendTemplateEmail({
      to: lead.email,
      fromEmail: from.email,
      fromName: from.name,
      replyTo,
      templateId,
      notificationType: "customer_confirmation",
      siteHost,
      dynamicTemplateData: { ...dynamicTemplateData, notification_type: "customer_confirmation" }
    }),
    ...internalRecipients.map((recipient) => sendTemplateEmail({
      to: recipient,
      fromEmail: from.email,
      fromName: from.name,
      replyTo,
      templateId,
      notificationType: "internal_notification",
      siteHost,
      dynamicTemplateData: { ...dynamicTemplateData, notification_type: "internal_notification" }
    }))
  ]);
}
