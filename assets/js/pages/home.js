/* =========================================================================
   home.js — dashboard.
   -------------------------------------------------------------------------
   v5 keeps the v2.x information structure (decision → status → latest →
   changes → lenses → key signals); PR2 rebuilds the ordering around the
   Operations Radar. What changed here is how it renders:

     - one pass, no polling, no post-hoc DOM rewriting;
     - status cells and lens cards are real <a href> elements, so they can be
       middle-clicked, bookmarked and read by assistive tech as links;
     - "normal telemetry is not intelligence" is applied at render time from
       the signal data, not by regex-scrubbing text out of the DOM;
     - the missing-baseline case (every report currently has
       change_summary.comparison_base = null) is a first-class state.
   ========================================================================= */

import { el, link, byId, clear, root } from "../core/dom.js";
import { formatDate, formatMonth } from "../core/format.js";
import * as L from "../core/labels.js";
import { loadReports, loadRegistry } from "../data/store.js";
import { previousOf, latestOf, statusDiff, direction, DOMAINS } from "../data/adapters.js";
import * as S from "../domain/signals.js";
import { bindLatestReportNav, markCurrent } from "../core/nav.js";
import { statusPill, emptyState, renderRows } from "../render/primitives.js";
import { signalCard } from "../render/signal-card.js";

let reports = [];

/* ---- decision header ------------------------------------------------------ */

function labelBlock(status) {
  const wrapper = el("div", "overall__label");
  wrapper.appendChild(el("p", "eyebrow", L.UI.overall));
  const value = el("div", "overall__value");
  value.appendChild(el("span", "dot"));
  value.appendChild(document.createTextNode(L.statusLabel(status)));
  wrapper.appendChild(value);
  return wrapper;
}

function renderOverall(daily) {
  const box = byId("overall");
  if (!box) return;
  clear(box);

  if (!daily) {
    box.setAttribute("data-status", "unconfirmed");
    box.appendChild(labelBlock("unconfirmed"));
    const body = el("div", "overall__body");
    body.appendChild(el("p", null, L.UI.noReport));
    box.appendChild(body);
    return;
  }

  box.setAttribute("data-status", daily.status);
  box.appendChild(labelBlock(daily.status));

  const body = el("div", "overall__body");
  body.appendChild(el("p", null, daily.summary));
  body.appendChild(el("p", "overall__meta",
    `${L.UI.asOf}: ${formatDate(daily.date, { weekday: true })}${daily.as_of ? ` ${daily.as_of}` : ""}`));
  box.appendChild(body);
}

function renderActionBox(digest) {
  const box = byId("action-box");
  if (!box) return;
  clear(box);

  const state = digest ? digest.actionRequired : "unknown";
  box.setAttribute("data-action", state);

  const label = {
    required: L.UI.actionRequired, monitor: L.UI.actionMonitor,
    none: L.UI.actionNone, unknown: L.UI.actionUnknown
  }[state];
  const note = {
    required: L.UI.actionRequiredNote, monitor: L.UI.actionMonitorNote,
    none: L.UI.actionNoneNote, unknown: L.UI.actionUnknownNote
  }[state];

  box.appendChild(el("p", "eyebrow", "Action"));
  const value = el("p", "action-box__value");
  value.appendChild(el("span", "dot"));
  value.appendChild(document.createTextNode(label));
  box.appendChild(value);
  box.appendChild(el("p", "action-box__note", note));
}

function renderConclusion(daily) {
  const box = byId("conclusion");
  if (!box) return;
  clear(box);
  const text = daily && (daily.bottom_line || daily.summary);
  if (!text) { box.hidden = true; return; }
  box.hidden = false;
  box.appendChild(el("p", "eyebrow", L.UI.decisionTitle));
  box.appendChild(el("p", null, text));
}

/* ---- status board --------------------------------------------------------- */

function renderBoard(daily) {
  const board = byId("status-board");
  if (!board) return;
  clear(board);

  DOMAINS.forEach((key) => {
    const st = daily && daily.status_board ? (daily.status_board[key] || "unconfirmed") : "unconfirmed";
    const cell = link(`${root()}status-history.html?domain=${encodeURIComponent(key)}`, "status-cell");
    cell.setAttribute("data-status", st);
    cell.setAttribute("aria-label", `${L.domainLabel(key)}: ${L.statusLabel(st)} — 履歴を表示`);
    cell.appendChild(el("div", "status-cell__name", L.domainLabel(key)));
    const v = el("div", "status-cell__value");
    v.appendChild(el("span", "dot"));
    v.appendChild(document.createTextNode(L.statusLabel(st)));
    cell.appendChild(v);
    cell.appendChild(el("span", "status-cell__drill", "時系列を見る →"));
    board.appendChild(cell);
  });
}

/* ---- latest reports -------------------------------------------------------- */

function latestRow(type) {
  const report = latestOf(reports, type);
  const label = L.typeLabel(type);

  if (!report) {
    const a = link(`${root()}archive.html?type=${type}`, "latest-summary-row is-empty");
    a.appendChild(el("strong", "latest-summary-row__meta", `${label} —`));
    a.appendChild(el("span", "muted", L.UI.noReport));
    return a;
  }

  const a = link(root() + report.path, "latest-summary-row");
  const when = report.type === "monthly"
    ? formatMonth(report.period || report.date.slice(0, 7))
    : report.date.slice(5).replace("-", "/");
  a.appendChild(el("strong", "latest-summary-row__meta", `${label} ${when}`));
  a.appendChild(el("span", "latest-summary-row__slash", "/"));
  a.appendChild(el("span", "latest-summary-row__summary",
    report.summary || report.bottom_line || L.UI.readReport(report.type)));
  return a;
}

function renderLatest() {
  const grid = byId("latest-grid");
  if (!grid) return;
  clear(grid);
  ["daily", "weekly", "monthly"].forEach((type) => grid.appendChild(latestRow(type)));
}

/* ---- what changed ---------------------------------------------------------- */

function changeRow(row) {
  const li = el("li", "change-row");
  li.setAttribute("data-direction", direction(row.from, row.to));
  li.appendChild(el("span", "change-row__key",
    row.key === "overall" ? "総合" : L.domainLabel(row.key)));
  const from = el("span", "change-row__from"); from.appendChild(statusPill(row.from));
  li.appendChild(from);
  li.appendChild(el("span", "change-row__arrow", "→"));
  const to = el("span", "change-row__to"); to.appendChild(statusPill(row.to));
  li.appendChild(to);
  return li;
}

function renderWhatChanged(daily, previous, digest) {
  const countsBox = byId("changed-counts");
  const listBox = byId("changed-list");
  const baseNote = byId("changed-base");
  if (!countsBox || !listBox) return;
  clear(countsBox); clear(listBox);
  if (baseNote) clear(baseNote);

  const cs = (daily && daily.change_summary) || null;
  let base = cs && (cs.comparison_base || cs.compared_with);
  if (base && daily && base === daily.id) base = null;              // self-reference

  const target = base ? reports.find((r) => r.id === base) : previous;
  if (baseNote) {
    if (target && daily && target.id !== daily.id) {
      baseNote.appendChild(link(root() + target.path, null,
        `${L.UI.comparedWith}: ${formatDate(target.date)}`));
    } else {
      // Real state in the current data: every report has comparison_base null.
      baseNote.textContent = L.UI.noComparison;
    }
  }

  if (!digest || !digest.signals.length) {
    const rows = statusDiff(daily, previous);
    if (rows && rows.length) {
      const ul = el("ul", "change-list");
      rows.forEach((row) => ul.appendChild(changeRow(row)));
      listBox.appendChild(ul);
    } else {
      listBox.appendChild(emptyState(previous ? L.UI.unchanged : L.UI.noComparison));
    }
    return;
  }

  S.CHANGE_PRIORITY.forEach((kind) => {
    const n = digest.counts[kind] || 0;
    const chip = el("div", "change-count");
    chip.setAttribute("data-change", kind);
    chip.appendChild(el("span", "change-count__n", String(n)));
    chip.appendChild(el("span", "change-count__label", L.changeLabel(kind)));
    if (!n) chip.classList.add("is-zero");
    countsBox.appendChild(chip);
  });

  if (!digest.changed.length) {
    listBox.appendChild(emptyState(L.UI.changedNone));
    return;
  }

  renderRows(listBox, digest.changed,
    (sig) => signalCard(sig, { reports, rootPath: root(), compact: true }),
    { limit: 5 });
}

/* ---- five lenses ------------------------------------------------------------ */

function renderLenses(digest) {
  const grid = byId("lens-grid");
  const note = byId("lenses-note");
  if (!grid) return;
  clear(grid);

  if (note) {
    const empty = !digest || !digest.signals.length;
    note.hidden = !empty;
    if (empty) note.textContent = L.UI.noIntelligence;
  }

  S.LENSES.forEach((lens) => {
    const bucket = digest ? digest.byLens[lens] : { status: "unconfirmed", count: 0, top: null };
    const card = link(`${root()}lens-history.html?lens=${encodeURIComponent(lens)}`, "lens-card");
    card.setAttribute("data-status", bucket.status);
    card.setAttribute("data-lens", lens);
    card.setAttribute("aria-label", `${L.lensLabel(lens)}: ${L.lensStateLabel(bucket.status)} — シグナル履歴を表示`);

    const head = el("div", "lens-card__head");
    head.appendChild(el("span", "lens-card__name", L.lensLabel(lens)));
    const pill = el("span", "status-pill lens-state-pill");
    pill.setAttribute("data-lens-state", bucket.status);
    pill.appendChild(el("span", "dot"));
    pill.appendChild(document.createTextNode(L.lensStateLabel(bucket.status)));
    head.appendChild(pill);
    card.appendChild(head);

    card.appendChild(el("p", "lens-card__count",
      bucket.count ? L.UI.lensCount(bucket.count) : L.UI.lensEmpty));

    if (bucket.top) {
      card.appendChild(el("p", "lens-card__top", bucket.top.signal || S.signalName(bucket.top)));
    }
    card.appendChild(el("span", "lens-card__drill", "シグナル履歴 →"));
    grid.appendChild(card);
  });
}

/* ---- key signals ------------------------------------------------------------- */

function renderKeySignals(digest) {
  const box = byId("key-signals");
  if (!box) return;
  clear(box);

  if (!digest || !digest.signals.length) {
    box.appendChild(emptyState(L.UI.noIntelligence));
    return;
  }

  /* Normal telemetry recedes: a stable, unchanged NACCS signal backed by a
     `normal` board cell is status, not a headline (spec §9). Previously this
     was done by hiding cards after render. */
  /* Ranked in full, capped at 5 on screen. On a busy day the remainder stays
     reachable through the expander instead of being silently dropped. */
  const daily = latestOf(reports, "daily");
  const key = S.rank(digest.signals).filter((sig) => !S.isTelemetryOnly(sig, daily));

  if (!key.length) {
    box.appendChild(emptyState(L.UI.changedNone));
    return;
  }
  renderRows(box, key,
    (sig) => signalCard(sig, { reports, rootPath: root(), compact: true }),
    { limit: 5 });
}

/* ---- boot -------------------------------------------------------------------- */

export function init() {
  return Promise.all([loadReports(), loadRegistry()]).then(([data, registry]) => {
    S.useRegistry(registry);
    reports = data.reports;

    bindLatestReportNav(reports);
    markCurrent();

    const daily = latestOf(reports, "daily");
    const previous = previousOf(reports, daily);
    const digest = daily ? S.summarise(daily) : null;

    renderOverall(daily);
    renderActionBox(digest);
    renderConclusion(daily);
    renderBoard(daily);
    renderLatest();
    renderWhatChanged(daily, previous, digest);
    renderLenses(digest);
    renderKeySignals(digest);

    const stamp = byId("data-stamp");
    if (stamp && daily) {
      stamp.textContent = formatDate(daily.date, { weekday: true }) +
        (daily.as_of ? ` / ${daily.as_of}` : "");
    }
  }).catch((err) => {
    console.error(err);
    const box = byId("dashboard-error");
    if (box) { box.hidden = false; box.textContent = L.UI.loadError; }
    throw err;
  });
}
