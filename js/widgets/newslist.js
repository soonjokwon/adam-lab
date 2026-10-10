/* News as a LIST (Board page examples) — same sheet tab `news` as the Home card carousel.
   Columns: date,title_ko,title_en,tag,link,image,link2
   ?view=list      (default) 게시판형: No. · 날짜 · 분류 · 제목(+영문 한 줄) · ↗, 페이지 번호
   ?view=timeline  연도별 세로 타임라인 (선·점, 월.일), "이전 소식 더 보기"
   ?view=table     표형 (No. 날짜 분류 제목 링크), 행을 누르면 영문 요약·사진·링크 펼침, 페이지 번호
   also: ?tag=Award (start filter) · ?per=8 (rows per page) · /news/?view=… redirects here. */
(function () {
  var A = window.ADAM, el = A.el;
  var mount = document.getElementById("adam-newslist");
  if (!mount) return;
  var TAGS = ["Paper", "Award", "Project", "Event", "Member"];
  var TAG_KO = { All: "전체", Paper: "논문", Award: "수상", Project: "과제", Event: "행사", Member: "구성원" };
  var VIEWS = { list: "게시판", timeline: "타임라인", table: "표" };
  var view = VIEWS[A.params.get("view")] ? A.params.get("view") : "list";
  var per0 = Math.max(3, Math.min(50, +A.params.get("per") || (view === "table" ? 10 : view === "timeline" ? 7 : 8)));
  var state = { items: [], tag: "All", page: 1, open: {}, shown: per0, pe: !!A.pe };
  var refs = {};
  document.documentElement.classList.add("nl-v-" + view);

  function canonTag(v) {
    var raw = String(v || "").trim();
    for (var i = 0; i < TAGS.length; i++) if (TAGS[i].toLowerCase() === raw.toLowerCase()) return TAGS[i];
    return raw;
  }
  var T = A.track("news");
  function normalize(rows) {
    var out = [];
    T.reset();
    rows.forEach(function (r, i) {
      var date = A.normalizeDate(r.date), ko = String(r.title_ko || r.title || "").trim(), en = String(r.title_en || "").trim();
      if (!ko && !en) { T.drop(i, "title_ko·title_en 비어 있음"); return; }
      if (!date) { T.drop(i, ko.slice(0, 24) + ": date '" + (r.date || "") + "' 날짜로 못 읽음"); return; }
      var tag = canonTag(r.tag);
      if (tag && TAGS.indexOf(tag) === -1) T.warn(i, "tag '" + tag + "' 은 기본 분류가 아님");
      out.push({ date: date, ko: ko || en, en: ko ? en : "", tag: tag, link: A.safeUrl(r.link), link2: A.safeUrl(r.link2), image: A.asset(r.image), order: i });
    });
    out.sort(function (a, b) { return a.date === b.date ? a.order - b.order : (a.date < b.date ? 1 : -1); });
    out.forEach(function (it, i) { it.no = out.length - i; it.key = it.date + "|" + it.order; });
    T.done(out.length);
    return out;
  }

  function dot(d) { return d.replace(/-/g, "."); }
  function badge(tag) {
    return el("span", { class: "ax-badge ko nl-tag nl-tag-" + (tag || "none").toLowerCase(), text: TAG_KO[tag] || tag || "기타" });
  }
  function title(it, cls) {
    var h = el("span", { class: cls || "nl-ko" });
    if (it.link) h.appendChild(el("a", { href: it.link, target: "_blank", rel: "noopener", text: it.ko }));
    else h.textContent = it.ko;
    return h;
  }
  function linkBtns(it) {
    var out = [];
    if (it.link) out.push(el("a", { class: "ax-link", href: it.link, target: "_blank", rel: "noopener", text: it.link2 ? "Link 1" : "Link" }));
    if (it.link2) out.push(el("a", { class: "ax-link", href: it.link2, target: "_blank", rel: "noopener", text: "Link 2" }));
    return out;
  }

  /* ---------- shell ---------- */
  function shell() {
    mount.innerHTML = "";
    refs.chips = el("div", { class: "ax-chips", role: "group", "aria-label": "소식 분류" });
    refs.count = el("span", { class: "ax-count", "aria-live": "polite" });
    refs.body = el("div", { class: "nl-body" });
    refs.pager = el("nav", { class: "nl-pager", "aria-label": "페이지" });
    refs.root = el("div", { class: "ax-root nl nl-view-" + view }, [
      el("div", { class: "ax-bar" }, [refs.chips, el("span", { class: "ax-grow" }), refs.count]), refs.body, refs.pager
    ]);
    mount.appendChild(refs.root);
    A.phone(refs.root, { title: "소식 News · " + VIEWS[view] });
    for (var i = 0; i < 5; i++) refs.body.appendChild(el("div", { class: "ax-skel", "aria-hidden": "true", style: "height:40px;margin:6px 0" }));
  }

  function filtered() { return state.items.filter(function (it) { return state.tag === "All" || it.tag === state.tag; }); }

  function renderChips() {
    var c = { All: state.items.length };
    state.items.forEach(function (it) { if (it.tag) c[it.tag] = (c[it.tag] || 0) + 1; });
    var tags = ["All"].concat(TAGS.filter(function (t) { return c[t]; }));
    Object.keys(c).forEach(function (t) { if (tags.indexOf(t) === -1) tags.push(t); });
    refs.chips.innerHTML = "";
    tags.forEach(function (t) {
      var b = el("button", { type: "button", class: "ax-chip", "aria-pressed": String(state.tag === t) }, [
        el("span", { class: "ko", text: TAG_KO[t] || t }), el("span", { class: "n", text: String(c[t]) })]);
      b.addEventListener("click", function () { state.tag = t; state.page = 1; state.shown = per0; state.open = {}; render(); });
      refs.chips.appendChild(b);
    });
  }

  /* ---------- views ---------- */
  function pageSlice(list) {
    if (state.pe || A.full) return list;   /* phone: one scrolling list; full view: everything */
    var pages = Math.max(1, Math.ceil(list.length / per0));
    if (state.page > pages) state.page = pages;
    return list.slice((state.page - 1) * per0, state.page * per0);
  }

  function renderPager(total) {
    refs.pager.innerHTML = "";
    var pages = Math.ceil(total / per0);
    if (view === "timeline" || state.pe || A.full || pages <= 1) { refs.pager.hidden = true; return; }
    refs.pager.hidden = false;
    function btn(label, page, opts) {
      opts = opts || {};
      var b = el("button", { type: "button", class: "nl-pg" + (opts.cur ? " cur" : ""), "aria-label": opts.aria || (page + "쪽"), "aria-current": opts.cur ? "page" : null, disabled: opts.dis || null, text: label });
      b.addEventListener("click", function () { state.page = page; render(); refs.root.scrollIntoView ? window.scrollTo(0, 0) : 0; });
      return b;
    }
    refs.pager.appendChild(btn("‹", state.page - 1, { dis: state.page <= 1, aria: "이전 쪽" }));
    for (var p = 1; p <= pages; p++) refs.pager.appendChild(btn(String(p), p, { cur: p === state.page }));
    refs.pager.appendChild(btn("›", state.page + 1, { dis: state.page >= pages, aria: "다음 쪽" }));
    refs.pager.appendChild(el("span", { class: "ax-count", text: state.page + " / " + pages }));
  }

  function viewList(list) {
    var ul = el("ol", { class: "nl-list" });
    pageSlice(list).forEach(function (it) {
      ul.appendChild(el("li", { class: "nl-row" + (it.link ? " is-link" : "") }, [
        el("span", { class: "nl-no", text: String(it.no) }),
        el("span", { class: "nl-date", text: dot(it.date) }),
        badge(it.tag),
        el("div", { class: "nl-tt" }, [title(it), it.en ? el("span", { class: "nl-en", text: it.en }) : null]),
        it.link2 ? el("a", { class: "nl-go", href: it.link2, target: "_blank", rel: "noopener", title: "Link 2", text: "2↗" }) : (it.link ? el("span", { class: "nl-go", "aria-hidden": "true", text: "↗" }) : el("span", { class: "nl-go" }))
      ]));
    });
    return ul;
  }

  function viewTimeline(list) {
    var wrap = el("div", { class: "nl-tl" });
    var show = state.pe || A.full ? list : list.slice(0, state.shown);
    var curY = null, ul = null;
    show.forEach(function (it) {
      var y = it.date.slice(0, 4);
      if (y !== curY) {
        curY = y;
        var n = list.filter(function (x) { return x.date.slice(0, 4) === y; }).length;
        wrap.appendChild(el("h3", { class: "nl-year" }, [el("span", { class: "y", text: y }), el("span", { class: "ax-count", text: n + "건" })]));
        ul = el("ol", { class: "nl-tl-list" });
        wrap.appendChild(ul);
      }
      ul.appendChild(el("li", { class: "nl-tl-item" + (it.tag === "Award" ? " award" : "") }, [
        el("span", { class: "nl-tl-date", text: it.date.slice(5).replace("-", ".") }),
        el("span", { class: "nl-tl-dot", "aria-hidden": "true" }),
        el("div", { class: "nl-tl-body" }, [
          el("div", { class: "nl-tl-head" }, [badge(it.tag), title(it), it.link2 ? el("a", { class: "ax-link", href: it.link2, target: "_blank", rel: "noopener", text: "Link 2" }) : null]),
          it.en ? el("span", { class: "nl-en", text: it.en }) : null
        ])
      ]));
    });
    if (!(state.pe || A.full) && list.length > show.length) {
      var more = el("button", { type: "button", class: "nl-more" }, [el("span", { text: "이전 소식 더 보기" }), el("span", { class: "ax-count", text: "+" + Math.min(10, list.length - show.length) + " · 남은 " + (list.length - show.length) + "건" })]);
      more.addEventListener("click", function () { state.shown += 10; render(); });
      wrap.appendChild(more);
    }
    return wrap;
  }

  function viewTable(list) {
    var box = el("div", { class: "nl-table", role: "list" });
    box.appendChild(el("div", { class: "nl-th", "aria-hidden": "true" }, ["No.", "날짜", "분류", "제목", ""].map(function (t) { return el("span", { text: t }); })));
    pageSlice(list).forEach(function (it) {
      var open = !!state.open[it.key];
      var id = "nl-x-" + it.order;
      var row = el("button", { type: "button", class: "nl-tr", "aria-expanded": String(open), "aria-controls": id }, [
        el("span", { class: "nl-no", text: String(it.no) }),
        el("span", { class: "nl-date", text: dot(it.date) }),
        badge(it.tag),
        el("span", { class: "nl-ko", text: it.ko }),
        el("span", { class: "nl-caret", "aria-hidden": "true", text: "▾" })
      ]);
      row.addEventListener("click", function () { state.open[it.key] = !state.open[it.key]; render(); });
      var detail = el("div", { class: "nl-tx", id: id, hidden: open ? null : true }, [
        it.image ? el("img", { src: it.image, alt: "", loading: "lazy", class: "nl-img" }) : null,
        el("div", { class: "nl-txt" }, [
          it.en ? el("p", { class: "nl-en-full", text: it.en }) : null,
          el("div", { class: "nl-links" }, linkBtns(it).length ? linkBtns(it) : [el("span", { class: "ax-count", text: "링크 없음" })])
        ])
      ]);
      box.appendChild(el("div", { class: "nl-trow" + (open ? " open" : ""), role: "listitem" }, [row, detail]));
    });
    return box;
  }

  function render() {
    renderChips();
    var list = filtered();
    refs.count.textContent = list.length + "건";
    refs.body.innerHTML = "";
    if (!list.length) { refs.body.appendChild(el("p", { class: "adam-state", text: "이 분류의 소식이 없습니다." })); renderPager(0); return; }
    refs.body.appendChild(view === "timeline" ? viewTimeline(list) : view === "table" ? viewTable(list) : viewList(list));
    renderPager(list.length);
  }

  function boot() {
    shell();
    var t = canonTag(A.params.get("tag") || "");
    if (t) state.tag = t;
    window.addEventListener("resize", function () { if (!!A.pe !== state.pe) { state.pe = !!A.pe; if (state.items.length) render(); } });
    function apply(res) {
      state.items = normalize(res.rows);
      if (!state.items.length) { A.status(refs.body, "표시할 소식이 없습니다."); return; }
      if (state.tag !== "All" && !state.items.some(function (it) { return it.tag === state.tag; })) state.tag = "All";
      render();
    }
    A.load("news", { required: ["date", "title_ko"], onUpdate: apply }).then(apply).catch(function () { A.status(refs.body, "소식을 불러오지 못했습니다."); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
