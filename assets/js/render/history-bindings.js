import { metricName } from "../core/units.js";
import { seriesOf } from "./economy.js";

function normaliseLabel(value) {
  return String(value || "").replace(/（月次）|（年次）|\s+/g, "").trim();
}

export function bindHistoryTargets(bundle) {
  const byName = new Map();
  Object.values(bundle || {}).forEach((dataset) => {
    seriesOf(dataset).forEach((series) => {
      if (!series || !series.metric_id) return;
      const name = normaliseLabel(metricName(series));
      if (name && !byName.has(name)) byName.set(name, series.metric_id);
    });
  });

  document.querySelectorAll(".flow-table tbody tr").forEach((row) => {
    const label = normaliseLabel(row.querySelector("td")?.textContent);
    const metricId = byName.get(label);
    if (metricId) row.setAttribute("data-history-metric", metricId);
  });

  document.querySelectorAll(".value-row__item").forEach((item) => {
    const label = normaliseLabel(item.querySelector(".value-row__label")?.textContent);
    const metricId = byName.get(label);
    if (metricId) item.setAttribute("data-history-metric", metricId);
  });
}
