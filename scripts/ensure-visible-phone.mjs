import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || process.cwd());
const publicDir = path.join(root, 'public');
const files = [
  'index.html', 'home.html', 'contact.html', 'contact-us.html',
  'services.html', 'service-areas.html',
  '__static-pages/index.html', '__static-pages/home.html',
  '__static-pages/contact.html', '__static-pages/contact-us.html',
].map((file) => path.join(publicDir, file)).filter(fs.existsSync);

function readPhone() {
  const config = path.join(root, 'lib', 'contact-config.js');
  if (fs.existsSync(config)) {
    const source = fs.readFileSync(config, 'utf8');
    const display = source.match(/\bphone:\s*['"]([^'"]+)['"]/);
    const href = source.match(/\bphoneTel:\s*['"]([^'"]+)['"]/);
    if (display && href) return { display: display[1], href: href[1] };
  }
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const match = source.match(/<script[^>]*id=['"]rr-lead-controls-config['"][^>]*>([\s\S]*?)<\/script>/i);
    if (!match) continue;
    try {
      const config = JSON.parse(match[1]);
      if (config.phone && config.phoneTel) return { display: config.phone, href: config.phoneTel };
    } catch {}
  }
  throw new Error('No verified site phone in contact config or lead controls config');
}

const { display, href } = readPhone();
if (!/^\+1\d{10}$/.test(href) || !/^\(\d{3}\) \d{3}-\d{4}$/.test(display)) {
  throw new Error('Invalid configured US phone number');
}
const style = `<style id="rankhound-visible-phone-style">.rankhound-visible-phone{position:fixed;right:20px;bottom:20px;z-index:99998;display:flex;align-items:center;gap:12px;max-width:calc(100vw - 32px);padding:12px 16px;border-radius:12px;background:#133c29;color:#fff;box-shadow:0 8px 28px rgba(0,0,0,.22);font:600 15px/1.3 Arial,sans-serif}.rankhound-visible-phone span{font-size:13px;font-weight:400}.rankhound-visible-phone a{color:#fff;text-decoration:underline;white-space:nowrap}@media(max-width:650px){.rankhound-visible-phone{left:12px;right:auto;bottom:12px;max-width:calc(100vw - 104px);padding:11px 13px;border-radius:999px}.rankhound-visible-phone span{display:none}.rankhound-visible-phone a{font-size:14px;text-decoration:none}}</style>`;
const callout = `<aside class="rankhound-visible-phone" aria-label="Call about a commercial roof"><span>Roof leaking or planning work?</span><a href="tel:${href}">Call ${display}</a></aside>`;
let count = 0;
for (const file of files) {
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes('rankhound-visible-phone')) {
    const updated = html.replace(/<style\b[^>]*id=["']rankhound-visible-phone-style["'][^>]*>[\s\S]*?<\/style>/i, style);
    if (updated !== html) { fs.writeFileSync(file, updated); count++; }
    continue;
  }
  if (!/<\/head>/i.test(html) || !/<\/body>/i.test(html)) continue;
  html = html.replace(/<\/head>/i, `${style}</head>`).replace(/<\/body>/i, `${callout}</body>`);
  fs.writeFileSync(file, html);
  count++;
}
console.log(`visible-phone: ${count} pages, ${display}`);
