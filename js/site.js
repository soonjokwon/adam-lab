(function () {
  "use strict";

  var path = location.pathname || "/";
  var BASE = path.indexOf("/adam-lab") === 0 ? "/adam-lab/" : "/";
  window.ADAM_SITE_BASE = BASE;

  function joinBase(rel) {
    if (!rel || /^https?:/i.test(rel)) return rel;
    return BASE.replace(/\/?$/, "/") + String(rel).replace(/^\//, "");
  }

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
      timer = setInterval(function () { show(i + 1); }, 4200);
    }

    show(0);
    restart();
  }

  function bindReveal() {
    var nodes = document.querySelectorAll(".reveal");
    if (!nodes.length) return;
    if (!("IntersectionObserver" in window) ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach(function (n) { n.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("is-in");
        io.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    nodes.forEach(function (n) { io.observe(n); });
  }

  function bindSearch() {
    var overlay = document.getElementById("site-search");
    var toggles = document.querySelectorAll(".search-toggle");
    if (!overlay || !toggles.length) return;
    var input = overlay.querySelector(".site-search__input");
    var results = overlay.querySelector(".site-search__results");
    var closeBtn = overlay.querySelector(".site-search__close");
    var form = overlay.querySelector(".site-search__form");
    var index = window.ADAM_SEARCH_INDEX || [];

    function open() {
      overlay.hidden = false;
      document.body.classList.add("search-open");
      toggles.forEach(function (t) { t.setAttribute("aria-expanded", "true"); });
      setTimeout(function () { if (input) input.focus(); }, 10);
      render(input ? input.value : "");
    }
    function close() {
      overlay.hidden = true;
      document.body.classList.remove("search-open");
      toggles.forEach(function (t) { t.setAttribute("aria-expanded", "false"); });
    }
    function score(item, q) {
      if (!q) return 0;
      var hay = (item.title + " " + item.blurb + " " + (item.keywords || "")).toLowerCase();
      var tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
      var s = 0;
      tokens.forEach(function (t) {
        if (item.title.toLowerCase().indexOf(t) !== -1) s += 5;
        if (hay.indexOf(t) !== -1) s += 2;
      });
      return s;
    }
    function render(q) {
      if (!results) return;
      results.innerHTML = "";
      var qq = String(q || "").trim();
      var hits = index
        .map(function (item) { return { item: item, s: score(item, qq) }; })
        .filter(function (x) { return qq ? x.s > 0 : true; })
        .sort(function (a, b) { return b.s - a.s; });
      if (!hits.length) {
        var empty = document.createElement("p");
        empty.className = "site-search__empty";
        empty.textContent = qq ? "No results for “" + qq + "”." : "Type to search pages.";
        results.appendChild(empty);
        return;
      }
      hits.slice(0, 8).forEach(function (hit) {
        var a = document.createElement("a");
        a.className = "site-search__hit";
        a.href = joinBase(hit.item.path);
        a.setAttribute("role", "option");
        a.innerHTML = "<strong></strong><span></span>";
        a.querySelector("strong").textContent = hit.item.title;
        a.querySelector("span").textContent = hit.item.blurb;
        results.appendChild(a);
      });
    }

    toggles.forEach(function (t) {
      t.addEventListener("click", function () {
        if (overlay.hidden) open(); else close();
      });
    });
    if (closeBtn) closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !overlay.hidden) close();
    });
    if (input) {
      input.addEventListener("input", function () { render(input.value); });
    }
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var first = results && results.querySelector(".site-search__hit");
        if (first) location.href = first.href;
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    markNav();
    bindNavToggle();
    bindCarousel();
    bindReveal();
    bindSearch();
  });
})();
