import { NextResponse } from 'next/server';
import { aiRoute, aiDiscovery } from './lib/ai/routing.mjs';
export function proxy(request) {
  return aiRoute(request) || aiDiscovery(NextResponse.next(), request);
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
