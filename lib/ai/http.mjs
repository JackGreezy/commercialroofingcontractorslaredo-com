export function prefersMarkdown(accept = '') {
  if (!accept.trim()) return false;
  const ranges = accept.toLowerCase().split(',').map(item => {
    const [type, ...params] = item.trim().split(';');
    const raw = params.find(p => /^\s*q\s*=/.test(p));
    const q = raw ? Number(raw.split('=')[1].trim()) : 1;
    return { type: type.trim(), q: Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0 };
  });
  function quality(type) {
    for (const pattern of [type, 'text/*', '*/*']) {
      const matches = ranges.filter(r => r.type === pattern);
      if (matches.length) return Math.max(...matches.map(r => r.q));
    }
    return 0;
  }
  // A wildcard alone never opts a client into Markdown.
  return ranges.some(r => r.type === 'text/markdown' && r.q > 0) && quality('text/markdown') > quality('text/html');
}
export function markdownResponse(page, method = 'GET') {
  const body = page?.markdown || '# Not found\n\nNo public Markdown page exists at this address.\n';
  const headers = {
    'Content-Type': 'text/markdown; charset=utf-8',
    'X-Markdown-Tokens': String(Math.ceil(body.length / 4)),
    'X-Robots-Tag': 'noindex, follow',
    'Vary': 'Accept',
    'Cache-Control': page ? 'public, s-maxage=3600, stale-while-revalidate=86400' : 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept',
  };
  if (page) {
    headers['Content-Location'] = page.canonical;
    headers.Link = `<${page.canonical}>; rel="canonical"`;
    if (page.lastModified) headers['Last-Modified'] = new Date(page.lastModified).toUTCString();
  }
  return new Response(method === 'HEAD' || method === 'OPTIONS' ? null : body, { status: method === 'OPTIONS' ? 204 : page ? 200 : 404, headers });
}
