export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const siteKey = process.env.TURNSTILE_SITE_KEY;
  if (!siteKey) return Response.json({ error: "Contact verification is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return Response.json({ siteKey }, { headers: { "Cache-Control": "no-store" } });
}
