/* =========================================================================
   market-regime.js — RATE / SUPPLY / DEMAND / RELIABILITY / RISK.
   -------------------------------------------------------------------------
   The matrix summarizes 「運賃・需給・定時性・リスク」 at a glance; the drill-down
   underneath it answers 「なぜそう言えるのか」. Both matter: five arrows with
   no route to the evidence is a decoration, and a wall of evidence with no
   matrix is unreadable (spec §12, instruction G).

   Structure per scope:
     matrix row      direction per dimension, risk, confidence
     drill-down      per-dimension evidence · reported vs observed ·
                     structural drivers · outlook · risk scenario · topics

   Fixed in v5 and kept: the risk pill used to take its colour from
   `confidence` while showing the value of `risk`. They are separate columns.
   Dimensions marked `unknown` — three of five on intra-Asia — render quietly
   as 未確認 rather than borrowing an alarming tone.
   ========================================================================= */

import { el, link, root } from "../core/dom.js";
import * as L from "../core/labels.js";

const DIMENSIONS = [
  ["rate", "運賃"],
  ["supply", "供給"],
  ["demand", "実需"],
  ["reliability", "定時性"]
];

function directionOf(value) {
  if (typeof value === "string") return value || "unknown";
  return (value && (value.direction || value.level || value.status)) || "unknown";
}

function dimensionValue(value) {
  const dir = directionOf(value);
  const span = el("span", `regime-value regime-value--${dir}`);
  span.appendChild(el("span", "regime-value__arrow", L.arrow(dir)));
  span.appendChild(document.createTextNode(L.directionLabel(dir)));
  return span;
}

function eventLines(labelText, items, variant) {
  if (!Array.isArray(items) || !items.length) return null;
  const box = el("div", `regime-events regime-events--${variant}`);
  box.appendChild(el("p", "regime-events__label", labelText));
  const ul = el("ul");
  items.forEach((text) => ul.appendChild(el("li", null, text)));
  box.appendChild(ul);
  return box;
}

/** One dimension's evidence. Empty arrays are stated, not hidden: an
    unevidenced 未確認 is a different claim from an evidenced 横ばい. */
function dimensionEvidence(key, label, value) {
  const box = el("div", "regime-dimension");
  const head = el("div", "regime-dimension__head");
  head.appendChild(el("span", "regime-dimension__name", label));
  head.appendChild(dimensionValue(value));
  box.appendChild(head);

  const evidence = (value && Array.isArray(value.evidence)) ? value.evidence : [];
  if (evidence.length) {
    const ul = el("ul", "regime-dimension__evidence");
    evidence.forEach((text) => ul.appendChild(el("li", null, text)));
    box.appendChild(ul);
  } else {
    box.appendChild(el("p", "regime-dimension__empty",
      directionOf(value) === "unknown"
        ? "判断できる公開データを確認できていません。"
        : "根拠は登録されていません。"));
  }
  return box;
}

function drillDown(item, intel) {
  const details = el("details", "regime-drill");
  const summary = el("summary", "regime-drill__toggle");
  summary.appendChild(el("span", null, `${item.scope || item.id} の根拠と含意`));
  details.appendChild(summary);

  const body = el("div", "regime-drill__body");

  const dims = el("div", "regime-dimensions");
  DIMENSIONS.forEach(([key, label]) => dims.appendChild(dimensionEvidence(key, label, item[key])));
  body.appendChild(dims);

  const events = item.operational_events || {};
  const reported = eventLines(L.UI.reportedLabel, events.reported, "reported");
  const observed = eventLines(L.UI.observedLabel, events.observed_impact, "observed");
  if (reported || observed) {
    const wrap = el("div", "regime-events-grid");
    if (reported) wrap.appendChild(reported);
    if (observed) wrap.appendChild(observed);
    body.appendChild(wrap);
  }

  const notes = el("dl", "regime-notes");
  const add = (term, text) => {
    if (!text) return;
    notes.appendChild(el("dt", null, term));
    notes.appendChild(el("dd", null, text));
  };
  add(L.UI.japanImplication, item.japan_implication);
  add(L.UI.operationalImplication, item.operational_implication);
  add("構造要因", (item.structural_drivers || []).join(" / "));
  add("30日見通し", item.outlook_30d);
  add("90日見通し", item.outlook_90d);
  add("リスクシナリオ", item.risk_scenario);
  if (notes.childNodes.length) body.appendChild(notes);

  const topics = intel ? intel.topicsForRegime(item) : [];
  if (topics.length) {
    const row = el("div", "chip-links");
    row.appendChild(el("span", "chip-links__label", L.UI.relatedTopics));
    topics.forEach((topic) => {
      row.appendChild(link(`${root()}topic.html?id=${encodeURIComponent(topic.topic_id)}`,
        "chip-link", topic.title_ja || topic.topic_id));
    });
    body.appendChild(row);
  }

  details.appendChild(body);
  return details;
}

function row(item) {
  const tr = el("tr");

  const scope = el("td", "regime-scope");
  scope.appendChild(el("strong", null, item.scope || item.id || "—"));
  if (item.japan_implication) scope.appendChild(el("small", null, item.japan_implication));
  tr.appendChild(scope);

  DIMENSIONS.forEach(([key]) => {
    const td = el("td");
    td.appendChild(dimensionValue(item[key]));
    tr.appendChild(td);
  });

  const risk = item.risk || item.risk_level || "unknown";
  const riskTd = el("td");
  riskTd.appendChild(el("span", `risk-pill risk-pill--${risk}`, L.riskLabel(risk)));
  tr.appendChild(riskTd);

  const confTd = el("td");
  confTd.appendChild(el("span", "regime-conf",
    item.confidence ? L.confidenceLabel(item.confidence) : L.RISK.unknown));
  tr.appendChild(confTd);

  return tr;
}

/**
 * @param {object} report normalised report carrying `market_intelligence`
 * @param {object} [intel] the join layer, for topic links
 */
export function marketRegimeSection(report, intel) {
  const items = (report && report.market_intelligence) || [];
  if (!items.length) return null;

  const section = el("section", "section market-regime");
  section.id = "market-regime";
  section.setAttribute("aria-labelledby", "market-regime-title");

  const head = el("div", "section__head");
  const heading = el("div");
  heading.appendChild(el("p", "eyebrow", "物流市場"));
  heading.appendChild(el("h2", "section__title", "市場局面"));
  heading.id = "market-regime-title";
  head.appendChild(heading);
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
    "運賃・供給・実需・定時性・リスクは独立した次元です。未確認は判断材料が揃っていないことを示します。"));

  const drills = el("div", "regime-drills");
  items.forEach((item) => drills.appendChild(drillDown(item, intel)));
  section.appendChild(drills);

  return section;
}
