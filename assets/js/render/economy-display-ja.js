const DISPLAY_REPLACEMENTS = new Map([
  ["MONTHLY+QUARTERLY+ANNUAL", "月次・四半期・年次"],
  ["MONTHLY+ANNUAL+10DAY+20DAY", "月次・年次・旬次"],
  ["MONTHLY+QUARTERLY", "月次・四半期"],
  ["MONTHLY+SURVEY", "月次・調査"],
  ["MONTHLY+ANNUAL", "月次・年次"],
  ["WEEKLY+MONTHLY", "週次・月次"],
  ["MONTHLY", "月次"], ["QUARTERLY", "四半期"], ["ANNUAL", "年次"],
  ["WEEKLY", "週次"], ["DAILY", "日次"],
  ["JPY_trillion", "兆円"], ["JPY_billion", "10億円"], ["JPY_million", "百万円"],
  ["JPY/EUR", "円/ユーロ"], ["JPY/USD", "円/ドル"], ["JPY", "円"],
  ["million TEU", "百万TEU"], ["thousand ton-km", "千トンキロ"], ["ton-km", "トンキロ"],
  ["tonnes", "トン"], ["hours", "時間"], ["index", "指数"], ["pct", "%"],
  ["Drugstore", "ドラッグストア"], ["Beauty", "化粧品"],
  ["YoY", "前年比"], ["MoM", "前月比"], ["QoQ", "前期比"], ["WoW", "前週比"], ["YTD", "年初来"]
]);

const METRIC_NAMES = new Map([
  ["exports_total", "輸出額"], ["imports_total", "輸入額"], ["trade_balance", "貿易収支"],
  ["exports_h1", "上期輸出額"], ["imports_h1", "上期輸入額"],
  ["exports_total_annual", "年間輸出額"], ["imports_total_annual", "年間輸入額"], ["trade_balance_annual", "年間貿易収支"],
  ["inbound_volume", "倉庫入庫量"], ["outbound_volume", "倉庫出庫量"], ["inventory_balance", "倉庫保管残高"],
  ["warehouse_turnover", "倉庫回転率"], ["storage_revenue", "保管料収入"],
  ["japan_total_container", "全国コンテナ取扱量"], ["japan_foreign_trade_container", "外貿コンテナ取扱量"],
  ["japan_domestic_container", "内貿コンテナ取扱量"],
  ["average_duty_time_per_run", "1運行あたり平均拘束時間"], ["waiting_and_handling_per_run", "1運行あたり荷待ち・荷役時間"],
  ["freight_transport_volume", "自動車貨物輸送量"], ["freight_transport_ton_km", "自動車貨物輸送トンキロ"],
  ["international_air_cargo_tonnes", "国際航空貨物量"], ["international_air_cargo_ton_km", "国際航空貨物輸送トンキロ"],
  ["international_weight_load_factor", "国際航空貨物重量利用率"], ["domestic_air_cargo_tonnes", "国内航空貨物量"],
  ["nominal_gdp_fy_level", "名目GDP（年度）"], ["nominal_gdp_fy_growth_pct", "名目GDP成長率（年度）"],
  ["real_gdp_fy_growth_pct", "実質GDP成長率（年度）"], ["real_gdp_fy_level", "実質GDP（年度）"],
  ["real_gdp_qoq_pct", "実質GDP 前期比"], ["nominal_gdp_qoq_pct", "名目GDP 前期比"],
  ["real_gdp_quarterly_level_saar", "実質GDP 年率換算"], ["nominal_gdp_quarterly_level_saar", "名目GDP 年率換算"],
  ["industrial_production", "鉱工業生産指数"], ["manufacturing_shipments", "製造工業出荷指数"],
  ["eur_jpy", "ユーロ円相場"], ["usd_jpy", "ドル円相場"], ["crude_oil_import_cost", "原油輸入価格"],
  ["road_freight", "道路貨物輸送価格指数"], ["ocean_freight", "外航貨物輸送価格指数"],
  ["coastal_freight", "内航貨物輸送価格指数"], ["port_transport", "港湾運送価格指数"],
  ["international_air_freight", "国際航空貨物輸送価格指数"], ["warehouse_service", "倉庫サービス価格指数"],
  ["third_party_logistics", "3PLサービス価格指数"]
]);

function localizeTextNode(node) {
  let text = node.nodeValue;
  const trimmed = text.trim();
  if (METRIC_NAMES.has(trimmed)) text = text.replace(trimmed, METRIC_NAMES.get(trimmed));
  for (const [from, to] of DISPLAY_REPLACEMENTS) text = text.replaceAll(from, to);
  if (text !== node.nodeValue) node.nodeValue = text;
}

function scaledNumber(value, divisor, digits = 2) {
  return (value / divisor).toLocaleString("ja-JP", { maximumFractionDigits: digits });
}

function normalizeValueCell(cell) {
  if (!cell) return;
  const text = cell.textContent.trim();
  let m = text.match(/^([+-]?[\d,.]+)\s+百万TEU$/);
  if (m) { cell.textContent = `${scaledNumber(Number(m[1].replaceAll(",", "")) * 100, 1, 1)} 万TEU`; return; }
  m = text.match(/^([+-]?[\d,.]+)\s+千トンキロ$/);
  if (m) { cell.textContent = `${scaledNumber(Number(m[1].replaceAll(",", "")), 100000, 2)} 億トンキロ`; return; }
  m = text.match(/^([+-]?[\d,.]+)\s+トン$/);
  if (m) {
    const value = Number(m[1].replaceAll(",", ""));
    if (Math.abs(value) >= 10000) cell.textContent = `${scaledNumber(value, 10000, 1)} 万トン`;
  }
}

export function localizeEconomyDisplay() {
  const host = document.getElementById("flow-datasets") || document.getElementById("main");
  if (!host) return;
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(localizeTextNode);
  host.querySelectorAll("table.economy-table tbody tr").forEach((row) => normalizeValueCell(row.children[2]));
}
