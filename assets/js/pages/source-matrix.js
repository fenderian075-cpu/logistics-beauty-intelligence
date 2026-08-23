/* =========================================================================
   source-matrix.js — 公開用の監視情報源一覧。
   個別ブランドの監視対象は公開せず、集約した監視群として表示する。
   ========================================================================= */

import { el, extLink, byId, clear } from "../core/dom.js";
import * as L from "../core/labels.js";
import { loadSourceMatrix, loadReports, loadCriticalNews } from "../data/store.js";
import { bindLatestReportNav, markCurrent } from "../core/nav.js";
import { mountShell } from "../core/shell.js";

let sources = [];

const PRIORITY_ORDER = new Map([
  ["P0", 0], ["P1", 1], ["P2", 2], ["P3", 3]
]);

const DOMAIN_LABEL = {
  logistics: "物流",
  beauty: "化粧品",
  economics: "経済",
  economy: "経済"
};

const CADENCE_LABEL = {
  daily: "日次",
  weekly: "週次",
  monthly: "月次"
};

function priorityRank(value) {
  return PRIORITY_ORDER.has(value) ? PRIORITY_ORDER.get(value) : 99;
}

function domainLabel(value) {
  return DOMAIN_LABEL[value] || value || "—";
}

function cadenceLabel(value) {
  return CADENCE_LABEL[value] || value;
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

function publicSourceList(list) {
  // Legacy data may still contain an English Brand.com layer. Aggregate it at
  // render time as a second line of defence; current public JSON is sanitized too.
  const brandSources = list.filter((s) => {
    const layer = String(s.layer || "").toLowerCase();
    return layer.includes("brand.com") || layer.includes("ブランド公式サイト監視");
  });
  const visible = list.filter((s) => {
    const layer = String(s.layer || "").toLowerCase();
    return !layer.includes("brand.com") && !layer.includes("ブランド公式サイト監視");
  });

  if (brandSources.length) {
    visible.push({
      priority: "P1",
      domain: "beauty",
      layer: "ブランド公式サイト監視",
      name: "ブランド公式サイト監視群",
      url: null,
      cadence: ["daily"],
      extract: ["新製品", "限定品", "GWP/PWP", "ギフト", "EC限定", "先行販売", "施策", "販売条件の重要変更"]
    });
  }
  return visible;
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
    if (q && [s.name, s.layer, domainLabel(s.domain), (s.extract || []).join(" ")].join(" ").toLowerCase().indexOf(q) < 0) return false;
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

    tr.appendChild(el("td", null, `${domainLabel(s.domain)} / ${s.layer}`));

    const nameTd = el("td");
    if (s.url) nameTd.appendChild(extLink(s.url, s.name));
    else nameTd.appendChild(el("span", null, s.name));
    tr.appendChild(nameTd);

    tr.appendChild(el("td", null, (s.cadence || []).map(cadenceLabel).join(" / ")));
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
      sources = publicSourceList(list);
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
