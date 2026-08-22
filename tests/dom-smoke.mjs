/* =========================================================================
   tests/dom-smoke.mjs — render every page in jsdom against the REAL data in
   data/**, plus synthetic stress cases for the repeating components.
   -------------------------------------------------------------------------
   Run:  npm install jsdom   (dev only — the site itself has no dependencies)
         node tests/dom-smoke.mjs

   What it asserts, in order of what has actually broken before:
     - every page renders without throwing and without console errors;
     - each data file is fetched at most once per page (the v2.x dashboard
       fetched reports.json twice and report pages three times);
     - no setInterval / setTimeout / MutationObserver render patching;
     - drill targets are real <a href>, not div[role=link];
     - repeating components stay bounded at 1 / 5 / 10 / 20 items;
     - the live edge cases render: unknown market dimensions, null outlook,
       empty data_points, partial Buzz, month-crossing EC events, reported vs
       observed, missing comparison baseline.
   ========================================================================= */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

let failures = 0;
let checks = 0;

function ok(name, condition, detail) {
  checks++;
  if (condition) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const readJSON = (rel) => JSON.parse(fs.readFileSync(path.join(REPO, rel), "utf8"));

/**
 * Boot one page in jsdom with a fetch that serves the repo's own data files
 * (or an override map, for stress cases).
 */
async function renderPage({ html, pageModule, url = "https://example.test/", overrides = {} }) {
  const dom = new JSDOM(fs.readFileSync(path.join(REPO, html), "utf8"), { url, pretendToBeVisual: true });
  const { window } = dom;

  const fetched = [];
  const consoleErrors = [];
  const consoleWarnings = [];
  const timers = { interval: 0, timeout: 0, observer: 0 };

  window.fetch = (target) => {
    const rel = String(target).replace(/^.*?(data\/)/, "$1").split("?")[0];
    fetched.push(rel);
    const body = Object.prototype.hasOwnProperty.call(overrides, rel)
      ? overrides[rel]
      : (fs.existsSync(path.join(REPO, rel)) ? readJSON(rel) : null);
    if (body == null) return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(new Error("404")) });
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  };

  const realInterval = window.setInterval.bind(window);
  window.setInterval = (...args) => { timers.interval++; return realInterval(...args); };
  const realTimeout = window.setTimeout.bind(window);
  window.setTimeout = (...args) => { timers.timeout++; return realTimeout(...args); };
  if (window.MutationObserver) {
    const RealMO = window.MutationObserver;
    window.MutationObserver = class extends RealMO { constructor(cb) { timers.observer++; super(cb); } };
  }

  // Expose the browser globals the modules use, for the whole scenario:
  // event handlers run after init(), so the globals cannot be torn down early.
  const g = globalThis;
  const saved = {};
  const names = ["window", "document", "location", "history", "fetch", "Option", "URLSearchParams",
                 "Node", "HTMLElement", "Element", "CustomEvent", "Event", "getComputedStyle",
                 "localStorage", "KeyboardEvent"];
  const apply = () => { names.forEach((n) => { saved[n] = g[n]; g[n] = window[n]; }); };
  const release = () => { names.forEach((n) => { g[n] = saved[n]; }); };

  apply();
  const realError = console.error;
  const realWarn = console.warn;
  console.error = (...args) => { consoleErrors.push(args.join(" ")); };
  console.warn = (...args) => { consoleWarnings.push(args.join(" ")); };

  try {
    // Node caches modules by URL and every page shares data/store.js, so the
    // request cache has to be cleared between renders.
    const store = await import(pathToFileURL(path.join(REPO, "assets/js/data/store.js")).href);
    store.resetCache();
    // app.js boots the console shell before the page module; do the same here.
    const shell = await import(pathToFileURL(path.join(REPO, "assets/js/core/shell.js")).href);
    shell.initShell();
    const mod = await import(pathToFileURL(path.join(REPO, "assets/js", pageModule)).href);
    await mod.init();
  } finally {
    console.error = realError;
    console.warn = realWarn;
  }

  /** Fire a UI interaction with the page's globals still installed. */
  const act = (fn) => { const out = fn(window); return out; };

  return { dom, window, document: window.document, fetched, consoleErrors, consoleWarnings, timers, act, release };
}

/* ---- synthetic reports for the repeating-component stress test ----------- */

function syntheticReport(signalCount) {
  const signals = Array.from({ length: signalCount }, (_, i) => ({
    id: `ocean-global-price`,
    signal: `合成シグナル ${i + 1}：反復描画の密度確認用のやや長めの本文テキスト。`,
    lens: "cost_capacity",
    direction: ["rising", "falling", "stable", "volatile"][i % 4],
    impact: ["high", "medium", "low"][i % 3],
    change_status: ["deteriorating", "new", "improving", "resolved", "unchanged_high_risk"][i % 5],
    confidence: ["high", "medium", "low"][i % 3],
    evidence: [{ class: "market_data", source: "Drewry", date: "2026-08-20", url: "https://example.test/" }],
    operational_implication: "運用への含意（合成）。"
  }));
  return {
    schema_version: "2.1",
    reports: [{
      id: "2026-08-22-daily", date: "2026-08-22", type: "daily", status: "watch",
      title: "合成デイリー", summary: "合成要約。", bottom_line: "合成結論。",
      path: "reports/2026/08/2026-08-22-daily.html",
      status_board: { domestic: "watch", weather: "unconfirmed", customs: "normal", ocean: "watch", air: "unconfirmed", global: "watch" },
      intelligence: { disruption: [], cost_capacity: signals, reliability: [], demand_commerce: [], regulatory_structural: [] },
      change_summary: { comparison_base: null, new: [], deteriorating: [], improving: [], resolved: [], unchanged_high_risk: [] },
      tags: [], key_issues: []
    }]
  };
}

/* ---- suites --------------------------------------------------------------- */

async function testShell() {
  console.log("\n[console] the persistent shell");
  const r = await renderPage({ html: "index.html", pageModule: "pages/home.js" });
  const d = r.document;

  ok("ribbon renders overall state, action, six domains, radar and stamp",
    !!d.querySelector(".ribbon-state") && !!d.querySelector(".ribbon-action") &&
    d.querySelectorAll(".ribbon-domain").length === 6 &&
    !!d.querySelector(".ribbon-radar") && !!d.querySelector(".ribbon-stamp"));
  ok("ribbon state is a word, not just a colour",
    d.querySelector(".ribbon-state").textContent.trim().length > 0);
  ok("each ribbon domain links to its history",
    Array.from(d.querySelectorAll(".ribbon-domain"))
      .every((a) => a.getAttribute("href").includes("status-history.html?domain=")));
  ok("rail carries live counts", d.getElementById("rail-count-radar").textContent === "6" &&
    d.getElementById("rail-count-topic").textContent === "7");
  ok("radar count flags observed impact",
    d.getElementById("rail-count-radar").getAttribute("data-tone") === "alert");
  ok("current page marked in the rail",
    d.querySelector('.rail-link[data-nav="home"]').getAttribute("aria-current") === "page");

  /* Preferences */
  r.act(() => d.getElementById("tool-density").dispatchEvent(new r.window.Event("click")));
  ok("density toggle sets the attribute and persists",
    d.documentElement.getAttribute("data-density") === "compact" &&
    r.window.localStorage.getItem("lbi:density") === "compact");
  r.act(() => d.getElementById("tool-density").dispatchEvent(new r.window.Event("click")));
  ok("density toggle clears cleanly", !d.documentElement.hasAttribute("data-density"));

  r.act(() => d.getElementById("tool-theme").dispatchEvent(new r.window.Event("click")));
  ok("theme cycles auto → light", d.documentElement.getAttribute("data-theme") === "light");
  r.act(() => d.getElementById("tool-theme").dispatchEvent(new r.window.Event("click")));
  ok("theme cycles light → dark", d.documentElement.getAttribute("data-theme") === "dark");
  r.act(() => d.getElementById("tool-theme").dispatchEvent(new r.window.Event("click")));
  ok("theme cycles dark → auto", !d.documentElement.hasAttribute("data-theme"));

  /* Keyboard */
  r.act(() => d.dispatchEvent(new r.window.KeyboardEvent("keydown", { key: "?", bubbles: true })));
  ok("? opens the shortcut sheet", d.getElementById("help-sheet").hidden === false);
  r.act(() => d.dispatchEvent(new r.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  ok("Esc closes it", d.getElementById("help-sheet").hidden === true);

  const field = d.querySelector('input[type="search"]') || d.createElement("input");
  r.act(() => {
    const input = d.createElement("input");
    input.type = "text";
    d.body.appendChild(input);
    input.dispatchEvent(new r.window.KeyboardEvent("keydown", { key: "?", bubbles: true }));
  });
  ok("shortcuts do not fire while typing in a field", d.getElementById("help-sheet").hidden === true);
  r.release();

  console.log("\n[console] ribbon on a report page (three clicks deep)");
  const rep = await renderPage({
    html: "reports/2026/08/2026-08-22-weekly.html",
    pageModule: "pages/report.js",
    url: "https://example.test/reports/2026/08/2026-08-22-weekly.html"
  });
  ok("the same ribbon renders inside a report",
    rep.document.querySelectorAll(".ribbon-domain").length === 6);
  ok("its domain links resolve from three levels down",
    rep.document.querySelector(".ribbon-domain").getAttribute("href")
      .startsWith("../../../status-history.html"));
  rep.release();
}

async function testHome() {
  console.log("\n[home] index.html with live data");
  const r = await renderPage({ html: "index.html", pageModule: "pages/home.js" });
  const d = r.document;

  ok("renders without console errors", r.consoleErrors.length === 0, r.consoleErrors[0]);
  ok("fetches reports.json exactly once",
    r.fetched.filter((f) => f === "data/reports.json").length === 1,
    `got ${r.fetched.filter((f) => f === "data/reports.json").length}`);
  ok("no duplicate fetches at all", new Set(r.fetched).size === r.fetched.length, r.fetched.join(", "));
  ok("no polling / observer render patch",
    r.timers.interval === 0 && r.timers.observer === 0,
    `interval=${r.timers.interval} observer=${r.timers.observer}`);
  ok("6 status cells, all real links",
    d.querySelectorAll("#status-board a.status-cell[href]").length === 6);
  ok("no div[role=link] anywhere", d.querySelectorAll('div[role="link"]').length === 0);
  ok("5 lens cards, all real links", d.querySelectorAll("#lens-grid a.lens-card[href]").length === 5);
  ok("lens labels are Japanese-only",
    Array.from(d.querySelectorAll(".lens-card__name")).every((n) => !/[A-Za-z]/.test(n.textContent)),
    Array.from(d.querySelectorAll(".lens-card__name")).map((n) => n.textContent).join(" / "));
  ok("empty lenses say 該当シグナルなし rather than rendering blank",
    Array.from(d.querySelectorAll(".lens-card__count")).some((n) => n.textContent.includes("該当シグナルなし")));
  ok("3 latest-report rows", d.querySelectorAll("#latest-grid .latest-summary-row").length === 3);
  ok("missing comparison baseline is stated, not silent",
    (d.querySelector("#changed-base") || {}).textContent.includes("前回データなし"));
  ok("normal telemetry is not promoted into key signals",
    !Array.from(d.querySelectorAll("#key-signals .sig-card__name"))
      .some((n) => n.textContent.includes("通関・NACCS")));
  ok("status stamp filled", (d.querySelector("#data-stamp") || {}).textContent !== "—");
  r.release();
}

async function testHomeStress() {
  for (const n of [1, 5, 10, 20]) {
    console.log(`\n[stress] dashboard signal list with ${n} item(s)`);
    const r = await renderPage({
      html: "index.html",
      pageModule: "pages/home.js",
      overrides: { "data/reports.json": syntheticReport(n) }
    });
    const d = r.document;
    const rendered = d.querySelectorAll("#key-signals .sig-card").length;
    const more = d.querySelectorAll("#key-signals .row-more").length;

    ok(`key signals capped at 5 (rendered ${rendered})`, rendered <= 5);
    ok(`expander shown only when needed (n=${n})`, n > 5 ? more === 1 : more === 0);
    ok("changed list capped at 5",
      d.querySelectorAll("#changed-list .sig-card").length <= 5);
    ok("no console errors", r.consoleErrors.length === 0, r.consoleErrors[0]);

    if (more) {
      r.act(() => d.querySelector("#key-signals .row-more").dispatchEvent(new r.window.Event("click")));
      ok("expander reveals all rows and removes itself",
        d.querySelectorAll("#key-signals .row-more").length === 0 &&
        d.querySelectorAll("#key-signals .sig-card").length === n,
        `${d.querySelectorAll("#key-signals .sig-card").length} of ${n}`);
    }
    r.release();
  }
}

async function testReport(file, type) {
  console.log(`\n[report] ${file}`);
  const r = await renderPage({
    html: file,
    pageModule: "pages/report.js",
    url: `https://example.test/${file}`
  });
  const d = r.document;

  ok("no console errors", r.consoleErrors.length === 0, r.consoleErrors[0]);
  ok("reports.json fetched once", r.fetched.filter((f) => f === "data/reports.json").length === 1);
  ok("日次/週次/月次 nav links resolve to real reports (was href='#')",
    ["daily", "weekly", "monthly"].every((t) => {
      const a = d.getElementById(`nav-latest-${t}`);
      return a && /reports\/\d{4}\/\d{2}\/.+\.html$/.test(a.getAttribute("href"));
    }),
    ["daily", "weekly", "monthly"].map((t) => (d.getElementById(`nav-latest-${t}`) || {}).getAttribute?.("href")).join(" | "));

  if (type === "daily") {
    ok("signal groups rendered", d.querySelectorAll(".signal-lens-group").length >= 1);
    ok("status board kept on daily", !!d.querySelector(".status-board"));
  } else {
    const table = d.querySelector(".market-regime__table");
    ok("market regime table rendered", !!table, r.consoleWarnings.join(" | "));
    if (table) {
      const headers = Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent);
      ok("risk and confidence are separate columns",
        headers.includes("リスク") && headers.includes("確度"), headers.join("/"));
      const rows = Array.from(table.querySelectorAll("tbody tr"));
      const pills = rows.map((tr) => tr.querySelector(".risk-pill"));
      ok("risk pill class matches the risk value, not confidence",
        pills.every((p) => p && p.className.includes(`risk-pill--${{ 高: "high", 中: "medium", 低: "low", 未確認: "unknown" }[p.textContent]}`)),
        pills.map((p) => `${p && p.textContent}:${p && p.className}`).join(" | "));
      ok("unknown dimensions render as 未確認 quietly",
        table.querySelectorAll(".regime-value--unknown").length > 0);
      const drills = d.querySelectorAll(".regime-drill");
      ok("每 regime scope has a drill-down", drills.length === table.querySelectorAll("tbody tr").length);
      ok("dimension evidence reachable from the drill-down",
        d.querySelectorAll(".regime-dimension__evidence li").length > 0);
      ok("dimensions with no evidence say so instead of rendering blank",
        d.querySelectorAll(".regime-dimension__empty").length > 0);
      ok("reported and observed impact are distinguished",
        Array.from(d.querySelectorAll(".regime-events__label")).map((n) => n.textContent).includes("実影響"));
      ok("regime rows link into topic digests",
        d.querySelectorAll('.regime-drill a[href*="topic.html?id="]').length > 0);
      ok("report links back up to its topics",
        d.querySelectorAll('.report-topics a[href*="topic.html?id="]').length > 0);
    }
  }
  r.release();
}

async function testArchive() {
  console.log("\n[archive] archive.html");
  const r = await renderPage({ html: "archive.html", pageModule: "pages/archive.js" });
  const d = r.document;
  ok("no console errors", r.consoleErrors.length === 0, r.consoleErrors[0]);
  ok("all reports listed", d.querySelectorAll(".archive-item").length === 3);
  ok("analytical filters rendered (lens / change / confidence / topic / range)",
    ["filter-lens", "filter-change", "filter-conf", "filter-topic", "filter-from", "filter-to"]
      .every((id) => d.getElementById(id)));
  ok("presets offered", d.querySelectorAll(".preset").length >= 3);

  r.act(() => {
    const typeSelect = d.getElementById("filter-type");
    typeSelect.value = "weekly";
    typeSelect.dispatchEvent(new r.window.Event("change"));
  });
  ok("filtering by type narrows the list", d.querySelectorAll(".archive-item").length === 1);
  ok("filter state is written to the URL", r.window.location.search.includes("type=weekly"),
    r.window.location.search);

  /* The live baseline contains no `deteriorating` signals at all, so the
     spec's reference query legitimately returns nothing. Both halves matter:
     a lens+change query must find its report when one exists, and must fail
     visibly when none does. */
  r.act(() => {
    d.getElementById("filter-type").value = "";
    const lens = d.getElementById("filter-lens");
    const change = d.getElementById("filter-change");
    lens.value = "reliability";
    change.value = "new";
    change.dispatchEvent(new r.window.Event("change"));
  });
  ok("lens + change query finds the weekly (定時性 + 新規)",
    d.querySelectorAll(".archive-item").length === 1,
    `${d.querySelectorAll(".archive-item").length} hits`);
  ok("matched signals are named, not just the report",
    d.querySelectorAll(".archive-item__hits li").length > 0);
  ok("matched signals link into their topic",
    d.querySelectorAll('.archive-item__hits a[href*="topic.html?id="]').length > 0);

  r.act(() => {
    const change = d.getElementById("filter-change");
    change.value = "deteriorating";
    change.dispatchEvent(new r.window.Event("change"));
  });
  ok("a query with no matches fails visibly (0 件 + empty state)",
    d.querySelectorAll(".archive-item").length === 0 &&
    d.getElementById("archive-empty").hidden === false &&
    d.querySelector(".filter-bar__count").textContent.includes("0"));
  r.release();
}

async function testRadar() {
  console.log("\n[radar] radar.html with live critical-news");
  const r = await renderPage({ html: "radar.html", pageModule: "pages/radar.js" });
  const d = r.document;

  ok("no console errors", r.consoleErrors.length === 0, r.consoleErrors[0]);
  ok("no duplicate fetches", new Set(r.fetched).size === r.fetched.length, r.fetched.join(", "));
  ok("all six live items rendered", d.querySelectorAll(".radar-row--full").length === 6);
  ok("grouped by state, observed first",
    Array.from(d.querySelectorAll(".radar-group")).map((g) => g.getAttribute("data-status"))[0] === "observed");
  ok("state is carried by text, not colour alone",
    Array.from(d.querySelectorAll(".radar-row__state")).every((n) => n.textContent.trim().length > 0));
  ok("reported rows say the impact is unconfirmed",
    d.querySelector('.radar-row[data-status="reported"] .radar-block--observed').textContent.includes("未確認"));
  ok("evidence carries a provenance tier", d.querySelectorAll(".radar-row .ev-class[data-tier]").length > 0);
  ok("every row leads into a topic digest",
    d.querySelectorAll('.radar-row a[href*="topic.html?id="]').length >= 6);
  ok("filters rendered", ["filter-status", "filter-domain", "filter-importance", "filter-jp", "filter-from"]
    .every((id) => d.getElementById(id)));

  r.act(() => {
    const domain = d.getElementById("filter-domain");
    domain.value = "ocean";
    domain.dispatchEvent(new r.window.Event("change"));
  });
  ok("filtering by domain narrows the list", d.querySelectorAll(".radar-row--full").length === 4,
    String(d.querySelectorAll(".radar-row--full").length));
  ok("filter state is shareable via the URL", r.window.location.search.includes("domain=ocean"));
  r.release();
}

async function testRadarStress() {
  for (const n of [1, 5, 10, 20]) {
    console.log(`\n[stress] radar with ${n} item(s)`);
    const items = Array.from({ length: n }, (_, i) => ({
      id: `synthetic-${i}`,
      date: `2026-08-${String(1 + (i % 22)).padStart(2, "0")}`,
      headline: `合成レーダー項目 ${i + 1}`,
      domain: ["ocean", "domestic_delivery", "air", "customs"][i % 4],
      importance: ["high", "medium", "low"][i % 3],
      japan_relevance: ["high", "medium", "low"][i % 3],
      status: ["observed", "reported", "resolved"][i % 3],
      summary: "合成の概要テキスト。",
      observed_impact: i % 3 === 0 ? "合成の実影響。" : null,
      japan_implication: "合成の日本影響。",
      operational_implication: "合成の業務含意。",
      topic_ids: ["ocean-global-price"],
      evidence: [{ class: "market_data", source: "Synthetic", date: "2026-08-20", url: "https://example.test/" }]
    }));
    const r = await renderPage({
      html: "radar.html", pageModule: "pages/radar.js",
      overrides: { "data/critical-news.json": { items } }
    });
    const d = r.document;
    const groups = d.querySelectorAll(".radar-group");
    const rows = d.querySelectorAll(".radar-row--full");
    ok(`renders ${n} item(s) without errors`, r.consoleErrors.length === 0, r.consoleErrors[0]);
    ok("each group caps at 6 rows",
      Array.from(groups).every((g) => g.querySelectorAll(".radar-row--full").length <= 6),
      `${rows.length} rows in ${groups.length} groups`);
    ok("expanders appear only when a group is over the cap",
      Array.from(groups).every((g) => {
        const shown = g.querySelectorAll(".radar-row--full").length;
        const more = g.querySelectorAll(".row-more").length;
        return shown < 6 ? more === 0 : more <= 1;
      }));
    r.release();
  }
}

async function testTopicIndex() {
  console.log("\n[topic] index (no id)");
  const r = await renderPage({ html: "topic.html", pageModule: "pages/topic.js" });
  const d = r.document;
  ok("no console errors", r.consoleErrors.length === 0, r.consoleErrors[0]);
  ok("all seven topics listed", d.querySelectorAll(".topic-index-row").length === 7);
  ok("rows carry state, activity and last update",
    d.querySelectorAll(".topic-index-row__state").length === 7 &&
    d.querySelectorAll(".topic-index-row__date").length === 7);
  r.release();

  console.log("\n[topic] unknown id falls back to the index");
  const miss = await renderPage({
    html: "topic.html", pageModule: "pages/topic.js",
    url: "https://example.test/topic.html?id=does-not-exist"
  });
  ok("index rendered with an explanation",
    miss.document.querySelectorAll(".topic-index-row").length === 7 &&
    miss.document.body.textContent.includes("見つかりません"));
  miss.release();
}

async function testTopicDigest() {
  console.log("\n[topic] middle-east-maritime-risk (4 developments, 4 data points)");
  const r = await renderPage({
    html: "topic.html", pageModule: "pages/topic.js",
    url: "https://example.test/topic.html?id=middle-east-maritime-risk"
  });
  const d = r.document;
  const order = Array.from(d.querySelectorAll(".topic-section")).map((s) => s.id);

  ok("no console errors", r.consoleErrors.length === 0, r.consoleErrors[0]);
  ok("no duplicate fetches", new Set(r.fetched).size === r.fetched.length, r.fetched.join(", "));
  ok("state, summary and confidence in the header",
    !!d.querySelector(".topic-state") && !!d.querySelector(".topic-summary"));
  ok("mandated reading order: 変化 → 動向 → 含意",
    order.indexOf("changed") < order.indexOf("developments") &&
    order.indexOf("developments") < order.indexOf("implication"),
    order.join(" > "));
  ok("developments rendered as a chronology", d.querySelectorAll(".development").length === 4);
  ok("reported and observed types are labelled differently",
    new Set(Array.from(d.querySelectorAll(".development__type")).map((n) => n.textContent)).size > 1);
  ok("data points rendered", d.querySelectorAll(".metric-block").length === 4);
  ok("single-observation metrics render as values, not charts",
    d.querySelectorAll(".sparkline").length === 0);
  ok("both implications present", d.querySelectorAll(".implication").length === 2);
  ok("only the populated outlook horizons render",
    d.querySelectorAll(".outlook-list__term").length === 2,
    String(d.querySelectorAll(".outlook-list__term").length));
  ok("related radar items shown", d.querySelectorAll("#radar .radar-row--full").length >= 1);
  ok("signal history shown (topic id doubles as signal id)",
    d.querySelectorAll("#history .sig-card").length >= 1);
  ok("related reports listed", d.querySelectorAll(".related-report").length === 3);
  ok("market regime rows linked to this topic", !!d.getElementById("regime"));
  ok("evidence index deduplicated and tiered",
    d.querySelectorAll("#evidence .ev-class[data-tier]").length > 0);
  ok("in-page navigation built from the sections that exist",
    d.querySelectorAll(".topic-toc__link").length === order.length);
  r.release();

  console.log("\n[topic] a metric with a real series draws a sparkline");
  const topicData = JSON.parse(JSON.stringify(readJSON("data/topic-intelligence.json")));
  const target = topicData.topics.find((t) => t.topic_id === "ocean-global-price");
  target.data_points = [
    { date: "2026-08-01", metric: "WCI", value: 4100, unit: "USD/40ft", source: "Drewry" },
    { date: "2026-08-08", metric: "WCI", value: 4350, unit: "USD/40ft", source: "Drewry" },
    { date: "2026-08-15", metric: "WCI", value: 4526, unit: "USD/40ft", source: "Drewry" }
  ];
  const series = await renderPage({
    html: "topic.html", pageModule: "pages/topic.js",
    url: "https://example.test/topic.html?id=ocean-global-price",
    overrides: { "data/topic-intelligence.json": topicData }
  });
  ok("3-point series renders one sparkline with 3 dots",
    series.document.querySelectorAll(".sparkline").length === 1 &&
    series.document.querySelectorAll(".sparkline__dot").length === 3);
  ok("the latest value leads the block",
    series.document.querySelector(".metric-block__value").textContent.includes("4,526"));
  series.release();

  console.log("\n[topic] beauty-luxury-fragrance (no data points, one outlook)");
  const b = await renderPage({
    html: "topic.html", pageModule: "pages/topic.js",
    url: "https://example.test/topic.html?id=beauty-luxury-fragrance"
  });
  const bd = b.document;
  ok("no console errors", b.consoleErrors.length === 0, b.consoleErrors[0]);
  ok("missing data points stated in words, no empty chart",
    bd.querySelectorAll(".sparkline").length === 0 &&
    bd.getElementById("data").textContent.includes("登録されていません"));
  ok("single outlook horizon renders alone", bd.querySelectorAll(".outlook-list__term").length === 1);
  ok("no fabricated radar section when nothing links",
    bd.getElementById("radar").textContent.length > 0);
  b.release();
}

async function testCommerce() {
  console.log("\n[commerce] commerce-calendar.html");
  const r = await renderPage({ html: "commerce-calendar.html", pageModule: "pages/commerce-calendar.js" });
  const d = r.document;
  ok("no console errors", r.consoleErrors.length === 0, r.consoleErrors[0]);
  ok("month grid rendered (8 weekday headers)",
    d.querySelectorAll(".month-calendar__weekday").length === 8);
  ok("ISO week column present", d.querySelectorAll(".month-calendar__week").length >= 4);
  ok("Saturday and Sunday are distinguished",
    d.querySelectorAll(".month-calendar__day.is-sat").length > 0 &&
    d.querySelectorAll(".month-calendar__day.is-sun").length > 0);
  ok("holidays labelled from data/jp-holidays.json",
    d.querySelectorAll(".month-calendar__holiday").length >= 0);
  ok("multi-day events appear on more than one day",
    d.querySelectorAll(".month-calendar__event").length > 3);
  ok("month-crossing events marked as continuing",
    d.querySelectorAll(".month-calendar__event.is-continues-after, .month-calendar__event.is-continues-before").length > 0);
  ok("event list rendered with driver labels",
    d.querySelectorAll(".calendar-event").length === 3 &&
    Array.from(d.querySelectorAll(".calendar-event__driver")).some((n) => n.textContent === "販促"));
  ok("brand × channel table states the empty case honestly",
    (d.getElementById("brand-channel-body") || {}).textContent.includes("蓄積されていません"));
  r.release();
}

async function testBuzz() {
  console.log("\n[buzz] buzz.html (collector_status = partial)");
  const r = await renderPage({ html: "buzz.html", pageModule: "pages/buzz.js" });
  const d = r.document;
  ok("no console errors", r.consoleErrors.length === 0, r.consoleErrors[0]);
  ok("partial collector state is surfaced",
    (d.querySelector(".buzz-source-state") || {}).textContent.includes("一部取得"));
  ok("failed terms are listed", d.querySelectorAll(".buzz-errors li").length === 3);
  ok("observations capped at 10 with an expander",
    d.querySelectorAll(".buzz-item").length === 10 && d.querySelectorAll(".row-more").length === 1);
  ok("每 row shows the base index next to the delta",
    Array.from(d.querySelectorAll(".buzz-item__base")).every((n) => n.textContent.includes("相対値")));
  ok("no signals yet is stated rather than hidden",
    (d.getElementById("buzz-list") || {}).textContent.includes("シグナル化された項目はまだありません"));
  r.release();
}

async function testHistories() {
  console.log("\n[status-history] ?domain=ocean");
  const s = await renderPage({
    html: "status-history.html", pageModule: "pages/status-history.js",
    url: "https://example.test/status-history.html?domain=ocean"
  });
  ok("no console errors", s.consoleErrors.length === 0, s.consoleErrors[0]);
  ok("timeline items rendered", s.document.querySelectorAll(".timeline-item").length === 3);
  ok("title reflects the domain", s.document.getElementById("history-title").textContent.includes("海上輸送"));
  ok("evidence links rendered from the signal records",
    s.document.querySelectorAll(".timeline-evidence a[href]").length > 0);
  s.release();

  console.log("\n[lens-history] ?lens=cost_capacity");
  const l = await renderPage({
    html: "lens-history.html", pageModule: "pages/lens-history.js",
    url: "https://example.test/lens-history.html?lens=cost_capacity"
  });
  ok("no console errors", l.consoleErrors.length === 0, l.consoleErrors[0]);
  ok("groups rendered per signal id", l.document.querySelectorAll(".lens-history-group").length >= 1);
  ok("lens title is Japanese-only",
    !/[A-Za-z]/.test(l.document.getElementById("lens-history-title").textContent));

  console.log("\n[lens-history] empty lens (?lens=regulatory_structural)");
  const e = await renderPage({
    html: "lens-history.html", pageModule: "pages/lens-history.js",
    url: "https://example.test/lens-history.html?lens=regulatory_structural"
  });
  ok("empty state instead of a blank page",
    (e.document.getElementById("lens-history-list") || {}).textContent.includes("該当する観測はありません"));
  ok("the lens switch still offers the other four lenses",
    e.document.querySelectorAll(".lens-switch__item").length === 5);
  ok("switching lens keeps the filter query in the URL",
    Array.from(e.document.querySelectorAll(".lens-switch__item"))
      .every((a) => a.getAttribute("href").includes("lens=")));
  l.release();
  e.release();
}

async function testSources() {
  console.log("\n[sources] source-matrix.html");
  const r = await renderPage({ html: "source-matrix.html", pageModule: "pages/source-matrix.js" });
  const d = r.document;
  ok("no console errors", r.consoleErrors.length === 0, r.consoleErrors[0]);
  ok("all 64 sources listed", d.querySelectorAll("#source-body tr").length === 64,
    String(d.querySelectorAll("#source-body tr").length));
  r.act(() => {
    const domain = d.getElementById("f-domain");
    domain.value = "beauty";
    domain.dispatchEvent(new r.window.Event("change"));
  });
  ok("domain filter narrows the table",
    d.querySelectorAll("#source-body tr").length < 64 &&
    d.querySelectorAll("#source-body tr").length > 0);
  r.release();
}

async function testEmptyState() {
  console.log("\n[empty] dashboard with no reports at all");
  const r = await renderPage({
    html: "index.html", pageModule: "pages/home.js",
    overrides: { "data/reports.json": { schema_version: "2.1", reports: [] } }
  });
  const d = r.document;
  ok("no console errors", r.consoleErrors.length === 0, r.consoleErrors[0]);
  ok("overall falls back to 未確認", d.getElementById("overall").getAttribute("data-status") === "unconfirmed");
  ok("status board still renders 6 domains", d.querySelectorAll("#status-board a.status-cell").length === 6);
  ok("latest rows show the empty state",
    d.querySelectorAll("#latest-grid .latest-summary-row.is-empty").length === 3);
  ok("lens grid still renders 5 lenses", d.querySelectorAll("#lens-grid a.lens-card").length === 5);
  r.release();
}

async function main() {
  await testShell();
  await testHome();
  await testHomeStress();
  await testReport("reports/2026/08/2026-08-22-daily.html", "daily");
  await testReport("reports/2026/08/2026-08-22-weekly.html", "weekly");
  await testReport("reports/2026/08/2026-08-22-monthly.html", "monthly");
  await testRadar();
  await testRadarStress();
  await testTopicIndex();
  await testTopicDigest();
  await testArchive();
  await testCommerce();
  await testBuzz();
  await testHistories();
  await testSources();
  await testEmptyState();

  console.log(`\n${checks} checks, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
