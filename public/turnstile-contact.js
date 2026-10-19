(function () {
  var seen = new WeakSet();
  var siteKeyPromise;
  var scriptPromise;
  function candidate(form) {
    var action;
    try { action = new URL(form.action || location.href, location.href); } catch (_) { return false; }
    if (action.origin !== location.origin || !/^\/api\/(contact|submit)\/?$/.test(action.pathname)) return false;
    return !!form.querySelector('[name="email"]') && !!form.querySelector('[name="phone"]');
  }
  function siteKey() {
    if (!siteKeyPromise) siteKeyPromise = fetch('/api/turnstile/config', { cache: 'no-store' })
      .then(function (response) {
        if (response.status === 404) return fetch('/api/turnstile-config', { cache: 'no-store' });
        return response;
      })
      .then(function (response) { if (!response.ok) throw new Error('config'); return response.json(); })
      .then(function (data) { if (!data.siteKey) throw new Error('site key'); return data.siteKey; });
    return siteKeyPromise;
  }
  function loader() {
    if (!scriptPromise) scriptPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = function () { window.turnstile ? resolve(window.turnstile) : reject(new Error('widget')); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return scriptPromise;
  }
  function showSuccess(form, message) {
    var wrap = document.createElement('div');
    wrap.className = 'rr-form-success';
    wrap.setAttribute('role', 'status');
    wrap.style.cssText = 'padding:24px;border:1px solid #bfe3c4;border-radius:10px;background:#f0f9f1;color:#1b5e20;font-family:inherit;';
    var heading = document.createElement('p');
    heading.style.cssText = 'margin:0 0 8px;font-size:1.2em;font-weight:700;line-height:1.3;';
    heading.textContent = 'Thank you!';
    var body = document.createElement('p');
    body.style.cssText = 'margin:0;line-height:1.5;font-size:1em;';
    body.textContent = message || 'Your request has been received. Our team will follow up shortly.';
    wrap.appendChild(heading);
    wrap.appendChild(body);
    form.replaceWith(wrap);
    wrap.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function protect(form) {
    if (seen.has(form) || !candidate(form)) return;
    seen.add(form);
    var submit = form.querySelector('button[type="submit"],input[type="submit"]');
    var host = document.createElement('div');
    var status = document.createElement('p');
    var token = document.createElement('input');
    host.className = 'rr-turnstile';
    status.className = 'rr-turnstile-status';
    status.setAttribute('role', 'status');
    status.style.cssText = 'margin:8px 0 0;font-size:0.92em;';
    token.type = 'hidden';
    token.name = 'turnstileToken';
    if (submit && submit.parentNode) submit.parentNode.insertBefore(host, submit);
    else form.appendChild(host);
    host.insertAdjacentElement('afterend', status);
    form.appendChild(token);

    var requireToken = true;
    var sending = false;
    if (submit) submit.disabled = true;
    status.textContent = 'Loading verification…';

    function send() {
      if (sending) return;
      sending = true;
      if (submit) submit.disabled = true;
      status.style.color = '';
      status.textContent = 'Sending…';
      var data = new URLSearchParams();
      new FormData(form).forEach(function (value, key) { if (typeof value === 'string') data.append(key, value); });
      fetch(form.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
        .then(function (response) {
          return response.json().catch(function () { return {}; }).then(function (payload) {
            return { ok: response.ok, payload: payload };
          });
        })
        .then(function (result) {
          if (result.ok && result.payload && (result.payload.ok || result.payload.success)) {
            showSuccess(form, result.payload.message);
            return;
          }
          sending = false;
          status.style.color = '#b91c1c';
          status.textContent = (result.payload && (result.payload.message || result.payload.error)) || 'Something went wrong. Please try again or call us directly.';
          if (submit) submit.disabled = false;
          if (requireToken) {
            token.value = '';
            if (window.turnstile) { try { window.turnstile.reset(); } catch (_) {} }
            if (submit) submit.disabled = true;
          }
        })
        .catch(function () {
          sending = false;
          status.style.color = '#b91c1c';
          status.textContent = 'We could not submit your request right now. Please call us directly.';
          if (submit) submit.disabled = false;
        });
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!form.reportValidity()) return;
      if (requireToken && !token.value) {
        status.textContent = 'Please complete the security check and try again.';
        if (submit) submit.disabled = true;
        return;
      }
      send();
    }, true);

    Promise.all([siteKey(), loader()]).then(function (values) {
      requireToken = true;
      if (submit) submit.disabled = true;
      values[1].render(host, {
        sitekey: values[0],
        action: 'contact',
        callback: function (value) {
          token.value = typeof value === 'string' ? value : '';
          if (!token.value) return;
          status.textContent = '';
          if (submit) submit.disabled = false;
        },
        'expired-callback': function () {
          token.value = '';
          status.textContent = 'Security check expired. Please verify again.';
          if (submit) submit.disabled = true;
        },
        'error-callback': function () {
          token.value = '';
          status.textContent = 'Security check failed. Please try again or call us.';
          if (submit) submit.disabled = true;
        }
      });
      status.textContent = '';
    }).catch(function () {
      requireToken = true;
      status.textContent = 'Verification could not load. Please reload this page or call us directly.';
      if (submit) submit.disabled = true;
    });
  }
  function scan() { document.querySelectorAll('form').forEach(protect); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true });
  else scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();
