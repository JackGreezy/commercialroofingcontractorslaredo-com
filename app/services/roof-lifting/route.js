import fs from 'node:fs/promises';
import path from 'node:path';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET() {
  const html = await fs.readFile(path.join(process.cwd(), 'data', 'roof-lifting-page.html'), 'utf8');
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=3600' } });
}
