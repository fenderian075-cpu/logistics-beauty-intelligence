/* =========================================================================
   filters.js — a filter bar whose state lives in the URL.
   -------------------------------------------------------------------------
   Analytical retrieval only works if a query is shareable: 「過去3か月 +
   定時性 + 悪化」 has to survive a copy-paste and the browser back button
   (spec §24, §39). Every filter here writes to the query string with
   history.replaceState and reads back from it on load.
   ========================================================================= */

import { el } from "../core/dom.js";
import * as L from "../core/labels.js";

/**
 * @param {HTMLElement} host        emptied and filled with the controls
 * @param {Array} fields            [{key, label, type: "select"|"search"|"date", options?: [[value,label]]}]
 * @param {(state) => void} onChange called after every change, with the state
 * @returns {{state: () => object, set: (key, value) => void, reset: () => void}}
 */
export function filterBar(host, fields, onChange) {
  const params = new URLSearchParams(location.search);
  const inputs = new Map();

  const state = () => {
    const out = {};
    inputs.forEach((input, key) => {
      const v = String(input.value || "").trim();
      if (v) out[key] = v;
    });
    return out;
  };

  const syncURL = () => {
    /* Preserve query parameters this bar does not own — the lens explorer
       keeps ?lens=… in the URL while its filters change around it. */
    const p = new URLSearchParams(location.search);
    inputs.forEach((_, key) => p.delete(key));
    Object.entries(state()).forEach(([k, v]) => p.set(k, v));
    const qs = p.toString();
    history.replaceState(null, "", qs ? `?${qs}${location.hash}` : location.pathname + location.hash);
  };

  const emit = () => { syncURL(); onChange(state()); };

  const bar = el("div", "filter-bar");
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "絞り込み");

  fields.forEach((field) => {
    const wrap = el("div", "filter-bar__field");
    const id = `filter-${field.key}`;
    const label = el("label", "filter-bar__label", field.label);
    label.setAttribute("for", id);
    wrap.appendChild(label);

    let input;
    if (field.type === "select") {
      input = el("select", "filter-bar__control");
      (field.options || []).forEach(([value, text]) => {
        input.appendChild(new Option(text, value));
      });
    } else {
      input = el("input", "filter-bar__control");
      input.type = field.type === "date" ? "date" : "search";
      if (field.placeholder) input.placeholder = field.placeholder;
    }
    input.id = id;
    input.value = params.get(field.key) || "";
    input.addEventListener(field.type === "select" ? "change" : "input", emit);

    wrap.appendChild(input);
    bar.appendChild(wrap);
    inputs.set(field.key, input);
  });

  const reset = el("button", "btn btn--quiet filter-bar__reset", L.UI.filterReset);
  reset.type = "button";
  reset.addEventListener("click", () => {
    inputs.forEach((input) => { input.value = ""; });
    emit();
  });
  bar.appendChild(reset);

  const count = el("p", "filter-bar__count");
  count.setAttribute("aria-live", "polite");
  bar.appendChild(count);

  host.appendChild(bar);

  return {
    state,
    setCount: (n) => { count.textContent = L.UI.resultCount(n); },
    set(key, value) {
      const input = inputs.get(key);
      if (input) { input.value = value; emit(); }
    }
  };
}

/** ISO date helper for the date-range filters (inclusive on both ends). */
export function withinRange(dateISO, from, to) {
  const d = String(dateISO || "");
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

/** "3か月前" style shortcut used by the archive presets. */
export function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
