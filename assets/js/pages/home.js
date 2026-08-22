/* =========================================================================
   home.js — dashboard.
   -------------------------------------------------------------------------
   v6 order, top to bottom:

     1. 本日の判断      what to do, in one strip
     2. Operations Radar what must not be missed, observed impact first
     3. 日本物流ステータス the六 operational domains, normal recedes
     4. 最新レポート     the three analytical products, one short scroll in
     5. 前回からの変化 ‖ 主要シグナル
     6. 市場レジーム     why the market is moving, with a route into topics
     7. 5つの視点
     8. 注目トピック     the entry point to Layer 2

   Everything above the fold answers 「今、何か問題がある？」 and
   「何が変わった？」; everything below is the route into the depth. Every
   block leads somewhere specific — a topic digest, a report, a history —
   never to a generic page.

   Rendering rules carried over from v5:

     - one pass, no polling, no post-hoc DOM rewriting;
     - status cells and lens cards are real <a href> elements, so they can be
       middle-clicked, bookmarked and read by assistive tech as links;
     - "normal telemetry is not intelligence" is applied at render time from
       the signal data, not by regex-scrubbing text out of the DOM;
     - the missing-baseline case (every report currently has
       change_summary.comparison_base = null) is a first-class state.
   ========================================================================= */

import { el, link, byId, clear, root } from "../core/dom.js";
import { formatDate, formatMonth, formatShortDate } from "../core/format.js";
import * as L from "../core/labels.js";
import { loadIntel } from "../data/intel.js";
import { previousOf, latestOf, statusDiff, direction, DOMAINS } from "../data/adapters.js";
import * as S from "../domain/signals.js";
import { bindLatestReportNav, markCurrent } from "../core/nav.js";
import { mountShell } from "../core/shell.js";
import { statusPill, emptyState, renderRows } from "../render/primitives.js";
import { signalCard } from "../render/signal-card.js";
import { radarRowCompact } from "../render/radar-row.js";

let reports = [];
let intel = null;

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
    (sig) => signalCard(sig, { reports, rootPath: root(), compact: true, topicFor: intel.topicForSignal }),
    { limit: 5 });
}

/* ---- five lenses ------------------------------------------------------------ */

/* The daily is an exception report: on a normal day four of the five lenses
   carry no signals, and a strip of four 未確認 tiles says nothing useful. So
   each lens falls back to the most recent report that DID observe it, and
   labels where the reading came from. Only a lens nobody has ever reported on
   stays 未確認. */
function lensBuckets(daily, digest) {
  const buckets = {};
  S.LENSES.forEach((lens) => {
    const own = digest ? digest.byLens[lens] : null;
    if (own && own.count) {
      buckets[lens] = { ...own, source: daily };
      return;
    }
    const source = reports.find((r) => S.signalsOf(r).some((s) => s.lens === lens));
    if (!source) {
      buckets[lens] = { status: "unconfirmed", count: 0, top: null, source: null };
      return;
    }
    const list = S.signalsOf(source).filter((s) => s.lens === lens);
    buckets[lens] = {
      lens,
      signals: list,
      status: S.lensStatus(lens, list),
      count: list.length,
      top: S.rank(list, 1)[0],
      source
    };
  });
  return buckets;
}

function renderLenses(daily, digest) {
  const grid = byId("lens-grid");
  const note = byId("lenses-note");
  if (!grid) return;
  clear(grid);

  const buckets = lensBuckets(daily, digest);

  if (note) {
    const empty = S.LENSES.every((lens) => !buckets[lens].count);
    note.hidden = !empty;
    if (empty) note.textContent = L.UI.noIntelligence;
  }

  S.LENSES.forEach((lens) => {
    const bucket = buckets[lens];
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

    const count = el("p", "lens-card__count");
    count.appendChild(document.createTextNode(bucket.count ? L.UI.lensCount(bucket.count) : L.UI.lensEmpty));
    if (bucket.source && daily && bucket.source.id !== daily.id) {
      count.appendChild(el("span", "lens-card__source",
        `${L.typeLabel(bucket.source.type)} ${formatShortDate(bucket.source.date)} 時点`));
    }
    card.appendChild(count);

    if (bucket.top) {
      card.appendChild(el("p", "lens-card__top", bucket.top.signal || S.signalName(bucket.top)));
    }
    const topic = bucket.top ? intel.topicForSignal(bucket.top) : null;
    card.appendChild(el("span", "lens-card__drill",
      topic ? `${topic.title_ja} →` : "シグナル履歴 →"));
    grid.appendChild(card);
  });
}

/* ---- operations radar --------------------------------------------------------- */

function renderRadar() {
  const box = byId("operations-radar");
  const meta = byId("operations-radar-meta");
  if (!box) return;
  clear(box);

  const items = intel.news;
  if (meta) {
    const observed = items.filter((i) => i.status === "observed").length;
    const reported = items.filter((i) => i.status === "reported").length;
    meta.textContent = `${L.UI.observedLabel} ${observed} / ${L.UI.reportedLabel} ${reported}`;
  }

  if (!items.length) {
    box.appendChild(emptyState(L.UI.radarEmpty));
    return;
  }

  /* The dashboard shows what changes a decision today. Everything observed
     is worth the space; beyond that the list is capped, because the point of
     the block is triage, not completeness — radar.html is completeness. */
  const observed = items.filter((i) => i.status === "observed");
  const limit = Math.min(Math.max(observed.length, 3) + 2, 6);
  renderRows(box, items, (item) => radarRowCompact(item, intel), { limit });
}

/* ---- market regime ------------------------------------------------------------- */

function regimeCell(dimension) {
  const dir = (dimension && dimension.direction) || "unknown";
  const td = el("td");
  const span = el("span", `regime-value regime-value--${dir}`);
  span.appendChild(el("span", "regime-value__arrow", L.arrow(dir)));
  span.appendChild(document.createTextNode(L.directionLabel(dir)));
  td.appendChild(span);
  return td;
}

function renderRegime() {
  const box = byId("market-regime-strip");
  const note = byId("market-regime-note");
  if (!box) return;
  clear(box);

  const source = latestOf(reports, "weekly") || latestOf(reports, "monthly");
  const rows = (source && source.market_intelligence) || [];
  if (!rows.length) {
    box.appendChild(emptyState("市場レジームは週次・月次レポートから生成されます。"));
    return;
  }
  if (note) {
    note.textContent = `${L.typeLabel(source.type)} ${formatShortDate(source.date)} 時点`;
  }

  const table = el("table", "regime-strip");
  const thead = el("thead");
  const hr = el("tr");
  ["対象", "運賃", "供給", "実需", "定時性", "リスク", ""].forEach((label) => {
    const th = el("th", null, label);
    th.setAttribute("scope", "col");
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = el("tbody");
  rows.forEach((row) => {
    const tr = el("tr");
    const scope = el("td", "regime-strip__scope");
    scope.appendChild(el("strong", null, row.scope || row.id));
    if (row.japan_implication) scope.appendChild(el("small", null, row.japan_implication));
    tr.appendChild(scope);

    ["rate", "supply", "demand", "reliability"].forEach((key) => tr.appendChild(regimeCell(row[key])));

    const risk = row.risk || "unknown";
    const riskTd = el("td");
    riskTd.appendChild(el("span", `risk-pill risk-pill--${risk}`, L.riskLabel(risk)));
    tr.appendChild(riskTd);

    /* Each row leads somewhere: the topic that explains the movement, or the
       report the row came from. A regime table that cannot be interrogated is
       just five arrows. */
    const drill = el("td", "regime-strip__drill");
    const topics = intel.topicsForRegime(row);
    if (topics.length) {
      drill.appendChild(link(`${root()}topic.html?id=${encodeURIComponent(topics[0].topic_id)}`,
        "chip-link", "背景を見る →"));
    } else {
      drill.appendChild(link(root() + source.path, "chip-link", "レポート →"));
    }
    tr.appendChild(drill);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  const wrap = el("div", "table-scroll");
  wrap.appendChild(table);
  box.appendChild(wrap);
}

/* ---- featured topics ------------------------------------------------------------ */

function renderTopics() {
  const box = byId("featured-topics");
  if (!box) return;
  clear(box);

  const topics = intel.topics.slice().sort((a, b) => intel.topicWeight(b) - intel.topicWeight(a));
  if (!topics.length) {
    box.appendChild(emptyState("トピックを蓄積中です。"));
    return;
  }

  renderRows(box, topics, (topic) => {
    const a = link(`${root()}topic.html?id=${encodeURIComponent(topic.topic_id)}`, "topic-index-row");
    a.setAttribute("data-state", topic.current_state || "unconfirmed");
    a.appendChild(el("span", "topic-index-row__state", L.topicStateLabel(topic.current_state)));
    a.appendChild(el("span", "topic-index-row__title", topic.title_ja || topic.topic_id));

    const news = intel.newsFor(topic.topic_id);
    const observed = news.filter((n) => n.status === "observed").length;
    a.appendChild(el("span", "topic-index-row__meta",
      observed ? `${L.UI.observedLabel} ${observed} 件` : `動向 ${(topic.developments || []).length} 件`));

    const updated = intel.lastUpdated(topic);
    a.appendChild(el("span", "topic-index-row__date", updated ? formatShortDate(updated) : "—"));
    return a;
  }, { limit: 5 });
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
    (sig) => signalCard(sig, { reports, rootPath: root(), compact: true, topicFor: intel.topicForSignal }),
    { limit: 5 });
}

/* ---- boot -------------------------------------------------------------------- */

export function init() {
  return loadIntel().then((graph) => {
    intel = graph;
    reports = graph.reports;
    mountShell(graph);

    bindLatestReportNav(reports);
    markCurrent();

    const daily = latestOf(reports, "daily");
    const previous = previousOf(reports, daily);
    const digest = daily ? S.summarise(daily) : null;

    renderOverall(daily);
    renderActionBox(digest);
    renderConclusion(daily);
    renderRadar();
    renderBoard(daily);
    renderLatest();
    renderWhatChanged(daily, previous, digest);
    renderKeySignals(digest);
    renderRegime();
    renderLenses(daily, digest);
    renderTopics();

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
