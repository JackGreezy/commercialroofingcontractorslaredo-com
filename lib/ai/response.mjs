import pages from './pages.generated.json';
export async function withAiResponse(response, request) {
  if (!response || response.status !== 200 || !response.headers.get('content-type')?.includes('text/html')) return response;
  const url = new URL(request.url);
  const route = (url.searchParams.get('route') || url.pathname).replace(/\/+$/, '') || '/';
  const page = pages[route];
  if (!page) return response;
  let html = await response.text();
  if (/<head\b/i.test(html) && !/<\/head\s*>/i.test(html) && /<body\b/i.test(html)) html = html.replace(/<body\b/i, '</head><body');
  const esc = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  html = html.replace(/\s*<meta\b[^>]*name=["']ai-summary["'][^>]*>/gi, '').replace(/\s*<link\b[^>]*type=["']text\/markdown["'][^>]*>/gi, '');
  const signals = `<meta name="ai-summary" content="${esc(page.summary)}"><link rel="alternate" type="text/markdown" href="${page.markdownUrl}">`;
  html = html.replace(/<\/head>/i, signals + '</head>');
  const headers = new Headers(response.headers); headers.delete('content-length');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}
