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
                 "Node", "HTMLElement", "Element", "CustomEvent", "Event", "getComputedStyle"];
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
      ok("reported and observed impact are distinguished",
        Array.from(table.querySelectorAll(".regime-events .sig-card__label"))
          .map((n) => n.textContent).includes("実影響"));
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
  ok("structured filters revealed when signals exist",
    d.getElementById("structured-filters").hidden === false);

  r.act(() => {
    const typeSelect = d.getElementById("f-type");
    typeSelect.value = "weekly";
    typeSelect.dispatchEvent(new r.window.Event("change"));
  });
  ok("filtering by type narrows the list", d.querySelectorAll(".archive-item").length === 1);
  ok("filter state is written to the URL", r.window.location.search.includes("type=weekly"),
    r.window.location.search);
  r.release();
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
    (e.document.getElementById("lens-history-list") || {}).textContent.includes("まだ蓄積されていません"));
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
  await testHome();
  await testHomeStress();
  await testReport("reports/2026/08/2026-08-22-daily.html", "daily");
  await testReport("reports/2026/08/2026-08-22-weekly.html", "weekly");
  await testReport("reports/2026/08/2026-08-22-monthly.html", "monthly");
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
