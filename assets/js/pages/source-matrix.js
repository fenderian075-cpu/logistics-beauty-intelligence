/* =========================================================================
   source-matrix.js — the monitoring ledger (what the pipeline watches).
   ========================================================================= */

import { el, extLink, byId, clear } from "../core/dom.js";
import * as L from "../core/labels.js";
import { loadSourceMatrix, loadReports } from "../data/store.js";
import { bindLatestReportNav, markCurrent } from "../core/nav.js";
import { mountShell } from "../core/shell.js";
import { loadCriticalNews } from "../data/store.js";

let sources = [];

const PRIORITY_ORDER = new Map([
  ["P0", 0],
  ["P1", 1],
  ["P2", 2],
  ["P3", 3]
]);

function priorityRank(value) {
  return PRIORITY_ORDER.has(value) ? PRIORITY_ORDER.get(value) : 99;
}

function stableSourceSort(a, b) {
  const byPriority = priorityRank(a.priority) - priorityRank(b.priority);
  if (byPriority) return byPriority;

  const byDomain = String(a.domain || "").localeCompare(String(b.domain || ""), "ja");
  if (byDomain) return byDomain;

  const byLayer = String(a.layer || "").localeCompare(String(b.layer || ""), "ja");
  if (byLayer) return byLayer;

  return String(a.name || "").localeCompare(String(b.name || ""), "ja");
}

function value(id) {
  const node = byId(id);
  return node ? node.value : "";
}

function render() {
  const tbody = byId("source-body");
  if (!tbody) return;

  const domain = value("f-domain");
  const priority = value("f-priority");
  const cadence = value("f-cadence");
  const q = value("f-q").toLowerCase().trim();

  const rows = sources.filter((s) => {
    if (domain && s.domain !== domain) return false;
    if (priority && s.priority !== priority) return false;
    if (cadence && (s.cadence || []).indexOf(cadence) < 0) return false;
    if (q && [s.name, s.layer, (s.extract || []).join(" ")].join(" ").toLowerCase().indexOf(q) < 0) return false;
    return true;
  }).slice().sort(stableSourceSort);

  const count = byId("source-count");
  if (count) count.textContent = `${rows.length} 件`;

  clear(tbody);
  rows.forEach((s) => {
    const tr = el("tr");

    const pri = el("td");
    const chip = el("span", "priority", s.priority);
    chip.setAttribute("data-p", s.priority);
    pri.appendChild(chip);
    tr.appendChild(pri);

    tr.appendChild(el("td", null, `${s.domain} / ${s.layer}`));

    const nameTd = el("td");
    nameTd.appendChild(extLink(s.url, s.name));
    tr.appendChild(nameTd);

    tr.appendChild(el("td", null, (s.cadence || []).join(" / ")));
    tr.appendChild(el("td", null, (s.extract || []).join(" / ")));
    tbody.appendChild(tr);
  });

  if (!rows.length) {
    const tr = el("tr");
    const td = el("td", null, "該当なし");
    td.colSpan = 5;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
}

export function init() {
  ["f-domain", "f-priority", "f-cadence"].forEach((id) => {
    const node = byId(id);
    if (node) node.addEventListener("change", render);
  });
  const search = byId("f-q");
  if (search) search.addEventListener("input", render);

  return Promise.all([loadSourceMatrix(), loadReports(), loadCriticalNews()])
    .then(([list, reportData, newsData]) => {
    mountShell({ reports: reportData.reports, news: (newsData && newsData.items) || [] });
    sources = list;
    render();
    bindLatestReportNav(reportData.reports);
    markCurrent();
  }).catch((err) => {
    console.error(err);
    const count = byId("source-count");
    if (count) count.textContent = L.UI.loadError;
    throw err;
  });
}
