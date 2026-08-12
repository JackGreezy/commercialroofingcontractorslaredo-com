#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const canonical = [
  { name: "name", label: "Name", tag: "input", type: "text", autocomplete: "name", placeholder: "Your name" },
  { name: "phone", label: "Phone", tag: "input", type: "tel", autocomplete: "tel", placeholder: "Phone number" },
  { name: "email", label: "Email", tag: "input", type: "email", autocomplete: "email", placeholder: "Email address" },
  { name: "timeline", label: "Timeline", tag: "select" },
  { name: "address", label: "Address", tag: "input", type: "text", autocomplete: "street-address", placeholder: "Building address or roof location" },
  { name: "message", label: "Message", tag: "textarea", placeholder: "Tell us about the roof, issue, access, and schedule" },
];

const ignoredNames = new Set([
  "page", "pagetitle", "pageurl", "source", "website", "form-name", "bot-field",
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "csrf",
  "honeypot", "company_website", "service", "servicetype", "projecttype", "project_type",
]);

const skippedParts = new Set(["node_modules", ".next", ".git", "qa-out", "assets-f"]);
const runtimeFormSources = new Set([
  "app/ContactHydrator.tsx",
  "app/lib/sitePage.tsx",
  "app/san-antonio-homepage.js",
  "lib/generated-pages.mjs",
  "lib/site-html.js",
]);
const apply = true;
const install = false;
const installOnly = process.argv.includes("--install-only");
const skipDirty = process.argv.includes("--skip-dirty");
const requestedRepo = undefined;
const requestedPath = process.argv.find((value) => value.startsWith("--path="))?.slice("--path=".length);
const cwd = process.cwd();
const embedded = path.basename(new URL(import.meta.url).pathname) === "normalize-contact-forms.mjs";
const fleetRoot = embedded ? cwd : fs.existsSync(path.join(cwd, ".git")) ? path.dirname(cwd) : cwd;

function attrs(source = "") {
  const output = new Map();
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of source.matchAll(pattern)) {
    output.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? "");
  }
  return output;
}

function escapeAttribute(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function controlInfo(markup, start, end) {
  const opening = markup.match(/^<(input|select|textarea)\b([^>]*)>/i);
  if (!opening) return null;
  const tag = opening[1].toLowerCase();
  const attributes = attrs(opening[2]);
  const name = String(attributes.get("name") || "");
  const type = String(attributes.get("type") || "").toLowerCase();
  const hidden = type === "hidden" ||
    type === "submit" || type === "button" || type === "reset" || type === "image" ||
    name.startsWith("_") || ignoredNames.has(name.toLowerCase()) ||
    String(attributes.get("aria-hidden") || "").toLowerCase() === "true" ||
    String(attributes.get("tabindex") || "") === "-1" ||
    /(?:^|\s)(?:hidden|hp-field|honeypot|form-honeypot)(?:\s|$)/i.test(attributes.get("class") || "");
  const nonLeadChoice = type === "checkbox" || type === "radio" || type === "file";
  return { markup, start, end, tag, attributes, name, type, hidden: hidden || nonLeadChoice };
}

function controlsIn(form) {
  const controls = [];
  const pattern = /<input\b[^>]*>|<(?:select|textarea)\b[^>]*\/>|<select\b[^>]*>[\s\S]*?<\/select\s*>|<textarea\b[^>]*>[\s\S]*?<\/textarea\s*>/gi;
  for (const match of form.matchAll(pattern)) {
    const control = controlInfo(match[0], match.index, match.index + match[0].length);
    if (control) controls.push(control);
  }
  return controls;
}

function isLeadForm(form, controls) {
  const names = controls.map((control) => control.name.toLowerCase());
  const hasPhone = names.some((name) => name === "phone" || name === "tel" || name.includes("phone"));
  const hasEmail = names.some((name) => name === "email" || name.includes("email"));
  return (hasPhone && hasEmail) || /data-contact-form|action=["']\/api\/(?:contact|submit)/i.test(form);
}

function keepAttributes(control, field, jsx = false) {
  const kept = [];
  for (const key of ["class", "id", "style", "aria-describedby", "data-field", "data-testid"]) {
    const value = control?.attributes.get(key);
    if (value) kept.push(`${key}="${escapeAttribute(value)}"`);
  }
  const className = control?.attributes.get("classname");
  if (jsx && className) kept.push(`className="${escapeAttribute(className)}"`);
  kept.push(`name="${field.name}"`);
  if (field.tag === "input") kept.push(`type="${field.type}"`);
  if (field.autocomplete) kept.push(`${jsx ? "autoComplete" : "autocomplete"}="${field.autocomplete}"`);
  if (field.placeholder) kept.push(`placeholder="${escapeAttribute(field.placeholder)}"`);
  kept.push("required");
  return kept.join(" ");
}

function renderControl(control, field, jsx = false) {
  const attributes = keepAttributes(control, field, jsx);
  if (field.tag === "select") {
    return `<select ${attributes}>
<option value="">Select a timeline</option>
<option value="Emergency - active leak">Emergency - active leak</option>
<option value="Within 30 days">Within 30 days</option>
<option value="1-3 months">1-3 months</option>
<option value="3-6 months">3-6 months</option>
<option value="Planning / budgeting">Planning / budgeting</option>
</select>`;
  }
  if (field.tag === "textarea") return jsx
    ? `<textarea ${attributes} rows={7} />`
    : `<textarea ${attributes} rows="7"></textarea>`;
  return `<input ${attributes}/>`;
}

function openElementsAt(form, position) {
  const stack = [];
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  const pattern = /<\/?([a-z][a-z0-9:-]*)\b[^>]*>/gi;
  for (const match of form.slice(0, position).matchAll(pattern)) {
    const tag = match[1].toLowerCase();
    const closing = /^<\//.test(match[0]);
    const selfClosing = /\/>$/.test(match[0]) || voidTags.has(tag);
    if (closing) {
      const at = stack.map((item) => item.tag).lastIndexOf(tag);
      if (at >= 0) stack.splice(at, 1);
    } else if (!selfClosing) {
      stack.push({ tag, start: match.index, openEnd: match.index + match[0].length, opening: match[0] });
    }
  }
  return stack;
}

function closeOf(form, element, after) {
  const pattern = new RegExp(`<\\/?${element.tag}\\b[^>]*>`, "gi");
  pattern.lastIndex = after;
  let depth = 1;
  let match;
  while ((match = pattern.exec(form))) {
    if (/^<\//.test(match[0])) depth -= 1;
    else if (!/\/>$/.test(match[0])) depth += 1;
    if (depth === 0) return match.index + match[0].length;
  }
  return -1;
}

function findFieldUnit(form, control) {
  const stack = openElementsAt(form, control.start);
  const candidates = stack.filter((element) => ["label", "div", "p", "fieldset", "li"].includes(element.tag)).reverse();
  for (const element of candidates) {
    const end = closeOf(form, element, control.end);
    if (end < 0) continue;
    const unit = form.slice(element.start, end);
    const unitControls = controlsIn(unit).filter((item) => !item.hidden);
    if (unitControls.length !== 1) continue;
    const signature = `${element.opening} ${element.tag}`;
    if (element.tag === "label" || /field|input|control|row|form|wrap|group|column|col\b/i.test(signature)) {
      return { start: element.start, end };
    }
  }
  return null;
}

function updateLabel(unit, field) {
  const controlPattern = /<(input|select|textarea)\b/i;
  const controlAt = unit.search(controlPattern);
  if (controlAt < 0) return unit;
  const prefix = unit.slice(0, controlAt);
  const labelOpen = prefix.match(/^\s*<label\b[^>]*>/i);
  if (labelOpen) {
    const rest = prefix.slice(labelOpen[0].length);
    const cleaned = rest
      .replace(/<span\b([^>]*)>[\s\S]*?<\/span\s*>/i, `<span$1>${field.label}</span>`)
      .replace(/^[\s\S]*?(?=<(?:span|input|select|textarea)\b)/i, "");
    if (/<span\b/i.test(cleaned)) return `${labelOpen[0]}${cleaned}${unit.slice(controlAt)}`;
    return `${labelOpen[0]}${field.label}\n${unit.slice(controlAt)}`;
  }
  let output = unit;
  output = output.replace(/(<label\b[^>]*>)[\s\S]*?(<\/label\s*>)/i, `$1${field.label}$2`);
  const forId = unit.match(/<(input|select|textarea)\b[^>]*\bid=["']([^"']+)["']/i)?.[2];
  if (forId) {
    const labelPattern = new RegExp(`(<label\\b[^>]*\\bfor=["']${forId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>)[\\s\\S]*?(<\\/label\\s*>)`, "i");
    output = output.replace(labelPattern, `$1${field.label}$2`);
  }
  output = output.replace(/(<(?:span|div|p)\b[^>]*class=["'][^"']*(?:label|field-name|caption)[^"']*["'][^>]*>)[\s\S]*?(<\/\w+\s*>)/i, `$1${field.label}$2`);
  return output;
}

function normalizeForm(form, jsx = false) {
  let controls = controlsIn(form);
  if (!isLeadForm(form, controls)) return form;
  const visible = controls.filter((control) => !control.hidden);
  if (!visible.length) return form;
  const exactNames = visible.map((control) => control.name.toLowerCase());
  const action = form.match(/<form\b[^>]*\baction\s*=\s*(["'])(.*?)\1/i)?.[2] || "";
  const workingAction = action && action !== "#" && !action.startsWith("mailto:");
  if (workingAction && exactNames.length === canonical.length && exactNames.every((name, index) => name === canonical[index].name)) {
    return form;
  }

  const operations = [];
  const slots = visible.slice(0, canonical.length);
  for (let index = 0; index < slots.length; index += 1) {
    const control = slots[index];
    const field = canonical[index];
    const wrapper = findFieldUnit(form, control);
    if (wrapper) {
      const unit = form.slice(wrapper.start, wrapper.end);
      const localStart = control.start - wrapper.start;
      const localEnd = control.end - wrapper.start;
      let replacement = `${unit.slice(0, localStart)}${renderControl(control, field, jsx)}${unit.slice(localEnd)}`;
      replacement = updateLabel(replacement, field);
      operations.push({ start: wrapper.start, end: wrapper.end, replacement });
    } else {
      operations.push({ start: control.start, end: control.end, replacement: renderControl(control, field, jsx) });
      const id = control.attributes.get("id");
      if (id) {
        const labelPattern = new RegExp(`<label\\b[^>]*\\bfor=["']${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>[\\s\\S]*?<\\/label\\s*>`, "i");
        const before = form.slice(Math.max(0, control.start - 600), control.start);
        const matches = [...before.matchAll(new RegExp(labelPattern.source, "gi"))];
        const match = matches.at(-1);
        if (match) {
          const start = Math.max(0, control.start - 600) + match.index;
          operations.push({ start, end: start + match[0].length, replacement: match[0].replace(/(>)[\s\S]*?(<\/label\s*>)/i, `$1${field.label}$2`) });
        }
      }
    }
  }

  for (const control of visible.slice(canonical.length)) {
    const wrapper = findFieldUnit(form, control);
    if (wrapper) operations.push({ start: wrapper.start, end: wrapper.end, replacement: "" });
    else operations.push({ start: control.start, end: control.end, replacement: "" });
  }

  operations.sort((a, b) => b.start - a.start || b.end - a.end);
  const deduped = [];
  for (const operation of operations) {
    if (deduped.some((item) => operation.start >= item.start && operation.end <= item.end)) continue;
    deduped.push(operation);
  }
  for (const operation of deduped) {
    form = `${form.slice(0, operation.start)}${operation.replacement}${form.slice(operation.end)}`;
  }

  controls = controlsIn(form);
  let currentVisible = controls.filter((control) => !control.hidden);
  while (currentVisible.length < canonical.length) {
    const field = canonical[currentVisible.length];
    const prototype = currentVisible.find((control) => findFieldUnit(form, control)) || currentVisible.at(-1);
    let unit = "";
    if (prototype) {
      const wrapper = findFieldUnit(form, prototype);
      if (wrapper) {
        unit = form.slice(wrapper.start, wrapper.end);
        const localStart = prototype.start - wrapper.start;
        const localEnd = prototype.end - wrapper.start;
        unit = `${unit.slice(0, localStart)}${renderControl(prototype, field, jsx)}${unit.slice(localEnd)}`;
        unit = updateLabel(unit, field);
      }
    }
    if (!unit) unit = `<label>${field.label}\n${renderControl(prototype, field, jsx)}\n</label>`;
    const submit = form.search(/<(?:button\b[^>]*type=["']submit["']|input\b[^>]*type=["']submit["'])/i);
    const insertion = submit >= 0 ? submit : form.toLowerCase().lastIndexOf("</form");
    form = `${form.slice(0, insertion)}${unit}\n${form.slice(insertion)}`;
    currentVisible = controlsIn(form).filter((control) => !control.hidden);
  }

  form = form.replace(/<form\b([^>]*)>/i, (opening, raw) => {
    let next = raw;
    const action = next.match(/\baction\s*=\s*(["'])(.*?)\1/i)?.[2] || "";
    if (!action || action === "#" || action.startsWith("mailto:")) {
      if (/\baction\s*=/i.test(next)) next = next.replace(/\baction\s*=\s*(["']).*?\1/i, 'action="/api/submit"');
      else next += ' action="/api/submit"';
      next = next.replace(/\s+onsubmit\s*=\s*(["'])\s*return\s+false\s*;?\s*\1/i, "");
      next = next.replace(/\s+enctype\s*=\s*(["'])text\/plain\1/i, "");
    }
    if (!/\bmethod\s*=/i.test(next)) next += ' method="post"';
    return `<form${next}>`;
  });
  form = form.replace(/<(div|p|li)\b([^>]*)>\s*<label\b[^>]*>[\s\S]*?<\/label\s*>\s*<\/\1\s*>/gi, (unit, tag, raw) => {
    return /field|input|control|row|form|wrap|group|column|col\b/i.test(raw) ? "" : unit;
  });
  return form;
}

function normalizeText(text) {
  let changed = 0;
  const output = text.replace(/<form\b[\s\S]*?<\/form\s*>/gi, (form) => {
    // Some route stores serialize whole HTML pages inside JavaScript strings, so
    // their attribute quotes appear as \" in source. Normalize decoded form
    // markup, then put the escaping back before writing the JavaScript file.
    const serialized = /<form\b[^>]*\\["']/i.test(form);
    const decoded = serialized
      ? form.replaceAll('\\"', '"').replaceAll("\\'", "'")
      : form;
    const jsx = /<(?:form|input|select|textarea|label)\b[^>]*(?:className|htmlFor)\s*=/i.test(decoded);
    const normalized = normalizeForm(decoded, jsx);
    const next = serialized
      ? normalized
          .replace(/\r\n?|\n/g, "\\n")
          .replaceAll('"', '\\"')
      : normalized;
    if (next !== form) changed += 1;
    return next;
  });
  return { output, changed };
}

function trackedFiles(repo) {
  const output = execFileSync("git", ["-C", repo, "ls-files", "-z"], { encoding: "buffer" });
  return output.toString("utf8").split("\0").filter(Boolean).filter((relative) => {
    const parts = relative.split("/");
    return relative !== "scripts/normalize-contact-forms.mjs" &&
      (path.extname(relative).toLowerCase() === ".html" || runtimeFormSources.has(relative)) &&
      !parts.some((part) => skippedParts.has(part));
  });
}

function normalizeRepo(repo) {
  let filesChanged = 0;
  let formsChanged = 0;
  for (const relative of trackedFiles(repo)) {
    const file = path.join(repo, relative);
    if (!fs.existsSync(file) || fs.statSync(file).size > 5_000_000) continue;
    const text = fs.readFileSync(file, "utf8");
    if (!/<form\b/i.test(text)) continue;
    const result = normalizeText(text);
    if (!result.changed) continue;
    filesChanged += 1;
    formsChanged += result.changed;
    if (apply) fs.writeFileSync(file, result.output);
  }
  return { repo: path.basename(repo), filesChanged, formsChanged };
}

function installNormalizer(repo) {
  const target = path.join(repo, "scripts", "normalize-contact-forms.mjs");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const source = fs.readFileSync(new URL(import.meta.url), "utf8")
    .replace(/^const apply = .*$/m, "const apply = true;")
    .replace(/^const install = .*$/m, "const install = false;")
    .replace(/^const requestedRepo = .*$/m, "const requestedRepo = undefined;");
  if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== source) fs.writeFileSync(target, source);
  const packageFile = path.join(repo, "package.json");
  if (!fs.existsSync(packageFile)) {
    const vercelFile = path.join(repo, "vercel.json");
    if (fs.existsSync(vercelFile)) {
      const raw = fs.readFileSync(vercelFile, "utf8");
      const config = JSON.parse(raw);
      const command = "node scripts/normalize-contact-forms.mjs";
      const current = String(config.buildCommand || "").trim();
      if (!current.includes(command)) config.buildCommand = current ? `${current} && ${command}` : command;
      const next = `${JSON.stringify(config, null, 2)}\n`;
      if (next !== raw) fs.writeFileSync(vercelFile, next);
    }
    return;
  }
  const raw = fs.readFileSync(packageFile, "utf8");
  const pkg = JSON.parse(raw);
  pkg.scripts ||= {};
  const command = "node scripts/normalize-contact-forms.mjs";
  const current = String(pkg.scripts.prebuild || "").trim();
  if (!current.includes(command)) pkg.scripts.prebuild = current ? `${current} && ${command}` : command;
  const next = `${JSON.stringify(pkg, null, 2)}\n`;
  if (next !== raw) fs.writeFileSync(packageFile, next);
}

const repos = requestedPath ? [path.resolve(requestedPath)] : embedded ? [cwd] : fs.readdirSync(fleetRoot).map((name) => path.join(fleetRoot, name)).filter((item) => {
  return fs.existsSync(path.join(item, ".git")) && (!requestedRepo || path.basename(item) === requestedRepo);
});

const results = [];
for (const repo of repos.sort()) {
  if (skipDirty) {
    const status = execFileSync("git", ["-C", repo, "status", "--porcelain"], { encoding: "utf8" }).trim();
    if (status) {
      process.stdout.write(`SKIP ${path.basename(repo)} dirty-worktree\n`);
      continue;
    }
  }
  if (installOnly) {
    installNormalizer(repo);
    process.stdout.write(`INSTALLED ${path.basename(repo)}\n`);
    continue;
  }
  const result = normalizeRepo(repo);
  if (install && apply && result.formsChanged) installNormalizer(repo);
  if (result.formsChanged) process.stdout.write(`${apply ? "UPDATED" : "PLAN"} ${result.repo} files=${result.filesChanged} forms=${result.formsChanged}\n`);
  results.push(result);
}

const summary = {
  mode: apply ? "apply" : "check",
  repos: results.length,
  affectedRepos: results.filter((result) => result.formsChanged).length,
  filesChanged: results.reduce((sum, result) => sum + result.filesChanged, 0),
  formsChanged: results.reduce((sum, result) => sum + result.formsChanged, 0),
};
process.stdout.write(`${JSON.stringify(summary)}\n`);
