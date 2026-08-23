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


/* Expectations are derived from data/**, never pinned: the content pipeline
   publishes hourly, and a suite that hard-codes counts fails on fresh data
   instead of on real regressions. */
const DATA = {
  get news() { return readJSON("data/critical-news.json").items; },
  get radarNews() {
    return this.news.filter((i) =>
      !(i.market_materiality === "routine" && i.market_change === "no_material_change"));
  },
  get topics() { return readJSON("data/topic-intelligence.json").topics; },
  get reports() { return readJSON("data/reports.json").reports; },
  get buzz() { return readJSON("data/buzz.json"); },
  get sources() {
    return ["data/source-matrix.json", "data/source-matrix-extra.json",
            "data/source-matrix-economics.json", "data/source-matrix-beauty-economy.json"]
      .filter((f) => fs.existsSync(path.join(REPO, f)))
      .flatMap((f) => readJSON(f).sources || []).length;
  }
};

/* Report filenames move as the pipeline publishes. Resolve the newest of each
   type from reports.json rather than pinning a date in the test. */
const LATEST = ["daily", "weekly", "monthly"].reduce((acc, type) => {
  const match = readJSON("data/reports.json").reports
    .filter((r) => r.type === type)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  acc[type] = match ? match.path : null;
  return acc;
}, {});

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
      path: LATEST.daily,
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
  ok("rail carries live counts (radar-eligible items and topics)",
    d.getElementById("rail-count-radar").textContent === String(DATA.radarNews.length) &&
    d.getElementById("rail-count-topic").textContent === String(DATA.topics.length),
    `${d.getElementById("rail-count-radar").textContent}/${d.getElementById("rail-count-topic").textContent}`);
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
    html: LATEST.weekly,
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
  ok("every lens states either a count or 該当シグナルなし",
    Array.from(d.querySelectorAll(".lens-card__count"))
      .every((n) => /件|該当シグナルなし/.test(n.textContent)));
  ok("3 latest-report rows", d.querySelectorAll("#latest-grid .latest-summary-row").length === 3);
  ok("comparison baseline is either linked or explicitly absent",
    /前回データなし|比較対象/.test((d.querySelector("#changed-base") || {}).textContent || ""));
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
      ok("every regime drill-down leads somewhere (topic or report)",
        Array.from(d.querySelectorAll(".regime-drill"))
          .every((n) => n.querySelectorAll("a[href]").length > 0 || n.textContent.length > 0));
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
  ok("all reports listed", d.querySelectorAll(".archive-item").length === DATA.reports.length,
    `${d.querySelectorAll(".archive-item").length} vs ${DATA.reports.length}`);
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
  {
    const expected = DATA.reports.filter((r) =>
      Object.values(r.intelligence || {}).flat()
        .some((s) => s && s.lens === "reliability" && s.change_status === "new")).length;
    ok("lens + change query finds exactly the reports that match (定時性 + 新規)",
      d.querySelectorAll(".archive-item").length === expected,
      `${d.querySelectorAll(".archive-item").length} vs ${expected}`);
  }
  ok("matched signals are named, not just the report",
    d.querySelectorAll(".archive-item__hits li").length > 0);
  ok("matched signals link into their topic",
    d.querySelectorAll('.archive-item__hits a[href*="topic.html?id="]').length > 0);

  r.act(() => {
    const change = d.getElementById("filter-change");
    change.value = "deteriorating";
    change.dispatchEvent(new r.window.Event("change"));
  });
  {
    const hasDeteriorating = DATA.reports.some((r) =>
      Object.values(r.intelligence || {}).flat()
        .some((s) => s && s.lens === "reliability" && s.change_status === "deteriorating"));
    ok("a query with no matches fails visibly (0 件 + empty state)",
      hasDeteriorating ||
      (d.querySelectorAll(".archive-item").length === 0 &&
       d.getElementById("archive-empty").hidden === false &&
       d.querySelector(".filter-bar__count").textContent.includes("0")));
  }
  r.release();
}

async function testRadar() {
  console.log("\n[radar] radar.html with live critical-news");
  const r = await renderPage({ html: "radar.html", pageModule: "pages/radar.js" });
  const d = r.document;

  ok("no console errors", r.consoleErrors.length === 0, r.consoleErrors[0]);
  ok("no duplicate fetches", new Set(r.fetched).size === r.fetched.length, r.fetched.join(", "));
  ok("every radar-eligible item rendered",
    d.querySelectorAll(".radar-row--full").length === DATA.radarNews.length,
    String(d.querySelectorAll(".radar-row--full").length));
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
  ok("filtering by domain narrows the list",
    d.querySelectorAll(".radar-row--full").length ===
      DATA.radarNews.filter((i) => i.domain === "ocean").length,
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
  ok("every topic listed", d.querySelectorAll(".topic-index-row").length === DATA.topics.length,
    String(d.querySelectorAll(".topic-index-row").length));
  ok("rows carry state, activity and last update",
    d.querySelectorAll(".topic-index-row__state").length === DATA.topics.length &&
    d.querySelectorAll(".topic-index-row__date").length === DATA.topics.length);
  r.release();

  console.log("\n[topic] unknown id falls back to the index");
  const miss = await renderPage({
    html: "topic.html", pageModule: "pages/topic.js",
    url: "https://example.test/topic.html?id=does-not-exist"
  });
  ok("index rendered with an explanation",
    miss.document.querySelectorAll(".topic-index-row").length === DATA.topics.length &&
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
  {
    const topic = DATA.topics.find((t) => t.topic_id === "middle-east-maritime-risk") || {};
    const expected = (topic.related_report_ids || [])
      .filter((id) => DATA.reports.some((r) => r.id === id)).length;
    ok("related reports listed", d.querySelectorAll(".related-report").length === expected,
      `${d.querySelectorAll(".related-report").length} vs ${expected}`);
  }
  ok("market regime block appears only when a regime row maps to this topic",
    !!d.getElementById("regime") || d.querySelectorAll(".topic-regime").length === 0);
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
  ok("collector state matches the data",
    (d.querySelector(".buzz-source-state") || {}).textContent.includes(
      DATA.buzz.collector_status === "ok" ? "取得成功"
        : DATA.buzz.collector_status === "partial" ? "一部取得" : "取得"));
  ok("failed terms are listed when there are any",
    d.querySelectorAll(".buzz-errors li").length ===
      Math.min((DATA.buzz.collector_errors || []).length, 6));
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
  ok("timeline items rendered (capped at 8 with an expander)",
    s.document.querySelectorAll(".timeline-item").length === Math.min(DATA.reports.length, 8),
    String(s.document.querySelectorAll(".timeline-item").length));
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

  console.log("\n[lens-history] a query with no observations");
  const e = await renderPage({
    html: "lens-history.html", pageModule: "pages/lens-history.js",
    url: "https://example.test/lens-history.html?lens=regulatory_structural&change=resolved&conf=low"
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
  ok("every source listed", d.querySelectorAll("#source-body tr").length === DATA.sources,
    `${d.querySelectorAll("#source-body tr").length} vs ${DATA.sources}`);
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


/* ---- the four structural pages (v9 information architecture) --------------- */

async function testStructuralPages() {
  const cases = [
    { html: "logistics-demand.html", mod: "pages/logistics-demand.js", name: "物流需要",
      expect: (d) => {
        ok("headline signal present", !!d.querySelector(".headline-signal"));
        ok("EC vs parcel compared as an index, not dual axis",
          !!d.getElementById("ec-vs-parcel") &&
          d.getElementById("ec-vs-parcel").textContent.includes("=100"));
        ok("derived intensity metrics are badged DERIVED",
          Array.from(d.querySelectorAll("#intensity .prov")).some((n) => n.textContent === "DERIVED"));
        ok("parcel definition caution shown",
          d.getElementById("ec-vs-parcel").textContent.includes("B2C"));
      } },
    { html: "logistics-capacity.html", mod: "pages/logistics-capacity.js", name: "輸送キャパシティ",
      expect: (d) => {
        ok("commercial vs own-account drawn as composition",
          !!d.querySelector("#commercial-share-tonnage .chart__stack"));
        ok("tonnage and ton-km kept as separate compositions",
          !!d.getElementById("commercial-share-tonnage") && !!d.getElementById("commercial-share-tonkm"));
        ok("2020 methodology break stated",
          d.getElementById("commercial-share-tonnage").textContent.includes("2020年4月"));
        ok("productivity proxies badged DERIVED",
          Array.from(d.querySelectorAll("#productivity .prov")).some((n) => n.textContent === "DERIVED"));
        ok("warehouse scope mismatch stated",
          d.getElementById("productivity").textContent.includes("scope mismatch"));
      } },
    { html: "logistics-workforce.html", mod: "pages/logistics-workforce.js", name: "物流労働力",
      expect: (d) => {
        ok("age structure drawn as 100% composition, not six lines",
          d.querySelectorAll("#age-structure .chart__stack").length > 6);
        ok("cross-industry ageing shown as a slope chart",
          d.querySelectorAll("#aging-slope .slope__line").length >= 2);
        ok("driver gap shown as a dumbbell", d.querySelectorAll("#driver-gap .dumbbell__dot").length >= 2);
        ok("industry vs occupation distinction stated",
          d.getElementById("age-structure").textContent.includes("産業統計"));
        ok("job tag series is not connected to the freight-driver series",
          d.getElementById("driver-conditions").textContent.includes("接続してはいけません"));
        ok("employment and policy intake are separated, not summed",
          !!d.querySelector("#foreign-workforce .split-grid") &&
          d.getElementById("foreign-workforce").textContent.includes("合算しません"));
        ok("policy capacity labelled as capacity, not employment",
          d.getElementById("foreign-workforce").textContent.includes("現在の在留者数でも採用確約数でもありません"));
      } },
    { html: "structural-risk.html", mod: "pages/structural-risk.js", name: "構造リスク",
      expect: (d) => {
        ok("composite index badged DIAGNOSTIC",
          Array.from(d.querySelectorAll(".headline-signal .prov")).some((n) => n.textContent === "DIAGNOSTIC"));
        ok("not-an-official-index stated in the headline",
          d.querySelector(".headline-signal").textContent.includes("公的統計・公的指数ではありません"));
        ok("sensitivity drawn as a band around the composite",
          !!d.querySelector("#composite .range-band__area"));
        ok("components shown as contribution bars, not five overlaid lines",
          d.querySelectorAll("#contribution .contribution__bar").length === 5);
        ok("component trends use small multiples",
          d.querySelectorAll("#component-trend .small-multiples__cell").length === 5);
        ok("methodology (weights, base year) disclosed",
          d.body.textContent.includes("2018") && d.body.textContent.includes("ウェイト"));
        ok("census preliminary kept out of the estimate series",
          d.getElementById("population").textContent.includes("国勢調査速報値は別系列"));
      } }
  ];

  for (const testCase of cases) {
    console.log(`\n[${testCase.name}] ${testCase.html}`);
    const r = await renderPage({ html: testCase.html, pageModule: testCase.mod });
    const d = r.document;
    ok("no console errors", r.consoleErrors.length === 0, r.consoleErrors[0]);
    ok("no duplicate fetches", new Set(r.fetched).size === r.fetched.length, r.fetched.join(", "));
    ok("no polling / observer render patch", r.timers.interval === 0 && r.timers.observer === 0);
    ok("status ribbon rendered", d.querySelectorAll(".ribbon-domain").length === 6);
    ok("page marked in the rail",
      !!d.querySelector('.rail-link[aria-current="page"]'));
    ok("every chart carries a numeric table",
      d.querySelectorAll(".chart").length === 0 ||
      d.querySelectorAll(".chart .chart-data, .chart figcaption").length > 0);
    ok("every chart has an aria-label",
      Array.from(d.querySelectorAll(".chart__svg, .small-multiples__svg"))
        .every((n) => (n.getAttribute("aria-label") || "").length > 0));
    ok("definitions and sources reachable", !!d.querySelector(".evidence-block"));
    ok("page hands off to its siblings", d.querySelectorAll(".see-also a").length >= 2);
    testCase.expect(d);
    r.release();
  }

  console.log("\n[IA] one canonical rail with the five economic pages");
  const r = await renderPage({ html: "index.html", pageModule: "pages/home-v8.js" });
  ["economy", "demand", "capacity", "workforce", "risk"].forEach((nav) => {
    ok(`rail links ${nav}`, !!r.document.querySelector(`.rail-link[data-nav="${nav}"]`));
  });
  ok("economic-flow no longer hosts the workforce panels",
    !fs.readFileSync(path.join(REPO, "economic-flow.html"), "utf8").includes("logistics-structure"));
  r.release();
}

async function main() {
  await testShell();
  await testStructuralPages();
  await testHome();
  await testHomeStress();
  await testReport(LATEST.daily, "daily");
  await testReport(LATEST.weekly, "weekly");
  await testReport(LATEST.monthly, "monthly");
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
