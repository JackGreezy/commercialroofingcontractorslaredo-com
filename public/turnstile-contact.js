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
    status.textContent = 'Loading security check…';
    token.type = 'hidden';
    token.name = 'turnstileToken';
    if (submit && submit.parentNode) submit.parentNode.insertBefore(host, submit);
    else form.appendChild(host);
    host.insertAdjacentElement('afterend', status);
    form.appendChild(token);
    if (submit) submit.disabled = true;
    form.addEventListener('submit', function (event) {
      if (token.value) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      status.textContent = 'Please complete the security check and try again.';
      if (submit) submit.disabled = true;
    }, true);
    Promise.all([siteKey(), loader()]).then(function (values) {
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
      status.textContent = 'Security check is unavailable. Please call us directly.';
    });
  }
  function scan() { document.querySelectorAll('form').forEach(protect); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true });
  else scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();
