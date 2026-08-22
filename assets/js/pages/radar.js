/* =========================================================================
   radar.js — Operations Radar (the full critical-news view).
   -------------------------------------------------------------------------
   The dashboard shows the top of this list; here it is complete and
   filterable. Two decisions worth stating:

   1. Ordering is by state, not by clock. Active observed impact outranks a
      high-relevance reported risk, which outranks everything else
      (instruction D). A reverse-chronological feed would bury a confirmed
      disruption under a newer announcement — exactly the failure mode the
      Radar exists to prevent.

   2. NEW is a summary line, not a badge on every row. The hourly Radar would
      otherwise decorate the whole page permanently, which is alert fatigue by
      construction (spec §8). "Last seen" is a localStorage timestamp; there
      is no account and nothing leaves the browser.
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

function matches(item, state) {
  if (state.domain && item.domain !== state.domain) return false;
  if (state.status && item.status !== state.status) return false;
  if (state.importance && item.importance !== state.importance) return false;
  if (state.jp && item.japan_relevance !== state.jp) return false;
  if (!withinRange(item.date, state.from, state.to)) return false;
  if (state.q) {
    const hay = [item.headline, item.summary, item.observed_impact, item.japan_implication,
                 item.operational_implication, (item.topic_ids || []).join(" ")]
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

      /* Grouped by state so the reading order is state-first even when a
         filter is active; each group is capped and expandable so a busy day
         (20 items) stays a page you can scan. */
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

      /* Anything with an unrecognised status still has to appear: the pipeline
         may add states before the frontend knows about them. */
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
