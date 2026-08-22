/* =========================================================================
   buzz.js — Google Trends monitor.
   -------------------------------------------------------------------------
   Two things the previous version hid and this one states plainly:

     1. Collector health. The live file is `collector_status: "partial"` with
        three TooManyRequests errors; a monitor that silently drops terms is
        worse than one that says which terms are missing.
     2. Base size. Observations sit at 0.4–2.0 on a relative index, so a
        "+162%" headline number is meaningless without the base. The delta and
        its base are always shown together, and the page repeats that search
        interest is not sales.
   ========================================================================= */

import { el, byId, clear } from "../core/dom.js";
import { formatPercent, formatTimestamp } from "../core/format.js";
import * as L from "../core/labels.js";
import { loadBuzz, loadReports } from "../data/store.js";
import { bindLatestReportNav, markCurrent } from "../core/nav.js";
import { emptyState, renderRows } from "../render/primitives.js";

const CATEGORY_JA = {
  brand: "ブランド", promotion: "販促", market: "市場",
  makeup: "メイク", skincare: "スキンケア", fragrance: "フレグランス"
};

function collectorCard(data) {
  const card = el("article", "buzz-card");
  card.appendChild(el("h3", null, (data.source && data.source.name) || "Google Trends"));

  const status = data.collector_status || "unknown";
  const state = el("p", "buzz-source-state",
    status === "ok" ? "取得成功"
      : status === "partial" ? "一部取得（未取得の語あり）"
        : "初回取得待ち");
  state.setAttribute("data-state", status === "ok" ? "ok" : status === "partial" ? "partial" : "down");
  card.appendChild(state);

  card.appendChild(el("p", "muted",
    (data.source && data.source.note) ||
    "Google Trendsの公開データ。指数は相対値であり検索件数ではありません。"));

  const errors = data.collector_errors || [];
  if (errors.length) {
    card.appendChild(el("p", "muted", `未取得: ${errors.length} 語`));
    const ul = el("ul", "buzz-errors");
    errors.slice(0, 6).forEach((e) => ul.appendChild(el("li", null, e.term || "—")));
    card.appendChild(ul);
  }
  return card;
}

function observationRow(obs) {
  const row = el("article", "buzz-item");

  const top = el("div", "buzz-item__top");
  top.appendChild(el("strong", null, obs.term || "—"));
  top.appendChild(el("span", "buzz-item__meta", [
    CATEGORY_JA[obs.category] || obs.category,
    obs.brand,
    obs.confidence ? `確度 ${L.confidenceLabel(obs.confidence)}` : null
  ].filter(Boolean).join(" / ")));
  row.appendChild(top);

  const delta = el("div", "buzz-item__delta", formatPercent(obs.change_pct));
  delta.setAttribute("data-tone", obs.change_pct > 0 ? "up" : obs.change_pct < 0 ? "down" : "flat");
  delta.appendChild(el("span", "buzz-item__base",
    `指数 ${obs.interest_7d} ← ${obs.interest_prev21d}（相対値）`));
  row.appendChild(delta);
  return row;
}

export function init() {
  return Promise.all([loadBuzz(), loadReports()]).then(([data, reportData]) => {
    const sources = byId("buzz-sources");
    const list = byId("buzz-list");
    const stamp = byId("buzz-stamp");

    if (sources) {
      clear(sources);
      sources.appendChild(collectorCard(data));
    }
    if (stamp) {
      stamp.textContent = data.updated_at ? `更新: ${formatTimestamp(data.updated_at)}` : "初回取得待ち";
    }

    if (list) {
      clear(list);
      const signals = Array.isArray(data.signals) ? data.signals : [];
      const observations = Array.isArray(data.observations) ? data.observations : [];
      const rows = signals.length ? signals : observations.slice().sort(
        (a, b) => (b.change_pct || 0) - (a.change_pct || 0));

      if (!rows.length) {
        list.appendChild(emptyState("観測データがまだありません。"));
      } else {
        if (!signals.length) {
          list.appendChild(el("p", "count-note",
            "シグナル化された項目はまだありません。以下は生の観測値（相対指数）です。"));
        }
        renderRows(list, rows, observationRow, { limit: 10 });
      }
    }

    bindLatestReportNav(reportData.reports);
    markCurrent();
  }).catch((err) => {
    console.error(err);
    const list = byId("buzz-list");
    if (list) { clear(list); list.appendChild(emptyState(L.UI.loadError)); }
    throw err;
  });
}
