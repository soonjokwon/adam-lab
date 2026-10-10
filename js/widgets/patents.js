/* Patents — sheet tab `patents`. Same visual system as Publications (same Sites page).
   Columns: no,title,topics,status,number,date,link,note   status: registered | filed
   topics: semicolon-separated ids/labels from ADAM.TOPICS (same as publications)
   URL params: ?status= &topic= */
(function () {
  var A = window.ADAM, el = A.el;
  var mount = document.getElementById("adam-patents");
  if (!mount) return;

  var STATUS = {
    registered: { lb: "Registered", ko: "등록", num: "등록번호" },
    filed: { lb: "Filed", ko: "출원", num: "출원번호" },
    other: { lb: "Status?", ko: "상태 확인", num: "번호" }
  };
  var ALIAS = { "등록": "registered", granted: "registered", registration: "registered", "출원": "filed", pending: "filed", application: "filed" };
  var state = { items: [], status: (A.params.get("status") || "all").toLowerCase(), q: "", topic: "all" };
  var topicParam = A.params.get("topic") || "";
  var refs = {};

  function canon(v) {
    var s = String(v || "").trim().toLowerCase();
    return STATUS[s] ? s : (ALIAS[s] || ALIAS[String(v || "").trim()] || "");
  }

  var T = A.track("patents");
  function normalize(rows) {
    var out = [];
    T.reset();
    rows.forEach(function (r, i) {
      var title = (r.title || "").trim();
      if (!title) { T.drop(i, "title 비어 있음"); return; }
      var st = canon(r.status);
      if (!st) { T.warn(i, "status '" + (r.status || "") + "' 모름 → '상태 확인'"); st = "other"; }
      var date = A.normalizeDate(r.date);
      var topics = A.topics(r.topics);
      out.push({ topics: topics, topicIds: topics.map(function (t) { return t.id; }), no: String(r.no || "").replace(/\.0$/, ""), title: title, status: st,
        number: r.number || "", date: date, link: A.safeUrl(r.link), note: r.note || "", order: i,
        hay: A.fold([title, r.number, r.note, date].concat(topics.map(function (t) { return t.en + " " + t.ko; })).join(" ")) });
    });
    out.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (parseInt(b.no, 10) || 0) - (parseInt(a.no, 10) || 0);
    });
    T.done(out.length);
    return out;
  }

  function shell() {
    mount.innerHTML = "";
    refs.tiles = el("div", { class: "pub-tiles", role: "group", "aria-label": "특허 상태" });
    refs.q = el("input", { type: "search", placeholder: "특허명·번호 검색", "aria-label": "특허 검색" });
    var search = el("label", { class: "ax-search" }, [
      el("span", { html: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m10.4 10.4 3.6 3.6" stroke="currentColor" stroke-width="1.5"/></svg>' }),
      refs.q
    ]);
    refs.count = el("span", { class: "ax-count", "aria-live": "polite" });
    refs.list = el("div", { class: "pub-list" });
    refs.topic = A.topicFilter(function (id) { pickTopic(id); });
    refs.topic.row.hidden = refs.topic.select.hidden = true;
    refs.root = el("div", { class: "ax-root pub" }, [
      refs.tiles, refs.topic.row,
      el("div", { class: "ax-bar" }, [search, refs.topic.select, el("span", { class: "ax-grow" }), refs.count]), refs.list
    ]);
    mount.appendChild(refs.root);
    A.phone(refs.root, { groups: [refs.tiles], title: "특허 Patents" });
    refs.q.addEventListener("input", A.debounce(function () { state.q = refs.q.value; render(); }, 120));
    for (var i = 0; i < 4; i++) refs.list.appendChild(el("div", { class: "ax-skel", "aria-hidden": "true" }));
  }

  function pickTopic(id, fromEntry) {
    state.topic = id || "all"; render();
    if (fromEntry) {
      var top = refs.root.getBoundingClientRect().top + window.pageYOffset;
      if (window.pageYOffset > top) window.scrollTo({ top: top, behavior: "smooth" });
    }
  }

  function matches(it, skip) {
    if (skip !== "status" && skip !== true && state.status !== "all" && it.status !== state.status) return false;
    if (skip !== "topic" && state.topic !== "all" && it.topicIds.indexOf(state.topic) === -1) return false;
    if (state.q) {
      var words = A.fold(state.q).trim().split(" ");
      for (var i = 0; i < words.length; i++) if (words[i] && it.hay.indexOf(words[i]) === -1) return false;
    }
    return true;
  }

  function render() {
    var counts = { all: 0, registered: 0, filed: 0, other: 0 };
    state.items.forEach(function (it) { if (matches(it, true)) { counts.all++; counts[it.status]++; } });
    refs.tiles.innerHTML = "";
    var hasOther = state.items.some(function (it) { return it.status === "other"; });
    [{ id: "all", lb: "All", ko: "전체" }, { id: "registered", lb: "Registered", ko: "등록 특허" }, { id: "filed", lb: "Filed", ko: "출원 특허" }]
      .concat(hasOther ? [{ id: "other", lb: "Status?", ko: "상태 확인" }] : [])
      .forEach(function (t) {
        var b = el("button", { type: "button", class: "pub-tile", "aria-pressed": String(state.status === t.id) }, [
          el("span", { class: "lb", text: t.lb }), el("span", { class: "num", text: String(counts[t.id]) }), el("span", { class: "ko", text: t.ko })
        ]);
        b.addEventListener("click", function () { state.status = t.id; render(); });
        refs.tiles.appendChild(b);
      });
    var tc = { all: 0 };
    state.items.forEach(function (it) {
      if (!matches(it, "topic")) return;
      tc.all++;
      it.topicIds.forEach(function (id) { tc[id] = (tc[id] || 0) + 1; });
    });
    refs.topic.update(refs.present, tc, state.topic);

    var shown = state.items.filter(function (it) { return matches(it); });
    refs.count.textContent = shown.length + " / " + state.items.length;
    refs.list.innerHTML = "";
    if (!shown.length) { refs.list.appendChild(el("p", { class: "pub-empty", text: "조건에 맞는 특허가 없습니다." })); return; }

    var groups = [], cur = null;
    shown.forEach(function (it) {
      var y = it.date ? it.date.slice(0, 4) : "—";
      if (!cur || cur.key !== y) { cur = { key: y, items: [] }; groups.push(cur); }
      cur.items.push(it);
    });
    groups.forEach(function (g) {
      var ol = el("ol", { class: "pub-ol" });
      g.items.forEach(function (it) {
        var st = STATUS[it.status];
        var title = el("h4", { class: "pub-title" });
        if (it.link) title.appendChild(el("a", { href: it.link, target: "_blank", rel: "noopener", text: it.title }));
        else title.textContent = it.title;
        var venue = el("div", { class: "pub-venue" }, [
          el("span", { class: "dt", text: st.num + " " + (it.number || "—") + (it.date ? " · " + it.date.replace(/-/g, ".") : "") })
        ]);
        var meta = el("div", { class: "pub-meta" }, [
          el("span", { class: "ax-badge ko " + (it.status === "registered" ? "solid" : it.status === "filed" ? "dash" : ""), text: st.ko + " · " + st.lb.toUpperCase() }),
          it.note ? el("span", { class: "ax-badge ko navy", text: it.note }) : null,
          it.topics.length ? el("span", { class: "pub-tags" }, it.topics.map(function (tp) {
            return A.topicTag(tp, state.topic === tp.id, function (id) { pickTopic(state.topic === id ? "all" : id, true); });
          })) : null,
          it.link ? el("a", { class: "ax-link", href: it.link, target: "_blank", rel: "noopener", text: /doi\.org/.test(it.link) ? "DOI" : "LINK" }) : null
        ]);
        ol.appendChild(el("li", { class: "pub-item" }, [
          el("div", { class: "pub-idx", text: it.no ? "P" + it.no : "·" }),
          el("div", { class: "pub-body" }, [title, venue, meta])
        ]));
      });
      refs.list.appendChild(el("section", { class: "pub-year ax-in" }, [
        el("h3", { class: "pub-yl" }, [g.key, el("span", { class: "ax-count", text: g.items.length + " items" })]), ol
      ]));
    });
  }

  function boot() {
    shell();
    function apply(res) {
      state.items = normalize(res.rows);
      if (!state.items.length) { A.status(refs.list, "표시할 특허가 없습니다."); return; }
      var by = {};
      state.items.forEach(function (it) { it.topics.forEach(function (t) { by[t.id] = t; }); });
      refs.present = Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return a.order - b.order; });
      var tp = A.topic(topicParam);
      if (tp && by[tp.id]) state.topic = tp.id;
      topicParam = "";
      if (state.topic !== "all" && !by[state.topic]) state.topic = "all";
      render();
    }
    A.load("patents", { required: ["title", "status", "number"], onUpdate: apply }).then(apply).catch(function () { A.status(refs.list, "특허 목록을 불러오지 못했습니다."); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
