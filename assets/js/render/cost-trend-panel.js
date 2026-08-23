import { el, byId } from "../core/dom.js";
import { loadOptionalJSON } from "../data/store.js";

const latest = (s) => (s?.observations?.length ? s.observations[s.observations.length - 1] : null);
const find = (d, id) => (d?.series || []).find((s) => s.metric_id === id);
const fmt = (n, digits = 1) => Number(n).toLocaleString("ja-JP", { maximumFractionDigits: digits });

// BOJ monthly reference exchange rates used only for display conversion.
// The source USD value remains canonical in ocean-freight-market.json.
const BOJ_USDJPY_MONTHLY = new Map([
  ["2026-07", 158],
  ["2026-08", 161]
]);

function yenRate(obs) {
  if (Number.isFinite(Number(obs?.jpy_per_usd))) return Number(obs.jpy_per_usd);
  return BOJ_USDJPY_MONTHLY.get(String(obs?.period || "").slice(0, 7)) || null;
}

function oceanYen(obs) {
  const rate = yenRate(obs);
  return rate && Number.isFinite(Number(obs?.value)) ? Math.round(Number(obs.value) * rate) : null;
}

function displaySeries(series, mode) {
  if (mode !== "ocean-jpy") return series;
  return {
    ...series,
    unit: "円/40フィートコンテナ",
    observations: (series.observations || []).map((o) => {
      const value = oceanYen(o);
      return value == null ? null : { ...o, value, source_value_usd: o.value, jpy_per_usd: yenRate(o) };
    }).filter(Boolean)
  };
}

function lineChart(seriesList, unit) {
  const width = 760, height = 260, pad = { l: 72, r: 20, t: 20, b: 42 };
  const points = seriesList.flatMap((s) => (s.observations || []).map((o) => ({ ...o, sid: s.metric_id })));
  if (points.length < 2) return el("p", "empty-state", "時系列観測値を蓄積中です。");
  const dates = [...new Set(points.map((p) => p.period))].sort();
  const values = points.map((p) => Number(p.value)).filter(Number.isFinite);
  const min = Math.min(...values), max = Math.max(...values), span = Math.max(max - min, 1);
  const x = (period) => pad.l + (dates.indexOf(period) / Math.max(dates.length - 1, 1)) * (width - pad.l - pad.r);
  const y = (value) => pad.t + (1 - (Number(value) - min) / span) * (height - pad.t - pad.b);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`); svg.setAttribute("class", "trend-chart"); svg.setAttribute("role", "img");
  [0, .25, .5, .75, 1].forEach((r) => {
    const gy = pad.t + r * (height - pad.t - pad.b), val = max - r * span;
    const line = document.createElementNS(svg.namespaceURI, "line"); line.setAttribute("x1", pad.l); line.setAttribute("x2", width-pad.r); line.setAttribute("y1", gy); line.setAttribute("y2", gy); line.setAttribute("class", "trend-chart__grid"); svg.appendChild(line);
    const text = document.createElementNS(svg.namespaceURI, "text"); text.setAttribute("x", pad.l-8); text.setAttribute("y", gy+4); text.setAttribute("text-anchor", "end"); text.setAttribute("class", "trend-chart__axis"); text.textContent = fmt(val, 0); svg.appendChild(text);
  });
  seriesList.forEach((s, idx) => {
    if (!(s.observations || []).length) return;
    const poly = document.createElementNS(svg.namespaceURI, "polyline");
    poly.setAttribute("points", s.observations.map((o) => `${x(o.period)},${y(o.value)}`).join(" "));
    poly.setAttribute("class", `trend-chart__line trend-chart__line--${idx+1}`); svg.appendChild(poly);
    s.observations.forEach((o) => {
      const c = document.createElementNS(svg.namespaceURI, "circle"); c.setAttribute("cx", x(o.period)); c.setAttribute("cy", y(o.value)); c.setAttribute("r", 3.5); c.setAttribute("class", `trend-chart__point trend-chart__point--${idx+1}`);
      const t = document.createElementNS(svg.namespaceURI, "title");
      t.textContent = `${s.name_ja}: ${o.period} ${fmt(o.value, 0)} ${unit}${o.source_value_usd != null ? `（原値 $${fmt(o.source_value_usd, 0)}、換算 ${o.jpy_per_usd}円/ドル）` : ""}`;
      c.appendChild(t); svg.appendChild(c);
    });
  });
  const left = document.createElementNS(svg.namespaceURI, "text"); left.setAttribute("x", pad.l); left.setAttribute("y", height-12); left.setAttribute("class", "trend-chart__axis"); left.textContent = dates[0]; svg.appendChild(left);
  const right = document.createElementNS(svg.namespaceURI, "text"); right.setAttribute("x", width-pad.r); right.setAttribute("y", height-12); right.setAttribute("text-anchor", "end"); right.setAttribute("class", "trend-chart__axis"); right.textContent = dates[dates.length-1]; svg.appendChild(right);
  return svg;
}

function sectionFor(data, ids, title, note, mode = "native") {
  const section = el("section", "flow-dataset cost-trend-panel");
  const head = el("div", "section__head"), titleBox = el("div"); titleBox.appendChild(el("p", "eyebrow", "時系列")); titleBox.appendChild(el("h2", "section__title", title)); titleBox.appendChild(el("p", "regime-note", note)); head.appendChild(titleBox); section.appendChild(head);
  const canonical = ids.map((id) => find(data, id)).filter(Boolean);
  const selected = canonical.map((s) => displaySeries(s, mode));
  const cards = el("div", "economy-grid");
  selected.forEach((s, idx) => {
    const o = latest(s), raw = latest(canonical[idx]), card = el("article", "economy-card economy-card--static");
    card.appendChild(el("p", "eyebrow", s.name_ja));
    card.appendChild(el("strong", "economy-card__headline", o ? `${fmt(o.value, mode === "ocean-jpy" ? 0 : 1)} ${s.unit}` : "未確認"));
    const detail = o ? `${o.period}${o.wow_pct != null ? ` / 前週比 ${o.wow_pct > 0 ? "+" : ""}${o.wow_pct}%` : ""}${mode === "ocean-jpy" && raw ? ` / 原値 $${fmt(raw.value, 0)} / 換算 ${o.jpy_per_usd}円/ドル` : ""}` : "観測値を蓄積中";
    card.appendChild(el("p", "economy-card__detail", detail)); cards.appendChild(card);
  });
  section.appendChild(cards);
  section.appendChild(lineChart(selected, selected[0]?.unit || ""));
  const legend = el("div", "trend-legend"); selected.forEach((s, i) => legend.appendChild(el("span", `trend-legend__item trend-legend__item--${i+1}`, s.name_ja))); section.appendChild(legend);
  const source = data.source || (data.sources || [])[0]; if (source?.url) { const p = el("p", "source-note", "出典: "), a = el("a", null, source.name); a.href = source.url; a.target = "_blank"; a.rel = "noopener noreferrer"; p.appendChild(a); section.appendChild(p); }
  if (mode === "ocean-jpy") section.appendChild(el("p", "source-note", "円換算: 日本銀行の月次基準外国為替相場を使用。2026年7月 158円/ドル、8月 161円/ドル。DrewryのUSD原値は保持しています。"));
  return section;
}

export async function mountCostTrendPanel() {
  const host = byId("flow-datasets"); if (!host) return;
  const [fuel, ocean] = await Promise.all([
    loadOptionalJSON("data/economy/fuel-prices.json", {}),
    loadOptionalJSON("data/economy/ocean-freight-market.json", {})
  ]);
  if (fuel.dataset) host.prepend(sectionFor(fuel, ["regular_gasoline_national", "diesel_national"], "日本の燃料価格", "国内配送コストの実勢確認として、全国平均のレギュラーガソリンと軽油を週次で追います。"));
  if (ocean.dataset) host.prepend(sectionFor(ocean, ["drewry_wci", "drewry_iaci"], "海上コンテナ運賃の推移", "日本円換算を主表示します。運賃は価格指標であり、船腹・需要・定時性とは分けて判断します。", "ocean-jpy"));
}
