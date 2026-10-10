(function () {
  "use strict";

  var path = location.pathname || "/";
  var BASE = path.indexOf("/adam-lab-site") === 0 ? "/adam-lab-site/" : "/";
  window.ADAM_SITE_BASE = BASE;

  var WIDGETS = "https://soonjokwon.github.io/adam-lab-widgets";

  function joinBase(rel) {
    if (!rel || rel.charAt(0) === "#" || /^https?:/i.test(rel)) return rel;
    return BASE.replace(/\/?$/, "/") + String(rel).replace(/^\//, "");
  }

  /* ---------- Nav active state ---------- */
  function markNav() {
    var links = document.querySelectorAll(".nav a[href]");
    var here = path.replace(/\/index\.html$/, "/");
    if (here.length > 1 && !here.endsWith("/")) here += "/";
    var best = null;
    var bestLen = -1;
    links.forEach(function (a) {
      a.removeAttribute("aria-current");
      var abs = new URL(a.getAttribute("href") || "", location.href).pathname
        .replace(/\/index\.html$/, "/");
      if (abs.length > 1 && !abs.endsWith("/")) abs += "/";
      if (here === abs || (abs !== BASE && here.indexOf(abs) === 0)) {
        if (abs.length > bestLen) {
          best = a;
          bestLen = abs.length;
        }
      }
    });
    if (best) best.setAttribute("aria-current", "page");
  }


  function bindTeamMenu() {
    document.querySelectorAll(".nav-group").forEach(function (g) {
      var top = g.querySelector(":scope > a");
      if (!top) return;
      top.addEventListener("click", function (e) {
        if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
        if (!g.classList.contains("is-open")) {
          e.preventDefault();
          document.querySelectorAll(".nav-group.is-open").forEach(function (o) {
            if (o !== g) o.classList.remove("is-open");
          });
          g.classList.add("is-open");
        }
      });
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".nav-group")) {
        document.querySelectorAll(".nav-group.is-open").forEach(function (o) {
          o.classList.remove("is-open");
        });
      }
    });
  }

  /* ---------- Mobile nav ---------- */
  function bindNavToggle() {
    var btn = document.querySelector(".nav-toggle");
    var header = document.querySelector(".site-header");
    if (!btn || !header) return;
    btn.addEventListener("click", function () {
      var open = header.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(open));
    });
  }

  /* ---------- Widget embeds: height via postMessage ---------- */
  var embeds = new Map();

  function bindEmbeds() {
    document.querySelectorAll(".embed[data-widget]").forEach(function (box) {
      var pathPart = box.getAttribute("data-widget");
      var minH = parseInt(box.getAttribute("data-min-height") || "320", 10);
      var title = box.getAttribute("data-title") || "ADAM Lab widget";
      var src = WIDGETS + pathPart;
      var iframe = document.createElement("iframe");
      iframe.src = src;
      iframe.title = title;
      iframe.loading = "lazy";
      iframe.referrerPolicy = "no-referrer-when-downgrade";
      iframe.style.height = minH + "px";
      iframe.setAttribute("data-min-height", String(minH));
      box.insertBefore(iframe, box.firstChild);

      var tools = document.createElement("div");
      tools.className = "embed__tools";
      var open = document.createElement("a");
      open.href = src + (src.indexOf("?") >= 0 ? "&" : "?") + "full=1";
      open.target = "_blank";
      open.rel = "noopener";
      open.textContent = "전체 화면으로 보기 ↗";
      tools.appendChild(open);
      box.appendChild(tools);

      embeds.set(iframe, { minH: minH, box: box });
    });
  }

  function onMessage(ev) {
    var data = ev.data;
    if (!data || typeof data !== "object") return;
    if (data.type !== "adam-widget-height") return;
    var h = Number(data.height);
    if (!isFinite(h) || h < 80) return;
    var frames = document.querySelectorAll(".embed iframe");
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i];
      if (f.contentWindow === ev.source) {
        var meta = embeds.get(f) || { minH: 200 };
        var next = Math.max(meta.minH, Math.ceil(h) + 4);
        if (Math.abs((parseInt(f.style.height, 10) || 0) - next) > 2) {
          f.style.height = next + "px";
        }
        break;
      }
    }
  }

  /* ---------- Pillars carousel ---------- */
  function bindCarousel() {
    var root = document.querySelector("[data-carousel]");
    if (!root) return;
    var slides = Array.prototype.slice.call(root.querySelectorAll(".carousel__slide"));
    if (!slides.length) return;
    var dots = root.querySelector(".carousel__dots");
    var i = 0;
    var timer;

    function show(n) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, idx) {
        s.classList.toggle("is-active", idx === i);
      });
      if (dots) {
        Array.prototype.forEach.call(dots.children, function (b, idx) {
          b.setAttribute("aria-current", idx === i ? "true" : "false");
        });
      }
    }

    if (dots) {
      slides.forEach(function (_, idx) {
        var b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", "Slide " + (idx + 1));
        b.addEventListener("click", function () {
          show(idx);
          restart();
        });
        dots.appendChild(b);
      });
    }

    function restart() {
      clearInterval(timer);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      timer = setInterval(function () { show(i + 1); }, 3800);
    }

    show(0);
    restart();
  }

  /* ---------- Footer year ---------- */
  function stampYear() {
    var el = document.querySelector("[data-year]");
    if (el) el.textContent = String(new Date().getFullYear());
  }

  document.addEventListener("DOMContentLoaded", function () {
    markNav();
    bindNavToggle();
    bindTeamMenu();
    bindEmbeds();
    bindCarousel();
    stampYear();
  });
  window.addEventListener("message", onMessage);

  /* expose for debugging */
  window.ADAM_SITE = { base: BASE, widgets: WIDGETS, joinBase: joinBase };
})();
