/* Invited talks — sheet tab `talks`. Columns: date,title,venue,location,link */
(function () {
  var A = window.ADAM, el = A.el;
  var mount = document.getElementById("adam-talks");
  if (!mount) return;
  var state = { items: [], lang: "all", q: "" };
  var refs = {};

  var T = A.track("talks");
  function normalize(rows) {
    var out = [];
    T.reset();
    rows.forEach(function (r, i) {
      var title = (r.title || "").trim(), date = A.normalizeDate(r.date);
      if (!title) { T.drop(i, "title 비어 있음"); return; }
      if (!date) { T.drop(i, title.slice(0, 30) + ": date '" + (r.date || "") + "' 날짜로 못 읽음"); return; }
      out.push({ date: date, title: title, venue: r.venue || "", location: r.location || "", link: A.safeUrl(r.link), order: i,
        lang: /[가-힣]/.test(title) ? "ko" : "en", hay: A.fold([title, r.venue, r.location, date].join(" ")) });
    });
    out.sort(function (a, b) { return a.date === b.date ? a.order - b.order : (a.date < b.date ? 1 : -1); });
    T.done(out.length);
    return out;
  }

  function shell() {
    mount.innerHTML = "";
    refs.head = el("div", { class: "tk-head" });
    refs.chips = el("div", { class: "ax-chips", role: "group", "aria-label": "언어" });
    refs.q = el("input", { type: "search", placeholder: "제목·기관·지역 검색", "aria-label": "초청 강연 검색" });
    var search = el("label", { class: "ax-search" }, [
      el("span", { html: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m10.4 10.4 3.6 3.6" stroke="currentColor" stroke-width="1.5"/></svg>' }),
      refs.q
    ]);
    refs.count = el("span", { class: "ax-count", "aria-live": "polite" });
    refs.list = el("div", {});
    var root = el("div", { class: "ax-root tk" }, [refs.head, el("div", { class: "ax-bar" }, [refs.chips, search, el("span", { class: "ax-grow" }), refs.count]), refs.list]);
    mount.appendChild(root);
    A.phone(root, { title: "초청 강연 Invited Talks" });
    refs.q.addEventListener("input", A.debounce(function () { state.q = refs.q.value; render(); }, 120));
    for (var i = 0; i < 4; i++) refs.list.appendChild(el("div", { class: "ax-skel", "aria-hidden": "true", style: "height:48px" }));
  }

  function renderHead() {
    var ys = {}, max = 1;
    state.items.forEach(function (it) { var y = it.date.slice(0, 4); ys[y] = (ys[y] || 0) + 1; if (ys[y] > max) max = ys[y]; });
    var keys = Object.keys(ys).sort(), first = +keys[0], last = +keys[keys.length - 1];
    refs.head.innerHTML = "";
    refs.head.appendChild(el("div", { class: "tk-total" }, [el("b", { text: String(state.items.length) }), el("span", { text: "Invited talks · " + first + "–" + last })]));
    var spark = el("div", { class: "tk-spark", "aria-hidden": "true" });
    for (var y = first; y <= last; y++) {
      var n = ys[y] || 0;
      spark.appendChild(el("i", { class: n === max ? "hi" : "", style: "height:" + Math.max(6, Math.round(n / max * 100)) + "%", title: y + ": " + n }));
    }
    refs.head.appendChild(spark);
  }

  function matches(it, skipLang) {
    if (!skipLang && state.lang !== "all" && it.lang !== state.lang) return false;
    if (state.q) {
      var words = A.fold(state.q).trim().split(" ");
      for (var i = 0; i < words.length; i++) if (words[i] && it.hay.indexOf(words[i]) === -1) return false;
    }
    return true;
  }

  function render() {
    var c = { all: 0, ko: 0, en: 0 };
    state.items.forEach(function (it) { if (matches(it, true)) { c.all++; c[it.lang]++; } });
    refs.chips.innerHTML = "";
    [{ id: "all", ko: "전체" }, { id: "ko", ko: "국문" }, { id: "en", ko: "영문" }].forEach(function (x) {
      var b = el("button", { type: "button", class: "ax-chip", "aria-pressed": String(state.lang === x.id) }, [
        x.ko ? el("span", { class: "ko", text: x.ko }) : el("span", { text: x.lb }), el("span", { class: "n", text: String(c[x.id]) })]);
      b.addEventListener("click", function () { state.lang = x.id; render(); });
      refs.chips.appendChild(b);
    });
    var shown = state.items.filter(function (it) { return matches(it); });
    refs.count.textContent = shown.length + " / " + state.items.length;
    refs.list.innerHTML = "";
    if (!shown.length) { refs.list.appendChild(el("p", { class: "adam-state", text: "조건에 맞는 강연이 없습니다." })); return; }
    var groups = [], cur = null;
    shown.forEach(function (it) {
      var y = it.date.slice(0, 4);
      if (!cur || cur.y !== y) { cur = { y: y, items: [] }; groups.push(cur); }
      cur.items.push(it);
    });
    groups.forEach(function (g) {
      var ul = el("ul", { class: "tk-list" });
      g.items.forEach(function (it) {
        var title = el("h4", { class: "tk-title" });
        if (it.link) title.appendChild(el("a", { href: it.link, target: "_blank", rel: "noopener", text: it.title })); else title.textContent = it.title;
        ul.appendChild(el("li", { class: "tk-item" }, [
          el("div", { class: "tk-date" }, [it.date.slice(5).replace("-", "."), el("small", { text: it.date.slice(0, 4) })]),
          el("div", {}, [title, el("div", { class: "tk-sub" }, [
            it.venue ? el("span", { text: it.venue }) : null,
            it.location ? el("span", { class: "tk-loc" + (/온라인|online/i.test(it.location) ? " online" : ""), text: it.location }) : null
          ])])
        ]));
      });
      refs.list.appendChild(el("section", { class: "tk-year ax-in" }, [
        el("h3", { class: "tk-yh" }, [g.y, el("span", { class: "ax-count", text: g.items.length + (g.items.length > 1 ? " talks" : " talk") })]), ul
      ]));
    });
  }

  function boot() {
    shell();
    function apply(res) {
      state.items = normalize(res.rows);
      if (!state.items.length) { A.status(refs.list, "표시할 강연이 없습니다."); return; }
      renderHead(); render();
    }
    A.load("talks", { required: ["date", "title", "venue", "location"], onUpdate: apply }).then(apply).catch(function () { A.status(refs.list, "초청 강연 목록을 불러오지 못했습니다."); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
