import fs from 'node:fs';
import path from 'node:path';

// Run last: page restoration and funnel generators can recreate older markup.
const root = process.cwd();
const names = new Map();
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const directory of ['service-areas', 'locations']) {
  const dir = path.join(root, directory);
  if (!fs.existsSync(dir)) continue;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const raw = fs.readFileSync(path.join(dir, entry.name), 'utf8');
    let data;
    try { data = JSON.parse(raw); } catch {
      data = { title: raw.match(/"title"\s*:\s*"([^"]+)"/)?.[1] || '' };
    }
    const title = String(data.title || data.metaTitle || '');
    const label = data.name || data.locationName || title.match(/^Commercial Roofing Contractors\s+(.+?)\s*\|/i)?.[1]
      || title.match(/^Commercial (?:Roofing|Roofers)(?: Services)?(?: in)?\s+(.+?)\s*\|/i)?.[1];
    if (!label) continue;
    const clean = String(label).replace(/,\s*[A-Z]{2}(?:\s+\d{5})?$/, '').trim();
    if (clean.length > 2 && clean !== clean.toLowerCase()) names.set(clean.toLowerCase(), clean);
  }
}
for (const name of ['rendered-pages.json', 'routes.generated.json', 'site-pages.json']) {
  const file = path.join(root, 'data', name);
  if (!fs.existsSync(file)) continue;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const [route, record] of Object.entries(data.routes || data)) {
    if (!/^\/(?:service-areas|locations)\//.test(route) || !record || typeof record !== 'object') continue;
    const title = String(record.title || '');
    const label = title.match(/^Commercial Roofing Contractors\s+(.+?)\s*\|/i)?.[1];
    if (label) { const clean = label.replace(/,\s*[A-Z]{2}$/, '').trim(); names.set(clean.toLowerCase(), clean); }
  }
}
function collectHtmlNames(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.next', 'assets-f', 'images', 'ours'].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { collectHtmlNames(file); continue; }
    if (!entry.isFile() || !entry.name.endsWith('.html') || !/(?:service-areas|locations)/.test(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '';
    const label = title.match(/^Commercial Roofing Contractors\s+(.+?)\s*\|/i)?.[1]
      || title.match(/^Commercial (?:Roofing|Roofers)(?: Services)?(?: in)?\s+(.+?)\s*\|/i)?.[1];
    if (label) { const clean = label.replace(/,\s*[A-Z]{2}$/, '').trim(); if (clean !== clean.toLowerCase()) names.set(clean.toLowerCase(), clean); }
  }
}
for (const directory of ['public', 'rendered', '.generated']) collectHtmlNames(path.join(root, directory));
const alternatives = [...names.keys()].sort((a, b) => b.length - a.length).map(escape);
const pattern = alternatives.length ? new RegExp(`\\b(${alternatives.join('|')})\\b`, 'g') : null;
let changed = 0;
let checked = 0;
const errors = [];
function repairHtml(before, file) {
    let html = before;
    if (pattern) {
      // Touch rendered text only. URLs, slugs, attributes, scripts and CSS retain their bytes.
      html = html.replace(/<script\b[\s\S]*?<\/script\s*>|<style\b[\s\S]*?<\/style\s*>|<[^>]+>|([^<]+)/gi, (whole, text) => {
        if (!text) return whole;
        return text.replace(pattern, (lower, _capture, offset) => {
          const proper = names.get(lower);
          if (lower.includes(' ') || /(?:\b(?:in|for|near|around|across|serving|throughout|of)\s+)$/i.test(text.slice(0, offset)) || text.trim() === lower) return proper;
          return lower;
        });
      });
    }
    html = html.replace(/<form\b[\s\S]*?<\/form\s*>/gi, form => {
      if (!/action=["']\/api\/(?:contact|submit)/i.test(form) || /<form\b[^>]*role=["']search["']/i.test(form)) return form;
      return form.replace(/<input\b[^>]*>/gi, input => {
        if (!/\btype=["']hidden["']/i.test(input)) return input;
        const name = input.match(/\bname=["']([^"']+)["']/i)?.[1];
        if (!['name', 'phone', 'email', 'timeline', 'address', 'message'].includes(name)) return input;
        const occurrences = [...form.matchAll(new RegExp(`<(?:input|select|textarea)\\b[^>]*\\bname=["']${name}["']`, 'gi'))];
        return occurrences.length > 1 ? '' : input;
      });
    });
    for (const form of html.matchAll(/<form\b[\s\S]*?<\/form\s*>/gi)) {
      if (/<form\b[^>]*role=["']search["']/i.test(form[0])) continue;
      if (!/action=["']\/api\/(?:contact|submit)(?:["'?/])|data-contact-form/i.test(form[0])) continue;
      checked++;
      const fields = new Set([...form[0].matchAll(/<(?:input|select|textarea)\b[^>]*\bname=["']([^"']+)["']/gi)].map(m => m[1]));
      const missing = ['name', 'phone', 'email', 'timeline', 'address', 'message'].filter(name => !fields.has(name));
      if (missing.length) errors.push(`${path.relative(root, file)}: missing ${missing.join(', ')}`);
      if (!html.includes('/turnstile-contact.js')) {
        const marker = '<script defer src="/turnstile-contact.js"></script>';
        html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, marker + '\n</body>') : html + marker;
      }
    }
    return html;
}
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.next', 'assets-f', 'images', 'ours'].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (!entry.isFile()) continue;
    const isJson = ['rendered-pages.json', 'routes.generated.json', 'site-pages.json'].includes(entry.name);
    if (!isJson && !entry.name.endsWith('.html')) continue;
    const before = fs.readFileSync(file, 'utf8');
    let after;
    if (isJson) {
      const data = JSON.parse(before);
      function visit(value) {
        if (!value || typeof value !== 'object') return;
        for (const key of Object.keys(value)) {
          if (typeof value[key] === 'string' && /<(?:html|form|section|main|div)\b/i.test(value[key])) value[key] = repairHtml(value[key], file);
          else if (typeof value[key] === 'object') visit(value[key]);
        }
      }
      visit(data);
      after = JSON.stringify(data);
      if (after === JSON.stringify(JSON.parse(before))) after = before;
      else after += '\n';
    } else after = repairHtml(before, file);
    if (after !== before) { fs.writeFileSync(file, after); changed++; }
  }
}
for (const directory of ['public', 'data', 'rendered', '.generated']) walk(path.join(root, directory));
console.log(JSON.stringify({ locationNames: names.size, pagesRepaired: changed, formsChecked: checked, errors }));
if (errors.length) process.exitCode = 1;
