import { byId, qs } from "./core/dom.js";
import { initPrint } from "./core/print.js";
import { initShell } from "./core/shell.js";

const PAGES = {
  home: () => import("./pages/home-v8.js"), radar: () => import("./pages/radar.js"), topic: () => import("./pages/topic.js"),
  economy: () => import("./pages/economic-flow-v4.js"), demand: () => import("./pages/logistics-demand.js"),
  workforce: () => import("./pages/logistics-workforce.js"), capacity: () => import("./pages/logistics-capacity.js"), risk: () => import("./pages/structural-risk.js"),
  report: () => import("./pages/report.js"), archive: () => import("./pages/archive.js"), commerce: () => import("./pages/commerce-calendar.js"),
  buzz: () => import("./pages/buzz.js"), sources: () => import("./pages/source-matrix.js"),
  "status-history": () => import("./pages/status-history.js"), "lens-history": () => import("./pages/lens-history.js")
};

function ensureStyles() {
  const r = document.body.getAttribute("data-root") || "";
  [["lbi-v8-dashboard-css","assets/css/v8-dashboard.css"],["lbi-logistics-ia-css","assets/css/logistics-ia.css"]].forEach(([id,path])=>{
    if(document.getElementById(id)) return; const link=document.createElement("link"); link.id=id; link.rel="stylesheet"; link.href=r+path; document.head.appendChild(link);
  });
}

function ensureCanonicalRail() {
  const rail = document.querySelector(".app-rail"); if (!rail) return;
  const r = document.body.getAttribute("data-root") || "";
  rail.setAttribute("aria-label", "メインナビゲーション");
  rail.innerHTML = `
  <a class="brand" href="${r}index.html"><span class="brand__mark">LBI</span><span class="brand__sub">物流・化粧品インテリジェンス</span></a>
  <div class="rail-group"><p class="rail-group__label">現況</p><a class="rail-link" data-nav="home" href="${r}index.html">ダッシュボード</a><a class="rail-link" data-nav="radar" href="${r}radar.html">オペレーションレーダー<span class="rail-link__count" id="rail-count-radar"></span></a><a class="rail-link" data-nav="topic" href="${r}topic.html">トピック<span class="rail-link__count" id="rail-count-topic"></span></a></div>
  <div class="rail-group"><p class="rail-group__label">実体経済と物流</p><a class="rail-link" data-nav="economy" href="${r}economic-flow.html">経済と物流コスト</a><a class="rail-link" data-nav="demand" href="${r}logistics-demand.html">物流需要</a><a class="rail-link" data-nav="capacity" href="${r}logistics-capacity.html">輸送キャパシティ</a><a class="rail-link" data-nav="workforce" href="${r}logistics-workforce.html">物流労働力</a><a class="rail-link" data-nav="risk" href="${r}structural-risk.html">構造リスク</a></div>
  <div class="rail-group"><p class="rail-group__label">レポート</p><a class="rail-link" id="nav-latest-daily" data-nav="daily" href="${r}archive.html?type=daily">日次</a><a class="rail-link" id="nav-latest-weekly" data-nav="weekly" href="${r}archive.html?type=weekly">週次</a><a class="rail-link" id="nav-latest-monthly" data-nav="monthly" href="${r}archive.html?type=monthly">月次</a><a class="rail-link" data-nav="archive" href="${r}archive.html">過去のレポート</a></div>
  <div class="rail-group"><p class="rail-group__label">ビューティー</p><a class="rail-link" data-nav="commerce" href="${r}commerce-calendar.html">EC予定</a><a class="rail-link" data-nav="buzz" href="${r}buzz.html">バズ</a></div>
  <div class="rail-group"><p class="rail-group__label">参照</p><a class="rail-link" data-nav="sources" href="${r}source-matrix.html">情報源</a><a class="rail-link" data-nav="status-history" href="${r}status-history.html">ステータス履歴</a><a class="rail-link" data-nav="lens-history" href="${r}lens-history.html">シグナル履歴</a></div>
  <div class="shell-tools"><button type="button" class="tool-btn" id="tool-theme" aria-pressed="false">自動</button><button type="button" class="tool-btn" id="tool-density" aria-pressed="false">標準</button><button type="button" class="tool-btn" id="tool-help" title="キーボードショートカット">?</button></div>`;
}
function normalizeEconomyOverviewIds(){const overview=document.getElementById("flow-overview");if(!overview)return;overview.querySelectorAll("[id]").forEach(n=>{if(!n.id.startsWith("overview-"))n.id=`overview-${n.id}`;});}
function detectPage(){const declared=document.body.getAttribute("data-page");if(declared&&PAGES[declared])return declared;if(byId("dashboard"))return"home";if(byId("radar-list"))return"radar";if(byId("topic-root"))return"topic";if(byId("flow-overview"))return"economy";if(document.body.hasAttribute("data-report-date"))return"report";if(byId("archive-list"))return"archive";if(byId("month-calendar"))return"commerce";if(byId("buzz-list"))return"buzz";if(byId("source-body"))return"sources";if(byId("history-list"))return"status-history";if(byId("lens-history-list"))return"lens-history";return null;}
function showFatal(message){const box=byId("dashboard-error")||qs(".empty-state");if(box){box.hidden=false;box.textContent=message;}}
function boot(){if(window.__lbiBooted)return;window.__lbiBooted=true;ensureStyles();ensureCanonicalRail();initPrint();initShell();const page=detectPage();if(!page)return;PAGES[page]().then(mod=>mod.init()).then(()=>{if(page==="economy")normalizeEconomyOverviewIds();}).catch(err=>{console.error(`LBI: ${page} failed to initialise.`,err);showFatal("データを読み込めませんでした。ページを再読み込みしてください。");});}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
