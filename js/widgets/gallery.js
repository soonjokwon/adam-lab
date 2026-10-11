/* Photo gallery — sheet tab `gallery`. Columns: date,caption,image,group,link
   image: repo path (assets/gallery/…, recommended) or a public image URL / Google Drive share link (unofficial).
   Repo photos get a 480px 4:3 thumbnail (assets/gallery/thumbs/<name>-480.jpg, scripts/make_thumbs.py).
   Same topic in the same year (caption+year+lab) renders as one Sites-style carousel card.
   Grid is newest-first. URL params: ?group=PNU|KIT · ?photo=photo-03 (open that photo)
   Lightbox: image fitted into the space left by the top bar and caption. */
(function () {
  var A = window.ADAM, el = A.el;
  var mount = document.getElementById("adam-gallery");
  if (!mount) return;
  var GROUP = { PNU: "ADAM Lab@PNU", KIT: "DADI Lab@KIT" };
  var IG = window.ADAM_INSTAGRAM_URL ||
    "https://www.instagram.com/pnu_adam_lab?stkn=eWJlOHk4cHp6MDVt&utm_source=qr";
  var state = { items: [], group: (A.params.get("group") || "all").toUpperCase(), open: -1, shown: [], albums: [] };
  if (state.group === "ALL") state.group = "all";
  var refs = {};
  var ICON = {
    prev: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M10.2 2.4 4.6 8l5.6 5.6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    next: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M5.8 2.4 11.4 8l-5.6 5.6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    full: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5M6.5 3.5h-4v10h10v-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    close: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="m3 3 10 10M13 3 3 13" stroke="currentColor" stroke-width="1.6"/></svg>',
    ig: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/></svg>'
  };

  function thumbOf(url) {
    var m = String(url).match(/^(.*\/assets\/gallery\/)([\w.-]+?)\.(jpe?g|png|webp)$/i);
    return m ? m[1] + "thumbs/" + m[2] + "-480.jpg" : "";
  }

  var T = A.track("gallery");
  function normalize(rows) {
    var out = [];
    T.reset();
    rows.forEach(function (r, i) {
      var img = A.asset(r.image), date = A.normalizeDate(r.date);
      if (!img) { T.drop(i, "image '" + (r.image || "") + "' 비어 있거나 주소가 아님"); return; }
      if (r.date && !date) T.warn(i, "date '" + r.date + "' 날짜로 못 읽음");
      var group = String(r.group || "").trim().toUpperCase();
      if (group && !GROUP[group]) T.warn(i, "group '" + r.group + "' 은 PNU/KIT가 아님 → 그대로 표시");
      if (/drive\.google\.com/.test(r.image || "")) T.warn(i, "Google Drive 사진(비공식 지원) — 저장소 assets/gallery 권장");
      out.push({ date: date, caption: r.caption || "", image: img, thumb: thumbOf(img), group: group, link: A.safeUrl(r.link), order: i });
    });
    out.sort(function (a, b) { return a.date === b.date ? a.order - b.order : (a.date < b.date ? 1 : -1); });
    T.done(out.length);
    return out;
  }

  function albumKey(it) {
    var y = it.date ? it.date.slice(0, 4) : "";
    return (it.caption || "").trim() + "\0" + y + "\0" + (it.group || "");
  }

  function toAlbums(items) {
    var map = {}, order = [];
    items.forEach(function (it) {
      var k = albumKey(it);
      if (!map[k]) {
        map[k] = {
          key: k,
          caption: it.caption || "",
          year: it.date ? it.date.slice(0, 4) : "",
          group: it.group,
          date: it.date,
          slides: [],
          slide: 0
        };
        order.push(k);
      }
      var alb = map[k];
      alb.slides.push(it);
      if (it.date && (!alb.date || it.date > alb.date)) alb.date = it.date;
    });
    return order.map(function (k) { return map[k]; });
  }

  function shell() {
    mount.innerHTML = "";
    refs.chips = el("div", { class: "ax-chips", role: "group", "aria-label": "앨범" });
    refs.count = el("span", { class: "ax-count", "aria-live": "polite" });
    refs.ig = el("a", {
      class: "gl-ig",
      href: IG,
      target: "_blank",
      rel: "noopener",
      title: "ADAM Lab Instagram",
      "aria-label": "ADAM Lab Instagram"
    });
    refs.ig.innerHTML = ICON.ig;
    refs.grid = el("div", { class: "gl-grid" });
    var root = el("div", { class: "ax-root gl" }, [
      el("div", { class: "ax-bar" }, [refs.chips, el("span", { class: "ax-grow" }), refs.ig, refs.count]),
      refs.grid
    ]);
    mount.appendChild(root);
    A.phone(root, { title: "사진 Photos" });
    for (var i = 0; i < 4; i++) refs.grid.appendChild(el("div", { class: "ax-skel gl-skel", "aria-hidden": "true" }));
  }

  function disp(d) { return d ? d.slice(2).replace(/-/g, ".") : "—"; }

  function picture(it, eager) {
    var attrs = { alt: it.caption, width: "480", height: "360", decoding: "async" };
    if (!eager) attrs.loading = "lazy";
    if (it.thumb) {
      attrs.src = it.thumb;
      attrs.srcset = it.thumb + " 480w, " + it.image + " 1000w";
      attrs.sizes = "(max-width: 520px) 50vw, 300px";
    } else attrs.src = it.image;
    var img = el("img", attrs);
    img.addEventListener("error", function onErr() {
      img.removeEventListener("error", onErr);
      img.removeAttribute("srcset"); img.src = it.image;
    });
    return img;
  }

  function showSlide(card, alb, n) {
    var slides = alb.slides;
    alb.slide = (n + slides.length) % slides.length;
    var it = slides[alb.slide];
    var stage = card.querySelector(".gl-carousel-stage");
    if (stage) {
      stage.innerHTML = "";
      stage.appendChild(picture(it, true));
    }
    var dateEl = card.querySelector(".gl-date");
    if (dateEl) dateEl.textContent = disp(it.date);
    var dots = card.querySelectorAll(".gl-carousel-dots button");
    Array.prototype.forEach.call(dots, function (b, idx) {
      b.setAttribute("aria-current", idx === alb.slide ? "true" : "false");
    });
    var idxEl = card.querySelector(".gl-carousel-idx");
    if (idxEl) idxEl.textContent = (alb.slide + 1) + " / " + slides.length;
  }

  function renderAlbumCard(alb, eager) {
    var multi = alb.slides.length > 1;
    var first = alb.slides[alb.slide || 0];
    var imgWrap = el("div", { class: "gl-img" + (multi ? " gl-carousel-stage" : "") }, [picture(first, eager)]);
    var capKids = [
      el("div", { class: "gl-top" }, [
        el("span", { class: "gl-date", text: disp(first.date) }),
        alb.group ? el("span", { class: "gl-tag", text: "@" + alb.group }) : null
      ]),
      alb.caption ? el("div", { class: "gl-text", text: alb.caption }) : null
    ];
    if (multi) {
      capKids.push(el("div", { class: "gl-carousel-meta" }, [
        el("span", { class: "gl-carousel-idx", text: "1 / " + alb.slides.length })
      ]));
    }
    var card = el("div", {
      class: "gl-card" + (multi ? " gl-card--carousel" : ""),
      role: multi ? "group" : "button",
      tabindex: "0",
      "aria-label": (alb.caption || "사진") + (multi ? " 캐러셀" : " 크게 보기")
    }, [imgWrap, el("div", { class: "gl-cap" }, capKids)]);

    if (multi) {
      var prev = el("button", { type: "button", class: "gl-carousel-nav gl-carousel-prev", "aria-label": "이전 사진", html: ICON.prev });
      var next = el("button", { type: "button", class: "gl-carousel-nav gl-carousel-next", "aria-label": "다음 사진", html: ICON.next });
      var dots = el("div", { class: "gl-carousel-dots" });
      alb.slides.forEach(function (_, idx) {
        var b = el("button", { type: "button", "aria-label": "슬라이드 " + (idx + 1), "aria-current": idx === 0 ? "true" : "false" });
        b.addEventListener("click", function (e) { e.stopPropagation(); showSlide(card, alb, idx); });
        dots.appendChild(b);
      });
      imgWrap.appendChild(prev);
      imgWrap.appendChild(next);
      imgWrap.appendChild(dots);
      prev.addEventListener("click", function (e) { e.stopPropagation(); showSlide(card, alb, alb.slide - 1); });
      next.addEventListener("click", function (e) { e.stopPropagation(); showSlide(card, alb, alb.slide + 1); });
    }

    function open() {
      state.shown = alb.slides.slice();
      openBox(alb.slide || 0);
    }
    card.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("button")) return;
      refs.opener = card;
      open();
    });
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); refs.opener = card; open(); }
    });
    return card;
  }

  function render() {
    var groups = [];
    state.items.forEach(function (it) { if (it.group && groups.indexOf(it.group) === -1) groups.push(it.group); });
    refs.chips.innerHTML = "";
    [{ id: "all", lb: "전체" }].concat(groups.map(function (g) { return { id: g, lb: GROUP[g] || g }; })).forEach(function (c) {
      var n = c.id === "all" ? state.items.length : state.items.filter(function (it) { return it.group === c.id; }).length;
      var b = el("button", { type: "button", class: "ax-chip", "aria-pressed": String(state.group === c.id) },
        [el("span", { class: c.id === "all" ? "ko" : "", text: c.lb }), el("span", { class: "n", text: String(n) })]);
      b.addEventListener("click", function () { state.group = c.id; render(); });
      refs.chips.appendChild(b);
    });
    refs.chips.hidden = groups.length < 2;
    var filtered = state.items.filter(function (it) { return state.group === "all" || it.group === state.group; });
    state.albums = toAlbums(filtered);
    refs.count.textContent = state.albums.length + "주제 · " + filtered.length + "장";
    refs.grid.innerHTML = "";
    var lastY = null;
    state.albums.forEach(function (alb, i) {
      var y = alb.year || "";
      if (y !== lastY) { refs.grid.appendChild(el("h3", { class: "gl-year", text: y || "—" })); lastY = y; }
      refs.grid.appendChild(renderAlbumCard(alb, i < 6));
    });
  }

  function openBox(i) {
    removeBox();
    state.open = i;
    var it = state.shown[i];
    var img = el("img", { src: it.image, alt: it.caption });
    var prev = el("button", { type: "button", class: "gl-btn gl-prev", "aria-label": "이전 사진", html: ICON.prev });
    var next = el("button", { type: "button", class: "gl-btn gl-next", "aria-label": "다음 사진", html: ICON.next });
    var close = el("button", { type: "button", class: "gl-btn", "aria-label": "닫기", html: ICON.close });
    var full = null;
    if (inFrame() && window.innerHeight < 480 && !A.full) {
      var u = new URL(A.fullUrl("gallery"));
      u.searchParams.set("photo", photoKey(it.image));
      full = el("a", { class: "gl-btn gl-full", href: u.href, target: "_blank", rel: "noopener", "aria-label": "새 탭에서 크게 보기", title: "새 탭에서 크게 보기", html: ICON.full });
    }
    refs.box = el("div", { class: "gl-box", role: "dialog", "aria-modal": "true", "aria-label": it.caption || "사진" }, [
      el("div", { class: "gl-box-top" }, [el("span", { class: "ax-mono", text: (i + 1) + " / " + state.shown.length }), el("span", { class: "gl-box-acts" }, [full, close])]),
      el("div", { class: "gl-box-stage" }, [img, prev, next]),
      el("div", { class: "gl-box-cap" }, [el("span", { class: "d", text: disp(it.date) }), it.caption,
        it.link ? el("a", { href: it.link, target: "_blank", rel: "noopener", class: "ax-link", style: "margin-left:10px", text: "LINK" }) : null])
    ]);
    prev.addEventListener("click", function () { step(-1); });
    next.addEventListener("click", function () { step(1); });
    close.addEventListener("click", closeBox);
    refs.box.addEventListener("click", function (e) {
      if (e.target === refs.box || e.target.classList.contains("gl-box-stage") || (e.target === img && outsidePicture(img, e))) closeBox();
    });
    document.body.appendChild(refs.box);
    document.documentElement.classList.add("gl-locked");
    close.focus();
  }
  function inFrame() { try { return window.self !== window.top; } catch (err) { return true; } }
  function photoKey(url) { var m = String(url).match(/([^\/?#]+?)(\.[a-z0-9]+)?(?:[?#].*)?$/i); return m ? m[1] : ""; }
  function outsidePicture(img, e) {
    var r = img.getBoundingClientRect(), nw = img.naturalWidth, nh = img.naturalHeight;
    if (!nw || !nh) return false;
    var k = Math.min(1, r.width / nw, r.height / nh), w = nw * k, h = nh * k;
    var x = r.left + (r.width - w) / 2, y = r.top + (r.height - h) / 2;
    return e.clientX < x || e.clientX > x + w || e.clientY < y || e.clientY > y + h;
  }
  function step(d) { var n = state.shown.length; openBox((state.open + d + n) % n); }
  function removeBox() { if (refs.box) { refs.box.remove(); refs.box = null; } }
  function closeBox() {
    removeBox();
    document.documentElement.classList.remove("gl-locked");
    if (refs.opener && document.contains(refs.opener)) refs.opener.focus({ preventScroll: true });
  }
  document.addEventListener("keydown", function (e) {
    if (!refs.box) return;
    if (e.key === "Escape") closeBox();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "Tab") {
      var f = refs.box.querySelectorAll("button, a[href]");
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  function boot() {
    shell();
    function apply(res) {
      state.items = normalize(res.rows);
      if (!state.items.length) { A.status(refs.grid, "표시할 사진이 없습니다."); return; }
      render();
      var want = A.params.get("photo");
      if (want && !state.deepOpened) {
        state.deepOpened = true;
        for (var a = 0; a < state.albums.length; a++) {
          var alb = state.albums[a];
          for (var k = 0; k < alb.slides.length; k++) {
            if (photoKey(alb.slides[k].image) === want) {
              state.shown = alb.slides.slice();
              alb.slide = k;
              openBox(k);
              return;
            }
          }
        }
      }
    }
    A.load("gallery", { required: ["date", "caption", "image"], onUpdate: apply }).then(apply).catch(function () { A.status(refs.grid, "사진을 불러오지 못했습니다."); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
