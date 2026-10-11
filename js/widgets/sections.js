/* Text blocks of the Sites pages (Professor CV, Recruiting, Research areas, Home
   pillars/contact) — sheet tab `sections`. Columns: block,section,type,sub,text,link,image
   One row = one line/item, in sheet order. ?block=<id> picks the rows of one embed
   (several: ?block=a,b; none = every block, labelled — handy as a preview).
   section: heading shown above the rows that share it (empty = no heading).
   type: bullet (default) | entry | text | lead | fact | card | callout | figure | thumb |
         profile | contact | button | photo (= image: side photo + caption) — see README §3 "sections".
   text markup: **굵게**  {{주황 강조}}  [글자](https://…)  (줄바꿈은 셀 안 Alt+Enter).
   A cell must not START with = or + when typed in Sheets (formula) — put ' in front. */
(function () {
  var A = window.ADAM, el = A.el;
  var TYPES = ["bullet", "entry", "text", "lead", "fact", "card", "callout", "figure", "thumb", "profile", "contact", "button", "photo", "image"];
  var TITLES = {
    professor: "Professor · 권순조", "recruit-intro": "Recruiting · 모집 안내", "recruit-topics": "Recruiting · 연구 주제",
    "recruit-benefits": "Recruiting · 참여 혜택", "recruit-apply": "Recruiting · 지원 방법",
    research: "Research Area", "home-pillars": "Research Pillars", "home-growth": "Growth Pillars", "home-join": "Join ADAM Lab"
  };
  /* Hosted in adam-lab pages (not Sites iframes): keep desktop section layout. */
  A.peMax = 440; A.peCheck();
  var mounts = Array.prototype.slice.call(document.querySelectorAll("[data-adam='sections']"));
  if (!mounts.length) {
    var one = document.getElementById("adam-sections");
    if (one) mounts = [one];
  }
  if (!mounts.length) return;
  /* Per-mount state is created in boot(); these are used as locals inside helpers via closure rebinding. */
  var mount = mounts[0], want = [], refs = {};

  /* ---------- inline markup → DOM (no innerHTML: sheet text is untrusted) ---------- */
  var DATE = /\((\d{4}[^()]*)\)/;
  function inline(str, opts) {
    var frag = document.createDocumentFragment();
    var re = opts && opts.dates
      ? /\*\*(.+?)\*\*|\{\{(.+?)\}\}|\[([^\]]+)\]\(([^)\s]+)\)|\((\d{4}[^()]*)\)/
      : /\*\*(.+?)\*\*|\{\{(.+?)\}\}|\[([^\]]+)\]\(([^)\s]+)\)/;
    var s = String(str || "");
    while (s) {
      var m = s.match(re);
      if (!m) { text(frag, s); break; }
      if (m.index) text(frag, s.slice(0, m.index));
      if (m[1] != null) frag.appendChild(wrap("strong", m[1]));
      else if (m[2] != null) frag.appendChild(wrap("em", m[2], "sx-ac"));
      else if (m[3] != null) {
        var href = A.safeUrl(m[4]);
        if (href) frag.appendChild(linkTo(href, inline(m[3], opts)));
        else text(frag, m[0]);
      } else frag.appendChild(el("span", { class: "sx-date", text: m[5] }));
      s = s.slice(m.index + m[0].length);
    }
    return frag;
    function wrap(tag, inner, cls) { var n = el(tag, cls ? { class: cls } : {}); n.appendChild(inline(inner, opts)); return n; }
  }
  function text(frag, s) {
    s.split("\n").forEach(function (part, i) { if (i) frag.appendChild(el("br")); if (part) frag.appendChild(document.createTextNode(part)); });
  }
  function linkTo(href, child) {
    var ext = /^https?:/.test(href);
    var a = el("a", ext ? { href: href, target: "_blank", rel: "noopener" } : { href: href });
    a.appendChild(child);
    return a;
  }
  function rich(tag, cls, str, opts) { var n = el(tag, cls ? { class: cls } : {}); n.appendChild(inline(str, opts)); return n; }
  function img(src, alt, cls) {
    var u = A.asset(src);
    return u ? el("img", { src: u, alt: alt || "", loading: "lazy", decoding: "async", class: cls || null }) : null;
  }
  function plain(s) { return String(s || "").replace(/\*\*|\{\{|\}\}/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1"); }

  /* ---------- rows ---------- */
  var T = A.track("sections");
  function normalize(rows) {
    var out = [];
    T.reset();
    rows.forEach(function (r, i) {
      var block = String(r.block || "").trim(), type = String(r.type || "").trim().toLowerCase() || "bullet";
      var txt = String(r.text == null ? "" : r.text).replace(/\r\n?/g, "\n").replace(/^\s+|\s+$/g, "");
      if (!block) { if (txt) T.drop(i, "block 비어 있음"); return; }
      if (TYPES.indexOf(type) === -1) { T.warn(i, "type '" + type + "' 모름 → bullet"); type = "bullet"; }
      if (type === "image") type = "photo";
      if (!txt && !r.image) { T.drop(i, "text·image 둘 다 비어 있음"); return; }
      var sub = String(r.sub || "").trim();
      /* Recruiting: 신청 기간 → 상시 (sheet/JSON override) */
      if (block === "recruit-intro" && sub === "신청 기간") txt = "상시";
      out.push({ block: block, section: String(r.section || "").trim(), type: type, sub: sub,
        text: txt, link: A.safeUrl(r.link), image: String(r.image || "").trim(), order: i });
    });
    T.done(out.length);
    return out;
  }

  /* consecutive rows with the same key → groups */
  function runs(list, key) {
    var out = [], cur = null;
    list.forEach(function (it) {
      var k = key(it);
      if (!cur || cur.k !== k) { cur = { k: k, items: [] }; out.push(cur); }
      cur.items.push(it);
    });
    return out;
  }

  /* ---------- renderers per run type ---------- */
  function listRun(items, kind) {
    var subs = runs(items, function (it) { return it.sub; });
    var hasSub = subs.some(function (g) { return g.k; });
    var wrapEl = hasSub ? el("div", { class: "sx-subgrid", "data-min": "340" }) : document.createDocumentFragment();
    subs.forEach(function (g) {
      var ul = el("ul", { class: kind === "entry" ? "sx-entries" : "sx-list" });
      g.items.forEach(function (it) {
        var li = el("li", {});
        if (kind === "entry") {
          var all = it.text.match(new RegExp(DATE.source, "g")) || [];
          var tail = it.text.match(/^([\s\S]*?)\s*\((\d{4}[^()]*)\)\s*$/);
          if (all.length === 1 && tail) {
            li.appendChild(rich("span", "sx-what", tail[1], { dates: true }));
            li.appendChild(el("span", { class: "sx-when", text: tail[2] }));
          } else li.appendChild(rich("span", "sx-what", it.text, { dates: true }));
        } else li.appendChild(inline(it.text));
        if (it.link) { var a = linkTo(it.link, document.createTextNode("")); a.className = "ax-link sx-more"; a.setAttribute("aria-label", "링크"); li.appendChild(a); }
        ul.appendChild(li);
      });
      if (hasSub) wrapEl.appendChild(el("div", { class: "sx-subcard" }, [g.k ? rich("h4", "sx-sub", g.k) : null, ul]));
      else wrapEl.appendChild(ul);
    });
    return wrapEl;
  }

  function aidLetter(sub) {
    var s = String(sub || "");
    var m = s.match(/\{\{\s*([AID])\s*\}\}/i) || s.match(/\b([AID])(?:utonomy|ntelligence|igitalization)\b/i);
    return m ? m[1].toUpperCase() : "";
  }

  /* Research page section titles: … ({{Autonomy|Intelligence|Digitalization}}) */
  function researchPillarKey(sectionTitle) {
    var s = String(sectionTitle || "");
    if (/\{\{\s*Autonomy\s*\}\}/i.test(s) || /\bAutonomy\b/i.test(s)) return "a";
    if (/\{\{\s*Intelligence\s*\}\}/i.test(s) || /\bIntelligence\b/i.test(s)) return "i";
    if (/\{\{\s*Digitalization\s*\}\}/i.test(s) || /\bDigitalization\b/i.test(s)) return "d";
    return "";
  }

  function cardRun(items) {
    /* rows with the same non-empty sub (consecutive) = one card */
    var cards = [], cur = null;
    items.forEach(function (it) {
      if (cur && it.sub && it.sub === cur.sub) cur.items.push(it);
      else { cur = { sub: it.sub, items: [it] }; cards.push(cur); }
    });
    /* icon cards (Growth Pillars) = rows on desktop, three mini columns on phones */
    var icons = cards.some(function (c) { return c.items[0].image; });
    var aid = cards.map(function (c) { return aidLetter(c.sub); }).filter(Boolean);
    var isAid = !icons && aid.length >= 2;
    var grid = el("div", {
      class: "sx-cards" + (icons ? " has-icon" : "") + (isAid ? " sx-aid" : ""),
      "data-min": icons ? "640" : (isAid ? "220" : "300"),
      "data-min-pe": icons ? "96" : (isAid ? "200" : "300")
    });
    cards.forEach(function (c, i) {
      var first = c.items[0], link = first.link;
      var letter = aidLetter(c.sub);
      var body = c.items.length > 1
        ? el("ul", { class: "sx-list" }, c.items.map(function (it) { return el("li", {}, [inline(it.text)]); }))
        : rich("p", "sx-body", first.text);
      var cls = "sx-card" + (letter ? " sx-card--aid sx-card--" + letter.toLowerCase() : "");
      var card = el(link ? "a" : "div", link ? { class: cls, href: link, target: /^https?:/.test(link) ? "_blank" : null, rel: "noopener" } : { class: cls }, [
        letter ? el("span", { class: "sx-aid-letter", "aria-hidden": "true", text: letter }) : null,
        first.image ? el("div", { class: "sx-icon" }, [img(first.image, plain(c.sub))]) : null,
        el("div", { class: "sx-cardtxt" }, [
          c.sub ? rich("h4", "sx-ct", c.sub) : el("span", { class: "sx-num", text: (i + 1 < 10 ? "0" : "") + (i + 1) }),
          body
        ])
      ]);
      if (letter) A.markKey(card, "section", letter + "-" + plain(c.sub));
      else if (c.sub) A.markKey(card, "section", plain(c.sub));
      grid.appendChild(card);
    });
    return grid;
  }

  function factRun(items) {
    var grid = el("div", { class: "sx-facts", "data-min": "220", "data-min-pe": "130" });
    runs(items, function (it) { return it.sub; }).forEach(function (g) {
      var val = g.items.length > 1
        ? el("ul", { class: "sx-list" }, g.items.map(function (it) { return el("li", {}, [inline(it.text)]); }))
        : rich("p", "sx-fv", g.items[0].text);
      grid.appendChild(el("div", { class: "sx-fact" + (g.items.length > 1 ? " wide" : "") }, [el("span", { class: "sx-fl", text: plain(g.k) }), val]));
    });
    return grid;
  }

  function profileRun(items) {
    var photo = null, lines = [], links = [], name = null;
    items.forEach(function (it) {
      if (it.image && !photo) photo = img(it.image, plain(items[0].text));
      if (it.link) links.push(el("a", { class: "ax-link", href: it.link, target: "_blank", rel: "noopener", text: plain(it.text) }));
      else if (!name) name = rich("h2", "sx-name", it.text);
      else lines.push(rich("div", "sx-line", it.text));
    });
    return el("div", { class: "sx-profile" + (photo ? "" : " no-photo") }, [
      photo ? el("div", { class: "sx-photo" }, [photo]) : null,
      el("div", { class: "sx-pbody" }, [el("span", { class: "ax-kicker", text: "Professor" }), name, el("div", { class: "sx-lines" }, lines),
        links.length ? el("div", { class: "sx-plinks" }, links) : null])
    ]);
  }

  function renderRun(g) {
    var items = g.items, t = g.k;
    if (t === "bullet" || t === "entry") return listRun(items, t);
    if (t === "card") return cardRun(items);
    if (t === "fact") return factRun(items);
    if (t === "profile") return profileRun(items);
    if (t === "thumb") return el("div", { class: "sx-thumbs", "data-min": "220", "data-min-pe": "96" }, items.map(function (it) {
      var fig = el("figure", { class: "sx-thumb" }, [el("div", { class: "sx-tim" }, [img(it.image, plain(it.text))]), rich("figcaption", "", it.text)]);
      return it.link ? linkTo(it.link, fig) : fig;
    }));
    if (t === "contact") return el("dl", { class: "sx-contact" }, items.map(function (it) {
      var v = el("dd", {});
      if (it.link) v.appendChild(linkTo(it.link, inline(it.text))); else v.appendChild(inline(it.text));
      return el("div", { class: "sx-crow" }, [el("dt", { text: it.sub }), v]);
    }));
    if (t === "button") return el("div", { class: "sx-buttons" }, items.map(function (it) {
      var a = el("a", { class: "sx-btn", href: it.link || "#", target: "_blank", rel: "noopener" }, [it.image ? img(it.image, "") : null, el("span", { text: plain(it.text) })]);
      return a;
    }));
    var frag = document.createDocumentFragment();
    items.forEach(function (it) {
      if (t === "text") frag.appendChild(rich("p", "sx-text", it.text));
      else if (t === "lead") frag.appendChild(rich("h2", "sx-lead", it.text));
      else if (t === "callout") frag.appendChild(rich("p", "sx-callout", it.text));
      else if (t === "figure") frag.appendChild(el("figure", { class: "sx-figure" }, [img(it.image, plain(it.text)), it.text ? rich("figcaption", "", it.text) : null]));
    });
    return frag;
  }

  /* very short phone boxes (html.sx-compact): contact/button/photo rows of a section
     collapse into one row of small link buttons — E (mailto) · T (tel) · Instagram · 지도 —
     built from the same rows (contact rows need a link; photo rows need a link). */
  var ICONS = {
    mail: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><rect x="1.5" y="3.5" width="13" height="9" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="m2 4 6 5 6-5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    tel: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M4.2 1.8 6.3 4.4 5 6.1c.8 1.8 2.1 3.1 3.9 3.9l1.7-1.3 2.6 2.1-1.1 2.5C7 13.2 2.8 9 2.7 3z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
    map: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M8 14.5s-4.5-4.6-4.5-8a4.5 4.5 0 0 1 9 0c0 3.4-4.5 8-4.5 8z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="6.4" r="1.6" fill="currentColor"/></svg>',
    link: '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M6 3H3v10h10v-3M9 2h5v5M14 2 7.5 8.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>'
  };
  function compactBar(items) {
    var list = [];
    items.forEach(function (it) {
      if (!it.link) return;
      if (it.type === "contact") {
        var kind = /^mailto:/.test(it.link) ? "mail" : /^tel:/.test(it.link) ? "tel" : "link";
        list.push({ href: it.link, icon: ICONS[kind], label: it.sub || plain(it.text), title: plain(it.text) });
      } else if (it.type === "button") {
        list.push({ href: it.link, img: it.image, icon: it.image ? "" : ICONS.link, label: plain(it.text), title: plain(it.text) });
      } else if (it.type === "photo") {
        var isMap = /naver\.me|map\.naver|maps\.app\.goo|google\.[a-z.]+\/maps|kko\.to|map\.kakao/.test(it.link);
        list.push({ href: it.link, icon: isMap ? ICONS.map : ICONS.link, label: isMap ? "지도" : plain(it.text), title: plain(it.text), ko: isMap });
      }
    });
    if (!list.length || !items.some(function (it) { return it.type === "contact" || it.type === "button"; })) return null;
    return el("div", { class: "sx-cbar" }, list.map(function (b) {
      var a = linkTo(b.href, document.createDocumentFragment());
      a.className = "sx-cbtn" + (b.ko ? " ko" : "");
      a.setAttribute("title", b.title); a.setAttribute("aria-label", b.label + " — " + b.title);
      if (b.img) { var im = img(b.img, ""); if (im) a.appendChild(im); }
      if (b.icon) a.appendChild(el("span", { class: "i", html: b.icon }));
      a.appendChild(el("span", { text: b.label }));
      return a;
    }));
  }

  function renderSection(sec, opts) {
    opts = opts || {};
    var photos = sec.items.filter(function (it) { return it.type === "photo"; });
    var rest = sec.items.filter(function (it) { return it.type !== "photo"; });
    var main = el("div", { class: "sx-main" });
    runs(rest, function (it) { return it.type; }).forEach(function (g) { main.appendChild(renderRun(g)); });
    var cbar = compactBar(sec.items);
    if (cbar) main.appendChild(cbar);
    var onlyEntries = rest.length && rest.every(function (it) { return it.type === "entry" && !it.sub; });
    var pillar = opts.research ? researchPillarKey(sec.k) : "";
    var cls = "sx-sec ax-in"
      + (photos.length ? " sx-split" : "")
      + (onlyEntries && sec.k ? " sx-halfable" : "")
      + (cbar ? " has-cbar" : "")
      + (pillar ? " sx-research-card sx-research--" + pillar : "");
    var head = null;
    if (sec.k) {
      if (pillar) {
        var letter = pillar.toUpperCase();
        head = el("h3", { class: "sx-research-head" }, [
          el("span", { class: "sx-research-letter", "aria-hidden": "true", text: letter }),
          rich("span", "t", sec.k)
        ]);
      } else {
        head = el("h3", { class: "sx-sh" }, [rich("span", "t", sec.k)]);
      }
    }
    var node = el("section", { class: cls }, [
      head,
      photos.length ? el("div", { class: "sx-splitwrap" }, [main, el("aside", { class: "sx-aside" }, photos.map(function (it) {
        var fig = el("figure", { class: "sx-photo-fig" }, [el("div", { class: "sx-pim" }, [img(it.image, plain(it.text))]), it.text ? rich("figcaption", "", it.text) : null]);
        if (!it.link) return fig;
        var a = linkTo(it.link, fig);
        a.setAttribute("title", plain(it.text) + " — 지도 (새 탭)");
        return a;
      }))]) : main
    ]);
    if (pillar) A.markKey(node, "section", pillar + "-" + plain(sec.k));
    return node;
  }

  /* two neighbouring short CV sections (entries only, no sub) sit side by side */
  function pairHalves(blockEl) {
    var secs = Array.prototype.slice.call(blockEl.querySelectorAll(":scope > .sx-sec"));
    for (var i = 0; i < secs.length; i++) {
      if (secs[i].classList.contains("sx-halfable") && secs[i + 1] && secs[i + 1].classList.contains("sx-halfable")) {
        secs[i].classList.add("sx-half"); secs[i + 1].classList.add("sx-half"); i++;
      }
    }
  }

  /* balanced grid columns: as many as fit (data-min px each), then even rows (4 → 2×2, 5 → 3+2) */
  function layout(root) {
    var pe = document.documentElement.classList.contains("ax-pe");
    Array.prototype.forEach.call((root || document).querySelectorAll("[data-min]"), function (g) {
      var kids = Array.prototype.slice.call(g.children), n = kids.length; if (!n) return;
      var wide = kids.filter(function (c) { return c.classList.contains("wide"); });
      n += wide.length;   /* a .wide child (e.g. a fact with a list) takes two columns */
      var min = +(pe && g.getAttribute("data-min-pe") || g.getAttribute("data-min")), gap = parseFloat(getComputedStyle(g).columnGap) || 12;
      var cols = Math.max(1, Math.min(n, Math.floor((g.clientWidth + gap) / (min + gap))));
      cols = Math.ceil(n / Math.ceil(n / cols));
      g.style.gridTemplateColumns = "repeat(" + cols + ", minmax(0, 1fr))";
      wide.forEach(function (c) { c.style.gridColumn = cols >= 2 ? "span 2" : ""; });
    });
  }

  /* compact mode: phone box ≤ 170px tall and a section with a button row. Then
     later paragraphs of that section are dropped (last first) until the rest fits,
     e.g. home-join at 355×134: Korean paragraph + E · T · Instagram · 지도. */
  var COMPACT_H = 170;
  function compactFor(mount, refs) {
    var de = document.documentElement;
    var on = de.classList.contains("ax-pe") && window.innerHeight <= COMPACT_H && !!mount.querySelector(".sx-cbar");
    de.classList.toggle("sx-compact", on);
    var texts = Array.prototype.slice.call(mount.querySelectorAll(".sx-sec.has-cbar .sx-text"));
    texts.forEach(function (t) { t.classList.remove("sx-cut"); });
    var mark = refs.root && refs.root.querySelector(".ax-pe-mark");
    if (on && mark) {
      for (var i = texts.length - 1; i > 0; i--) {
        if (mark.getBoundingClientRect().top + window.pageYOffset <= window.innerHeight + 1) break;
        texts[i].classList.add("sx-cut");
      }
    }
    window.dispatchEvent(new Event("scroll"));
  }

  function shellInto(mount) {
    var localRefs = {};
    mount.innerHTML = "";
    localRefs.body = el("div", { class: "sx-blocks" });
    localRefs.root = el("div", { class: "ax-root sx" }, [localRefs.body]);
    mount.appendChild(localRefs.root);
    var w = (mount.getAttribute("data-block") || A.params.get("block") || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    var title = w.length === 1 ? (TITLES[w[0]] || w[0]) : "ADAM Lab";
    A.phone(localRefs.root, { open: false, title: title });
    for (var i = 0; i < 3; i++) localRefs.body.appendChild(el("div", { class: "ax-skel", "aria-hidden": "true", style: "height:56px;margin:8px 0" }));
    return { refs: localRefs, want: w };
  }

  function renderInto(ctx, items) {
    var refs = ctx.refs, want = ctx.want, mount = ctx.mount;
    var blocks = runs(items, function (it) { return it.block; });
    if (want.length) blocks = want.map(function (id) {
      var all = items.filter(function (it) { return it.block === id; });
      return all.length ? { k: id, items: all } : null;
    }).filter(Boolean);
    refs.body.innerHTML = "";
    if (!blocks.length) {
      var ids = runs(items, function (it) { return it.block; }).map(function (g) { return g.k; });
      A.status(refs.body, "블록 '" + want.join(",") + "'이(가) 시트에 없습니다. 있는 블록: " + ids.join(", "));
      return;
    }
    blocks.forEach(function (b) {
      var isResearch = b.k === "research";
      var blockEl = el("div", {
        class: "sx-block" + (isResearch ? " sx-block--research" : ""),
        "data-block": b.k
      });
      if (!want.length) blockEl.appendChild(el("div", { class: "sx-blockid" }, [el("span", { class: "ax-kicker", text: "block" }), el("code", { text: b.k })]));
      runs(b.items, function (it) { return it.section; }).forEach(function (sec) {
        blockEl.appendChild(renderSection(sec, { research: isResearch }));
      });
      if (!isResearch) pairHalves(blockEl);
      refs.body.appendChild(blockEl);
    });
    layout(mount);
    stackHomePillars(mount);
    compactFor(mount, refs);
    A.mounted("section");
  }

  /* Home Pillars right column: keep A·I·D as a vertical stack (layout() would otherwise multi-col). */
  function stackHomePillars(mount) {
    var blocks = (mount.getAttribute("data-block") || "").split(",").map(function (s) { return s.trim(); });
    if (blocks.indexOf("home-pillars") === -1 && !mount.classList.contains("pillars-aid")) return;
    Array.prototype.forEach.call(mount.querySelectorAll(".sx-cards.sx-aid"), function (g) {
      g.setAttribute("data-min", "9999");
      g.style.gridTemplateColumns = "minmax(0, 1fr)";
    });
  }

  function boot() {
    var contexts = mounts.map(function (m) {
      var ctx = shellInto(m);
      ctx.mount = m;
      return ctx;
    });
    var t0 = 0;
    window.addEventListener("resize", function () {
      clearTimeout(t0);
      t0 = setTimeout(function () {
        contexts.forEach(function (ctx) {
          layout(ctx.mount);
          stackHomePillars(ctx.mount);
          compactFor(ctx.mount, ctx.refs);
        });
      }, 60);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () {
      contexts.forEach(function (ctx) { compactFor(ctx.mount, ctx.refs); });
    });
    function apply(res) {
      var items = normalize(res.rows);
      contexts.forEach(function (ctx) {
        if (!items.length) { A.status(ctx.refs.body, "표시할 내용이 없습니다."); return; }
        renderInto(ctx, items);
      });
    }
    A.load("sections", { required: ["block", "type", "text"], onUpdate: apply }).then(apply)
      .catch(function () {
        contexts.forEach(function (ctx) { A.status(ctx.refs.body, "내용을 불러오지 못했습니다."); });
      });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
