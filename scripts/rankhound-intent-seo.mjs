#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply") ||
  (process.argv.includes("--vercel") && /^(1|true)$/i.test(process.env.VERCEL || ""));
const rootArg = process.argv.find((arg) => arg.startsWith("--root="));
const ROOT = path.resolve(rootArg ? rootArg.slice("--root=".length) : process.cwd());
const MARKER = "rankhound-intent-seo-v1";
const VARIANT_MARKER = "rankhound-market-variants-v2";
const TAXONOMIES = new Set([
  "pages",
  "services",
  "locations",
  "service-areas",
  "roof-systems",
  "damage-repair",
  "property-types",
  "industries",
  "capabilities",
]);

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function exists(file) {
  return fs.existsSync(file);
}

function normalizeRoute(value) {
  if (!value) return null;
  try {
    if (/^https?:\/\//i.test(value)) value = new URL(value).pathname;
  } catch {}
  let route = String(value).split(/[?#]/)[0].trim();
  if (!route.startsWith("/")) route = `/${route}`;
  route = route.replace(/\/{2,}/g, "/").replace(/\/index\.html$/i, "/").replace(/\.html$/i, "");
  route = route.replace(/\/+$/, "");
  return route || "/";
}

function sitemapRoutes() {
  const file = path.join(ROOT, "public", "sitemap.xml");
  if (!exists(file)) return [];
  return [...read(file).matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((match) => normalizeRoute(match[1]))
    .filter(Boolean);
}

function ensureHomepageInSitemap() {
  const file = path.join(ROOT, "public", "sitemap.xml");
  if (!exists(file)) return false;
  const previous = read(file);
  const locs = [...previous.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) =>
    match[1].trim(),
  );
  if (!locs.length) return false;
  let homepage;
  try {
    const first = new URL(locs[0].replace(/&amp;/g, "&"));
    homepage = `${first.protocol}//${first.host}/`;
  } catch {
    return false;
  }
  const hasHomepage = locs.some((value) => {
    try {
      const url = new URL(value.replace(/&amp;/g, "&"));
      return `${url.protocol}//${url.host}/` === homepage && (url.pathname === "/" || url.pathname === "");
    } catch {
      return false;
    }
  });
  if (hasHomepage) return false;
  const next = previous.replace(
    /(<urlset\b[^>]*>)/i,
    `$1\n  <url><loc>${escapeHtml(homepage)}</loc></url>`,
  );
  if (next === previous) return false;
  if (APPLY) fs.writeFileSync(file, next);
  return true;
}

function homeRecordCandidates() {
  const found = [];
  const direct = path.join(ROOT, "pages", "home.json");
  if (exists(direct)) {
    try {
      found.push(JSON.parse(read(direct)));
    } catch {}
  }
  for (const rel of ["data/pages.generated.json", "data/routes.generated.json"]) {
    const file = path.join(ROOT, rel);
    if (!exists(file)) continue;
    try {
      const data = JSON.parse(read(file));
      if (data?.["/"]) found.push(data["/"]);
      if (data?.routes?.["/"]) found.push(data.routes["/"]);
      if (Array.isArray(data?.routes)) {
        const record = data.routes.find((item) => normalizeRoute(item?.route || item?.path) === "/");
        if (record) found.push(record);
      }
    } catch {}
  }
  return found.filter((item) => item && typeof item === "object");
}

function stripTags(value) {
  return String(value || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value) {
  const small = new Set(["and", "of", "in", "the"]);
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (/^[A-Z]{2}$/.test(word)) return word;
      if (index && small.has(word.toLowerCase())) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

const DOMAIN_MARKETS = {
  allentown: "Allentown",
  albuquerque: "Albuquerque",
  annarbor: "Ann Arbor",
  batonrouge: "Baton Rouge",
  bentonville: "Bentonville",
  charleston: "Charleston",
  coloradosprings: "Colorado Springs",
  columbusga: "Columbus, GA",
  corpuschristi: "Corpus Christi",
  desmoines: "Des Moines",
  elpaso: "El Paso",
  fortcollins: "Fort Collins",
  fortlauderdale: "Fort Lauderdale",
  fortsmith: "Fort Smith",
  fortwayne: "Fort Wayne",
  fortworth: "Fort Worth",
  grandrapids: "Grand Rapids",
  greenbay: "Green Bay",
  kansascity: "Kansas City",
  lakecharles: "Lake Charles",
  lascruces: "Las Cruces",
  lasvegas: "Las Vegas",
  littlerock: "Little Rock",
  longbeach: "Long Beach",
  losangeles: "Los Angeles",
  mcallen: "McAllen",
  myrtlebeach: "Myrtle Beach",
  newhampshire: "New Hampshire",
  newjersey: "New Jersey",
  neworleans: "New Orleans",
  newyork: "New York",
  northdakota: "North Dakota",
  oklahomacity: "Oklahoma City",
  rhodeisland: "Rhode Island",
  saltlakecity: "Salt Lake City",
  sanantonio: "San Antonio",
  sanbernardino: "San Bernardino",
  sandiego: "San Diego",
  sanfrancisco: "San Francisco",
  sanjose: "San Jose",
  santafe: "Santa Fe",
  southdakota: "South Dakota",
  springfieldmo: "Springfield, MO",
  stpetersburgcommercialroofing: "St. Petersburg",
  stlouis: "St. Louis",
  virginiabeach: "Virginia Beach",
  westpalmbeach: "West Palm Beach",
  westvirginia: "West Virginia",
  winstonsalem: "Winston-Salem",
};

function marketFromDomain() {
  const sitemap = path.join(ROOT, "public", "sitemap.xml");
  let host = "";
  if (exists(sitemap)) {
    const match = read(sitemap).match(/<loc>\s*https?:\/\/(?:www\.)?([^/<]+)/i);
    host = match?.[1] || "";
  }
  const base = host.split(".")[0] || path.basename(ROOT).replace(/-com$/, "");
  let raw = base
    .replace(/^commercialroofingcontractors?/, "")
    .replace(/^commercialroofers?/, "")
    .replace(/^commercialroofingof/, "")
    .replace(/^commercialroofing/, "");
  return DOMAIN_MARKETS[raw] || titleCase(raw.replace(/[-_]+/g, " ")) || "Your Area";
}

function deriveMarket() {
  const sitemapFile = path.join(ROOT, "public", "sitemap.xml");
  if (exists(sitemapFile) && /commercialroofingadvisors\.com/i.test(read(sitemapFile))) return "Nationwide";
  const domainMarket = marketFromDomain();
  if (Object.values(DOMAIN_MARKETS).includes(domainMarket)) return domainMarket;
  const siteFile = path.join(ROOT, "data", "site.generated.json");
  if (exists(siteFile)) {
    try {
      const site = JSON.parse(read(siteFile));
      if (site?.city) return titleCase(site.city);
    } catch {}
  }
  for (const record of homeRecordCandidates()) {
    const schemaCity = String(record.html || "").match(/"addressLocality"\s*:\s*"([^"]+)"/i)?.[1];
    if (schemaCity) return titleCase(schemaCity);
    const title = stripTags(record.title || "");
    const patterns = [
      /Commercial Roofing (?:Contractors? )?(?:of |in )?([^|–—,]+?)(?:\s+(?:Commercial|Roofing|Roofers?|Contractors?))*\s*(?:[|–—]|$)/i,
      /Commercial Roofers? (?:of |in )?([^|–—,]+?)(?:\s+(?:Commercial|Roofing))*\s*(?:[|–—]|$)/i,
    ];
    for (const pattern of patterns) {
      const match = title.match(pattern);
      const value = match?.[1]?.trim();
      if (value && value.length < 40 && !/^(consultants?|advisors?|services?)$/i.test(value)) return titleCase(value);
    }
  }
  return domainMarket;
}

const ROUTE_RULES = {
  repair: {
    include: [/\brepair\b/i, /\bleak\b/i],
    prefer: [/commercial-roof-(?:leak-)?repair/i, /\/services\//i],
    reject: [/insurance/i, /residential/i, /hail|wind|storm|snow|humidity/i],
    label: "Commercial Roof Repair",
  },
  replacement: {
    include: [/\breplacement\b/i, /\breroof/i, /tear-off/i],
    prefer: [/commercial-roof-replacement/i, /\/services\//i, /tear-off/i],
    reject: [/residential/i, /insurance/i],
    label: "Commercial Roof Replacement",
  },
  coatings: {
    include: [/\bcoatings?\b/i, /fluid-applied/i, /roof-restoration/i],
    prefer: [/commercial-roof-coatings?/i, /\/services\//i, /roof-restoration/i],
    reject: [/residential/i],
    label: "Commercial Roof Coatings",
  },
  maintenance: {
    include: [/\bmaintenance\b/i, /service-agreement/i, /service-contract/i],
    prefer: [/maintenance-program/i, /preventive-roof-maintenance/i, /\/services\//i],
    reject: [/residential/i],
    label: "Roof Maintenance Programs",
  },
  inspection: {
    include: [/\binspection/i, /roof-survey/i],
    prefer: [/commercial-roof-inspection/i, /\/services\//i],
    reject: [/residential/i],
    label: "Commercial Roof Inspections & Reports",
  },
  reports: {
    include: [/roof-report/i, /condition-report/i, /condition-assessment/i, /roof-assessment/i, /roof-survey/i, /capital-planning/i],
    prefer: [/roof-condition-report/i, /condition-report/i, /condition-assessment/i, /roof-report/i, /\/capabilities\//i],
    reject: [/residential/i],
    label: "Roof Reports & Assessments",
  },
};

function scoreRoute(route, rule) {
  const haystack = route.replace(/[-_/]+/g, " ");
  if (!rule.include.some((pattern) => pattern.test(route) || pattern.test(haystack))) return -Infinity;
  let score = 10;
  for (const pattern of rule.prefer) if (pattern.test(route)) score += 5;
  for (const pattern of rule.reject) if (pattern.test(route)) score -= 20;
  if (/^\/(?:services\/)?roof-report\/?$/i.test(route)) score += 20;
  score -= route.split("/").filter(Boolean).length;
  score -= route.length / 100;
  return score;
}

function selectPillars(routes) {
  const selected = {};
  for (const [intent, rule] of Object.entries(ROUTE_RULES)) {
    selected[intent] = routes
      .map((route) => ({ route, score: scoreRoute(route, rule) }))
      .filter((item) => Number.isFinite(item.score))
      .sort((a, b) => b.score - a.score || a.route.localeCompare(b.route))[0]?.route || null;
  }
  if (!selected.reports) selected.reports = selected.inspection;
  return selected;
}

function intentForRoute(route, pillars) {
  return Object.entries(pillars).find(([, value]) => value === route)?.[0] || null;
}

function isLocationRoute(route) {
  return /^\/(?:locations|service-areas)\//i.test(route);
}

const STATE_NAMES = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY",
};
const STATE_CODES = new Set(Object.values(STATE_NAMES));

function cleanLocationName(value, market) {
  let name = stripTags(value)
    .replace(/\s+\|\s+.*$/i, "")
    .replace(/\s+(?:Commercial Roofing Service Area|Commercial Roofing Contractors?|Commercial Roofers?)$/i, "")
    .replace(/^(?:Commercial Roofing(?: Contractors?)?|Commercial Roofers?)\s+(?:in\s+)?/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!name) return market;
  if (/^(?:Tucson|Your Area)$/i.test(name) && market) return market;
  return name;
}

function stateFromSource(source, slug) {
  const html = typeof source === "string" ? source : String(source?.html || "");
  const title = typeof source === "object" ? String(source?.title || "") : "";
  const raw = `${title} ${html.slice(0, 12000)}`;
  const haystack = `${title} ${stripTags(html.slice(0, 12000))}`;
  const code = haystack.match(/,\s*([A-Z]{2})\b/)?.[1] ||
    raw.match(/\\"?addressRegion\\"?\s*:\s*\\"([A-Z]{2})\\"/i)?.[1]?.toUpperCase();
  if (code && STATE_CODES.has(code)) return code;
  const lower = haystack.toLowerCase();
  for (const [name, abbreviation] of Object.entries(STATE_NAMES)) {
    if (new RegExp(`\\b${name.replace(/ /g, "\\s+")}\\b`, "i").test(lower)) return abbreviation;
  }
  const slugCode = slug.match(/-([a-z]{2})$/i)?.[1]?.toUpperCase();
  return slugCode && STATE_CODES.has(slugCode) ? slugCode : null;
}

function locationFor(route, source, market) {
  if (!isLocationRoute(route)) return null;
  const html = typeof source === "string" ? source : String(source?.html || "");
  const title = typeof source === "object" ? String(source?.title || "") : "";
  const h1 = stripTags(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "");
  const candidates = [
    h1.match(/^(?:Commercial Roofing(?: Contractors?)?|Commercial Roofers?)\s+(?:in\s+)?(.+)$/i)?.[1],
    title.match(/^(.+?)\s+Commercial Roofing Service Area(?:\s*\||$)/i)?.[1],
    title.match(/^(?:Commercial Roofing(?: Contractors?)?|Commercial Roofers?)\s+(?:in\s+)?(.+?)(?:\s*\||$)/i)?.[1],
  ].filter(Boolean);
  const slug = route.split("/").filter(Boolean).at(-1) || "";
  const state = stateFromSource(source, slug);
  const slugWithoutState = state && slug.toLowerCase().endsWith(`-${state.toLowerCase()}`)
    ? slug.slice(0, -3)
    : slug;
  const slugName = titleCase(
    slugWithoutState
      .replace(/-(?:commercial-)?roofing-corridor$/i, "")
      .replace(/[-_]+/g, " "),
  );
  let name = candidates.length ? cleanLocationName(candidates[0], market) : "";
  const core = name.replace(/,\s*(?:[A-Z]{2}|[A-Za-z ]+)$/i, "").trim();
  if (
    !name ||
    core.length > 46 ||
    /commercial roofing|commercial roofers?|local roofers?/i.test(name)
  ) {
    name = slugName;
  }
  if (slugName.replace(/[^a-z0-9]/gi, "").toLowerCase() === market.replace(/[^a-z0-9]/gi, "").toLowerCase()) {
    name = market;
  }
  name = cleanLocationName(name, market).replace(/,\s*(?:[A-Z]{2}|[A-Za-z ]+)$/i, "").trim();
  return state ? `${name}, ${state}` : name;
}

function titleFor(route, intent, market, location = null) {
  if (route === "/" && market === "Nationwide") return "Commercial Roofing Consultants | Repair, Replacement & Coatings";
  if (route === "/") return `Commercial Roofing Contractors ${market} | Local Roofers`;
  if (location) {
    const exact = `Commercial Roofing Contractors ${location} | Local Roofers`;
    if (exact.length <= 78) return exact;
    const shorter = `Commercial Roofing ${location} | Local Roofers`;
    if (shorter.length <= 78) return shorter;
    return `Commercial Roofers ${location}`;
  }
  if (intent === "repair") return `Commercial Roof Repair in ${market} | Planned & Emergency`;
  if (intent === "replacement") return `Commercial Roof Replacement in ${market}`;
  if (intent === "coatings") return `Commercial Roof Coatings in ${market} | Restoration`;
  if (intent === "maintenance") return `Commercial Roof Maintenance Programs in ${market}`;
  if (intent === "inspection") return `Commercial Roof Inspections & Reports in ${market}`;
  if (intent === "reports") return `Commercial Roof Reports in ${market} | Condition Assessments`;
  return null;
}

function descriptionFor(route, intent, market, location = null) {
  if (route === "/" && market === "Nationwide") {
    return "Commercial roofing consultants for owners and asset managers: assessments, repair and replacement scopes, coatings, maintenance programs, and portfolio reports.";
  }
  if (route === "/") {
    return `Commercial roofing in ${market} from local commercial roofing contractors and roofers for repair, replacement, coatings, maintenance, inspections, and roof reports.`;
  }
  if (location) {
    return `Commercial roofing contractors serving ${location} with commercial roof repair, replacement, coatings, maintenance programs, inspections, and documented roof reports.`;
  }
  const descriptions = {
    repair: `Commercial roof repair in ${market} with leak investigation, documented repair boundaries, emergency stabilization, and planned corrective work.`,
    replacement: `Commercial roof replacement in ${market} with clear tear-off or recover scopes, system options, phasing, budgeting, and closeout documentation.`,
    coatings: `Commercial roof coatings in ${market} with candidacy checks, preparation requirements, restoration scope, drainage review, and warranty planning.`,
    maintenance: `Commercial roof maintenance programs in ${market} with scheduled inspections, drain and detail service, repair tracking, photos, and budget priorities.`,
    inspection: `Commercial roof inspections and condition reports in ${market} covering membrane, seams, flashings, drainage, penetrations, moisture indicators, photos, and next steps.`,
    reports: `Commercial roof reports in ${market} with photo-documented conditions, repair priorities, replacement triggers, budget context, and capital planning support.`,
  };
  return descriptions[intent] || null;
}

function supportSentence(route, intent, market) {
  if (route === "/" && market === "Nationwide") {
    return "Independent roof assessments, repair and replacement scopes, coating evaluations, maintenance programs, and portfolio condition reports for commercial owners nationwide.";
  }
  if (route === "/") {
    return `Commercial roof repair, replacement, coatings, maintenance programs, inspections, and condition reports for owners and facility teams across ${market}.`;
  }
  const copy = {
    repair: `The scope documents leak sources, repair boundaries, photos, and priorities so ${market} owners can separate immediate stabilization from longer-term capital work.`,
    replacement: `The replacement plan explains tear-off or recover assumptions, insulation and drainage needs, occupied-building phasing, system options, and closeout requirements.`,
    coatings: `A coating recommendation starts with adhesion, moisture, drainage, membrane condition, detail preparation, and warranty eligibility—not every existing roof is a restoration candidate.`,
    maintenance: `A useful maintenance program records recurring conditions, clears drainage, services vulnerable details, tracks repairs, and turns each visit into a prioritized roof history.`,
    inspection: `The inspection records membrane, seams, flashings, drains, penetrations, edge metal, moisture indicators, photographs, and practical next steps in a condition report.`,
    reports: `The condition report organizes roof areas, observed defects, photographs, repair priorities, replacement triggers, and budget context for facilities and capital planning.`,
  };
  return copy[intent] || "";
}

function variantSentence(route, market, location = null) {
  if (route === "/" && market !== "Nationwide") {
    return `Local commercial roofers and commercial roofing contractors serve ${market} businesses with repair, replacement, coatings, maintenance, inspections, and roof reports.`;
  }
  if (location) {
    return `Commercial roofing contractors and local commercial roofers serve businesses in ${location} with repair, replacement, coatings, maintenance, inspections, and roof reports.`;
  }
  return "";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function updateTitleTag(html, title) {
  if (!title || !/<head\b/i.test(html)) return html;
  if (/<title\b[^>]*>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  }
  return html.replace(/<\/head>/i, `<title>${escapeHtml(title)}</title>\n</head>`);
}

function updateDescriptionTag(html, description) {
  if (!description || !/<head\b/i.test(html)) return html;
  const tag = `<meta name="description" content="${escapeHtml(description)}">`;
  const pattern = /<meta\b(?=[^>]*\bname\s*=\s*["']description["'])[^>]*>/i;
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace(/<\/head>/i, `${tag}\n</head>`);
}

function updateSocialTags(html, title, description) {
  const replacements = [
    ["property", "og:title", title],
    ["property", "og:description", description],
    ["name", "twitter:title", title],
    ["name", "twitter:description", description],
  ];
  let next = html;
  for (const [attribute, value, content] of replacements) {
    if (!content) continue;
    const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}\\s*=\\s*["']${escapedValue}["'])[^>]*>`, "i");
    if (!pattern.test(next)) continue;
    next = next.replace(pattern, `<meta ${attribute}="${value}" content="${escapeHtml(content)}">`);
  }
  return next;
}

function updatePlainH1(html, market, location = null) {
  const pattern = /<h1\b([^>]*)>([^<]{1,180})<\/h1>/i;
  const match = html.match(pattern);
  if (!match) return html;
  const current = stripTags(match[2]);
  const replacement = market === "Nationwide"
    ? "Commercial Roofing Consultants Nationwide"
    : `Commercial Roofers in ${escapeHtml(location || market)}`;
  if (current === stripTags(replacement)) return html;
  return html.replace(pattern, `<h1${match[1]}>${replacement}</h1>`);
}

function addVariantSentence(html, sentence) {
  if (!sentence || html.includes(VARIANT_MARKER)) return html;
  const h1End = html.search(/<\/h1>/i);
  if (h1End < 0) return html;
  const head = html.slice(0, h1End + 5);
  const tail = html.slice(h1End + 5);
  const pattern = /<p\b([^>]*)>([\s\S]*?)<\/p>/i;
  const match = tail.match(pattern);
  if (!match || (match.index ?? Infinity) > 3000 || /<(?:p|h[1-6]|section|div)\b/i.test(match[2])) {
    return html;
  }
  const replacement = `<p${match[1]}>${match[2].trim()} <span data-rankhound-seo="${VARIANT_MARKER}">${escapeHtml(sentence)}</span></p>`;
  return head + tail.replace(pattern, replacement);
}

function addSupportToFirstPlainParagraph(html, sentence) {
  if (!sentence || html.includes(MARKER)) return html;
  const h1End = html.search(/<\/h1>/i);
  if (h1End < 0) return html;
  const head = html.slice(0, h1End + 5);
  const tail = html.slice(h1End + 5);
  const pattern = /<p\b([^>]*)>([^<]{10,900})<\/p>/i;
  const match = tail.match(pattern);
  if (!match) return html;
  if ((match.index ?? Infinity) > 2500) return html;
  const current = stripTags(match[2]);
  const topicCount = ["repair", "replacement", "coating", "maintenance", "inspection", "report"]
    .filter((term) => current.toLowerCase().includes(term)).length;
  if (topicCount >= 4 || current.includes(sentence)) return html;
  const replacement = `<p${match[1]}>${match[2].trim()} <span data-rankhound-seo="${MARKER}">${escapeHtml(sentence)}</span></p>`;
  return head + tail.replace(pattern, replacement);
}

function addLinksToExistingSection(html, pillars) {
  const links = Object.entries(pillars)
    .filter(([, href]) => href)
    .map(([intent, href]) => ({ intent, href, label: ROUTE_RULES[intent].label }));
  if (!links.length) return html;
  const sectionPattern = /<section\b[^>]*class=["'][^"']*\binternal-links\b[^"']*["'][^>]*>[\s\S]*?<\/section>/i;
  const match = html.match(sectionPattern);
  if (!match) return html;
  let section = match[0];
  const missing = links.filter(({ href }) => !new RegExp(`href=["']${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:/)?["']`, "i").test(section));
  if (!missing.length) return html;
  const items = missing.map(({ href, label }) => `<li data-rankhound-seo="${MARKER}"><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`).join("");
  if (/<\/ul>/i.test(section)) section = section.replace(/<\/ul>/i, `${items}</ul>`);
  else return html;
  return html.replace(sectionPattern, section);
}

function transformHtml(html, route, intent, market, pillars) {
  let next = String(html || "");
  const location = locationFor(route, next, market);
  const title = titleFor(route, intent, market, location);
  const description = descriptionFor(route, intent, market, location);
  next = updateSocialTags(updateDescriptionTag(updateTitleTag(next, title), description), title, description);
  if (route === "/" || location) next = updatePlainH1(next, market, location);
  if (route === "/" || intent) next = addSupportToFirstPlainParagraph(next, supportSentence(route, intent, market));
  if (route === "/" || location) next = addVariantSentence(next, variantSentence(route, market, location));
  next = addLinksToExistingSection(next, pillars);
  return next;
}

function routeFromRecord(record, hint, file) {
  const explicit = normalizeRoute(record?.route || record?.path || hint);
  if (explicit) return explicit;
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  const match = rel.match(/^(pages|services|locations|service-areas|roof-systems|damage-repair|property-types|industries|capabilities)\/(.+)\.json$/);
  if (!match) return null;
  if (match[1] === "pages" && match[2] === "home") return "/";
  return normalizeRoute(match[1] === "pages" ? match[2] : `${match[1]}/${match[2]}`);
}

function linkRecords(pillars) {
  return Object.entries(pillars)
    .filter(([, href]) => href)
    .map(([intent, href]) => ({
      anchor: ROUTE_RULES[intent].label,
      slug: href.split("/").filter(Boolean).at(-1) || "home",
      taxonomy: href.split("/").filter(Boolean)[0] || "pages",
      href,
    }));
}

function transformRecord(record, route, market, pillars) {
  if (!record || typeof record !== "object" || !route) return false;
  const intent = intentForRoute(route, pillars);
  const location = locationFor(route, record, market);
  let changed = false;
  const title = titleFor(route, intent, market, location);
  const description = descriptionFor(route, intent, market, location);
  if (title && record.title !== title) {
    record.title = title;
    changed = true;
  }
  for (const key of ["description", "metaDescription", "metaDesc"]) {
    if (description && Object.hasOwn(record, key) && record[key] !== description) {
      record[key] = description;
      changed = true;
    }
  }
  if (typeof record.html === "string") {
    const next = transformHtml(record.html, route, intent, market, pillars);
    if (next !== record.html) {
      record.html = next;
      changed = true;
    }
  }
  if (Array.isArray(record.internalLinks)) {
    const current = new Set(record.internalLinks.map((item) => normalizeRoute(item?.href || item?.route)).filter(Boolean));
    for (const link of linkRecords(pillars)) {
      if (!current.has(link.href) && link.href !== route) {
        record.internalLinks.push(link);
        current.add(link.href);
        changed = true;
      }
    }
  }
  return changed;
}

function walkRecords(node, file, market, pillars, hint = null, seen = new WeakSet()) {
  if (!node || typeof node !== "object" || seen.has(node)) return 0;
  seen.add(node);
  let count = 0;
  if (hint || typeof node.html === "string" || node.route || node.path || node.slug) {
    const route = routeFromRecord(node, hint, file);
    if (route && transformRecord(node, route, market, pillars)) count++;
  }
  if (Array.isArray(node)) {
    node.forEach((item) => { count += walkRecords(item, file, market, pillars, null, seen); });
  } else {
    for (const [key, value] of Object.entries(node)) {
      if (!value || typeof value !== "object") continue;
      const childHint = key.startsWith("/") ? key : null;
      count += walkRecords(value, file, market, pillars, childHint, seen);
    }
  }
  return count;
}

function jsonFiles() {
  const out = [];
  for (const taxonomy of TAXONOMIES) {
    const dir = path.join(ROOT, taxonomy);
    if (!exists(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".json")) out.push(path.join(dir, entry.name));
    }
  }
  for (const rel of [
    "about.json",
    "data/pages.generated.json",
    "data/routes.generated.json",
    "data/rendered-pages.json",
    "public/route-map.json",
  ]) {
    const file = path.join(ROOT, rel);
    if (exists(file)) out.push(file);
  }
  return [...new Set(out)];
}

function htmlManifestMap() {
  const map = new Map();
  const manifests = [
    { file: path.join(ROOT, "data", "rendered-pages", "manifest.json"), base: path.join(ROOT, "data", "rendered-pages") },
    { file: path.join(ROOT, "rendered", "route-manifest.json"), base: path.join(ROOT, "rendered", "pages") },
  ];
  for (const manifest of manifests) {
    if (!exists(manifest.file)) continue;
    try {
      const data = JSON.parse(read(manifest.file));
      const routes = data.routes && typeof data.routes === "object" ? data.routes : data;
      for (const [route, entry] of Object.entries(routes)) {
        const relative = typeof entry === "string" ? entry : entry?.file;
        if (!relative) continue;
        map.set(path.resolve(manifest.base, relative), normalizeRoute(route));
      }
    } catch {}
  }
  return map;
}

function routeFromHtmlFile(file, manifestMap) {
  const fromManifest = manifestMap.get(path.resolve(file));
  if (fromManifest) return fromManifest;
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  if (/^public\/(?:home|index|root)\.html$/i.test(rel)) return "/";
  if (
    /^(?:public\/(?:__static-pages|rendered|rendered-pages|site-pages)\/|data\/rendered-pages\/|rendered\/(?:pages\/)?|\.site\/pages\/)(?:home|index|root)(?:\/index)?\.html$/i.test(
      rel,
    )
  ) {
    return "/";
  }
  let value = rel
    .replace(/^public\/(?:__static-pages|rendered|rendered-pages|site-pages)\//, "")
    .replace(/^data\/rendered-pages\//, "")
    .replace(/^rendered\/pages\//, "")
    .replace(/^rendered\//, "")
    .replace(/^\.site\/pages\//, "")
    .replace(/\/index\.html$/i, "")
    .replace(/\.html$/i, "");
  value = value.replace(/__/g, "/");
  return normalizeRoute(value);
}

function htmlFiles() {
  const dirs = [
    path.join(ROOT, "public", "__static-pages"),
    path.join(ROOT, "public", "rendered"),
    path.join(ROOT, "public", "rendered-pages"),
    path.join(ROOT, "public", "site-pages"),
    path.join(ROOT, "data", "rendered-pages"),
    path.join(ROOT, "rendered", "pages"),
    path.join(ROOT, "rendered"),
    path.join(ROOT, ".site", "pages"),
  ];
  const direct = [path.join(ROOT, "public", "home.html"), path.join(ROOT, "public", "index.html"), path.join(ROOT, "public", "root.html")];
  const out = direct.filter(exists);
  for (const start of dirs) {
    if (!exists(start)) continue;
    const stack = [start];
    while (stack.length) {
      const dir = stack.pop();
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) stack.push(file);
        else if (entry.isFile() && entry.name.endsWith(".html")) out.push(file);
      }
    }
  }
  return [...new Set(out)];
}

function writeIfChanged(file, next, previous) {
  if (next === previous) return false;
  if (APPLY) fs.writeFileSync(file, next);
  return true;
}

const sitemapChanged = ensureHomepageInSitemap();
const routes = sitemapRoutes();
const market = deriveMarket();
const pillars = selectPillars(routes);
let jsonFilesChanged = 0;
let recordsChanged = 0;
let htmlFilesChanged = 0;

for (const file of jsonFiles()) {
  const previous = read(file);
  let data;
  try {
    data = JSON.parse(previous);
  } catch {
    continue;
  }
  const changed = walkRecords(data, file, market, pillars);
  if (!changed) continue;
  recordsChanged += changed;
  const indent = previous.includes("\n  ") ? 2 : 0;
  const next = `${JSON.stringify(data, null, indent)}${previous.endsWith("\n") ? "\n" : ""}`;
  if (writeIfChanged(file, next, previous)) jsonFilesChanged++;
}

const manifestMap = htmlManifestMap();
for (const file of htmlFiles()) {
  const route = routeFromHtmlFile(file, manifestMap);
  if (!route || (!routes.includes(route) && !isLocationRoute(route))) continue;
  const intent = intentForRoute(route, pillars);
  const previous = read(file);
  const next = transformHtml(previous, route, intent, market, pillars);
  if (writeIfChanged(file, next, previous)) htmlFilesChanged++;
}

const report = {
  mode: APPLY ? "apply" : "check",
  root: path.basename(ROOT),
  market,
  routeCount: routes.length,
  pillars,
  jsonFilesChanged,
  recordsChanged,
  htmlFilesChanged,
  sitemapChanged,
};
console.log(JSON.stringify(report));

if (!routes.length) process.exitCode = 2;
