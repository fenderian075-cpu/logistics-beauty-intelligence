/* =========================================================================
   metrics.js — topic data points.
   -------------------------------------------------------------------------
   The current topics carry between 0 and 4 data points, and two of the seven
   carry none at all, so this module has to be good at "almost no data":

     0 points  → nothing is rendered; the section says so in words.
     1 point   → a value, its unit, its date and its source. No chart: a chart
                 of one point is decoration pretending to be analysis.
     2+ of the same metric → a hand-drawn inline SVG sparkline, plus the table.

   No charting library: the largest series in the data is four points.
   ========================================================================= */

import { el, extLink } from "../core/dom.js";
import { formatShortDate, formatNumber } from "../core/format.js";

const NS = "http://www.w3.org/2000/svg";

function groupByMetric(points) {
  const groups = new Map();
  points.forEach((p) => {
    const key = p.metric || "指標";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  });
  groups.forEach((list) => list.sort((a, b) => String(a.date).localeCompare(String(b.date))));
  return groups;
}

function sparkline(series) {
  const values = series.map((p) => Number(p.value)).filter((v) => !isNaN(v));
  if (values.length < 2) return null;

  const w = 132, h = 34, pad = 3;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const x = (i) => pad + (i * (w - pad * 2)) / (values.length - 1);
  const y = (v) => h - pad - ((v - min) / span) * (h - pad * 2);

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "sparkline");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("width", w);
  svg.setAttribute("height", h);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label",
    `${series.length}点の推移: ${values[0]} → ${values[values.length - 1]}`);

  const path = document.createElementNS(NS, "polyline");
  path.setAttribute("class", "sparkline__line");
  path.setAttribute("points", values.map((v, i) => `${x(i)},${y(v)}`).join(" "));
  svg.appendChild(path);

  values.forEach((v, i) => {
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("class", "sparkline__dot");
    dot.setAttribute("cx", x(i));
    dot.setAttribute("cy", y(v));
    dot.setAttribute("r", i === values.length - 1 ? 2.6 : 1.6);
    const title = document.createElementNS(NS, "title");
    title.textContent = `${series[i].date || ""} ${v}`;
    dot.appendChild(title);
    svg.appendChild(dot);
  });
  return svg;
}

function metricRow(name, series) {
  const latest = series[series.length - 1];
  const row = el("div", "metric-block");

  const head = el("div", "metric-block__head");
  head.appendChild(el("span", "metric-block__name", name));
  const value = el("span", "metric-block__value");
  value.appendChild(el("strong", null, latest.value == null ? "—" : formatNumber(latest.value)));
  if (latest.unit) value.appendChild(el("span", "metric-block__unit", latest.unit));
  head.appendChild(value);
  row.appendChild(head);

  const chart = sparkline(series);
  if (chart) row.appendChild(chart);

  const meta = el("p", "metric-block__meta");
  const bits = [];
  if (latest.date) bits.push(formatShortDate(latest.date));
  if (latest.period) bits.push(latest.period);
  if (series.length > 1) bits.push(`${series.length}点`);
  meta.appendChild(document.createTextNode(bits.join(" · ")));
  if (latest.source) {
    meta.appendChild(document.createTextNode(" · "));
    meta.appendChild(latest.source_url
      ? extLink(latest.source_url, latest.source)
      : document.createTextNode(latest.source));
  }
  row.appendChild(meta);

  if (latest.note) row.appendChild(el("p", "metric-block__note", latest.note));
  return row;
}

/** @returns {HTMLElement|null} null when there is nothing to show. */
export function metricList(dataPoints) {
  const points = Array.isArray(dataPoints) ? dataPoints : [];
  if (!points.length) return null;

  const wrap = el("div", "metric-list");
  groupByMetric(points).forEach((series, name) => wrap.appendChild(metricRow(name, series)));
  return wrap;
}
