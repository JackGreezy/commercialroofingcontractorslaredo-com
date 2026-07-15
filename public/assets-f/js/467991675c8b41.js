function createSnippet(scriptToLoad) {
  const {src, attachName} = scriptToLoad;
  const tag = document.createElement('script');
  tag.src = decodeURI(src);
  if (attachName) {
    const intervalId = setInterval(() => {
      if (Drupal.behaviors[attachName]) {
        Drupal.behaviors[attachName].attach(document, drupalSettings);
        clearInterval(intervalId);
      }
    }, 100);
  }
  document.body.appendChild(tag);
}
window.euCookieComplianceLoadScripts = function(category) {
  const unverifiedScripts = drupalSettings.eu_cookie_compliance.unverified_scripts;
  const scriptList = [{"src":"https://www.googletagmanager.com/gtag/js?id=UA-37747480-1"},{"src":"https://secure.leadforensics.com/js/106533.js"}];

  scriptList.forEach(scriptToLoad => {
    const {src, categoryName} = scriptToLoad;
    if (!unverifiedScripts.includes(src)) {
      if (!category && !categoryName) {
        // Load scripts without any categories specified.
        createSnippet(scriptToLoad);
      } else if (categoryName === category) {
        // Load scripts for the specific category.
        createSnippet(scriptToLoad);
      }
    }
  });
}