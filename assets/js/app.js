/* =========================================================================
   app.js — the single entry point.
   -------------------------------------------------------------------------
   One module graph, one render pass. There is deliberately no post-render
   patch layer: the v2.x build re-ran a DOM rewrite every 200ms for six
   seconds after load (portal-v22.js), which meant the page never settled.
   Everything a page needs is now decided before it paints.

   Pages declare themselves with <body data-page="…">. Older published pages
   (reports generated before this change) have no data-page attribute, so the
   router falls back to sniffing well-known hooks — that keeps every URL that
   is already public working unchanged.
   ========================================================================= */

import { byId, qs } from "./core/dom.js";
import { initPrint } from "./core/print.js";
import { initShell } from "./core/shell.js";

const PAGES = {
  home: () => import("./pages/home.js"),
  radar: () => import("./pages/radar.js"),
  topic: () => import("./pages/topic.js"),
  report: () => import("./pages/report.js"),
  archive: () => import("./pages/archive.js"),
  commerce: () => import("./pages/commerce-calendar.js"),
  buzz: () => import("./pages/buzz.js"),
  sources: () => import("./pages/source-matrix.js"),
  "status-history": () => import("./pages/status-history.js"),
  "lens-history": () => import("./pages/lens-history.js")
};

function ensureProductionPolish() {
  if (document.getElementById("lbi-v7-1-1-polish")) return;
  const style = document.createElement("style");
  style.id = "lbi-v7-1-1-polish";
  style.textContent = `
    .brand { align-items: center; white-space: nowrap; }
    .brand__mark,
    .brand__sub { line-height: 1.25; white-space: nowrap; }
    .brand__mark { flex: 0 0 auto; }
    .brand__sub { flex: 0 0 auto; }
    .radar-row__head { grid-template-columns: 72px 48px 86px minmax(0,1fr) auto; }
    .radar-row__state { min-width: 72px; overflow: visible; white-space: nowrap; }
    .data-table th:first-child,
    .data-table td:first-child { width: 88px; min-width: 88px; white-space: nowrap; }
    .priority { min-width: 38px; white-space: nowrap; }
    .report,
    .wrap.report,
    .wrap-read.report { width: 100%; max-width: var(--content-max); }
    @media (max-width: 1080px) { .brand__sub { display: none; } }
  `;
  document.head.appendChild(style);
}

function detectPage() {
  const declared = document.body.getAttribute("data-page");
  if (declared && PAGES[declared]) return declared;

  if (byId("dashboard")) return "home";
  if (byId("radar-list")) return "radar";
  if (byId("topic-root")) return "topic";
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
  if (box) {
    box.hidden = false;
    box.textContent = message;
  }
}

function boot() {
  if (window.__lbiBooted) return;     // legacy shims may load app.js twice
  window.__lbiBooted = true;

  ensureProductionPolish();
  initPrint();
  initShell();

  const page = detectPage();
  if (!page) return;

  PAGES[page]()
    .then((mod) => mod.init())
    .catch((err) => {
      console.error(`LBI: ${page} failed to initialise.`, err);
      showFatal("データを読み込めませんでした。ページを再読み込みしてください。");
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
