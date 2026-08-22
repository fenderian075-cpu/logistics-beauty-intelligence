/* =========================================================================
   topic.js — Topic Intelligence Digest (Layer 2).
   -------------------------------------------------------------------------
   Stable URL: topic.html?id=<topic_id>. Bookmarkable, shareable, and the
   browser's back/forward buttons work because navigation is plain links.
   topic.html with no id renders the index.

   The reading order is fixed (instruction F) and the page is built in that
   order regardless of which fields happen to be populated:

     現在の状態 → 何が変わったか → 最新動向 → 実影響 → データ → 分析 →
     日本への意味 → 業務への意味 → 履歴 → 根拠 → 関連レポート

   Not everything is open at once. The state, what-changed and implications
   are always visible because they are the answer; developments, evidence and
   history are disclosures because they are the proof.

   The awkward parts of the real data drive the design here: two of the seven
   topics have no data points at all, one has no 90-day outlook, and several
   share a signal id with signal-registry.json — which is what makes the
   cross-links on this page possible.
   ========================================================================= */

import { el, link, byId, clear, root } from "../core/dom.js";
import { formatDate, formatShortDate } from "../core/format.js";
import * as L from "../core/labels.js";
import * as S from "../domain/signals.js";
import { loadIntel } from "../data/intel.js";
import { bindLatestReportNav, markCurrent } from "../core/nav.js";
import { emptyState, renderRows, statusPill } from "../render/primitives.js";
import { metricList } from "../render/metrics.js";
import { radarRowFull } from "../render/radar-row.js";
import { signalCard } from "../render/signal-card.js";

/* ---- shared bits ----------------------------------------------------------- */

function section(id, title, note) {
  const s = el("section", "topic-section");
  s.id = id;
  const head = el("div", "topic-section__head");
  head.appendChild(el("h2", "topic-section__title", title));
  if (note) head.appendChild(el("p", "topic-section__note", note));
  s.appendChild(head);
  return s;
}

function prose(text) {
  return el("p", "topic-prose", text);
}

function evidenceItems(evidence) {
  const list = el("ul", "evidence-list");
  (evidence || []).forEach((ev) => {
    const li = el("li");
    const tier = L.evidenceTier(ev.class);
    const mark = el("span", "ev-class", tier.label);
    mark.setAttribute("data-tier", tier.tier);
    li.appendChild(mark);
    li.appendChild(document.createTextNode(" "));
    if (ev.url) {
      const a = link(ev.url, null, ev.source || ev.url);
      a.target = "_blank";
      a.rel = "noopener";
      li.appendChild(a);
    } else {
      li.appendChild(document.createTextNode(ev.source || ""));
    }
    if (ev.date) li.appendChild(el("span", "sig__evidence-date", ` ${ev.date}`));
    list.appendChild(li);
  });
  return list;
}

/* ---- index ------------------------------------------------------------------ */

function indexRow(topic, intel) {
  const a = link(`${root()}topic.html?id=${encodeURIComponent(topic.topic_id)}`, "topic-index-row");
  a.setAttribute("data-state", topic.current_state || "unconfirmed");

  a.appendChild(el("span", "topic-index-row__state", L.topicStateLabel(topic.current_state)));
  a.appendChild(el("span", "topic-index-row__title", topic.title_ja || topic.topic_id));

  const news = intel.newsFor(topic.topic_id);
  const observed = news.filter((n) => n.status === "observed").length;
  const bits = [`動向 ${(topic.developments || []).length}`];
  if (news.length) bits.push(`レーダー ${news.length}${observed ? `（実影響 ${observed}）` : ""}`);
  bits.push(`確度 ${L.confidenceLabel(topic.confidence)}`);
  a.appendChild(el("span", "topic-index-row__meta", bits.join(" · ")));

  const updated = intel.lastUpdated(topic);
  a.appendChild(el("span", "topic-index-row__date", updated ? formatShortDate(updated) : "—"));
  return a;
}

function renderIndex(host, intel, message) {
  clear(host);
  const head = el("header", "page-head");
  head.appendChild(el("p", "eyebrow", "TOPIC INTELLIGENCE"));
  head.appendChild(el("h1", "page-title", L.UI.topicIndexTitle));
  head.appendChild(el("p", "page-lead", L.UI.topicIndexLead));
  host.appendChild(head);

  if (message) host.appendChild(emptyState(message));

  const topics = intel.topics.slice().sort((a, b) => intel.topicWeight(b) - intel.topicWeight(a));
  if (!topics.length) {
    host.appendChild(emptyState("トピックはまだ登録されていません。"));
    return;
  }

  const list = el("div", "topic-index");
  topics.forEach((t) => list.appendChild(indexRow(t, intel)));
  host.appendChild(list);
}

/* ---- digest sections ---------------------------------------------------------- */

function stateHeader(topic, intel) {
  const head = el("header", "topic-head");
  head.setAttribute("data-state", topic.current_state || "unconfirmed");

  const crumbs = el("nav", "breadcrumb");
  crumbs.setAttribute("aria-label", "パンくずリスト");
  const ol = el("ol");
  const home = el("li"); home.appendChild(link(`${root()}index.html`, null, "ホーム"));
  const idx = el("li"); idx.appendChild(link(`${root()}topic.html`, null, L.UI.topicIndexTitle));
  const self = el("li", null, topic.title_ja || topic.topic_id);
  self.setAttribute("aria-current", "page");
  ol.append(home, idx, self);
  crumbs.appendChild(ol);
  head.appendChild(crumbs);

  head.appendChild(el("h1", "topic-title", topic.title_ja || topic.topic_id));

  const meta = el("div", "topic-meta");
  const state = el("span", "topic-state");
  state.setAttribute("data-state", topic.current_state || "unconfirmed");
  state.appendChild(el("span", "dot"));
  state.appendChild(document.createTextNode(L.topicStateLabel(topic.current_state)));
  meta.appendChild(state);
  meta.appendChild(el("span", "topic-meta__item", `確度 ${L.confidenceLabel(topic.confidence)}`));

  const updated = intel.lastUpdated(topic);
  if (updated) meta.appendChild(el("span", "topic-meta__item", `最終更新 ${formatDate(updated)}`));
  meta.appendChild(el("span", "topic-meta__id", topic.topic_id));
  head.appendChild(meta);

  head.appendChild(el("p", "topic-summary", topic.summary || "—"));
  return head;
}

/** 何が変わったか — a synthesis, not a repeat of the top of the chronology
    below it. Three lines at most: the latest confirmed impact, the latest
    thing merely reported, and how much has moved recently. Everything here is
    derived from the same records the chronology shows, so the two can never
    disagree. */
function whatChanged(topic, intel) {
  const developments = (topic.developments || []).slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const news = intel.newsFor(topic.topic_id);

  const observedDev = developments.find((d) => d.type === "observed_impact");
  const observedNews = news.find((n) => n.status === "observed");
  const reportedDev = developments.find((d) => d.type === "reported_event");
  const reportedNews = news.find((n) => n.status === "reported");

  const lines = [];
  const push = (kind, date, label, text) => {
    if (!text || lines.some((l) => l.text === text)) return;
    lines.push({ kind, date, label, text });
  };

  const newerOf = (a, b) => {
    if (!a) return b;
    if (!b) return a;
    return String(a.date) >= String(b.date) ? a : b;
  };

  const observed = newerOf(observedDev, observedNews);
  const reported = newerOf(reportedDev, reportedNews);
  if (observed) push("observed_impact", observed.date, L.UI.observedLabel, observed.headline);
  if (reported) push("reported_event", reported.date, L.UI.reportedLabel, reported.headline);

  /* Several topics move through corporate or market updates rather than
     operational events — Beauty especially. Falling back to the newest
     development of any type keeps this section from going blank on them. */
  if (!lines.length && developments.length) {
    const latest = developments[0];
    push(latest.type || "update", latest.date, L.developmentTypeLabel(latest.type), latest.headline);
  }

  const s = section("changed", L.UI.topicSections.changed);
  if (!lines.length) {
    s.appendChild(emptyState("直近の変化は記録されていません。"));
    return s;
  }

  const list = el("ul", "change-lines");
  lines.forEach((line) => {
    const li = el("li", "change-line");
    li.setAttribute("data-type", line.kind);
    li.appendChild(el("span", "change-line__date", formatShortDate(line.date)));
    li.appendChild(el("span", "change-line__type", line.label));
    li.appendChild(el("span", "change-line__text", line.text));
    list.appendChild(li);
  });
  s.appendChild(list);

  /* Movement, stated as a count rather than implied by list length. */
  const recent = [...developments, ...news].filter((x) => {
    const d = new Date(x.date);
    return !isNaN(d) && (Date.now() - d.getTime()) < 14 * 86400000;
  });
  if (recent.length) {
    s.appendChild(el("p", "count-note", `直近2週間の更新 ${recent.length} 件`));
  }
  if (!observed) {
    s.appendChild(el("p", "count-note", "実影響として確認された事象はまだありません。"));
  }
  return s;
}

function developmentRow(dev) {
  const details = el("details", "development");
  details.setAttribute("data-type", dev.type || "");

  const summary = el("summary", "development__summary");
  summary.appendChild(el("span", "development__date", formatShortDate(dev.date)));
  summary.appendChild(el("span", "development__type", L.developmentTypeLabel(dev.type)));
  summary.appendChild(el("span", "development__headline", dev.headline || "更新"));
  details.appendChild(summary);

  const body = el("div", "development__body");
  if (dev.summary) body.appendChild(prose(dev.summary));
  if (dev.evidence && dev.evidence.length) body.appendChild(evidenceItems(dev.evidence));
  if (!body.childNodes.length) body.appendChild(el("p", "muted", "詳細は登録されていません。"));
  details.appendChild(body);
  return details;
}

function developments(topic) {
  const list = (topic.developments || []).slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const s = section("developments", L.UI.topicSections.developments,
    list.length ? `${list.length} 件・新しい順` : null);

  if (!list.length) {
    s.appendChild(emptyState(L.UI.topicNoDevelopments));
    return s;
  }

  /* Reported and observed are separated visually but kept in one chronology:
     splitting them into two lists would break the sequence of events. */
  const box = el("div", "development-list");
  renderRows(box, list, developmentRow, { limit: 6 });
  s.appendChild(box);

  const observed = list.filter((d) => d.type === "observed_impact").length;
  const reported = list.filter((d) => d.type === "reported_event").length;
  if (observed || reported) {
    s.appendChild(el("p", "count-note",
      `${L.UI.observedLabel} ${observed} 件 / ${L.UI.reportedLabel} ${reported} 件`));
  }
  return s;
}

function dataSection(topic) {
  const s = section("data", L.UI.topicSections.data);
  const metrics = metricList(topic.data_points);
  if (metrics) s.appendChild(metrics);
  else s.appendChild(emptyState(L.UI.topicNoData));
  return s;
}

function implications(topic) {
  const s = section("implication", L.UI.topicSections.implication);
  const grid = el("div", "implication-grid");

  [[L.UI.japanImplication, topic.japan_implication],
   [L.UI.operationalImplication, topic.operational_implication]].forEach(([label, text]) => {
    const box = el("div", "implication");
    box.appendChild(el("p", "implication__label", label));
    box.appendChild(el("p", "implication__text", text || "登録されていません。"));
    grid.appendChild(box);
  });

  s.appendChild(grid);
  return s;
}

function outlook(topic) {
  const entries = [["7日", topic.outlook_7d], ["30日", topic.outlook_30d], ["90日", topic.outlook_90d]]
    .filter(([, text]) => text);

  const s = section("outlook", L.UI.topicSections.outlook);
  if (!entries.length) {
    s.appendChild(emptyState(L.UI.topicNoOutlook));
    return s;
  }

  /* Horizons that carry no text are omitted, not rendered empty: outlook_90d
     is genuinely null on several topics and a blank tab would imply neglect. */
  const list = el("dl", "outlook-list");
  entries.forEach(([horizon, text]) => {
    list.appendChild(el("dt", "outlook-list__term", horizon));
    list.appendChild(el("dd", "outlook-list__desc", text));
  });
  s.appendChild(list);
  return s;
}

function regimeRows(topic, intel) {
  const rows = intel.regimeFor(topic.topic_id);
  if (!rows.length) return null;

  const s = section("regime", "市場レジーム", "この topic に関係する週次・月次の市場評価");
  const table = el("table", "topic-regime");
  const thead = el("thead");
  const hr = el("tr");
  ["レポート", "対象", "運賃", "供給", "実需", "定時性", "リスク"].forEach((label) => {
    const th = el("th", null, label);
    th.setAttribute("scope", "col");
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = el("tbody");
  rows.forEach(({ report, row }) => {
    const tr = el("tr");
    const first = el("td");
    first.appendChild(link(root() + report.path, null, `${L.typeLabel(report.type)} ${formatShortDate(report.date)}`));
    tr.appendChild(first);
    tr.appendChild(el("td", null, row.scope || row.id));
    ["rate", "supply", "demand", "reliability"].forEach((key) => {
      const dim = row[key] || {};
      const dir = dim.direction || "unknown";
      const td = el("td");
      const span = el("span", `regime-value regime-value--${dir}`);
      span.appendChild(el("span", "regime-value__arrow", L.arrow(dir)));
      span.appendChild(document.createTextNode(L.directionLabel(dir)));
      td.appendChild(span);
      tr.appendChild(td);
    });
    const risk = row.risk || "unknown";
    const riskTd = el("td");
    riskTd.appendChild(el("span", `risk-pill risk-pill--${risk}`, L.riskLabel(risk)));
    tr.appendChild(riskTd);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  const wrap = el("div", "table-scroll");
  wrap.appendChild(table);
  s.appendChild(wrap);
  return s;
}

function history(topic, intel) {
  const observations = intel.signalsFor(topic.topic_id);
  if (!observations.length) return null;

  const s = section("history", "シグナル履歴",
    `${observations.length} 観測 · signal id ${topic.topic_id}`);
  const box = el("div", "topic-signal-list");
  renderRows(box, observations, ({ report, sig }) => {
    const card = signalCard(sig, { reports: intel.reports, rootPath: root(), compact: true });
    card.setAttribute("data-report", report.id);
    return card;
  }, { limit: 3 });
  s.appendChild(box);
  return s;
}

function relatedRadar(topic, intel) {
  const news = intel.newsFor(topic.topic_id);
  const s = section("radar", L.UI.relatedRadar, news.length ? `${news.length} 件` : null);
  if (!news.length) {
    s.appendChild(emptyState(L.UI.topicNoNews));
    return s;
  }
  const box = el("div", "radar-list");
  renderRows(box, news, (item) => radarRowFull(item, intel), { limit: 4 });
  s.appendChild(box);
  return s;
}

function relatedReports(topic, intel) {
  const reports = intel.reportsFor(topic);
  const s = section("reports", L.UI.relatedReports);
  if (!reports.length) {
    s.appendChild(emptyState("関連レポートは登録されていません。"));
    return s;
  }
  const box = el("div", "related-reports");
  reports.forEach((r) => {
    const a = link(root() + r.path, "related-report");
    a.appendChild(el("span", "related-report__type", L.typeLabel(r.type)));
    a.appendChild(el("span", "related-report__date", formatDate(r.date)));
    a.appendChild(statusPill(r.status));
    a.appendChild(el("span", "related-report__summary", r.summary || ""));
    box.appendChild(a);
  });
  s.appendChild(box);
  return s;
}

function evidenceIndex(topic, intel) {
  const fromDevelopments = (topic.developments || []).flatMap((d) => d.evidence || []);
  const fromNews = intel.newsFor(topic.topic_id).flatMap((n) => n.evidence || []);
  const seen = new Set();
  const all = [...fromDevelopments, ...fromNews].filter((ev) => {
    const key = ev.url || `${ev.source}|${ev.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const s = section("evidence", L.UI.topicSections.evidence, all.length ? `${all.length} 件` : null);
  if (!all.length) {
    s.appendChild(emptyState(L.UI.topicNoEvidence));
    return s;
  }
  s.appendChild(evidenceItems(all));
  return s;
}

/** In-page navigation. Anchors, so the browser's own history keeps working. */
function tableOfContents(sections) {
  const nav = el("nav", "topic-toc");
  nav.setAttribute("aria-label", "セクション");
  sections.forEach(({ id, label }) => nav.appendChild(link(`#${id}`, "topic-toc__link", label)));
  return nav;
}

function renderDigest(host, topic, intel) {
  clear(host);
  document.title = `${topic.title_ja || topic.topic_id} | LBI`;

  host.appendChild(stateHeader(topic, intel));

  const layout = el("div", "topic-layout");
  const main = el("div", "topic-main");
  const side = el("aside", "topic-side");

  const built = [];
  const push = (target, node, id, label) => {
    if (!node) return;
    target.appendChild(node);
    if (id) built.push({ id, label });
  };

  push(main, whatChanged(topic, intel), "changed", "変化");
  push(main, developments(topic), "developments", "動向");
  push(main, implications(topic), "implication", "含意");
  push(main, outlook(topic), "outlook", "見通し");
  push(main, relatedRadar(topic, intel), "radar", "レーダー");
  push(main, history(topic, intel), "history", "履歴");

  push(side, dataSection(topic), "data", "データ");
  push(side, regimeRows(topic, intel), "regime", "市場");
  push(side, relatedReports(topic, intel), "reports", "レポート");
  push(side, evidenceIndex(topic, intel), "evidence", "根拠");

  host.appendChild(tableOfContents(built));
  layout.appendChild(main);
  layout.appendChild(side);
  host.appendChild(layout);
}

/* ---- boot ---------------------------------------------------------------------- */

export function init() {
  const host = byId("topic-root");
  if (!host) return Promise.resolve();

  return loadIntel().then((intel) => {
    bindLatestReportNav(intel.reports);
    markCurrent();

    const id = new URLSearchParams(location.search).get("id");
    if (!id) return renderIndex(host, intel);

    const topic = intel.topic(id);
    if (!topic) return renderIndex(host, intel, L.UI.topicNotFound);

    return renderDigest(host, topic, intel);
  }).catch((err) => {
    console.error(err);
    clear(host);
    host.appendChild(emptyState(L.UI.loadError));
    throw err;
  });
}
