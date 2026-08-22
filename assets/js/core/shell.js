/* =========================================================================
   shell.js — the console frame, present on every page.
   -------------------------------------------------------------------------
   Three things live here, all of them page-independent:

   1. THE STATUS RIBBON. A slim strip under the rail showing overall state,
      the action verdict, the six operational domains, radar counts and data
      freshness. It renders on every page including reports, because in a
      control tower the current state must never be more than a glance away —
      including three clicks deep in the archive. It is built from the same
      data the dashboard uses; nothing here re-derives judgement.

   2. VIEW PREFERENCES. Theme (light/dark/auto) and density (comfortable/
      compact) are the two settings a daily user of a dense tool actually
      wants. Both are single attributes on <html>, both persist in
      localStorage, both are applied before first paint by an inline snippet
      in the page shell so there is no flash.

   3. KEYBOARD. g+r / g+t / g+d / g+a jump between layers, / focuses search,
      ? opens the shortcut sheet, Esc closes it. Typing in a field never
      triggers a shortcut.

   Failure here must never take a page down: every step is guarded, and the
   ribbon simply stays empty if the data is unavailable.
   ========================================================================= */

import { el, link, byId, clear, qsa, root } from "./dom.js";
import * as L from "./labels.js";
import { DOMAINS, latestOf } from "../data/adapters.js";
import * as S from "../domain/signals.js";

const THEME_KEY = "lbi:theme";
const DENSITY_KEY = "lbi:density";


/* ---- legacy published-report bridge --------------------------------------
   Content automation may publish a report using a pre-v7 HTML shell while
   frontend assets are already v7. Rather than letting that single report lose
   the rail/ribbon, upgrade the surrounding shell at boot. The report body
   itself is never rewritten. This is intentionally deterministic and runs
   once — no observer, polling or post-render patch loop. */
function ensureLayoutStylesheet() {
  if (document.querySelector('link[href*="assets/css/layout.css"]')) return;
  const href = `${root()}assets/css/layout.css`;
  const linkEl = document.createElement("link");
  linkEl.rel = "stylesheet";
  linkEl.href = href;
  document.head.appendChild(linkEl);
}

function railMarkup() {
  const r = root();
  return `
    <a class="brand" href="${r}index.html"><span class="brand__mark">LBI</span><span class="brand__sub">Logistics &amp; Beauty Intelligence</span></a>
    <div class="rail-group"><p class="rail-group__label">現況</p>
      <a class="rail-link" data-nav="home" href="${r}index.html">ダッシュボード</a>
      <a class="rail-link" data-nav="radar" href="${r}radar.html">オペレーションレーダー<span class="rail-link__count" id="rail-count-radar"></span></a>
      <a class="rail-link" data-nav="topic" href="${r}topic.html">トピック<span class="rail-link__count" id="rail-count-topic"></span></a></div>
    <div class="rail-group"><p class="rail-group__label">レポート</p>
      <a class="rail-link" id="nav-latest-daily" data-nav="daily" href="${r}archive.html?type=daily">日次</a>
      <a class="rail-link" id="nav-latest-weekly" data-nav="weekly" href="${r}archive.html?type=weekly">週次</a>
      <a class="rail-link" id="nav-latest-monthly" data-nav="monthly" href="${r}archive.html?type=monthly">月次</a>
      <a class="rail-link" data-nav="archive" href="${r}archive.html">過去のレポート</a></div>
    <div class="rail-group"><p class="rail-group__label">ビューティー</p>
      <a class="rail-link" data-nav="commerce" href="${r}commerce-calendar.html">EC予定</a>
      <a class="rail-link" data-nav="buzz" href="${r}buzz.html">Buzz</a></div>
    <div class="rail-group"><p class="rail-group__label">参照</p>
      <a class="rail-link" data-nav="sources" href="${r}source-matrix.html">情報源</a>
      <a class="rail-link" data-nav="status-history" href="${r}status-history.html">ステータス履歴</a>
      <a class="rail-link" data-nav="lens-history" href="${r}lens-history.html">シグナル履歴</a></div>
    <div class="shell-tools">
      <button type="button" class="tool-btn" id="tool-theme" aria-pressed="false">自動</button>
      <button type="button" class="tool-btn" id="tool-density" aria-pressed="false">標準</button>
      <button type="button" class="tool-btn" id="tool-help" title="キーボードショートカット">?</button>
    </div>`;
}

function upgradeLegacyReportShell() {
  if (document.querySelector(".app-shell")) return;
  if (!document.body.hasAttribute("data-report-date")) return;
  const main = document.querySelector("main");
  if (!main) return;

  ensureLayoutStylesheet();
  const oldHeader = document.querySelector(".site-header");
  if (oldHeader) oldHeader.remove();

  main.classList.add("app-main");
  const reportWrap = main.querySelector(".wrap-read.report");
  if (reportWrap) {
    reportWrap.classList.remove("wrap-read");
    reportWrap.classList.add("wrap");
  }

  const shell = document.createElement("div");
  shell.className = "app-shell";
  const rail = document.createElement("nav");
  rail.className = "app-rail";
  rail.setAttribute("aria-label", "メインナビゲーション");
  rail.innerHTML = railMarkup();
  const frame = document.createElement("div");
  frame.className = "app-frame";
  const ribbon = document.createElement("div");
  ribbon.className = "app-ribbon";
  ribbon.id = "app-ribbon";
  ribbon.setAttribute("aria-label", "現在のステータス");
  ribbon.setAttribute("role", "status");
  main.parentNode.insertBefore(shell, main);
  shell.appendChild(rail);
  shell.appendChild(frame);
  frame.appendChild(ribbon);
  frame.appendChild(main);
  const footer = document.querySelector("body > .site-footer");
  if (footer) frame.appendChild(footer);
}

/* ---- preferences ---------------------------------------------------------- */

function readPref(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function writePref(key, value) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch { /* private mode: the setting simply does not persist */ }
}

function applyTheme(value) {
  const html = document.documentElement;
  if (value === "dark" || value === "light") html.setAttribute("data-theme", value);
  else html.removeAttribute("data-theme");
}

function applyDensity(value) {
  const html = document.documentElement;
  if (value === "compact") html.setAttribute("data-density", "compact");
  else html.removeAttribute("data-density");
}

function currentTheme() {
  const stored = readPref(THEME_KEY);
  return stored === "dark" || stored === "light" ? stored : "auto";
}

function bindTools() {
  const themeBtn = byId("tool-theme");
  const densityBtn = byId("tool-density");
  const helpBtn = byId("tool-help");

  if (themeBtn) {
    const label = () => {
      const t = currentTheme();
      themeBtn.textContent = t === "dark" ? "ダーク" : t === "light" ? "ライト" : "自動";
      themeBtn.setAttribute("aria-pressed", String(t !== "auto"));
      themeBtn.title = "表示テーマ: 自動 / ライト / ダーク";
    };
    label();
    themeBtn.addEventListener("click", () => {
      const next = { auto: "light", light: "dark", dark: "auto" }[currentTheme()];
      writePref(THEME_KEY, next === "auto" ? null : next);
      applyTheme(next);
      label();
    });
  }

  if (densityBtn) {
    const label = () => {
      const compact = readPref(DENSITY_KEY) === "compact";
      densityBtn.textContent = compact ? "高密度" : "標準";
      densityBtn.setAttribute("aria-pressed", String(compact));
      densityBtn.title = "行間の密度を切り替えます";
    };
    label();
    densityBtn.addEventListener("click", () => {
      const compact = readPref(DENSITY_KEY) !== "compact";
      writePref(DENSITY_KEY, compact ? "compact" : null);
      applyDensity(compact ? "compact" : null);
      label();
    });
  }

  if (helpBtn) helpBtn.addEventListener("click", () => toggleHelp());
}

/* ---- keyboard ------------------------------------------------------------- */

const SHORTCUTS = [
  ["g → d", "ダッシュボード", "index.html"],
  ["g → r", "オペレーションレーダー", "radar.html"],
  ["g → t", "トピック", "topic.html"],
  ["g → a", "過去（アーカイブ）", "archive.html"],
  ["g → c", "EC予定", "commerce-calendar.html"],
  ["/", "ページ内の検索フィールドへ", null],
  ["?", "このヘルプ", null],
  ["Esc", "閉じる", null]
];

function helpSheet() {
  let sheet = byId("help-sheet");
  if (sheet) return sheet;

  sheet = el("aside", "help-sheet");
  sheet.id = "help-sheet";
  sheet.hidden = true;
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", "キーボードショートカット");

  const close = el("button", "btn btn--quiet help-sheet__close", "閉じる");
  close.type = "button";
  close.addEventListener("click", () => toggleHelp(false));
  sheet.appendChild(close);

  sheet.appendChild(el("h2", null, "キーボードショートカット"));
  const dl = el("dl");
  SHORTCUTS.forEach(([keys, description]) => {
    const dt = el("dt");
    keys.split(" → ").forEach((k, i) => {
      if (i) dt.appendChild(document.createTextNode(" "));
      dt.appendChild(el("kbd", null, k));
    });
    dl.appendChild(dt);
    dl.appendChild(el("dd", null, description));
  });
  sheet.appendChild(dl);
  document.body.appendChild(sheet);
  return sheet;
}

export function toggleHelp(force) {
  const sheet = helpSheet();
  const open = force == null ? sheet.hidden : force;
  sheet.hidden = !open;
  if (open) sheet.querySelector("button").focus();
}

function isTyping(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function bindKeys() {
  let awaitingGo = false;
  let goTimer = null;

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key === "Escape") {
      toggleHelp(false);
      return;
    }
    if (isTyping(event.target)) return;

    if (event.key === "?") {
      event.preventDefault();
      toggleHelp();
      return;
    }
    if (event.key === "/") {
      const search = document.querySelector('input[type="search"]');
      if (search) { event.preventDefault(); search.focus(); }
      return;
    }
    if (event.key === "g") {
      awaitingGo = true;
      clearTimeout(goTimer);
      goTimer = setTimeout(() => { awaitingGo = false; }, 900);
      return;
    }
    if (!awaitingGo) return;

    const destination = { d: "index.html", r: "radar.html", t: "topic.html",
                          a: "archive.html", c: "commerce-calendar.html" }[event.key];
    awaitingGo = false;
    if (destination) {
      event.preventDefault();
      location.href = root() + destination;
    }
  });
}

/* ---- the ribbon ------------------------------------------------------------ */

function ribbonState(daily) {
  const status = daily ? daily.status : "unconfirmed";
  const state = el("span", "ribbon-state");
  state.setAttribute("data-status", status);
  state.appendChild(el("span", "dot"));
  state.appendChild(document.createTextNode(L.statusLabel(status)));
  return state;
}

function ribbonAction(digest) {
  const action = digest ? digest.actionRequired : "unknown";
  const label = { required: L.UI.actionRequired, monitor: L.UI.actionMonitor,
                  none: L.UI.actionNone, unknown: L.UI.actionUnknown }[action];
  const node = el("span", "ribbon-action", label);
  node.setAttribute("data-action", action);
  return node;
}

function ribbonDomains(daily) {
  const box = el("div", "ribbon-domains");
  DOMAINS.forEach((domain) => {
    const status = daily && daily.status_board ? (daily.status_board[domain] || "unconfirmed") : "unconfirmed";
    const a = link(`${root()}status-history.html?domain=${encodeURIComponent(domain)}`, "ribbon-domain");
    a.setAttribute("data-status", status);
    a.setAttribute("title", `${L.domainLabel(domain)}: ${L.statusLabel(status)}`);
    a.appendChild(el("span", "dot"));
    a.appendChild(el("span", null, L.domainLabel(domain)));
    box.appendChild(a);
  });
  return box;
}

function ribbonRadar(news) {
  const observed = news.filter((n) => n.status === "observed").length;
  const reported = news.filter((n) => n.status === "reported").length;
  const a = link(`${root()}radar.html`, "ribbon-radar");
  a.setAttribute("data-alert", String(observed > 0));
  a.appendChild(el("span", null, "レーダー"));
  a.appendChild(el("strong", null, String(observed)));
  a.appendChild(el("span", null, `${L.UI.observedLabel} / ${reported} ${L.UI.reportedLabel}`));
  return a;
}

/**
 * Render the ribbon. Called by every page module through mountShell().
 * @param {{reports: Array, news: Array}} intel
 */
export function renderRibbon(intel) {
  const host = byId("app-ribbon");
  if (!host) return;
  clear(host);

  const daily = latestOf(intel.reports, "daily");
  const digest = daily ? S.summarise(daily) : null;

  host.appendChild(ribbonState(daily));
  host.appendChild(ribbonAction(digest));
  host.appendChild(ribbonDomains(daily));
  host.appendChild(ribbonRadar(intel.news || []));

  const stamp = el("span", "ribbon-stamp");
  stamp.textContent = daily ? `${daily.date}${daily.as_of ? ` ${daily.as_of}` : ""}` : "データ未取得";
  host.appendChild(stamp);
}

/** Counts shown against the rail links, so the nav itself carries state. */
export function renderRailCounts(intel) {
  const radar = byId("rail-count-radar");
  if (radar) {
    const observed = (intel.news || []).filter((n) => n.status === "observed").length;
    radar.textContent = String((intel.news || []).length);
    radar.setAttribute("data-tone", observed ? "alert" : "normal");
  }
  const topics = byId("rail-count-topic");
  if (topics) topics.textContent = String((intel.topics || []).length);
}

/** Mark the current page in the rail. */
export function markRail() {
  const page = document.body.getAttribute("data-page");
  if (!page) return;
  qsa(`.rail-link[data-nav="${page}"]`).forEach((a) => a.setAttribute("aria-current", "page"));
}

/* ---- entry ------------------------------------------------------------------ */

/** Called once per page by app.js, before the page module renders. */
export function initShell() {
  upgradeLegacyReportShell();
  applyTheme(currentTheme());
  applyDensity(readPref(DENSITY_KEY));
  bindTools();
  bindKeys();
  markRail();
}

/** Called by page modules that have already loaded the intelligence graph. */
export function mountShell(intel) {
  try {
    renderRibbon(intel);
    renderRailCounts(intel);
  } catch (err) {
    console.warn("shell: ribbon unavailable", err);
  }
}
