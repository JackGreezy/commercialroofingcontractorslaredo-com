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
  if (contextualTargets.has(relative) || contextualTargets.has(path.basename(relative))) {
    const links = intentLinks
      .filter(([route]) => sitemap.includes(route) && !next.includes(`href="${route}"`))
      .map(([route, label]) => `<p class="rh-rain-intent-link"><a href="${route}">${label}</a></p>`)
      .join("");
    if (links && /<footer\b/i.test(next)) next = next.replace(/<footer\b/i, `${links}<footer`);
  }
  if (next !== previous) {
    await writeFile(file, next);
    changed += 1;
  }
}

console.log(`RankHound conversion surfaces updated: ${changed}`);
