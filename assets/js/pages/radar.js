/* =========================================================================
   radar.js — Operations Radar (the full critical-news view).
   ========================================================================= */

import { el, byId, clear } from "../core/dom.js";
import { formatDate } from "../core/format.js";
import * as L from "../core/labels.js";
import { loadIntel, readLastSeen, writeLastSeen, countNewSince } from "../data/intel.js";
import { bindLatestReportNav, markCurrent } from "../core/nav.js";
import { mountShell } from "../core/shell.js";
import { emptyState, renderRows } from "../render/primitives.js";
import { radarRowFull } from "../render/radar-row.js";
import { filterBar, withinRange } from "../render/filters.js";

const GROUPS = ["observed", "reported", "resolved"];
const SCOPE_LABELS = {
  global: "グローバル",
  network: "幹線・ネットワーク",
  market: "市場・需要波動",
  regional: "地域",
  shipment: "個別出荷"
};
const DIMENSION_LABELS = {
  rate: "運賃",
  supply: "供給",
  demand: "需要",
  reliability: "信頼性",
  risk: "リスク",
  mixed: "複合"
};
const MATERIALITY_LABELS = {
  structural: "構造変化",
  material: "重要",
  notable: "注目",
  routine: "通常"
};

function matches(item, state) {
  if (state.domain && item.domain !== state.domain) return false;
  if (state.status && item.status !== state.status) return false;
  if (state.importance && item.importance !== state.importance) return false;
  if (state.jp && item.japan_relevance !== state.jp) return false;
  if (state.scope && item.operational_scope !== state.scope) return false;
  if (state.dimension && item.market_dimension !== state.dimension) return false;
  if (state.materiality && item.market_materiality !== state.materiality) return false;
  if (!withinRange(item.date, state.from, state.to)) return false;
  if (state.q) {
    const hay = [item.headline, item.summary, item.observed_impact, item.japan_implication,
                 item.operational_implication, item.operational_scope, item.market_dimension,
                 item.market_materiality, item.market_change, item.time_horizon, item.confidence,
                 item.demand_driver, (item.topic_ids || []).join(" ")]
      .filter(Boolean).join(" ").toLowerCase();
    if (!state.q.toLowerCase().split(/\s+/).every((term) => hay.indexOf(term) !== -1)) return false;
  }
  return true;
}

function domainOptions(items) {
  const seen = [];
  items.forEach((i) => { if (i.domain && seen.indexOf(i.domain) === -1) seen.push(i.domain); });
  return [["", "すべて"], ...seen.map((d) => [d, L.newsDomainLabel(d)])];
}

function scopeOptions(items) {
  const order = ["network", "global", "market", "regional", "shipment"];
  const seen = new Set(items.map((i) => i.operational_scope).filter(Boolean));
  return [["", "すべて"], ...order.filter((s) => seen.has(s)).map((s) => [s, SCOPE_LABELS[s] || s])];
}

function dimensionOptions(items) {
  const order = ["risk", "reliability", "supply", "demand", "rate", "mixed"];
  const seen = new Set(items.map((i) => i.market_dimension).filter(Boolean));
  return [["", "すべて"], ...order.filter((d) => seen.has(d)).map((d) => [d, DIMENSION_LABELS[d] || d])];
}

function materialityOptions(items) {
  const order = ["structural", "material", "notable", "routine"];
  const seen = new Set(items.map((i) => i.market_materiality).filter(Boolean));
  return [["", "すべて"], ...order.filter((m) => seen.has(m)).map((m) => [m, MATERIALITY_LABELS[m] || m])];
}

function groupHead(status, count) {
  const head = el("div", "radar-group__head");
  head.setAttribute("data-status", status);
  head.appendChild(el("h2", "radar-group__title", L.UI.radarGroups[status] || status));
  head.appendChild(el("span", "radar-group__count", `${count} 件`));
  head.appendChild(el("p", "radar-group__note", L.NEWS_STATUS_NOTE[status] || ""));
  return head;
}

export function init() {
  const list = byId("radar-list");
  if (!list) return Promise.resolve();

  return loadIntel().then((intel) => {
    bindLatestReportNav(intel.reports);
    markCurrent();
    mountShell(intel);

    const items = intel.news;
    const allItems = intel.allNews || items;
    const suppressedCount = Math.max(0, allItems.length - items.length);
    const lastSeen = readLastSeen();
    const newCount = countNewSince(items, lastSeen);

    const banner = byId("radar-new");
    if (banner) {
      if (newCount) {
        banner.hidden = false;
        banner.textContent = `${L.UI.radarNewSince(newCount)}（前回 ${formatDate(lastSeen)}）`;
      } else {
        banner.hidden = true;
      }
    }
    if (items.length) writeLastSeen(items.map((i) => i.date).sort().pop());

    const controls = byId("radar-filters");
    let bar = null;
    const render = (state) => {
      const hits = items.filter((item) => matches(item, state));
      if (bar) bar.setCount(hits.length);

      clear(list);
      if (!hits.length) {
        list.appendChild(emptyState("条件に一致する項目はありません。条件を減らしてお試しください。"));
        return;
      }

      GROUPS.forEach((status) => {
        const group = hits.filter((item) => item.status === status);
        if (!group.length) return;
        const box = el("section", "radar-group");
        box.setAttribute("data-status", status);
        box.appendChild(groupHead(status, group.length));
        const rows = el("div", "radar-list");
        renderRows(rows, group, (item) => radarRowFull(item, intel), { limit: 6 });
        box.appendChild(rows);
        list.appendChild(box);
      });

      const other = hits.filter((item) => GROUPS.indexOf(item.status) === -1);
      if (other.length) {
        const box = el("section", "radar-group");
        box.appendChild(groupHead(other[0].status || "other", other.length));
        const rows = el("div", "radar-list");
        renderRows(rows, other, (item) => radarRowFull(item, intel), { limit: 6 });
        box.appendChild(rows);
        list.appendChild(box);
      }

      if (location.hash) {
        const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (target) {
          const details = target.querySelector("details");
          if (details) details.open = true;
          target.classList.add("is-targeted");
        }
      }
    };

    if (controls) {
      bar = filterBar(controls, [
        { key: "status", label: "状態", type: "select",
          options: [["", "すべて"], ...GROUPS.map((s) => [s, L.newsStatusLabel(s)])] },
        { key: "scope", label: "影響範囲", type: "select", options: scopeOptions(items) },
        { key: "dimension", label: "市場軸", type: "select", options: dimensionOptions(items) },
        { key: "materiality", label: "変化の重要度", type: "select", options: materialityOptions(items) },
        { key: "domain", label: "領域", type: "select", options: domainOptions(items) },
        { key: "importance", label: "重要度", type: "select",
          options: [["", "すべて"], ["high", "高"], ["medium", "中"], ["low", "低"]] },
        { key: "jp", label: "日本関連度", type: "select",
          options: [["", "すべて"], ["high", "高"], ["medium", "中"], ["low", "低"]] },
        { key: "from", label: "開始日", type: "date" },
        { key: "to", label: "終了日", type: "date" },
        { key: "q", label: "キーワード", type: "search", placeholder: "見出し・要約を検索" }
      ], render);
    }

    const summary = byId("radar-summary");
    if (summary) {
      const counts = GROUPS.map((s) => `${L.UI.radarGroups[s]} ${items.filter((i) => i.status === s).length}`);
      if (suppressedCount) counts.push(`通常観測 ${suppressedCount}件は履歴へ`);
      summary.textContent = counts.join(" / ");
    }

    render(bar ? bar.state() : {});
  }).catch((err) => {
    console.error(err);
    clear(list);
    list.appendChild(emptyState(L.UI.loadError));
    throw err;
  });
}
