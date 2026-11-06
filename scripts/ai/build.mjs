import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseHtml, metadata, markdownFromTree, findAll, plain, decode } from './format.mjs';

const read = file => fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const json = file => { try { return JSON.parse(read(file)); } catch { return {}; } };
const esc = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const privatePath = route => /^\/(?:api|admin|portal|dashboard|auth|sign-in|sign-up|onboarding|dev-access|internal|preview)(?:\/|$)/i.test(route);
export async function buildAiSite(root = process.cwd()) {
  const publicDir = path.join(root, 'public');
  const config = json(path.join(root, 'home.config.json'));
  const vercel = json(path.join(root, 'vercel.json'));
  const weather = json(path.join(root, 'lib/weather-static-routes.json')).routes || {};
  const dataManifest = json(path.join(root, 'data/rendered-pages/manifest.json')).routes || {};
  const renderedManifestDoc = fs.existsSync(path.join(root, 'rendered/route-manifest.json')) ? json(path.join(root, 'rendered/route-manifest.json')) : json(path.join(root, 'rendered/manifest.json'));
  const renderedManifest = renderedManifestDoc.routes || renderedManifestDoc;
  const sitePageRoutes = json(path.join(publicDir, 'site-pages/routes.json'));
  const publicRouteFiles = json(path.join(publicDir, 'routes.json'));
  const projectRecords = json(path.join(root, 'data/project-pages.json'));
  const projectRendererFile = path.join(root, 'lib/ai/project-renderers.mjs');
  const projectRenderers = fs.existsSync(projectRendererFile) ? await import(pathToFileURL(projectRendererFile).href) : null;
  const contentTransformFile = path.join(root, 'lib/ai/content-transform.mjs');
  const contentTransform = fs.existsSync(contentTransformFile) ? (await import(pathToFileURL(contentTransformFile).href)).transform : null;
  const sitemap = read(path.join(publicDir, 'sitemap.xml'));
  const entries = [...sitemap.matchAll(/<url>\s*([\s\S]*?)<\/url>/g)].map(match => {
    const loc = decode(match[1].match(/<loc>\s*([^<]+)\s*<\/loc>/)?.[1] || '');
    const lastModified = match[1].match(/<lastmod>\s*([^<]+)\s*<\/lastmod>/)?.[1];
    const url = new URL(loc);
    return { route: url.pathname.replace(/\/+$/, '') || '/', canonical: url.origin + (url.pathname.replace(/\/+$/, '') || '/'), lastModified: lastModified && Number.isFinite(Date.parse(lastModified)) ? lastModified : undefined };
  });
  if (!entries.length) throw new Error('No sitemap-backed public routes found');
  const origin = new URL(entries[0].canonical).origin;
  if (config.domain && new URL('https://' + config.domain.replace(/^https?:\/\//, '')).hostname.replace(/^www\./, '') !== new URL(origin).hostname.replace(/^www\./, '')) throw new Error('Site config and sitemap domain disagree');
  const pages = {}, skipped = [], patched = new Set();
  const nativeSources = new Map(), sourceDocuments = new Map();
  const nativeApp = fs.existsSync(path.join(root, 'app')) && fs.readdirSync(path.join(root, 'app')).some(name => (name.startsWith('[') && fs.readdirSync(path.join(root, 'app', name)).some(f => /^page\.[jt]sx?$/.test(f))) || /^page\.[jt]sx?$/.test(name));
  if (nativeApp) {
    for (const name of ['data/rendered-pages.json', 'data/site-pages.json', 'data/pages.json', 'data/pages.generated.json', 'data/strategic-pages.generated.json', 'data/ai-native-pages.json']) {
      const file = path.join(root, name), document = json(file);
      if (!Object.keys(document).length) continue;
      sourceDocuments.set(file, document);
      for (const [route, record] of Object.entries(document)) if (route.startsWith('/') && typeof record?.html === 'string') nativeSources.set(route.replace(/\/+$/, '') || '/', { file, record });
    }
  }
  const seo = json(path.join(root, 'data/seo-query-overrides.json'));
  const depth = ['extensions', 'additions', 'final'].map(suffix => json(path.join(root, 'data/seo-query-depth-' + suffix + '.json')));
  const sourceFor = route => {
    if (projectRenderers && projectRecords[route]) {
      const record = projectRecords[route];
      const body = route === '/projects' ? projectRenderers.projectIndex() : projectRenderers.projectMain(record);
      const file = path.join(root, 'data/ai-source', route.slice(1).replaceAll('/', '__') + '.html');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `<!doctype html><html><head><title>${esc(record.title)}</title><meta name="description" content="${esc(record.description)}"></head><body>${body}</body></html>`);
      return file;
    }
    if (nativeSources.has(route)) {
      let { record } = nativeSources.get(route);
      const nativeOutput = json(path.join(root, 'data/ai-native-pages.json'));
      const finalized = path.join(publicDir, '__static-pages', route === '/' ? 'index.html' : route.slice(1).replaceAll('/', '__') + '.html');
      if (fs.existsSync(path.join(root, 'app/HomeRedesign.tsx')) && !nativeOutput[route] && fs.existsSync(finalized)) return finalized;
      if (contentTransform) record = contentTransform(route, record);
      const overrides = seo[route] || {};
      let body = record.html;
      const oldTitle = record.title?.split(' | ')[0];
      if (overrides.title && oldTitle) body = body.split(oldTitle).join(overrides.title).split(oldTitle.toUpperCase()).join(overrides.title.toUpperCase());
      const extension = (overrides.appendHtml || '') + depth.map(records => records[route] || '').join('');
      if (extension && body.includes('</article>')) body = body.replace('</article>', extension + '</article>');
      const file = path.join(root, 'data/ai-source', route === '/' ? 'index.html' : route.slice(1).replaceAll('/', '__') + '.html');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const title = overrides.title ? overrides.title + ' | ' + (config.businessName || config.biz || 'Commercial Roofing Advisors') : record.title;
      fs.writeFileSync(file, /<html\b/i.test(body) ? body : `<!doctype html><html><head><title>${esc(title || '')}</title><meta name="description" content="${esc(overrides.metaDesc || record.description || record.metaDescription || '')}">${record.noindex ? '<meta name="robots" content="noindex">' : ''}</head><body>${body}</body></html>`);
      return file;
    }
    const rewrite = (vercel.rewrites || []).find(r => r.source?.replace(/\/+$/, '') === (route === '/' ? '' : route));
    const flat = route.slice(1).replaceAll('/', '__');
    const dataEntry = dataManifest[route] || dataManifest[route + '/'];
    const dataFile = typeof dataEntry === 'string' ? dataEntry : dataEntry?.file;
    const renderedFile = renderedManifest[route] || renderedManifest[route + '/'] || renderedManifest['*'];
    const candidates = [
      route === '/' && /path\.join\(publicDir, ["']home\.html["']\)/.test(read(path.join(root, 'app/[[...path]]/route.js'))) && path.join(publicDir, 'home.html'),
      weather[route] && path.join(publicDir, weather[route]),
      rewrite?.destination?.endsWith('.html') && path.join(publicDir, rewrite.destination),
      dataFile && path.join(root, 'data/rendered-pages', dataFile),
      typeof renderedFile === 'string' && path.join(root, 'rendered/pages', renderedFile),
      typeof renderedFile === 'string' && path.join(root, 'rendered', renderedFile),
      sitePageRoutes[route] && path.join(publicDir, 'site-pages', sitePageRoutes[route]),
      publicRouteFiles[route] && path.join(publicDir, 'rendered-pages', publicRouteFiles[route]),
      route === '/services/roof-lifting' && path.join(root, 'data/roof-lifting-page.html'),
      path.join(publicDir, route === '/' ? 'index.html' : route.slice(1) + '.html'),
      path.join(publicDir, route.slice(1), 'index.html'),
      path.join(publicDir, 'rendered', route.slice(1), 'index.html'),
      path.join(publicDir, 'rendered', route === '/' ? 'index.html' : route.slice(1) + '.html'),
      /-(?:al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc)$/.test(route) && path.join(publicDir, 'rendered', route.slice(1,-3), 'index.html'),
      path.join(publicDir, '__static-pages', route === '/' ? 'index.html' : flat + '.html'),
      path.join(publicDir, 'site-pages', route === '/' ? 'index.html' : flat + '.html'),
      path.join(publicDir, 'site-pages', route.slice(1) + '.html'),
      path.join(root, 'data/rendered-pages', route === '/' ? 'index.html' : flat + '.html'),
    ].filter(Boolean);
    return candidates.find(f => fs.existsSync(f));
  };
  for (const entry of entries) {
    if (pages[entry.route]) continue;
    if (privatePath(entry.route)) { skipped.push({ route: entry.route, reason: 'private route' }); continue; }
    if (/\.(?:txt|xml|json|pdf|md)$/i.test(entry.route)) { skipped.push({ route: entry.route, reason: 'existing non-HTML resource, not an HTML page' }); continue; }
    let file = sourceFor(entry.route);
    if (!file) throw new Error('Missing authoritative HTML source: ' + entry.route);
    if (!/<head\b/i.test(read(file))) {
      const fragment = read(file), fragmentTree = parseHtml(fragment);
      const title = plain(findAll(fragmentTree, node => node.tag === 'h1')[0] || { text: entry.route.split('/').at(-1).replaceAll('-', ' ') });
      const description = plain(findAll(fragmentTree, node => node.tag === 'p')[0] || { text: '' }).slice(0, 300);
      file = path.join(root, 'data/ai-source', entry.route === '/' ? 'index.html' : entry.route.slice(1).replaceAll('/', '__') + '.html');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `<!doctype html><html><head><title>${esc(title)}</title><meta name="description" content="${esc(description)}"></head><body>${fragment}</body></html>`);
    }
    let html = read(file).replace(/<script\b[^>]*data-ai-(?:page|site)-schema[^>]*>[\s\S]*?<\/script>/gi, '').replace(/\s*<a\b[^>]*data-ai-answer-link[^>]*>[\s\S]*?<\/a>/gi, '');
    if (/<head\b/i.test(html) && !/<\/head\s*>/i.test(html) && /<body\b/i.test(html)) html = html.replace(/<body\b/i, '</head><body');
    const utilityPage = /^\/(?:contact|privacy(?:-policy)?|terms(?:-of-service)?)$/.test(entry.route);
    if (utilityPage && (config.businessName || config.biz)) html = html.replace(/Asphalt Paving/g, esc(config.businessName || config.biz));
    let tree = parseHtml(html), meta = metadata(tree);
    if (meta.noindex) { skipped.push({ route: entry.route, reason: 'noindex' }); continue; }
    if (!meta.title) throw new Error('Missing title: ' + entry.route);
    const summary = meta.description || plain(findAll(tree, n => n.tag === 'p')[0] || { text: '' }).slice(0, 300);
    // Keep existing FAQ wording. Only add stable links to visible questions.
    let questionIndex = 0;
    html = html.replace(/<(h[2-4]|summary)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (all, tag, attrs, inner) => {
      const question = plain(parseHtml(inner));
      if (!question.endsWith('?') || /data-ai-answer-link/.test(inner)) return all;
      const existing = attrs.match(/\bid=["']([^"']+)["']/)?.[1];
      const id = existing || 'answer-' + question.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + (++questionIndex);
      return `<${tag}${attrs}${existing ? '' : ` id="${esc(id)}"`}>${inner} <a data-ai-answer-link href="#${esc(id)}" aria-label="Link to this answer">#</a></${tag}>`;
    });
    const mdPath = entry.route === '/' ? '/index.md' : entry.route + '.md';
    const entityName = config.businessName || config.biz || '';
    const publicSchemas = [];
    if (entry.route.startsWith('/services/') && entityName && !/"@type"\s*:\s*"Service"/.test(html)) {
      const serviceName = plain(findAll(tree, n => n.tag === 'h1')[0] || { text: meta.title });
      const area = [config.city, config.state].filter(Boolean).join(', ');
      publicSchemas.push({ '@type': 'Service', name: serviceName, description: summary, url: entry.canonical, provider: { '@type': 'Organization', name: entityName, url: origin }, ...(area ? { areaServed: area } : {}) });
    }
    if (!/"@type"\s*:\s*"FAQPage"/.test(html)) {
      const questions = [];
      function collect(node) {
        const children = node.children || [];
        children.forEach((child, index) => {
          if (/^h[2-4]$/.test(child.tag || '') && plain(child).endsWith('?')) {
            const parts = [];
            for (const next of children.slice(index + 1)) {
              if (/^h[1-6]$/.test(next.tag || '')) break;
              if (['p', 'ul', 'ol'].includes(next.tag)) parts.push(plain(next));
              else if (next.tag) break;
            }
            const answer = parts.join(' ').trim();
            if (answer && answer.length <= 2000) questions.push({ '@type': 'Question', name: plain(child), acceptedAnswer: { '@type': 'Answer', text: answer } });
          }
          collect(child);
        });
      }
      collect(tree);
      if (questions.length) publicSchemas.push({ '@type': 'FAQPage', mainEntity: questions.slice(0, 20) });
    }
    html = html.replace(/<script\b[^>]*data-ai-page-schema[^>]*>[\s\S]*?<\/script>/gi, '');
    if (publicSchemas.length) html = html.replace(/<\/head>/i, '<script type="application/ld+json" data-ai-page-schema>' + JSON.stringify({ '@context': 'https://schema.org', '@graph': publicSchemas }).replace(/</g, '\\u003c') + '</script></head>');
    html = html.replace(/\s*<meta\b[^>]*name=["']ai-summary["'][^>]*>/gi, '').replace(/\s*<link\b[^>]*type=["']text\/markdown["'][^>]*>/gi, '');
    const head = `<meta name="ai-summary" content="${esc(summary)}"><link rel="alternate" type="text/markdown" href="${origin}${mdPath}">`;
    html = html.replace(/<\/head>/i, head + '</head>');
    if (!html.includes(head)) throw new Error('Missing HTML head: ' + entry.route);
    if (html !== read(file)) { fs.writeFileSync(file, html); patched.add(path.relative(root, file)); }
    if (nativeSources.has(entry.route)) {
      const { record } = nativeSources.get(entry.route);
      // Preserve the original editorial record and all runtime enhancements.
      // FAQ anchors are the only body change copied back into its data model.
      record.html = record.html.replace(/<script\b[^>]*data-ai-page-schema[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<(h[2-4]|summary)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (all, tag, attrs, inner) => {
        const match = html.match(new RegExp('<' + tag + '[^>]*id=["\']([^"\']+)["\'][^>]*>' + inner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*<a data-ai-answer-link[^>]*>[\\s\\S]*?<\\/a><\\/' + tag + '>', 'i'));
        return match && !/data-ai-answer-link/.test(inner) ? `<${tag}${attrs}${/\bid=/.test(attrs) ? '' : ' id="' + esc(match[1]) + '"'}>${inner} <a data-ai-answer-link href="#${esc(match[1])}" aria-label="Link to this answer">#</a></${tag}>` : all;
      });
      const schema = html.match(/<script\b[^>]*data-ai-page-schema[^>]*>[\s\S]*?<\/script>/i)?.[0];
      if (schema) record.html += schema;
    }
    tree = parseHtml(html);
    let content = markdownFromTree(tree, entry.canonical);
    if (entry.route === '/contact') {
      const links = findAll(tree, node => node.tag === 'a').map(node => node.attrs.href || '');
      const digits = String(config.phone || '').replace(/\D/g, '').slice(-10);
      const phone = digits && links.find(href => href.startsWith('tel:') && href.replace(/\D/g, '').endsWith(digits));
      const email = config.email && links.find(href => href.toLowerCase() === 'mailto:' + config.email.toLowerCase());
      const contact = [phone ? `- Phone: [${config.phone}](${phone})` : '', email ? `- Email: [${config.email}](${email})` : ''].filter(Boolean);
      if (contact.length) content += '\n\n## Contact details\n\n' + contact.join('\n');
    }
    if (content.length < (utilityPage ? 5 : 40)) throw new Error('Empty main content: ' + entry.route);
    const h1 = content.match(/^# ([^\n]+)$/m)?.[1] || meta.title;
    content = content.replace(/^# [^\n]+\n*/m, '').trim();
    const markdown = `# ${h1}\n\n> ${summary}\n\nCanonical: ${entry.canonical}\n${entry.lastModified ? '\nLast updated: ' + entry.lastModified + '\n' : ''}\n${content}\n`;
    pages[entry.route] = { ...entry, title: meta.title, summary, markdown, markdownUrl: origin + mdPath, source: path.relative(root, file) };
  }
  const home = pages['/'];
  if (!home) throw new Error('Homepage is not eligible for Markdown');
  for (const [file, document] of sourceDocuments) fs.writeFileSync(file, JSON.stringify(document));
  const site = { name: config.businessName || config.biz || nativeSources.get('/')?.record.siteName || home.title.split('|').at(-1).trim(), url: origin, description: home.summary, contact: config.email || '', phone: config.phone || '' };
  const homeFile = path.join(root, home.source);
  let homeHtml = read(homeFile);
  const homeTree = parseHtml(homeHtml);
  const schemas = findAll(homeTree, n => n.tag === 'script' && n.attrs.type === 'application/ld+json').flatMap(n => { try { return [JSON.parse((n.children || []).map(c => c.text || '').join(''))]; } catch { return []; } });
  const schemaText = JSON.stringify(schemas);
  const nodes = [];
  if (!/"(?:Organization|RoofingContractor|LocalBusiness)"/.test(schemaText)) nodes.push({ '@type': 'Organization', '@id': origin + '/#organization', name: site.name, url: origin, description: site.description, ...(site.contact ? { email: site.contact } : {}), ...(site.phone ? { telephone: site.phone } : {}), contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', url: origin + '/contact', ...(site.contact ? { email: site.contact } : {}), ...(site.phone ? { telephone: site.phone } : {}) }, ...(config.brand_logo ? { logo: new URL(config.brand_logo, origin).href } : {}) });
  if (!/"WebSite"/.test(schemaText)) nodes.push({ '@type': 'WebSite', '@id': origin + '/#website', name: site.name, url: origin, description: site.description });
  if (nodes.length) {
    homeHtml = homeHtml.replace(/<\/head>/i, '<script type="application/ld+json" data-ai-site-schema>' + JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }).replace(/</g, '\\u003c') + '</script></head>');
    fs.writeFileSync(homeFile, homeHtml); patched.add(home.source);
  }
  const sorted = Object.values(pages).sort((a, b) => (a.route.split('/').length - b.route.split('/').length) || a.route.localeCompare(b.route));
  // Keep llms-full bounded, and disclose exactly which documents were included.
  const fullRoutes = [];
  let full = `# ${site.name}: full content\n\n> ${site.description}\n\nThe catalog lists all ${sorted.length} public Markdown pages: ${origin}/api/md/_catalog\n\n`;
  for (const page of sorted) {
    const fragment = `\n---\n\n<!-- source: ${page.canonical} -->\n\n${page.markdown}`;
    if (full.length + fragment.length > 480000) continue;
    full += fragment; fullRoutes.push(page.route);
  }
  full = `<!-- Includes ${fullRoutes.length} of ${sorted.length} pages. Fetch remaining pages from the complete catalog. -->\n` + full;
  const groups = new Map();
  for (const page of sorted) {
    const group = page.route.split('/').length <= 2 ? 'Core pages' : page.route.split('/')[1].replaceAll('-', ' ');
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(page);
  }
  let llms = `# ${site.name}\n\n> ${site.description}\n\n${site.contact ? 'Contact: ' + site.contact + '\n\n' : ''}<!-- Keep in sync with robots.txt and ai.txt. Generated from the public route registry. -->\n`;
  for (const [group, items] of groups) llms += `\n## ${group}\n\n` + items.slice(0, 50).map(p => `- [${p.title.replace(/\[/g, '\\[').replace(/\]/g, '\\]')}](${p.markdownUrl}): ${p.summary.replace(/\s+/g, ' ')}`).join('\n') + '\n';
  llms += `\n## Machine-readable\n\n- [Full content](${origin}/llms-full.txt): ${fullRoutes.length} pages within the size limit.\n- [Complete Markdown catalog](${origin}/api/md/_catalog): all ${sorted.length} public pages.\n- [Sitemap](${origin}/sitemap.xml): canonical HTML URLs.\n- [AI usage policy](${origin}/ai.txt).\n`;
  const policy = `[identity]\nname: ${site.name}\nurl: ${origin}\ndescription: ${site.description}\ncontact: ${site.contact}\n\n[permissions]\nSummarise, quote with attribution, cite, and index public content for search and answers.\n\n[restrictions]\nDo not fabricate quotes, reviews, ratings, project results, prices, or guarantees.\nDo not present this content as your own. Private and authenticated content is excluded.\nTraining-crawler permissions are unchanged; consult robots.txt.\n\n[attribution]\nCite ${site.name} and the canonical HTML URL provided with each document.\n\n[scope]\nIncluded: public pages in ${origin}/api/md/_catalog\nExcluded: /api/, /admin/, /portal/, /dashboard/, /auth/, /sign-in, /sign-up, /onboarding/, /dev-access, drafts and noindex pages.\n\n[contact]\n${site.contact || origin + '/contact'}\n\n# Keep in sync with robots.txt and llms.txt. Generated from the public route registry.\n`;
  for (const [name, body] of [['llms.txt', llms], ['llms-full.txt', full], ['ai.txt', policy]]) fs.writeFileSync(path.join(publicDir, name), body);
  let robots = read(path.join(publicDir, 'robots.txt')) || `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`;
  // Search agents inherit the wildcard group's restrictions. Training bot
  // groups and their existing policy are left exactly as configured.
  if (!/User-agent:\s*\*/i.test(robots)) robots += '\nUser-agent: *\nAllow: /\n';
  const bots = ['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User'];
  const missingBots = bots.filter(bot => !new RegExp('User-agent:\\s*' + bot + '\\s*(?:\\r?\\n|$)', 'i').test(robots));
  robots = robots.replace(/User-agent:\s*\*[^\S\r\n]*(?:\r?\n|$)/i, all => all + missingBots.map(bot => 'User-agent: ' + bot + '\n').join(''));
  const privateRules = ['/api/', '/admin/', '/portal/', '/dashboard/', '/auth/', '/sign-in', '/sign-up', '/onboarding/', '/dev-access'];
  robots = robots.split(/\n\s*\n/).map(group => {
    if (!/User-agent:/i.test(group)) return group;
    const missing = privateRules.filter(rule => !group.includes('Disallow: ' + rule));
    return group + (missing.length ? '\n# AI public-route exclusions\n' + missing.map(rule => 'Disallow: ' + rule).join('\n') : '');
  }).join('\n\n');
  robots = robots.replace(/\n?# Keep in sync with llms\.txt and ai\.txt\.[^\n]*\n?/g, '\n').trim() + `\n# Keep in sync with llms.txt and ai.txt. Discovery: ${origin}/llms.txt ${origin}/ai.txt\n`;
  fs.writeFileSync(path.join(publicDir, 'robots.txt'), robots);
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.mkdirSync(path.join(root, 'lib/ai'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data/ai-pages.generated.json'), JSON.stringify({ version: 1, site, pages, fullRoutes, skipped }) + '\n');
  fs.writeFileSync(path.join(root, 'lib/ai/routes.generated.json'), JSON.stringify({ origin, routes: Object.keys(pages), nativeMarkdown: entries.filter(e => e.route.endsWith('.md')).map(e => e.route) }) + '\n');
  fs.writeFileSync(path.join(root, 'lib/ai/pages.generated.json'), JSON.stringify(Object.fromEntries(Object.entries(pages).map(([route, page]) => [route, { summary: page.summary, markdownUrl: page.markdownUrl, canonical: page.canonical }]))) + '\n');
  return { pages: sorted.length, fullPages: fullRoutes.length, fullChars: full.length, skipped, patched: [...patched] };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await buildAiSite(), null, 2));
