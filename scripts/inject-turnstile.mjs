import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), 'public');
const marker = '<script defer src="/turnstile-contact.js"></script>';
let changed = 0;
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.isDirectory()) {
      if (!['_next', 'node_modules', 'assets-f'].includes(item.name)) walk(path.join(dir, item.name));
      continue;
    }
    if (!item.isFile() || !item.name.endsWith('.html')) continue;
    const file = path.join(dir, item.name);
    if (fs.statSync(file).size > 5_000_000) continue;
    const before = fs.readFileSync(file, 'utf8');
    if (!/<form\b/i.test(before) || !/action=["']\/api\/(?:contact|submit)/i.test(before) || before.includes(marker)) continue;
    const after = before.replace(/<\/body>/i, `${marker}\n</body>`);
    if (after !== before) { fs.writeFileSync(file, after); changed++; }
  }
}
walk(root);
walk(path.join(process.cwd(), 'data', 'rendered-pages'));
walk(path.join(process.cwd(), 'data', 'audit-recovered-pages'));
console.log(`Turnstile loader injected into ${changed} public HTML files`);
