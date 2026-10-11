/* adam-pnu host bootstrap — sheet data renders in-page (no iframes).
   JSON fallback: this site's /data/. Image paths assets/… → widgets Pages CDN.
   adam-lab-widgets itself is not modified; Sites keeps embedding it. */
(function () {
  "use strict";
  window.ADAM_SITE = true;
  var path = location.pathname || "/";
  var base = path.indexOf("/adam-pnu") === 0 ? "/adam-pnu/"
    : path.indexOf("/adam-lab") === 0 ? "/adam-lab/"
    : "/";
  window.ADAM_SITE_BASE = base;
  window.ADAM_ROOT = new URL(base, location.origin).href;
  window.ADAM_ASSET_ROOT = "https://soonjokwon.github.io/adam-lab-widgets/";
  document.documentElement.classList.add("adam-site");
})();
