import { el, byId, clear } from "../core/dom.js";
import { loadEconomyOverview, loadEconomyBundle, loadReports, loadCriticalNews } from "../data/store.js";
import { bindLatestReportNav, markCurrent } from "../core/nav.js";
import { mountShell } from "../core/shell.js";

function formatValue(obs) {
  if (!obs) return "未確認";
  if (obs.display) return obs.display;
  const value = obs.value;
  if (value == null) return "未確認";
  return typeof value === "number" ? value.toLocaleString("ja-JP") : String(value);
}
function pct(value) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const n = Number(value); return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}
function latest(series) { const list = (series && series.observations) || []; return list.length ? list[list.length - 1] : null; }
function findSeries(data, id) { return ((data && data.series) || []).find((s) => s.metric_id === id) || null; }

function renderDataset(host, data) {
  if (!data || !data.dataset) return;
  const section = el("section", "flow-dataset"); section.id = data.dataset;
  const head = el("div", "section__head"); const title = el("div");
  title.appendChild(el("p", "eyebrow", (data.frequency || "dataset").toUpperCase()));
  title.appendChild(el("h2", "section__title", data.title_ja || data.dataset)); head.appendChild(title); section.appendChild(head);
  const series = data.series || [];
  if (!series.length && !(data.observations || []).length) section.appendChild(el("p", "empty-state", "系列定義のみ。観測値を蓄積中です。"));
  else if (series.length) {
    const wrap = el("div", "table-scroll"), table = el("table", "data-table economy-table"), thead = el("thead"), trh = el("tr");
    ["指標", "期間", "値", "前年比", "前月比"].forEach((label) => trh.appendChild(el("th", null, label))); thead.appendChild(trh); table.appendChild(thead);
    const tbody = el("tbody");
    series.forEach((s) => {
      const obs = latest(s), yoy = obs && (obs.yoy ?? obs.yoy_pct ?? obs.yoy_store_adjusted_pct), tr = el("tr");
      tr.appendChild(el("td", null, s.name_ja || s.metric_id)); tr.appendChild(el("td", null, obs ? (obs.period || "—") : "—"));
      tr.appendChild(el("td", null, `${formatValue(obs)}${obs && s.unit ? ` ${s.unit}` : ""}`)); tr.appendChild(el("td", null, pct(yoy)));
      tr.appendChild(el("td", null, obs && obs.mom != null ? pct(obs.mom) : "—")); tbody.appendChild(tr);
    });
    table.appendChild(tbody); wrap.appendChild(table); section.appendChild(wrap);
  } else {
    const wrap = el("div", "table-scroll"), table = el("table", "data-table economy-table"), thead = el("thead"), trh = el("tr");
    ["指標", "期間", "値", "前年比", "区分"].forEach((label) => trh.appendChild(el("th", null, label))); thead.appendChild(trh); table.appendChild(thead);
    const tbody = el("tbody");
    (data.observations || []).forEach((obs) => {
      const tr = el("tr"); tr.appendChild(el("td", null, obs.metric || "—")); tr.appendChild(el("td", null, obs.period || "—"));
      tr.appendChild(el("td", null, obs.value != null ? `${Number(obs.value).toLocaleString("ja-JP")} ${obs.unit || ""}` : "—"));
      tr.appendChild(el("td", null, obs.yoy != null ? pct(obs.yoy) : "—")); tr.appendChild(el("td", null, obs.status || "—")); tbody.appendChild(tr);
    }); table.appendChild(tbody); wrap.appendChild(table); section.appendChild(wrap);
  }
  const source = data.source || ((data.sources || [])[0]);
  if (source && source.url) { const p = el("p", "source-note", "出典: "), a = el("a", null, source.name || "一次情報"); a.href = source.url; a.target = "_blank"; a.rel = "noopener noreferrer"; p.appendChild(a); section.appendChild(p); }
  host.appendChild(section);
}

function beautyProxy(bundle) {
  const dept = latest(findSeries(bundle.beauty, "department_store_cosmetics_sales"));
  const drug = latest(findSeries(bundle.beauty, "drugstore_beauty_sales"));
  const cosmeticsCpi = latest(findSeries(bundle.prices, "cpi_cosmetics"));
  return { dept, drug, cosmeticsCpi,
    nominalText: dept ? `百貨店化粧品 ${dept.period} ${pct(dept.yoy_store_adjusted_pct)}` : drug ? `ドラッグストアBeauty ${drug.period} ${pct(drug.yoy_pct)}` : "未確認",
    secondaryText: drug ? `ドラッグストアBeauty ${drug.period} ${pct(drug.yoy_pct)}` : "—",
    realText: cosmeticsCpi ? "化粧品CPIで実質化可能" : "化粧品CPI未投入のため実質未算出" };
}
function priceForIndustry(bundle, industry) { return industry.price_metric_id ? latest(findSeries(bundle.prices, industry.price_metric_id)) : null; }
function assessment(industry, priceObs) {
  const real = industry.latest_real_qoq && Number(industry.latest_real_qoq.value), nominal = Number(industry.nominal_yoy_2024_pct);
  if (!Number.isFinite(real)) return "実質未確認";
  if (industry.id === "transport_postal" && priceObs && Number(priceObs.yoy) > 0) return real > 0 ? "名目・実質ともプラス、価格上昇も継続" : "価格上昇下で実質活動は減少";
  if (Number.isFinite(nominal) && nominal > 3 && real < 0) return "名目は強いが直近実質は弱い";
  if (Number.isFinite(nominal) && nominal < 0 && real > 0) return "2024名目は弱いが直近実質は改善";
  if (real >= 2) return "直近実質活動が強い";
  if (real > 0) return "直近実質活動は緩やかに増加";
  if (real <= -2) return "直近実質活動が弱い";
  if (real < 0) return "直近実質活動は小幅減少";
  return "直近実質横ばい";
}

function renderIndustryComparison(host, bundle) {
  const data = bundle.industry; if (!data || !Array.isArray(data.industries)) return;
  const section = el("section", "flow-dataset industry-comparison"); section.id = "industry-comparison";
  const head = el("div", "section__head"), title = el("div"); title.appendChild(el("p", "eyebrow", "NOMINAL × REAL × PRICE"));
  title.appendChild(el("h2", "section__title", "全産業比較：名目・実質・価格"));
  title.appendChild(el("p", "regime-note", "2024年名目成長は年次、2026Q1実質成長は直近四半期です。期間が違うため差し引きはせず、方向とレジームを比較します。"));
  head.appendChild(title); section.appendChild(head);

  const beauty = beautyProxy(bundle), notes = el("div", "economy-grid"), logistics = data.industries.find((i) => i.id === "transport_postal"), logisticsPrice = logistics ? priceForIndustry(bundle, logistics) : null;
  [["物流", logistics ? `名目2024 ${pct(logistics.nominal_yoy_2024_pct)} / 実質2026Q1 ${pct(logistics.latest_real_qoq && logistics.latest_real_qoq.value)}` : "未確認", logisticsPrice ? `運輸・郵便SPPI ${logisticsPrice.period} ${pct(logisticsPrice.yoy)}。売上/付加価値の増加と価格上昇を分離。` : "価格系列未確認"],
   ["Beauty", beauty.nominalText, `${beauty.secondaryText} / ${beauty.realText}`],
   ["比較ルール", "名目 ≠ 実質 ≠ 価格", "BeautyはSNA単独産業ではないため、小売・出荷を需要proxyとして表示。化粧品CPI取得後に同一期間の実質proxyを算出。"]
  ].forEach(([label, headline, detail]) => { const card = el("article", "economy-card economy-card--static"); card.appendChild(el("p", "eyebrow", label)); card.appendChild(el("strong", "economy-card__headline", headline)); card.appendChild(el("p", "economy-card__detail", detail)); notes.appendChild(card); });
  section.appendChild(notes);

  const wrap = el("div", "table-scroll"), table = el("table", "data-table economy-table"), thead = el("thead"), trh = el("tr");
  ["産業", "名目GDP構成比 2024", "名目YoY 2024", "実質QoQ 2026Q1", "価格シグナル", "読み方"].forEach((label) => trh.appendChild(el("th", null, label))); thead.appendChild(trh); table.appendChild(thead);
  const tbody = el("tbody");
  data.industries.slice().sort((a,b) => Number((b.nominal_share_pct||{})["2024"]||0)-Number((a.nominal_share_pct||{})["2024"]||0)).forEach((industry) => {
    const priceObs = priceForIndustry(bundle, industry), tr = el("tr"); if (industry.id === "transport_postal") tr.setAttribute("data-highlight", "logistics");
    tr.appendChild(el("td", null, industry.name_ja || industry.id)); tr.appendChild(el("td", null, pct((industry.nominal_share_pct || {})["2024"])));
    tr.appendChild(el("td", null, pct(industry.nominal_yoy_2024_pct))); tr.appendChild(el("td", null, pct(industry.latest_real_qoq && industry.latest_real_qoq.value)));
    tr.appendChild(el("td", null, priceObs ? `${priceObs.period} YoY ${pct(priceObs.yoy)}` : "—")); tr.appendChild(el("td", null, assessment(industry, priceObs))); tbody.appendChild(tr);
  });
  const beautyRow = el("tr"); beautyRow.setAttribute("data-highlight", "beauty"); beautyRow.appendChild(el("td", null, "Beauty需要 proxy")); beautyRow.appendChild(el("td", null, "SNA単独産業ではない"));
  beautyRow.appendChild(el("td", null, beauty.nominalText)); beautyRow.appendChild(el("td", null, beauty.realText)); beautyRow.appendChild(el("td", null, beauty.cosmeticsCpi ? `${beauty.cosmeticsCpi.period} ${formatValue(beauty.cosmeticsCpi)}` : "化粧品CPI 収集中"));
  beautyRow.appendChild(el("td", null, beauty.secondaryText)); tbody.appendChild(beautyRow);
  table.appendChild(tbody); wrap.appendChild(table); section.appendChild(wrap);
  section.appendChild(el("p", "source-note", "出典: 内閣府 国民経済計算 / 総務省 CPI / 日本銀行 SPPI / 日本百貨店協会 / 経済産業省。名目年次と実質四半期は期間が異なるため、機械的な差分をインフレ率とはみなしません。")); host.appendChild(section);
}

function renderOverview(data) { const host = byId("flow-overview"); if (!host) return; clear(host); (data.cards || []).forEach((card) => { const box = el("article", "economy-card economy-card--static"); box.id = card.id; box.setAttribute("data-direction", card.direction || "unknown"); box.appendChild(el("p", "eyebrow", card.label)); box.appendChild(el("strong", "economy-card__headline", card.headline)); box.appendChild(el("p", "economy-card__value", card.value)); box.appendChild(el("p", "economy-card__meta", card.period || "—")); box.appendChild(el("p", "economy-card__detail", card.detail || "")); host.appendChild(box); }); }
function renderChain(data) { const host = byId("flow-chain"); if (!host) return; clear(host); (data.transmission_chain || []).forEach((item,index,list) => { host.appendChild(el("span", "transmission-node", item)); if (index < list.length-1) host.appendChild(el("span", "transmission-arrow", "→")); }); }

export async function init() {
  const [overview, bundle, reports, news] = await Promise.all([loadEconomyOverview(), loadEconomyBundle(), loadReports(), loadCriticalNews()]);
  mountShell({ reports: reports.reports, news: (news && news.items) || [] }); bindLatestReportNav(reports.reports); markCurrent(); renderOverview(overview); renderChain(overview);
  const host = byId("flow-datasets"); if (host) { clear(host); renderIndustryComparison(host, bundle); [bundle.prices, bundle.trade, bundle.warehouse, bundle.port, bundle.cost, bundle.trucking, bundle.air, bundle.beauty, bundle.beautyMarket, bundle.macro].forEach((dataset) => renderDataset(host, dataset)); }
}
