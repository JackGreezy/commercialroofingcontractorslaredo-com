#!/usr/bin/env python3
from pathlib import Path
import json
import re

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
FAKE_DISPLAY = "-".join(("555", "555", "6150"))
FAKE_TEL = "".join(("555", "555", "6150"))


def fragment(markup: str):
    return BeautifulSoup(markup, "html.parser").find()


def replace_text(node, text: str):
    if node:
        node.clear()
        node.append(text)


def remove_fake_phone(soup: BeautifulSoup):
    for link in list(soup.select('a[href^="tel:"]')):
        href = re.sub(r"\D", "", link.get("href", ""))
        if href == FAKE_TEL or FAKE_DISPLAY in link.get_text(" ", strip=True):
            parent = link.find_parent("li")
            (parent or link).decompose()
    for text in list(soup.find_all(string=lambda value: value and FAKE_DISPLAY in value)):
        text.replace_with(str(text).replace(FAKE_DISPLAY, ""))
    for script in soup.select('script[type="application/ld+json"]'):
        try:
            data = json.loads(script.string or "{}")
        except Exception:
            continue
        if data.get("telephone") == FAKE_DISPLAY:
            data.pop("telephone", None)
            script.string = json.dumps(data, ensure_ascii=False)


def clean_punctuation(html: str) -> str:
    return (html.replace("—", ", ")
                .replace("&mdash;", ", ")
                .replace("&#8212;", ", ")
                .replace("&#x2014;", ", "))


def set_home_metadata(soup: BeautifulSoup):
    title = "Commercial Roofing Laredo, TX | Repair & Replacement"
    desc = ("Laredo commercial roof repair, emergency leak help, flat roof replacement "
            "inspections and reports, coatings, reroofing, and service agreements.")
    replace_text(soup.title, title)
    for tag in soup.select('meta[name="description"],meta[property="og:description"],meta[name="twitter:description"]'):
        tag["content"] = desc
    for tag in soup.select('meta[property="og:title"],meta[name="twitter:title"]'):
        tag["content"] = title


def home_pass(soup: BeautifulSoup):
    soup.body["data-laredo-home"] = "true"
    set_home_metadata(soup)

    slides = soup.select("#highlighted .slide")
    if slides:
        hero_title = slides[0].select_one(".field--name-field-slide-header")
        replace_text(hero_title, "Commercial Roof Trouble in Laredo? Start Here.")
        if hero_title:
            hero_title.name = "h1"
        replace_text(slides[0].select_one(".field--name-field-slide-caption p"), "Active leak response, documented flat roof inspections, repair, coatings, reroofing, and replacement planning for working South Texas properties.")
        link = slides[0].select_one(".field--name-field-slide-link a")
        if link:
            link.string = "Send an Urgent Roof Request"
            link["href"] = "/contact?service=emergency-roof-repair"
    if len(slides) > 1:
        replace_text(slides[1].select_one(".field--name-field-slide-header"), "Know If The Flat Roof Can Be Saved")
        replace_text(slides[1].select_one(".field--name-field-slide-caption p"), "Get photos, condition findings, moisture and drainage concerns, repair or coating feasibility, and a clear replacement recommendation before the next capital decision.")
        link = slides[1].select_one(".field--name-field-slide-link a")
        if link:
            link.string = "Request an Inspection & Report"
            link["href"] = "/services/commercial-roof-inspection"

    sr_h1 = soup.select_one("#highlighted h1")
    if sr_h1 and "sr-only" in (sr_h1.get("class") or []):
        sr_h1.decompose()

    intro = soup.select_one("#section-8107 .field--name-field-long-text")
    if intro:
        intro.clear()
        intro.append(fragment("""<div data-laredo-intro-copy>
<p>Commercial Roofing Contractors of Laredo</p>
<h2>Fix today’s roof problem. Get ahead of tomorrow’s capital project.</h2>
<p class="large color-navy">A commercial roof visit should do more than point at the leak. It should show what failed, what is wet, what can be repaired, whether a coating or recover is still viable, and when replacement belongs in the budget.</p>
<div data-laredo-actions><a class="button button--primary" href="/contact">Tell Us What Is Happening</a><a href="/services/commercial-roof-inspection">Schedule a Flat Roof Inspection</a></div>
</div>"""))

    service_band = soup.select_one("#section-8807")
    if service_band:
        service_band.insert_before(fragment("""<section data-laredo-emergency>
<div data-laredo-shell><div><p data-laredo-kicker>Water Inside The Building?</p><h2>Stop the spread. Document the cause. Plan the permanent repair.</h2><p>Send the building address, leak location, roof access, active operations, and what the water threatens below. The first move is limiting damage. The next is tracing the entry point and recording what the roof needs next.</p><a class="button button--primary" href="/contact?service=emergency-roof-repair">Get Emergency Commercial Roof Help</a></div><img src="/ours/services/emergency-tarp-dry-in-commercial-roofing-contractors-laredo-tx.webp" alt="Emergency commercial roof response in Laredo" loading="lazy"/></div>
</section>"""))

        cards = service_band.select(".field--name-field-content-ref > .field__item")
        if len(cards) >= 3:
            card = cards[2]
            for link in card.select("a"):
                link["href"] = "/services/commercial-roof-tear-off-replacement"
                link["title"] = "Flat Roof Replacement in Laredo"
                link["aria-label"] = "Flat Roof Replacement in Laredo"
            replace_text(card.select_one("h3 a"), "Flat Roof Replacement in Laredo")
            image = card.select_one("img")
            if image:
                image["src"] = "/ours/services/commercial-roof-tear-off-replacement-commercial-roofing-contractors-laredo-tx.webp"
                image["alt"] = "Flat Roof Replacement in Laredo"
                image["title"] = "Flat Roof Replacement in Laredo"
        service_band.insert_after(fragment("""<section data-laredo-decision>
<div data-laredo-shell><p data-laredo-kicker>Spend On The Right Scope</p><h2>Repair, coat, recover, or replace?</h2><p data-laredo-lead>The answer comes from roof condition, trapped moisture, attachment, drainage, deck risk, existing layers, service life, and how the building operates.</p><div data-laredo-decision-grid>
<a href="/services/commercial-roof-leak-repair"><strong>Repair the failure</strong><span>Trace the water path and fix the actual entry point.</span></a>
<a href="/services/silicone-roof-coatings"><strong>Restore with coating</strong><span>Confirm the roof is dry, attached, compatible, and worth restoring.</span></a>
<a href="/services/roof-recover-overlay"><strong>Recover the assembly</strong><span>Review layers, moisture, code, pullout, and load before overlaying.</span></a>
<a href="/services/commercial-roof-tear-off-replacement"><strong>Replace for the long term</strong><span>Plan tear-off, deck work, insulation, drainage, phasing, and dry-in.</span></a>
</div><a class="button button--primary" href="/contact">Get a Clear Roof Recommendation</a></div>
</section>"""))

    roof_band = soup.select_one('[data-rr-band="roof-systems"]')
    if roof_band:
        roof_band.insert_before(fragment("""<section data-laredo-report>
<div data-laredo-shell><img src="/ours/services/commercial-roof-inspection-commercial-roofing-contractors-laredo-tx.webp" alt="Laredo flat roof replacement inspection" loading="lazy"/><div><p data-laredo-kicker>Flat Roof Replacement Inspection</p><h2>A report the building team can act on.</h2><p>Before a reroof is priced, document the conditions that control the scope. That means membrane, seams, penetrations, drainage, wet insulation, existing layers, deck concerns, access, phasing, and same-day dry-in.</p><ul><li>Roof-area photos and condition notes</li><li>Immediate repair priorities</li><li>Coating, recover, and replacement feasibility</li><li>Budget and phasing questions to resolve</li><li>A written next-step recommendation</li></ul><a class="button button--primary" href="/services/commercial-roof-inspection">Request an Inspection & Report</a></div></div>
</section>"""))

    approach = soup.select_one("#section-2214")
    if approach:
        approach.insert_after(fragment("""<section data-laredo-service>
<div data-laredo-shell><div><p data-laredo-kicker>Commercial Roof Service Agreements</p><h2>Fewer surprise leaks. Better records. Smarter roof budgets.</h2><p>Scheduled roof service keeps drainage, seams, flashings, traffic damage, prior repairs, and changing conditions on one running record. That helps property and facility teams act before a small defect turns into interior damage.</p><div data-laredo-checks><span>Scheduled roof walks</span><span>Drain and scupper checks</span><span>Seam and flashing review</span><span>Photo documentation</span><span>Repair history</span><span>Replacement budget signals</span></div><a class="button button--primary" href="/services/preventive-maintenance-programs">Ask About a Service Agreement</a></div><img src="/ours/services/preventive-maintenance-programs-commercial-roofing-contractors-laredo-tx.webp" alt="Commercial roof service agreement inspection in Laredo" loading="lazy"/></div>
</section>"""))

    article = soup.find("article")
    if article:
        article.append(fragment("""<section data-laredo-faq>
<div data-laredo-shell><p data-laredo-kicker>Commercial Roof Questions</p><h2>Answers before the next roof decision.</h2><div data-laredo-faq-grid>
<details><summary>Can an active commercial roof leak be repaired without replacing the roof?</summary><p>Often, yes. The assessment still needs to follow the water path and confirm whether moisture has spread beyond the visible interior drip. An isolated failure and a saturated assembly need different scopes.</p></details>
<details><summary>What should a flat roof replacement inspection include?</summary><p>It should document membrane condition, seams, flashings, penetrations, drainage, moisture concerns, existing layers, deck risks, and whether repair, coating, recover, or replacement remains viable.</p></details>
<details><summary>When is a commercial roof coating a good option?</summary><p>A coating can make sense when the roof is dry, attached, compatible, cleanable, and repairable. Trapped moisture, failed insulation, poor drainage, and adhesion problems can disqualify it.</p></details>
<details><summary>What does a commercial roof service agreement cover?</summary><p>A useful agreement includes scheduled inspections, drainage checks, seam and flashing review, photos, repair history, and clear priorities for work that should happen before an emergency.</p></details>
</div><a class="button button--primary" href="/contact">Talk Through Your Commercial Roof</a></div>
</section>"""))

    if not soup.select_one("[data-laredo-mobile-help]"):
        soup.body.append(fragment('<a data-laredo-mobile-help href="/contact?service=urgent-roof-help">Roof Help</a>'))


def ensure_png_logo_override(soup: BeautifulSoup):
    old = soup.select_one("#laredo-png-branding")
    if old:
        old.decompose()
    style = soup.new_tag("style", id="laredo-png-branding")
    style.string = """
footer.footer .rr-footer-brand-wrap{display:flex!important;height:auto!important;width:100%!important}
footer.footer .rr-footer-brand-wrap a{display:flex!important;height:auto!important;width:100%!important}
footer.footer .rr-footer-brand-wrap img.rr-footer-brand-logo{display:block!important;height:auto!important;max-height:74px!important;max-width:min(320px,80vw)!important;object-fit:contain!important;visibility:visible!important;width:auto!important}
@media(max-width:900px){html body.rr-nav-open [data-rr-mobile]{left:auto!important;right:0!important;width:86vw!important;max-width:320px!important;transform:none!important}}
"""
    soup.head.append(style)


def main():
    changed = 0
    for path in PUBLIC.rglob("*.html"):
        html = path.read_text()
        soup = BeautifulSoup(html, "html.parser")
        remove_fake_phone(soup)
        ensure_png_logo_override(soup)
        if path.name in {"home.html", "index.html"} and path.parent == PUBLIC:
            home_pass(soup)
        output = clean_punctuation(str(soup))
        if output != html:
            path.write_text(output)
            changed += 1
    print(f"laredo-conversion-pass: {changed} page(s) updated")


if __name__ == "__main__":
    main()
