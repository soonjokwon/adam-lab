(function () {
  "use strict";

  var path = location.pathname || "/";
  var BASE = path.indexOf("/adam-lab") === 0 ? "/adam-lab/" : "/";
  window.ADAM_SITE_BASE = BASE;

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
      var btn = g.querySelector(".nav-chevron");
      if (!btn) return;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var open = !g.classList.contains("is-open");
        document.querySelectorAll(".nav-group.is-open").forEach(function (o) {
          o.classList.remove("is-open");
          var b = o.querySelector(".nav-chevron");
          if (b) b.setAttribute("aria-expanded", "false");
        });
        g.classList.toggle("is-open", open);
        btn.setAttribute("aria-expanded", String(open));
      });
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".nav-group")) {
        document.querySelectorAll(".nav-group.is-open").forEach(function (o) {
          o.classList.remove("is-open");
          var b = o.querySelector(".nav-chevron");
          if (b) b.setAttribute("aria-expanded", "false");
        });
      }
    });
  }

  function bindNavToggle() {
    var btn = document.querySelector(".nav-toggle");
    var header = document.querySelector(".site-header");
    if (!btn || !header) return;
    btn.addEventListener("click", function () {
      var open = header.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(open));
    });
  }

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

  function stampYear() {
    var el = document.querySelector("[data-year]");
    if (el) el.textContent = String(new Date().getFullYear());
  }

  document.addEventListener("DOMContentLoaded", function () {
    markNav();
    bindNavToggle();
    bindTeamMenu();
    bindCarousel();
    stampYear();
  });
})();
