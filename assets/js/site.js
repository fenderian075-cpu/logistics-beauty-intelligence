/* =========================================================================
   site.js — shared helpers + home dashboard
   Depends on translation.js (window.LBI). Vanilla JS, no build step.
   ========================================================================= */

(function () {
  "use strict";

  /* ---------- Shared helpers (used by archive.js and report.js too) -------- */

  var STATUS_ORDER = ["disruption", "watch", "unconfirmed", "normal"];
  var TYPES = ["daily", "weekly", "monthly"];
  var DOMAINS = ["domestic", "weather", "customs", "ocean", "air", "global"];

  function root() {
    return document.body.getAttribute("data-root") || "";
  }

  function normalizeStatus(s) {
    s = (s || "").toLowerCase();
    return STATUS_ORDER.indexOf(s) === -1 ? "unconfirmed" : s;
  }

  /** Fetch and normalise data/reports.json. Sorting happens here so that
      whoever edits the JSON can append entries in any order. */
  function loadReports() {
    return fetch(root() + "data/reports.json", { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (json) {
        var list = (json && json.reports ? json.reports : []).map(function (r) {
          return {
            id: r.id || (r.date + "-" + r.type),
            date: r.date,
            type: TYPES.indexOf(r.type) === -1 ? "daily" : r.type,
            title: r.title || "",
            status: normalizeStatus(r.status),
            summary: r.summary || "",
            tags: r.tags || [],
            path: r.path || "",
            key_issues: r.key_issues || [],
            highlights: r.highlights || null,
            takeaways: r.takeaways || [],
            status_board: r.status_board || null,
            signals: r.signals || null,
            change_summary: r.change_summary || null,
            period: r.period || "",
            as_of: r.as_of || "",
            sample: !!r.sample
          };
        }).filter(function (r) { return r.date && r.path; });

        list.sort(function (a, b) {
          if (a.date === b.date) return TYPES.indexOf(a.type) - TYPES.indexOf(b.type);
          return a.date < b.date ? 1 : -1;   // newest first
        });
        return { meta: (json && json.meta) || {}, reports: list };
      });
  }

  var WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];
  var MONTH_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  function parseISO(iso) {
    var p = (iso || "").split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2] || 1));
  }

  function formatDate(iso, opts) {
    var d = parseISO(iso);
    if (isNaN(d.getTime())) return iso;
    if (LBI.lang === "en") {
      return d.getDate() + " " + MONTH_EN[d.getMonth()] + " " + d.getFullYear() +
             (opts && opts.weekday ? " (" + ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()] + ")" : "");
    }
    return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日" +
           (opts && opts.weekday ? "（" + WEEKDAY_JA[d.getDay()] + "）" : "");
  }

  function formatMonth(ym) {
    var p = (ym || "").split("-");
    if (p.length < 2) return ym;
    if (LBI.lang === "en") return MONTH_EN[Number(p[1]) - 1] + " " + p[0];
    return p[0] + "年" + Number(p[1]) + "月";
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function statusPill(status) {
    var span = el("span", "status-pill");
    span.setAttribute("data-status", status);
    span.appendChild(el("span", "dot"));
    span.appendChild(document.createTextNode(LBI.statusLabel(status)));
    return span;
  }

  /* ---------- v1.1 comparison helpers -------------------------------------
     These only compare two stored status values or two stored numbers.
     No interpretation happens here: all narrative comes from the JSON
     fields that ChatGPT writes (change_summary) or from the report HTML. */

  var SEVERITY = { normal: 0, unconfirmed: 1, watch: 2, disruption: 3 };

  function direction(from, to) {
    var a = SEVERITY[from], b = SEVERITY[to];
    if (a === undefined || b === undefined || a === b) return "side";
    return b > a ? "worse" : "better";
  }

  /** The entry of the same type immediately older than `report`. */
  function previousOf(reports, report) {
    var sameType = reports.filter(function (r) { return r.type === report.type; });
    var i = sameType.findIndex(function (r) { return r.id === report.id; });
    return (i === -1 || i === sameType.length - 1) ? null : sameType[i + 1];
  }

  /** Status transitions between two entries. Returns [] when nothing moved. */
  function statusDiff(current, previous) {
    if (!previous) return null;
    var rows = [];
    if (current.status !== previous.status) {
      rows.push({ key: "overall", from: previous.status, to: current.status });
    }
    var a = current.status_board || {}, b = previous.status_board || {};
    DOMAINS.forEach(function (k) {
      var from = normalizeStatus(b[k]), to = normalizeStatus(a[k]);
      if (from !== to) rows.push({ key: k, from: from, to: to });
    });
    return rows;
  }

  window.LBIData = {
    load: loadReports,
    previousOf: previousOf,
    statusDiff: statusDiff,
    direction: direction,
    formatDate: formatDate,
    formatMonth: formatMonth,
    statusPill: statusPill,
    normalizeStatus: normalizeStatus,
    DOMAINS: DOMAINS,
    TYPES: TYPES,
    el: el,
    root: root
  };

  /* ---------- Printing: open every <details> so nothing is lost ------------ */

  var reopened = [];
  window.addEventListener("beforeprint", function () {
    reopened = [];
    document.querySelectorAll("details:not([open])").forEach(function (d) {
      reopened.push(d);
      d.open = true;
    });
  });
  window.addEventListener("afterprint", function () {
    reopened.forEach(function (d) { d.open = false; });
    reopened = [];
  });
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-print]");
    if (btn) { e.preventDefault(); window.print(); }
  });

  /* ---------- Home dashboard ---------------------------------------------- */

  var HOME = document.getElementById("dashboard");
  if (!HOME) return;

  var data = null;

  function renderOverall(daily) {
    var box = document.getElementById("overall");
    box.innerHTML = "";
    if (!daily) {
      box.setAttribute("data-status", "unconfirmed");
      box.appendChild(labelBlock("unconfirmed"));
      var body = el("div", "overall__body");
      body.appendChild(el("p", null, LBI.t("home.noReport")));
      box.appendChild(body);
      return;
    }
    box.setAttribute("data-status", daily.status);
    box.appendChild(labelBlock(daily.status));

    var body = el("div", "overall__body");
    var p = el("p", null, daily.summary);
    p.setAttribute("data-translate", "");
    body.appendChild(p);
    var meta = el("p", "overall__meta",
      LBI.t("home.asOf") + ": " + formatDate(daily.date, { weekday: true }) +
      (daily.as_of ? " " + daily.as_of : ""));
    body.appendChild(meta);
    box.appendChild(body);
  }

  function labelBlock(status) {
    var wrapper = el("div", "overall__label");
    wrapper.appendChild(el("p", "eyebrow", LBI.t("home.overall")));
    var value = el("div", "overall__value");
    value.appendChild(el("span", "dot"));
    value.appendChild(document.createTextNode(LBI.statusLabel(status)));
    wrapper.appendChild(value);
    return wrapper;
  }

  function renderBoard(daily) {
    var board = document.getElementById("status-board");
    board.innerHTML = "";
    DOMAINS.forEach(function (key) {
      var st = normalizeStatus(daily && daily.status_board ? daily.status_board[key] : "unconfirmed");
      var cell = el("div", "status-cell");
      cell.setAttribute("data-status", st);
      cell.appendChild(el("div", "status-cell__name", LBI.t("domain." + key)));
      var v = el("div", "status-cell__value");
      v.appendChild(el("span", "dot"));
      v.appendChild(document.createTextNode(LBI.statusLabel(st)));
      cell.appendChild(v);
      board.appendChild(cell);
    });
  }

  function panelHead(titleKey, report) {
    var head = el("div", "panel__head");
    head.appendChild(el("h3", null, LBI.t(titleKey)));
    if (report) {
      head.appendChild(el("span", "panel__date",
        report.type === "monthly" ? formatMonth(report.period || report.date.slice(0, 7))
                                  : formatDate(report.date)));
      head.appendChild(statusPill(report.status));
    }
    return head;
  }

  function emptyPanel(titleKey) {
    var panel = el("div", "panel");
    panel.appendChild(panelHead(titleKey, null));
    var body = el("div", "panel__body");
    body.appendChild(el("p", "muted", LBI.t("home.noReport")));
    panel.appendChild(body);
    return panel;
  }

  function reportLink(report, labelKey, primary) {
    var a = el("a", "btn" + (primary ? " btn--primary" : ""), LBI.t(labelKey));
    a.href = root() + report.path;
    return a;
  }

  function tagRow(tags) {
    if (!tags || !tags.length) return null;
    var row = el("div", "tags");
    tags.slice(0, 6).forEach(function (tagText) {
      var a = el("a", "tag", tagText);
      a.href = root() + "archive.html?q=" + encodeURIComponent(tagText);
      row.appendChild(a);
    });
    return row;
  }

  function changeRow(row) {
    var li = el("li", "change-row");
    li.setAttribute("data-direction", LBIData.direction(row.from, row.to));
    li.appendChild(el("span", "change-row__key",
      row.key === "overall" ? LBI.t("changes.overall") : LBI.t("domain." + row.key)));
    var from = el("span", "change-row__from"); from.appendChild(statusPill(row.from));
    li.appendChild(from);
    li.appendChild(el("span", "change-row__arrow", "\u2192"));
    var to = el("span", "change-row__to"); to.appendChild(statusPill(row.to));
    li.appendChild(to);
    return li;
  }

  function riskGroup(kind, labelKey, items) {
    if (!items || !items.length) return null;
    var group = el("div", "change-group");
    group.setAttribute("data-kind", kind);
    group.appendChild(el("p", "eyebrow", LBI.t(labelKey)));
    var ul = el("ul");
    ul.setAttribute("data-translate", "");
    items.forEach(function (item) { ul.appendChild(el("li", null, item)); });
    group.appendChild(ul);
    return group;
  }

  /** Compact "前回からの変化" block for the dashboard panel.
      Shows only what moved; silent when there is nothing to say. */
  function renderChanges(report, previous) {
    var cs = report.change_summary || {};
    var rows = LBIData.statusDiff(report, previous);

    var box = el("div", "changes changes--compact");
    box.appendChild(el("p", "eyebrow", LBI.t("changes.title")));

    if (!previous) {
      box.classList.add("changes--none");
      box.appendChild(el("p", null, LBI.t("changes.none")));
      return box;
    }

    var meta = el("p", "changes__meta");
    var link = el("a", null, LBI.t("changes.comparedWith") + ": " + formatDate(previous.date));
    link.href = root() + previous.path;
    meta.appendChild(link);
    box.appendChild(meta);

    if (rows.length) {
      var ul = el("ul", "change-list");
      rows.forEach(function (row) { ul.appendChild(changeRow(row)); });
      box.appendChild(ul);
    } else {
      box.appendChild(el("p", "none", LBI.t("changes.unchanged")));
    }

    var groups = el("div", "change-groups");
    [["new", "changes.new", cs.new_risks],
     ["improved", "changes.improved", cs.improved_risks],
     ["resolved", "changes.resolved", cs.resolved_risks]].forEach(function (g) {
      var node = riskGroup(g[0], g[1], g[2]);
      if (node) groups.appendChild(node);
    });
    if (groups.childNodes.length) box.appendChild(groups);

    return box;
  }

  function formatSignal(sig) {
    if (!sig || sig.value == null) return null;
    return String(sig.value).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (sig.unit ? " " + sig.unit : "");
  }

  /** Key signals with a delta against the previous report of the same type. */
  function renderSignals(report, previous) {
    var sig = report.signals;
    if (!sig) return null;
    var keys = Object.keys(sig).filter(function (k) { return sig[k] && sig[k].value != null; });
    if (!keys.length) return null;

    var wrap = el("div", "signals");
    wrap.appendChild(el("p", "eyebrow", LBI.t("signals.title")));
    var dl = el("dl");
    keys.forEach(function (k) {
      var cur = sig[k];
      var row = el("div", "signal-row");
      row.appendChild(el("dt", null, k.toUpperCase()));
      var dd = el("dd", null, formatSignal(cur));

      var prev = previous && previous.signals ? previous.signals[k] : null;
      if (prev && prev.value != null && typeof cur.value === "number" && typeof prev.value === "number") {
        var diff = cur.value - prev.value;
        var pct = prev.value ? (diff / prev.value) * 100 : 0;
        var delta = el("span", "signal-delta",
          (diff > 0 ? "+" : diff < 0 ? "\u2212" : "\u00b1") +
          Math.abs(pct).toFixed(1) + "%");
        delta.setAttribute("data-direction", diff > 0 ? "up" : diff < 0 ? "down" : "flat");
        dd.appendChild(delta);
      }
      if (cur.data_date) dd.appendChild(el("span", "signal-date", cur.data_date));
      row.appendChild(dd);
      dl.appendChild(row);
    });
    wrap.appendChild(dl);
    return wrap;
  }

  function renderDaily(report) {
    if (!report) return emptyPanel("home.latestDaily");
    var panel = el("div", "panel");
    panel.appendChild(panelHead("home.latestDaily", report));
    var body = el("div", "panel__body");
    body.setAttribute("data-translate", "");

    body.appendChild(el("p", "eyebrow", LBI.t("home.execSummary")));
    body.appendChild(el("p", null, report.summary));

    if (report.key_issues.length) {
      body.appendChild(el("p", "eyebrow", LBI.t("home.keyIssues")));
      var ul = el("ul", "key-list");
      report.key_issues.forEach(function (issue) { ul.appendChild(el("li", null, issue)); });
      body.appendChild(ul);
    }
    var previous = LBIData.previousOf(data.reports, report);
    body.appendChild(renderChanges(report, previous));
    var signals = renderSignals(report, previous);
    if (signals) body.appendChild(signals);

    var tags = tagRow(report.tags);
    if (tags) body.appendChild(tags);
    panel.appendChild(body);

    var foot = el("div", "panel__foot");
    foot.appendChild(reportLink(report, "home.readDaily", true));
    panel.appendChild(foot);
    return panel;
  }

  function renderWeekly(report) {
    if (!report) return emptyPanel("home.latestWeekly");
    var panel = el("div", "panel");
    panel.appendChild(panelHead("home.latestWeekly", report));
    var body = el("div", "panel__body");
    body.setAttribute("data-translate", "");

    var dl = el("dl", "metrics");
    var h = report.highlights || {};
    [["Logistics Risk", h.logistics_risk], ["Freight Market", h.freight_market], ["Beauty Trend", h.beauty_trend]]
      .forEach(function (pair) {
        if (!pair[1]) return;
        var row = el("div", "metric-row");
        row.appendChild(el("dt", null, pair[0]));
        row.appendChild(el("dd", null, pair[1]));
        dl.appendChild(row);
      });
    if (dl.childNodes.length) body.appendChild(dl);
    else body.appendChild(el("p", null, report.summary));
    panel.appendChild(body);

    var foot = el("div", "panel__foot");
    foot.appendChild(reportLink(report, "home.readWeekly"));
    panel.appendChild(foot);
    return panel;
  }

  function renderMonthly(report) {
    if (!report) return emptyPanel("home.latestMonthly");
    var panel = el("div", "panel");
    panel.appendChild(panelHead("home.latestMonthly", report));
    var body = el("div", "panel__body");
    body.setAttribute("data-translate", "");

    if (report.takeaways.length) {
      body.appendChild(el("p", "eyebrow", "Structural Takeaways"));
      var ul = el("ul", "key-list");
      report.takeaways.forEach(function (item) { ul.appendChild(el("li", null, item)); });
      body.appendChild(ul);
    } else {
      body.appendChild(el("p", null, report.summary));
    }
    panel.appendChild(body);

    var foot = el("div", "panel__foot");
    foot.appendChild(reportLink(report, "home.readMonthly"));
    panel.appendChild(foot);
    return panel;
  }

  function latestOf(type) {
    for (var i = 0; i < data.reports.length; i++) {
      if (data.reports[i].type === type) return data.reports[i];
    }
    return null;
  }

  function renderAll() {
    var daily = latestOf("daily");
    renderOverall(daily);
    renderBoard(daily);

    var grid = document.getElementById("latest-grid");
    grid.innerHTML = "";
    grid.appendChild(renderDaily(daily));
    grid.appendChild(renderWeekly(latestOf("weekly")));
    grid.appendChild(renderMonthly(latestOf("monthly")));

    var stamp = document.getElementById("data-stamp");
    if (stamp && daily) stamp.textContent = formatDate(daily.date, { weekday: true });

    LBI.applyUIStrings();
    LBI.refreshTranslation();
  }

  function showError() {
    var box = document.getElementById("dashboard-error");
    if (box) { box.hidden = false; box.textContent = LBI.t("home.loadError"); }
  }

  loadReports().then(function (result) {
    data = result;
    renderAll();
    LBI.onLangChange(function () { if (data) renderAll(); });
  }).catch(function (err) {
    console.error(err);
    showError();
  });
})();
