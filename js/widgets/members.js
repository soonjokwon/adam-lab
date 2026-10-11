/* Team — sheet tab `members`.
   Columns: name_ko,name_en,role,position,start,end,status,photo,email,link,affiliation,history,lab
   role: professor | postdoc | phd | ms-phd | ms | undergrad   status: current | alumni
   URL params: ?alumni=1 (open alumni) &join=0 (hide "We're looking for you" cards) */
(function () {
  var A = window.ADAM, el = A.el;
  var mount = document.getElementById("adam-members");
  if (!mount) return;

  var RECRUIT = (window.ADAM_SITE_BASE || "/") + "team/recruiting/";
  var SECTIONS = [
    { id: "researcher", roles: ["postdoc", "researcher"], en: "Researchers", ko: "연구원" },
    { id: "graduate", roles: ["phd", "ms-phd", "ms"], en: "Graduate Students", ko: "대학원생", join: true },
    { id: "undergrad", roles: ["undergrad"], en: "Undergraduate Researchers", ko: "학부연구생", join: true },
    { id: "other", roles: ["other"], en: "Others", ko: "기타 (role 확인)" }
  ];
  var ROLE_ALIAS = { "교수": "professor", "책임자": "professor", pi: "professor", "박사후연구원": "postdoc", "연구원": "researcher",
    "박사과정": "phd", "석박사통합과정": "ms-phd", "통합과정": "ms-phd", "석사과정": "ms", master: "ms", "학부연구생": "undergrad", "학사과정": "undergrad", undergraduate: "undergrad" };
  var ROLE_ORDER = { professor: 0, postdoc: 1, researcher: 2, phd: 3, "ms-phd": 4, ms: 5, undergrad: 6 };   // "other" = unrecognised role
  /* Always show alumni below current on adam-lab Team page (toggle still works if ?alumni=0). */
  var state = {
    items: [],
    filter: "all",
    alumni: A.params.get("alumni") !== "0"
  };
  var showJoin = A.params.get("join") !== "0";
  var refs = {};

  function canonRole(v) {
    var s = String(v || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
    if (ROLE_ORDER[s] != null) return s;
    return ROLE_ALIAS[s] || ROLE_ALIAS[String(v || "").trim()] || "";
  }
  function ymText(v) { var m = A.normalizeMonth(v); return m ? m.replace("-", ".") : ""; }

  var T = A.track("members");
  function normalize(rows) {
    var out = [];
    T.reset();
    rows.forEach(function (r, i) {
      var name = (r.name_ko || "").trim() || (r.name_en || "").trim();
      if (!name) { T.drop(i, "name_ko·name_en 모두 비어 있음"); return; }
      var rawStatus = String(r.status || "").trim().toLowerCase();
      var status = /alum|졸업/.test(rawStatus) ? "alumni" : "current";
      if (rawStatus && !/alum|졸업|current|재학|재직|현재/.test(rawStatus)) T.warn(i, name + ": status '" + r.status + "' 모름 → current");
      var role = canonRole(r.role);
      if (!role) { T.warn(i, name + ": role '" + (r.role || "") + "' 모름 → '기타'"); role = "other"; }
      out.push({ ko: (r.name_ko || "").trim(), en: (r.name_en || "").trim(), name: name, role: role,
        position: r.position || "", start: ymText(r.start), end: ymText(r.end), status: status,
        photo: A.asset(r.photo), email: (r.email || "").trim(), link: A.safeUrl(r.link),
        affiliation: r.affiliation || "", history: r.history || "", lab: r.lab || "", order: i });
    });
    T.done(out.length);
    return out;
  }

  function photo(it, cls) {
    var box = el("div", { class: cls || "mb-photo" });
    var initial = el("span", { class: "mb-initial", text: (it.ko || it.en.replace(/^Dr\.?\s*/, "")).charAt(0), "aria-hidden": "true" });
    box.appendChild(initial);
    if (it.photo) {
      var img = el("img", { src: it.photo, alt: it.name + " 사진" });
      img.addEventListener("load", function () { initial.hidden = true; });
      img.addEventListener("error", function () { img.remove(); initial.hidden = false; });
      box.appendChild(img);
    }
    return box;
  }

  function shell() {
    mount.innerHTML = "";
    refs.chips = el("div", { class: "ax-chips", role: "group", "aria-label": "구성원 분류" });
    refs.count = el("span", { class: "ax-count", "aria-live": "polite" });
    refs.body = el("div", { class: "mb-body-wrap" });
    var root = el("div", { class: "ax-root mb" }, [
      el("div", { class: "ax-bar" }, [refs.chips, el("span", { class: "ax-grow" }), refs.count]),
      refs.body
    ]);
    mount.appendChild(root);
    A.phone(root, { title: "구성원 Team" });
    for (var i = 0; i < 3; i++) refs.body.appendChild(el("div", { class: "ax-skel", "aria-hidden": "true", style: "height:120px" }));
  }

  function piCard(it) {
    var since = it.start ? it.start + " – " + (it.end || "현재") : "";
    return el("article", { class: "mb-pi ax-in" }, [
      photo(it),
      el("div", {}, [
        el("div", { class: "ax-kicker", text: "Principal Investigator · 책임자" }),
        el("h3", { class: "nm" }, [it.ko || it.en, it.ko && it.en ? el("span", { class: "en", text: it.en }) : null]),
        el("div", { class: "pos", text: [it.position, since && "(" + since + ")"].filter(Boolean).join(" ") }),
        it.affiliation ? el("div", { class: "aff", text: it.affiliation }) : null,
        el("div", { class: "act" }, [
          it.email ? el("a", { class: "ax-link mail", href: "mailto:" + it.email, text: it.email, target: "_blank", rel: "noopener" }) : null,
          it.link ? el("a", { class: "ax-link", href: it.link, target: "_blank", rel: "noopener", text: "Profile" }) : null
        ])
      ])
    ]);
  }

  function memberCard(it) {
    var tag = it.link ? "a" : "article";
    var attrs = { class: "mb-card ax-in" };
    if (it.link) { attrs.href = it.link; attrs.target = "_blank"; attrs.rel = "noopener"; }
    if (it.email && !it.link) { tag = "a"; attrs.href = "mailto:" + it.email; attrs.target = "_blank"; attrs.rel = "noopener"; }
    return el(tag, attrs, [
      photo(it),
      el("div", { class: "mb-body" }, [
        el("div", { class: "mb-name", text: it.ko || it.en }),
        it.ko && it.en ? el("div", { class: "mb-en", text: it.en }) : null,
        it.position ? el("div", { class: "mb-pos", text: it.position }) : null,
        it.start ? el("div", { class: "mb-since" }, ["Since ", el("b", { text: it.start })]) : null
      ])
    ]);
  }

  function joinCard() {
    return el("a", { class: "mb-card mb-join", href: RECRUIT, target: "_blank", rel: "noopener" }, [
      el("span", { class: "plus", text: "+", "aria-hidden": "true" }),
      el("span", { class: "t", text: "We're looking for you" }),
      el("span", { class: "s", text: "함께할 학생을 모집합니다" })
    ]);
  }

  function renderChips(current) {
    var counts = { all: current.length };
    var pi = current.filter(function (it) { return it.role === "professor"; }).length;
    counts.pi = pi;
    SECTIONS.forEach(function (s) { counts[s.id] = current.filter(function (it) { return s.roles.indexOf(it.role) !== -1; }).length; });
    refs.chips.innerHTML = "";
    [{ id: "all", ko: "전체" }, { id: "pi", ko: "교수" }].concat(SECTIONS).forEach(function (s) {
      if (s.id !== "all" && !counts[s.id]) return;
      var b = el("button", { type: "button", class: "ax-chip", "aria-pressed": String(state.filter === s.id) }, [
        el("span", { class: "ko", text: s.ko }), el("span", { class: "n", text: String(counts[s.id]) })
      ]);
      b.addEventListener("click", function () { state.filter = s.id; render(); });
      refs.chips.appendChild(b);
    });
  }

  function render() {
    var current = state.items.filter(function (it) { return it.status === "current"; });
    var alumni = state.items.filter(function (it) { return it.status === "alumni"; });
    renderChips(current);
    refs.count.textContent = current.length + " current · " + alumni.length + " alumni";

    refs.body.innerHTML = "";
    var currentBand = el("section", { class: "mb-band mb-band--current", "aria-labelledby": "mb-current-title" });
    currentBand.appendChild(el("header", { class: "mb-band__head" }, [
      el("h2", { id: "mb-current-title", class: "mb-band__title" }, [
        el("span", { class: "en", text: "Current Members" }),
        el("span", { class: "ko", text: "구성원" })
      ]),
      el("p", { class: "mb-band__desc", text: "재학·재직 중인 연구실 구성원" })
    ]));
    var currentBody = el("div", { class: "mb-band__body" });
    var f = state.filter;
    if (f === "all" || f === "pi") {
      current.filter(function (it) { return it.role === "professor"; }).forEach(function (it) { currentBody.appendChild(piCard(it)); });
    }
    SECTIONS.forEach(function (s) {
      if (f !== "all" && f !== s.id) return;
      var list = current.filter(function (it) { return s.roles.indexOf(it.role) !== -1; });
      if (!list.length && !(s.join && showJoin)) return;
      var grid = el("div", { class: "mb-grid" });
      list.forEach(function (it) { grid.appendChild(memberCard(it)); });
      if (s.join && showJoin) grid.appendChild(joinCard());
      currentBody.appendChild(el("section", { class: "mb-sec" }, [
        el("h3", { class: "mb-sh" }, [el("span", { class: "ax-kicker", text: s.en }), el("span", { class: "ko", text: s.ko }),
          el("span", { class: "ax-count", text: String(list.length) })]),
        grid
      ]));
    });
    currentBand.appendChild(currentBody);
    refs.body.appendChild(currentBand);

    refs.alumniSec = null;
    if (alumni.length) {
      var alumBand = el("section", { class: "mb-band mb-band--alumni", "aria-labelledby": "mb-alumni-title" });
      alumBand.appendChild(el("header", { class: "mb-band__head" }, [
        el("h2", { id: "mb-alumni-title", class: "mb-band__title" }, [
          el("span", { class: "en", text: "Alumni" }),
          el("span", { class: "ko", text: "졸업생" })
        ]),
        el("p", { class: "mb-band__desc", text: "연구실을 졸업·수료한 구성원 · " + alumni.length + "명" })
      ]));
      var alumBody = el("div", { class: "mb-band__body" });
      var labs = [];
      alumni.forEach(function (it) { if (labs.indexOf(it.lab) === -1) labs.push(it.lab); });
      labs.forEach(function (lab) {
        if (lab) alumBody.appendChild(el("div", { class: "mb-lab", text: lab }));
        var grid = el("div", { class: "mb-alumni-grid" });
        alumni.filter(function (it) { return it.lab === lab; }).forEach(function (it) {
          var av = el("div", { class: "av", "aria-hidden": "true", text: it.photo ? "" : (it.ko || it.en).charAt(0) });
          if (it.photo) av.appendChild(el("img", { src: it.photo, alt: "", loading: "lazy" }));
          var hist = it.history || [it.position, it.start && "(" + it.start + " ~ " + it.end + ")"].filter(Boolean).join(" ");
          grid.appendChild(el("div", { class: "mb-alum" }, [av, el("div", {}, [
            el("div", { class: "n", text: it.ko || it.en }),
            hist ? el("div", { class: "h", text: hist }) : null,
            it.affiliation ? el("div", { class: "a", text: it.affiliation }) : null
          ])]));
        });
        alumBody.appendChild(grid);
      });
      alumBand.appendChild(alumBody);
      refs.alumniSec = alumBand;
      refs.body.appendChild(alumBand);
    }
  }

  function boot() {
    shell();
    function apply(res) {
      state.items = normalize(res.rows);
      if (!state.items.length) { A.status(refs.body, "표시할 구성원이 없습니다."); return; }
      render();
    }
    A.load("members", { required: ["name_ko", "role", "status"], onUpdate: apply }).then(apply).catch(function () { A.status(refs.body, "구성원 목록을 불러오지 못했습니다."); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
