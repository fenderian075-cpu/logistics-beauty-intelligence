/* =========================================================================
   signals.js — v2.1 structured intelligence layer
   -------------------------------------------------------------------------
   Additive. Everything here degrades to nothing when a report has no
   `intelligence` block, so legacy v1.1 / v2 reports keep working unchanged.

   Hard rule: aggregation affects DISPLAY ONLY. No function in this file
   writes back into a report object or a signal object. Derived values are
   returned as new objects.
   ========================================================================= */

(function () {
  "use strict";

  /* ---------- Enums (mirrored in data/signal-registry.json meta) ---------- */

  var LENSES = ["disruption", "cost_capacity", "reliability", "demand_commerce", "regulatory_structural"];
  var DIRECTIONS = ["rising", "falling", "stable", "volatile", "unknown"];
  var IMPACTS = ["high", "medium", "low"];
  var CHANGES = ["new", "deteriorating", "improving", "resolved", "unchanged", "unchanged_high_risk"];
  var CONFIDENCES = ["high", "medium", "low"];
  var DRIVERS = ["organic", "promotion", "launch", "buzz"];
  var DURATIONS = ["temporary", "persistent", "unknown"];

  /* Order used by "WHAT CHANGED" and by change badges. */
  var CHANGE_PRIORITY = ["deteriorating", "new", "improving", "resolved", "unchanged_high_risk"];

  var CHANGE_WEIGHT = {
    deteriorating: 5, new: 4, unchanged_high_risk: 3, improving: 2, resolved: 1, unchanged: 0
  };
  var IMPACT_WEIGHT = { high: 3, medium: 2, low: 1 };
  var CONFIDENCE_FACTOR = { high: 1, medium: 0.85, low: 0.7 };

  var registry = null;   // populated by loadRegistry()

  function isEnum(list, v) { return list.indexOf(v) !== -1; }

  /* ---------- Registry ----------------------------------------------------- */

  function loadRegistry(rootPath) {
    if (registry) return Promise.resolve(registry);
    return fetch((rootPath || "") + "data/signal-registry.json", { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (json) {
        registry = json && json.signals ? json : { signals: {} };
        return registry;
      })
      .catch(function (err) {
        // A missing registry must not break the page: signals fall back to
        // their own `lens` field and their raw id as a display name.
        console.warn("signal-registry.json unavailable — falling back to inline signal metadata.", err);
        registry = { signals: {} };
        return registry;
      });
  }

  function registryEntry(id) {
    return (registry && registry.signals && registry.signals[id]) || null;
  }

  function signalName(sig) {
    var entry = registryEntry(sig.id);
    if (entry && entry.name_ja) return LBI.lang === "en" && entry.name_en ? entry.name_en : entry.name_ja;
    return sig.id || "(unregistered signal)";
  }

  function polarity(sig) {
    var entry = registryEntry(sig.id);
    return (entry && entry.polarity) || "neutral";
  }

  function isBeauty(sig) {
    var entry = registryEntry(sig.id);
    if (entry && typeof entry.beauty === "boolean") return entry.beauty;
    return !!(sig.demand_driver || sig.duration);
  }

  /** Is the movement unfavourable? Used for the direction badge tone only. */
  function directionTone(sig) {
    var p = polarity(sig);
    if (p === "neutral" || !sig.direction || sig.direction === "unknown") return "neutral";
    if (sig.direction === "stable") return "neutral";
    if (sig.direction === "volatile") return "bad";
    if (p === "up_is_bad") return sig.direction === "rising" ? "bad" : "good";
    if (p === "down_is_bad") return sig.direction === "falling" ? "bad" : "good";
    return "neutral";
  }

  /* ---------- Reading signals out of a report ------------------------------ */

  /** Flat, read-only copies of every signal in a report, lens attached. */
  function signalsOf(report) {
    var intel = report && report.intelligence;
    if (!intel || typeof intel !== "object") return [];
    var out = [];
    LENSES.forEach(function (lens) {
      var list = intel[lens];
      if (!Array.isArray(list)) return;
      list.forEach(function (sig) {
        if (!sig || typeof sig !== "object") return;
        var copy = {};                       // never hand back the original
        Object.keys(sig).forEach(function (k) { copy[k] = sig[k]; });
        copy.lens = isEnum(LENSES, sig.lens) ? sig.lens : lens;
        copy._reportDate = report.date;
        copy._reportType = report.type;
        copy._reportPath = report.path;
        out.push(copy);
      });
    });
    return out;
  }

  function hasIntelligence(report) {
    return signalsOf(report).length > 0;
  }

  function anyIntelligence(reports) {
    return reports.some(hasIntelligence);
  }

  /* ---------- Ranking and aggregation (display only) ----------------------- */

  function score(sig) {
    var c = CHANGE_WEIGHT[sig.change_status] || 0;
    var i = IMPACT_WEIGHT[sig.impact] || 1;
    var f = CONFIDENCE_FACTOR[sig.confidence] || 0.7;
    return (c * 2 + i * 3) * f;
  }

  function rank(signals, limit) {
    var sorted = signals.slice().sort(function (a, b) { return score(b) - score(a); });
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /** Lens display state. Derived, never stored.
      Each lens uses vocabulary appropriate to what it measures. The canonical
      signal data is never rewritten; polarity + direction are used only to
      interpret movement for display. */
  function lensStatus(lens, signals) {
    if (!signals.length) return "unconfirmed";

    var moving = function (s) {
      return s.change_status === "new" || s.change_status === "deteriorating" ||
             s.change_status === "unchanged_high_risk";
    };
    var important = function (s) { return s.impact === "high" || s.impact === "medium"; };
    var adverse = function (s) { return directionTone(s) === "bad"; };
    var favourable = function (s) { return directionTone(s) === "good"; };
    var volatile = signals.some(function (s) { return s.direction === "volatile" && important(s); });

    if (lens === "disruption") {
      if (signals.some(function (s) { return s.impact === "high" && moving(s) && adverse(s); })) return "disruption";
      if (signals.some(function (s) { return moving(s) || (important(s) && adverse(s)); })) return "watch";
      return "normal";
    }

    if (lens === "cost_capacity") {
      if (volatile) return "volatile";
      if (signals.some(function (s) { return moving(s) && adverse(s) && important(s); })) return "tightening";
      if (signals.some(function (s) { return (s.change_status === "improving" || s.change_status === "resolved") && favourable(s); })) return "improving";
      return "stable";
    }

    if (lens === "reliability") {
      if (volatile) return "volatile";
      if (signals.some(function (s) { return moving(s) && adverse(s) && important(s); })) return "deteriorating";
      if (signals.some(function (s) { return (s.change_status === "improving" || s.change_status === "resolved") && favourable(s); })) return "improving";
      return "stable";
    }

    if (lens === "demand_commerce") {
      if (volatile) return "volatile";
      if (signals.some(function (s) { return s.direction === "rising" && important(s); })) return "rising";
      if (signals.some(function (s) { return s.direction === "falling" && important(s); })) return "falling";
      return "stable";
    }

    if (lens === "regulatory_structural") {
      if (signals.some(function (s) { return s.impact === "high" && (s.change_status === "new" || s.change_status === "deteriorating"); })) return "major_change";
      if (signals.some(function (s) { return moving(s) || s.impact === "high"; })) return "watch";
      return "stable";
    }

    return "unconfirmed";
  }

  /** Everything the dashboard needs about one report, computed on the fly. */
  function summarise(report) {
    var signals = signalsOf(report);
    var byLens = {};
    LENSES.forEach(function (lens) {
      var list = signals.filter(function (s) { return s.lens === lens; });
      byLens[lens] = {
        lens: lens,
        signals: list,
        status: lensStatus(lens, list),
        count: list.length,
        top: list.length ? rank(list, 1)[0] : null
      };
    });

    var changed = signals.filter(function (s) {
      return CHANGE_PRIORITY.indexOf(s.change_status) !== -1;
    }).sort(function (a, b) {
      var d = CHANGE_PRIORITY.indexOf(a.change_status) - CHANGE_PRIORITY.indexOf(b.change_status);
      return d !== 0 ? d : score(b) - score(a);
    });

    var counts = {};
    CHANGE_PRIORITY.forEach(function (k) {
      counts[k] = signals.filter(function (s) { return s.change_status === k; }).length;
    });

    return {
      signals: signals,
      byLens: byLens,
      changed: changed,
      counts: counts,
      key: rank(signals, 5),
      actionRequired: actionRequired(report, signals)
    };
  }

  /** ACTION REQUIRED is derived, not authored, so it can never contradict
      the signals underneath it. Any `action_required` field found on a report
      entry is deliberately ignored — see README section 6.2. Rule, in order:
        required : overall status is disruption, OR a high-impact signal is
                   new/deteriorating, OR any status_board cell is disruption
        monitor  : overall status is watch, or any signal is moving
        none     : otherwise */
  function actionRequired(report, signals) {
    var board = report.status_board || {};
    var boardValues = Object.keys(board).map(function (k) { return board[k]; });

    if (report.status === "disruption" ||
        boardValues.indexOf("disruption") !== -1 ||
        signals.some(function (s) {
          return s.impact === "high" && (s.change_status === "new" || s.change_status === "deteriorating");
        })) {
      return "required";
    }
    if (report.status === "watch" ||
        boardValues.indexOf("watch") !== -1 ||
        signals.some(function (s) {
          return s.change_status === "new" || s.change_status === "deteriorating" ||
                 s.change_status === "unchanged_high_risk";
        })) {
      return "monitor";
    }
    if (report.status === "unconfirmed" || !signals.length && !boardValues.length) return "unknown";
    return "none";
  }

  /* ---------- History ------------------------------------------------------ */

  /** Observations of one signal id across every report, newest first.
      Built by matching persistent ids — nothing is stored. */
  function history(reports, signalId) {
    var out = [];
    reports.forEach(function (report) {
      signalsOf(report).forEach(function (sig) {
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
    out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    return out;
  }

  /* ---------- Rendering ---------------------------------------------------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  var ARROW = { rising: "\u2191", falling: "\u2193", stable: "\u2192", volatile: "\u21c5", unknown: "\u2013" };

  function badge(kind, value, labelKey, extra) {
    var span = el("span", "badge badge--" + kind);
    span.setAttribute("data-value", value || "unknown");
    if (extra) Object.keys(extra).forEach(function (k) { span.setAttribute(k, extra[k]); });
    span.textContent = LBI.t(labelKey);
    return span;
  }

  function changeBadge(sig) {
    var v = sig.change_status || "unchanged";
    return badge("change", v, "change." + v);
  }

  function directionBadge(sig) {
    var v = sig.direction || "unknown";
    var b = badge("dir", v, "dir." + v, { "data-tone": directionTone(sig) });
    b.textContent = ARROW[v] + " " + LBI.t("dir." + v);
    return b;
  }

  function confidenceBadge(sig) {
    var v = sig.confidence || "low";
    var b = badge("conf", v, "conf." + v);
    b.textContent = LBI.t("sig.confidence") + ": " + LBI.t("conf." + v);
    return b;
  }

  function impactBadge(sig) {
    var v = sig.impact || "low";
    var b = badge("impact", v, "impact." + v);
    b.textContent = LBI.t("sig.impact") + ": " + LBI.t("impact." + v);
    return b;
  }

  function metaRow(labelKey, value) {
    var row = el("div", "sig__meta-row");
    row.appendChild(el("dt", null, LBI.t(labelKey)));
    row.appendChild(el("dd", null, value));
    return row;
  }

  function evidenceList(sig) {
    var ev = sig.evidence;
    if (!ev || (Array.isArray(ev) && !ev.length)) return null;
    var wrap = el("div", "sig__evidence");
    wrap.appendChild(el("p", "eyebrow", LBI.t("sig.evidence")));
    var ul = el("ul");
    (Array.isArray(ev) ? ev : [ev]).forEach(function (item) {
      var li = el("li");
      if (typeof item === "string") {
        li.textContent = item;
      } else if (item && typeof item === "object") {
        var label = item.source || item.title || item.url || "";
        if (item.url) {
          var a = el("a", null, label);
          a.href = item.url;
          a.rel = "noopener";
          li.appendChild(a);
        } else {
          li.appendChild(document.createTextNode(label));
        }
        if (item.date) li.appendChild(el("span", "sig__evidence-date", " " + item.date));
      }
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
    return wrap;
  }

  /** Tiny inline SVG history strip. One bar per observation, oldest at the
      left. Height encodes impact, fill encodes change status. No library. */
  function historyChart(observations) {
    if (observations.length < 2) return null;
    var points = observations.slice().reverse();       // oldest first
    var barW = 12, gap = 5, h = 34, pad = 2;
    var w = points.length * (barW + gap) - gap + pad * 2;
    var heights = { high: 26, medium: 17, low: 9 };

    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "sig-chart");
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", LBI.t("sig.historyChartLabel"));

    points.forEach(function (p, i) {
      var bh = heights[p.impact] || 9;
      var rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", pad + i * (barW + gap));
      rect.setAttribute("y", h - bh - pad);
      rect.setAttribute("width", barW);
      rect.setAttribute("height", bh);
      rect.setAttribute("rx", "1");
      rect.setAttribute("class", "sig-chart__bar");
      rect.setAttribute("data-change", p.change_status);
      var title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = p.date + " — " + LBI.t("change." + p.change_status) +
                          " / " + LBI.t("impact." + p.impact);
      rect.appendChild(title);
      svg.appendChild(rect);
    });
    return svg;
  }

  function historyBlock(observations, rootPath) {
    var wrap = el("div", "sig__history");
    wrap.appendChild(el("p", "eyebrow", LBI.t("sig.history")));

    if (!observations.length) {
      wrap.appendChild(el("p", "sig__history-empty", LBI.t("sig.historyNone")));
      return wrap;
    }
    if (observations.length === 1) {
      wrap.appendChild(el("p", "sig__history-empty", LBI.t("sig.historyThin")));
    }

    var chart = historyChart(observations);
    if (chart) wrap.appendChild(chart);

    var table = el("table", "sig__history-table");
    var thead = el("thead");
    var hr = el("tr");
    [LBI.t("sig.date"), LBI.t("sig.change"), LBI.t("sig.direction"), LBI.t("sig.confidence")]
      .forEach(function (h) {
        var th = el("th", null, h);
        th.setAttribute("scope", "col");
        hr.appendChild(th);
      });
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = el("tbody");
    observations.slice(0, 12).forEach(function (o) {
      var tr = el("tr");
      var tdDate = el("td");
      if (o.path) {
        var a = el("a", null, o.date);
        a.href = (rootPath || "") + o.path;
        tdDate.appendChild(a);
      } else {
        tdDate.textContent = o.date;
      }
      tr.appendChild(tdDate);
      var tdChange = el("td");
      tdChange.appendChild(badge("change", o.change_status, "change." + o.change_status));
      tr.appendChild(tdChange);
      tr.appendChild(el("td", null, ARROW[o.direction] + " " + LBI.t("dir." + o.direction)));
      tr.appendChild(el("td", null, LBI.t("conf." + o.confidence)));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    var scroll = el("div", "table-scroll");
    scroll.appendChild(table);
    wrap.appendChild(scroll);
    return wrap;
  }

  /**
   * Signal card. `opts`:
   *   reports  — full report list, enables the history block
   *   rootPath — path prefix for links
   *   open     — start expanded
   *   compact  — leaner card for the dashboard KEY SIGNALS list
   */
  function card(sig, opts) {
    opts = opts || {};
    var details = el("details", "sig-card" + (opts.compact ? " sig-card--compact" : ""));
    details.setAttribute("data-lens", sig.lens || "");
    details.setAttribute("data-change", sig.change_status || "unchanged");
    details.setAttribute("data-impact", sig.impact || "low");
    if (opts.open) details.open = true;

    var summary = el("summary", "sig-card__summary");
    var head = el("div", "sig-card__head");
    head.appendChild(el("span", "sig-card__lens", LBI.t("lens." + (sig.lens || "disruption"))));
    head.appendChild(el("span", "sig-card__name", signalName(sig)));
    summary.appendChild(head);

    if (sig.signal) {
      var stmt = el("p", "sig-card__statement", sig.signal);
      stmt.setAttribute("data-translate", "");
      summary.appendChild(stmt);
    }

    var badges = el("div", "sig-card__badges");
    badges.appendChild(changeBadge(sig));
    badges.appendChild(directionBadge(sig));
    badges.appendChild(impactBadge(sig));
    badges.appendChild(confidenceBadge(sig));
    if (isBeauty(sig)) {
      if (sig.demand_driver) {
        var db = badge("driver", sig.demand_driver, "driver." + sig.demand_driver);
        db.textContent = LBI.t("sig.demandDriver") + ": " + LBI.t("driver." + sig.demand_driver);
        badges.appendChild(db);
      }
      if (sig.duration) {
        var ub = badge("duration", sig.duration, "duration." + sig.duration);
        ub.textContent = LBI.t("sig.duration") + ": " + LBI.t("duration." + sig.duration);
        badges.appendChild(ub);
      }
    }
    summary.appendChild(badges);
    details.appendChild(summary);

    var body = el("div", "sig-card__body");
    body.setAttribute("data-translate", "");

    if (sig.operational_implication) {
      var impl = el("p", "sig-card__line");
      impl.appendChild(el("span", "sig-card__label", LBI.t("sig.implication")));
      impl.appendChild(document.createTextNode(sig.operational_implication));
      body.appendChild(impl);
    }
    if (sig.action_direction) {
      var act = el("p", "sig-card__line sig-card__line--action");
      act.appendChild(el("span", "sig-card__label", LBI.t("sig.action")));
      act.appendChild(document.createTextNode(sig.action_direction));
      body.appendChild(act);
    }

    var entry = registryEntry(sig.id);
    if (entry && entry.description_ja) {
      body.appendChild(el("p", "sig-card__desc", entry.description_ja));
    }

    var ev = evidenceList(sig);
    if (ev) body.appendChild(ev);

    if (opts.reports) {
      body.appendChild(historyBlock(history(opts.reports, sig.id), opts.rootPath));
    }

    if (!body.childNodes.length) {
      body.appendChild(el("p", "sig-card__desc", LBI.t("sig.noDetail")));
    }
    details.appendChild(body);
    return details;
  }

  /* ---------- change_summary (v2.1 shape) ---------------------------------- */

  var CHANGE_SUMMARY_KEYS = ["new", "deteriorating", "improving", "resolved", "unchanged_high_risk"];

  function isV21ChangeSummary(cs) {
    return !!cs && CHANGE_SUMMARY_KEYS.some(function (k) { return Array.isArray(cs[k]); });
  }

  window.LBISignals = {
    LENSES: LENSES,
    DIRECTIONS: DIRECTIONS,
    IMPACTS: IMPACTS,
    CHANGES: CHANGES,
    CONFIDENCES: CONFIDENCES,
    DRIVERS: DRIVERS,
    DURATIONS: DURATIONS,
    CHANGE_PRIORITY: CHANGE_PRIORITY,
    CHANGE_SUMMARY_KEYS: CHANGE_SUMMARY_KEYS,
    loadRegistry: loadRegistry,
    registryEntry: registryEntry,
    signalName: signalName,
    signalsOf: signalsOf,
    hasIntelligence: hasIntelligence,
    anyIntelligence: anyIntelligence,
    summarise: summarise,
    lensStatus: lensStatus,
    rank: rank,
    score: score,
    history: history,
    card: card,
    historyBlock: historyBlock,
    isV21ChangeSummary: isV21ChangeSummary,
    isBeauty: isBeauty
  };
})();
