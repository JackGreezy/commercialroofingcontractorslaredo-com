#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || process.cwd());
const publicDir = path.join(root, "public");
const config = JSON.parse(fs.readFileSync(path.join(root, "home.config.json"), "utf8"));
const phone = String(config.phone || "").trim();
const digits = phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
if (digits.length !== 10 || /^555555/.test(digits)) {
  throw new Error(`A verified real 10-digit phone number is required for ${config.domain || root}`);
}

const formattedPhone = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
const phoneTel = `+1${digits}`;
const pageKinds = new Set(["services", "roof-systems", "industries", "project-types", "property-types", "locations", "manufacturers", "capabilities", "damage-repair"]);
const files = [];

const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (["assets-f", "ours", "images"].includes(entry.name)) continue;
    const item = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(item);
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(item);
  }
};
walk(publicDir);

const styleTag = '<link href="/rr-lead-controls.css?v=20260813" id="rr-lead-controls-css" rel="stylesheet"/>';
const scriptTag = '<script defer id="rr-lead-controls-js" src="/rr-lead-controls.js?v=20260813-2"></script>';
const payload = JSON.stringify({
  phone: formattedPhone,
  phoneTel,
  businessName: config.businessName || "Commercial Roofing",
}).replace(/</g, "\\u003c");
const configTag = `<script id="rr-lead-controls-config" type="application/json">${payload}</script>`;
const carouselClassPattern = /(?:^|[-_\s])(?:carousel|slider)(?:$|[-_\s])/i;

function stripSlugCarouselBehavior(html) {
  return html
    .replace(/\sdata-rr-carousel=(?:"[^"]*"|'[^']*')/gi, "")
    .replace(/\sdata-rr-autoplay=(?:"[^"]*"|'[^']*')/gi, "")
    .replace(/\saria-roledescription=(?:"carousel"|'carousel')/gi, "")
    .replace(/\srole=(?:"region"|'region')(?=[^>]*\b(?:carousel|slider)\b)/gi, "")
    .replace(/(<(?:button|a|div)\b[^>]*)(>)/gi, (match, prefix, close) => {
      if (!carouselClassPattern.test(prefix) || !/(?:prev|next|arrow|control)/i.test(prefix)) return match;
      if (/\shidden(?:\s|=|>)/i.test(`${prefix}>`)) return match;
      return `${prefix} hidden aria-hidden="true" tabindex="-1"${close}`;
    });
}

let changed = 0;
for (const file of files) {
  let html = fs.readFileSync(file, "utf8");
  const before = html;
  const relative = path.relative(publicDir, file).split(path.sep);
  const base = relative.at(-1);
  const pageKind = relative.length === 1 && ["home.html", "index.html"].includes(base)
    ? "home"
    : base === "contact.html"
      ? "contact"
      : relative.length > 1 && pageKinds.has(relative[0])
        ? "slug"
        : "other";

  html = html
    .replace(/<link\b[^>]*\bid=["']rr-lead-controls-css["'][^>]*>\s*/gi, "")
    .replace(/<script\b[^>]*\bid=["']rr-lead-controls-config["'][^>]*>[\s\S]*?<\/script>\s*/gi, "")
    .replace(/<script\b[^>]*\bid=["']rr-lead-controls-js["'][^>]*>[\s\S]*?<\/script>\s*/gi, "")
    .replace(/(<html\b[^>]*?)\sdata-rr-page-kind=["'][^"']*["']/i, "$1")
    .replace(/<html\b([^>]*)>/i, `<html$1 data-rr-page-kind="${pageKind}">`)
    .replace(/<\/head>/i, `${styleTag}\n</head>`)
    .replace(/<\/body>/i, `${configTag}\n${scriptTag}\n</body>`);
  if (pageKind === "slug") html = stripSlugCarouselBehavior(html);

  if (html !== before) {
    fs.writeFileSync(file, html);
    changed += 1;
  }
}

config.phone = formattedPhone;
fs.writeFileSync(path.join(root, "home.config.json"), `${JSON.stringify(config, null, 2)}\n`);

const contactConfigFile = path.join(root, "lib", "contact-config.js");
if (fs.existsSync(contactConfigFile)) {
  let contactConfig = fs.readFileSync(contactConfigFile, "utf8");
  contactConfig = contactConfig
    .replace(/(\bphone:\s*)["'][^"']*["']/, `$1${JSON.stringify(formattedPhone)}`)
    .replace(/(\bphoneTel:\s*)["'][^"']*["']/, `$1${JSON.stringify(phoneTel)}`);
  fs.writeFileSync(contactConfigFile, contactConfig);
}
console.log(`finalize-lead-controls: ${changed} page(s), ${formattedPhone}`);
