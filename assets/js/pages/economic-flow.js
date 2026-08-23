/* =========================================================================
   economic-flow.js — 実体経済と物流
   -------------------------------------------------------------------------
   Charts first, tables as drill-downs. A series with one observation is shown
   as a value, never as a line; tables remain reachable behind disclosures.
   ========================================================================= */

import { el, byId, clear } from "../core/dom.js";
import { loadEconomyOverview, loadEconomyBundle, loadReports, loadCriticalNews } from "../data/store.js";
import { bindLatestReportNav, markCurrent } from "../core/nav.js";
import { mountShell } from "../core/shell.js";
import { formatObservation, formatPct, formatPeriod, frequencyLabel, metricName, UNKNOWN } from "../core/units.js";
import { chart } from "../render/chart.js";
import { findSeries, latest, observations, yoyOf, changeKind, pointsOf, unitLabelOf, kpiCard, oceanFreightCard, collectorNote, sourceLink, seriesOf } from "../render/economy.js";

function block(id, eyebrow, title, note) {
  const section = el("section", "flow-block"); section.id = id;
  const head = el("div", "section__head"), box = el("div");
  if (eyebrow) box.appendChild(el("p", "eyebrow", eyebrow));
  const h2 = el("h2", "section__title", title); h2.id = `${id}-title`; box.appendChild(h2); head.appendChild(box); section.appendChild(head);
  section.setAttribute("aria-labelledby", h2.id); if (note) section.appendChild(el("p", "flow-block__note", note)); return section;
}

function chartOrValues(spec, seriesList) {
  const drawn = chart(spec); if (drawn) return drawn;
  const grid = el("div", "value-row");
  seriesList.forEach((s) => { const obs = latest(s), formatted = obs ? formatObservation(s.unit, obs.value) : null, item = el("div", "value-row__item");
    item.appendChild(el("span", "value-row__label", metricName(s))); item.appendChild(el("strong", "value-row__value", formatted ? formatted.text : UNKNOWN));
    const change = yoyOf(obs), meta = []; if (obs) meta.push(formatPeriod(obs.period)); if (change != null) meta.push(`${changeKind(obs)} ${formatPct(change)}`);
    item.appendChild(el("span", "value-row__meta", meta.join(" · ") || "取得待ち")); grid.appendChild(item); });
  const wrap = el("div"); wrap.appendChild(grid); wrap.appendChild(el("p", "chart-absent", "観測が1時点のため推移グラフは作成していません。系列が2時点以上になると自動的にグラフになります。")); return wrap;
}

function datasetTable(dataset) {
  const list = seriesOf(dataset);
  const rows = list.length ? list.map((s) => { const obs = latest(s); return { name: metricName(s), period: obs ? formatPeriod(obs.period) : "—", value: obs ? formatObservation(s.unit, obs.value).text : UNKNOWN, yoy: formatPct(yoyOf(obs)), mom: obs && obs.mom != null ? formatPct(obs.mom) : "—", count: observations(s).length }; })
    : (dataset.observations || []).map((obs) => ({ name: obs.metric || "—", period: formatPeriod(obs.period), value: obs.value != null ? formatObservation(obs.unit, obs.value).text : UNKNOWN, yoy: formatPct(obs.yoy), mom: obs.status || "—", count: 1 }));
  if (!rows.length) return null;
  const details = el("details", "flow-table"); details.appendChild(el("summary", "flow-table__toggle", `全系列（${rows.length}）と観測数を表示`));
  const wrap = el("div", "table-scroll"), table = el("table", "data-table economy-table"), thead = el("thead"), hr = el("tr");
  ["指標", "期間", "値", "前年比", "前月比 / 区分", "観測数"].forEach((label) => { const th = el("th", null, label); th.setAttribute("scope", "col"); hr.appendChild(th); });
  thead.appendChild(hr); table.appendChild(thead); const tbody = el("tbody");
  rows.forEach((row) => { const tr = el("tr"); [row.name, row.period, row.value, row.yoy, row.mom, String(row.count)].forEach((cell, i) => tr.appendChild(el("td", i === 5 ? "num" : null, cell))); tbody.appendChild(tr); });
  table.appendChild(tbody); wrap.appendChild(table); details.appendChild(wrap); return details;
}

function kpiStrip(bundle) {
  const strip = el("div", "kpi-strip"), macro = bundle.macro;
  strip.appendChild(kpiCard({ label:"名目GDP（年度）", domain:"macro", series:findSeries(macro,"nominal_gdp_fy_level"), note:"内閣府 国民経済計算" }));
  strip.appendChild(kpiCard({ label:"実質GDP成長率（年度）", domain:"macro", series:findSeries(macro,"real_gdp_fy_growth_pct"), note:"価格変動を除いた活動量" }));
  strip.appendChild(kpiCard({ label:"輸出額（月次）", domain:"logistics", series:findSeries(bundle.trade,"exports_total"), note:"財務省 貿易統計" }));
  strip.appendChild(kpiCard({ label:"港湾コンテナ取扱量", domain:"logistics", series:findSeries(bundle.port,"japan_total_container"), note:"全国・年次" }));
  strip.appendChild(kpiCard({ label:"軽油 全国平均", domain:"cost", invert:true, series:findSeries(bundle.fuel,"diesel_national"), note:"国内輸送コストの起点" }));
  strip.appendChild(oceanFreightCard(bundle.ocean, macro)); return strip;
}

function demandBlock(bundle) {
  const section = block("demand", "需要", "化粧品需要（名目）", "百貨店とドラッグストアの化粧品売上。名目値であり、価格上昇分を含みます。"), dept = findSeries(bundle.beauty,"department_store_cosmetics_sales"), drug = findSeries(bundle.beauty,"drugstore_beauty_sales");
  section.appendChild(chartOrValues({ kind:"line", unitLabel:"億円", series:[dept,drug].filter(Boolean).map(s=>({name:metricName(s),unitLabel:unitLabelOf(s),points:pointsOf(s)})), note:"百貨店は月次、ドラッグストアは年次" }, [dept,drug].filter(Boolean)));
  const cpi = ((bundle.decomposition||{}).beauty_cpi||{}).annual||[]; if(cpi.length){const last=cpi[cpi.length-1]; section.appendChild(el("p","flow-block__reading",`価格側: CPI化粧品 ${formatPeriod(last.period)} ${formatPct(last.yoy_pct)}。名目の伸びからこの分を差し引いた残りが実質の動きです。`));}
  const table=datasetTable(bundle.beauty); if(table)section.appendChild(table); const src=sourceLink(bundle.beauty); if(src)section.appendChild(src); return section;
}

function tradeBlock(bundle) {
  const section=block("trade","貿易","輸出入と貿易収支","輸出入は同じ軸で比較し、収支は別グラフにします（水準と差額を同一軸に載せないため）。"), exports=findSeries(bundle.trade,"exports_total_annual"), imports=findSeries(bundle.trade,"imports_total_annual");
  section.appendChild(chartOrValues({kind:"line",unitLabel:"兆円",series:[exports,imports].filter(Boolean).map(s=>({name:metricName(s),unitLabel:unitLabelOf(s),points:pointsOf(s)})),note:"年次・確報"},[exports,imports].filter(Boolean)));
  const balance=findSeries(bundle.trade,"trade_balance_annual"); if(balance&&observations(balance).length>=2){const bar=chart({kind:"bar",unitLabel:"兆円",series:[{name:metricName(balance),unitLabel:unitLabelOf(balance),points:pointsOf(balance)}],note:"赤字は0を下回ります"});if(bar)section.appendChild(bar);}
  const monthly=["exports_total","imports_total","trade_balance"].map(id=>findSeries(bundle.trade,id)).filter(Boolean); if(monthly.length){const row=el("div","value-row"); monthly.forEach(s=>{const obs=latest(s),item=el("div","value-row__item");item.appendChild(el("span","value-row__label",`${metricName(s)}（月次）`));item.appendChild(el("strong","value-row__value",obs?formatObservation(s.unit,obs.value).text:UNKNOWN));item.appendChild(el("span","value-row__meta",obs?`${formatPeriod(obs.period)} · ${changeKind(obs)||"前年比"} ${formatPct(yoyOf(obs))}`:"取得待ち"));row.appendChild(item);});section.appendChild(row);}
  const table=datasetTable(bundle.trade);if(table)section.appendChild(table);const src=sourceLink(bundle.trade);if(src)section.appendChild(src);return section;
}

function volumeBlock(bundle) {
  const section=block("volume","物量","港湾・航空の実物貨物","金額ではなく物量。運ぶ量が増えているのか、単価が上がっているだけなのかを分けて見ます。"),port=["japan_total_container","japan_foreign_trade_container","japan_domestic_container"].map(id=>findSeries(bundle.port,id)).filter(Boolean);
  section.appendChild(chartOrValues({kind:"bar",unitLabel:"万TEU",series:port.map(s=>({name:metricName(s),unitLabel:unitLabelOf(s),points:pointsOf(s)}))},port));
  const air=["international_air_cargo_tonnes","domestic_air_cargo_tonnes","international_air_cargo_ton_km"].map(id=>findSeries(bundle.air,id)).filter(Boolean);if(air.length){section.appendChild(el("h3","flow-block__sub","航空貨物"));section.appendChild(chartOrValues({kind:"line",unitLabel:"万トン",series:air.filter(s=>s.unit==="tonnes").map(s=>({name:metricName(s),unitLabel:unitLabelOf(s),points:pointsOf(s)}))},air));}
  [bundle.port,bundle.air,bundle.warehouse,bundle.trucking].forEach(dataset=>{const table=datasetTable(dataset);if(table){const wrap=el("div","flow-block__table");wrap.appendChild(el("p","flow-block__table-label",`${dataset.title_ja||dataset.dataset}（${frequencyLabel(dataset.frequency)}）`));wrap.appendChild(table);section.appendChild(wrap);}});return section;
}

function costBlock(bundle) {
  const section=block("cost","コスト","燃料・海上運賃・国内物流価格","軽油は国内輸送コストの起点、海上運賃は輸入コストの起点です。両者は別の市場なので、同じ軸には載せません。"),fuel=["regular_gasoline_national","diesel_national"].map(id=>findSeries(bundle.fuel,id)).filter(Boolean);
  section.appendChild(el("h3","flow-block__sub","国内燃料価格（円/L）"));section.appendChild(chartOrValues({kind:"line",unitLabel:"円/L",series:fuel.map(s=>({name:metricName(s),unitLabel:unitLabelOf(s),points:pointsOf(s)})),note:"資源エネルギー庁 給油所小売価格調査"},fuel));
  const kerosene=findSeries(bundle.fuel,"kerosene_national");if(kerosene){const obs=latest(kerosene);section.appendChild(el("p","flow-block__reading",`灯油（店頭）: ${obs?formatObservation(kerosene.unit,obs.value).text:UNKNOWN}（${obs?formatPeriod(obs.period):"—"}）`));}const fuelStatus=collectorNote(bundle.fuel);if(fuelStatus)section.appendChild(fuelStatus);
  section.appendChild(el("h3","flow-block__sub","海上運賃（ドル建て原値）"));const ocean=["drewry_wci","drewry_iaci"].map(id=>findSeries(bundle.ocean,id)).filter(Boolean);section.appendChild(chartOrValues({kind:"line",unitLabel:"ドル/40ft",series:ocean.map(s=>({name:metricName(s),unitLabel:unitLabelOf(s),points:pointsOf(s)})),note:"指数の原値はドル建てのまま保持します"},ocean));
  section.appendChild(el("h3","flow-block__sub","国内物流サービス価格（指数）"));const cost=seriesOf(bundle.cost);section.appendChild(chartOrValues({kind:"line",unitLabel:"指数",series:cost.map(s=>({name:metricName(s),unitLabel:unitLabelOf(s),points:pointsOf(s)}))},cost));
  [bundle.fuel,bundle.ocean,bundle.cost].forEach(dataset=>{const table=datasetTable(dataset);if(table)section.appendChild(table);});return section;
}

function macroBlock(bundle) {
  const section=block("macro","マクロ","GDP・物価・為替","物流の需要側の前提。名目GDPと実質GDPは別の系列として扱います。"),gdp=["nominal_gdp_fy_level"].map(id=>findSeries(bundle.macro,id)).filter(Boolean);section.appendChild(chartOrValues({kind:"line",unitLabel:"兆円",series:gdp.map(s=>({name:metricName(s),unitLabel:unitLabelOf(s),points:pointsOf(s)})),note:"年度・内閣府"},gdp));
  const growth=["nominal_gdp_fy_growth_pct","real_gdp_fy_growth_pct"].map(id=>findSeries(bundle.macro,id)).filter(Boolean),growthChart=chart({kind:"bar",unitLabel:"%",series:growth.map(s=>({name:metricName(s),unitLabel:"%",points:pointsOf(s)})),note:"名目と実質の差が価格要因"});if(growthChart)section.appendChild(growthChart);
  const fx=["usd_jpy","eur_jpy"].map(id=>findSeries(bundle.macro,id)).filter(Boolean);if(fx.length){section.appendChild(el("h3","flow-block__sub","為替"));section.appendChild(chartOrValues({kind:"line",unitLabel:"円/ドル",series:fx.filter(s=>s.metric_id==="usd_jpy").map(s=>({name:metricName(s),unitLabel:unitLabelOf(s),points:pointsOf(s)}))},fx));}
  const cpi=seriesOf(bundle.prices).filter(s=>/^cpi_/.test(s.metric_id)).slice(0,4);if(cpi.length){section.appendChild(el("h3","flow-block__sub","消費者物価（2020年=100）"));section.appendChild(chartOrValues({kind:"line",unitLabel:"2020年=100",series:cpi.map(s=>({name:metricName(s),unitLabel:"2020年=100",points:pointsOf(s)}))},cpi));}
  [bundle.macro,bundle.prices].forEach(dataset=>{const table=datasetTable(dataset);if(table)section.appendChild(table);});return section;
}

function decompositionBlock(bundle) {
  const data=bundle.decomposition;if(!data||!data.beauty_cpi)return null;const section=block("deflator-decomposition","名目 → 価格 → 実質","名目・価格・実質の分解","同一期間・同一比較基準が揃う場合だけ実質化します。化粧品はCPI化粧品を価格代理指標として使い、SNA実質付加価値とは区別します。"),proxy=(data.beauty_real_proxy&&data.beauty_real_proxy.observations)||[],annual=data.beauty_cpi.annual||[],cpiLatest=annual.length?annual[annual.length-1]:null,dept=proxy.find(r=>r.channel==="department_store_cosmetics"),drug=proxy.find(r=>r.channel==="drugstore_beauty"),grid=el("div","decomp-grid");
  [["化粧品価格",cpiLatest?`CPI化粧品 ${formatPeriod(cpiLatest.period)} ${formatPct(cpiLatest.yoy_pct)}`:UNKNOWN,"2015-2025年の年平均接続系列を基準系列化。"],["百貨店化粧品",dept?`名目 ${formatPct(dept.nominal_growth_pct)} → 実質推計 ${formatPct(dept.real_growth_proxy_pct)}`:UNKNOWN,dept?`価格寄与 ${formatPct(dept.price_growth_pct)}。店舗数調整後の前年比を使用。`:""],["ドラッグストア化粧品",drug?`名目 ${formatPct(drug.nominal_growth_pct)} → 実質推計 ${formatPct(drug.real_growth_proxy_pct)}`:UNKNOWN,drug?`価格寄与 ${formatPct(drug.price_growth_pct)}。商業動態統計の年次前年比を使用。`:""]].forEach(([label,headline,detail])=>{const card=el("article","decomp-card");card.appendChild(el("p","eyebrow",label));card.appendChild(el("strong","decomp-card__headline",headline));if(detail)card.appendChild(el("p","decomp-card__detail",detail));grid.appendChild(card);});section.appendChild(grid);return section;
}

function industryBlock(bundle) {
  const data=bundle.industry;if(!data||!Array.isArray(data.industries))return null;const section=block("industry-comparison","名目 × 実質 × 価格","全産業比較","2024年名目成長は年次、直近実質成長は四半期です。期間が異なるため差し引きはせず、方向とレジームを比較します。"),wrap=el("div","table-scroll"),table=el("table","data-table economy-table"),thead=el("thead"),hr=el("tr");["産業","名目GDP構成比 2024","名目前年比 2024","実質前期比 直近","価格指標","読み方"].forEach(label=>{const th=el("th",null,label);th.setAttribute("scope","col");hr.appendChild(th);});thead.appendChild(hr);table.appendChild(thead);const tbody=el("tbody");data.industries.slice().sort((a,b)=>Number((b.nominal_share_pct||{})["2024"]||0)-Number((a.nominal_share_pct||{})["2024"]||0)).forEach(industry=>{const priceObs=industry.price_metric_id?latest(findSeries(bundle.prices,industry.price_metric_id)):null,tr=el("tr");if(industry.id==="transport_postal")tr.setAttribute("data-highlight","logistics");tr.appendChild(el("td",null,industry.name_ja||industry.id));tr.appendChild(el("td",null,formatPct((industry.nominal_share_pct||{})["2024"],{sign:false})));tr.appendChild(el("td",null,formatPct(industry.nominal_yoy_2024_pct)));tr.appendChild(el("td",null,formatPct(industry.latest_real_qoq&&industry.latest_real_qoq.value)));tr.appendChild(el("td",null,priceObs?`${formatPeriod(priceObs.period)} 前年比 ${formatPct(priceObs.yoy)}`:"SNAデフレーター未取込"));tr.appendChild(el("td",null,industry.assessment_ja||industry.reading_ja||"—"));tbody.appendChild(tr);});table.appendChild(tbody);wrap.appendChild(table);section.appendChild(wrap);section.appendChild(el("p","source-note","出典: 内閣府 国民経済計算 / 総務省 消費者物価指数 / 日本銀行 企業向けサービス価格指数 / 日本百貨店協会 / 経済産業省。"));return section;
}

function renderOverview(overview){const host=byId("flow-overview");if(!host)return;clear(host);(overview.cards||[]).forEach(card=>{const box=el("article","kpi-card kpi-card--static");box.id=card.id;box.setAttribute("data-direction",card.direction||"unknown");const head=el("div","kpi-card__head");head.appendChild(el("span","kpi-card__label",card.label));if(card.period)head.appendChild(el("span","kpi-card__period",card.period));box.appendChild(head);box.appendChild(el("strong","kpi-card__value",card.value||card.headline||UNKNOWN));if(card.headline&&card.value)box.appendChild(el("p","kpi-card__note",card.headline));if(card.detail)box.appendChild(el("p","kpi-card__note",card.detail));host.appendChild(box);});}
function renderChain(overview){const host=byId("flow-chain");if(!host)return;clear(host);const nodes=overview.transmission_chain||[];nodes.forEach((item,index)=>{host.appendChild(el("span","transmission-node",item));if(index<nodes.length-1)host.appendChild(el("span","transmission-arrow","→"));});}
export async function init(){const[overview,bundle,reports,news]=await Promise.all([loadEconomyOverview(),loadEconomyBundle(),loadReports(),loadCriticalNews()]);mountShell({reports:reports.reports,news:(news&&news.items)||[]});bindLatestReportNav(reports.reports);markCurrent();const strip=byId("flow-kpi");if(strip){clear(strip);strip.appendChild(kpiStrip(bundle));}renderOverview(overview);renderChain(overview);const host=byId("flow-datasets");if(!host)return;clear(host);[tradeBlock(bundle),volumeBlock(bundle),costBlock(bundle),macroBlock(bundle),decompositionBlock(bundle),industryBlock(bundle)].filter(Boolean).forEach(section=>host.appendChild(section));}
