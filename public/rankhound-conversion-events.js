(function () {
  function start() {
  if (window.__rankhoundGrowthV3) return;
  var upgradeOnly = !!window.__rankhoundGrowthV2;
  window.__rankhoundGrowthV3 = true;
  window.__rankhoundGrowthVersion = 'mobile-intent-v3';
  window.__rankhoundGrowthV2 = true;
  window.__rankhoundConversionEvents = true;
  var compactForms = true;
  var started = new WeakSet();
  var accepted = new WeakMap();
  var attempts = new WeakMap();
  var errors = new WeakMap();
  var pendingAttempts = new WeakSet();
  var submittingForm = null;
  var qa = new URLSearchParams(location.search).get('rh_qa') === '1';
  var firstSource = 'direct';
  if (!upgradeOnly) {
  try {
    var saved = JSON.parse(window.sessionStorage.getItem('rh_contact_source_v1') || 'null');
    var sources = ['direct', 'internal_unknown', 'google_search', 'google_paid', 'bing_search', 'bing_paid', 'duckduckgo_search', 'yahoo_search', 'email', 'other_referral', 'other_campaign'];
    if (saved && sources.indexOf(saved.source) !== -1 && Date.now() - saved.at < 30 * 60 * 1000) firstSource = saved.source;
    else saved = null;
  } catch (_) { saved = null; }
  if (!saved) {
    var query = new URLSearchParams(location.search);
    var referrer = '';
    try { referrer = new URL(document.referrer || '').hostname.toLowerCase(); } catch (_) {}
    if (query.has('gclid')) firstSource = 'google_paid';
    else if (query.has('msclkid')) firstSource = 'bing_paid';
    else if (String(query.get('utm_medium') || '').toLowerCase() === 'email' || /^(mail\.google\.com|com\.google\.android\.gm|outlook\.(?:live|office)\.com)$/.test(referrer)) firstSource = 'email';
    else if (/^(?:www\.)?google\.(?:com|[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/.test(referrer) || referrer === 'com.google.android.googlequicksearchbox') firstSource = 'google_search';
    else if (/^(?:www\.)?bing\.com$/.test(referrer)) firstSource = 'bing_search';
    else if (/^(?:www\.)?duckduckgo\.com$/.test(referrer)) firstSource = 'duckduckgo_search';
    else if (/(^|\.)search\.yahoo\.com$/.test(referrer)) firstSource = 'yahoo_search';
    else if (query.has('utm_source')) firstSource = 'other_campaign';
    else if (referrer === location.hostname || referrer === new URL(location.href).hostname) firstSource = 'internal_unknown';
    else if (referrer) firstSource = 'other_referral';
    try { window.sessionStorage.setItem('rh_contact_source_v1', JSON.stringify({ source: firstSource, at: Date.now() })); } catch (_) {}
  }
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  if (qa) window.va('beforeSend', function () { return null; });
  }

  function send(name, extra) {
    if (qa) return;
    var data = { path: location.pathname || '/', first_source: firstSource };
    Object.keys(extra || {}).forEach(function (key) { data[key] = extra[key]; });
    window.va('event', { name: name, data: data });
  }

  function leadForm(form) {
    if (!form || form.tagName !== 'FORM') return false;
    var action;
    try { action = new URL(form.getAttribute('action') || '', location.href); } catch (_) { return false; }
    if (action.origin !== location.origin) return false;
    return /^\/api\/(contact|submit)\/?$/.test(action.pathname) ||
      (!form.getAttribute('action') && ['name', 'phone', 'email'].every(function (name) { return !!form.querySelector('[name="' + name + '"]'); }));
  }

  function placement(link) {
    if (link.closest('[data-rh-placement]')) return link.closest('[data-rh-placement]').getAttribute('data-rh-placement');
    if (link.closest('header')) return 'header';
    if (link.closest('footer')) return 'footer';
    return 'content';
  }

  if (!upgradeOnly) {
  document.addEventListener('click', function (event) {
    var clickedForm = event.target && (event.target.form || event.target.closest && event.target.closest('form'));
    if (leadForm(clickedForm)) submittingForm = clickedForm;
    var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!link) return;
    var href = link.getAttribute('href') || '';
    if (/^tel:/i.test(href)) send('lead_phone_click', { placement: placement(link) });
    else if (/^mailto:/i.test(href)) send('lead_email_click', { placement: placement(link) });
    else if (link.hasAttribute('data-rh-callback')) send('lead_callback_click', { placement: placement(link) });
  }, true);

  document.addEventListener('focusin', function (event) {
    var form = event.target && event.target.form;
    if (leadForm(form)) submittingForm = form;
    if (leadForm(form) && !started.has(form)) { started.add(form); send('lead_form_start'); }
  }, true);

  document.addEventListener('submit', function (event) {
    if (leadForm(event.target)) {
      submittingForm = event.target;
      pendingAttempts.add(event.target);
      attempts.set(event.target, (attempts.get(event.target) || 0) + 1);
      send('lead_form_attempt');
    }
  }, true);

  document.addEventListener('rankhound:lead-result', function (event) {
    var detail = event.detail || {};
    if (!leadForm(detail.form)) return;
    if (detail.accepted === true) {
      var attempt = attempts.get(detail.form) || 0;
      if (accepted.get(detail.form) === attempt) return;
      accepted.set(detail.form, attempt);
      send('lead_form_accepted');
    } else if (detail.failed === true) {
      var errorKey = (attempts.get(detail.form) || 0) + ':' + (Number(detail.status) || 0);
      if (errors.get(detail.form) === errorKey) return;
      errors.set(detail.form, errorKey);
      send('lead_form_error', { status: Number(detail.status) || 0 });
    }
  });

  // Observe only first-party lead requests. Keep request bodies, tokens and responses out of analytics.
  if (typeof window.fetch === 'function') {
    var originalFetch = window.fetch;
    window.fetch = function (input, init) {
      var args = arguments;
      var url;
      try { url = new URL(typeof input === 'string' ? input : input.url || String(input), location.href); } catch (_) {}
      var method = String(init && init.method || input && input.method || 'GET').toUpperCase();
      if (!url || method !== 'POST' || url.origin !== location.origin || !/^\/api\/(contact|submit)\/?$/.test(url.pathname)) return originalFetch.apply(window, args);
      var form = submittingForm;
      if (!leadForm(form)) {
        var forms = Array.prototype.filter.call(document.querySelectorAll('form'), leadForm);
        form = forms.length === 1 ? forms[0] : null;
      }
      if (form) {
        if (pendingAttempts.has(form)) pendingAttempts.delete(form);
        else { attempts.set(form, (attempts.get(form) || 0) + 1); send('lead_form_attempt'); }
      }
      function result(detail) {
        if (form) document.dispatchEvent(new CustomEvent('rankhound:lead-result', { detail: Object.assign({ form: form }, detail) }));
      }
      return originalFetch.apply(window, args).then(function (response) {
        if (form) response.clone().json().then(function (body) {
          result({ accepted: response.ok && body.leadAccepted === true, failed: !(response.ok && (body.ok || body.success)), status: response.status });
        }).catch(function () { result({ failed: true, status: response.status }); });
        return response;
      }).catch(function (error) { result({ failed: true, status: 0 }); throw error; });
    };
  }

  }

  function shorten(form) {
    if (!compactForms || !leadForm(form)) return;
    var button = form.querySelector('button[type="submit"], input[type="submit"]');
    var caption = button && (button.textContent || button.value || '');
    if (button && /send|submit|request/i.test(caption) && !/sending|processing|sent|received|thank/i.test(caption)) {
      if (button.tagName === 'INPUT') button.value = 'Get a callback';
      else button.textContent = 'Get a callback';
    }
    if (form.dataset.rhIntentForm === 'v3') { compactOptionalDetails(form); return; }
    form.dataset.rhShortForm = 'v2';
    form.dataset.rhIntentForm = 'v3';
    ['timeline', 'address', 'message'].forEach(function (name) {
      var control = form.querySelector('[name="' + name + '"]');
      if (!control) return;
      control.required = false;
      control.removeAttribute('required');
      control.setAttribute('aria-required', 'false');
      var label = control.labels && control.labels[0];
      if (label) {
        var firstText = Array.prototype.find.call(label.childNodes, function (node) {
          return node.nodeType === 3 && /\S/.test(node.nodeValue || '');
        });
        if (firstText && !/optional/i.test(firstText.nodeValue)) firstText.nodeValue = firstText.nodeValue.trim().replace(/\s*\*$/, '') + ' (optional)\n';
      }
    });
    var note = form.querySelector('.rh-callback-note') || document.createElement('p');
    note.className = 'rh-callback-note';
    note.textContent = 'Get a callback about your roof. Property details are optional.';
    if (!note.parentNode) form.insertBefore(note, form.firstChild);
    compactOptionalDetails(form);
  }

  function compactOptionalDetails(form) {
    var controls = ['timeline', 'address', 'message', 'serviceType', 'roofNeed'].map(function (name) { return form.querySelector('[name="' + name + '"]'); }).filter(function (control) { return control && !control.required && !control.hasAttribute('required'); });
    if (!controls.length) return;
    function safeGroup(node) {
      var fields = Array.prototype.slice.call(node.querySelectorAll('input:not([type="hidden"]), select, textarea'));
      return fields.length && fields.every(function (field) { return ['timeline', 'address', 'message', 'serviceType', 'roofNeed'].indexOf(field.name || field.getAttribute('name')) !== -1 && !field.required && !field.hasAttribute('required'); }) && !node.querySelector('button, input[type="submit"], iframe, [data-sitekey], [id*="turnstile"], [class*="turnstile"], [id*="captcha"], [class*="captcha"], [name="cf-turnstile-response"]');
    }
    controls.forEach(function (control) {
      var wrapper = control, parent = control.parentNode;
      if (parent && parent !== form) {
        var fields = parent.querySelectorAll('input:not([type="hidden"]), select, textarea');
        if (fields.length === 1 && safeGroup(parent)) wrapper = parent;
      }
      wrapper.classList.add('rh-optional-field');
      if (control.labels) Array.prototype.forEach.call(control.labels, function (label) { if (safeGroup(label)) label.classList.add('rh-optional-field'); });
    });
    form.setAttribute('data-rh-compact-callback', '');
    if (form.querySelector('.rh-property-disclosure')) return;
    var disclosure = document.createElement('details'); disclosure.className = 'rh-property-disclosure';
    var summary = document.createElement('summary'); summary.textContent = 'Add property details (optional)'; disclosure.appendChild(summary);
    form.dataset.rhDetailsOpen = 'false';
    disclosure.addEventListener('toggle', function () { form.dataset.rhDetailsOpen = disclosure.hasAttribute('open') ? 'true' : 'false'; });
    var submit = form.querySelector('button[type="submit"], input[type="submit"]');
    var before = submit;
    while (before && before.parentNode !== form) before = before.parentNode;
    if (before && !before.querySelector('[name="name"], [name="phone"], [name="email"]')) form.insertBefore(disclosure, before);
    else form.appendChild(disclosure);
  }

  function phoneLink() {
    var links = Array.prototype.slice.call(document.querySelectorAll('a[href^="tel:"]'));
    function valid(link) { var digits = (link.getAttribute('href') || '').replace(/\D/g, ''); return digits.length >= 10 && !/5555555/.test(digits); }
    var headers = 'header, [role="banner"], #masthead, #header, #site-header, .site-header, .main-header, .elementor-location-header';
    return links.find(function (link) { return valid(link) && link.closest(headers); }) || links.find(valid);
  }

  function visibleElement(element) {
    if (!element || !element.getBoundingClientRect || !window.getComputedStyle) return false;
    var rect = element.getBoundingClientRect(), style = window.getComputedStyle(element);
    if (element.checkVisibility && !element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    return rect.width >= 20 && rect.height >= 12 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function callbackAnchor() {
    var forms = Array.prototype.filter.call(document.querySelectorAll('form'), leadForm);
    var selected = forms.find(function (form) {
      return visibleElement(form) || visibleElement(form.querySelector('[name="phone"]'));
    });
    if (!selected && !window.getComputedStyle) selected = forms[0];
    var anchor = document.getElementById('roof-callback-form');
    if (selected) {
      if (!anchor) { anchor = document.createElement('div'); anchor.id = 'roof-callback-form'; anchor.style.scrollMarginTop = '120px'; }
      if (anchor.nextElementSibling !== selected) selected.parentNode.insertBefore(anchor, selected);
    } else if (anchor && anchor.tagName !== 'FORM') anchor.remove();
    var href = selected ? '#roof-callback-form' : '/contact#roof-callback-form';
    document.querySelectorAll('a[data-rh-callback]').forEach(function (link) {
      if (link.getAttribute('href') !== href) link.setAttribute('href', href);
      if (link.closest('.rh-growth-actions') && link.textContent !== 'Get a callback') link.textContent = 'Get a callback';
    });
    return href;
  }

  function mobileHeroActions() {
    if (!(window.innerWidth > 0 && window.innerWidth < 768) || !window.getComputedStyle) return;
    var existing = document.querySelector('.rh-mobile-intent-actions');
    if (/^\/(?:contact(?:-us)?(?:\.html)?|privacy[^/]*|terms[^/]*|thank-you|404)\/?$/i.test(location.pathname)) {
      if (existing) existing.remove();
      return;
    }
    var headers = 'header, [role="banner"], #masthead, #header, #site-header, .site-header, .main-header, .elementor-location-header';
    var heading = Array.prototype.find.call(document.querySelectorAll('h1'), function (candidate) {
      var hero = candidate.closest('.page-title-wrap, .hero, .hero-section, [data-hero], .home-hero, .hero-content');
      var header = candidate.closest(headers);
      var navigation = candidate.closest('nav, [role="navigation"], .site-logo, .site-title, .brand, .logo');
      return !navigation && (!header || hero) && candidate.textContent.trim() && visibleElement(candidate);
    });
    var source = phoneLink();
    if (!heading || !source) return;
    var rect = heading.getBoundingClientRect(), computed = window.getComputedStyle(heading);
    var fontSize = parseFloat(computed.fontSize) || 40;
    var viewport = window.innerHeight || 800;
    var target = Math.min(44, fontSize);
    var maxHeight = Math.max(112, Math.min(210, viewport * .3));
    if (rect.height > maxHeight) target = Math.min(target, Math.max(30, fontSize * maxHeight / rect.height));
    heading.classList.add('rh-mobile-intent-heading');
    var size = Math.round(target) + 'px';
    if (heading.style.getPropertyValue('--rh-mobile-h1-size') !== size) heading.style.setProperty('--rh-mobile-h1-size', size);
    heading.querySelectorAll('span, strong, em, b').forEach(function (child) {
      if ((parseFloat(window.getComputedStyle(child).fontSize) || 0) > target + .5) child.classList.add('rh-mobile-intent-large-type');
    });
    var scope = heading.closest('section, main, article, [data-hero], .hero, .hero-section') || heading.parentNode;
    var aboveFoldCall = Array.prototype.find.call(scope.querySelectorAll('a[href^="tel:"]'), function (link) {
      if (link.closest('.rh-growth-actions, .rh-mobile-intent-actions') || !visibleElement(link)) return false;
      var box = link.getBoundingClientRect();
      return box.width >= 96 && box.height >= 40 && box.top >= rect.top && box.bottom <= viewport - 76;
    });
    if (aboveFoldCall) {
      heading.setAttribute('data-rh-mobile-intent', 'existing-call');
      aboveFoldCall.setAttribute('data-rh-placement', 'mobile-hero');
      if (existing) existing.remove();
      scope.querySelectorAll('.rh-mobile-redundant-contact').forEach(function (link) { link.classList.remove('rh-mobile-redundant-contact'); });
      return;
    }
    heading.setAttribute('data-rh-mobile-intent', 'call-and-callback');
    if (existing && existing.previousElementSibling === heading) return;
    if (existing) existing.remove();
    var panel = document.createElement('div');
    panel.className = 'rh-mobile-intent-actions';
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', 'Roofing contact options');
    panel.setAttribute('data-rh-placement', 'mobile-hero');
    if (computed.textAlign === 'center') { panel.style.marginLeft = 'auto'; panel.style.marginRight = 'auto'; }
    else if (computed.textAlign === 'right') panel.style.marginLeft = 'auto';
    var bar = document.querySelector('.rh-growth-actions');
    ['--rh-action-bg', '--rh-action-text'].forEach(function (name) {
      var value = bar && bar.style.getPropertyValue(name);
      if (value) panel.style.setProperty(name, value);
    });
    var call = document.createElement('a'); call.href = source.getAttribute('href'); call.textContent = 'Call now';
    var callback = document.createElement('a'); callback.href = callbackAnchor(); callback.textContent = 'Get a callback'; callback.setAttribute('data-rh-callback', '');
    panel.appendChild(call); panel.appendChild(callback);
    heading.parentNode.insertBefore(panel, heading.nextSibling);
    scope.querySelectorAll('a[href]').forEach(function (link) {
      if (link.closest('.rh-mobile-intent-actions, .rh-growth-actions') || !visibleElement(link)) return;
      var url;
      try { url = new URL(link.getAttribute('href'), location.href); } catch (_) { return; }
      var box = link.getBoundingClientRect();
      if (url.origin === location.origin && /^\/contact(?:-us)?\/?$/.test(url.pathname) && box.top >= rect.top && box.top <= rect.bottom + 350 && box.height >= 30) link.classList.add('rh-mobile-redundant-contact');
    });
  }

  function desktopHeaderPhone() {
    if (!window.getComputedStyle || window.innerWidth < 768) return;
    var headerSelector = 'header, [role="banner"], #masthead, #header, #site-header, .site-header, .main-header, .elementor-location-header';
    var header = Array.prototype.find.call(document.querySelectorAll(headerSelector), function (candidate) {
      var rect = candidate.getBoundingClientRect();
      var style = window.getComputedStyle(candidate);
      return rect.width >= 240 && rect.height >= 20 && style.display !== 'none' && style.visibility !== 'hidden';
    }) || document.querySelector(headerSelector);
    if (!header) return;
    var bounds = header.getBoundingClientRect();
    var links = Array.prototype.slice.call(document.querySelectorAll('a[href^="tel:"]'));
    var visible = links.some(function (link) {
      if (link.closest('.rh-growth-actions')) return false;
      var text = (link.innerText || link.textContent || '').replace(/\D/g, '');
      var rect = link.getBoundingClientRect();
      var style = window.getComputedStyle(link);
      return text.length >= 10 && rect.width >= 70 && rect.height >= 12 && rect.top >= bounds.top - 80 && rect.bottom <= bounds.bottom + 4 && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
    });
    if (visible || header.querySelector('.rh-desktop-header-phone')) return;
    var source = links.find(function (link) { var digits = (link.getAttribute('href') || '').replace(/\D/g, ''); return digits.length >= 10 && !/5555555/.test(digits); });
    if (!source) return;
    var digits = source.getAttribute('href').replace(/\D/g, '');
    var national = digits.length === 11 && digits.charAt(0) === '1' ? digits.slice(1) : digits;
    var label = national.length === 10 ? national.slice(0, 3) + '-' + national.slice(3, 6) + '-' + national.slice(6) : digits;
    var anchor = document.createElement('a');
    anchor.className = 'rh-desktop-header-phone';
    anchor.href = source.getAttribute('href');
    anchor.textContent = 'Call ' + label;
    anchor.setAttribute('data-rh-placement', 'header');
    var computed = window.getComputedStyle(header);
    var rgb = (computed.backgroundColor || '').match(/\d+(?:\.\d+)?/g);
    if (!rgb || computed.backgroundColor === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(computed.backgroundColor)) rgb = (window.getComputedStyle(document.body).backgroundColor || '').match(/\d+(?:\.\d+)?/g);
    var brightness = rgb && rgb.length >= 3 ? Number(rgb[0]) * .299 + Number(rgb[1]) * .587 + Number(rgb[2]) * .114 : 255;
    anchor.style.setProperty('--rh-header-phone-text', brightness < 145 ? '#ffffff' : '#173b4d');
    if (computed.position === 'static') header.classList.add('rh-header-phone-position');
    if (bounds.height < 110) {
      var padding = parseFloat(computed.paddingTop) || 0;
      header.style.setProperty('--rh-header-original-padding', padding + 'px');
      header.style.setProperty('--rh-header-original-height', bounds.height + 'px');
      header.classList.add('rh-header-phone-reserved-row');
      if (computed.position === 'fixed') {
        var existingPadding = document.body.style.getPropertyValue('--rh-header-body-padding');
        var bodyPadding = existingPadding ? parseFloat(existingPadding) || 0 : parseFloat(window.getComputedStyle(document.body).paddingTop) || 0;
        document.body.style.setProperty('--rh-header-body-padding', bodyPadding + 'px');
        document.body.classList.add('rh-header-fixed-offset');
      }
    }
    header.appendChild(anchor);
  }

  function mobileActions() {
    var phone = phoneLink();
    if (!phone) return;
    var bars = Array.prototype.slice.call(document.querySelectorAll('.rh-growth-actions'));
    var bar = bars.find(function (item) { return item.hasAttribute('data-rh-native-intent'); }) || bars[0] || document.createElement('nav');
    bars.forEach(function (item) { if (item !== bar && !item.hasAttribute('data-rh-native-intent')) item.remove(); });
    bar.className = 'rh-growth-actions';
    bar.setAttribute('aria-label', 'Contact options');
    bar.setAttribute('data-rh-placement', 'mobile-actions');
    var originalButton = document.querySelector('form button[type="submit"], form input[type="submit"]') || document.querySelector('.fgfll-visible-phone a');
    if (!originalButton && window.getComputedStyle) originalButton = Array.prototype.find.call(document.querySelectorAll('a[href]'), function (link) {
      if (link.closest('.rh-growth-actions, .rh-mobile-intent-actions') || !visibleElement(link)) return false;
      var href = link.getAttribute('href') || '', rect = link.getBoundingClientRect();
      return rect.width >= 96 && rect.height >= 32 && (/^tel:/i.test(href) || /\/contact(?:[-/]|$)/i.test(href)) && !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(window.getComputedStyle(link).backgroundColor);
    });
    if (originalButton && window.getComputedStyle) {
      var originalStyle = window.getComputedStyle(originalButton);
      var originalBackground = originalStyle.backgroundColor;
      if (/^(transparent|rgba\(0, 0, 0, 0\))$/.test(originalBackground) && originalButton.closest('.fgfll-visible-phone')) originalBackground = window.getComputedStyle(originalButton.closest('.fgfll-visible-phone')).backgroundColor;
      if (originalBackground && !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(originalBackground)) {
        bar.style.setProperty('--rh-action-bg', originalBackground);
        bar.style.setProperty('--rh-action-text', originalStyle.color);
      }
    }
    var call = bar.querySelector('a[href^="tel:"]') || document.createElement('a');
    call.href = phone.getAttribute('href');
    if (call.textContent !== 'Call now') call.textContent = 'Call now';
    var callback = bar.querySelector('a[data-rh-callback]') || document.createElement('a');
    callback.href = callbackAnchor();
    if (callback.textContent !== 'Get a callback') callback.textContent = 'Get a callback';
    callback.setAttribute('data-rh-callback', '');
    if (!call.parentNode) bar.appendChild(call);
    if (!callback.parentNode) bar.appendChild(callback);
    if (!bar.parentNode) document.body.appendChild(bar);
    document.body.classList.add('rh-has-growth-actions');
    if (bar.dataset.rhKeyboardReady) return;
    bar.dataset.rhKeyboardReady = 'true';
    function keyboard() {
      var active = document.activeElement;
      bar.hidden = !!(active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName));
    }
    document.addEventListener('focusin', keyboard);
    document.addEventListener('focusout', function () { setTimeout(keyboard, 0); });
  }

  function ready() {
    var style = document.getElementById('rh-growth-v2-style') || document.createElement('style');
    style.id = 'rh-growth-v2-style';
    style.textContent = '.rh-desktop-header-phone{display:none!important}@media(min-width:768px){.rh-header-phone-position{position:relative!important}.rh-header-phone-reserved-row{padding-top:calc(var(--rh-header-original-padding,0px) + 40px)!important;height:auto!important;min-height:calc(var(--rh-header-original-height,0px) + 40px)!important}.rh-desktop-header-phone{box-sizing:border-box;display:inline-flex!important;align-items:center;position:absolute!important;top:10px;right:clamp(20px,5vw,80px);z-index:5;min-height:28px;padding:2px 4px;color:var(--rh-header-phone-text,#173b4d)!important;background:transparent;font:inherit;font-size:16px!important;font-weight:700!important;line-height:1.4!important;letter-spacing:normal!important;text-transform:none!important;text-decoration:none!important;white-space:nowrap}.rh-desktop-header-phone:focus-visible{outline:2px solid currentColor;outline-offset:3px}body.rh-header-fixed-offset{padding-top:calc(var(--rh-header-body-padding,0px) + 40px)!important}}.rh-callback-note{grid-column:1/-1;font:inherit;font-size:.94em;line-height:1.5;margin:0 0 1rem}.rh-growth-actions{display:none!important}@media(max-width:767px){body.rh-has-growth-actions{padding-bottom:calc(68px + env(safe-area-inset-bottom,0px))}.rh-growth-actions:not([hidden]){box-sizing:border-box;display:grid!important;grid-template-columns:1fr 1.35fr;gap:8px;position:fixed;bottom:0;left:0;right:0;z-index:999;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));background:#fff;border-top:1px solid #d6dce0;box-shadow:0 -3px 14px #00000012}.rh-growth-actions a{display:flex;align-items:center;justify-content:center;min-height:44px;padding:0 10px;border:1px solid currentColor;border-radius:4px;font:inherit;font-size:14px;font-weight:700;line-height:1.25;text-decoration:none;color:#173b4d;background:#fff}.rh-growth-actions a:first-child{color:var(--rh-action-text,#fff);background:var(--rh-action-bg,#173b4d);border-color:var(--rh-action-bg,#173b4d)}.rh-growth-actions a:focus-visible{outline:3px solid #3783b4;outline-offset:2px}}';
    style.textContent += '.rh-property-disclosure{display:none}@media(max-width:767px){body.rh-has-growth-actions [class*="-visible-phone"],body.rh-has-growth-actions [data-rr-mobile-phone],body.rh-has-growth-actions [class*="-sticky-help"],body.rh-has-growth-actions [class*="-mobile-help"],body.rh-has-growth-actions [class*="-mobile-emergency"],body.rh-has-growth-actions a.rr-call{display:none!important}form[data-rh-compact-callback][data-rh-details-open="false"] .rh-optional-field{display:none!important}form[data-rh-compact-callback]{row-gap:12px!important}form[data-rh-compact-callback] .rh-callback-note{margin-bottom:4px}.rh-property-disclosure{display:block;grid-column:1/-1;width:100%;margin:0;font:inherit;font-size:14px}.rh-property-disclosure summary{cursor:pointer;min-height:44px;padding:10px 0;line-height:1.5;text-decoration:underline}.rh-property-disclosure summary:focus-visible{outline:2px solid currentColor;outline-offset:3px}form[data-rh-compact-callback] button[type="submit"],form[data-rh-compact-callback] input[type="submit"]{min-height:48px}}';
    style.textContent += '.rh-mobile-intent-actions{display:none!important}@media(max-width:767px){:root .rh-mobile-intent-heading.rh-mobile-intent-heading.rh-mobile-intent-heading{font-size:var(--rh-mobile-h1-size,44px)!important;line-height:1.1!important;margin-bottom:12px!important}:root .rh-mobile-intent-heading .rh-mobile-intent-large-type{font-size:inherit!important;line-height:inherit!important}.rh-mobile-intent-actions{box-sizing:border-box;display:grid!important;grid-template-columns:1fr 1.35fr;gap:8px;width:min(100%,420px);margin:14px 0 20px;position:relative;z-index:2}.rh-mobile-intent-actions a{box-sizing:border-box;display:flex!important;align-items:center;justify-content:center;min-height:48px;padding:10px 12px;border:1px solid #173b4d;border-radius:4px;font:inherit;font-size:16px!important;font-weight:700!important;line-height:1.25!important;letter-spacing:normal!important;text-transform:none!important;text-decoration:none!important;color:#173b4d!important;background:#fff!important}.rh-mobile-intent-actions a:first-child{color:var(--rh-action-text,#fff)!important;background:var(--rh-action-bg,#173b4d)!important;border-color:var(--rh-action-bg,#173b4d)}.rh-mobile-intent-actions a:focus-visible{outline:3px solid #3783b4;outline-offset:2px}.rh-mobile-redundant-contact{display:none!important}}';
    if (!style.parentNode) document.head.appendChild(style);
    document.querySelectorAll('form').forEach(shorten);
    callbackAnchor();
    mobileActions();
    desktopHeaderPhone();
    mobileHeroActions();
    window.addEventListener('resize', desktopHeaderPhone);
    window.addEventListener('resize', mobileHeroActions);
    document.addEventListener('animationend', mobileHeroActions, true);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(mobileHeroActions);
    setTimeout(mobileHeroActions, 600);
    setTimeout(mobileHeroActions, 1800);
    document.addEventListener('click', function (event) {
      var link = event.target && event.target.closest && event.target.closest('a[data-rh-callback]');
      if (!link || link.getAttribute('href') !== '#roof-callback-form') return;
      setTimeout(function () {
        var target = document.getElementById('roof-callback-form');
        var form = target && target.nextElementSibling;
        var input = leadForm(form) && form.querySelector('input[name="name"], input[name="phone"]');
        if (input && input.focus) input.focus({ preventScroll: true });
      }, 0);
    });
    if (location.hash === '#roof-callback-form') {
      var callbackTarget = document.getElementById('roof-callback-form');
      if (callbackTarget && callbackTarget.scrollIntoView) callbackTarget.scrollIntoView();
    }
    var refreshQueued = false;
    if (compactForms) new MutationObserver(function (mutations) {
      if (refreshQueued || !mutations.some(function (m) { return m.addedNodes.length; })) return;
      refreshQueued = true;
      setTimeout(function () {
        refreshQueued = false;
        document.querySelectorAll('form').forEach(shorten);
        callbackAnchor(); mobileActions(); desktopHeaderPhone(); mobileHeroActions();
      }, 100);
    }).observe(document.body, { childList: true, subtree: true });
    setTimeout(function () {
      if (window.vai || document.querySelector('script[src*="/_vercel/insights/script.js"]')) return;
      var script = document.createElement('script');
      script.defer = true;
      script.src = '/_vercel/insights/script.js';
      script.dataset.sdkn = 'rankhound-growth';
      document.head.appendChild(script);
    }, 1500);
  }
  if (document.readyState === 'loading' && !document.body) document.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
  }
  if (document.documentElement.hasAttribute('data-rh-growth-react') && !window.__rankhoundGrowthHydrated) {
    document.addEventListener('rankhound:hydrated', start, { once: true });
  } else start();
})();
