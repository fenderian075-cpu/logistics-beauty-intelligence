/* =========================================================================
   translation.js — Japanese is the source of truth. English is a view.
   -------------------------------------------------------------------------
   Two independent layers:

   Layer 1  UI chrome (nav, buttons, filter labels, status words)
            A finite, hand-written dictionary. Instant, offline, exact.
            Never fails.

   Layer 2  Report body text
            The browser's built-in on-device translator (Chrome/Edge 138+
            Translator API). No network call to a third party, no API key,
            no external script. If the browser cannot do it, the Japanese
            original stays on screen and a notice explains how to use the
            browser's own page translation instead.

   Nothing here ever replaces Japanese content with an empty or partial
   string: originals are kept in a WeakMap and restored on failure or on
   switching back to 日本語.
   ========================================================================= */

(function () {
  "use strict";

  var STORAGE_KEY = "lbi.lang";

  /* ---------- UI dictionary ---------------------------------------------- */

  var STRINGS = {
    "nav.home":            { ja: "ホーム",            en: "Home" },
    "nav.today":           { ja: "今日のレポート",     en: "Today's brief" },
    "nav.archive":         { ja: "過去のレポート",     en: "Archive" },
    "nav.about":           { ja: "このサイトについて", en: "About" },

    "site.name":           { ja: "Logistics & Beauty Intelligence", en: "Logistics & Beauty Intelligence" },
    "site.tagline":        { ja: "公開情報から作成する物流・ビューティー動向ブリーフ",
                             en: "Logistics and beauty briefs built from public sources" },

    "lang.label":          { ja: "表示言語",           en: "Language" },
    "lang.ja":             { ja: "日本語",             en: "日本語" },
    "lang.en":             { ja: "English",           en: "English" },

    "lang.translating":    { ja: "英語に翻訳しています…", en: "Translating to English…" },
    "lang.done":           { ja: "本文はブラウザ内蔵の翻訳機能で英訳されています。原文は日本語です。",
                             en: "Body text was machine-translated on your device. Japanese is the original." },
    "lang.partial":        { ja: "一部を翻訳できませんでした。その部分は日本語のまま表示しています。",
                             en: "Some blocks could not be translated and are shown in the original Japanese." },
    "lang.unsupported":    { ja: "このブラウザは端末内翻訳に対応していません。画面の文言のみ英語にしました。本文を英訳するには、ブラウザの翻訳機能（Chrome / Edge: 右クリック →「英語に翻訳」、Safari: アドレスバーの翻訳アイコン）をご利用ください。",
                             en: "This browser has no built-in on-device translator, so only the interface is in English. To translate the body text, use your browser's own page translation (Chrome / Edge: right-click → Translate to English; Safari: the translate icon in the address bar)." },
    "lang.downloading":    { ja: "翻訳モデルをダウンロードしています。完了までしばらくお待ちください。",
                             en: "Downloading the on-device translation model. This runs once." },

    "status.normal":       { ja: "平常",         en: "Normal" },
    "status.watch":        { ja: "監視",         en: "Watch" },
    "status.disruption":   { ja: "障害",         en: "Disruption" },
    "status.unconfirmed":  { ja: "未確認",       en: "Unconfirmed" },

    /* Lens-specific derived display states (never stored in reports.json). */
    "lensState.normal":        { ja: "平常",       en: "Normal" },
    "lensState.watch":         { ja: "監視",       en: "Watch" },
    "lensState.disruption":    { ja: "障害",       en: "Disruption" },
    "lensState.unconfirmed":   { ja: "未確認",     en: "Unconfirmed" },
    "lensState.improving":     { ja: "改善",       en: "Improving" },
    "lensState.stable":        { ja: "安定",       en: "Stable" },
    "lensState.tightening":    { ja: "逼迫",       en: "Tightening" },
    "lensState.volatile":      { ja: "変動大",     en: "Volatile" },
    "lensState.deteriorating": { ja: "悪化",       en: "Deteriorating" },
    "lensState.rising":        { ja: "上昇",       en: "Rising" },
    "lensState.falling":       { ja: "低下",       en: "Falling" },
    "lensState.major_change":  { ja: "重大変化",   en: "Major Change" },

    "type.daily":          { ja: "デイリー",   en: "Daily" },
    "type.weekly":         { ja: "ウィークリー", en: "Weekly" },
    "type.monthly":        { ja: "マンスリー", en: "Monthly" },

    "domain.domestic":     { ja: "国内配送",                     en: "Domestic delivery" },
    "domain.weather":      { ja: "気象・災害",                   en: "Weather / disaster" },
    "domain.customs":      { ja: "通関・NACCS",                  en: "Customs / NACCS" },
    "domain.ocean":        { ja: "海上輸送",                     en: "Ocean freight" },
    "domain.air":          { ja: "航空貨物",                     en: "Air cargo" },
    "domain.global":       { ja: "グローバルサプライチェーン",   en: "Global supply chain" },

    "a11y.language":       { ja: "表示言語",                     en: "Language" },

    "home.latestTitle":    { ja: "最新レポート",                 en: "Latest reports" },
    "home.aboutTitle":     { ja: "このサイトについて",           en: "About this site" },
    "home.loading":        { ja: "読み込み中…",                   en: "Loading…" },

    "home.statusTitle":    { ja: "日本物流ステータス",           en: "Japan Logistics Status" },
    "home.overall":        { ja: "総合ステータス",               en: "Overall status" },
    "home.asOf":           { ja: "基準時点",                    en: "As of" },
    "home.latestDaily":    { ja: "最新のデイリー",              en: "Latest daily" },
    "home.latestWeekly":   { ja: "最新のウィークリー",          en: "Latest weekly" },
    "home.latestMonthly":  { ja: "最新のマンスリー",            en: "Latest monthly" },
    "home.readDaily":      { ja: "デイリーを読む",              en: "Read the daily" },
    "home.readWeekly":     { ja: "ウィークリーを読む",          en: "Read the weekly" },
    "home.readMonthly":    { ja: "マンスリーを読む",            en: "Read the monthly" },
    "home.keyIssues":      { ja: "主要ポイント",                 en: "Key issues" },
    "home.execSummary":    { ja: "概要",                         en: "Executive summary" },
    "home.showAll":        { ja: "すべて表示",                  en: "Show all" },
    "home.noReport":       { ja: "このタイプのレポートはまだありません。", en: "No report of this type yet." },
    "home.loadError":      { ja: "レポート一覧（data/reports.json）を読み込めませんでした。ページを再読み込みするか、ローカルではHTTPサーバー経由で開いてください。",
                             en: "Could not load data/reports.json. Reload the page, or serve the site over HTTP when running locally." },

    "archive.title":       { ja: "過去のレポート",     en: "Archive" },
    "archive.year":        { ja: "年",                 en: "Year" },
    "archive.month":       { ja: "月",                 en: "Month" },
    "archive.type":        { ja: "種別",               en: "Type" },
    "archive.status":      { ja: "総合ステータス",     en: "Overall status" },
    "archive.keyword":     { ja: "キーワード",         en: "Keyword" },
    "archive.keywordHint": { ja: "タイトル・要約・タグを検索", en: "Search titles, summaries and tags" },
    "archive.all":         { ja: "すべて",             en: "All" },
    "archive.reset":       { ja: "条件をクリア",       en: "Clear filters" },
    "archive.count":       { ja: "{n} 件",             en: "{n} reports" },
    "archive.empty":       { ja: "条件に一致するレポートはありません。条件を減らしてお試しください。",
                             en: "No report matches these filters. Try removing one." },
    "archive.detail":      { ja: "詳細を見る",         en: "Open report" },

    "changes.title":       { ja: "前回からの変化",       en: "Changes since previous brief" },
    "changes.comparedWith":{ ja: "比較対象",             en: "Compared with" },
    "changes.none":        { ja: "前回データなし（初回レポート）。次回から前回比較を表示します。",
                             en: "No previous report to compare with (first brief). Comparison starts from the next one." },
    "changes.unchanged":   { ja: "前回からステータスの変化はありません。",
                             en: "No status changes since the previous brief." },
    "changes.overall":     { ja: "総合",                 en: "Overall" },
    "changes.new":         { ja: "新規リスク",           en: "New risks" },
    "changes.improved":    { ja: "改善",                 en: "Improved" },
    "changes.resolved":    { ja: "解消",                 en: "Resolved" },
    "changes.noItems":     { ja: "なし",                 en: "None" },
    "signals.title":       { ja: "主要指標",             en: "Key signals" },
    "signals.noData":      { ja: "データなし",           en: "No data" },

    "report.statusBoard":  { ja: "物流ステータス",     en: "Logistics status" },
    "report.bottomLine":   { ja: "結論",               en: "Bottom line" },
    "report.watchlist":    { ja: "本日の監視項目",     en: "Today's watchlist" },
    "report.sources":      { ja: "出典",               en: "Sources" },
    "report.importance":   { ja: "重要度",             en: "Importance" },
    "report.relevance":    { ja: "日本への関連度",     en: "Japan relevance" },

    "report.detail":       { ja: "詳細",               en: "Detail" },
    "report.ports":        { ja: "港湾・ターミナル",   en: "Ports and terminals" },
    "report.carriers":     { ja: "船社・航空会社",     en: "Carrier details" },
    "report.regulations":  { ja: "規制・通関",         en: "Regulations and customs" },
    "report.indices":      { ja: "運賃指標",           en: "Freight indices" },
    "report.secondary":    { ja: "副次指標",           en: "Secondary indicators" },
    "report.beauty":       { ja: "ビューティー",       en: "Beauty" },

    /* ---- v2.1 structured intelligence ---- */
    "lens.disruption":            { ja: "Disruption（障害）",                 en: "Disruption" },
    "lens.cost_capacity":         { ja: "Cost & Capacity（コスト・キャパ）",  en: "Cost & Capacity" },
    "lens.reliability":           { ja: "Reliability（定時性）",              en: "Reliability" },
    "lens.demand_commerce":       { ja: "Demand & Commerce（需要・商流）",    en: "Demand & Commerce" },
    "lens.regulatory_structural": { ja: "Regulatory & Structural（規制・構造）", en: "Regulatory & Structural" },

    "dir.rising":    { ja: "上昇",   en: "Rising" },
    "dir.falling":   { ja: "低下",   en: "Falling" },
    "dir.stable":    { ja: "横ばい", en: "Stable" },
    "dir.volatile":  { ja: "不安定", en: "Volatile" },
    "dir.unknown":   { ja: "不明",   en: "Unknown" },

    "impact.high":   { ja: "大", en: "High" },
    "impact.medium": { ja: "中", en: "Medium" },
    "impact.low":    { ja: "小", en: "Low" },

    "conf.high":     { ja: "高", en: "High" },
    "conf.medium":   { ja: "中", en: "Medium" },
    "conf.low":      { ja: "低", en: "Low" },

    "change.new":                 { ja: "新規",       en: "New" },
    "change.deteriorating":       { ja: "悪化",       en: "Deteriorating" },
    "change.improving":           { ja: "改善",       en: "Improving" },
    "change.resolved":            { ja: "解消",       en: "Resolved" },
    "change.unchanged":           { ja: "変化なし",   en: "Unchanged" },
    "change.unchanged_high_risk": { ja: "高リスク継続", en: "Unchanged, high risk" },

    "driver.organic":   { ja: "自然需要", en: "Organic" },
    "driver.promotion": { ja: "販促",     en: "Promotion" },
    "driver.launch":    { ja: "ローンチ", en: "Launch" },
    "driver.buzz":      { ja: "話題化",   en: "Buzz" },

    "duration.temporary":  { ja: "一時的", en: "Temporary" },
    "duration.persistent": { ja: "継続的", en: "Persistent" },
    "duration.unknown":    { ja: "不明",   en: "Unknown" },

    "sig.impact":        { ja: "影響度",   en: "Impact" },
    "sig.confidence":    { ja: "確度",     en: "Confidence" },
    "sig.direction":     { ja: "方向",     en: "Direction" },
    "sig.change":        { ja: "変化",     en: "Change" },
    "sig.date":          { ja: "日付",     en: "Date" },
    "sig.demandDriver":  { ja: "需要要因", en: "Demand driver" },
    "sig.duration":      { ja: "持続性",   en: "Duration" },
    "sig.implication":   { ja: "業務影響", en: "Operational implication" },
    "sig.action":        { ja: "対応方向", en: "Action direction" },
    "sig.evidence":      { ja: "根拠",     en: "Evidence" },
    "sig.history":       { ja: "この signal の推移", en: "Signal history" },
    "sig.historyNone":   { ja: "過去の観測はまだありません。", en: "No earlier observation yet." },
    "sig.historyThin":   { ja: "観測が1件のみのため、推移グラフは表示していません。",
                           en: "Only one observation so far, so no trend strip is shown." },
    "sig.historyChartLabel": { ja: "影響度と変化ステータスの推移",
                               en: "Impact and change status over time" },
    "sig.noDetail":      { ja: "詳細情報は登録されていません。", en: "No further detail recorded." },

    "home.decisionTitle":   { ja: "本日の判断",         en: "Today's call" },
    "home.actionRequired":  { ja: "対応が必要",         en: "Action required" },
    "home.actionMonitor":   { ja: "監視のみ",           en: "Monitor only" },
    "home.actionNone":      { ja: "対応不要",           en: "No action needed" },
    "home.actionUnknown":   { ja: "判定不能（未確認）", en: "Undetermined (unconfirmed)" },
    "home.actionRequiredNote": { ja: "高影響のシグナルが新規または悪化しています。本文の対応方向を確認してください。",
                                 en: "A high-impact signal is new or deteriorating. Check the action direction in the brief." },
    "home.actionMonitorNote":  { ja: "直ちに運用を変える必要はありませんが、監視対象があります。",
                                 en: "No immediate change to operations, but there are items under watch." },
    "home.actionNoneNote":     { ja: "通常運用で問題ありません。",
                                 en: "Normal operations are fine." },
    "home.actionUnknownNote":  { ja: "確認できていない領域があります。判断の前に一次情報を確認してください。",
                                 en: "Some areas are unconfirmed. Check primary sources before deciding." },
    "home.lastUpdated":     { ja: "最終更新",           en: "Last updated" },

    "home.whatChanged":     { ja: "前回からの変化",     en: "What changed" },
    "home.changedNone":     { ja: "構造化シグナルの変化は記録されていません。",
                              en: "No structured signal changes recorded." },
    "home.changedMore":     { ja: "ほか {n} 件",        en: "{n} more" },

    "home.lensesTitle":     { ja: "5つの視点",          en: "Five intelligence lenses" },
    "home.lensesNote":      { ja: "最新レポートの構造化シグナルを集計した表示です。元データは変更しません。",
                              en: "Aggregated from the latest report's structured signals. Display only." },
    "home.lensEmpty":       { ja: "シグナル未登録",     en: "No signals yet" },
    "home.lensCount":       { ja: "{n} 件",             en: "{n} signals" },

    "home.keySignalsTitle": { ja: "主要シグナル",       en: "Key signals" },
    "home.keySignalsNote":  { ja: "判断への効きが大きい順。開くと推移が見られます。",
                              en: "Ordered by decision relevance. Open a card for its history." },
    "home.noIntelligence":  { ja: "このレポートには構造化シグナル（intelligence）が登録されていません。従来のステータスボードのみ表示しています。",
                              en: "This report has no structured intelligence block. Only the legacy status board is shown." },

    "home.typesTitle":      { ja: "レポートの種類",     en: "Report types" },
    "type.dailyQ":          { ja: "今日、業務を変える必要があるか", en: "Does anything have to change today?" },
    "type.dailyDesc":       { ja: "国内配送・気象・通関・NACCS・重大な輸送障害などの例外管理。",
                              en: "Exception management: domestic delivery, weather, customs and NACCS, major transport disruption." },
    "type.weeklyQ":         { ja: "来週〜数週間の判断材料", en: "Input for the next few weeks" },
    "type.weeklyDesc":      { ja: "運賃・キャパシティ・定時性・港湾・航空・Beauty需要・EC施策などを分析。",
                              en: "Freight rates, capacity, reliability, ports, air, beauty demand and e-commerce activity." },
    "type.monthlyQ":        { ja: "何の前提が変わったか", en: "Which assumptions moved?" },
    "type.monthlyDesc":     { ja: "物流構造・規制・市況・Technology maturity・Beauty需要構造を中期分析。",
                              en: "Structure, regulation, market conditions, technology maturity and beauty demand structure." },

    "archive.lens":         { ja: "Lens",       en: "Lens" },
    "archive.change":       { ja: "変化",       en: "Change" },
    "archive.confidence":   { ja: "確度",       en: "Confidence" },
    "archive.structuredOnly": { ja: "構造化シグナルを持つレポートのみが対象になります。",
                                en: "These filters only match reports that carry structured signals." },
    "archive.legacyBadge":  { ja: "構造化シグナルなし", en: "No structured signals" },

    "report.signalsTitle":  { ja: "構造化シグナル",   en: "Structured signals" },
    "report.signalsNone":   { ja: "このレポートには構造化シグナルが登録されていません。",
                              en: "This report carries no structured signals." },

    "report.prev":         { ja: "← 前のレポート",     en: "← Previous" },
    "report.next":         { ja: "次のレポート →",     en: "Next →" },
    "report.archive":      { ja: "過去のレポート", en: "Archive" },
    "report.none":         { ja: "これが最新です",     en: "Nothing newer" },
    "report.oldest":       { ja: "これが最初です",     en: "Nothing older" },
    "report.print":        { ja: "印刷・PDF",          en: "Print / PDF" },

    "footer.policy":       { ja: "本サイトは公開情報のみを扱います。社内・機密情報は掲載しません。",
                             en: "This site carries public-source information only. No internal or confidential material." },
    "footer.source":       { ja: "正本は日本語です。英語は閲覧時の機械翻訳です。",
                             en: "Japanese is the canonical version. English is machine-translated at read time." }
  };

  /* ---------- State ------------------------------------------------------- */

  var lang = "ja";
  var listeners = [];
  var originals = new WeakMap();   // text node -> original Japanese string
  var cache = {};                  // ja string -> en string (session)
  var translator = null;
  var translatorState = "unknown"; // unknown | ready | unavailable

  function readInitialLang() {
    var q = new URLSearchParams(location.search).get("lang");
    if (q === "en" || q === "ja") return q;
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "ja") return saved;
    } catch (e) { /* private mode */ }
    return "ja";
  }

  function t(key, vars) {
    var entry = STRINGS[key];
    var s = entry ? (entry[lang] || entry.ja) : key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.replace("{" + k + "}", vars[k]);
      });
    }
    return s;
  }

  /* ---------- Layer 1: swap UI strings ------------------------------------ */

  function applyUIStrings(root) {
    var scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    scope.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      // format: "placeholder:archive.keywordHint, aria-label:nav.home"
      el.getAttribute("data-i18n-attr").split(",").forEach(function (pair) {
        var bits = pair.split(":");
        if (bits.length === 2) el.setAttribute(bits[0].trim(), t(bits[1].trim()));
      });
    });
  }

  /* ---------- Layer 2: on-device translation of body text ----------------- */

  var BLOCK_TAGS = "p,li,h1,h2,h3,h4,td,th,caption,summary,dt,dd,figcaption,blockquote";

  /** Every leaf block inside (or equal to) an element marked data-translate. */
  function collectBlocks() {
    var blocks = [];
    document.querySelectorAll("[data-translate]").forEach(function (region) {
      if (region.closest("[translate='no'], .no-translate")) return;
      if (region.matches(BLOCK_TAGS)) blocks.push(region);
      region.querySelectorAll(BLOCK_TAGS).forEach(function (b) {
        if (!b.closest("[translate='no'], .no-translate")) blocks.push(b);
      });
    });
    return blocks;
  }

  function collectTextNodes() {
    var nodes = [];
    collectBlocks().forEach(function (block) {
      block.childNodes.forEach(function (n) {
        if (n.nodeType === 3) {
          var text = n.nodeValue;
          if (text && text.trim().length > 0 && /[\u3000-\u9fff\uff00-\uffef]/.test(text)) {
            nodes.push(n);
          }
        }
      });
    });
    return nodes;
  }

  function restoreJapanese() {
    collectBlocks().forEach(function (block) {
      block.childNodes.forEach(function (n) {
        if (n.nodeType === 3 && originals.has(n)) n.nodeValue = originals.get(n);
      });
    });
  }

  function notice(messageKey, busy) {
    var box = document.getElementById("lang-notice");
    if (!box) return;
    if (!messageKey) { box.hidden = true; box.textContent = ""; return; }
    box.hidden = false;
    box.classList.toggle("is-busy", !!busy);
    box.innerHTML = "<p></p>";
    box.firstChild.textContent = t(messageKey);
  }

  async function ensureTranslator() {
    if (translatorState === "ready") return translator;
    if (translatorState === "unavailable") return null;

    var api = self.Translator || (self.translation && self.translation.createTranslator ? self.translation : null);
    if (!api || typeof api.availability !== "function") {
      translatorState = "unavailable";
      return null;
    }
    try {
      var status = await api.availability({ sourceLanguage: "ja", targetLanguage: "en" });
      if (status === "unavailable") { translatorState = "unavailable"; return null; }
      if (status === "downloadable" || status === "downloading") notice("lang.downloading", true);
      translator = await api.create({ sourceLanguage: "ja", targetLanguage: "en" });
      translatorState = "ready";
      return translator;
    } catch (err) {
      translatorState = "unavailable";
      return null;
    }
  }

  var busy = false, pending = false;

  async function translateBody() {
    if (busy) { pending = true; return; }   // a re-render asked mid-run; queue one pass
    busy = true;
    try {
      await runTranslation();
    } finally {
      busy = false;
      if (pending) { pending = false; translateBody(); }
    }
  }

  async function runTranslation() {
    var nodes = collectTextNodes();
    if (!nodes.length) { notice(null); return; }

    var tr = await ensureTranslator();
    if (!tr) { notice("lang.unsupported"); return; }

    notice("lang.translating", true);
    var failed = 0;

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (lang !== "en") { restoreJapanese(); notice(null); return; } // switched back mid-run
      var src = originals.has(node) ? originals.get(node) : node.nodeValue;
      if (!originals.has(node)) originals.set(node, src);

      var key = src.trim();
      if (cache[key]) { node.nodeValue = cache[key]; continue; }

      try {
        var out = await tr.translate(key);
        if (out && out.trim()) {
          cache[key] = out;
          node.nodeValue = out;
        } else {
          failed++;
        }
      } catch (err) {
        failed++;   // leave the Japanese original in place
      }
    }

    notice(failed ? "lang.partial" : "lang.done");
  }

  /* ---------- Public API --------------------------------------------------- */

  function setLang(next, opts) {
    if (next !== "ja" && next !== "en") return;
    lang = next;
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}

    document.documentElement.setAttribute("lang", next);
    document.querySelectorAll("[data-lang-btn]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-lang-btn") === next));
    });

    applyUIStrings();
    listeners.forEach(function (fn) { try { fn(next); } catch (e) { console.error(e); } });

    if (next === "ja") {
      restoreJapanese();
      notice(null);
    } else if (!opts || opts.translateBody !== false) {
      translateBody();
    }
  }

  function initSwitch() {
    document.querySelectorAll("[data-lang-btn]").forEach(function (btn) {
      btn.addEventListener("click", function () { setLang(btn.getAttribute("data-lang-btn")); });
    });
  }

  window.LBI = {
    get lang() { return lang; },
    t: t,
    setLang: setLang,
    applyUIStrings: applyUIStrings,
    /** Re-run body translation, e.g. after JS has injected new Japanese text. */
    refreshTranslation: function () { if (lang === "en") translateBody(); },
    /** Register a callback fired whenever the language changes. */
    onLangChange: function (fn) { listeners.push(fn); },
    statusLabel: function (key) { return t("status." + (key || "unconfirmed")); },
    typeLabel: function (key) { return t("type." + key); }
  };

  document.addEventListener("DOMContentLoaded", function () {
    initSwitch();
    var initial = readInitialLang();
    // Body translation is kicked off by page scripts once their content is rendered.
    setLang(initial, { translateBody: false });
    if (initial === "en") {
      window.setTimeout(function () { LBI.refreshTranslation(); }, 300);
    }
  });
})();
