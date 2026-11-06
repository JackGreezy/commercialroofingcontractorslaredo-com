import { NextResponse } from 'next/server';
import inventory from './routes.generated.json';
import { prefersMarkdown } from './http.mjs';

const routes = new Set(inventory.routes);
export function aiRoute(request) {
  const pathname = request.nextUrl.pathname.replace(/\/+$/, '') || '/';
  if (inventory.nativeMarkdown.includes(pathname)) return null;
  const suffix = pathname.endsWith('.md');
  const page = suffix ? pathname === '/index.md' ? '/' : pathname.slice(0, -3) : pathname;
  if (/^\/(?:api|_next|\.well-known)(?:\/|$)/.test(pathname)) return null;
  if (suffix || routes.has(page) && prefersMarkdown(request.headers.get('accept') || '')) {
    const url = request.nextUrl.clone();
    url.pathname = '/api/md' + (page === '/' ? '/index' : page); url.search = '';
    const response = NextResponse.rewrite(url);
    response.headers.set('Vary', 'Accept');
    return response;
  }
  return null;
}
export function aiDiscovery(response, request) {
  response ||= NextResponse.next();
  const pathname = request.nextUrl.pathname.replace(/\/+$/, '') || '/';
  if (!routes.has(pathname)) return response;
  const origin = inventory.origin;
  const discovery = ['llms.txt', 'llms-full.txt', 'ai.txt'].map(file => `<${origin}/${file}>; rel="describedby"`).join(', ');
  const prior = response.headers.get('Link');
  response.headers.set('Link', prior ? prior + ', ' + discovery : discovery);
  const vary = response.headers.get('Vary') || '';
  if (!vary.toLowerCase().split(',').map(x => x.trim()).includes('accept')) response.headers.set('Vary', vary ? vary + ', Accept' : 'Accept');
  return response;
}
