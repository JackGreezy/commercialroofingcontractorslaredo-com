import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const publicDir = path.join(process.cwd(), "public");
const analytics = '<script defer src="/_vercel/insights/script.js"></script>';

function cleanParts(params = {}) {
  const parts = Array.isArray(params.path) ? params.path : [];
  return parts
    .map((part) => String(part).replace(/[^a-zA-Z0-9._-]/g, ""))
    .filter(Boolean);
}

function candidates(parts) {
  if (!parts.length) return [path.join(publicDir, "index.html")];
  const route = parts.join("/");
  return [path.join(publicDir, `${route}.html`), path.join(publicDir, route, "index.html")];
}

async function readFirst(files) {
  for (const file of files) {
    if (!file.startsWith(publicDir + path.sep)) continue;
    try {
      return await fs.readFile(file, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return null;
}

function decorate(html, request) {
  if (!html) return html;
  let output = html.includes("/_vercel/insights/script.js")
    ? html
    : html.replace(/<\/head>/i, `${analytics}\n</head>`);
  const url = new URL(request.url);
  if (url.searchParams.get("submitted") === "1" && /<\/form>/i.test(output)) {
    const notice = '<p role="status" style="margin-top:20px;font-weight:700">Thank you. Your commercial roofing request has been received.</p>';
    output = output.replace(/<\/form>/i, `</form>${notice}`);
  }
  return output;
}

async function htmlResponse(parts, request, status = 200) {
  const html = await readFirst(candidates(parts));
  if (!html) return null;
  return new Response(decorate(html, request), {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400"
    }
  });
}

export async function GET(request, context) {
  const parts = cleanParts(await context.params);
  const page = await htmlResponse(parts, request);
  if (page) return page;
  return (await htmlResponse(["404"], request, 404)) || new Response("Not found", { status: 404 });
}

