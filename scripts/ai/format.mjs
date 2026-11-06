// Stored HTML is the content model in the static roofing sites. Parse those
// local source documents, never fetch or scrape a rendered production page.
const voidTags = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '-', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', bull: '•', copy: '©', reg: '®', trade: '™', ensp: ' ', emsp: ' ', thinsp: ' ' };
export function decode(value = '') {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (all, entity) => {
    if (entity[0] !== '#') return entities[entity.toLowerCase()] ?? all;
    const n = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
  });
}
export function parseHtml(html) {
  const root = { tag: 'root', attrs: {}, children: [] };
  const stack = [root];
  const tokens = html.match(/<!--[\s\S]*?-->|<![^>]*>|<(script|style|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>|<[^>]+>|[^<]+/gi) || [];
  for (const token of tokens) {
    if (token.startsWith('<!--') || token.startsWith('<!')) continue;
    if (token.startsWith('</')) {
      const tag = token.match(/^<\/\s*([\w:-]+)/)?.[1]?.toLowerCase();
      for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === tag) { stack.length = i; break; }
    } else if (token.startsWith('<')) {
      const tag = token.match(/^<\s*([\w:-]+)/)?.[1]?.toLowerCase();
      if (!tag) continue;
      const opening = token.slice(0, token.indexOf('>') + 1);
      const attrs = {};
      for (const match of opening.slice(tag.length + 1).matchAll(/([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[match[1].toLowerCase()] = decode(match[2] ?? match[3] ?? match[4] ?? '');
      const node = { tag, attrs, children: [] };
      stack.at(-1).children.push(node);
      if (['script', 'style', 'textarea'].includes(tag) && /<\//.test(token)) node.children.push({ text: token.slice(opening.length).replace(new RegExp('</' + tag + '\\s*>$', 'i'), '') });
      else if (!voidTags.has(tag) && !/\/\s*>$/.test(token)) stack.push(node);
    } else stack.at(-1).children.push({ text: decode(token) });
  }
  return root;
}
export function findAll(node, predicate) {
  return (predicate(node) ? [node] : []).concat((node.children || []).flatMap(child => findAll(child, predicate)));
}
export const plain = node => ('text' in node ? node.text : (node.children || []).map(plain).join(' ')).replace(/\s+/g, ' ').trim();
export function absolute(href, origin) {
  try { const url = new URL(href, origin); return ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
const omitted = new Set('script style noscript svg nav footer dialog iframe canvas button input select textarea template'.split(' '));
function hidden(node) {
  const a = node.attrs || {};
  return omitted.has(node.tag) || ['navigation', 'banner', 'contentinfo', 'dialog'].includes(a.role) || 'hidden' in a || a['aria-hidden'] === 'true' || /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(a.style || '') || /(?:^|\s)(?:screen-reader-text|sr-only|cookie-banner|mobile-menu|rr-lead-controls|alb-mobile-help|footer(?:-[\w-]+)?|site-footer|nav-wrapper(?:-\d+)?|navbar|site-header)(?:\s|$)/.test(a.class || '');
}
export function markdownFromTree(tree, origin) {
  const fallback = findAll(tree, n => n.tag === 'body')[0] || tree;
  const body = findAll(tree, n => n.tag === 'main')[0] || fallback;
  function render(node, parents = []) {
    if ('text' in node) return node.text.replace(/\s+/g, ' ').replace(/([\\`*_\[\]])/g, '\\$1');
    if (hidden(node)) return '';
    if (node.tag === 'head') return '';
    if (node.tag === 'header' && !parents.some(p => ['main', 'section', 'article'].includes(p.tag))) return '';
    const children = () => (node.children || []).map(n => render(n, [...parents, node])).join('');
    const tag = node.tag;
    if (tag === 'a') {
      if (node.attrs['data-ai-answer-link'] !== undefined) return '';
      if (/^skip to (?:main|content)/i.test(plain(node))) return '';
      const text = children().trim().replace(/\n+/g, ' ').replace(/(?:^|\s)#{1,6}\s/g, ' ').replace(/\s+/g, ' '), href = absolute(node.attrs.href || '', origin);
      return text ? href ? `[${text}](${href.replace(/\)/g, '%29')})` : text : '';
    }
    if (tag === 'img') return '';
    if (/^h[1-6]$/.test(tag)) return `\n\n${'#'.repeat(Number(tag[1]))} ${children().trim()}\n\n`;
    if (tag === 'br') return '\n';
    if (tag === 'hr') return '\n\n---\n\n';
    if (tag === 'strong' || tag === 'b') return `**${children().trim()}**`;
    if (tag === 'em' || tag === 'i') return `*${children().trim()}*`;
    if (tag === 'li') return `\n- ${children().trim()}`;
    if (tag === 'dt') return `\n**${children().trim()}**: `;
    if (tag === 'dd') return `${children().trim()}\n`;
    if (tag === 'summary') return `\n\n### ${children().trim()}\n\n`;
    if (tag === 'table') {
      const rows = findAll(node, n => n.tag === 'tr').map(row => (row.children || []).filter(n => ['td', 'th'].includes(n.tag)).map(n => render(n, parents).trim().replace(/\n+/g, ' ').replace(/\|/g, '\\|'))).filter(r => r.length);
      if (!rows.length) return '';
      const size = Math.max(...rows.map(r => r.length));
      const lines = rows.map(r => '| ' + [...r, ...Array(size - r.length).fill('')].join(' | ') + ' |');
      lines.splice(1, 0, '| ' + Array(size).fill('---').join(' | ') + ' |');
      return '\n\n' + lines.join('\n') + '\n\n';
    }
    const content = children();
    return ['p', 'div', 'section', 'article', 'main', 'ul', 'ol', 'dl', 'blockquote', 'details'].includes(tag) ? '\n\n' + content.trim() + '\n\n' : content;
  }
  let result = render(body).trim();
  if (result.length < 40 && body !== fallback) {
    const expanded = render(fallback).trim();
    if (!result || expanded.length > result.length + 40) result = expanded;
  }
  return result.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
export function metadata(tree) {
  const metas = findAll(tree, n => n.tag === 'meta');
  const get = name => metas.find(n => (n.attrs.name || n.attrs.property || '').toLowerCase() === name)?.attrs.content || '';
  return { title: plain(findAll(tree, n => n.tag === 'title')[0] || { text: '' }), description: get('description'), noindex: /noindex|none/i.test(get('robots') + ' ' + get('googlebot')) };
}
