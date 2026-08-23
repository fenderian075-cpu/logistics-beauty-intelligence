/* =========================================================================
   panel.js — page scaffolding and provenance.
   -------------------------------------------------------------------------
   Every analytical page in LBI is built from the same five slots, in the
   same order, so a reader learns the shape once:

     headline    一つの見出しシグナル。このページで最初に読むべき一文。
     indicators  構造指標を数枚（KPI）。
     visual      主説明図。ページの主張を担う1〜2枚。
     supporting  補助図・比較。
     evidence    定義・注意・出典・長期系列（ディスクロージャ）。

   It also owns provenance, which in this dataset is a correctness issue
   rather than decoration:

     OFFICIAL    公式統計そのもの
     DERIVED     LBIが公式値から計算した派生値・代理指標
     DIAGNOSTIC  LBI独自の診断指数（公的指数ではない）

   Any block showing a DERIVED or DIAGNOSTIC number must carry the badge and
   the definition note, so a proxy is never read as an official statistic.
   ========================================================================= */

import { el, link, extLink } from "../core/dom.js";

const PROVENANCE = {
  official:   { label: "OFFICIAL",   note: "公式統計" },
  derived:    { label: "DERIVED",    note: "LBIによる派生計算・代理指標" },
  diagnostic: { label: "DIAGNOSTIC", note: "LBI独自の診断指数（公的指数ではありません）" }
};

export function provenanceBadge(kind) {
  const meta = PROVENANCE[kind] || PROVENANCE.official;
  const badge = el("span", "prov", meta.label);
  badge.setAttribute("data-prov", kind || "official");
  badge.title = meta.note;
  return badge;
}

/** Page header: title, lead, and the question this page answers. */
export function pageHead({ eyebrow, title, lead, question }) {
  const head = el("header", "page-head");
  if (eyebrow) head.appendChild(el("p", "eyebrow", eyebrow));
  head.appendChild(el("h1", "page-title", title));
  if (lead) head.appendChild(el("p", "page-lead", lead));
  if (question) {
    const box = el("p", "page-question");
    box.appendChild(el("span", "page-question__label", "このページで分かること"));
    box.appendChild(document.createTextNode(question));
    head.appendChild(box);
  }
  return head;
}

/**
 * The headline signal: one sentence, one number, one direction.
 * This is the "what changed / why it matters" slot.
 */
export function headlineSignal({ label, value, unit, change, reading, provenance = "official", tone }) {
  const box = el("section", "headline-signal");
  if (tone) box.setAttribute("data-tone", tone);

  const head = el("div", "headline-signal__head");
  head.appendChild(el("span", "headline-signal__label", label));
  head.appendChild(provenanceBadge(provenance));
  box.appendChild(head);

  const row = el("div", "headline-signal__row");
  row.appendChild(el("strong", "headline-signal__value", value));
  if (unit) row.appendChild(el("span", "headline-signal__unit", unit));
  if (change) {
    const delta = el("span", "headline-signal__change", change.text);
    delta.setAttribute("data-tone", change.tone || "flat");
    row.appendChild(delta);
  }
  box.appendChild(row);

  if (reading) box.appendChild(el("p", "headline-signal__reading", reading));
  return box;
}

/** Compact structural indicator, used in rows of 3–5 under the headline. */
export function indicator({ label, value, meta, provenance = "official", href, tone }) {
  const node = href ? link(href, "indicator") : el("div", "indicator");
  if (tone) node.setAttribute("data-tone", tone);
  const head = el("div", "indicator__head");
  head.appendChild(el("span", "indicator__label", label));
  head.appendChild(provenanceBadge(provenance));
  node.appendChild(head);
  node.appendChild(el("strong", "indicator__value", value));
  if (meta) node.appendChild(el("span", "indicator__meta", meta));
  return node;
}

export function indicatorRow(items) {
  const row = el("div", "indicator-row");
  items.filter(Boolean).forEach((item) => row.appendChild(item));
  return row;
}

/**
 * A block of the page: title, why it matters, the visual, and its notes.
 * `provenance` and `caution` are what stop a proxy being read as official.
 */
export function block({ id, title, purpose, provenance, caution, figure, extra }) {
  const section = el("section", "analysis-block");
  if (id) section.id = id;

  const head = el("div", "analysis-block__head");
  const titleBox = el("div");
  const h2 = el("h2", "analysis-block__title", title);
  if (id) h2.id = `${id}-title`;
  titleBox.appendChild(h2);
  if (purpose) titleBox.appendChild(el("p", "analysis-block__purpose", purpose));
  head.appendChild(titleBox);
  if (provenance) head.appendChild(provenanceBadge(provenance));
  section.appendChild(head);
  if (id) section.setAttribute("aria-labelledby", h2.id);

  if (figure) section.appendChild(figure);
  else section.appendChild(el("p", "empty-state", "観測値を蓄積中です。値が2時点以上になると図が表示されます。"));

  if (caution) {
    const note = el("p", "definition-note");
    note.appendChild(el("span", "definition-note__label", "定義"));
    note.appendChild(document.createTextNode(caution));
    section.appendChild(note);
  }
  if (extra) section.appendChild(extra);
  return section;
}

/** Dataset notes and sources, folded away but never removed. */
export function evidence({ title = "定義・注意・出典", notes = [], sources = [], extra }) {
  const details = el("details", "evidence-block");
  details.appendChild(el("summary", "evidence-block__toggle", title));
  const body = el("div", "evidence-block__body");

  if (notes.length) {
    const list = el("ul", "evidence-block__notes");
    notes.forEach((note) => list.appendChild(el("li", null, note)));
    body.appendChild(list);
  }
  if (sources.length) {
    const list = el("ul", "evidence-block__sources");
    sources.forEach((source) => {
      const li = el("li");
      if (source && source.url) li.appendChild(extLink(source.url, source.name || source.url));
      else li.appendChild(document.createTextNode((source && source.name) || String(source)));
      list.appendChild(li);
    });
    body.appendChild(list);
  }
  if (extra) body.appendChild(extra);
  details.appendChild(body);
  return details;
}

/** Collect notes + sources from one or more datasets. */
export function datasetEvidence(datasets, { title, extra } = {}) {
  const notes = [];
  const sources = [];
  datasets.filter(Boolean).forEach((dataset) => {
    (dataset.notes || []).forEach((note) => { if (!notes.includes(note)) notes.push(note); });
    const list = dataset.sources || (dataset.source ? [dataset.source] : []);
    list.forEach((source) => {
      const key = (source && source.url) || (source && source.name) || source;
      if (!sources.some((s) => ((s && s.url) || (s && s.name) || s) === key)) sources.push(source);
    });
  });
  if (!notes.length && !sources.length && !extra) return null;
  return evidence({ title, notes, sources, extra });
}

/** Cross-page links, so a page can hand off instead of growing. */
export function seeAlso(items) {
  const box = el("nav", "see-also");
  box.setAttribute("aria-label", "関連ページ");
  box.appendChild(el("span", "see-also__label", "関連"));
  items.forEach(({ href, text }) => box.appendChild(link(href, "chip-link", text)));
  return box;
}
