/* Research projects — sheet tab `projects`.
   Columns: title,org_role,researcher_role,program,funder,start,end,group,status,recruit,hidden,logo,link
   status blank → automatic from start/end vs. today (ongoing / completed / upcoming).
   recruit=Y → shown with ?recruit=1 (Team/Recruiting).  hidden=Y → never shown.
   start/end: '2026-03' (bar drawn) · '2026' / '26.XX' (year only → no progress bar).
   URL params: ?recruit=1 &status=ongoing|completed &group=PNU|KIT &compact=1 (no header/toolbar) */
(function () {
  var A = window.ADAM, el = A.el;
  var mount = document.getElementById("adam-projects");
  if (!mount) return;

  var GROUPS = { PNU: { t: "Projects @ PNU", ko: "부산대학교" }, KIT: { t: "Projects @ KIT", ko: "국립금오공과대학교" },
    OTHER: { t: "Projects", ko: "소속 미지정 (group 칸 확인)" } };
  var ST = { ongoing: { lb: "Ongoing", ko: "진행중" }, upcoming: { lb: "Upcoming", ko: "예정" }, completed: { lb: "Completed", ko: "종료" } };
  var p = A.params;
  var compact = p.get("compact") === "1";
  var recruitOnly = p.get("recruit") === "1";
  function yes(v) { return /^(y|yes|true|1|o|예|✓|v)$/i.test(String(v || "").trim()); }
  var lockGroup = (p.get("group") || "").toUpperCase();
  var state = { items: [], status: (p.get("status") || "all").toLowerCase(), group: lockGroup || "all" };
  var refs = {};
  var now = new Date();
  var NOW = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");

  function monthIndex(ym, end) {
    if (!ym) return null;
    var y = +ym.slice(0, 4), m = ym.length > 4 ? +ym.slice(5, 7) : (end ? 12 : 1);
    return y * 12 + (m - 1) + (end ? 1 : 0);
  }

  function autoStatus(start, end) {
    var n = monthIndex(NOW), s = monthIndex(start), e = monthIndex(end, true);
    if (s != null && s > n) return "upcoming";
    if (e != null && e <= n) return "completed";
    return "ongoing";
  }

  var T = A.track("projects");
  function normalize(rows) {
    var out = [];
    T.reset();
    rows.forEach(function (r, i) {
      var title = (r.title || "").trim();
      if (!title) { T.drop(i, "title 비어 있음"); return; }
      if (yes(r.hidden)) { T.drop(i, "hidden=Y (숨김)"); return; }
      if (recruitOnly && !yes(r.recruit)) return;   // ?recruit=1 filter, not an error
      var start = A.normalizeMonth(r.start), end = A.normalizeMonth(r.end);
      if (r.start && !start) T.warn(i, "start '" + r.start + "' 날짜로 못 읽음");
      if (r.end && !end) T.warn(i, "end '" + r.end + "' 날짜로 못 읽음");
      var raw = String(r.status || "").trim().toLowerCase();
      var st = /진행|ongoing|active/.test(raw) ? "ongoing" : /종료|완료|complete|done|finished/.test(raw) ? "completed" : /예정|upcoming/.test(raw) ? "upcoming" : "";
      if (raw && !st) T.warn(i, "status '" + r.status + "' 모름 → 기간으로 자동 계산");
      st = st || autoStatus(start, end);
      var group = String(r.group || "").trim().toUpperCase();
      if (!group) { T.warn(i, "group 비어 있음 → '소속 미지정'"); group = "OTHER"; }
      if (lockGroup && group !== lockGroup) return;
      /* progress bar only when both ends have a month */
      var full = start.length === 7 && end.length === 7;
      var s = monthIndex(start), e = monthIndex(end, true), n = monthIndex(NOW);
      var pct = full && e > s ? Math.max(0, Math.min(1, (n - s) / (e - s))) : null;
      out.push({ title: title, org: r.org_role || "", role: r.researcher_role || "", program: r.program || "", funder: r.funder || "",
        start: start, end: end, startRaw: r.start || "", endRaw: r.end || "", group: group, status: st, pct: pct,
        logo: A.asset(r.logo), link: A.safeUrl(r.link), order: i });
    });
    T.done(out.length);
    var rank = { ongoing: 0, upcoming: 1, completed: 2 };
    out.sort(function (a, b) {
      var ga = a.group === "PNU" ? 0 : a.group === "OTHER" ? 2 : 1, gb = b.group === "PNU" ? 0 : b.group === "OTHER" ? 2 : 1;
      if (ga !== gb) return ga - gb;
      if (a.group !== b.group) return a.group < b.group ? -1 : 1;
      return a.order - b.order;
    });
    out.forEach(function (it) { it.rank = rank[it.status]; });
    return out;
  }

  function shell() {
    mount.innerHTML = "";
    refs.head = el("div", { class: "pj-head" });
    refs.chips = el("div", { class: "ax-chips", role: "group", "aria-label": "과제 상태", "data-pe-label": "상태" });
    refs.gchips = el("div", { class: "ax-chips", role: "group", "aria-label": "소속", "data-pe-label": "소속" });
    refs.list = el("div", { class: "pj-list" });
    var bar = el("div", { class: "ax-bar" }, [refs.chips, el("span", { class: "pj-sep", "aria-hidden": "true" }), refs.gchips]);
    var root = refs.root = el("div", { class: "ax-root pj" + (compact ? " compact" : "") }, [compact ? null : refs.head, compact ? null : bar, refs.list]);
    mount.appendChild(root);
    A.phone(root, { title: recruitOnly ? "모집 중인 연구 과제" : "연구 과제 Research Projects" });
    for (var i = 0; i < 3; i++) refs.list.appendChild(el("div", { class: "ax-skel", style: "height:150px", "aria-hidden": "true" }));
  }

  function fmt(ym, raw) {
    if (ym.length === 7) return ym.replace("-", ".");
    if (ym) return /x|\?/i.test(raw) ? ym + ".?" : ym;
    return raw || "—";
  }

  function card(it) {
    var st = ST[it.status];
    var top = el("div", { class: "pj-top" }, [
      it.logo ? el("div", { class: "pj-logo" }, [el("img", { src: it.logo, alt: it.funder || "", loading: "lazy" })])
              : el("div", { class: "pj-funder-mark", text: it.funder }),
      el("span", { class: "pj-pill " + it.status }, [st.lb, el("span", { class: "ko", text: "· " + st.ko })])
    ]);
    var title = el("h4", { class: "pj-title" });
    if (it.link) title.appendChild(el("a", { href: it.link, target: "_blank", rel: "noopener", text: it.title }));
    else title.textContent = it.title;
    var meta = el("div", { class: "pj-meta" }, [
      it.funder ? el("span", { class: "f", text: it.funder }) : null,
      it.funder && it.program ? " · " : null,
      it.program || null
    ]);
    var tags = el("div", { class: "pj-tags" }, [
      it.org ? el("span", { class: "ax-badge ko navy", text: it.org }) : null,
      it.role ? el("span", { class: "ax-badge ko", text: it.role }) : null
    ]);
    var period = el("div", { class: "pj-period" });
    var dates = el("div", { class: "pj-dates" }, [el("span", { text: fmt(it.start, it.startRaw) + " — " + fmt(it.end, it.endRaw) })]);
    if (it.status === "ongoing" && it.pct != null) dates.appendChild(el("span", { class: "pct", text: Math.round(it.pct * 100) + "%" }));
    period.appendChild(dates);
    if (it.pct == null) period.classList.add("no-bar");
    if (it.pct != null) {
      var track = el("div", { class: "pj-track", role: "img", "aria-label": "진행률 " + Math.round(it.pct * 100) + "%" }, [
        el("span", { class: "pj-fill", style: "width:" + (it.pct * 100).toFixed(1) + "%" })
      ]);
      if (it.status === "ongoing") track.appendChild(el("span", { class: "pj-now", style: "left:" + (it.pct * 100).toFixed(1) + "%" }));
      period.appendChild(track);
    }
    return el("article", { class: "pj-card ax-in", "data-status": it.status }, [top, title, meta, tags, period]);
  }

  function matches(it, skip) {
    if (skip !== "status" && state.status !== "all") {
      if (state.status === "ongoing" ? it.status === "completed" : it.status !== state.status) return false;
    }
    if (skip !== "group" && state.group !== "all" && it.group !== state.group) return false;
    return true;
  }

  function chipRow(box, list, key) {
    box.innerHTML = "";
    list.forEach(function (c) {
      var b = el("button", { type: "button", class: "ax-chip", "aria-pressed": String(state[key] === c.id) }, [
        c.lb ? el("span", { text: c.lb }) : null, c.ko ? el("span", { class: "ko", text: c.ko }) : null, el("span", { class: "n", text: String(c.n) })
      ]);
      b.addEventListener("click", function () { state[key] = c.id; render(); });
      box.appendChild(b);
    });
  }

  function render() {
    var on = state.items.filter(function (it) { return it.status !== "completed"; }).length;
    var done = state.items.length - on;
    refs.head.innerHTML = "";
    refs.head.appendChild(el("div", { class: "pj-stat on" }, [el("b", { text: String(on) }), el("span", {}, ["Ongoing", el("i", { text: "진행중" })])]));
    refs.head.appendChild(el("div", { class: "pj-stat" }, [el("b", { text: String(done) }), el("span", {}, ["Completed", el("i", { text: "종료" })])]));
    refs.head.appendChild(el("div", { class: "pj-stat" }, [el("b", { text: String(state.items.length) }), el("span", {}, ["Total", el("i", { text: "전체 과제" })])]));

    var cnt = function (f) { return state.items.filter(function (it) { return matches(it, "status") && f(it); }).length; };
    chipRow(refs.chips, [
      { id: "all", ko: "전체", n: cnt(function () { return true; }) },
      { id: "ongoing", ko: "진행중", n: cnt(function (it) { return it.status !== "completed"; }) },
      { id: "completed", ko: "종료", n: cnt(function (it) { return it.status === "completed"; }) }
    ], "status");
    var groups = [];
    state.items.forEach(function (it) { if (groups.indexOf(it.group) === -1) groups.push(it.group); });
    var gc = function (g) { return state.items.filter(function (it) { return matches(it, "group") && (g === "all" || it.group === g); }).length; };
    chipRow(refs.gchips, [{ id: "all", ko: "전체", n: gc("all") }].concat(groups.map(function (g) {
      return g === "OTHER" ? { id: g, ko: "소속 미지정", n: gc(g) } : { id: g, lb: "@" + g, n: gc(g) };
    })), "group");
    refs.gchips.hidden = groups.length < 2;

    refs.list.innerHTML = "";
    var shown = state.items.filter(function (it) { return matches(it); });
    if (!shown.length) { refs.list.appendChild(el("p", { class: "adam-state", text: "조건에 맞는 과제가 없습니다." })); return; }
    groups.forEach(function (g) {
      var list = shown.filter(function (it) { return it.group === g; });
      if (!list.length) return;
      var grid = el("div", { class: "pj-grid" });
      list.forEach(function (it) { grid.appendChild(card(it)); });
      var info = GROUPS[g] || { t: "Projects @ " + g, ko: "" };
      var sec = el("section", { class: "pj-sec" }, [
        compact ? null : el("h3", { class: "pj-sh" }, [el("span", { class: "t", text: info.t }), el("span", { class: "ko", text: info.ko }), el("span", { class: "ax-count", text: list.length + " projects" })]),
        grid
      ]);
      refs.list.appendChild(sec);
    });
    if (compact && refs.root) refs.root.scrollLeft = 0;   /* phone carousel (html.ax-pe): back to the first card */
  }

  function boot() {
    shell();
    function apply(res) {
      state.items = normalize(res.rows);
      if (!state.items.length) { A.status(refs.list, "표시할 과제가 없습니다."); return; }
      render();
    }
    A.load("projects", { required: ["title", "funder", "org_role"], onUpdate: apply }).then(apply).catch(function () { A.status(refs.list, "과제 목록을 불러오지 못했습니다."); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
