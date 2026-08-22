/* =========================================================================
   lens-history.js — one lens, every signal, over time.
   -------------------------------------------------------------------------
   Sibling of status-history.js: that page enters from an operational domain,
   this one from one of the five intelligence lenses. PR2 develops it into the
   lens-wide explorer; PR1 keeps the grouping and fixes the plumbing.
   ========================================================================= */

import { el, link, byId, clear, root } from "../core/dom.js";
import * as L from "../core/labels.js";
import { loadReports, loadRegistry } from "../data/store.js";
import * as S from "../domain/signals.js";
import { bindLatestReportNav, markCurrent } from "../core/nav.js";
import { emptyState, evidenceList, renderRows } from "../render/primitives.js";

function currentLens() {
  const value = new URLSearchParams(location.search).get("lens") || "";
  return L.LENS[value] ? value : "disruption";
}

function observationRow({ report, sig }) {
  const row = el("article", "lens-observation");

  const meta = el("div", "lens-observation__meta");
  [
    report.date,
    L.typeLabel(report.type),
    `変化: ${L.changeLabel(sig.change_status)}`,
    `方向: ${L.directionLabel(sig.direction)}`,
    `確度: ${L.confidenceLabel(sig.confidence)}`
  ].forEach((text) => meta.appendChild(el("span", null, text)));
  row.appendChild(meta);

  if (sig.signal) row.appendChild(el("p", "lens-observation__statement", sig.signal));
  if (sig.operational_implication) {
    row.appendChild(el("p", "lens-observation__statement",
      `${L.UI.sigImplication}: ${sig.operational_implication}`));
  }

  const evidence = evidenceList(sig.evidence);
  if (evidence) row.appendChild(evidence);

  const links = el("div", "lens-observation__links");
  links.appendChild(link(root() + report.path, null, "該当レポートを開く →"));
  row.appendChild(links);
  return row;
}

function render(reports, lens) {
  const title = byId("lens-history-title");
  const lead = byId("lens-history-lead");
  const box = byId("lens-history-list");
  if (!box) return;

  if (title) title.textContent = L.lensLabel(lens);

  const observations = [];
  reports.forEach((report) => {
    S.signalsOf(report)
      .filter((sig) => sig.lens === lens)
      .forEach((sig) => observations.push({ report, sig }));
  });
  observations.sort((a, b) => (a.report.date < b.report.date ? 1 : a.report.date > b.report.date ? -1 : 0));

  const ids = new Set(observations.map((o) => o.sig.id));
  if (lead) lead.textContent = `${ids.size} シグナル / ${observations.length} 観測`;

  clear(box);
  if (!observations.length) {
    box.appendChild(emptyState("この視点の構造化シグナルはまだ蓄積されていません。"));
    return;
  }

  const groups = new Map();
  observations.forEach((o) => {
    const id = o.sig.id || "unknown";
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(o);
  });

  Array.from(groups.entries())
    .sort((a, b) => b[1][0].report.date.localeCompare(a[1][0].report.date))
    .forEach(([id, list]) => {
      const section = el("section", "lens-history-group");
      const head = el("div", "lens-history-group__head");
      const heading = el("div");
      heading.appendChild(el("p", "eyebrow", id));
      heading.appendChild(el("h2", null, S.signalName(list[0].sig)));
      head.appendChild(heading);
      head.appendChild(el("span", "lens-history-group__meta", `${list.length} 観測`));
      section.appendChild(head);

      renderRows(section, list, observationRow, { limit: 5 });
      box.appendChild(section);
    });
}

export function init() {
  const lens = currentLens();
  document.title = `${L.lensLabel(lens)} — シグナル履歴 | LBI`;

  return Promise.all([loadReports(), loadRegistry()]).then(([data, registry]) => {
    S.useRegistry(registry);
    const reports = data.reports.filter((r) => !r.sample);
    render(reports, lens);
    bindLatestReportNav(data.reports);
    markCurrent();
  }).catch((err) => {
    console.error(err);
    const box = byId("lens-history-list");
    if (box) { clear(box); box.appendChild(emptyState(L.UI.loadError)); }
    throw err;
  });
}
