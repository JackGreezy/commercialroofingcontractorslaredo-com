const HOSTNAMES = new Set(["commercialroofingcontractorslaredo.com","www.commercialroofingcontractorslaredo.com"]);

export async function verifyContactTurnstile(token, remoteIp) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: false, unavailable: true };
  if (typeof token !== "string" || !token.trim() || token.length > 2048) return { ok: false };
  const form = new URLSearchParams({ secret, response: token.trim() });
  if (remoteIp && remoteIp !== "unknown") form.set("remoteip", remoteIp);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", body: form, cache: "no-store", signal: AbortSignal.timeout(7000)
    });
    if (!response.ok) return { ok: false, unavailable: true };
    const result = await response.json();
    return { ok: result.success === true && HOSTNAMES.has(result.hostname) && result.action === "contact" };
  } catch { return { ok: false, unavailable: true }; }
}
