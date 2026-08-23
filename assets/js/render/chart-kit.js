/* =========================================================================
   chart-kit.js — the chart vocabulary of LBI.
   -------------------------------------------------------------------------
   One module owns every chart type, so a page module never draws SVG itself
   and the same data shape always looks the same across pages.

   Choosing a type is a semantic decision, not a styling one, so each export
   documents what it is FOR:

     indexedLine   two quantities in different units, compared as growth
                   from a common base year. Replaces dual-axis charts, which
                   let the author decide the conclusion by choosing scales.
     shareStack    composition over time (100% stacked). For "what is this
                   made of", never for levels.
     smallMultiples one small panel per cohort, shared y-scale. For 5+ series
                   that would be spaghetti on one axis.
     slope         two points in time, many categories. For "which cohorts
                   moved, and in which direction".
     dumbbell      two comparable values per row (A vs B). For gaps.
     contribution  signed bars against a baseline. For "what pushed the
                   composite up".
     rangeBand     a central line with a min–max band. For sensitivity.

   Shared rules, enforced here rather than trusted to the caller:
     · a line needs ≥2 observations, otherwise the caller gets null;
     · one unit per axis;
     · every figure carries unit, period, legend when needed, aria-label and
       a numeric table so the chart is never the only route to the values;
     · nothing is interpolated or extrapolated.
   ========================================================================= */

import { el } from "../core/dom.js";
import { formatPeriod, formatPct } from "../core/units.js";

export { chart, sparkline } from "./chart.js";

const NS = "http://www.w3.org/2000/svg";
export const PALETTE = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)",
                        "var(--series-5)", "var(--series-6)"];

export const svgEl = (name, attrs = {}) => {
  const node = document.createElementNS(NS, name);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
};

const num = (v, digits = 1) =>
  Number(v).toLocaleString("ja-JP", { maximumFractionDigits: digits });

function frame(spec, w, h) {
  const figure = el("figure", "chart");
  if (spec.title) figure.appendChild(el("figcaption", "chart__title", spec.title));
  const svg = svgEl("svg", {
    class: "chart__svg", viewBox: `0 0 ${w} ${h}`,
    preserveAspectRatio: "xMidYMid meet", role: "img", "aria-label": spec.ariaLabel || spec.title || "図"
  });
  figure.appendChild(svg);
  return { figure, svg };
}

function caption(figure, text) {
  if (text) figure.appendChild(el("figcaption", "chart__caption", text));
  return figure;
}

function legend(figure, entries) {
  if (entries.length < 2) return figure;
  const box = el("div", "chart__legend");
  entries.forEach(([name, colour]) => {
    const item = el("span", "chart__legend-item");
    const swatch = el("span", "chart__swatch");
    swatch.style.background = colour;
    item.appendChild(swatch);
    item.appendChild(document.createTextNode(name));
    box.appendChild(item);
  });
  figure.appendChild(box);
  return figure;
}

/** Numeric fallback table. Every chart gets one. */
export function valueTable(rows, headers) {
  const details = el("details", "chart-data");
  details.appendChild(el("summary", "chart-data__toggle", "数値を表示"));
  const table = el("table", "chart-data__table");
  const thead = el("thead");
  const hr = el("tr");
  headers.forEach((label) => {
    const th = el("th", null, label);
    th.setAttribute("scope", "col");
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);
  const tbody = el("tbody");
  rows.forEach((row) => {
    const tr = el("tr");
    row.forEach((cell, i) => {
      const node = el(i === 0 ? "th" : "td", i === 0 ? null : "num", String(cell));
      if (i === 0) node.setAttribute("scope", "row");
      tr.appendChild(node);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  details.appendChild(table);
  return details;
}

/* ---- indexed line ----------------------------------------------------------- */

/**
 * Compare quantities with different units as growth from a base period.
 * @param {{series: Array<{name, points: Array<{period, value, display?}>}>,
 *          base?: string, note?: string, title?: string, height?: number}} spec
 */
export function indexedLine(spec) {
  const prepared = (spec.series || [])
    .map((s) => {
      const points = (s.points || [])
        .filter((p) => Number.isFinite(Number(p.value)))
        .sort((a, b) => String(a.period).localeCompare(String(b.period)));
      if (points.length < 2) return null;
      const basePoint = spec.base ? points.find((p) => p.period === spec.base) : points[0];
      if (!basePoint || !Number(basePoint.value)) return null;
      return {
        name: s.name,
        base: basePoint.period,
        points: points.map((p) => ({
          period: p.period,
          value: (Number(p.value) / Number(basePoint.value)) * 100,
          raw: p.display || num(p.value)
        }))
      };
    })
    .filter(Boolean);

  if (prepared.length < 1) return null;

  const w = 660, h = spec.height || 250;
  const pad = { top: 18, right: 18, bottom: 32, left: 52 };
  const periods = [...new Set(prepared.flatMap((s) => s.points.map((p) => p.period)))].sort();
  const values = prepared.flatMap((s) => s.points.map((p) => p.value)).concat(100);
  const lo = Math.min(...values) * 0.96, hi = Math.max(...values) * 1.04;
  const x = (period) => pad.left + (periods.indexOf(period) * (w - pad.left - pad.right)) / Math.max(periods.length - 1, 1);
  const y = (v) => pad.top + (h - pad.top - pad.bottom) * (1 - (v - lo) / (hi - lo || 1));

  const baseLabel = prepared[0].base;
  const { figure, svg } = frame({
    ...spec,
    ariaLabel: `${prepared.map((s) => s.name).join(" と ")} の指数比較。${formatPeriod(baseLabel)}=100。`
  }, w, h);

  // base line at 100 — the reference the whole chart is about
  svg.appendChild(svgEl("line", {
    class: "chart__baseline", x1: pad.left, x2: w - pad.right, y1: y(100), y2: y(100)
  }));
  const baseTag = svgEl("text", { class: "chart__tick", x: pad.left - 8, y: y(100) + 3, "text-anchor": "end" });
  baseTag.textContent = "100";
  svg.appendChild(baseTag);

  [lo, hi].forEach((v) => {
    const tick = svgEl("text", { class: "chart__tick", x: pad.left - 8, y: y(v) + 3, "text-anchor": "end" });
    tick.textContent = num(v, 0);
    svg.appendChild(tick);
  });

  [periods[0], periods[periods.length - 1]].forEach((period, i) => {
    const tick = svgEl("text", {
      class: "chart__tick", x: x(period), y: h - 10, "text-anchor": i ? "end" : "start"
    });
    tick.textContent = formatPeriod(period);
    svg.appendChild(tick);
  });

  prepared.forEach((s, index) => {
    const colour = PALETTE[index % PALETTE.length];
    svg.appendChild(svgEl("polyline", {
      class: "chart__line", stroke: colour,
      points: s.points.map((p) => `${x(p.period)},${y(p.value)}`).join(" ")
    }));
    s.points.forEach((p) => {
      const dot = svgEl("circle", { class: "chart__dot", fill: colour, cx: x(p.period), cy: y(p.value), r: 2 });
      const title = svgEl("title");
      title.textContent = `${formatPeriod(p.period)} ${s.name} 指数 ${num(p.value)}（実数 ${p.raw}）`;
      dot.appendChild(title);
      svg.appendChild(dot);
    });
    const last = s.points[s.points.length - 1];
    const tag = svgEl("text", { class: "chart__latest", x: x(last.period) - 4, y: y(last.value) - 8, "text-anchor": "end" });
    tag.textContent = num(last.value, 0);
    svg.appendChild(tag);
  });

  legend(figure, prepared.map((s, i) => [s.name, PALETTE[i % PALETTE.length]]));
  caption(figure, `${formatPeriod(baseLabel)}=100 の指数比較${spec.note ? ` · ${spec.note}` : ""}`);
  figure.appendChild(valueTable(
    periods.map((period) => [formatPeriod(period),
      ...prepared.map((s) => {
        const point = s.points.find((p) => p.period === period);
        return point ? `${num(point.value)}（${point.raw}）` : "—";
      })]),
    ["期間", ...prepared.map((s) => `${s.name} 指数`)]
  ));
  return figure;
}

/* ---- 100% stacked composition ------------------------------------------------ */

/**
 * @param {{categories: Array<{name, points: Array<{period, value}>}>,
 *          note?: string, title?: string, highlight?: string}} spec
 */
export function shareStack(spec) {
  const categories = (spec.categories || []).filter((c) => (c.points || []).length);
  if (!categories.length) return null;

  const periods = [...new Set(categories.flatMap((c) => c.points.map((p) => p.period)))].sort();
  if (!periods.length) return null;

  const totals = new Map(periods.map((period) => [
    period,
    categories.reduce((sum, c) => {
      const point = c.points.find((p) => p.period === period);
      return sum + (point && Number.isFinite(Number(point.value)) ? Number(point.value) : 0);
    }, 0)
  ]));

  const w = 660, h = spec.height || 260;
  const pad = { top: 16, right: 18, bottom: 34, left: 44 };
  const innerW = w - pad.left - pad.right, innerH = h - pad.top - pad.bottom;
  const slot = innerW / periods.length;
  const barW = Math.min(46, slot * 0.68);

  const { figure, svg } = frame({
    ...spec,
    ariaLabel: `${categories.map((c) => c.name).join("・")} の構成比推移。合計100%。`
  }, w, h);

  [0, 25, 50, 75, 100].forEach((pctValue) => {
    const yy = pad.top + innerH * (1 - pctValue / 100);
    svg.appendChild(svgEl("line", { class: "chart__grid", x1: pad.left, x2: w - pad.right, y1: yy, y2: yy }));
    const tick = svgEl("text", { class: "chart__tick", x: pad.left - 8, y: yy + 3, "text-anchor": "end" });
    tick.textContent = `${pctValue}%`;
    svg.appendChild(tick);
  });

  periods.forEach((period, pi) => {
    const total = totals.get(period) || 0;
    let cursor = 0;
    const cx = pad.left + slot * pi + slot / 2;

    categories.forEach((c, ci) => {
      const point = c.points.find((p) => p.period === period);
      const value = point && Number.isFinite(Number(point.value)) ? Number(point.value) : 0;
      if (!total) return;
      const share = (value / total) * 100;
      const height = (share / 100) * innerH;
      const yTop = pad.top + innerH - cursor - height;

      const rect = svgEl("rect", {
        class: "chart__stack", x: cx - barW / 2, y: yTop, width: barW, height: Math.max(height, 0),
        fill: PALETTE[ci % PALETTE.length]
      });
      if (spec.highlight && c.name === spec.highlight) rect.setAttribute("data-highlight", "true");
      const title = svgEl("title");
      title.textContent = `${formatPeriod(period)} ${c.name} ${num(share)}%（${num(value)}）`;
      rect.appendChild(title);
      svg.appendChild(rect);
      cursor += height;
    });

    if (pi === 0 || pi === periods.length - 1 || periods.length <= 6) {
      const tick = svgEl("text", { class: "chart__tick", x: cx, y: h - 10, "text-anchor": "middle" });
      tick.textContent = formatPeriod(period);
      svg.appendChild(tick);
    }
  });

  legend(figure, categories.map((c, i) => [c.name, PALETTE[i % PALETTE.length]]));
  caption(figure, `構成比（合計100%）${spec.note ? ` · ${spec.note}` : ""}`);
  figure.appendChild(valueTable(
    periods.map((period) => {
      const total = totals.get(period) || 0;
      return [formatPeriod(period), ...categories.map((c) => {
        const point = c.points.find((p) => p.period === period);
        const value = point ? Number(point.value) : null;
        return value != null && total ? `${num((value / total) * 100)}%` : "—";
      })];
    }),
    ["期間", ...categories.map((c) => c.name)]
  ));
  return figure;
}

/* ---- small multiples ---------------------------------------------------------- */

/**
 * One panel per series, shared y-scale so panels are comparable.
 * @param {{series: Array<{name, points}>, unitLabel?: string, note?: string, title?: string}} spec
 */
export function smallMultiples(spec) {
  const series = (spec.series || [])
    .map((s) => ({ ...s, points: (s.points || []).filter((p) => Number.isFinite(Number(p.value)))
      .sort((a, b) => String(a.period).localeCompare(String(b.period))) }))
    .filter((s) => s.points.length >= 2);
  if (!series.length) return null;

  /* Shared scale only when the panels share a unit. Panels measured in
     different units (千トンキロ/台 と トン/人 など) must each get their own
     scale, otherwise the comparison the layout implies is meaningless. */
  const units = new Set(series.map((s) => s.unitLabel || spec.unitLabel || ""));
  const sharedScale = units.size <= 1 && !spec.perPanelScale;
  const all = series.flatMap((s) => s.points.map((p) => Number(p.value)));
  const globalLo = Math.min(...all), globalHi = Math.max(...all);
  const wrap = el("div", "small-multiples");

  series.forEach((s, index) => {
    const w = 200, h = 92, pad = { top: 16, right: 8, bottom: 16, left: 8 };
    const own = s.points.map((p) => Number(p.value));
    const lo = sharedScale ? globalLo : Math.min(...own);
    const hi = sharedScale ? globalHi : Math.max(...own);
    const periods = s.points.map((p) => p.period);
    const x = (i) => pad.left + (i * (w - pad.left - pad.right)) / Math.max(periods.length - 1, 1);
    const y = (v) => pad.top + (h - pad.top - pad.bottom) * (1 - (v - lo) / (hi - lo || 1));

    const cell = el("figure", "small-multiples__cell");
    cell.appendChild(el("figcaption", "small-multiples__label",
      s.unitLabel && !sharedScale ? `${s.name}（${s.unitLabel}）` : s.name));
    const svg = svgEl("svg", {
      class: "small-multiples__svg", viewBox: `0 0 ${w} ${h}`, role: "img",
      "aria-label": `${s.name}: ${formatPeriod(periods[0])} ${num(s.points[0].value)} → ` +
        `${formatPeriod(periods[periods.length - 1])} ${num(s.points[s.points.length - 1].value)}`
    });
    svg.appendChild(svgEl("polyline", {
      class: "chart__line", stroke: PALETTE[index % PALETTE.length],
      points: s.points.map((p, i) => `${x(i)},${y(Number(p.value))}`).join(" ")
    }));
    const last = s.points[s.points.length - 1];
    svg.appendChild(svgEl("circle", {
      class: "chart__dot chart__dot--latest", fill: PALETTE[index % PALETTE.length],
      cx: x(s.points.length - 1), cy: y(Number(last.value)), r: 3
    }));
    const tag = svgEl("text", { class: "chart__latest", x: w - pad.right, y: 12, "text-anchor": "end" });
    tag.textContent = last.display || num(last.value);
    svg.appendChild(tag);
    cell.appendChild(svg);
    wrap.appendChild(cell);
  });

  const figure = el("figure", "chart");
  if (spec.title) figure.appendChild(el("figcaption", "chart__title", spec.title));
  figure.appendChild(wrap);
  caption(figure, (sharedScale
    ? `全パネル共通スケール（${num(globalLo)}〜${num(globalHi)}${spec.unitLabel ? ` ${spec.unitLabel}` : ""}）`
    : "単位が異なるためパネルごとに独立スケール。パネル間の高さは比較できません") +
    `${spec.note ? ` · ${spec.note}` : ""}`);

  const periods = [...new Set(series.flatMap((s) => s.points.map((p) => p.period)))].sort();
  figure.appendChild(valueTable(
    periods.map((period) => [formatPeriod(period), ...series.map((s) => {
      const point = s.points.find((p) => p.period === period);
      return point ? (point.display || num(point.value)) : "—";
    })]),
    ["期間", ...series.map((s) => s.name)]
  ));
  return figure;
}

/* ---- slope ------------------------------------------------------------------- */

/**
 * Structure change between two periods across categories.
 * @param {{rows: Array<{name, from: number, to: number}>, fromLabel, toLabel,
 *          unitLabel?: string, note?: string, title?: string}} spec
 */
export function slopeChart(spec) {
  const rows = (spec.rows || []).filter((r) => Number.isFinite(Number(r.from)) && Number.isFinite(Number(r.to)));
  if (!rows.length) return null;

  const w = 660, h = Math.max(200, 34 + rows.length * 26);
  const pad = { top: 30, bottom: 20, left: 150, right: 150 };
  const values = rows.flatMap((r) => [Number(r.from), Number(r.to)]);
  const lo = Math.min(...values), hi = Math.max(...values);
  const y = (v) => pad.top + (h - pad.top - pad.bottom) * (1 - (v - lo) / (hi - lo || 1));
  const xFrom = pad.left, xTo = w - pad.right;

  const { figure, svg } = frame({
    ...spec,
    ariaLabel: `${spec.fromLabel} から ${spec.toLabel} への変化。${rows.map((r) => `${r.name} ${num(r.from)}→${num(r.to)}`).join("、")}`
  }, w, h);

  [[xFrom, spec.fromLabel, "end"], [xTo, spec.toLabel, "start"]].forEach(([x, label, anchor]) => {
    svg.appendChild(svgEl("line", { class: "chart__grid", x1: x, x2: x, y1: pad.top - 8, y2: h - pad.bottom }));
    const tick = svgEl("text", { class: "chart__axis-label", x, y: pad.top - 14, "text-anchor": "middle" });
    tick.textContent = label;
    svg.appendChild(tick);
  });

  rows.forEach((row, index) => {
    const colour = PALETTE[index % PALETTE.length];
    const y1 = y(Number(row.from)), y2 = y(Number(row.to));
    const rising = Number(row.to) > Number(row.from);

    const line = svgEl("line", { class: "slope__line", stroke: colour, x1: xFrom, x2: xTo, y1, y2 });
    line.setAttribute("data-direction", rising ? "up" : "down");
    const title = svgEl("title");
    title.textContent = `${row.name}: ${num(row.from)} → ${num(row.to)}（${formatPct(((Number(row.to) - Number(row.from)) / Math.abs(Number(row.from) || 1)) * 100)}）`;
    line.appendChild(title);
    svg.appendChild(line);

    svg.appendChild(svgEl("circle", { class: "slope__dot", fill: colour, cx: xFrom, cy: y1, r: 3 }));
    svg.appendChild(svgEl("circle", { class: "slope__dot", fill: colour, cx: xTo, cy: y2, r: 3 }));

    const left = svgEl("text", { class: "slope__label", x: xFrom - 10, y: y1 + 3, "text-anchor": "end" });
    left.textContent = `${row.name} ${num(row.from)}`;
    svg.appendChild(left);
    const right = svgEl("text", { class: "slope__label", x: xTo + 10, y: y2 + 3, "text-anchor": "start" });
    right.textContent = num(row.to);
    svg.appendChild(right);
  });

  caption(figure, `${spec.fromLabel} → ${spec.toLabel}${spec.unitLabel ? ` · 単位 ${spec.unitLabel}` : ""}` +
    `${spec.note ? ` · ${spec.note}` : ""}`);
  figure.appendChild(valueTable(
    rows.map((r) => [r.name, num(r.from), num(r.to),
      formatPct(((Number(r.to) - Number(r.from)) / Math.abs(Number(r.from) || 1)) * 100)]),
    ["区分", spec.fromLabel, spec.toLabel, "変化率"]
  ));
  return figure;
}

/* ---- dumbbell ----------------------------------------------------------------- */

/**
 * Gap between two comparable values per row.
 * @param {{rows: Array<{name, a: number, b: number, aLabel?: string, bLabel?: string, gapText?: string}>,
 *          aName: string, bName: string, unitLabel?: string, note?: string, title?: string}} spec
 */
export function dumbbellChart(spec) {
  const rows = (spec.rows || []).filter((r) => Number.isFinite(Number(r.a)) && Number.isFinite(Number(r.b)));
  if (!rows.length) return null;

  const w = 660, rowH = 34;
  const h = 34 + rows.length * rowH;
  const pad = { top: 24, left: 190, right: 70, bottom: 10 };
  const values = rows.flatMap((r) => [Number(r.a), Number(r.b)]);
  const lo = Math.min(...values) * 0.94, hi = Math.max(...values) * 1.06;
  const x = (v) => pad.left + ((v - lo) / (hi - lo || 1)) * (w - pad.left - pad.right);

  const { figure, svg } = frame({
    ...spec,
    ariaLabel: rows.map((r) => `${r.name}: ${spec.aName} ${num(r.a)}、${spec.bName} ${num(r.b)}`).join("。")
  }, w, h);

  rows.forEach((row, index) => {
    const y = pad.top + index * rowH + rowH / 2;
    const xa = x(Number(row.a)), xb = x(Number(row.b));

    svg.appendChild(svgEl("line", { class: "dumbbell__track", x1: Math.min(xa, xb), x2: Math.max(xa, xb), y1: y, y2: y }));
    svg.appendChild(svgEl("circle", { class: "dumbbell__dot dumbbell__dot--a", cx: xa, cy: y, r: 5 }));
    svg.appendChild(svgEl("circle", { class: "dumbbell__dot dumbbell__dot--b", cx: xb, cy: y, r: 5 }));

    const label = svgEl("text", { class: "dumbbell__label", x: pad.left - 12, y: y + 4, "text-anchor": "end" });
    label.textContent = row.name;
    svg.appendChild(label);

    const gap = svgEl("text", { class: "dumbbell__gap", x: w - pad.right + 8, y: y + 4 });
    gap.textContent = row.gapText || num(Number(row.b) - Number(row.a));
    svg.appendChild(gap);

    const title = svgEl("title");
    title.textContent = `${row.name}: ${spec.aName} ${num(row.a)} / ${spec.bName} ${num(row.b)}`;
    svg.appendChild(title);
  });

  legend(figure, [[spec.aName, "var(--series-3)"], [spec.bName, "var(--series-1)"]]);
  caption(figure, `差分は右端に表示${spec.unitLabel ? ` · 単位 ${spec.unitLabel}` : ""}${spec.note ? ` · ${spec.note}` : ""}`);
  figure.appendChild(valueTable(
    rows.map((r) => [r.name, num(r.a), num(r.b), r.gapText || num(Number(r.b) - Number(r.a))]),
    ["区分", spec.aName, spec.bName, "差"]
  ));
  return figure;
}

/* ---- contribution -------------------------------------------------------------- */

/**
 * Signed bars against a baseline — "what pushed the composite away from 100".
 * @param {{rows: Array<{name, value: number}>, baseline?: number, unitLabel?: string,
 *          note?: string, title?: string}} spec
 */
export function contributionChart(spec) {
  const baseline = spec.baseline == null ? 100 : spec.baseline;
  const rows = (spec.rows || []).filter((r) => Number.isFinite(Number(r.value)));
  if (!rows.length) return null;

  const w = 660, rowH = 30, h = 26 + rows.length * rowH;
  const pad = { top: 18, left: 210, right: 74, bottom: 8 };
  const deltas = rows.map((r) => Number(r.value) - baseline);
  const span = Math.max(...deltas.map((d) => Math.abs(d)), 1) * 1.15;
  const mid = pad.left + (w - pad.left - pad.right) / 2;
  const x = (delta) => mid + (delta / span) * ((w - pad.left - pad.right) / 2);

  const { figure, svg } = frame({
    ...spec,
    ariaLabel: rows.map((r) => `${r.name} ${num(r.value)}（基準${baseline}との差 ${num(Number(r.value) - baseline)}）`).join("。")
  }, w, h);

  svg.appendChild(svgEl("line", { class: "chart__baseline", x1: mid, x2: mid, y1: pad.top - 6, y2: h - pad.bottom }));

  rows.forEach((row, index) => {
    const delta = Number(row.value) - baseline;
    const y = pad.top + index * rowH;
    const barX = delta >= 0 ? mid : x(delta);
    const rect = svgEl("rect", {
      class: "contribution__bar", x: barX, y: y + 5, width: Math.max(Math.abs(x(delta) - mid), 1), height: rowH - 14
    });
    rect.setAttribute("data-direction", delta >= 0 ? "up" : "down");
    const title = svgEl("title");
    title.textContent = `${row.name}: ${num(row.value)}（基準 ${baseline} との差 ${delta >= 0 ? "+" : ""}${num(delta)}）`;
    rect.appendChild(title);
    svg.appendChild(rect);

    const label = svgEl("text", { class: "dumbbell__label", x: pad.left - 12, y: y + rowH / 2 + 2, "text-anchor": "end" });
    label.textContent = row.name;
    svg.appendChild(label);

    const value = svgEl("text", { class: "dumbbell__gap", x: w - pad.right + 8, y: y + rowH / 2 + 2 });
    value.textContent = num(row.value);
    svg.appendChild(value);
  });

  caption(figure, `基準 ${baseline} からの差${spec.unitLabel ? `（${spec.unitLabel}）` : ""}${spec.note ? ` · ${spec.note}` : ""}`);
  figure.appendChild(valueTable(
    rows.map((r) => [r.name, num(r.value), `${Number(r.value) - baseline >= 0 ? "+" : ""}${num(Number(r.value) - baseline)}`]),
    ["要素", "水準", `基準${baseline}との差`]
  ));
  return figure;
}

/* ---- range band ----------------------------------------------------------------- */

/**
 * A central series with a min–max band, for sensitivity analysis.
 * @param {{center: {name, points}, bands: Array<{name, points}>, unitLabel?: string,
 *          note?: string, title?: string}} spec
 */
export function rangeBand(spec) {
  const center = spec.center && (spec.center.points || [])
    .filter((p) => Number.isFinite(Number(p.value)))
    .sort((a, b) => String(a.period).localeCompare(String(b.period)));
  if (!center || center.length < 2) return null;

  const variants = (spec.bands || []).map((b) => ({
    name: b.name,
    points: (b.points || []).filter((p) => Number.isFinite(Number(p.value)))
  })).filter((b) => b.points.length >= 2);

  const periods = center.map((p) => p.period);
  const bandFor = (period) => {
    const values = variants
      .map((v) => v.points.find((p) => p.period === period))
      .filter(Boolean)
      .map((p) => Number(p.value));
    return values.length ? { min: Math.min(...values), max: Math.max(...values) } : null;
  };

  const w = 660, h = spec.height || 250;
  const pad = { top: 18, right: 18, bottom: 30, left: 52 };
  const all = center.map((p) => Number(p.value))
    .concat(variants.flatMap((v) => v.points.map((p) => Number(p.value))));
  const lo = Math.min(...all) * 0.98, hi = Math.max(...all) * 1.02;
  const x = (period) => pad.left + (periods.indexOf(period) * (w - pad.left - pad.right)) / Math.max(periods.length - 1, 1);
  const y = (v) => pad.top + (h - pad.top - pad.bottom) * (1 - (v - lo) / (hi - lo || 1));

  const { figure, svg } = frame({
    ...spec,
    ariaLabel: `${spec.center.name} の推移と、要素を1つ除いた場合の範囲。`
  }, w, h);

  const upper = [], lower = [];
  periods.forEach((period) => {
    const band = bandFor(period);
    if (!band) return;
    upper.push(`${x(period)},${y(band.max)}`);
    lower.unshift(`${x(period)},${y(band.min)}`);
  });
  if (upper.length) {
    svg.appendChild(svgEl("polygon", { class: "range-band__area", points: [...upper, ...lower].join(" ") }));
  }

  svg.appendChild(svgEl("polyline", {
    class: "chart__line range-band__center", stroke: "var(--series-1)",
    points: center.map((p) => `${x(p.period)},${y(Number(p.value))}`).join(" ")
  }));
  center.forEach((p) => {
    const dot = svgEl("circle", { class: "chart__dot", fill: "var(--series-1)", cx: x(p.period), cy: y(Number(p.value)), r: 2.4 });
    const band = bandFor(p.period);
    const title = svgEl("title");
    title.textContent = `${formatPeriod(p.period)} ${num(p.value)}` +
      (band ? `（感度範囲 ${num(band.min)}〜${num(band.max)}）` : "");
    dot.appendChild(title);
    svg.appendChild(dot);
  });

  [lo, hi].forEach((v) => {
    const tick = svgEl("text", { class: "chart__tick", x: pad.left - 8, y: y(v) + 3, "text-anchor": "end" });
    tick.textContent = num(v, 0);
    svg.appendChild(tick);
  });
  [periods[0], periods[periods.length - 1]].forEach((period, i) => {
    const tick = svgEl("text", { class: "chart__tick", x: x(period), y: h - 10, "text-anchor": i ? "end" : "start" });
    tick.textContent = formatPeriod(period);
    svg.appendChild(tick);
  });

  caption(figure, `太線は総合指数、帯は各要素を1つ除いた場合の範囲${spec.note ? ` · ${spec.note}` : ""}`);
  figure.appendChild(valueTable(
    periods.map((period) => {
      const band = bandFor(period);
      const point = center.find((p) => p.period === period);
      return [formatPeriod(period), point ? num(point.value) : "—",
        band ? `${num(band.min)} 〜 ${num(band.max)}` : "—"];
    }),
    ["期間", "総合指数", "感度範囲"]
  ));
  return figure;
}
