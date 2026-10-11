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

  var KIND_LB = {
    page: "Page", news: "News", publication: "Paper", patent: "Patent",
    award: "Award", project: "Project", member: "Member", talk: "Talk",
    photo: "Photo", section: "Text"
  };

  function bindSearch() {
    var overlay = document.getElementById("site-search");
    var toggles = document.querySelectorAll(".search-toggle");
    if (!overlay || !toggles.length) return;
    var input = overlay.querySelector(".site-search__input");
    var results = overlay.querySelector(".site-search__results");
    var closeBtn = overlay.querySelector(".site-search__close");
    var form = overlay.querySelector(".site-search__form");
    var index = Array.isArray(window.ADAM_SEARCH_INDEX) ? window.ADAM_SEARCH_INDEX.slice() : [];

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
      if (!q) return item.kind === "page" ? 1 : 0;
      var hay = (item.title + " " + item.blurb + " " + (item.keywords || "")).toLowerCase();
      var tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
      if (!tokens.length) return 0;
      var s = 0;
      for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i];
        if (item.title.toLowerCase().indexOf(t) !== -1) s += 6;
        else if (hay.indexOf(t) !== -1) s += 2;
        else return 0;
      }
      if (item.kind === "page") s += 1;
      return s;
    }
    function render(q) {
      if (!results) return;
      results.innerHTML = "";
      var qq = String(q || "").trim();
      if (!index.length) {
        var miss = document.createElement("p");
        miss.className = "site-search__empty";
        miss.textContent = "Search index is loading…";
        results.appendChild(miss);
        return;
      }
      var hits = index
        .map(function (item) { return { item: item, s: score(item, qq) }; })
        .filter(function (x) { return x.s > 0; })
        .sort(function (a, b) { return b.s - a.s || (a.item.title || "").localeCompare(b.item.title || ""); });
      if (!hits.length) {
        var empty = document.createElement("p");
        empty.className = "site-search__empty";
        empty.textContent = qq
          ? "“" + qq + "”에 대한 결과가 없습니다. 다른 키워드를 입력해 보세요."
          : "뉴스·논문·수상·과제·구성원 등을 검색하세요.";
        results.appendChild(empty);
        return;
      }
      hits.slice(0, 24).forEach(function (hit) {
        var a = document.createElement("a");
        a.className = "site-search__hit";
        var href = joinBase(hit.item.path);
        if (hit.item.anchor) {
          /* Keep fragment readable; encode only characters that break URLs. */
          href += "#" + String(hit.item.anchor).replace(/[^\w\uac00-\ud7a3\-]/g, function (ch) {
            return encodeURIComponent(ch);
          });
        }
        a.href = href;
        a.setAttribute("role", "option");
        var kind = KIND_LB[hit.item.kind] || hit.item.kind || "Result";
        a.innerHTML = "<span class=\"site-search__kind\"></span><strong></strong><span class=\"site-search__blurb\"></span>";
        a.querySelector(".site-search__kind").textContent = kind;
        a.querySelector("strong").textContent = hit.item.title;
        a.querySelector(".site-search__blurb").textContent = hit.item.blurb || "";
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

  function bindSearchTarget() {
    /* Avoid the browser jumping to a missing/empty hash before widgets mount. */
    try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch (err) {}

    var MOUNT_ONLY = {
      "adam-news": 1, "adam-newslist": 1, "adam-publications": 1, "adam-members": 1,
      "adam-gallery": 1, "adam-projects": 1, "adam-awards": 1, "adam-patents": 1,
      "adam-talks": 1, "adam-sections": 1
    };

    var id = "";
    var tries = 0;
    var maxTries = 80;
    var timer = null;
    var done = false;

    function decodeHash() {
      var raw = (location.hash || "").replace(/^#/, "");
      if (!raw) return "";
      try { return decodeURIComponent(raw); } catch (err) { return raw; }
    }

    function forceReveal(el) {
      var node = el;
      while (node && node !== document.documentElement) {
        if (node.classList && node.classList.contains("reveal")) node.classList.add("is-in");
        node = node.parentElement;
      }
    }

    function findTarget(targetId) {
      if (!targetId || targetId.indexOf("adam-") !== 0) return null;
      /* Never treat empty widget mounts as the hit — wait for the real row/card. */
      if (MOUNT_ONLY[targetId]) return null;
      var el = document.getElementById(targetId);
      if (!el) {
        try {
          el = document.querySelector('[data-adam-key="' + targetId.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"]');
        } catch (err) {
          el = null;
        }
      }
      if (!el || !el.isConnected) return null;
      if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true") return null;
      if (el.closest("[hidden]")) return null;
      /* Skeletons / empty shells are not ready targets */
      if (el.classList.contains("ax-skel") || el.classList.contains("adam-state")) return null;
      if (el.classList.contains("news-skel") || el.classList.contains("news-empty")) return null;
      forceReveal(el);
      var r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return null;
      return el;
    }

    function highlight(el) {
      if (!el || done) return;
      done = true;
      forceReveal(el);
      el.classList.add("is-search-hit");
      try {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (err) {
        el.scrollIntoView(true);
      }
      /* Second pass after layout/images settle — avoid stopping on blank gap */
      setTimeout(function () {
        forceReveal(el);
        try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e2) { el.scrollIntoView(true); }
      }, 160);
      setTimeout(function () { el.classList.remove("is-search-hit"); }, 2800);
    }

    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    function tick() {
      tries += 1;
      var el = findTarget(id);
      if (el) {
        stop();
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { highlight(el); });
        });
        return;
      }
      if (tries >= maxTries) stop();
    }

    function startForHash() {
      id = decodeHash();
      done = false;
      tries = 0;
      stop();
      if (!id || id.indexOf("adam-") !== 0) return;
      /* Stay put until a real mounted item exists — do not scroll to blank page chrome. */
      tick();
      timer = setInterval(tick, 120);
    }

    startForHash();
    window.addEventListener("hashchange", startForHash);
    window.addEventListener("adam:mounted", function () {
      if (done || !id) return;
      var el = findTarget(id);
      if (el) {
        stop();
        requestAnimationFrame(function () { highlight(el); });
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    markNav();
    bindNavToggle();
    bindCarousel();
    bindReveal();
    bindSearch();
    bindSearchTarget();
  });
})();
