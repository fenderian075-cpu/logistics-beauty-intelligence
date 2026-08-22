/* =========================================================================
   labels.js — Japanese display vocabulary.
   -------------------------------------------------------------------------
   LBI is Japanese-only. This module replaces the former translation.js view
   layer: the strings that renderers actually need now live here, in the
   rendering layer, instead of being patched into the DOM after paint.

   Rules:
   - Lens names are plain Japanese (障害 / コスト・キャパ / 定時性 /
     需要・商流 / 規制・構造). No English labels in the UI.
   - Every lookup falls back to the raw value, so an unknown enum coming from
     a future pipeline version renders as itself instead of "undefined".
   ========================================================================= */

const pick = (map, key, fallback) => {
  if (key == null) return fallback != null ? fallback : "—";
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : String(key);
};

export const STATUS = {
  normal: "平常",
  watch: "監視",
  disruption: "障害",
  unconfirmed: "未確認"
};

export const DOMAIN = {
  domestic: "国内配送",
  weather: "気象・災害",
  customs: "通関・NACCS",
  ocean: "海上輸送",
  air: "航空貨物",
  global: "グローバルサプライチェーン"
};

export const LENS = {
  disruption: "障害",
  cost_capacity: "コスト・キャパ",
  reliability: "定時性",
  demand_commerce: "需要・商流",
  regulatory_structural: "規制・構造"
};

export const LENS_STATE = {
  normal: "平常",
  watch: "監視",
  disruption: "障害",
  stable: "安定",
  tightening: "逼迫",
  improving: "改善",
  deteriorating: "悪化",
  rising: "上昇",
  falling: "低下",
  volatile: "変動大",
  major_change: "重大変化",
  unconfirmed: "未確認"
};

export const CHANGE = {
  new: "新規",
  deteriorating: "悪化",
  improving: "改善",
  resolved: "解消",
  unchanged: "変化なし",
  unchanged_high_risk: "高リスク継続"
};

export const DIRECTION = {
  rising: "上昇",
  falling: "低下",
  stable: "横ばい",
  volatile: "不安定",
  unknown: "未確認",
  tightening: "引き締まり",
  loosening: "緩和",
  improving: "改善",
  deteriorating: "悪化",
  mixed: "まちまち"
};

export const ARROW = {
  rising: "↑",
  falling: "↓",
  stable: "→",
  volatile: "⇅",
  tightening: "↑",
  loosening: "↓",
  improving: "↑",
  deteriorating: "↓",
  mixed: "↔",
  unknown: "–"
};

export const IMPACT = { high: "大", medium: "中", low: "小" };
export const CONFIDENCE = { high: "高", medium: "中", low: "低" };
export const RISK = { high: "高", medium: "中", low: "低", unknown: "未確認" };
export const DRIVER = { organic: "自然需要", promotion: "販促", launch: "ローンチ", buzz: "話題化" };
export const DURATION = { temporary: "一時的", persistent: "継続的", unknown: "不明" };
export const REPORT_TYPE = { daily: "日次", weekly: "週次", monthly: "月次" };

/** Evidence provenance collapsed to three visible tiers (see docs §30). */
export const EVIDENCE_TIER = {
  primary_operational: { tier: "primary", label: "一次" },
  official_statistics: { tier: "primary", label: "統計" },
  market_data: { tier: "market", label: "市場データ" },
  corporate_ir: { tier: "market", label: "IR" },
  professional_media: { tier: "media", label: "専門媒体" },
  brand_official: { tier: "media", label: "ブランド公式" },
  commerce_platform: { tier: "media", label: "EC" },
  search_buzz: { tier: "media", label: "検索" }
};

export const statusLabel = (v) => pick(STATUS, v, STATUS.unconfirmed);
export const domainLabel = (v) => pick(DOMAIN, v);
export const lensLabel = (v) => pick(LENS, v);
export const lensStateLabel = (v) => pick(LENS_STATE, v, LENS_STATE.unconfirmed);
export const changeLabel = (v) => pick(CHANGE, v, CHANGE.unchanged);
export const directionLabel = (v) => pick(DIRECTION, v, DIRECTION.unknown);
export const arrow = (v) => pick(ARROW, v, ARROW.unknown);
export const impactLabel = (v) => pick(IMPACT, v, IMPACT.low);
export const confidenceLabel = (v) => pick(CONFIDENCE, v, CONFIDENCE.low);
export const riskLabel = (v) => pick(RISK, v, RISK.unknown);
export const driverLabel = (v) => pick(DRIVER, v);
export const durationLabel = (v) => pick(DURATION, v, DURATION.unknown);
export const typeLabel = (v) => pick(REPORT_TYPE, v);

export function evidenceTier(cls) {
  return EVIDENCE_TIER[cls] || { tier: "media", label: cls ? String(cls) : "出典" };
}

/** Longer UI copy. Kept together so wording stays consistent across pages. */
export const UI = {
  overall: "総合ステータス",
  asOf: "基準時点",
  decisionTitle: "本日の判断",
  execSummary: "概要",
  keyIssues: "主要ポイント",
  statusTitle: "日本物流ステータス",
  whatChanged: "前回からの変化",
  comparedWith: "比較対象",
  noComparison: "前回データなし（初回ベースライン）。比較は次回から表示します。",
  unchanged: "前回からステータスの変化はありません。",
  changedNone: "構造化シグナルの変化は記録されていません。",
  changedMore: (n) => `ほか ${n} 件`,
  lensCount: (n) => `${n} 件`,
  lensEmpty: "該当シグナルなし",
  noIntelligence: "このレポートには構造化シグナルが登録されていません。",
  noReport: "このタイプのレポートはまだありません。",
  loadError: "データを読み込めませんでした。ページを再読み込みするか、ローカルではHTTPサーバー経由で開いてください。",
  loading: "読み込み中…",
  actionRequired: "対応が必要",
  actionRequiredNote: "高影響のシグナルが新規または悪化しています。本文の対応方向を確認してください。",
  actionMonitor: "監視のみ",
  actionMonitorNote: "直ちに運用を変える必要はありませんが、監視対象があります。",
  actionNone: "対応不要",
  actionNoneNote: "通常運用で問題ありません。",
  actionUnknown: "判定不能（未確認）",
  actionUnknownNote: "確認できていない領域があります。判断の前に一次情報を確認してください。",
  readReport: (type) => `${pick(REPORT_TYPE, type)}を読む`,
  signalsTitle: "主要指標",
  sigEvidence: "根拠",
  sigHistory: "この signal の推移",
  sigHistoryNone: "過去の観測はまだありません。",
  sigHistoryThin: "観測が1件のみのため、推移グラフは表示していません。",
  sigHistoryChart: "影響度と変化ステータスの推移",
  sigImplication: "業務影響",
  sigAction: "対応方向",
  sigNoDetail: "詳細情報は登録されていません。",
  sigDate: "日付",
  sigChange: "変化",
  sigDirection: "方向",
  sigConfidence: "確度",
  sigImpact: "影響度",
  sigDemandDriver: "需要要因",
  sigDuration: "持続性",
  archiveEmpty: "条件に一致するレポートはありません。条件を減らしてお試しください。",
  archiveCount: (n) => `${n} 件`,
  archiveLegacy: "構造化シグナルなし",
  reportPrev: "← 前のレポート",
  reportNext: "次のレポート →",
  reportOldest: "これが最初です",
  reportNewest: "これが最新です",
  reportArchive: "過去のレポート",
  showMore: (n) => `さらに ${n} 件を表示`,
  typeQuestion: {
    daily: "今日、業務を変える必要があるか",
    weekly: "来週〜数週間の判断材料",
    monthly: "何の前提が変わったか"
  },
  typeDesc: {
    daily: "国内配送・気象・通関・NACCS・重大な輸送障害などの例外管理。",
    weekly: "運賃・キャパシティ・定時性・港湾・航空・Beauty需要・EC施策などを分析。",
    monthly: "物流構造・規制・市況・技術成熟度・Beauty需要構造を中期分析。"
  }
};
