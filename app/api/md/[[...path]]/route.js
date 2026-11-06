import registry from '../../../../data/ai-pages.generated.json';
import { markdownResponse } from '../../../../lib/ai/http.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function respond(request, context) {
  const params = await context.params;
  const parts = params?.path || [];
  if (parts.length === 1 && parts[0] === '_catalog') {
    const body = JSON.stringify({ site: registry.site, total: Object.keys(registry.pages).length, pages: Object.values(registry.pages).map(({ route, canonical, title, summary, markdownUrl, lastModified }) => ({ route, canonical, title, summary, markdownUrl, lastModified, inFullContent: registry.fullRoutes.includes(route) })), skipped: registry.skipped });
    return new Response(request.method === 'HEAD' ? null : body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Robots-Tag': 'noindex, follow', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, s-maxage=3600' } });
  }
  let page = '/' + parts.join('/');
  if (page === '/index') page = '/';
  page = page?.replace(/\/+$/, '') || '/';
  return markdownResponse(registry.pages[page], request.method);
}
export const GET = respond;
export const HEAD = respond;
export const OPTIONS = respond;
