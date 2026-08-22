/* =========================================================================
   status-history.js — one operational domain: state, topics, radar, history.
   -------------------------------------------------------------------------
   Redesigned in v6 (instruction 3). The domain, not the calendar, is the
   subject: you arrive from a status cell asking "what is going on with 海上
   輸送", so the page answers in that order — the topics that cover it, the
   radar items that hit it, and only then the status timeline.

   Its sibling, lens-history.js, enters from an intelligence lens instead.
   Neither replaces the Topic Digest: they are the cross-topic views.
   ========================================================================= */

import { el, link, byId, clear, root } from "../core/dom.js";
import { formatDate, formatShortDate } from "../core/format.js";
import * as L from "../core/labels.js";
import { loadIntel } from "../data/intel.js";
import * as S from "../domain/signals.js";
import { DOMAINS } from "../data/adapters.js";
import { bindLatestReportNav, markCurrent } from "../core/nav.js";
import { statusPill, emptyState, evidenceList, renderRows } from "../render/primitives.js";
import { radarRowFull } from "../render/radar-row.js";

/* Which signals belong to a domain. Kept here (display logic) rather than in
   the data, which the pipeline owns. */
const DOMAIN_MATCH = {
  domestic: (s) => /^japan-domestic-/.test(s.id || ""),
  weather: (s) => /^japan-weather-/.test(s.id || ""),
  customs: (s) => /^japan-customs-/.test(s.id || "") || s.lens === "regulatory_structural",
  ocean: (s) => /^ocean-/.test(s.id || "") || s.id === "middle-east-maritime-risk",
  air: (s) => /^air-/.test(s.id || ""),
  global: (s) => s.id === "middle-east-maritime-risk" || s.lens === "disruption"
};

const NEWS_DOMAIN_MATCH = {
  domestic: (n) => n.domain === "domestic_delivery",
  weather: (n) => n.domain === "weather",
  customs: (n) => n.domain === "customs" || n.domain === "regulatory",
  ocean: (n) => n.domain === "ocean",
  air: (n) => n.domain === "air",
  global: (n) => n.domain === "ocean" || n.domain === "global"
};

function currentDomain() {
  const value = new URLSearchParams(location.search).get("domain") || "";
  return L.DOMAIN[value] ? value : "domestic";
}

/** Switch between domains without going back to the dashboard. */
function domainSwitch(current, reports) {
  const nav = el("nav", "lens-switch");
  nav.setAttribute("aria-label", "ドメインの切り替え");
  const latest = reports[0];
  DOMAINS.forEach((domain) => {
    const a = link(`${root()}status-history.html?domain=${encodeURIComponent(domain)}`, "lens-switch__item");
    const state = latest && latest.status_board ? (latest.status_board[domain] || "unconfirmed") : "unconfirmed";
    a.setAttribute("data-status", state);
    if (domain === current) a.setAttribute("aria-current", "page");
    a.appendChild(el("span", "dot"));
    a.appendChild(el("span", null, L.domainLabel(domain)));
    nav.appendChild(a);
  });
  return nav;
}

function timelineItem(report, domain) {
  const signals = S.signalsOf(report).filter(DOMAIN_MATCH[domain]);
  const status = (report.status_board && report.status_board[domain]) || "unconfirmed";

  const item = el("article", "timeline-item");
  item.setAttribute("data-status", status);

  const meta = el("div", "timeline-item__meta");
  meta.appendChild(el("span", "timeline-item__date", `${formatDate(report.date)} · ${L.typeLabel(report.type)}`));
  meta.appendChild(statusPill(status));
  item.appendChild(meta);

  const h3 = el("h3");
  h3.appendChild(link(root() + report.path, null, report.title || report.id));
  item.appendChild(h3);

  if (report.summary) item.appendChild(el("p", null, report.summary));

  signals.forEach((sig) => {
    const p = el("p", "timeline-signal");
    p.appendChild(el("strong", null, `${S.signalName(sig)}: `));
    p.appendChild(document.createTextNode(sig.signal || ""));
    item.appendChild(p);
    const evidence = evidenceList(sig.evidence);
    if (evidence) {
      evidence.classList.add("timeline-evidence");
      item.appendChild(evidence);
    }
  });

  if (domain === "ocean" && report.signals) {
    ["wci", "scfi"].forEach((key) => {
      const metric = report.signals[key];
      if (metric && metric.value != null) {
        item.appendChild(el("p", "timeline-metric",
          `${key.toUpperCase()}: ${metric.value} ${metric.unit || ""}`.trim()));
      }
    });
  }
  return item;
}

function topicRow(topic, intel) {
  const a = link(`${root()}topic.html?id=${encodeURIComponent(topic.topic_id)}`, "topic-index-row");
  a.setAttribute("data-state", topic.current_state || "unconfirmed");
  a.appendChild(el("span", "topic-index-row__state", L.topicStateLabel(topic.current_state)));
  a.appendChild(el("span", "topic-index-row__title", topic.title_ja || topic.topic_id));
  a.appendChild(el("span", "topic-index-row__meta", `動向 ${(topic.developments || []).length} 件`));
  const updated = intel.lastUpdated(topic);
  a.appendChild(el("span", "topic-index-row__date", updated ? formatShortDate(updated) : "—"));
  return a;
}

export function init() {
  const box = byId("history-list");
  if (!box) return Promise.resolve();

  const domain = currentDomain();
  document.title = `${L.domainLabel(domain)} | LBI`;

  const title = byId("history-title");
  const lead = byId("history-lead");
  if (title) title.textContent = L.domainLabel(domain);
  if (lead) lead.textContent = "このドメインのトピック、レーダー項目、ステータス推移をまとめて確認します。";

  return loadIntel().then((intel) => {
    bindLatestReportNav(intel.reports);
    markCurrent();

    const head = byId("history-title");
    if (head && head.parentNode) {
      head.parentNode.parentNode.insertBefore(domainSwitch(domain, intel.reports), head.parentNode.nextSibling);
    }

    const topicHost = byId("status-topics");
    if (topicHost) {
      clear(topicHost);
      const topics = intel.topicsForDomain(domain);
      if (!topics.length) topicHost.appendChild(emptyState("このドメインのトピックはまだありません。"));
      else topics.forEach((t) => topicHost.appendChild(topicRow(t, intel)));
    }

    const radarHost = byId("status-radar");
    if (radarHost) {
      clear(radarHost);
      const match = NEWS_DOMAIN_MATCH[domain] || (() => false);
      const items = intel.news.filter(match);
      if (!items.length) radarHost.appendChild(emptyState("関連するレーダー項目はありません。"));
      else renderRows(radarHost, items, (item) => radarRowFull(item, intel), { limit: 3 });
    }

    clear(box);
    if (!intel.reports.length) {
      box.appendChild(emptyState("履歴はまだありません。"));
      return;
    }
    renderRows(box, intel.reports, (report) => timelineItem(report, domain), { limit: 8 });
  }).catch((err) => {
    console.error(err);
    clear(box);
    box.appendChild(emptyState(L.UI.loadError));
    throw err;
  });
}
