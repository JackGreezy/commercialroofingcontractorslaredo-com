#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
from urllib.parse import quote
import json, re, html, hashlib, sys
try:
    from bs4 import BeautifulSoup, NavigableString
except Exception as exc:
    raise SystemExit(f"BeautifulSoup unavailable: {exc}")

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]).resolve()
PUBLIC = ROOT / "public"
SKIP_PARTS = {".git", "node_modules", ".next", "qa-out", "assets-f"}
TAX_KEYS = ["services", "roof-systems", "industries", "project-types", "locations", "manufacturers"]
TAX_LABELS = {
    "services": "Commercial Roofing Services",
    "roof-systems": "Roof Systems",
    "industries": "Industries We Serve",
    "project-types": "Commercial Project Types",
    "locations": "Service Areas",
    "manufacturers": "Roofing Manufacturers",
}
TAX_TITLE_SUFFIX = {
    "services": "Services",
    "roof-systems": "Roof Systems",
    "industries": "Industry Roofing",
    "project-types": "Project Roofing",
    "locations": "Service Area",
    "manufacturers": "Roof Systems",
}
DATE_POOL = [
    "January 7, 2026", "January 19, 2026", "February 3, 2026", "February 18, 2026", "March 4, 2026",
    "March 21, 2026", "April 6, 2026", "April 22, 2026", "May 8, 2026", "May 24, 2026",
    "June 5, 2026", "June 18, 2026", "July 2, 2026", "July 9, 2026", "July 15, 2026",
]
VOICE_REPLACEMENTS = [
    (re.compile(r"\bbuilt around\b", re.I), ["planned for", "set up for", "designed for", "matched to", "built to serve"]),
    (re.compile(r"\banchored by\b", re.I), ["supported by", "guided by", "backed by", "centered on", "driven by"]),
    (re.compile(r"\bis organized around\b", re.I), ["follows", "is planned for", "is structured for", "is mapped to", "is set up for"]),
    (re.compile(r"\borganized around\b", re.I), ["planned for", "structured for", "mapped to", "set up for", "sequenced for"]),
    (re.compile(r"\bshaped around\b", re.I), ["matched to", "designed for", "planned for", "calibrated to", "built for"]),
    (re.compile(r"\btell us what the roof is doing\b", re.I), ["describe the roof condition", "send the roof details", "share what changed on the roof", "explain the roof issue", "outline the roof concern"]),
    (re.compile(r"\bwhat the roof is doing\b", re.I), ["the roof condition", "the roof issue", "what changed on the roof", "the roof concern", "the roof status"]),
]

PALETTES = {
    "harbor_steel": {"name": "Harbor Steel", "primary": "#12324a", "secondary": "#1f5b73", "accent": "#d08a2e", "accent2": "#7ea7b8", "surface": "#eef4f6", "ink": "#142331", "button": "#ffffff"},
    "copper_slate": {"name": "Copper Slate", "primary": "#1d2d35", "secondary": "#35515b", "accent": "#c46f34", "accent2": "#9db0a5", "surface": "#f3f0eb", "ink": "#1b2428", "button": "#ffffff"},
    "evergreen_gold": {"name": "Evergreen Gold", "primary": "#12392f", "secondary": "#286353", "accent": "#d6a13a", "accent2": "#a9c1a6", "surface": "#eff5ef", "ink": "#142821", "button": "#101820"},
    "blue_collar_navy": {"name": "Blue Collar Navy", "primary": "#0f2b46", "secondary": "#1e4b6d", "accent": "#e06024", "accent2": "#86a9bd", "surface": "#eef3f7", "ink": "#102132", "button": "#ffffff"},
    "desert_copper": {"name": "Desert Copper", "primary": "#3a2b25", "secondary": "#7b4a2d", "accent": "#d9923b", "accent2": "#c8b294", "surface": "#f5efe6", "ink": "#241d1a", "button": "#ffffff"},
    "mesa_teal": {"name": "Mesa Teal", "primary": "#173f43", "secondary": "#236b6f", "accent": "#d9853b", "accent2": "#95c5bd", "surface": "#edf6f4", "ink": "#14292b", "button": "#ffffff"},
    "gulf_blue": {"name": "Gulf Blue", "primary": "#123650", "secondary": "#1c6a7d", "accent": "#e0a33a", "accent2": "#98d1d1", "surface": "#eef7f7", "ink": "#10242e", "button": "#101820"},
    "lowcountry_olive": {"name": "Lowcountry Olive", "primary": "#263b2f", "secondary": "#526b45", "accent": "#c6843a", "accent2": "#b8c3a4", "surface": "#f0f4ec", "ink": "#1f281f", "button": "#ffffff"},
    "brick_black": {"name": "Brick and Black", "primary": "#171f25", "secondary": "#39424a", "accent": "#b94b32", "accent2": "#a5adb2", "surface": "#f2f2ef", "ink": "#171b1f", "button": "#ffffff"},
    "granite_blue": {"name": "Granite Blue", "primary": "#1b3443", "secondary": "#4f6f7f", "accent": "#c7a34f", "accent2": "#b7c3c8", "surface": "#f1f4f5", "ink": "#17242c", "button": "#101820"},
    "prairie_green": {"name": "Prairie Green", "primary": "#213b32", "secondary": "#59705a", "accent": "#d09a3c", "accent2": "#c3cab2", "surface": "#f3f5ee", "ink": "#1c241e", "button": "#101820"},
    "industrial_maroon": {"name": "Industrial Maroon", "primary": "#331f29", "secondary": "#653642", "accent": "#d48a3a", "accent2": "#b79a9d", "surface": "#f5eeee", "ink": "#261b20", "button": "#ffffff"},
    "lake_iron": {"name": "Lake Iron", "primary": "#172f3a", "secondary": "#496873", "accent": "#c56f3d", "accent2": "#9fb6bd", "surface": "#edf3f5", "ink": "#14242a", "button": "#ffffff"},
    "ridge_blue": {"name": "Ridge Blue", "primary": "#18324f", "secondary": "#3f5f7f", "accent": "#ca8d37", "accent2": "#aab7c6", "surface": "#f0f3f8", "ink": "#142238", "button": "#ffffff"},
    "coal_gold": {"name": "Coal Gold", "primary": "#20262a", "secondary": "#4b545a", "accent": "#d6a23d", "accent2": "#bfc3b0", "surface": "#f3f2ea", "ink": "#191d20", "button": "#101820"},
    "sage_copper": {"name": "Sage Copper", "primary": "#263c36", "secondary": "#607168", "accent": "#bd6d3c", "accent2": "#b7c5ba", "surface": "#f1f5f1", "ink": "#1c2824", "button": "#ffffff"},
    "steel_red": {"name": "Steel Red", "primary": "#1c3038", "secondary": "#53656b", "accent": "#be3f32", "accent2": "#b7c4c6", "surface": "#eef3f4", "ink": "#182328", "button": "#ffffff"},
    "atlantic_green": {"name": "Atlantic Green", "primary": "#173a3a", "secondary": "#2e6d68", "accent": "#c79235", "accent2": "#9fc7bd", "surface": "#edf6f3", "ink": "#132727", "button": "#101820"},
}

REGIONAL_PALETTE_KEYS = {
    "TX": ["desert_copper", "mesa_teal", "blue_collar_navy", "brick_black", "coal_gold"],
    "NM": ["mesa_teal", "desert_copper", "sage_copper", "ridge_blue"],
    "AZ": ["desert_copper", "mesa_teal", "coal_gold"],
    "UT": ["ridge_blue", "desert_copper", "sage_copper"],
    "CO": ["ridge_blue", "granite_blue", "evergreen_gold", "copper_slate"],
    "CA": ["harbor_steel", "mesa_teal", "granite_blue", "steel_red"],
    "OR": ["evergreen_gold", "harbor_steel", "sage_copper", "lake_iron"],
    "WA": ["harbor_steel", "evergreen_gold", "lake_iron"],
    "WI": ["lake_iron", "evergreen_gold", "granite_blue"],
    "MI": ["lake_iron", "blue_collar_navy", "steel_red"],
    "NY": ["granite_blue", "blue_collar_navy", "brick_black", "atlantic_green"],
    "PA": ["brick_black", "coal_gold", "granite_blue", "industrial_maroon"],
    "OH": ["steel_red", "coal_gold", "brick_black", "lake_iron"],
    "IN": ["prairie_green", "steel_red", "coal_gold"],
    "NE": ["prairie_green", "coal_gold", "ridge_blue"],
    "AR": ["lowcountry_olive", "brick_black", "copper_slate"],
    "LA": ["gulf_blue", "lowcountry_olive", "industrial_maroon"],
    "MS": ["gulf_blue", "lowcountry_olive", "coal_gold"],
    "GA": ["lowcountry_olive", "brick_black", "atlantic_green"],
    "SC": ["lowcountry_olive", "gulf_blue", "atlantic_green"],
    "NC": ["atlantic_green", "ridge_blue", "lowcountry_olive"],
    "VA": ["ridge_blue", "brick_black", "atlantic_green"],
    "MA": ["harbor_steel", "granite_blue", "brick_black"],
}


def clean(value: object) -> str:
    return str(value or "").strip()

def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(errors="ignore"))
    except Exception:
        return {}

cfg = load_json(ROOT / "home.config.json")
content = load_json(ROOT / "data" / "content.normalized.json")
biz_data = content.get("biz") if isinstance(content.get("biz"), dict) else {}
BIZ = {
    "name": clean(cfg.get("businessName") or cfg.get("biz") or biz_data.get("name") or ROOT.name.replace("-com", ".com")),
    "domain": clean(cfg.get("domain") or biz_data.get("domain") or ROOT.name.replace("-com", ".com")),
    "city": clean(cfg.get("city") or biz_data.get("city")),
    "state": clean(cfg.get("state") or biz_data.get("state")),
    "region": clean(cfg.get("region") or biz_data.get("region")),
    "phone": clean(cfg.get("phone") or biz_data.get("phone")),
    "email": clean(cfg.get("email") or biz_data.get("email")),
    "address": clean(cfg.get("address") or biz_data.get("address")),
    "hero_image": clean(cfg.get("hero_image")),
}
if not BIZ["domain"]:
    BIZ["domain"] = ROOT.name.replace("-com", ".com")
SITE = "https://" + BIZ["domain"].rstrip("/")
TAX = content.get("taxonomies") if isinstance(content.get("taxonomies"), dict) else {}

route_item = {}
for tax_key, tax in TAX.items():
    route = clean(tax.get("route")) or f"/{tax_key}"
    route_item[route] = {"type": "index", "tax": tax_key, "name": clean(tax.get("title") or TAX_LABELS.get(tax_key, tax_key.replace("-", " ").title())), "meta": ""}
    for item in tax.get("items", []) or []:
        slug = clean(item.get("slug"))
        if slug:
            route_item[f"{route.rstrip('/')}/{slug}"] = {"type": "slug", "tax": tax_key, "name": clean(item.get("name") or slug.replace("-", " ").title()), "meta": clean(item.get("meta"))}


def route_for_file(path: Path) -> str:
    rel = path.relative_to(PUBLIC)
    parts = list(rel.parts)
    if path.name.endswith(".ref"):
        return ""
    if parts and parts[0] == "__static-pages":
        stem = Path(parts[-1]).stem
        if stem in ("index", "home", "root"):
            return "/"
        return "/" + stem.replace("__", "/")
    if path.name in ("home.html", "index.html") and len(parts) == 1:
        return "/"
    if path.name == "404.html":
        return "/404"
    if path.name == "sitemap.xml":
        return "/sitemap.xml"
    if path.suffix.lower() == ".html":
        if path.name == "index.html":
            route = "/" + "/".join(parts[:-1])
        else:
            route = "/" + "/".join(parts[:-1] + [path.stem])
        return re.sub(r"//+", "/", route).rstrip("/") or "/"
    return ""

def canonical_for_route(route: str) -> str:
    if route in ("", "/home", "/index"):
        route = "/"
    if route == "/":
        return SITE + "/"
    return SITE + route.rstrip("/")

def strip_tags(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", clean(s))).strip()

def meta_for(route: str, soup: BeautifulSoup | None = None) -> tuple[str, str]:
    city = BIZ["city"] or "your market"
    region = BIZ["region"] or f"{city} commercial properties"
    name = BIZ["name"]
    if route == "/":
        return f"Commercial Roofing in {city} | {name}", f"{name} provides commercial roof repair, replacement, maintenance, coatings, inspections, and roof-system planning across {region}."
    if route == "/about":
        return f"About {name} | Commercial Roofing in {city}", f"Learn how {name} plans commercial roof inspections, repairs, maintenance, replacements, and coating scopes for facilities across {region}."
    if route == "/contact":
        return f"Contact {name} | Commercial Roof Assessment", f"Contact {name} for commercial roof leak repair, inspection, maintenance, replacement, coating, and budgeting help across {region}."
    if route == "/privacy":
        return f"Privacy Policy | {name}", f"Privacy policy for {name}, including how commercial roofing inquiry information is used to respond to roof assessment requests."
    if route == "/terms":
        return f"Terms of Use | {name}", f"Terms of use for {name}, including website information, roofing inquiry handling, and responsible use of the site."
    if route == "/404":
        return f"Page Not Found | {name}", f"The requested page could not be found on {BIZ['domain']}. Use the main navigation to reach roofing services, systems, service areas, or contact."
    info = route_item.get(route.rstrip("/"))
    if info:
        if info["type"] == "index":
            label = info["name"]
            return f"{label} | {name}", f"Explore {label.lower()} from {name} for commercial roofing facilities across {region}."
        desc = info.get("meta") or f"{info['name']} from {name} for commercial roofing properties across {region}."
        suffix = TAX_TITLE_SUFFIX.get(info.get("tax", ""), "Commercial Roofing")
        return f"{info['name']} {suffix} in {city} | {name}", desc[:155].rstrip(" ,.;")
    h1 = strip_tags(str(soup.find("h1"))) if soup and soup.find("h1") else ""
    label = h1 or route.strip("/").replace("-", " ").title()
    return f"{label} | {name}", f"{name} provides commercial roofing guidance for {label.lower()} across {region}."

def pick_og_image(route: str, soup: BeautifulSoup | None = None) -> str:
    candidates = []
    if BIZ["hero_image"]:
        candidates.append(BIZ["hero_image"])
    if soup:
        for img in soup.find_all("img"):
            src = clean(img.get("src") or img.get("data-src") or img.get("srcset", "").split(" ")[0])
            if src and not src.startswith("data:") and not src.endswith(".svg"):
                candidates.append(src)
    for glob in ["ours/locations/*.webp", "ours/**/*.webp", "images/**/*.*"]:
        for p in PUBLIC.glob(glob):
            if p.is_file() and p.suffix.lower() in {".webp", ".jpg", ".jpeg", ".png"}:
                candidates.append("/" + str(p.relative_to(PUBLIC)).replace("\\", "/"))
                break
    src = candidates[0] if candidates else "/favicon.ico"
    if src.startswith("http"):
        return src
    return SITE + "/" + src.lstrip("/")

def ensure_head(soup: BeautifulSoup) -> BeautifulSoup:
    if not soup.find("html"):
        wrapper = BeautifulSoup("<!doctype html><html lang='en'><head></head><body></body></html>", "html.parser")
        wrapper.body.append(soup)
        soup = wrapper
    html_tag = soup.find("html")
    if html_tag and not html_tag.get("lang"):
        html_tag["lang"] = "en-US"
    if not soup.head:
        head = soup.new_tag("head")
        if soup.html:
            soup.html.insert(0, head)
        else:
            soup.insert(0, head)
    if not soup.body:
        body = soup.new_tag("body")
        soup.append(body)
    return soup

def upsert_meta(soup: BeautifulSoup, attr: str, key: str, content: str):
    for tag in soup.head.find_all("meta"):
        if tag.get(attr) == key:
            tag.decompose()
    tag = soup.new_tag("meta")
    tag[attr] = key
    tag["content"] = content
    soup.head.append(tag)

def set_metadata(soup: BeautifulSoup, route: str):
    soup = ensure_head(soup)
    title, desc = meta_for(route, soup)
    desc = re.sub(r"\s+", " ", desc).strip()[:158].rstrip(" ,.;")
    if soup.title:
        soup.title.string = title
    else:
        t = soup.new_tag("title"); t.string = title; soup.head.append(t)
    for tag in list(soup.head.find_all("meta")):
        if tag.get("name") in {"description", "robots", "twitter:card", "twitter:title", "twitter:description", "twitter:image", "twitter:image:alt"}:
            tag.decompose()
            continue
        prop = tag.get("property")
        if prop and (str(prop).startswith("og:") or prop in {"article:modified_time"}):
            tag.decompose()
    upsert_meta(soup, "name", "description", desc)
    robots = "noindex, follow" if route == "/404" else "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
    upsert_meta(soup, "name", "robots", robots)
    for link in soup.head.find_all("link"):
        rel = link.get("rel") or []
        rels = [r.lower() for r in (rel if isinstance(rel, list) else str(rel).split())]
        if "canonical" in rels:
            link.decompose()
    canonical = canonical_for_route(route)
    link = soup.new_tag("link", rel="canonical", href=canonical)
    soup.head.append(link)
    og_image = pick_og_image(route, soup)
    og_alt = f"Commercial roofing work in {BIZ['city']} by {BIZ['name']}".strip()
    ogs = {
        "og:locale": "en_US", "og:type": "website", "og:title": title, "og:description": desc,
        "og:url": canonical, "og:site_name": BIZ["name"], "og:image": og_image, "og:image:secure_url": og_image,
        "og:image:alt": og_alt,
    }
    for k, v in ogs.items():
        tag = soup.new_tag("meta"); tag["property"] = k; tag["content"] = v; soup.head.append(tag)
    tw = {"twitter:card": "summary_large_image", "twitter:title": title, "twitter:description": desc, "twitter:image": og_image, "twitter:image:alt": og_alt}
    for k, v in tw.items():
        tag = soup.new_tag("meta"); tag["name"] = k; tag["content"] = v; soup.head.append(tag)
    for old in soup.find_all("script", attrs={"data-rh-localbusiness": True}):
        old.decompose()
    lb = {
        "@context": "https://schema.org", "@type": "RoofingContractor", "name": BIZ["name"],
        "url": SITE + "/", "telephone": BIZ["phone"], "email": BIZ["email"], "image": og_image,
        "areaServed": BIZ["region"] or BIZ["city"], "address": {"@type": "PostalAddress", "streetAddress": BIZ["address"]},
    }
    script = soup.new_tag("script", type="application/ld+json")
    script["data-rh-localbusiness"] = "true"
    script.string = json.dumps(lb, ensure_ascii=False)
    soup.head.append(script)

def map_embed(address: str) -> str:
    src = "https://www.google.com/maps?q=" + quote(address) + "&output=embed"
    return f'<div data-rh-map="true"><iframe title="Map for {html.escape(BIZ["name"])}" src="{src}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>'

def replace_visible_address(soup: BeautifulSoup):
    address = BIZ["address"]
    if not address or not soup.body:
        return
    embed = map_embed(address)
    exact = address
    street = address.split(",")[0].strip()
    zip_match = re.search(r"\b\d{5}(?:-\d{4})?\b", address)
    postal = zip_match.group(0) if zip_match else ""
    found_exact_address = False
    # Replace exact address text in visible body text nodes only.
    for node in list(soup.body.find_all(string=True)):
        parent = node.parent
        if parent and parent.name in {"script", "style", "noscript", "template", "iframe"}:
            continue
        txt = str(node)
        if exact in txt:
            found_exact_address = True
            parts = txt.split(exact)
            frag = BeautifulSoup("", "html.parser")
            for i, part in enumerate(parts):
                if part:
                    frag.append(NavigableString(part))
                if i < len(parts) - 1:
                    frag.append(BeautifulSoup(embed, "html.parser"))
            node.replace_with(frag)
    # Replace split address blocks such as:
    # 123 Main St, Suite 100<br>City, ST 12345
    split_candidates = sorted(
        list(soup.body.find_all(["p", "address", "li", "span", "div"])),
        key=lambda t: len(t.get_text(" ", strip=True)),
    )
    for tag in split_candidates:
        if tag.find_parent(["script", "style", "noscript", "template", "iframe"]):
            continue
        if tag.find("form"):
            continue
        if tag.select_one("[data-rh-map]"):
            continue
        text = tag.get_text(" ", strip=True)
        if len(text) > 520:
            continue
        has_street = bool(street and street in text)
        has_place = bool((BIZ["city"] and BIZ["city"] in text) or (BIZ["state"] and re.search(rf"\b{re.escape(BIZ['state'])}\b", text)) or (postal and postal in text))
        if has_street and has_place:
            tag.clear()
            tag.append(BeautifulSoup(embed, "html.parser"))
            found_exact_address = True
    # Only add an embed when a visible physical address was actually present.
    if found_exact_address and not soup.body.select_one("[data-rh-map]"):
        target = soup.find("footer") if soup.find("footer") else soup.body
        target.append(BeautifulSoup(embed, "html.parser"))

def replace_banned_phrases(soup: BeautifulSoup, salt: int):
    for node in list(soup.find_all(string=True)):
        if node.parent and node.parent.name in {"script", "style", "title", "meta", "link", "noscript", "template"}:
            continue
        text = str(node)
        new = text
        for idx, (pat, reps) in enumerate(VOICE_REPLACEMENTS):
            repl = reps[(salt + idx) % len(reps)]
            new = pat.sub(repl, new)
        if new != text:
            node.replace_with(NavigableString(new))

def ensure_footer_links(soup: BeautifulSoup):
    footer = soup.find("footer")
    if not footer or footer.find("a", href="/sitemap.xml"):
        return
    nav = footer.find("nav") or footer
    sep = NavigableString(" ")
    nav.append(sep)
    a = soup.new_tag("a", href="/sitemap.xml")
    a.string = "Sitemap"
    nav.append(a)

def selected_palette() -> dict:
    state = clean(BIZ.get("state")).upper()
    pool = REGIONAL_PALETTE_KEYS.get(state) or list(PALETTES.keys())
    digest = int(hashlib.sha1(BIZ["domain"].encode()).hexdigest(), 16)
    return PALETTES[pool[digest % len(pool)]]

def ensure_color_scheme_assets(soup: BeautifulSoup):
    soup = ensure_head(soup)
    palette = selected_palette()
    for tag in list(soup.head.find_all("meta", attrs={"name": "theme-color"})):
        tag.decompose()
    theme = soup.new_tag("meta")
    theme["name"] = "theme-color"
    theme["content"] = palette["primary"]
    soup.head.append(theme)
    for old in list(soup.head.find_all("style", id="rh-color-scheme-css")):
        old.decompose()
    style = soup.new_tag("style", id="rh-color-scheme-css")
    style["data-rh-scheme"] = palette["name"]
    style.string = f"""
/* RankHound color scheme: {palette['name']} */
:root{{--rh-primary:{palette['primary']};--rh-secondary:{palette['secondary']};--rh-accent:{palette['accent']};--rh-accent-2:{palette['accent2']};--rh-surface:{palette['surface']};--rh-ink:{palette['ink']};--rh-button-text:{palette['button']};--darkBlue:var(--rh-primary)!important;--colorBlue:var(--rh-secondary)!important;--colorGreen:var(--rh-accent-2)!important;--orange:var(--rh-accent)!important;--W-Resolute-Blue:var(--rh-primary)!important;--colorText:var(--rh-ink)!important;--wp--preset--color--vivid-cyan-blue:var(--rh-secondary)!important;--wp--preset--color--luminous-vivid-amber:var(--rh-accent)!important;}}
html body{{accent-color:var(--rh-accent);color:var(--rh-ink);}}
html body a:not(.rr-wordmark):not([href^="tel:"]):not([href^="mailto:"]){{color:var(--rh-secondary);}}
html body header,html body #header,html body [id="header"],html body .site-header,html body .main-header,html body .elementor-location-header,html body [class*="Header_header"],html body [class*="site-header"]{{background:linear-gradient(135deg,var(--rh-primary),var(--rh-secondary))!important;color:#fff!important;}}
html body header a,html body #header a,html body .site-header a,html body .main-header a,html body .elementor-location-header a,html body [class*="Header_header"] a{{color:#fff!important;}}
html body footer,html body #footer,html body .site-footer,html body .elementor-location-footer,html body [class*="Footer"],html body [class*="footer"]{{background:linear-gradient(135deg,var(--rh-primary),#101820)!important;color:#fff!important;}}
html body footer a,html body #footer a,html body .site-footer a,html body .elementor-location-footer a,html body [class*="Footer"] a,html body [class*="footer"] a{{color:#fff!important;}}
html body .rr-wordmark .rr-wm-1,html body .rr-wordmark .rr-wm-2{{color:inherit!important;}}
html body a[class*="btn"],html body a[class*="button"],html body button:not(.slick-arrow):not([aria-label*="Close"]),html body input[type="submit"],html body .btn,html body .button,html body .wp-block-button__link,html body .elementor-button,html body [class*="Button"],html body [class*="button"]{{background:var(--rh-accent)!important;border-color:var(--rh-accent)!important;color:var(--rh-button-text)!important;box-shadow:none;}}
html body a[href="/contact"],html body a[href*="/contact"],html body a[href="#contact"]{{border-color:var(--rh-accent)!important;}}
html body h1,html body h2,html body h3{{text-decoration-color:var(--rh-accent)!important;}}
html body [class*="cta"],html body [class*="CTA"],html body [class*="callout"],html body [class*="Callout"],html body .featured-proj-heading,html body .featured-proj-content{{background-color:var(--rh-primary)!important;color:#fff!important;}}
html body [class*="cta"] a,html body [class*="CTA"] a,html body [class*="callout"] a,html body [class*="Callout"] a{{color:#fff!important;}}
html body .card,html body [class*="Card"],html body [class*="card"],html body article{{border-color:rgba(0,0,0,.12);}}
html body .card:hover,html body [class*="Card"]:hover,html body [class*="card"]:hover{{border-color:var(--rh-accent)!important;}}
html body ::selection{{background:var(--rh-accent);color:var(--rh-button-text);}}
html body .rh-seo-dropdown-menu{{border-top:4px solid var(--rh-accent)!important;}}
html body .rh-seo-dropdown-menu a:hover,html body .rh-seo-dropdown-menu a:focus{{background:var(--rh-surface)!important;color:var(--rh-primary)!important;}}
@media(max-width:900px){{html body header,html body #header,html body .site-header{{background:var(--rh-primary)!important;}}}}
"""
    soup.head.append(style)

def ensure_mobile_dropdown_assets(soup: BeautifulSoup):
    soup = ensure_head(soup)
    if soup.head.find("style", id="rh-seo-finalizer-css"):
        return
    style = soup.new_tag("style", id="rh-seo-finalizer-css")
    style.string = """
[data-rh-map]{width:min(680px,100%);margin:16px 0;overflow:hidden;border:0}[data-rh-map] iframe{display:block;width:100%;height:240px;border:0}img,video,iframe{max-width:100%}footer a[href='/sitemap.xml']{white-space:nowrap}.rh-seo-dropdown-menu{position:absolute;z-index:9999;display:none;min-width:240px;max-width:min(92vw,360px);padding:12px;margin-top:8px;background:#fff;color:#111;box-shadow:0 18px 45px rgba(0,0,0,.18);border:1px solid rgba(0,0,0,.12)}.rh-seo-dropdown-menu::before{content:"";position:absolute;left:0;right:0;top:-14px;height:14px}.rh-seo-dropdown-menu a{display:block!important;padding:9px 10px!important;color:inherit!important;text-decoration:none!important;line-height:1.25!important;white-space:normal!important}.rh-seo-dropdown-menu a:hover,.rh-seo-dropdown-menu a:focus{background:rgba(0,0,0,.06)}header [data-rh-dropdown-host]{position:relative!important}header [data-rh-dropdown-host].rh-open>.rh-seo-dropdown-menu,header [data-rh-dropdown-host]:hover>.rh-seo-dropdown-menu,header [data-rh-dropdown-host]:focus-within>.rh-seo-dropdown-menu{display:block}@media(max-width:900px){.rh-seo-dropdown-menu{display:none!important}[data-rh-map] iframe{height:210px}body{overflow-x:hidden}footer nav,footer ul{max-width:100%;flex-wrap:wrap}}
"""
    soup.head.append(style)
    if soup.find("script", id="rh-seo-dropdowns"):
        return
    dropdown_data = {}
    for tax_key in TAX_KEYS:
        tax = TAX.get(tax_key) or {}
        route = clean(tax.get("route")) or f"/{tax_key}"
        items = []
        for item in (tax.get("items") or [])[:6]:
            slug = clean(item.get("slug"))
            label = strip_tags(clean(item.get("name") or slug.replace("-", " ").title()))
            if slug and label:
                items.append({"label": label[:72], "href": f"{route.rstrip('/')}/{slug}"})
        if items:
            dropdown_data[route] = items
    js = soup.new_tag("script", id="rh-seo-dropdowns")
    js.string = """
(function(){
  const data = __DATA__;
  function ready(fn){ if(document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function(){
    const header = document.querySelector('header'); if(!header) return;
    Object.keys(data).forEach(function(route){
      header.querySelectorAll('a[href="'+route+'"],a[href="'+route.replace(/^\//,'')+'"]').forEach(function(anchor){
        if(anchor.dataset.rhDropdownReady) return;
        const host = anchor.parentElement || anchor;
        host.dataset.rhDropdownHost = 'true';
        const menu = document.createElement('div'); menu.className = 'rh-seo-dropdown-menu'; menu.setAttribute('role','menu');
        data[route].forEach(function(item){ const a=document.createElement('a'); a.href=item.href; a.textContent=item.label; a.setAttribute('role','menuitem'); menu.appendChild(a); });
        anchor.insertAdjacentElement('afterend', menu);
        anchor.dataset.rhDropdownReady = 'true';
        let timer;
        function open(){ clearTimeout(timer); host.classList.add('rh-open'); }
        function close(){ timer=setTimeout(function(){ host.classList.remove('rh-open'); }, 220); }
        host.addEventListener('mouseenter', open); host.addEventListener('mouseleave', close);
        host.addEventListener('focusin', open); host.addEventListener('focusout', close);
      });
    });
  });
})();
""".replace("__DATA__", json.dumps(dropdown_data, ensure_ascii=False))
    (soup.body or soup).append(js)

def html_paths() -> list[Path]:
    paths = []
    for base in [PUBLIC, ROOT / "data", ROOT / "rendered"]:
        if not base.exists():
            continue
        for p in base.rglob("*.html"):
            if any(part in SKIP_PARTS for part in p.parts):
                continue
            if p.name.endswith(".ref"):
                continue
            paths.append(p)
    return paths

def legal_variant(kind: str) -> int:
    return int(hashlib.sha1((BIZ["domain"] + ":" + kind).encode()).hexdigest(), 16) % 8

def legal_section(kind: str, date: str) -> str:
    title = "Privacy Policy" if kind == "privacy" else "Terms of Use"
    name = BIZ["name"]
    city = BIZ["city"]
    region = BIZ["region"] or city
    email = BIZ["email"] or "the site team"
    phone = BIZ["phone"]
    domain = BIZ["domain"]
    v = legal_variant(kind)
    if kind == "privacy":
        openers = [
            f"This policy explains how {name} handles inquiry details submitted through {domain}. The site is for commercial roofing conversations in {region}, and the information collected here is used to respond to those requests.",
            f"{name} uses {domain} to collect and route roofing questions from building owners, managers, and project teams in {region}. This page describes the limited information the site receives and how it is used.",
            f"This privacy notice applies to contact and estimate requests sent through {domain}. {name} keeps the process simple: collect enough detail to understand the roof issue, then respond through the contact information provided.",
            f"Visitors use {domain} to ask {name} about commercial roof repair, replacement, maintenance, inspections, coatings, and related planning in {region}. This policy covers how those website inquiries are handled.",
            f"{name} receives website inquiries from people evaluating commercial roofing needs in {city} and nearby markets. This page summarizes what information may be submitted and how it supports a practical response.",
            f"This page explains the basic privacy practices for {domain}. The website helps {name} receive roofing questions, review request details, and follow up with the person or company that asked for help.",
            f"When someone contacts {name} through {domain}, the site may collect a small amount of business contact information and project context. This notice explains how that information is handled.",
            f"{domain} is used to receive commercial roofing inquiries for {name}. The privacy practices below are intentionally straightforward and focused on request handling, communication, and site operation.",
        ]
        use_heads = ["What may be collected", "How the information is used", "When information is shared", "Your choices", "Site safeguards"]
        collect = [
            "Forms may ask for a name, company, phone number, email address, service interest, property or roof context, timeline, and message details. The site may also receive basic technical records such as the page submitted, time of submission, browser data, and spam-screening signals.",
            "Information may include contact details, company or facility context, selected service needs, the message entered in a form, and standard technical data used to keep the form working properly.",
            "The site may collect the details a visitor chooses to provide in a form, plus routine request data used for delivery, security, and troubleshooting.",
            "A submission can include business contact information, roof concern notes, scheduling context, and technical request information needed to operate the website safely.",
            "Contact forms may collect identifying details, preferred reply information, property notes, roofing-service interests, and basic website security data.",
            "The site may receive contact information, project notes, roof condition descriptions, service selections, and ordinary server or form-protection data.",
            "Submitted information can include a name, organization, phone, email, location context, message text, and technical details connected to the request.",
            "The website collects only the information provided in forms and the routine technical data needed to deliver, secure, and review those submissions.",
        ][v]
        use = [
            f"{name} uses inquiry details to reply, understand the requested roofing service, prepare for a roof assessment conversation, route the message, reduce duplicate follow-up, and maintain ordinary business records.",
            f"The information is used to answer the request, coordinate a roofing conversation, identify the relevant service category, and keep a record of website communication with {name}.",
            f"{name} uses submitted details to contact the requester, evaluate the general nature of the roofing need, schedule or discuss next steps, and improve the reliability of the website forms.",
            f"Inquiry details help {name} respond to the right person, understand whether the request concerns repair, replacement, maintenance, coatings, or planning, and keep communication organized.",
            f"The information supports follow-up, routing, project intake, spam prevention, and ordinary administration for {name}.",
            f"{name} uses the information to respond to roofing questions, confirm contact details, understand the property context, and maintain a practical record of the request.",
            f"Submitted information is used for reply, request review, communication tracking, form security, and service coordination by {name}.",
            f"The details are used to answer the inquiry, connect it with the right roofing topic, support scheduling or estimating conversations, and operate {domain} reliably.",
        ][v]
        share = [
            "Information may be shared with service providers that support website hosting, form delivery, email, analytics, security, spam prevention, or customer follow-up. Those providers are used to operate the site and process requests.",
            "Limited information may pass through hosting, email, security, analytics, or form-processing providers that help the website function. These services are used for practical operation and response handling.",
            "Website and form vendors may process information as needed to host pages, deliver messages, protect forms, measure site performance, or support follow-up.",
            "The site may rely on third-party tools for hosting, email delivery, maps, analytics, security, or spam screening. Those tools receive only what is needed for those functions.",
            "Information may be handled by technical providers that keep the website available, deliver form messages, screen spam, or support communication.",
            "Service providers may process inquiry data for hosting, message delivery, site security, analytics, and related website operations.",
            "The site may use technical vendors to receive, secure, and deliver contact requests. Information is not sold as a roofing lead list by this website.",
            "Operational providers may help process forms, host the site, protect against abuse, and deliver messages to the team responsible for follow-up.",
        ][v]
        choices = [
            f"To update a request or ask that contact information be removed from active follow-up, contact {email} or call {phone}.",
            f"A requester can ask about a submitted form, correct contact details, or request no further follow-up by contacting {email} or calling {phone}.",
            f"Questions about submitted information can be sent to {email}. If phone follow-up is preferred, call {phone}.",
            f"To change or remove information connected with an inquiry, contact {email} or call {phone}.",
            f"For privacy questions about a website inquiry, contact {email} or call {phone}.",
            f"Requests to review, correct, or stop active follow-up can be directed to {email} or {phone}.",
            f"Contact {email} or {phone} with questions about information submitted through the website.",
            f"For changes to a submitted inquiry or communication preference, use {email} or {phone}.",
        ][v]
        security = [
            "No website transmission can be guaranteed perfectly secure, but the site is maintained with reasonable safeguards, form validation, HTTPS hosting, and abuse-prevention measures.",
            "The site uses practical safeguards such as HTTPS, form validation, spam controls, and routine technical maintenance.",
            "Reasonable technical safeguards are used to protect form handling and reduce unauthorized or abusive submissions.",
            "Security measures include HTTPS delivery, form checks, spam controls, and ordinary hosting protections.",
            "The website is maintained with basic technical safeguards designed for secure form submission and reliable communication.",
            "Reasonable website controls are used to support secure submission, message delivery, and spam prevention.",
            "The site uses ordinary commercial safeguards for hosting, form delivery, and request screening.",
            "Form security, encrypted page delivery, and abuse prevention are used to support safe operation of the website.",
        ][v]
        return f"""<main><section><h1>{title}</h1><p><strong>Effective date:</strong> {date}</p><p>{openers[v]}</p><h2>{use_heads[0]}</h2><p>{collect}</p><h2>{use_heads[1]}</h2><p>{use}</p><h2>{use_heads[2]}</h2><p>{share}</p><h2>{use_heads[3]}</h2><p>{choices}</p><h2>{use_heads[4]}</h2><p>{security}</p></section></main>"""
    openers = [
        f"These terms apply to use of {domain}. The website is provided so visitors can review commercial roofing information and contact {name} about possible service needs in {region}.",
        f"By using {domain}, you agree to use the website for ordinary commercial roofing research and inquiry purposes. The site is operated for {name} and its local roofing intake process.",
        f"This page sets out basic terms for visiting {domain} and submitting roofing inquiries to {name}.",
        f"{domain} is intended to help building owners, managers, contractors, and facility teams contact {name} and review general commercial roofing information.",
        f"These terms govern general use of {domain}, including reading website information and sending contact requests to {name}.",
        f"Use of {domain} should be limited to lawful website browsing and legitimate commercial roofing inquiries for {name}.",
        f"The website for {name} is provided as a practical communication and information resource for commercial roofing topics in {region}.",
        f"These terms describe basic expectations for using {domain} and contacting {name} through the website.",
    ]
    info = [
        "Website information is general. A real roof scope, budget, schedule, product recommendation, or warranty position requires review of the property, roof condition, access, weather exposure, owner requirements, and project documents.",
        "Information on the site is not a final roof assessment, bid, schedule commitment, or warranty determination. Those items require direct review of the building and project conditions.",
        "The site provides general roofing information. Decisions about repairs, replacement, maintenance, coatings, or roof systems should be based on a project-specific review.",
        "Nothing on the website creates a final quote, inspection result, warranty decision, or construction schedule without direct confirmation from the roofing team.",
        "The website may describe services and roof systems in general terms, but every building needs its own review before a scope or price is reliable.",
        "Roofing recommendations, budgets, and schedules depend on actual site conditions and are not established by website text alone.",
        "The site is a starting point for information and contact. It is not a substitute for a roof walk, moisture review, access review, or written project scope.",
        "Any service description on the website should be treated as general information until the building and roof conditions are reviewed directly.",
    ][v]
    use = [
        "Do not submit false information, interfere with site operation, attempt to bypass form protections, or use the website in a way that disrupts service for other visitors.",
        "Visitors should not misuse forms, send misleading requests, attempt unauthorized access, or disrupt normal website operation.",
        "Use the site responsibly. Do not attack, overload, misrepresent, or interfere with the website or its contact forms.",
        "Do not use the website for spam, false submissions, security testing without permission, or activity that interferes with normal operation.",
        "Website forms should be used for genuine inquiries only. Automated abuse, misleading submissions, and attempts to disrupt the site are not allowed.",
        "Visitors may browse the site and submit legitimate inquiries. Misuse, interference, and false submissions are prohibited.",
        "Do not use the site to send spam, impersonate another person, disrupt the forms, or interfere with hosting and security controls.",
        "Responsible use means accurate inquiry details, ordinary browsing, and no attempts to damage, overload, or bypass the site.",
    ][v]
    response = [
        f"Submitting a form does not guarantee that {name} will accept a project, meet a requested timeline, provide a specific price, or recommend a particular roof system.",
        f"A website inquiry starts a conversation. It does not create a service agreement, pricing commitment, or obligation for {name} to perform work.",
        f"Contacting {name} through the site does not by itself create a contractor relationship or confirmed scope of work.",
        f"Any project terms, pricing, schedule, and responsibilities must be confirmed separately in writing before work begins.",
        f"A submitted request helps {name} understand the inquiry, but it is not a contract, estimate approval, or scheduling commitment.",
        f"Website communication is preliminary unless and until project terms are separately reviewed and accepted.",
        f"A form submission is a request for follow-up, not a completed agreement for roofing services.",
        f"Project commitments require separate confirmation; the website alone does not finalize scope, cost, timing, or service acceptance.",
    ][v]
    third = [
        "The site may rely on outside providers for hosting, maps, analytics, email delivery, security, and spam prevention. Those services may operate under their own terms.",
        "Hosting, map, analytics, email, security, and form tools may support the website. Those services are separate from these website terms.",
        "Technical providers may help operate the site, deliver messages, show maps, measure performance, or screen abusive activity.",
        "Third-party tools may be used for ordinary website functions such as hosting, contact delivery, analytics, security, and maps.",
        "The website may include technical services operated by outside providers for delivery, security, measurement, and communication.",
        "Outside technology providers may support the website and have their own service rules.",
        "The site may connect with operational providers for hosting, forms, security, email, analytics, and maps.",
        "Some website functions may be handled by third-party technical services used for operation and communication.",
    ][v]
    contact = [
        f"Questions about these terms can be sent to {email} or handled by phone at {phone}.",
        f"For questions about website use, contact {email} or call {phone}.",
        f"Use {email} or {phone} for questions about these terms or a submitted inquiry.",
        f"Questions about the website terms may be directed to {email} or {phone}.",
        f"For term-related questions, contact {email} or call {phone}.",
        f"Questions can be sent to {email}; phone inquiries can be made at {phone}.",
        f"Contact {email} or {phone} with questions about website use.",
        f"To ask about these terms, use {email} or {phone}.",
    ][v]
    return f"""<main><section><h1>{title}</h1><p><strong>Effective date:</strong> {date}</p><p>{openers[v]}</p><h2>General website information</h2><p>{info}</p><h2>Responsible use</h2><p>{use}</p><h2>Inquiries and project discussions</h2><p>{response}</p><h2>Technical services</h2><p>{third}</p><h2>Contact</h2><p>{contact}</p></section></main>"""

def remove_legacy_legal_content(soup: BeautifulSoup, kind: str):
    main = soup.find("main")
    protected_names = {"html", "head", "body", "header", "footer", "nav", "main", "script", "style", "meta", "link", "title", "noscript", "svg", "symbol", "path"}
    stale = re.compile(
        r"privacy policy|terms of use|terms of service|respects your privacy|information submitted through this site|we do not sell your information|by using this website|website content is informational|no project guarantee|legitimate commercial roofing research|responsible use",
        re.I,
    )
    for tag in list(reversed(soup.find_all(True))):
        if tag.name in protected_names:
            continue
        if main and (tag is main or tag in main.parents or main in list(tag.parents)):
            continue
        if tag.find(["main", "header", "footer"]):
            continue
        if tag.find_parent(["header", "footer", "nav"]):
            continue
        text = clean(tag.get_text(" ", strip=True))
        if len(text) < 70:
            continue
        if stale.search(text):
            tag.decompose()

def legal_page(kind: str, date: str) -> str:
    title = "Privacy Policy" if kind == "privacy" else "Terms of Use"
    route = f"/{kind}"
    page_title, desc = meta_for(route)
    body = legal_section(kind, date)
    existing = PUBLIC / f"{kind}.html"
    if existing.exists():
        soup = BeautifulSoup(existing.read_text(errors="ignore"), "html.parser")
        shell_main = soup.find("main")
        new_main = BeautifulSoup(body, "html.parser").find("main")
        if shell_main and new_main:
            shell_main.clear()
            for child in list(new_main.contents):
                shell_main.append(child)
        elif soup.body and new_main:
            header = soup.body.find("header")
            if header:
                header.insert_after(new_main)
            else:
                soup.body.insert(0, new_main)
        else:
            soup = BeautifulSoup(f"<!doctype html><html lang='en-US'><head><title>{html.escape(page_title)}</title><meta name='description' content='{html.escape(desc)}'></head><body>{body}<footer><nav><a href='/privacy'>Privacy Policy</a> <a href='/terms'>Terms</a> <a href='/sitemap.xml'>Sitemap</a></nav></footer></body></html>", "html.parser")
    else:
        soup = BeautifulSoup(f"<!doctype html><html lang='en-US'><head><title>{html.escape(page_title)}</title><meta name='description' content='{html.escape(desc)}'></head><body>{body}<footer><nav><a href='/privacy'>Privacy Policy</a> <a href='/terms'>Terms</a> <a href='/sitemap.xml'>Sitemap</a></nav></footer></body></html>", "html.parser")
    remove_legacy_legal_content(soup, kind)
    set_metadata(soup, route)
    replace_banned_phrases(soup, int(hashlib.md5((BIZ["domain"] + kind).encode()).hexdigest(), 16))
    ensure_footer_links(soup)
    ensure_mobile_dropdown_assets(soup)
    ensure_color_scheme_assets(soup)
    return str(soup)

def write_legal_pages():
    idx = int(hashlib.sha1(BIZ["domain"].encode()).hexdigest(), 16) % len(DATE_POOL)
    privacy_date = clean(cfg.get("privacyEffectiveDate") or DATE_POOL[idx])
    terms_date = clean(cfg.get("termsEffectiveDate") or DATE_POOL[(idx + 5) % len(DATE_POOL)])
    (PUBLIC / "privacy.html").write_text(legal_page("privacy", privacy_date))
    (PUBLIC / "terms.html").write_text(legal_page("terms", terms_date))

def sitemap_routes() -> list[str]:
    routes = set()
    for p in PUBLIC.rglob("*.html"):
        if any(part in SKIP_PARTS or part == "__static-pages" for part in p.parts):
            continue
        if p.name.endswith(".ref") or p.name == "404.html":
            continue
        route = route_for_file(p)
        if route and not route.endswith(".html"):
            routes.add("/" if route in {"/home", "/index"} else route.rstrip("/") or "/")
    # Ensure taxonomy routes from content exist in sitemap even if source HTML is generated differently.
    for route in route_item:
        routes.add(route)
    routes.update(["/", "/about", "/contact", "/privacy", "/terms"])
    order = {"/":0,"/about":1,"/contact":2,"/services":3,"/roof-systems":4,"/industries":5,"/project-types":6,"/locations":7,"/manufacturers":8,"/privacy":98,"/terms":99}
    return sorted(routes, key=lambda r: (order.get(r, 50), r.count("/"), r))

def write_sitemap_robots_llms(routes: list[str]):
    urls = []
    for r in routes:
        loc = canonical_for_route(r)
        priority = "1.0" if r == "/" else "0.8" if r.count("/") == 1 else "0.6"
        urls.append(f"  <url><loc>{html.escape(loc)}</loc><changefreq>weekly</changefreq><priority>{priority}</priority></url>")
    (PUBLIC / "sitemap.xml").write_text("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n" + "\n".join(urls) + "\n</urlset>\n")
    (PUBLIC / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n")
    lines = [
        f"# {BIZ['name']}",
        f"Website: {SITE}/",
        f"Primary market: {BIZ['city']} {BIZ['state']}",
        "Focus: commercial roof repair, replacement, inspections, maintenance, coatings, roof systems, project planning, and service-area guidance.",
        "", "## Core pages",
        f"- Home: {SITE}/",
        f"- Services: {SITE}/services",
        f"- Roof systems: {SITE}/roof-systems",
        f"- Industries: {SITE}/industries",
        f"- Project types: {SITE}/project-types",
        f"- Service areas: {SITE}/locations",
        f"- Manufacturers: {SITE}/manufacturers",
        f"- Contact: {SITE}/contact",
        f"- Sitemap: {SITE}/sitemap.xml",
        "", "## Priority commercial roofing topics",
    ]
    for tax_key in TAX_KEYS:
        tax = TAX.get(tax_key) or {}
        route = clean(tax.get("route")) or f"/{tax_key}"
        for item in (tax.get("items") or [])[:5]:
            slug = clean(item.get("slug")); label = strip_tags(item.get("name") or slug.replace("-", " ").title())
            if slug:
                lines.append(f"- {label}: {SITE}{route.rstrip('/')}/{slug}")
    lines += ["", "## Use guidance", "This file summarizes the site's crawlable commercial roofing content for search engines, AI assistants, and research tools. Use canonical URLs from the sitemap for citation and navigation."]
    (PUBLIC / "llms.txt").write_text("\n".join(lines) + "\n")

def patch_all_html():
    salt = int(hashlib.md5(BIZ["domain"].encode()).hexdigest(), 16)
    for p in html_paths():
        before = p.read_text(errors="ignore")
        soup = BeautifulSoup(before, "html.parser")
        route = route_for_file(p) if p.is_relative_to(PUBLIC) else ""
        if not route:
            # data/rendered fragment; infer from filename/stem when possible
            route = "/" + p.stem.replace("__", "/") if p.stem not in {"home", "index"} else "/"
        set_metadata(soup, route)
        replace_visible_address(soup)
        replace_banned_phrases(soup, salt)
        ensure_footer_links(soup)
        ensure_mobile_dropdown_assets(soup)
        ensure_color_scheme_assets(soup)
        # Descriptive alt text for informative images without stuffing.
        for img in soup.find_all("img"):
            alt = clean(img.get("alt"))
            if not alt or alt.lower() in {"image", "photo", "logo", ""}:
                img["alt"] = f"{BIZ['city']} commercial roofing project image"[:80]
        after = str(soup)
        if after != before:
            p.write_text(after)

if not PUBLIC.exists():
    raise SystemExit(f"Missing public directory: {PUBLIC}")
write_legal_pages()
patch_all_html()
routes = sitemap_routes()
write_sitemap_robots_llms(routes)
# Patch legal pages again after sitemap/footer generation so metadata/css is consistent.
patch_all_html()
print(f"hobo-seo-finalize: {BIZ['domain']} routes={len(routes)} html={len(html_paths())}")
