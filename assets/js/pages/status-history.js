/* =========================================================================
   status-history.js — one operational domain, over time.
   -------------------------------------------------------------------------
   Reached from the dashboard status board. PR2 turns this into the full
   "operational status history + related topics" view; PR1 keeps the existing
   behaviour and fixes the plumbing (shared store, shared header, evidence
   provenance labels, real empty states).
   ========================================================================= */

import { el, link, byId, clear, root } from "../core/dom.js";
import * as L from "../core/labels.js";
import { loadReports, loadRegistry } from "../data/store.js";
import * as S from "../domain/signals.js";
import { bindLatestReportNav, markCurrent } from "../core/nav.js";
import { statusPill, emptyState, evidenceList } from "../render/primitives.js";

const DOMAIN_MATCH = {
  domestic: (s) => /^japan-domestic-/.test(s.id || ""),
  weather: (s) => /^japan-weather-/.test(s.id || ""),
  customs: (s) => /^japan-customs-/.test(s.id || "") || s.lens === "regulatory_structural",
  ocean: (s) => /^ocean-/.test(s.id || "") || s.id === "middle-east-maritime-risk",
  air: (s) => /^air-/.test(s.id || ""),
  global: (s) => s.id === "middle-east-maritime-risk" || s.lens === "disruption"
};

function currentDomain() {
  const value = new URLSearchParams(location.search).get("domain") || "";
  return L.DOMAIN[value] ? value : "domestic";
}

function indexRow(report, domain) {
  const signals = S.signalsOf(report).filter(DOMAIN_MATCH[domain]);
  const status = (report.status_board && report.status_board[domain]) || "unconfirmed";

  const item = el("article", "timeline-item");
  item.setAttribute("data-status", status);

  const meta = el("div", "timeline-item__meta");
  meta.appendChild(el("span", "timeline-item__date", `${report.date} · ${L.typeLabel(report.type)}`));
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

export function init() {
  const domain = currentDomain();
  document.title = `${L.domainLabel(domain)}の履歴 | Logistics & Beauty Intelligence`;

  const title = byId("history-title");
  const lead = byId("history-lead");
  if (title) title.textContent = `${L.domainLabel(domain)} — 時系列`;
  if (lead) lead.textContent = "ステータス、関連シグナル、根拠を同じ時間軸で確認します。";

  return Promise.all([loadReports(), loadRegistry()]).then(([data, registry]) => {
    S.useRegistry(registry);
    const box = byId("history-list");
    if (!box) return;
    clear(box);

    const reports = data.reports;
    if (!reports.length) {
      box.appendChild(emptyState("履歴はまだありません。"));
    } else {
      reports.forEach((report) => box.appendChild(indexRow(report, domain)));
    }

    bindLatestReportNav(reports);
    markCurrent();
  }).catch((err) => {
    console.error(err);
    const box = byId("history-list");
    if (box) { clear(box); box.appendChild(emptyState(L.UI.loadError)); }
    throw err;
  });
}
