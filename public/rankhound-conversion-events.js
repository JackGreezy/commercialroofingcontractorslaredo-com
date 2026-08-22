(function () {
  if (window.__rankhoundConversionEvents) return;
  window.__rankhoundConversionEvents = true;
  window.va = window.va || function () {
    (window.vaq = window.vaq || []).push(arguments);
  };

  if (!document.querySelector('script[src="/_vercel/insights/script.js"]')) {
    var analytics = document.createElement("script");
    analytics.defer = true;
    analytics.src = "/_vercel/insights/script.js";
    analytics.dataset.sdkn = "@vercel/analytics/next";
    analytics.dataset.sdkv = "2.0.1";
    document.head.appendChild(analytics);
  }

  function send(name) {
    window.va("event", {
      name: name,
      data: { path: window.location.pathname || "/" }
    });
  }

  document.addEventListener("click", function (event) {
    var target = event.target && event.target.closest
      ? event.target.closest('a[href^="tel:"],a[href^="mailto:"]')
      : null;
    if (!target) return;
    var href = target.getAttribute("href") || "";
    send(href.indexOf("tel:") === 0 ? "lead_phone_click" : "lead_email_click");
  }, true);

  document.addEventListener("submit", function (event) {
    if (event.target && event.target.tagName === "FORM") send("lead_form_submit");
  }, true);
})();
