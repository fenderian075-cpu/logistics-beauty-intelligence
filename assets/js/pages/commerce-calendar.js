/* =========================================================================
   commerce-calendar.js — EC予定.
   -------------------------------------------------------------------------
   The live data contains two Rakuten campaigns that cross a month boundary
   and overlap on 9/01, so the grid marks where a bar continues into the
   previous or next month instead of silently clipping it.
   ========================================================================= */

import { el, link, extLink, byId, clear, root } from "../core/dom.js";
import { localDate, dateKey, isoWeek } from "../core/format.js";
import * as L from "../core/labels.js";
import { loadCommerceCalendar, loadHolidays, loadReports } from "../data/store.js";
import { bindLatestReportNav, markCurrent } from "../core/nav.js";
import { emptyState } from "../render/primitives.js";

const ICONS = {
  Amazon: "https://www.amazon.co.jp/favicon.ico",
  Rakuten: "https://www.rakuten.co.jp/favicon.ico",
  ZOZOCOSME: "https://zozo.jp/favicon.ico",
  Qoo10: "https://www.qoo10.jp/favicon.ico",
  "@cosme": "https://www.cosme.net/favicon.ico"
};
const STATUS_JA = { scheduled: "予定", active: "実施中", ended: "終了", cancelled: "中止" };

let events = [];
let holidays = {};
const view = new Date();
view.setDate(1);

function mark(channel) {
  const wrap = el("span", "channel-mark");
  const src = ICONS[channel];
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("error", () => img.remove());
    wrap.appendChild(img);
  }
  wrap.appendChild(el("span", "channel-mark__fallback", String(channel || "?").slice(0, 2)));
  return wrap;
}

function dateRange(start, end) {
  const wrap = el("span", "date-range");
  wrap.appendChild(el("span", "date-range__start", start || "—"));
  if (end && end !== start) {
    wrap.appendChild(el("span", "date-range__arrow", "↓"));
    wrap.appendChild(el("span", "date-range__end", end));
  }
  return wrap;
}

const activeOn = (ev, d) => {
  const s = localDate(ev.start_date);
  const e = localDate(ev.end_date || ev.start_date);
  return d >= s && d <= e && ev.status !== "cancelled";
};

function eventChip(ev, day, monthStart, monthEnd) {
  const a = link(`#${ev.id || ""}`, "month-calendar__event");
  a.setAttribute("data-driver", ev.driver || "");
  a.title = `${ev.channel || ev.brand || ""} — ${ev.event || ""}（${ev.start_date}〜${ev.end_date || ev.start_date}）`;

  const start = localDate(ev.start_date);
  const end = localDate(ev.end_date || ev.start_date);
  if (start < monthStart && day.getTime() === monthStart.getTime()) a.classList.add("is-continues-before");
  if (end > monthEnd && day.getTime() === monthEnd.getTime()) a.classList.add("is-continues-after");

  a.appendChild(mark(ev.channel || ev.brand));
  a.appendChild(el("span", null, `${ev.channel || ev.brand || ""} ${ev.event || ""}`));
  return a;
}

function renderMonth() {
  const box = byId("month-calendar");
  if (!box) return;
  clear(box);

  const monthLabel = byId("cal-month");
  if (monthLabel) monthLabel.textContent = `${view.getFullYear()}年 ${view.getMonth() + 1}月`;

  ["週", "月", "火", "水", "木", "金", "土", "日"].forEach((name, i) => {
    box.appendChild(el("div",
      `month-calendar__weekday${i === 6 ? " is-sat" : i === 7 ? " is-sun" : ""}`, name));
  });

  const y = view.getFullYear(), m = view.getMonth();
  const first = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);
  const monthStart = first, monthEnd = lastDay;
  const offset = (first.getDay() + 6) % 7;
  const todayKey = dateKey(new Date());

  for (let rowStart = 1 - offset; rowStart <= lastDay.getDate(); rowStart += 7) {
    box.appendChild(el("div", "month-calendar__week",
      `W${String(isoWeek(new Date(y, m, rowStart))).padStart(2, "0")}`));

    for (let col = 0; col < 7; col++) {
      const dayNo = rowStart + col;
      if (dayNo < 1 || dayNo > lastDay.getDate()) {
        box.appendChild(el("div", "month-calendar__day is-empty"));
        continue;
      }
      const d = new Date(y, m, dayNo);
      const k = dateKey(d);
      const cell = el("div", "month-calendar__day" +
        (col === 5 ? " is-sat" : col === 6 ? " is-sun" : "") +
        (holidays[k] ? " is-holiday" : "") +
        (k === todayKey ? " is-today" : ""));

      const head = el("div", "month-calendar__date-row");
      head.appendChild(el("span", "month-calendar__date", String(dayNo)));
      if (holidays[k]) head.appendChild(el("span", "month-calendar__holiday", holidays[k]));
      cell.appendChild(head);

      events.filter((ev) => activeOn(ev, d))
        .forEach((ev) => cell.appendChild(eventChip(ev, d, monthStart, monthEnd)));

      box.appendChild(cell);
    }
  }
}

function renderList() {
  const box = byId("calendar-list");
  if (!box) return;
  clear(box);

  if (!events.length) {
    box.appendChild(emptyState("確定した公開イベントはまだありません。"));
    return;
  }

  events.slice()
    .sort((a, b) => String(a.start_date || "").localeCompare(String(b.start_date || "")))
    .forEach((ev) => {
      const row = el("article", "calendar-event");
      if (ev.id) row.id = ev.id;

      const date = el("div", "calendar-event__date");
      date.appendChild(dateRange(ev.start_date, ev.end_date));
      row.appendChild(date);

      const channel = el("div", "calendar-event__channel");
      channel.appendChild(mark(ev.channel || ev.brand));
      channel.appendChild(el("strong", null, ev.channel || ev.brand || ""));
      row.appendChild(channel);

      const main = el("div");
      main.appendChild(el("strong", null, ev.event || ""));
      if (ev.scope) main.appendChild(el("p", "muted", ev.scope));
      if (ev.expected_impact) main.appendChild(el("p", "muted", ev.expected_impact));
      if (ev.logistics_implication) main.appendChild(el("p", "muted", ev.logistics_implication));
      if (ev.source) main.appendChild(extLink(ev.source, "公式情報"));
      row.appendChild(main);

      const flags = el("div");
      if (ev.driver) {
        flags.appendChild(el("span", "calendar-event__driver", L.driverLabel(ev.driver)));
      }
      if (ev.status) {
        flags.appendChild(el("span", "calendar-event__status",
          STATUS_JA[ev.status] || ev.status));
      }
      row.appendChild(flags);
      box.appendChild(row);
    });
}

/* Brand × Channel. The full Brand × Category × Channel × Demand-driver
   matrix is Phase 2; until the pipeline accumulates channel observations this
   renders the honest empty state rather than an invented grid. The data path
   is already wired so Phase 2 only has to change the row builder. */
function renderBrandChannel(reports) {
  const tbody = byId("brand-channel-body");
  if (!tbody) return;
  clear(tbody);

  const channels = ["Amazon", "Rakuten", "ZOZOCOSME", "Qoo10", "@cosme", "Brand.com"];
  const weekly = reports.find((r) => r.type === "weekly");
  const observations = (weekly && weekly.channel_matrix_observations) || [];

  const brands = {};
  observations.forEach((obs) => {
    const brand = obs.brand_or_signal || obs.brand;
    if (!brand) return;
    brands[brand] = brands[brand] || {};
    (obs.channels || [obs.channel]).filter(Boolean).forEach((c) => {
      brands[brand][c] = [
        obs.direction && L.directionLabel(obs.direction),
        obs.demand_driver && L.driverLabel(obs.demand_driver),
        obs.confidence && L.confidenceLabel(obs.confidence)
      ].filter(Boolean).join(" / ");
    });
  });

  const names = Object.keys(brands);
  if (!names.length) {
    const tr = el("tr");
    const td = el("td", null, "チャネル別の観測データはまだ蓄積されていません。");
    td.colSpan = channels.length + 1;
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  names.forEach((brand) => {
    const tr = el("tr");
    const th = el("th", null, brand);
    th.setAttribute("scope", "row");
    tr.appendChild(th);
    channels.forEach((c) => tr.appendChild(el("td", null, brands[brand][c] || "—")));
    tbody.appendChild(tr);
  });
}

export function init() {
  return Promise.all([loadCommerceCalendar(), loadHolidays(), loadReports()])
    .then(([calendar, holidayData, reportData]) => {
      events = calendar.events || [];
      holidays = holidayData.holidays || {};

      // Open on a month that actually contains something.
      if (events.length) {
        const now = new Date();
        const hasCurrent = events.some((ev) => activeOn(ev, now));
        if (!hasCurrent) {
          const first = localDate(events[0].start_date);
          view.setFullYear(first.getFullYear(), first.getMonth(), 1);
        }
      }

      renderMonth();
      renderList();

      const prev = byId("cal-prev"), next = byId("cal-next");
      if (prev) prev.addEventListener("click", () => { view.setMonth(view.getMonth() - 1); renderMonth(); });
      if (next) next.addEventListener("click", () => { view.setMonth(view.getMonth() + 1); renderMonth(); });

      renderBrandChannel(reportData.reports);
      bindLatestReportNav(reportData.reports);
      markCurrent();
    })
    .catch((err) => {
      console.error(err);
      const box = byId("month-calendar");
      if (box) { clear(box); box.appendChild(emptyState(L.UI.loadError)); }
      throw err;
    });
}
