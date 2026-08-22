/* =========================================================================
   market-regime.js — RATE / SUPPLY / DEMAND / RELIABILITY / RISK matrix.
   -------------------------------------------------------------------------
   Fixed in v5:
     - the risk pill used to take its colour from `confidence` while showing
       the value of `risk`, so a `risk: high / confidence: medium` row was
       labelled 高 and coloured amber. Risk and confidence are now separate,
       correctly-bound columns.
     - `unknown` dimensions (intra-Asia has three of them in the current data)
       render quietly as 未確認 instead of borrowing an alarming tone.
     - reported events and observed impact are kept visually distinct, so an
       announcement never reads as a confirmed disruption (spec §10).
   ========================================================================= */

import { el } from "../core/dom.js";
import * as L from "../core/labels.js";

const DIMENSIONS = [
  ["rate", "運賃"],
  ["supply", "供給"],
  ["demand", "実需"],
  ["reliability", "定時性"]
];

function dimensionValue(value) {
  const key = typeof value === "string" ? value : (value && (value.direction || value.level || value.status));
  const v = key || "unknown";
  const span = el("span", `regime-value regime-value--${v}`);
  span.appendChild(el("span", "regime-value__arrow", L.arrow(v)));
  span.appendChild(document.createTextNode(L.directionLabel(v)));
  return span;
}

function eventLine(labelText, items) {
  if (!Array.isArray(items) || !items.length) return null;
  const p = el("p", "regime-events");
  p.appendChild(el("span", "sig-card__label", labelText));
  p.appendChild(document.createTextNode(items.join(" / ")));
  return p;
}

function scopeCell(item) {
  const td = el("td", "regime-scope");
  td.appendChild(el("strong", null, item.scope || item.id || "—"));
  if (item.japan_implication) td.appendChild(el("small", null, item.japan_implication));

  const events = item.operational_events || {};
  const reported = eventLine("報告", events.reported);
  const observed = eventLine("実影響", events.observed_impact);
  if (reported) td.appendChild(reported);
  if (observed) td.appendChild(observed);
  return td;
}

function row(item) {
  const tr = el("tr");
  tr.appendChild(scopeCell(item));

  DIMENSIONS.forEach(([key]) => {
    const td = el("td");
    td.appendChild(dimensionValue(item[key]));
    tr.appendChild(td);
  });

  const riskTd = el("td");
  const risk = item.risk || item.risk_level || "unknown";
  riskTd.appendChild(el("span", `risk-pill risk-pill--${risk}`, L.riskLabel(risk)));
  tr.appendChild(riskTd);

  const confTd = el("td");
  confTd.appendChild(el("span", "regime-conf",
    item.confidence ? L.confidenceLabel(item.confidence) : L.RISK.unknown));
  tr.appendChild(confTd);

  return tr;
}

/**
 * Build the market regime section for a weekly/monthly report.
 * @param {object} report normalised report with `market_intelligence`
 */
export function marketRegimeSection(report) {
  const items = (report && report.market_intelligence) || [];
  if (!items.length) return null;

  const section = el("section", "section market-regime");
  section.id = "market-regime";
  section.setAttribute("aria-labelledby", "market-regime-title");

  const head = el("div", "section__head");
  head.appendChild(el("h2", "section__title", "市場レジーム"));
  head.appendChild(el("p", "section__note", `${L.typeLabel(report.type)} / ${report.date}`));
  section.appendChild(head);

  const wrap = el("div", "market-regime__table-wrap");
  const table = el("table", "market-regime__table");

  const thead = el("thead");
  const hr = el("tr");
  ["対象", ...DIMENSIONS.map(([, label]) => label), "リスク", "確度"].forEach((label) => {
    const th = el("th", null, label);
    th.setAttribute("scope", "col");
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = el("tbody");
  items.forEach((item) => tbody.appendChild(row(item)));
  table.appendChild(tbody);

  wrap.appendChild(table);
  section.appendChild(wrap);
  section.appendChild(el("p", "regime-note",
    "価格・供給・実需・定時性・リスクは独立した次元です。未確認は判断材料が揃っていないことを示します。"));
  return section;
}
