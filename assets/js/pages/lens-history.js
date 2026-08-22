/* =========================================================================
   lens-history.js — one lens, across every topic and every report.
   -------------------------------------------------------------------------
   Redesigned in v6 (instruction 3). The division of labour:

     Topic Digest   one theme, in depth
     Lens Explorer  one analytical axis (障害 / コスト・キャパ / 定時性 /
                    需要・商流 / 規制・構造) across many themes
     Status History one operational domain over time

   So this page groups by signal — which is also a topic id — and offers the
   filters an analyst actually uses on an axis: change status, confidence and
   period. Each group heads straight into the digest for that topic.
   ========================================================================= */

import { el, link, byId, clear, root } from "../core/dom.js";
import { formatDate, formatShortDate } from "../core/format.js";
import * as L from "../core/labels.js";
import { loadIntel } from "../data/intel.js";
import * as S from "../domain/signals.js";
import { bindLatestReportNav, markCurrent } from "../core/nav.js";
import { emptyState, evidenceList, renderRows, badge } from "../render/primitives.js";
import { filterBar, withinRange } from "../render/filters.js";

let intel = null;
let bar = null;

function currentLens() {
  const value = new URLSearchParams(location.search).get("lens") || "";
  return L.LENS[value] ? value : "disruption";
}

function lensSwitch(current) {
  const nav = byId("lens-switch");
  if (!nav) return;
  clear(nav);
  S.LENSES.forEach((lens) => {
    const params = new URLSearchParams(location.search);
    params.set("lens", lens);
    const a = link(`?${params.toString()}`, "lens-switch__item", L.lensLabel(lens));
    const signals = intel.reports.flatMap((r) => S.signalsOf(r)).filter((s) => s.lens === lens);
    a.setAttribute("data-lens", lens);
    a.setAttribute("data-count", String(signals.length));
    if (lens === current) a.setAttribute("aria-current", "page");
    a.appendChild(el("span", "lens-switch__count", String(signals.length)));
    nav.appendChild(a);
  });
}

function observationRow({ report, sig }) {
  const row = el("article", "lens-observation");
  row.setAttribute("data-change", sig.change_status || "unchanged");

  const meta = el("div", "lens-observation__meta");
  meta.appendChild(el("span", "lens-observation__date", formatDate(report.date)));
  meta.appendChild(el("span", null, L.typeLabel(report.type)));
  meta.appendChild(badge("change", sig.change_status, L.changeLabel(sig.change_status)));
  meta.appendChild(el("span", null, `${L.arrow(sig.direction)} ${L.directionLabel(sig.direction)}`));
  meta.appendChild(el("span", null, `確度 ${L.confidenceLabel(sig.confidence)}`));
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

function group(id, observations) {
  const section = el("section", "lens-history-group");
  const head = el("div", "lens-history-group__head");

  const heading = el("div");
  const topic = intel.topic(id);
  heading.appendChild(el("p", "eyebrow", id));
  const h2 = el("h2");
  if (topic) {
    h2.appendChild(link(`${root()}topic.html?id=${encodeURIComponent(id)}`, null,
      topic.title_ja || S.signalName(observations[0].sig)));
  } else {
    h2.textContent = S.signalName(observations[0].sig);
  }
  heading.appendChild(h2);
  head.appendChild(heading);

  const meta = el("div", "lens-history-group__meta");
  meta.appendChild(el("span", null, `${observations.length} 観測`));
  const last = observations[0];
  if (last) meta.appendChild(el("span", null, `最終 ${formatShortDate(last.report.date)}`));
  if (topic) {
    meta.appendChild(link(`${root()}topic.html?id=${encodeURIComponent(id)}`, "chip-link", L.UI.viewTopic));
  }
  head.appendChild(meta);
  section.appendChild(head);

  renderRows(section, observations, observationRow, { limit: 3 });
  return section;
}

function render(state) {
  const lens = currentLens();
  const box = byId("lens-history-list");
  const lead = byId("lens-history-lead");
  const title = byId("lens-history-title");
  if (!box) return;

  if (title) title.textContent = L.lensLabel(lens);

  const observations = [];
  intel.reports.filter((r) => !r.sample).forEach((report) => {
    S.signalsOf(report)
      .filter((sig) => sig.lens === lens)
      .filter((sig) => (!state.change || sig.change_status === state.change))
      .filter((sig) => (!state.conf || sig.confidence === state.conf))
      .filter(() => withinRange(report.date, state.from, state.to))
      .forEach((sig) => observations.push({ report, sig }));
  });
  observations.sort((a, b) => (a.report.date < b.report.date ? 1 : a.report.date > b.report.date ? -1 : 0));

  const groups = new Map();
  observations.forEach((o) => {
    const id = o.sig.id || "unknown";
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(o);
  });

  if (lead) lead.textContent = `${groups.size} シグナル / ${observations.length} 観測`;
  if (bar) bar.setCount(observations.length);

  clear(box);
  if (!observations.length) {
    box.appendChild(emptyState("この条件に該当する観測はありません。"));
    return;
  }
  Array.from(groups.entries())
    .sort((a, b) => b[1][0].report.date.localeCompare(a[1][0].report.date))
    .forEach(([id, list]) => box.appendChild(group(id, list)));

  const topicHost = byId("lens-topics");
  if (topicHost) {
    clear(topicHost);
    const ids = Array.from(groups.keys()).filter((id) => intel.hasTopic(id));
    if (!ids.length) {
      topicHost.appendChild(emptyState("この視点に対応するトピックはまだありません。"));
    } else {
      ids.forEach((id) => {
        const topic = intel.topic(id);
        const a = link(`${root()}topic.html?id=${encodeURIComponent(id)}`, "topic-index-row");
        a.setAttribute("data-state", topic.current_state || "unconfirmed");
        a.appendChild(el("span", "topic-index-row__state", L.topicStateLabel(topic.current_state)));
        a.appendChild(el("span", "topic-index-row__title", topic.title_ja || id));
        topicHost.appendChild(a);
      });
    }
  }
}

export function init() {
  const box = byId("lens-history-list");
  if (!box) return Promise.resolve();

  return loadIntel().then((graph) => {
    intel = graph;
    bindLatestReportNav(intel.reports);
    markCurrent();

    const lens = currentLens();
    document.title = `${L.lensLabel(lens)} | LBI`;
    lensSwitch(lens);

    const controls = byId("lens-filters");
    if (controls) {
      bar = filterBar(controls, [
        { key: "change", label: "変化", type: "select",
          options: [["", "すべて"], ...S.CHANGE_PRIORITY.map((c) => [c, L.changeLabel(c)])] },
        { key: "conf", label: "確度", type: "select",
          options: [["", "すべて"], ["high", "高"], ["medium", "中"], ["low", "低"]] },
        { key: "from", label: "開始日", type: "date" },
        { key: "to", label: "終了日", type: "date" }
      ], render);
    }

    render(bar ? bar.state() : {});
  }).catch((err) => {
    console.error(err);
    clear(box);
    box.appendChild(emptyState(L.UI.loadError));
    throw err;
  });
}
