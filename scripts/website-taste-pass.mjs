#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || process.cwd());
const publicDir = path.join(root, "public");
const styleTag = '<link href="/website-taste.css" id="rr-website-taste-css" rel="stylesheet"/>';
const scriptTag = '<script defer id="rr-website-taste-js" src="/website-taste.js"></script>';

const contactForm = `<form action="/api/submit" class="rr-contact-form" data-contact-form method="post">
<input name="page" type="hidden" value="/contact"/>
<input name="serviceType" type="hidden" value="Commercial Roofing"/>
<input aria-hidden="true" autocomplete="off" class="hp-field" name="_company" tabindex="-1" type="text"/>
<label class="rr-contact-field">Name
<input autocomplete="name" name="name" placeholder="Your name" required type="text"/>
</label>
<label class="rr-contact-field">Phone
<input autocomplete="tel" name="phone" placeholder="Phone number" required type="tel"/>
</label>
<label class="rr-contact-field">Email
<input autocomplete="email" name="email" placeholder="Email address" required type="email"/>
</label>
<label class="rr-contact-field">Property Address
<input autocomplete="street-address" name="address" placeholder="Building address or roof location" required type="text"/>
</label>
<label class="rr-contact-field">Timeline
<select name="timeline" required>
<option value="">Select a timeline</option>
<option>Emergency - active leak</option>
<option>Within 30 days</option>
<option>1-3 months</option>
<option>3-6 months</option>
<option>Planning / budgeting</option>
</select>
</label>
<label class="rr-contact-field rr-contact-field--full">Message
<textarea name="notes" placeholder="Tell us about the roof, issue, access, and schedule" required rows="7"></textarea>
</label>
<button class="rr-contact-submit" type="submit">Send Roof Request</button>
<p aria-live="polite" class="form-status" data-form-status role="status"></p>
</form>`;

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

let changed = 0;
for (const file of files) {
  let html = fs.readFileSync(file, "utf8");
  const before = html;
  if (!html.includes('id="rr-website-taste-css"')) {
    html = html.replace(/<\/head>/i, `${styleTag}\n</head>`);
  }
  if (!html.includes('id="rr-website-taste-js"')) {
    html = html.replace(/<\/body>/i, `${scriptTag}\n</body>`);
  }
  if (path.basename(file) === "contact.html") {
    const formPattern = /<form\b(?=[^>]*(?:data-contact-form|action=["']\/api\/(?:contact|submit)["']))[\s\S]*?<\/form>/i;
    if (formPattern.test(html)) html = html.replace(formPattern, contactForm);
  }
  if (html !== before) {
    fs.writeFileSync(file, html);
    changed += 1;
  }
}

console.log(`website-taste-pass: ${changed} page(s) updated`);
