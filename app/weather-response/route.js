import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import mappings from '../../lib/weather-static-routes.json';
import { decorateLiveWeatherHtml, getLiveWeatherActivation } from '../../lib/live-weather-activation';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request) {
  const route = new URL(request.url).searchParams.get('route');
  const file = mappings.routes[route];
  if (!file) return new Response('Not found', { status: 404 });
  const publicDir = resolve(process.cwd(), 'public');
  const location = resolve(publicDir, '.' + file);
  if (!location.startsWith(publicDir + sep)) return new Response('Not found', { status: 404 });
  try {
    const html = await readFile(location, 'utf8');
    const activation = await getLiveWeatherActivation(mappings.siteId, route);
    return new Response(decorateLiveWeatherHtml(html, activation, route), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store, max-age=0', 'x-rh-weather-version': '3', 'x-rh-weather-status': activation?.phase || 'normal' } });
  } catch { return new Response('Not found', { status: 404 }); }
}
