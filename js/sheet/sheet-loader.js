/* ADAM Lab widgets — shared Google Sheet loader (vanilla, no deps).

   ADAM.load(tab, { required: ["col", ...], onUpdate: fn }) — see below:
   cache-first (localStorage, refreshed in the background), then the Sheet
   (gviz CSV, header checked), then the bundled data/<tab>.json.
   ?debug=1 shows source / detected tab / dropped rows; ADAM.track(tab)
   lets each widget report rows it dropped or values it did not recognise.
   Paste builds (dist/*-embed.html) set window.ADAM_ROOT (absolute Pages URL,
   for assets/…) and window.ADAM_INLINE[tab] (rows baked in instead of JSON).

   Also exposes helpers shared by every widget: parseCsv, normalizeDate
   (accepts '2026-08-21', '2026. 8. 21', '26.08.21'), normalizeMonth,
   safeUrl, asset (repo-relative paths, Google Drive share links), el, debounce. */
(function () {
  var ADAM = window.ADAM = window.ADAM || {};

  var script = document.currentScript ||
    Array.prototype.slice.call(document.scripts).filter(function (s) {
      return /sheet-loader\.js/.test(s.src);
    })[0];
  /* Repo root (…/adam-lab-widgets/) = parent of /shared/. */
  ADAM.root = window.ADAM_ROOT ||
    (script && script.src ? new URL("../", script.src).href : new URL("./", location.href).href);

  function pad(n) { return String(n).padStart(2, "0"); }

  /* Stable fragment id for in-site search deep links */
  ADAM.slug = function (value) {
    var s = String(value == null ? "" : value).toLowerCase()
      .replace(/[^\w\uac00-\ud7a3]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72);
    return s || "item";
  };
  ADAM.markKey = function (node, kind, title) {
    if (!node) return "";
    var id = "adam-" + kind + "-" + ADAM.slug(title);
    node.id = id;
    node.setAttribute("data-adam-key", id);
    return id;
  };

  ADAM.normalizeDate = function (value) {
    var s = String(value == null ? "" : value).trim().replace(/\.$/, "");
    if (!s) return "";
    var iso = s.match(/^(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
    if (iso) return iso[1] + "-" + pad(iso[2]) + "-" + pad(iso[3]);
    var short = s.match(/^(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
    if (short) return "20" + short[1] + "-" + pad(short[2]) + "-" + pad(short[3]);
    /* gviz "Date(2026,7,21)" (month is 0-based) */
    var gv = s.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})/);
    if (gv) return gv[1] + "-" + pad(+gv[2] + 1) + "-" + pad(gv[3]);
    return "";
  };

  /* '2026-03', '2026. 3', '2026.03', '26.03', '2026. 3. 1' → '2026-03';
     '2026', '26.XX', '2026.XX', '2026년' → '2026' (year only = month unknown). */
  ADAM.normalizeMonth = function (value) {
    var s = String(value == null ? "" : value).trim().replace(/\.$/, "");
    if (!s) return "";
    var d = ADAM.normalizeDate(s);
    if (d) return d.slice(0, 7);
    var m = s.match(/^(\d{4})\s*[.\-/년]\s*(\d{1,2})(?!\d)/);
    if (m && +m[2] >= 1 && +m[2] <= 12) return m[1] + "-" + pad(m[2]);
    m = s.match(/^(\d{2})\.(\d{1,2})$/);
    if (m && +m[2] >= 1 && +m[2] <= 12) return "20" + m[1] + "-" + pad(m[2]);
    m = s.match(/^(\d{4})/);
    if (m) return m[1];
    m = s.match(/^(\d{2})\s*[.\-/]\s*(?:[xX?]{1,2}|00)$/);
    return m ? "20" + m[1] : "";
  };

  ADAM.safeUrl = function (value) {
    var raw = String(value || "").trim();
    if (!raw) return "";
    try {
      var url = new URL(raw, ADAM.root);
      if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:" || url.protocol === "tel:") return url.href;
    } catch (err) { /* ignore */ }
    return "";
  };

  /* Image cell → URL. Repo paths (assets/…) resolve against ADAM_ASSET_ROOT
     (widgets Pages CDN on adam-lab) or ADAM.root; Drive share links become uc images. */
  ADAM.asset = function (value) {
    var raw = String(value || "").trim();
    if (!raw) return "";
    var id = raw.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{10,})/);
    if (id) return "https://lh3.googleusercontent.com/d/" + id[1] + "=w800";
    if (/^assets\//i.test(raw) && window.ADAM_ASSET_ROOT) {
      try { return new URL(raw, window.ADAM_ASSET_ROOT).href; } catch (err) { /* fall through */ }
    }
    return ADAM.safeUrl(raw);
  };

  ADAM.parseCsv = function (text) {
    var rows = [], row = [], cell = "", quoted = false;
    var s = String(text || "").replace(/^\uFEFF/, "");
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (quoted) {
        if (ch === '"') {
          if (s[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
        } else cell += ch;
        continue;
      }
      if (ch === '"') quoted = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (ch !== "\r") cell += ch;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    if (!rows.length) return { header: [], rows: [] };
    var header = rows[0].map(function (h) { return String(h || "").trim().toLowerCase(); });
    var out = [];
    for (var r = 1; r < rows.length; r++) {
      if (rows[r].every(function (c) { return !String(c || "").trim(); })) continue;
      var obj = {};
      for (var c = 0; c < header.length; c++) {
        if (header[c]) obj[header[c]] = rows[r][c] != null ? String(rows[r][c]).trim() : "";
      }
      out.push(obj);
    }
    return { header: header, rows: out };
  };

  function fetchTimeout(url, ms, opts) {
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms);
    opts = opts || {};
    if (ctrl) opts.signal = ctrl.signal;
    return fetch(url, opts).finally(function () { clearTimeout(timer); });
  }

  ADAM.sheetUrl = function (tab) {
    var map = window.ADAM_SHEETS || {};
    if (typeof map[tab] === "string") return map[tab].trim();
    if (window.ADAM_SHEET_ID) {
      return "https://docs.google.com/spreadsheets/d/" + window.ADAM_SHEET_ID +
        "/gviz/tq?tqx=out:csv&headers=1&sheet=" + encodeURIComponent(tab);
    }
    return "";
  };

  ADAM.params = new URLSearchParams(location.search);
  /* adam-lab site pages can inject params without polluting the URL
     (e.g. alumni=1, recruit=1, block=professor). */
  if (window.ADAM_SITE_PARAMS && typeof window.ADAM_SITE_PARAMS === "object") {
    Object.keys(window.ADAM_SITE_PARAMS).forEach(function (k) {
      var v = window.ADAM_SITE_PARAMS[k];
      if (v == null) ADAM.params.delete(k);
      else ADAM.params.set(k, String(v));
    });
  }
  /* Full-page site host: never use Sites phone-embed chrome unless ?pe=1. */
  if (window.ADAM_SITE && !ADAM.params.has("pe")) ADAM.params.set("pe", "0");
  ADAM.debug = ADAM.params.get("debug") === "1";

  /* Phone-embed ("pe") mode — used by Google Sites fixed-ratio iframes.
     On adam-lab pages pe defaults off so content flows with natural height. */
  ADAM.full = ADAM.params.get("full") === "1";
  var inFrame = (function () { try { return window.self !== window.top; } catch (err) { return true; } })();
  function peCheck() {
    var f = ADAM.params.get("pe"), w = window.innerWidth, h = window.innerHeight;
    var on = f === "1" || (f !== "0" && !ADAM.full && w > 0 && w <= (ADAM.peMax || 560) && h > 0 && (inFrame || h <= 600));
    var de = document.documentElement;
    de.classList.toggle("ax-pe", on);
    de.classList.toggle("ax-pe-tiny", on && h <= 150);
    de.classList.toggle("ax-full", ADAM.full);
    ADAM.pe = on;
  }
  peCheck();
  ADAM.peCheck = peCheck;
  window.addEventListener("resize", peCheck);
  ADAM.fullUrl = function (name) {
    /* paste builds (dist/*-embed.html) run on a googleusercontent URL → link the Pages page */
    var paste = window.ADAM_ROOT && name && location.href.indexOf(window.ADAM_ROOT) !== 0;
    var u = new URL(paste ? window.ADAM_ROOT + name + "/" : location.href);
    u.searchParams.delete("pe");
    u.searchParams.set("full", "1");
    return u.href;
  };

  /* Column signature of every tab — used to say which tab gviz actually
     returned (a missing tab name silently yields the FIRST tab). */
  var SIGNATURES = {
    news: ["date", "title_ko", "tag"],
    publications: ["type", "title", "venue"],
    patents: ["title", "status", "number"],
    awards: ["award", "recipients", "category"],
    members: ["name_ko", "role", "status"],
    projects: ["title", "funder", "org_role"],
    talks: ["date", "title", "venue", "location"],
    gallery: ["caption", "image"],
    sections: ["block", "type", "text"]
  };
  function detectTab(header) {
    var best = "";
    Object.keys(SIGNATURES).forEach(function (t) {
      if (!best && SIGNATURES[t].every(function (c) { return header.indexOf(c) !== -1; })) best = t;
    });
    return best;
  }

  /* ---------- diagnostics (?debug=1) ---------- */
  ADAM.diag = {};
  function diagFor(tab) {
    return ADAM.diag[tab] || (ADAM.diag[tab] = { tab: tab, events: [], dropped: [], warnings: [] });
  }
  function logEvent(d, msg) {
    d.events.push(new Date().toTimeString().slice(0, 8) + " " + msg);
    if (window.console && console.info) console.info("[ADAM] " + d.tab + ": " + msg);
    renderDebug();
  }
  /* Row tracker for widget normalizers: T.drop(i, why), T.warn(i, what), T.done(kept). */
  ADAM.track = function (tab) {
    var d = diagFor(tab);
    function rowName(i) { return (d.source === "sheet" || d.source === "cache" ? "시트 " + (i + 2) + "행" : "항목 " + (i + 1)); }
    return {
      reset: function () { d.dropped = []; d.warnings = []; },
      drop: function (i, why) { d.dropped.push(rowName(i) + ": " + why); },
      warn: function (i, what) { d.warnings.push(rowName(i) + ": " + what); },
      done: function (kept) {
        d.kept = kept;
        if (window.console && (d.dropped.length || d.warnings.length) && console.warn) {
          console.warn("[ADAM] " + tab + ": " + d.dropped.length + " dropped, " + d.warnings.length + " warnings", { dropped: d.dropped, warnings: d.warnings });
        }
        renderDebug();
      }
    };
  };
  var debugBox = null, debugTimer = null;
  function renderDebug() {
    if (!ADAM.debug) return;
    clearTimeout(debugTimer);
    debugTimer = setTimeout(function () {
      if (!document.body) return;
      if (!debugBox) {
        debugBox = document.createElement("details");
        debugBox.className = "adam-debug";
        debugBox.open = true;
        document.body.appendChild(debugBox);
      }
      var html = "<summary>ADAM debug</summary>";
      Object.keys(ADAM.diag).forEach(function (t) {
        var d = ADAM.diag[t];
        var list = function (title, arr) {
          if (!arr || !arr.length) return "";
          return "<div><b>" + title + " (" + arr.length + ")</b><ul>" + arr.slice(0, 40).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") +
            (arr.length > 40 ? "<li>…</li>" : "") + "</ul></div>";
        };
        html += "<section><h4>" + esc(t) + "</h4><dl>" +
          "<dt>source</dt><dd>" + esc(d.source || "…") + (d.refreshed ? " → sheet (refreshed)" : "") + "</dd>" +
          "<dt>sheet tab</dt><dd>" + esc(d.detected ? d.detected + (d.detected === t ? " ✓" : " ✗ (탭 이름 확인)") : (d.sheetError ? "—" : "…")) + "</dd>" +
          (d.header ? "<dt>header</dt><dd>" + esc(d.header.join(", ")) + "</dd>" : "") +
          (d.sheetError ? "<dt>sheet</dt><dd>" + esc(d.sheetError) + "</dd>" : "") +
          "<dt>rows</dt><dd>" + (d.rows != null ? d.rows : "…") + " loaded · " + (d.kept != null ? d.kept : "…") + " shown · " + d.dropped.length + " dropped</dd>" +
          "</dl>" + list("dropped", d.dropped) + list("warnings", d.warnings) + list("log", d.events) + "</section>";
      });
      debugBox.innerHTML = html;
    }, 30);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  if (ADAM.debug) {
    var css = document.createElement("style");
    css.textContent = ".adam-debug{position:fixed;right:8px;bottom:8px;z-index:9999;max-width:min(560px,calc(100vw - 16px));max-height:min(70vh,520px);overflow:auto;" +
      "background:#fff;border:1px solid #102b86;box-shadow:0 8px 24px rgba(16,43,134,.18);font:11px/1.45 'IBM Plex Mono',ui-monospace,monospace;color:#161a2b;padding:6px 10px}" +
      ".adam-debug summary{cursor:pointer;font-weight:600;color:#102b86}.adam-debug h4{margin:8px 0 2px;font-size:12px;color:#102b86}" +
      ".adam-debug dl{display:grid;grid-template-columns:auto 1fr;gap:0 8px;margin:0}.adam-debug dt{color:#5a6378}.adam-debug dd{margin:0;word-break:break-all}" +
      ".adam-debug ul{margin:2px 0 4px;padding-left:16px}.adam-debug section+section{border-top:1px dashed #d8dde8;margin-top:6px}";
    document.head.appendChild(css);
  }

  /* ---------- cache (stale-while-revalidate) ---------- */
  var CACHE_DAYS = 14;
  function cacheKey(tab) { return "adam:" + tab + ":" + (ADAM.sheetUrl(tab) || "").length + ":v2"; }
  function readCache(tab) {
    try {
      var c = JSON.parse(localStorage.getItem(cacheKey(tab)) || "null");
      if (c && Array.isArray(c.rows) && Date.now() - c.t < CACHE_DAYS * 864e5) return c;
    } catch (err) { /* private mode etc. */ }
    return null;
  }
  function writeCache(tab, res) {
    try { localStorage.setItem(cacheKey(tab), JSON.stringify({ t: Date.now(), header: res.header, rows: res.rows })); } catch (err) { /* quota */ }
  }
  function dropCache(tab) { try { localStorage.removeItem(cacheKey(tab)); } catch (err) { /* ignore */ } }

  /* ADAM.load(tab, { required, onUpdate })
       1) cached sheet rows (localStorage) → shown at once, sheet re-fetched in
          the background; if it changed, onUpdate(res) re-renders
       2) no cache → sheet (header checked against `required`; gviz returns
          the FIRST tab for a missing name, so a wrong tab is rejected)
       3) sheet slow (>2.5 s) → bundled data first, sheet result via onUpdate
       4) sheet failed / wrong / empty → ADAM_INLINE[tab] → data/<tab>.json
     Resolves { rows, source: "cache" | "sheet" | "inline" | "json", header }.
     ?source=json skips the sheet, ?nocache=1 skips the cache. */
  ADAM.load = function (tab, opts) {
    opts = opts || {};
    var d = diagFor(tab);
    var required = (opts.required || []).map(function (c) { return c.toLowerCase(); });
    var url = ADAM.sheetUrl(tab);
    if (ADAM.params.get("source") === "json") url = "";
    d.url = url;
    var update = typeof opts.onUpdate === "function" ? opts.onUpdate : null;

    function mark(res, how) {
      d.source = res.source; d.rows = res.rows.length;
      if (res.header) d.header = res.header;
      logEvent(d, how || ("loaded from " + res.source + " (" + res.rows.length + " rows)"));
      return res;
    }

    function fromJson() {
      var inline = window.ADAM_INLINE && window.ADAM_INLINE[tab];
      if (Array.isArray(inline) && inline.length) return Promise.resolve({ rows: inline, source: "inline" });
      return fetchTimeout(ADAM.root + "data/" + tab + ".json", 8000, { cache: "no-cache" })
        .then(function (res) {
          if (!res.ok) throw new Error("json " + res.status);
          return res.json();
        })
        .then(function (data) {
          var list = Array.isArray(data) ? data : (data && data.items) || [];
          return { rows: list, source: "json", header: data && data.columns };
        });
    }

    function fetchSheet() {
      return fetchTimeout(url, 15000, { cache: "no-store", mode: "cors" })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.text();
        })
        .then(function (text) {
          var parsed = ADAM.parseCsv(text);
          d.detected = detectTab(parsed.header) || "(알 수 없음)";
          var missing = required.filter(function (c) { return parsed.header.indexOf(c) === -1; });
          if (missing.length) {
            var e = new Error("header에 " + missing.join(", ") + " 없음 — 받은 탭: " + d.detected + " (탭이 없으면 gviz는 첫 탭을 돌려줌)");
            e.definitive = true; throw e;
          }
          if (!parsed.rows.length) { var e2 = new Error("탭이 비어 있음"); e2.definitive = true; throw e2; }
          return { rows: parsed.rows, source: "sheet", header: parsed.header };
        });
    }

    if (!ADAM.safeUrl(url)) return fromJson().then(function (r) { return mark(r); });

    var sheet = fetchSheet();
    sheet.then(function (res) { writeCache(tab, res); }, function (err) {
      d.sheetError = err.message;
      logEvent(d, "sheet failed: " + err.message);
      if (err.definitive) dropCache(tab);
    });

    var cached = ADAM.params.get("nocache") === "1" ? null : readCache(tab);
    if (cached) {
      sheet.then(function (res) {
        if (JSON.stringify(res.rows) !== JSON.stringify(cached.rows) && update) { d.refreshed = true; update(mark(res, "sheet changed → re-rendered")); }
        else logEvent(d, "sheet checked — cache is current");
      }, function (err) {
        if (err.definitive && update) fromJson().then(function (r) { update(mark(r, "sheet rejected → bundled " + r.source)); });
      });
      return Promise.resolve(mark({ rows: cached.rows, source: "cache", header: cached.header },
        "cache (" + Math.round((Date.now() - cached.t) / 60000) + " min old) shown; refreshing"));
    }

    return new Promise(function (resolve, reject) {
      var settled = false;
      function fallback() { return fromJson().then(function (r) { resolve(mark(r)); }, reject); }
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        logEvent(d, "sheet slow → bundled data first");
        fallback();
        sheet.then(function (res) { if (update) { d.refreshed = true; update(mark(res, "sheet arrived → re-rendered")); } }, function () {});
      }, opts.wait || 2500);
      sheet.then(function (res) {
        if (settled) return;
        settled = true; clearTimeout(timer); resolve(mark(res));
      }, function () {
        if (settled) return;
        settled = true; clearTimeout(timer); fallback();
      });
    });
  };

  /* Tiny DOM helper: el("div", {class: "x", text: "…", onclick: fn}, [children]) */
  ADAM.el = function (tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === "text") node.textContent = v;
        else if (k === "html") node.innerHTML = v;
        else if (k === "class") node.className = v;
        else if (k.slice(0, 2) === "on" && typeof v === "function") node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? "" : v);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  };

  ADAM.debounce = function (fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  };

  /* Normalised text for search (case/space-insensitive, strips * + marks). */
  ADAM.fold = function (s) {
    return String(s || "").toLowerCase().replace(/[*+·]/g, "").replace(/\s+/g, " ");
  };

  /* Lab PI names to emphasise in author lists. */
  ADAM.PI = ["S. Kwon", "권순조", "Soonjo Kwon"];
  ADAM.authors = function (text) {
    var frag = document.createDocumentFragment();
    String(text || "").split(/,\s*/).forEach(function (name, i, arr) {
      var clean = name.replace(/[*+]/g, "").trim();
      var isPI = ADAM.PI.indexOf(clean) !== -1;
      var span = ADAM.el("span", { class: isPI ? "au au-pi" : "au", text: name.trim() });
      frag.appendChild(span);
      if (i < arr.length - 1) frag.appendChild(document.createTextNode(", "));
    });
    return frag;
  };

  /* Research-topic vocabulary for publications/patents (`topics` column,
     semicolon-separated). Cells may use the id, the English or the Korean
     label; anything else is shown as a custom tag. Ids match scripts/tag_topics.py. */
  ADAM.TOPICS = [
    { id: "cad", en: "B-rep / CAD Modeling", ko: "B-rep·CAD 모델링", kos: "CAD 모델링" },
    { id: "assembly", en: "Assembly & Mates", ko: "조립·메이트", kos: "조립·메이트" },
    { id: "am", en: "Additive Manufacturing", ko: "적층제조", kos: "적층제조" },
    { id: "kg", en: "Knowledge Graph / Ontology", ko: "지식 그래프·온톨로지", kos: "지식그래프" },
    { id: "llm", en: "LLM / Generative AI", ko: "LLM·생성형 AI", kos: "LLM·생성형AI" },
    { id: "mesh", en: "Mesh & Point Cloud", ko: "메쉬·점군", kos: "메쉬·점군" },
    { id: "rl", en: "Reinforcement Learning", ko: "강화학습", kos: "강화학습" },
    { id: "edu", en: "CAD Education / Grading", ko: "CAD 교육·자동 채점", kos: "CAD 교육" },
    { id: "design", en: "Product Design", ko: "제품 설계", kos: "제품 설계" },
    { id: "dt", en: "Digital Twin / Smart Manufacturing", ko: "디지털 트윈·스마트 제조", kos: "디지털 트윈" },
    { id: "lca", en: "Sustainability / LCA", ko: "지속가능성·LCA", kos: "지속가능성" },
    { id: "routing", en: "Cable Routing", ko: "케이블 라우팅", kos: "케이블 라우팅" },
    { id: "safety", en: "Safety & Evacuation", ko: "안전·대피", kos: "안전·대피" },
    { id: "ship", en: "Shipbuilding / Ocean", ko: "조선·해양", kos: "조선·해양" },
    { id: "std", en: "Standards (ISO·STEP·AAS)", ko: "표준 (ISO·STEP·AAS)", kos: "표준" }
  ];
  function topicKey(s) { return String(s || "").toLowerCase().replace(/[\s·.\/&()_+-]+/g, ""); }
  var TOPIC_BY = {};
  ADAM.TOPICS.forEach(function (t, i) {
    t.order = i;
    [t.id, t.en, t.ko, t.kos].forEach(function (k) { TOPIC_BY[topicKey(k)] = t; });
  });
  TOPIC_BY[topicKey("B-rep")] = TOPIC_BY[topicKey("CAD")] = ADAM.TOPICS[0];
  ["조립·체결", "적층 제조", "Additive Mfg.", "LLM · GenAI", "Knowledge Graph", "Mesh · Point Cloud", "CAD Modeling", "Assembly",
   "CAD Education", "Digital Twin", "Sustainability", "Safety", "Ship · Ocean", "Standards"].forEach(function (k, i) {
    var ids = ["assembly", "am", "am", "llm", "kg", "mesh", "cad", "assembly", "edu", "dt", "lca", "safety", "ship", "std"];
    ADAM.TOPICS.forEach(function (t) { if (t.id === ids[i]) TOPIC_BY[topicKey(k)] = t; });
  });
  ADAM.topic = function (v) {
    var raw = String(v || "").trim(), k = topicKey(raw);
    if (!k) return null;
    return TOPIC_BY[k] || { id: "x-" + k, en: raw, ko: raw, kos: raw, order: 900, custom: true };
  };
  ADAM.topics = function (cell) {
    var out = [], seen = {};
    String(cell || "").split(/[;,；\n]+/).forEach(function (part) {
      var t = ADAM.topic(part);
      if (t && !seen[t.id]) { seen[t.id] = 1; out.push(t); }
    });
    return out.sort(function (a, b) { return a.order - b.order; });
  };
  /* One clickable tag on an entry. */
  ADAM.topicTag = function (t, active, onPick) {
    var b = ADAM.el("button", { type: "button", class: "ax-tag", "aria-pressed": String(active),
      title: t.custom ? t.en : t.ko + " · " + t.en, text: t.kos, lang: "ko" });
    b.addEventListener("click", function () { onPick(t.id); });
    return b;
  };
  /* Topic filter: a chip row (wide) + a select (narrow, CSS swaps them). */
  ADAM.topicFilter = function (onPick) {
    var el = ADAM.el;
    var row = el("div", { class: "ax-topics", role: "group", "aria-label": "연구 주제 Topics" });
    var sel = el("select", { class: "ax-select ax-topic-select", "aria-label": "연구 주제 Topics" });
    sel.addEventListener("change", function () { onPick(sel.value); });
    function update(present, counts, active) {
      row.innerHTML = ""; sel.innerHTML = "";
      row.hidden = sel.hidden = !present.length;
      if (!present.length) return;
      row.appendChild(el("span", { class: "ax-topics-lb", "aria-hidden": "true" }, [el("span", { class: "ko", text: "연구 주제" }), el("span", { text: "Topics" })]));
      var list = [{ id: "all", kos: "전체", en: "All topics", ko: "전체" }].concat(present);
      list.forEach(function (t) {
        var n = counts[t.id] || 0, on = active === t.id;
        var b = el("button", { type: "button", class: "ax-topic" + (t.id === "all" ? " all" : ""), "aria-pressed": String(on),
          disabled: !n && !on, title: t.id === "all" ? "전체 주제" : t.ko + " · " + t.en }, [
          el("span", { text: t.kos }), el("span", { class: "n", text: String(n) })
        ]);
        b.addEventListener("click", function () { onPick(on && t.id !== "all" ? "all" : t.id); });
        row.appendChild(b);
        sel.appendChild(el("option", { value: t.id, text: t.id === "all" ? "전체 주제 (" + n + ")" : "# " + t.kos + " (" + n + ")" }));
      });
      sel.value = active;
    }
    return { row: row, select: sel, update: update };
  };

  /* Phone-embed chrome for one widget root (see ADAM.pe above). Call once from
     shell(). opts.groups: chip/tile groups to mirror as <select>s (default:
     every .ax-chips in the bar; data-pe-label="상태" prefixes its options);
     opts.title: Korean page name for ?full=1.
     Everything added here is display:none unless html.ax-pe (or .ax-full). */
  var ICON_SEARCH = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m10.4 10.4 3.6 3.6" stroke="currentColor" stroke-width="1.6"/></svg>';
  var ICON_OPEN = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5 8 8M6.5 3.5h-3v9h9v-3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
  function chipLabel(b) {
    var num = b.querySelector(".num, .n");
    var ko = b.querySelector(".ko");
    var main = b.classList.contains("pub-tile") && ko ? ko.textContent.trim() : "";   /* tiles: "국제 학술지 34", not "Int'l journal 34 국제 학술지" */
    if (!main) {
      main = Array.prototype.filter.call(b.querySelectorAll("span"), function (s) { return s !== num && !s.querySelector("span"); })
        .map(function (s) { return s.textContent.trim(); }).filter(Boolean).join(" ");
    }
    if (!main) main = b.textContent.trim();
    return main + (num ? " " + num.textContent.trim() : "");
  }
  function mirror(group) {
    var sel = ADAM.el("select", { class: "ax-select ax-pe-sel", "aria-label": group.getAttribute("aria-label") || "분류" });
    function sync() {
      var btns = group.querySelectorAll("button"), cur = 0, pre = group.getAttribute("data-pe-label");
      sel.innerHTML = "";
      Array.prototype.forEach.call(btns, function (b, i) {
        sel.appendChild(ADAM.el("option", { value: String(i), text: (pre ? pre + " · " : "") + chipLabel(b), disabled: b.disabled }));
        if (b.getAttribute("aria-pressed") === "true") cur = i;
      });
      sel.value = String(cur);
      sel.hidden = group.hidden || btns.length < 2;
    }
    sel.addEventListener("change", function () {
      var b = group.querySelectorAll("button")[+sel.value];
      if (b) b.click();
    });
    new MutationObserver(sync).observe(group, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-pressed", "hidden", "disabled"] });
    sync();
    return sel;
  }
  ADAM.phone = function (root, opts) {
    opts = opts || {};
    var mount = root.parentNode, name = mount && mount.id ? mount.id.replace(/^adam-/, "") : "";
    var el = ADAM.el, bar = opts.bar || root.querySelector(".ax-bar"), url = ADAM.fullUrl(name);
    var open = el("a", { class: "ax-pe-open", href: url, target: "_blank", rel: "noopener",
      title: "새 탭에서 크게 보기", "aria-label": "새 탭에서 크게 보기", html: ICON_OPEN });
    if (opts.open === false) {
      /* text blocks: no ↗ button, only the end link (and only when it scrolls) */
    } else if (bar && !opts.floating) {
      var groups = opts.groups || Array.prototype.slice.call(bar.querySelectorAll(".ax-chips"));
      var first = bar.firstChild;
      groups.forEach(function (g) { bar.insertBefore(mirror(g), first); });
      var search = bar.querySelector(".ax-search");
      if (search) {
        var find = el("button", { type: "button", class: "ax-pe-icon", "aria-label": "검색·필터", title: "검색·필터", "aria-expanded": "false", html: ICON_SEARCH });
        find.addEventListener("click", function () {
          var on = !bar.classList.contains("pe-search");
          bar.classList.toggle("pe-search", on);
          find.setAttribute("aria-expanded", String(on));
          var input = search.querySelector("input");
          if (on && input) input.focus();
        });
        bar.appendChild(find);
        /* dot on the magnifier while a folded control (query, .ax-pe-more) is active */
        var mark = function () {
          var on = !!(search.querySelector("input") || {}).value;
          Array.prototype.forEach.call(bar.querySelectorAll(".ax-pe-more"), function (c) {
            if (c.tagName === "SELECT" ? c.selectedIndex > 0 : c.getAttribute("aria-pressed") === "true") on = true;
          });
          find.classList.toggle("on", on);
        };
        bar.addEventListener("input", mark);
        bar.addEventListener("change", mark);
        new MutationObserver(mark).observe(bar, { subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
      }
      bar.appendChild(open);
    } else {
      open.classList.add("floating");
      root.appendChild(open);
    }
    var sentinel = el("i", { class: "ax-pe-mark", "aria-hidden": "true" });
    root.appendChild(sentinel);
    root.appendChild(el("a", { class: "ax-pe-end", href: url, target: "_blank", rel: "noopener" }, [
      el("span", { text: "새 탭에서 전체 화면으로 보기" }), el("span", { class: "ar", text: "↗", "aria-hidden": "true" })
    ]));
    if (opts.title) {
      root.insertBefore(el("div", { class: "ax-fullhead" }, [
        el("span", { class: "ax-kicker", text: "ADAM Lab@PNU" }), el("span", { class: "t", text: opts.title })
      ]), root.firstChild);
    }
    /* fade at the bottom edge while more content is below */
    var de = document.documentElement;
    function edge() {
      de.classList.toggle("ax-pe-below", de.scrollHeight - window.innerHeight - window.pageYOffset > 24);
      /* everything above the end link already fits the iframe → hide the end link */
      de.classList.toggle("ax-pe-fits", sentinel.getBoundingClientRect().top + window.pageYOffset <= window.innerHeight + 2);
    }
    window.addEventListener("scroll", edge, { passive: true });
    window.addEventListener("resize", edge);
    new MutationObserver(ADAM.debounce(edge, 60)).observe(root, { childList: true, subtree: true });
    edge();
  };

  ADAM.status = function (mount, message, kind) {
    mount.innerHTML = "";
    mount.appendChild(ADAM.el("p", { class: "adam-state " + (kind || ""), text: message }));
  };
})();
