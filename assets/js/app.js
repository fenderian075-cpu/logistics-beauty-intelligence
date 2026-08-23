/* =========================================================================
   app.js — the single entry point.
   One module graph, one render pass; no polling or recurring DOM patching.
   ========================================================================= */

import { byId, qs } from "./core/dom.js";
import { initPrint } from "./core/print.js";
import { initShell } from "./core/shell.js";

const PAGES = {
  home: () => import("./pages/home-v8.js"),
  radar: () => import("./pages/radar.js"),
  topic: () => import("./pages/topic.js"),
  economy: () => import("./pages/economic-flow.js"),
  report: () => import("./pages/report.js"),
  archive: () => import("./pages/archive.js"),
  commerce: () => import("./pages/commerce-calendar.js"),
  buzz: () => import("./pages/buzz.js"),
  sources: () => import("./pages/source-matrix.js"),
  "status-history": () => import("./pages/status-history.js"),
  "lens-history": () => import("./pages/lens-history.js")
};

function ensureProductionPolish() {
  if (document.getElementById("lbi-v8-polish")) return;
  const style = document.createElement("style");
  style.id = "lbi-v8-polish";
  style.textContent = `
    .brand { align-items:center; white-space:nowrap; }
    .brand__mark,.brand__sub { line-height:1.25; white-space:nowrap; flex:0 0 auto; }
    .radar-row__head { grid-template-columns:78px 48px 86px minmax(0,1fr) auto; column-gap:var(--s2); }
    .radar-row__state { display:inline-flex; align-items:center; justify-content:center; box-sizing:border-box; width:64px; min-width:64px; margin-left:4px; padding:2px 6px; border:1px solid var(--rule-strong); border-radius:var(--radius); background:var(--surface); overflow:visible; white-space:nowrap; line-height:1.2; letter-spacing:0; }
    .radar-row[data-status="observed"] .radar-row__state { border-color:var(--st-disruption); background:var(--st-disruption-bg); color:var(--st-disruption); }
    .radar-row[data-status="reported"] .radar-row__state { border-style:dashed; color:var(--ink-2); }
    .radar-row[data-status="resolved"] .radar-row__state { border-color:var(--rule); background:var(--surface-alt); }
    .data-table th:first-child,.data-table td:first-child { min-width:88px; white-space:nowrap; }
    .priority { min-width:38px; white-space:nowrap; }
    .report,.wrap.report,.wrap-read.report { width:100%; max-width:var(--content-max); }

    .economy-thesis { margin:0 0 var(--s4); color:var(--ink-2); }
    .economy-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--s3); }
    .economy-card { display:flex; flex-direction:column; min-width:0; padding:var(--s4); border:1px solid var(--rule); border-radius:var(--radius); background:var(--surface); color:inherit; text-decoration:none; }
    .economy-card:hover { border-color:var(--rule-strong); }
    .economy-card__headline { display:block; margin-bottom:var(--s2); font-size:1rem; }
    .economy-card__value { margin:0 0 var(--s1); font-size:1.3rem; font-weight:700; font-variant-numeric:tabular-nums; }
    .economy-card__meta,.economy-card__detail { margin:0; color:var(--ink-2); font-size:.82rem; }
    .economy-card__detail { margin-top:var(--s2); line-height:1.55; }
    .economy-card__drill { margin-top:auto; padding-top:var(--s3); color:var(--accent); font-size:.82rem; }
    .economy-card[data-direction="rising"] { border-top:2px solid var(--st-watch); }
    .economy-card[data-direction="improving"] { border-top:2px solid var(--st-normal); }
    .economy-card[data-direction="unknown"] { border-top:2px solid var(--rule-strong); }
    .transmission-chain { display:flex; align-items:center; flex-wrap:wrap; gap:var(--s2); margin:var(--s3) 0; }
    .transmission-node { padding:6px 9px; border:1px solid var(--rule); border-radius:var(--radius); background:var(--surface-alt); font-size:.82rem; }
    .transmission-arrow { color:var(--ink-3); }
    .flow-dataset { margin-top:var(--s6); }
    .economy-table td:nth-child(3),.economy-table td:nth-child(4),.economy-table td:nth-child(5) { font-variant-numeric:tabular-nums; }
    @media (max-width:1100px) { .economy-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .brand__sub { display:none; } }
    @media (max-width:700px) { .economy-grid { grid-template-columns:1fr; } }
  `;
  document.head.appendChild(style);
}

function ensureEconomicNav() {
  const rail = document.querySelector(".app-rail");
  if (!rail || rail.querySelector('[data-nav="economy"]')) return;
  const groups = Array.from(rail.querySelectorAll(".rail-group"));
  const ref = groups.find((g) => (g.querySelector(".rail-group__label")?.textContent || "").trim() === "参照");
  if (!ref) return;
  const a = document.createElement("a");
  a.className = "rail-link";
  a.dataset.nav = "economy";
  const root = document.body.getAttribute("data-root") || "";
  a.href = root + "economic-flow.html";
  a.textContent = "実体経済と物流";
  const label = ref.querySelector(".rail-group__label");
  if (label && label.nextSibling) ref.insertBefore(a, label.nextSibling); else ref.appendChild(a);
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
  ensureProductionPolish();
  initPrint();
  initShell();
  ensureEconomicNav();
  const page = detectPage();
  if (!page) return;
  PAGES[page]().then((mod) => mod.init()).catch((err) => {
    console.error(`LBI: ${page} failed to initialise.`, err);
    showFatal("データを読み込めませんでした。ページを再読み込みしてください。");
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once:true });
else boot();
