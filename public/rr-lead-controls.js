(() => {
  const configNode = document.getElementById("rr-lead-controls-config");
  if (!configNode) return;

  let config = {};
  try {
    config = JSON.parse(configNode.textContent || "{}");
  } catch {
    return;
  }

  const phone = String(config.phone || "").trim();
  const phoneTel = String(config.phoneTel || "").trim();
  const businessName = String(config.businessName || "Commercial Roofing").trim();
  if (!phone || !phoneTel) return;

  const handset = '<span class="rr-call-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M6.6 2.8 9.3 8l-2 1.8c1.3 2.7 3.5 4.9 6.2 6.2l1.8-2 5.2 2.7-.8 3.4c-.2.8-.9 1.4-1.8 1.4C9.4 21.5 2.5 14.6 2.5 6.1c0-.9.6-1.6 1.4-1.8l2.7-.7Z" fill="currentColor"/></svg></span>';
  const telHref = `tel:${phoneTel}`;

  const phonePattern = /(?:\+?1[\s.-]*)?(?:\(\s*\d{3}\s*\)|\d{3})[\s.-]*\d{3}[\s.-]*\d{4}/g;
  for (const link of document.querySelectorAll('a[href^="tel:"]')) {
    if (link.hasAttribute("data-rr-desktop-phone") || link.hasAttribute("data-rr-mobile-phone")) continue;
    link.href = telHref;
    for (const node of [...link.childNodes]) {
      if (node.nodeType === Node.TEXT_NODE && phonePattern.test(node.textContent || "")) {
        node.textContent = (node.textContent || "").replace(phonePattern, phone);
      }
      phonePattern.lastIndex = 0;
    }
  }

  const header = document.querySelector("header");
  if (header && !header.querySelector("[data-rr-desktop-phone]")) {
    const contactLinks = [...header.querySelectorAll("a[href]")].filter((link) => /(?:^|\/)contact(?:[/?#.]|$)/i.test(link.getAttribute("href") || ""));
    const contactLink = contactLinks.find((link) => {
      const rect = link.getBoundingClientRect();
      const style = getComputedStyle(link);
      return rect.width > 4 && rect.height > 4 && style.display !== "none" && style.visibility !== "hidden";
    }) || contactLinks[0];
    const desktopPhone = document.createElement("a");
    desktopPhone.href = telHref;
    desktopPhone.setAttribute("data-rr-desktop-phone", "");
    desktopPhone.setAttribute("aria-label", `Call ${businessName} at ${phone}`);
    desktopPhone.className = `${contactLink?.className || ""} rr-desktop-phone`.trim();
    desktopPhone.innerHTML = `${handset}<span>Call ${phone}</span>`;

    if (contactLink?.parentElement?.tagName === "LI") {
      const item = document.createElement("li");
      item.className = `${contactLink.parentElement.className || ""} rr-desktop-phone-item`.trim();
      item.append(desktopPhone);
      contactLink.parentElement.insertAdjacentElement("beforebegin", item);
    } else if (contactLink) {
      const insertionParent = contactLink.parentElement;
      if (insertionParent && getComputedStyle(insertionParent).display === "contents") insertionParent.insertAdjacentElement("beforebegin", desktopPhone);
      else if (insertionParent && ["NAV", "UL", "OL", "DIV"].includes(insertionParent.tagName)) insertionParent.insertBefore(desktopPhone, contactLink);
      else contactLink.insertAdjacentElement("beforebegin", desktopPhone);
    } else {
      header.append(desktopPhone);
    }
    window.setTimeout(() => {
      const rect = desktopPhone.getBoundingClientRect();
      if (rect.width > 4 && rect.height > 4) return;
      desktopPhone.setAttribute("data-rr-desktop-phone-fallback", "");
      header.style.setProperty("position", getComputedStyle(header).position === "static" ? "relative" : getComputedStyle(header).position);
      header.append(desktopPhone);
    }, 0);
  }

  if (!document.querySelector("[data-rr-mobile-phone]")) {
    const mobilePhone = document.createElement("a");
    mobilePhone.href = telHref;
    mobilePhone.setAttribute("data-rr-mobile-phone", "");
    mobilePhone.setAttribute("aria-label", `Call ${businessName} at ${phone}`);
    mobilePhone.innerHTML = handset;
    document.body.append(mobilePhone);
  }

  if (document.documentElement.dataset.rrPageKind === "contact" && !document.querySelector("[data-rr-contact-callout]")) {
    const form = document.querySelector("main form, [role=main] form, form[data-contact-form], form[action*=contact], form[action*=submit]");
    if (form) {
      const callout = document.createElement("div");
      callout.setAttribute("data-rr-contact-callout", "");
      callout.innerHTML = `<p><strong>Need commercial roof help now?</strong><span>Call for repair, inspection, coating, or replacement help.</span></p><a href="${telHref}" aria-label="Call ${businessName} at ${phone}">${handset}<span>Call ${phone}</span></a>`;
      form.insertAdjacentElement("beforebegin", callout);
    }
  }

  const themeCandidate = [...document.querySelectorAll("header a, header button")].find((element) => {
    if (element.hasAttribute("data-rr-desktop-phone")) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.backgroundColor !== "rgba(0, 0, 0, 0)" && style.backgroundColor !== "transparent";
  });
  if (themeCandidate) {
    const style = getComputedStyle(themeCandidate);
    document.documentElement.style.setProperty("--rr-call-bg", style.backgroundColor);
    document.documentElement.style.setProperty("--rr-call-color", style.color);
  }

  const carouselSelector = '[data-rr-carousel],.slick-slider,.swiper,.swiper-container,.owl-carousel,.splide,[class*="carousel" i],[class*="slider" i]';

  if (document.documentElement.dataset.rrPageKind !== "home") {
    for (const carouselRoot of document.querySelectorAll('[data-rr-carousel]')) {
      carouselRoot.removeAttribute('data-rr-carousel');
      carouselRoot.removeAttribute('data-rr-autoplay');
    }
  }

  if (document.documentElement.dataset.rrPageKind === "home") {
    const arrow = (direction) => {
      const path = direction === "previous" ? "M15 4 7 12l8 8" : "m9 4 8 8-8 8";
      return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${path}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4"/></svg>`;
    };
    const sliderState = (root) => {
      const track = root.querySelector('.slick-track,.swiper-wrapper,.owl-stage,.splide__list,[data-rr-track]') || root;
      const active = [...root.querySelectorAll('.slick-current,.slick-active,.swiper-slide-active,.owl-item.active,.splide__slide.is-active,[aria-hidden="false"]')]
        .map((element) => `${element.className}:${element.getAttribute("data-slick-index") || element.getAttribute("data-swiper-slide-index") || ""}`)
        .join("|");
      return `${active}::${track.style.transform || getComputedStyle(track).transform}::${track.scrollLeft || 0}`;
    };
    const slideSelector = '.slick-slide:not(.slick-cloned),.swiper-slide:not(.swiper-slide-duplicate),.owl-item:not(.cloned),.splide__slide:not(.splide__slide--clone),[data-rr-slide]';
    const controlSelector = '.slick-prev,.slick-next,.swiper-button-prev,.swiper-button-next,.owl-prev,.owl-next,.splide__arrow--prev,.splide__arrow--next,.rr-carousel-prev,.rr-carousel-next,[aria-label*="previous" i],[aria-label*="next" i]';
    const owningCarouselSelector = '[data-rr-carousel],.slick-slider,.swiper,.swiper-container,.owl-carousel,.splide';
    for (const root of document.querySelectorAll(carouselSelector)) {
      if (root.parentElement?.closest(owningCarouselSelector)) continue;
      const explicitSlides = root.dataset.rrSlides ? [...root.querySelectorAll(root.dataset.rrSlides)] : [];
      const selectedSlides = [...root.querySelectorAll(slideSelector)];
      const slides = explicitSlides.length > 1
        ? explicitSlides
        : selectedSlides.length > 1
          ? selectedSlides
          : root.dataset.rrCarousel === "native"
            ? [...root.children].filter((element) => element.nodeType === 1 && !/control|arrow/i.test(element.className || ""))
            : [];
      if (slides.length < 2) continue;
      root.setAttribute("data-rr-home-carousel-audited", String(slides.length));
      let controls = [...root.querySelectorAll(controlSelector)];
      const existingFallback = root.nextElementSibling?.matches('.rr-fallback-carousel-controls') ? root.nextElementSibling : null;
      if (controls.length < 2 && existingFallback) controls = [...existingFallback.querySelectorAll(controlSelector)];
      if (controls.length < 2 && !existingFallback) {
        const container = document.createElement("div");
        container.className = "rr-fallback-carousel-controls";
        const previous = document.createElement("button");
        previous.type = "button";
        previous.className = "rr-carousel-control rr-carousel-prev";
        previous.setAttribute("aria-label", "Previous slides");
        previous.innerHTML = arrow("previous");
        const next = document.createElement("button");
        next.type = "button";
        next.className = "rr-carousel-control rr-carousel-next";
        next.setAttribute("aria-label", "Next slides");
        next.innerHTML = arrow("next");
        container.append(previous, next);
        root.insertAdjacentElement("afterend", container);
        controls = [previous, next];
      }
      root.__rrLeadMoveFallback = (direction) => {
        const current = Number(root.dataset.rrLeadIndex || root.dataset.rrTasteIndex || 0) || 0;
        const visible = Math.max(1, Number(root.dataset.rrVisible || 1) || 1);
        const max = Math.max(0, slides.length - visible);
        const index = direction > 0 ? (current >= max ? 0 : current + 1) : (current <= 0 ? max : current - 1);
        const track = root.querySelector('.slick-track,.swiper-wrapper,.owl-stage,.splide__list,[data-rr-track]') || root;
        const first = slides[0];
        const step = (first?.getBoundingClientRect().width || root.clientWidth / visible) + (parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || "0") || 0);
        track.style.setProperty("transition", "transform .45s ease", "important");
        track.style.setProperty("transform", `translate3d(${-index * step}px,0,0)`, "important");
        root.dataset.rrLeadIndex = String(index);
        slides.forEach((slide, slideIndex) => slide.setAttribute("aria-hidden", String(slideIndex < index || slideIndex >= index + visible)));
      };
      for (const control of controls) {
        if (control.dataset.rrMovementGuard === "true") continue;
        control.dataset.rrMovementGuard = "true";
        control.addEventListener("click", () => {
          const before = sliderState(root);
          window.setTimeout(() => {
            const after = sliderState(root);
            if (before !== after) return;
            const direction = /prev|previous|back|left/i.test(`${control.className} ${control.getAttribute("aria-label") || ""}`) ? -1 : 1;
            if (root.__rrTasteMoveFallback) root.__rrTasteMoveFallback(direction, root.__rrTasteCurrentIndex?.() || 0);
            else root.__rrLeadMoveFallback(direction);
          }, 240);
        }, true);
      }
    }
    return;
  }

  if (document.documentElement.dataset.rrPageKind !== "slug") return;

  const slideSelector = '.slick-slide:not(.slick-cloned),.swiper-slide:not(.swiper-slide-duplicate),.owl-item:not(.cloned),.splide__slide:not(.splide__slide--clone),[data-rr-slide]';
  const candidates = [...document.querySelectorAll(carouselSelector)];
  const owningCarouselSelector = '[data-rr-carousel],.slick-slider,.swiper,.swiper-container,.owl-carousel,.splide';
  for (const root of candidates) {
    if (root.parentElement?.closest(owningCarouselSelector)) continue;
    const explicitSlides = root.dataset.rrSlides ? [...root.querySelectorAll(root.dataset.rrSlides)] : [];
    const selectedSlides = [...root.querySelectorAll(slideSelector)];
    const slides = explicitSlides.length > 1
      ? explicitSlides
      : selectedSlides.length > 1
        ? selectedSlides
        : root.dataset.rrCarousel === "native"
          ? [...root.children].filter((element) => element.nodeType === 1 && !/control|arrow/i.test(element.className || ""))
          : [];
    if (slides.length < 2) continue;
    try {
      root.swiper?.destroy?.(true, true);
    } catch {}
    root.classList.add("rr-detail-static-carousel");
    root.setAttribute("data-rr-detail-carousel-disabled", String(slides.length));
    if (/hero|banner|masthead/i.test(`${root.id} ${root.className}`)) root.classList.add("rr-detail-static-single");
    root.removeAttribute("data-rr-carousel");
    for (const track of root.querySelectorAll('.slick-track,.swiper-wrapper,.owl-stage,.splide__list,[data-rr-track]')) {
      track.style.removeProperty("transform");
      track.style.removeProperty("translate");
      track.style.removeProperty("width");
      track.style.removeProperty("height");
    }
    for (const slide of slides) {
      slide.removeAttribute("aria-hidden");
      slide.removeAttribute("tabindex");
      slide.style.removeProperty("transform");
      slide.style.removeProperty("translate");
      slide.style.removeProperty("width");
      slide.style.removeProperty("height");
    }
  }
})();
