/* Awards timeline — sheet tab `awards`.
   Columns: date,category,award,recipients,title,event,organizer,link
   category: paper | presentation | competition   URL params: ?category=… */
(function () {
  var A = window.ADAM, el = A.el;
  var mount = document.getElementById("adam-awards");
  if (!mount) return;

  var CATS = [
    { id: "paper", lb: "Paper", ko: "논문" },
    { id: "presentation", lb: "Presentation", ko: "학술발표" },
    { id: "competition", lb: "Competition", ko: "경진대회" },
    { id: "other", lb: "Other", ko: "기타(분류 확인)" }
  ];
  var ALIAS = { "논문": "paper", papers: "paper", journal: "paper", "발표": "presentation", presentations: "presentation", conference: "presentation", poster: "presentation",
    "경진대회": "competition", competitions: "competition", contest: "competition" };
  var CAT_BY = {};
  CATS.forEach(function (c) { CAT_BY[c.id] = c; });
  var MEDAL = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 1h2.2l1 3.2L9.2 1H11L9 6.1" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="10.2" r="4.3" fill="currentColor"/><path d="m8 7.9.7 1.5 1.6.2-1.2 1.1.3 1.6L8 11.5l-1.4.8.3-1.6-1.2-1.1 1.6-.2z" fill="#fff"/></svg>';
  var state = { items: [], cat: canon(A.params.get("category")) || "all", q: "" };
  var refs = {};

  function canon(v) {
    var s = String(v || "").trim().toLowerCase();
    return CAT_BY[s] ? s : (ALIAS[s] || ALIAS[String(v || "").trim()] || "");
  }

  var T = A.track("awards");
  function normalize(rows) {
    var out = [];
    T.reset();
    rows.forEach(function (r, i) {
      var award = (r.award || "").trim();
      var date = A.normalizeDate(r.date);
      if (!award) { T.drop(i, "award 비어 있음"); return; }
      if (!date) { T.drop(i, award + ": date '" + (r.date || "") + "' 날짜로 못 읽음"); return; }
      var cat = canon(r.category);
      if (!cat) { T.warn(i, award + ": category '" + (r.category || "") + "' 모름 → '기타'"); cat = "other"; }
      out.push({ date: date, cat: cat, award: award, recipients: r.recipients || "",
        title: r.title || "", event: r.event || "", organizer: r.organizer || "", link: A.safeUrl(r.link), order: i,
        hay: A.fold([award, r.recipients, r.title, r.event, r.organizer, date].join(" ")) });
    });
    out.sort(function (a, b) { return a.date === b.date ? a.order - b.order : (a.date < b.date ? 1 : -1); });
    T.done(out.length);
    return out;
  }

  function shell() {
    mount.innerHTML = "";
    refs.head = el("div", { class: "aw-head" });
    refs.chips = el("div", { class: "ax-chips", role: "group", "aria-label": "수상 분류" });
    refs.q = el("input", { type: "search", placeholder: "수상명·수상자·대회 검색", "aria-label": "수상 검색" });
    var search = el("label", { class: "ax-search" }, [
      el("span", { html: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m10.4 10.4 3.6 3.6" stroke="currentColor" stroke-width="1.5"/></svg>' }),
      refs.q
    ]);
    refs.count = el("span", { class: "ax-count", "aria-live": "polite" });
    refs.list = el("div", { class: "aw-timeline" });
    var root = el("div", { class: "ax-root aw" }, [
      refs.head,
      el("div", { class: "ax-bar" }, [refs.chips, search, el("span", { class: "ax-grow" }), refs.count]),
      refs.list
    ]);
    mount.appendChild(root);
    A.phone(root, { title: "수상 Awards" });
    refs.q.addEventListener("input", A.debounce(function () { state.q = refs.q.value; render(); }, 120));
    for (var i = 0; i < 4; i++) refs.list.appendChild(el("div", { class: "ax-skel", "aria-hidden": "true" }));
  }

  function matches(it, skipCat) {
    if (!skipCat && state.cat !== "all" && it.cat !== state.cat) return false;
    if (state.q) {
      var words = A.fold(state.q).trim().split(" ");
      for (var i = 0; i < words.length; i++) if (words[i] && it.hay.indexOf(words[i]) === -1) return false;
    }
    return true;
  }

  function renderHead() {
    var c = { paper: 0, presentation: 0, competition: 0, other: 0 };
    state.items.forEach(function (it) { c[it.cat]++; });
    var years = state.items.map(function (it) { return it.date.slice(0, 4); });
    refs.head.innerHTML = "";
    refs.head.appendChild(el("div", { class: "aw-total" }, [
      el("span", { class: "num", text: String(state.items.length) }),
      el("span", { class: "lb", text: "Awards · " + years[years.length - 1] + "–" + years[0] })
    ]));
    var split = el("div", { class: "aw-split" });
    CATS.forEach(function (cat) {
      if (!c[cat.id]) return;
      split.appendChild(el("div", {}, [el("b", { text: String(c[cat.id]) }),
        el("span", {}, [el("i", { class: "aw-dot-" + cat.id }), cat.ko])]));
    });
    refs.head.appendChild(split);
  }

  function renderChips() {
    var counts = { all: 0 };
    state.items.forEach(function (it) { if (matches(it, true)) { counts.all++; counts[it.cat] = (counts[it.cat] || 0) + 1; } });
    refs.chips.innerHTML = "";
    [{ id: "all", lb: "All", ko: "전체" }].concat(CATS).forEach(function (cat) {
      if (cat.id !== "all" && !state.items.some(function (it) { return it.cat === cat.id; })) return;
      var b = el("button", { type: "button", class: "ax-chip", "aria-pressed": String(state.cat === cat.id) }, [
        el("span", { class: "ko", text: cat.ko }), el("span", { class: "n", text: String(counts[cat.id] || 0) })
      ]);
      b.addEventListener("click", function () { state.cat = cat.id; render(); });
      refs.chips.appendChild(b);
    });
  }

  function card(it) {
    var cat = CAT_BY[it.cat];
    var rec = el("div", { class: "aw-rec" });
    rec.appendChild(A.authors(it.recipients));
    var ev = el("div", { class: "aw-event" }, [it.event, it.organizer ? el("span", { class: "org", text: (it.event ? " · " : "") + it.organizer }) : null]);
    return el("article", { class: "aw-card", "data-cat": it.cat }, [
      el("div", { class: "aw-top" }, [el("span", { class: "aw-date", text: it.date.replace(/-/g, ".") }), el("span", { class: "aw-cat", text: cat.lb + " · " + cat.ko })]),
      el("h4", { class: "aw-name" }, [el("span", { html: MEDAL }), el("span", { text: it.award })]),
      it.title ? el("div", { class: "aw-title", text: it.title }) : null,
      it.recipients ? rec : null,
      (it.event || it.organizer) ? ev : null,
      el("div", { class: "aw-foot" }, [it.link ? el("a", { class: "ax-link", href: it.link, target: "_blank", rel: "noopener", text: /doi\.org/.test(it.link) ? "DOI" : "LINK" }) : null])
    ]);
  }

  function render() {
    renderChips();
    var shown = state.items.filter(function (it) { return matches(it); });
    refs.count.textContent = shown.length + " / " + state.items.length;
    refs.list.innerHTML = "";
    if (!shown.length) { refs.list.appendChild(el("p", { class: "pub-empty adam-state", text: "조건에 맞는 수상 내역이 없습니다." })); return; }
    var groups = [], cur = null;
    shown.forEach(function (it) {
      var y = it.date.slice(0, 4);
      if (!cur || cur.y !== y) { cur = { y: y, items: [] }; groups.push(cur); }
      cur.items.push(it);
    });
    groups.forEach(function (g) {
      var grid = el("div", { class: "aw-grid" });
      g.items.forEach(function (it) { grid.appendChild(card(it)); });
      refs.list.appendChild(el("section", { class: "aw-year ax-in" }, [
        el("h3", { class: "aw-ylabel" }, [g.y, el("span", { class: "ax-count", text: g.items.length + (g.items.length > 1 ? " awards" : " award") })]),
        grid
      ]));
    });
  }

  function boot() {
    shell();
    function apply(res) {
      state.items = normalize(res.rows);
      if (!state.items.length) { A.status(refs.list, "표시할 수상 내역이 없습니다."); return; }
      renderHead();
      render();
    }
    A.load("awards", { required: ["date", "award", "recipients", "category"], onUpdate: apply }).then(apply).catch(function () { A.status(refs.list, "수상 내역을 불러오지 못했습니다."); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
