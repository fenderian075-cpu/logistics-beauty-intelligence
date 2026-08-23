/* =========================================================================
   app.js — the single frontend entry point.
   One module graph, one canonical navigation rail, one render pass.
   ========================================================================= */

import { byId, qs } from "./core/dom.js";
import { initPrint } from "./core/print.js";
import { initShell } from "./core/shell.js";

const PAGES = {
  home: () => import("./pages/home-v8.js"),
  radar: () => import("./pages/radar.js"),
  topic: () => import("./pages/topic.js"),
  economy: () => import("./pages/economic-flow-v4.js"),
  report: () => import("./pages/report.js"),
  archive: () => import("./pages/archive.js"),
  commerce: () => import("./pages/commerce-calendar.js"),
  buzz: () => import("./pages/buzz.js"),
  sources: () => import("./pages/source-matrix.js"),
  "status-history": () => import("./pages/status-history.js"),
  "lens-history": () => import("./pages/lens-history.js")
};

function ensureV8Styles() {
  if (document.getElementById("lbi-v8-dashboard-css")) return;
  const link = document.createElement("link");
  link.id = "lbi-v8-dashboard-css";
  link.rel = "stylesheet";
  link.href = (document.body.getAttribute("data-root") || "") + "assets/css/v8-dashboard.css";
  document.head.appendChild(link);
}

/**
 * Static report files span several generations. Instead of copying a large nav
 * fragment into every historical HTML file, every page is normalised through
 * this single canonical rail before shell listeners are attached.
 */
function ensureCanonicalRail() {
  const rail = document.querySelector(".app-rail");
  if (!rail) return;
  const r = document.body.getAttribute("data-root") || "";
  const href = (path) => `${r}${path}`;
  rail.setAttribute("aria-label", "メインナビゲーション");
  rail.innerHTML = `
    <a class="brand" href="${href("index.html")}">
      <span class="brand__mark">LBI</span>
      <span class="brand__sub">物流・化粧品インテリジェンス</span>
    </a>
    <div class="rail-group">
      <p class="rail-group__label">現況</p>
      <a class="rail-link" data-nav="home" href="${href("index.html")}">ダッシュボード</a>
      <a class="rail-link" data-nav="radar" href="${href("radar.html")}">オペレーションレーダー<span class="rail-link__count" id="rail-count-radar"></span></a>
      <a class="rail-link" data-nav="topic" href="${href("topic.html")}">トピック<span class="rail-link__count" id="rail-count-topic"></span></a>
    </div>
    <div class="rail-group">
      <p class="rail-group__label">レポート</p>
      <a class="rail-link" id="nav-latest-daily" data-nav="daily" href="${href("archive.html?type=daily")}">日次</a>
      <a class="rail-link" id="nav-latest-weekly" data-nav="weekly" href="${href("archive.html?type=weekly")}">週次</a>
      <a class="rail-link" id="nav-latest-monthly" data-nav="monthly" href="${href("archive.html?type=monthly")}">月次</a>
      <a class="rail-link" data-nav="archive" href="${href("archive.html")}">過去のレポート</a>
    </div>
    <div class="rail-group">
      <p class="rail-group__label">分析</p>
      <a class="rail-link" data-nav="economy" href="${href("economic-flow.html")}">実体経済と物流</a>
    </div>
    <div class="rail-group">
      <p class="rail-group__label">ビューティー</p>
      <a class="rail-link" data-nav="commerce" href="${href("commerce-calendar.html")}">EC予定</a>
      <a class="rail-link" data-nav="buzz" href="${href("buzz.html")}">バズ</a>
    </div>
    <div class="rail-group">
      <p class="rail-group__label">参照</p>
      <a class="rail-link" data-nav="sources" href="${href("source-matrix.html")}">情報源</a>
      <a class="rail-link" data-nav="status-history" href="${href("status-history.html")}">ステータス履歴</a>
      <a class="rail-link" data-nav="lens-history" href="${href("lens-history.html")}">シグナル履歴</a>
    </div>
    <div class="shell-tools">
      <button type="button" class="tool-btn" id="tool-theme" aria-pressed="false">自動</button>
      <button type="button" class="tool-btn" id="tool-density" aria-pressed="false">標準</button>
      <button type="button" class="tool-btn" id="tool-help" title="キーボードショートカット">?</button>
    </div>`;
}

function normalizeEconomyOverviewIds() {
  const overview = document.getElementById("flow-overview");
  if (!overview) return;
  overview.querySelectorAll("[id]").forEach((node) => {
    if (!node.id.startsWith("overview-")) node.id = `overview-${node.id}`;
  });
}

function detectPage() {
  const declared = document.body.getAttribute("data-page");
  if (declared && PAGES[declared]) return declared;
  if (byId("dashboard")) return "home";
  if (byId("radar-list")) return "radar";
  if (byId("topic-root")) return "topic";
  if (byId("flow-overview")) return "economy";
  if (document.body.hasAttribute("data-report-date")) return "report";
  if (byId("archive-list")) return "archive";
  if (byId("month-calendar")) return "commerce";
  if (byId("buzz-list")) return "buzz";
  if (byId("source-body")) return "sources";
  if (byId("history-list")) return "status-history";
  if (byId("lens-history-list")) return "lens-history";
  return null;
}

function showFatal(message) {
  const box = byId("dashboard-error") || qs(".empty-state");
  if (box) { box.hidden = false; box.textContent = message; }
}

function boot() {
  if (window.__lbiBooted) return;
  window.__lbiBooted = true;
  ensureV8Styles();
  ensureCanonicalRail();
  initPrint();
  initShell();
  const page = detectPage();
  if (!page) return;
  PAGES[page]().then((mod) => mod.init()).then(() => {
    if (page === "economy") normalizeEconomyOverviewIds();
  }).catch((err) => {
    console.error(`LBI: ${page} failed to initialise.`, err);
    showFatal("データを読み込めませんでした。ページを再読み込みしてください。");
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();
