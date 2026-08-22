/* =========================================================================
   signals.js — structured intelligence layer (v5, ES module).
   -------------------------------------------------------------------------
   Ported from assets/js/signals.js. Same rules as before:

     Aggregation affects DISPLAY ONLY. Nothing here writes back into a report
     or a signal object; derived values are returned as new objects.

   Changes in v5: no dependency on translation.js, no DOM rendering (that now
   lives in render/), and the registry is supplied by data/store.js so the
   file is fetched once per page.
   ========================================================================= */

export const LENSES = ["disruption", "cost_capacity", "reliability", "demand_commerce", "regulatory_structural"];
export const CHANGE_PRIORITY = ["deteriorating", "new", "improving", "resolved", "unchanged_high_risk"];
export const CHANGE_SUMMARY_KEYS = ["new", "deteriorating", "improving", "resolved", "unchanged_high_risk"];

const CHANGE_WEIGHT = {
  deteriorating: 5, new: 4, unchanged_high_risk: 3, improving: 2, resolved: 1, unchanged: 0
};
const IMPACT_WEIGHT = { high: 3, medium: 2, low: 1 };
const CONFIDENCE_FACTOR = { high: 1, medium: 0.85, low: 0.7 };

let registry = { signals: {} };

export function useRegistry(json) {
  registry = json && json.signals ? json : { signals: {} };
  return registry;
}

export function registryEntry(id) {
  return (registry && registry.signals && registry.signals[id]) || null;
}

export function signalName(sig) {
  const entry = registryEntry(sig && sig.id);
  if (entry && entry.name_ja) return entry.name_ja;
  return (sig && sig.id) || "(未登録シグナル)";
}

export function polarity(sig) {
  const entry = registryEntry(sig && sig.id);
  return (entry && entry.polarity) || "neutral";
}

export function isBeauty(sig) {
  const entry = registryEntry(sig && sig.id);
  if (entry && typeof entry.beauty === "boolean") return entry.beauty;
  return !!(sig && (sig.demand_driver || sig.duration));
}

/** Is the movement unfavourable? Used for the direction tone only. */
export function directionTone(sig) {
  const p = polarity(sig);
  if (p === "neutral" || !sig.direction || sig.direction === "unknown") return "neutral";
  if (sig.direction === "stable") return "neutral";
  if (sig.direction === "volatile") return "bad";
  if (p === "up_is_bad") return sig.direction === "rising" ? "bad" : "good";
  if (p === "down_is_bad") return sig.direction === "falling" ? "bad" : "good";
  return "neutral";
}

/** Flat, read-only copies of every signal in a report, lens attached. */
export function signalsOf(report) {
  const intel = report && report.intelligence;
  if (!intel || typeof intel !== "object") return [];
  const out = [];
  LENSES.forEach((lens) => {
    const list = intel[lens];
    if (!Array.isArray(list)) return;
    list.forEach((sig) => {
      if (!sig || typeof sig !== "object") return;
      out.push({
        ...sig,                                  // never hand back the original
        lens: LENSES.indexOf(sig.lens) !== -1 ? sig.lens : lens,
        _reportDate: report.date,
        _reportType: report.type,
        _reportPath: report.path
      });
    });
  });
  return out;
}

export const hasIntelligence = (report) => signalsOf(report).length > 0;
export const anyIntelligence = (reports) => reports.some(hasIntelligence);

export function score(sig) {
  const c = CHANGE_WEIGHT[sig.change_status] || 0;
  const i = IMPACT_WEIGHT[sig.impact] || 1;
  const f = CONFIDENCE_FACTOR[sig.confidence] || 0.7;
  return (c * 2 + i * 3) * f;
}

export function rank(signals, limit) {
  const sorted = signals.slice().sort((a, b) => score(b) - score(a));
  return limit ? sorted.slice(0, limit) : sorted;
}

/** Lens display state. Derived, never stored. */
export function lensStatus(lens, signals) {
  if (!signals.length) return "unconfirmed";

  const moving = (s) => s.change_status === "new" || s.change_status === "deteriorating" ||
                        s.change_status === "unchanged_high_risk";
  const important = (s) => s.impact === "high" || s.impact === "medium";
  const adverse = (s) => directionTone(s) === "bad";
  const favourable = (s) => directionTone(s) === "good";
  const recovering = (s) => (s.change_status === "improving" || s.change_status === "resolved") && favourable(s);
  const volatile = signals.some((s) => s.direction === "volatile" && important(s));

  if (lens === "disruption") {
    if (signals.some((s) => s.impact === "high" && moving(s) && adverse(s))) return "disruption";
    if (signals.some((s) => moving(s) || (important(s) && adverse(s)))) return "watch";
    return "normal";
  }
  if (lens === "cost_capacity") {
    if (volatile) return "volatile";
    if (signals.some((s) => moving(s) && adverse(s) && important(s))) return "tightening";
    if (signals.some(recovering)) return "improving";
    return "stable";
  }
  if (lens === "reliability") {
    if (volatile) return "volatile";
    if (signals.some((s) => moving(s) && adverse(s) && important(s))) return "deteriorating";
    if (signals.some(recovering)) return "improving";
    return "stable";
  }
  if (lens === "demand_commerce") {
    if (volatile) return "volatile";
    if (signals.some((s) => s.direction === "rising" && important(s))) return "rising";
    if (signals.some((s) => s.direction === "falling" && important(s))) return "falling";
    return "stable";
  }
  if (lens === "regulatory_structural") {
    if (signals.some((s) => s.impact === "high" && (s.change_status === "new" || s.change_status === "deteriorating"))) return "major_change";
    if (signals.some((s) => moving(s) || s.impact === "high")) return "watch";
    return "stable";
  }
  return "unconfirmed";
}

/** ACTION REQUIRED is derived, not authored, so it cannot contradict the
    signals underneath it. Any `action_required` field on a report is ignored. */
export function actionRequired(report, signals) {
  const board = report.status_board || {};
  const boardValues = Object.keys(board).map((k) => board[k]);

  if (report.status === "disruption" ||
      boardValues.indexOf("disruption") !== -1 ||
      signals.some((s) => s.impact === "high" && (s.change_status === "new" || s.change_status === "deteriorating"))) {
    return "required";
  }
  if (report.status === "watch" ||
      boardValues.indexOf("watch") !== -1 ||
      signals.some((s) => s.change_status === "new" || s.change_status === "deteriorating" ||
                          s.change_status === "unchanged_high_risk")) {
    return "monitor";
  }
  if (report.status === "unconfirmed" || (!signals.length && !boardValues.length)) return "unknown";
  return "none";
}

/** Everything the dashboard needs about one report, computed on the fly. */
export function summarise(report) {
  const signals = signalsOf(report);
  const byLens = {};
  LENSES.forEach((lens) => {
    const list = signals.filter((s) => s.lens === lens);
    byLens[lens] = {
      lens,
      signals: list,
      status: lensStatus(lens, list),
      count: list.length,
      top: list.length ? rank(list, 1)[0] : null
    };
  });

  const changed = signals
    .filter((s) => CHANGE_PRIORITY.indexOf(s.change_status) !== -1)
    .sort((a, b) => {
      const d = CHANGE_PRIORITY.indexOf(a.change_status) - CHANGE_PRIORITY.indexOf(b.change_status);
      return d !== 0 ? d : score(b) - score(a);
    });

  const counts = {};
  CHANGE_PRIORITY.forEach((k) => {
    counts[k] = signals.filter((s) => s.change_status === k).length;
  });

  return {
    signals, byLens, changed, counts,
    key: rank(signals, 5),
    actionRequired: actionRequired(report, signals)
  };
}

/** Observations of one signal id across every report, newest first. */
export function history(reports, signalId) {
  const out = [];
  reports.forEach((report) => {
    signalsOf(report).forEach((sig) => {
      if (sig.id !== signalId) return;
      out.push({
        date: report.date,
        type: report.type,
        path: report.path,
        direction: sig.direction || "unknown",
        change_status: sig.change_status || "unchanged",
        confidence: sig.confidence || "low",
        impact: sig.impact || "low",
        signal: sig.signal || ""
      });
    });
  });
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return out;
}

export function isV21ChangeSummary(cs) {
  return !!cs && CHANGE_SUMMARY_KEYS.some((k) => Array.isArray(cs[k]));
}

/** Normal telemetry is not intelligence (pipeline docs §9): a customs signal
    that is unchanged, stable and backed by a `normal` board cell is status,
    not a headline, so report pages drop it from the signal list. */
export function isTelemetryOnly(sig, report) {
  return !!(sig && sig.id === "japan-customs-naccs" &&
            sig.change_status === "unchanged" &&
            sig.direction === "stable" &&
            report && report.status_board && report.status_board.customs === "normal");
}
