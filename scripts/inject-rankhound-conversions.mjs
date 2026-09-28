import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.join(process.cwd(), "public");
const trackingTag = '<script defer src="/rankhound-conversion-events.js"></script>';
const intentLinks = [
  ["/services/drain-cleaning-repair", "Roof Drain Cleaning &amp; Repair"],
  ["/roof-systems/modified-bitumen-systems", "Modified Bitumen Systems"],
  ["/services/church-roofing", "Church Roofing"],
];
const contextualTargets = new Set([
  "index.html",
  "home.html",
  "services.html",
  "services__commercial-roof-leak-repair.html",
  "services__storm-damage-roof-repair.html",
  "services/commercial-roof-leak-repair.html",
  "services/storm-damage-roof-repair.html",
]);

async function htmlFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(absolute));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(absolute);
  }
  return files;
}

let sitemap = "";
try {
  sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");
} catch {}

const rainHomeWrappers = new Set(["", "__static-pages", "leak-first-rich", "rendered-pages", "site-pages", "rendered", "pages", "data/leak-first-rendered", "data/rendered-pages"]);
function isHomePageFile(relative) {
  const clean = relative.replaceAll("\\", "/").replace(/^(public|data\/leak-first-rendered|data\/rendered-pages|rendered)\//, "");
  const dir = clean.includes("/") ? clean.slice(0, clean.lastIndexOf("/")) : "";
  return /(^|\/)(index|home)\.html$/.test(clean) && rainHomeWrappers.has(dir);
}
const rainLinkRun = /(?:<p class="rh-rain-intent-link"><a href="[^"]*">[^<]*<\/a><\/p>)+/g;
const rainIntentStyle = `<style id="rh-rain-intent-style">:where(p.rh-rain-intent-link){box-sizing:border-box;width:min(1180px,calc(100% - 48px));padding:4px 0;font-size:15px;line-height:1.5;text-align:left}p.rh-rain-intent-link{margin-left:auto;margin-right:auto;margin-top:0;margin-bottom:0}:where(:not(.rh-rain-intent-link)+p.rh-rain-intent-link){padding-top:36px}:where(p.rh-rain-intent-link:not(:has(+.rh-rain-intent-link))){padding-bottom:36px}:where(p.rh-rain-intent-link a){font-weight:600;text-decoration:underline;text-underline-offset:3px}</style>`;
let changed = 0;
for (const file of await htmlFiles(root)) {
  const relative = path.relative(root, file).replaceAll(path.sep, "/");
  const previous = await readFile(file, "utf8");
  let next = previous;
  if (!next.includes("/rankhound-conversion-events.js")) {
    next = /<\/body>/i.test(next)
      ? next.replace(/<\/body>/i, `${trackingTag}\n</body>`)
      : `${next}\n${trackingTag}`;
  }
  if (isHomePageFile(relative)) next = next.replace(rainLinkRun, "");
  else if (contextualTargets.has(relative) || contextualTargets.has(path.basename(relative))) {
    const links = intentLinks
      .filter(([route]) => sitemap.includes(route) && !next.includes(`href="${route}"`))
      .map(([route, label]) => `<p class="rh-rain-intent-link"><a href="${route}">${label}</a></p>`)
      .join("");
    if (links && /<footer\b/i.test(next)) next = next.replace(/<footer\b/i, `${links}<footer`);
  }
  if (next.includes('class="rh-rain-intent-link"') && !next.includes('id="rh-rain-intent-style"') && /<\/head>/i.test(next)) next = next.replace(/<\/head>/i, `${rainIntentStyle}</head>`);
  if (next !== previous) {
    await writeFile(file, next);
    changed += 1;
  }
}

for (const extraDir of ["data/leak-first-rendered", "rendered", "data/rendered-pages"]) {
  let extraFiles = [];
  try { extraFiles = await htmlFiles(path.join(root, "..", extraDir)); } catch {}
  for (const file of extraFiles) {
    const previous = await readFile(file, "utf8");
    if (isHomePageFile(path.relative(path.join(root, ".."), file)) && rainLinkRun.test(previous)) { rainLinkRun.lastIndex = 0; await writeFile(file, previous.replace(rainLinkRun, "")); continue; }
    rainLinkRun.lastIndex = 0;
    if (previous.includes('class="rh-rain-intent-link"') && !previous.includes('id="rh-rain-intent-style"') && /<\/head>/i.test(previous)) {
      await writeFile(file, previous.replace(/<\/head>/i, `${rainIntentStyle}</head>`));
    }
  }
}
console.log(`RankHound conversion surfaces updated: ${changed}`);
