/* Photo gallery — sheet tab `gallery`. Columns: date,caption,image,group,link
   image: repo path (assets/gallery/…, recommended) or a public image URL / Google Drive share link (unofficial).
   Repo photos get a 480px 4:3 thumbnail (assets/gallery/thumbs/<name>-480.jpg, scripts/make_thumbs.py).
   Grid is row-wise by date (newest first). URL params: ?group=PNU|KIT · ?photo=photo-03 (open that photo)
   Lightbox: the image is fitted (object-fit) into the space left by the top bar and the caption, so the caption is
   never covered; a long caption scrolls inside its own area. In a short Sites box (< 480px tall) a ↗ button opens
   the photo in the new-tab full view. */
(function () {
  var A = window.ADAM, el = A.el;
  var mount = document.getElementById("adam-gallery");
  if (!mount) return;
  var GROUP = { PNU: "ADAM Lab@PNU", KIT: "DADI Lab@KIT" };
  var state = { items: [], group: (A.params.get("group") || "all").toUpperCase(), open: -1, shown: [] };
  if (state.group === "ALL") state.group = "all";
  var refs = {};
  var ICON = {
    prev: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M10.2 2.4 4.6 8l5.6 5.6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    next: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M5.8 2.4 11.4 8l-5.6 5.6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    full: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5M6.5 3.5h-4v10h10v-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    close: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="m3 3 10 10M13 3 3 13" stroke="currentColor" stroke-width="1.6"/></svg>'
  };

  /* assets/gallery/photo-07.jpg → assets/gallery/thumbs/photo-07-480.jpg */
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

  function shell() {
    mount.innerHTML = "";
    refs.chips = el("div", { class: "ax-chips", role: "group", "aria-label": "앨범" });
    refs.count = el("span", { class: "ax-count", "aria-live": "polite" });
    refs.grid = el("div", { class: "gl-grid" });
    var root = el("div", { class: "ax-root gl" }, [el("div", { class: "ax-bar" }, [refs.chips, el("span", { class: "ax-grow" }), refs.count]), refs.grid]);
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
    img.addEventListener("error", function onErr() {   // no thumbnail yet → original
      img.removeEventListener("error", onErr);
      img.removeAttribute("srcset"); img.src = it.image;
    });
    return img;
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
    var shown = state.shown = state.items.filter(function (it) { return state.group === "all" || it.group === state.group; });
    refs.count.textContent = shown.length + "장";
    refs.grid.innerHTML = "";
    var lastY = null;
    shown.forEach(function (it, i) {
      var y = it.date ? it.date.slice(0, 4) : "";
      if (y !== lastY) { refs.grid.appendChild(el("h3", { class: "gl-year", text: y || "—" })); lastY = y; }
      var card = el("button", { type: "button", class: "gl-card ax-in", "aria-label": (it.caption || "사진") + " 크게 보기" }, [
        el("div", { class: "gl-img" }, [picture(it, i < 8)]),
        el("div", { class: "gl-cap" }, [
          el("div", { class: "gl-top" }, [el("span", { class: "gl-date", text: disp(it.date) }), it.group ? el("span", { class: "gl-tag", text: "@" + it.group }) : null]),
          it.caption ? el("div", { class: "gl-text", text: it.caption }) : null
        ])
      ]);
      card.addEventListener("click", function () { refs.opener = card; openBox(i); });
      refs.grid.appendChild(card);
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
    if (inFrame() && window.innerHeight < 480 && !A.full) {   /* short Sites box → offer the big view in a new tab */
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
  /* the <img> fills the stage and letterboxes the photo (object-fit) — a tap on the empty band closes like the backdrop */
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
    if (refs.opener && document.contains(refs.opener)) refs.opener.focus({ preventScroll: true });   // back to the photo that opened it
  }
  document.addEventListener("keydown", function (e) {
    if (!refs.box) return;
    if (e.key === "Escape") closeBox();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "Tab") {   // keep focus inside the dialog
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
      if (want && !state.deepOpened) {   /* ↗ from a short box: open the same photo here */
        state.deepOpened = true;
        for (var k = 0; k < state.shown.length; k++) if (photoKey(state.shown[k].image) === want) { openBox(k); break; }
      }
    }
    A.load("gallery", { required: ["date", "caption", "image"], onUpdate: apply }).then(apply).catch(function () { A.status(refs.grid, "사진을 불러오지 못했습니다."); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
