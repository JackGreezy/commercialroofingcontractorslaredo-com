(() => {
  const icon = (direction) => {
    const path = direction === "previous" ? "M15 4 7 12l8 8" : "m9 4 8 8-8 8";
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${path}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4"/></svg>`;
  };

  for (const track of document.querySelectorAll(".hi-slick,.stacked-slick")) {
    if (track.dataset.rrTasteReady === "true") continue;
    const slides = [...track.children].filter((element) => element.matches(".slide"));
    if (slides.length < 2) continue;

    const viewport = document.createElement("div");
    viewport.className = "rr-carousel-viewport";
    track.parentNode.insertBefore(viewport, track);
    viewport.appendChild(track);
    track.classList.add("rr-taste-carousel");

    const section = viewport.closest(".integration-wrap,.core-values-wrap") || viewport.parentElement;
    let controls = section.querySelector(".stacked-controls");
    if (!controls) {
      controls = document.createElement("div");
      controls.className = "stacked-controls";
      section.appendChild(controls);
    }
    controls.replaceChildren();

    const previous = document.createElement("button");
    previous.type = "button";
    previous.className = "rr-carousel-control rr-carousel-prev";
    previous.setAttribute("aria-label", "Previous slides");
    previous.innerHTML = icon("previous");

    const next = document.createElement("button");
    next.type = "button";
    next.className = "rr-carousel-control rr-carousel-next";
    next.setAttribute("aria-label", "Next slides");
    next.innerHTML = icon("next");
    controls.append(previous, next);

    let index = 0;
    const visible = () => {
      if (matchMedia("(max-width: 620px)").matches) return 1;
      if (matchMedia("(max-width: 900px)").matches) return 2;
      return 3;
    };
    const render = () => {
      const count = Math.max(1, visible());
      const max = Math.max(0, slides.length - count);
      if (index > max) index = 0;
      const gap = 16;
      const step = (viewport.clientWidth - gap * (count - 1)) / count + gap;
      track.style.setProperty("transform", `translate3d(${-index * step}px,0,0)`, "important");
      slides.forEach((slide, slideIndex) => {
        slide.setAttribute("aria-hidden", String(slideIndex < index || slideIndex >= index + count));
      });
      track.dataset.rrTasteIndex = String(index);
    };
    const move = (delta) => {
      const max = Math.max(0, slides.length - visible());
      index = delta > 0 ? (index >= max ? 0 : index + 1) : (index <= 0 ? max : index - 1);
      render();
    };

    previous.addEventListener("click", () => move(-1));
    next.addEventListener("click", () => move(1));
    viewport.tabIndex = 0;
    viewport.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
    });
    window.addEventListener("resize", render);
    track.dataset.rrTasteReady = "true";
    render();
  }

  const controlSelector = [
    ".jcarousel-prev",
    ".jcarousel-next",
    ".back-arrow",
    ".prev-arrow",
    ".next-arrow",
    ".forward-arrow",
    ".slider-prev",
    ".slider-next",
    ".controls-prev",
    ".controls-next",
    ".carousel-arrow--prev",
    ".carousel-arrow--next",
    ".slick-prev",
    ".slick-next",
    ".owl-prev",
    ".owl-next",
    ".splide__arrow--prev",
    ".splide__arrow--next",
    ".swiper-button-prev",
    ".swiper-button-next",
    "[aria-label*='previous' i]",
    "[aria-label*='next' i]",
  ].join(",");

  const controlIdentity = /(?:^|[\s_-])(?:prev(?:ious)?|next|back|forward|arrow|left|right)(?:[\s_-]|$)/;
  const normalizeControl = (control, direction) => {
    if (!control) return;
    const previous = direction === "previous";
    for (const property of [
      "display",
      "position",
      "inset",
      "width",
      "height",
      "flex",
      "transform",
      "transition",
      "opacity",
      "z-index",
      "pointer-events",
    ]) {
      control.style.removeProperty(property);
    }
    control.removeAttribute("aria-hidden");
    control.classList.add(
      "rr-carousel-control",
      previous ? "rr-carousel-prev" : "rr-carousel-next",
      previous ? "prev" : "next"
    );
    control.disabled = false;
    control.removeAttribute("disabled");
    control.classList.remove("disabled", "slick-disabled", "swiper-button-disabled");
    control.setAttribute("aria-disabled", "false");
    control.setAttribute("aria-label", previous ? "Previous slides" : "Next slides");
    if (!["A", "BUTTON"].includes(control.tagName)) {
      control.setAttribute("role", "button");
      control.setAttribute("tabindex", "0");
      control.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          control.click();
        }
      });
    }
    control.innerHTML = icon(previous ? "previous" : "next");
  };
  const querySafe = (scope, selector) => {
    if (!scope || !selector) return null;
    try {
      return scope.querySelector(selector);
    } catch {
      return null;
    }
  };
  const sliderSlides = (root) => {
    const explicit = root.dataset.rrSlides;
    if (explicit) {
      try {
        const found = [...root.querySelectorAll(explicit)];
        if (found.length > 1) return found;
      } catch {}
    }
    const selectors = [
      ".slick-slide:not(.slick-cloned)",
      ".swiper-slide:not(.swiper-slide-duplicate)",
      ".owl-item:not(.cloned)",
      ".splide__slide:not(.splide__slide--clone)",
      ".property-slides__slide",
      "[data-rr-slide]",
    ];
    for (const selector of selectors) {
      const found = [...root.querySelectorAll(selector)];
      if (found.length > 1) return found;
    }
    return [...root.children].filter((child) => child.nodeType === 1);
  };

  const carouselSelector = "[data-rr-carousel],.slick-slider,.swiper,.owl-carousel,.splide";
  for (const root of document.querySelectorAll(carouselSelector)) {
    const owningCarousel = root.parentElement?.closest(carouselSelector);
    if (owningCarousel && sliderSlides(owningCarousel).length > 1) continue;
    const scope = root.parentElement || root;
    const nearby = [...root.querySelectorAll(controlSelector)];
    let previousControl = querySafe(root, root.dataset.rrPrev);
    let nextControl = querySafe(root, root.dataset.rrNext);
    for (const control of nearby) {
      const identity = `${control.className || ""} ${control.getAttribute("aria-label") || ""}`.toLowerCase();
      if (!controlIdentity.test(identity)) continue;
      const previous = /(?:^|[\s_-])(?:prev(?:ious)?|back|left)(?:[\s_-]|$)/.test(identity);
      const next = /(?:^|[\s_-])(?:next|forward|right)(?:[\s_-]|$)/.test(identity);
      if (!previous && !next) continue;
      if (previous && !previousControl) previousControl = control;
      if (next && !nextControl) nextControl = control;
    }
    normalizeControl(previousControl, "previous");
    normalizeControl(nextControl, "next");
    const renderableControl = (control) => {
      if (!control) return false;
      const style = getComputedStyle(control);
      const rect = control.getBoundingClientRect();
      return style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || 1) > 0 &&
        rect.width > 4 &&
        rect.height > 4;
    };
    if (!renderableControl(previousControl)) previousControl = null;
    if (!renderableControl(nextControl)) nextControl = null;

    const slides = sliderSlides(root);
    if (slides.length < 2) continue;
    if (!previousControl || !nextControl) {
      let controls = root.nextElementSibling?.matches(".rr-fallback-carousel-controls")
        ? root.nextElementSibling
        : null;
      if (!controls) {
        controls = document.createElement("div");
        controls.className = "rr-fallback-carousel-controls";
        root.insertAdjacentElement("afterend", controls);
      }
      if (!previousControl) {
        previousControl = document.createElement("button");
        previousControl.type = "button";
        controls.appendChild(previousControl);
        normalizeControl(previousControl, "previous");
      }
      if (!nextControl) {
        nextControl = document.createElement("button");
        nextControl.type = "button";
        controls.appendChild(nextControl);
        normalizeControl(nextControl, "next");
      }
    }
    let fallbackIndex = Math.max(0, slides.findIndex((slide) =>
      slide.classList.contains("slick-current") ||
      slide.classList.contains("swiper-slide-active") ||
      slide.classList.contains("active") ||
      slide.getAttribute("aria-hidden") === "false"
    ));
    const dots = [...root.querySelectorAll(
      ".slick-dots button,.swiper-pagination-bullet,.galslice,.flickity-page-dots button,.owl-dot"
    )];
    const currentIndex = () => {
      const stored = Number(root.dataset.rrTasteIndex);
      if (root.dataset.rrTasteIndex !== "" && Number.isFinite(stored)) return stored;
      const active = slides.findIndex((slide) =>
        slide.classList.contains("slick-current") ||
        slide.classList.contains("swiper-slide-active") ||
        slide.classList.contains("active") ||
        slide.getAttribute("aria-hidden") === "false"
      );
      return active >= 0 ? active : fallbackIndex;
    };
    const moveFallback = (delta, baseIndex = null) => {
      const activeDot = dots.findIndex((dot) =>
        dot.classList.contains("active") ||
        dot.classList.contains("slick-active") ||
        dot.classList.contains("swiper-pagination-bullet-active") ||
        dot.parentElement?.classList.contains("slick-active")
      );
      if (dots.length > 1) {
        const current = baseIndex ?? (activeDot >= 0 ? activeDot : fallbackIndex);
        fallbackIndex = (current + delta + dots.length) % dots.length;
        dots[fallbackIndex].click();
        root.dataset.rrTasteIndex = String(fallbackIndex);
        return;
      }
      if (baseIndex !== null) fallbackIndex = baseIndex;
      fallbackIndex = (fallbackIndex + delta + slides.length) % slides.length;
      slides.forEach((slide, index) => {
        const active = index === fallbackIndex;
        slide.classList.toggle("active", active);
        slide.classList.toggle("slick-current", active);
        slide.classList.toggle("swiper-slide-active", active);
        slide.setAttribute("aria-hidden", String(!active));
        slide.style.setProperty("display", active ? "block" : "none", "important");
      });
      root.dataset.rrTasteIndex = String(fallbackIndex);
    };
    const state = () => JSON.stringify({
      index: root.dataset.rrTasteIndex || "",
      swiper: root.swiper?.realIndex ?? root.swiper?.activeIndex ?? "",
      active: slides.map((slide) => [
        slide.classList.contains("slick-current"),
        slide.classList.contains("swiper-slide-active"),
        slide.classList.contains("active"),
        slide.getAttribute("aria-hidden"),
      ]),
      transforms: [...root.querySelectorAll(
        ".slick-track,.swiper-wrapper,.owl-stage,.flickity-slider,[data-rr-track]"
      )].map((track) => track.style.transform || getComputedStyle(track).transform),
    });
    root.__rrTasteCurrentIndex = currentIndex;
    root.__rrTasteMoveFallback = moveFallback;
    root.__rrTasteState = state;
    const ensureMovement = (control, delta) => {
      control.addEventListener("click", () => {
        const before = state();
        const beforeIndex = currentIndex();
        const repairMovement = () => {
          const after = state();
          const afterIndex = currentIndex();
          const expected = (beforeIndex + delta + slides.length) % slides.length;
          const invalidIndex = root.dataset.rrTasteIndex !== "" &&
            !Number.isFinite(Number(root.dataset.rrTasteIndex));
          if (after === before || invalidIndex || afterIndex !== expected) {
            if (invalidIndex) delete root.dataset.rrTasteIndex;
            moveFallback(delta, beforeIndex);
          }
          previousControl.disabled = false;
          previousControl.removeAttribute("disabled");
          previousControl.classList.remove("disabled", "slick-disabled", "swiper-button-disabled");
          previousControl.setAttribute("aria-disabled", "false");
          nextControl.disabled = false;
          nextControl.removeAttribute("disabled");
          nextControl.classList.remove("disabled", "slick-disabled", "swiper-button-disabled");
          nextControl.setAttribute("aria-disabled", "false");
        };
        window.setTimeout(repairMovement, 60);
        window.setTimeout(repairMovement, 180);
      }, true);
    };
    ensureMovement(previousControl, -1);
    ensureMovement(nextControl, 1);
  }

  if (!document.documentElement.dataset.rrCarouselDelegation) {
    document.documentElement.dataset.rrCarouselDelegation = "true";
    document.addEventListener("click", (event) => {
      const control = event.target.closest?.(".rr-carousel-control");
      if (!control) return;
      const direction = control.classList.contains("rr-carousel-prev") ? -1 : 1;
      const fallbackSibling = control.closest(".rr-fallback-carousel-controls")?.previousElementSibling;
      const root = control.closest("[data-rr-carousel]") ||
        (fallbackSibling?.matches?.(carouselSelector) ? fallbackSibling : null) ||
        control.closest(carouselSelector);
      if (!root?.__rrTasteMoveFallback || !root.__rrTasteState || !root.__rrTasteCurrentIndex) return;
      const before = root.__rrTasteState();
      const beforeIndex = root.__rrTasteCurrentIndex();
      window.setTimeout(() => {
        const after = root.__rrTasteState();
        const afterIndex = root.__rrTasteCurrentIndex();
        const slides = sliderSlides(root);
        const expected = (beforeIndex + direction + slides.length) % slides.length;
        if (after === before || afterIndex !== expected) {
          root.__rrTasteMoveFallback(direction, beforeIndex);
        }
      }, 220);
    }, true);
  }

  for (const body of document.querySelectorAll(".project-body")) {
    const heading = [...body.querySelectorAll("h2")].find((element) => /questions|faq/i.test(element.textContent || ""));
    if (!heading || heading.dataset.rrFaqReady === "true") continue;
    const faqParent = heading.parentElement;
    const list = document.createElement("div");
    list.className = "rr-faq-list";
    heading.insertAdjacentElement("afterend", list);
    let node = list.nextSibling;
    while (node) {
      const nextNode = node.nextSibling;
      if (node.nodeType === 1 && node.tagName === "H3") {
        const details = document.createElement("details");
        details.className = "rr-faq-item";
        const summary = document.createElement("summary");
        summary.textContent = node.textContent.trim();
        const answer = document.createElement("div");
        answer.className = "rr-faq-answer";
        let answerNode = nextNode;
        while (answerNode && answerNode.parentElement === faqParent && !(answerNode.nodeType === 1 && answerNode.tagName === "H3")) {
          const following = answerNode.nextSibling;
          answer.appendChild(answerNode);
          answerNode = following;
        }
        details.append(summary, answer);
        list.appendChild(details);
        node.remove();
        node = answerNode;
        continue;
      }
      node = nextNode;
    }
    heading.dataset.rrFaqReady = "true";
  }

  for (const form of document.querySelectorAll("[data-contact-form]")) {
    if (form.dataset.rrAsyncReady === "true") continue;
    const status = form.querySelector("[data-form-status]");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const submit = form.querySelector("[type='submit']");
      if (status) status.textContent = "Sending your roof request...";
      if (submit) submit.disabled = true;
      try {
        const response = await fetch(form.action, { method: "POST", body: new FormData(form) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || payload.error || "Unable to send the request.");
        form.reset();
        if (status) status.textContent = "Thanks. We received your roof request and will follow up shortly.";
      } catch (error) {
        if (status) status.textContent = error.message || "Unable to send the request. Please call us directly.";
      } finally {
        if (submit) submit.disabled = false;
      }
    });
    form.dataset.rrAsyncReady = "true";
  }
})();
