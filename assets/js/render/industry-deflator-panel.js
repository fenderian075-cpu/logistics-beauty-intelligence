import { el } from "../core/dom.js";
import { loadIndustryDeflators } from "../data/store.js";

function pct(value) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const n = Number(value);
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function latestObservation(row) {
  const list = (row && row.observations) || [];
  return list.length ? list[list.length - 1] : null;
}

function assessment(obs) {
  if (!obs) return "未確認";
  const real = Number(obs.real_yoy_pct);
  const price = Number(obs.deflator_yoy_pct);
  const nominal = Number(obs.nominal_yoy_pct);
  if (![real, price, nominal].every(Number.isFinite)) return "未確認";
  if (real > 2 && price > 2) return "実質拡大＋価格上昇";
  if (real > 2 && price <= 2) return "実質主導の拡大";
  if (real <= 0 && price > 2 && nominal > 0) return "価格主導、実質弱含み";
  if (real < -2) return "実質縮小";
  if (real > 0) return "実質は緩やかに拡大";
  return "実質横ばい圏";
}

function hydrateIndustryComparison(data) {
  const section = document.getElementById("industry-comparison");
  if (!section) return;
  const byName = new Map((data.industries || []).map((row) => [row.name_ja || row.id, row]));
  section.querySelectorAll("tbody tr").forEach((tr) => {
    const cells = tr.querySelectorAll("td");
    if (cells.length < 5) return;
    const industry = byName.get(cells[0].textContent.trim());
    const obs = latestObservation(industry);
    if (!obs) return;
    cells[4].textContent = `${obs.period} GDPデフレーター ${Number(obs.deflator_index_2020_100).toFixed(1)} / 前年比 ${pct(obs.deflator_yoy_pct)}`;
    cells[4].setAttribute("data-sna-deflator", industry.id);
  });
}

export async function mountIndustryDeflatorPanel() {
  const data = await loadIndustryDeflators();
  if (!data || !Array.isArray(data.industries) || !data.industries.length) return;

  // The compact all-industry table is rendered by economic-flow.js. Hydrate its
  // price column from the canonical SNA deflator dataset so every SNA industry
  // displays the actual GDP deflator instead of a prices.json placeholder.
  hydrateIndustryComparison(data);

  const host = document.getElementById("flow-datasets");
  if (!host || document.getElementById("industry-deflator-panel")) return;

  const rows = data.industries.map((row) => ({ ...row, latest: latestObservation(row) })).filter((row) => row.latest);
  if (!rows.length) return;
  const latestYear = rows.map((r) => Number(r.latest.period)).filter(Number.isFinite).sort((a,b) => b-a)[0];
  const sameYear = rows.filter((r) => Number(r.latest.period) === latestYear);

  const section = el("section", "flow-dataset industry-comparison");
  section.id = "industry-deflator-panel";
  const head = el("div", "section__head");
  const title = el("div");
  title.appendChild(el("p", "eyebrow", "同期間分解"));
  title.appendChild(el("h2", "section__title", `産業別 名目 → 価格 → 実質（${latestYear}年）`));
  title.appendChild(el("p", "regime-note", "同じ暦年・同じSNA年次推計の名目GDP、実質GDP、GDPデフレーターを使用。CPI/SPPIは代用しません。"));
  head.appendChild(title);
  section.appendChild(head);

  const logistics = sameYear.find((r) => r.id === "transport_postal");
  if (logistics) {
    const cards = el("div", "economy-grid");
    const card = el("article", "economy-card economy-card--static");
    card.appendChild(el("p", "eyebrow", "物流 / 運輸・郵便"));
    card.appendChild(el("strong", "economy-card__headline", `名目 ${pct(logistics.latest.nominal_yoy_pct)} → 価格 ${pct(logistics.latest.deflator_yoy_pct)} → 実質 ${pct(logistics.latest.real_yoy_pct)}`));
    card.appendChild(el("p", "economy-card__detail", assessment(logistics.latest)));
    cards.appendChild(card);

    const strongest = sameYear.slice().sort((a,b) => Number(b.latest.real_yoy_pct || -999) - Number(a.latest.real_yoy_pct || -999))[0];
    if (strongest) {
      const c = el("article", "economy-card economy-card--static");
      c.appendChild(el("p", "eyebrow", "実質成長 上位"));
      c.appendChild(el("strong", "economy-card__headline", `${strongest.name_ja} ${pct(strongest.latest.real_yoy_pct)}`));
      c.appendChild(el("p", "economy-card__detail", `名目 ${pct(strongest.latest.nominal_yoy_pct)} / デフレーター ${pct(strongest.latest.deflator_yoy_pct)}`));
      cards.appendChild(c);
    }

    const priceLed = sameYear.slice().sort((a,b) => Number(b.latest.deflator_yoy_pct || -999) - Number(a.latest.deflator_yoy_pct || -999))[0];
    if (priceLed) {
      const c = el("article", "economy-card economy-card--static");
      c.appendChild(el("p", "eyebrow", "価格上昇 上位"));
      c.appendChild(el("strong", "economy-card__headline", `${priceLed.name_ja} ${pct(priceLed.latest.deflator_yoy_pct)}`));
      c.appendChild(el("p", "economy-card__detail", `実質 ${pct(priceLed.latest.real_yoy_pct)} / 名目 ${pct(priceLed.latest.nominal_yoy_pct)}`));
      cards.appendChild(c);
    }
    section.appendChild(cards);
  }

  const wrap = el("div", "table-scroll");
  const table = el("table", "data-table economy-table");
  const thead = el("thead");
  const trh = el("tr");
  ["産業", "名目前年比", "GDPデフレーター前年比", "実質前年比", "恒等式差分", "判定"].forEach((label) => trh.appendChild(el("th", null, label)));
  thead.appendChild(trh);
  table.appendChild(thead);
  const tbody = el("tbody");

  sameYear.slice().sort((a,b) => Number(b.latest.real_yoy_pct || -999) - Number(a.latest.real_yoy_pct || -999)).forEach((row) => {
    const tr = el("tr");
    if (row.id === "transport_postal") tr.setAttribute("data-highlight", "logistics");
    tr.appendChild(el("td", null, row.name_ja || row.id));
    tr.appendChild(el("td", null, pct(row.latest.nominal_yoy_pct)));
    tr.appendChild(el("td", null, pct(row.latest.deflator_yoy_pct)));
    tr.appendChild(el("td", null, pct(row.latest.real_yoy_pct)));
    tr.appendChild(el("td", null, row.latest.identity_gap_pctpt == null ? "—" : `${Number(row.latest.identity_gap_pctpt).toFixed(1)}ポイント`));
    tr.appendChild(el("td", null, assessment(row.latest)));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  section.appendChild(wrap);
  section.appendChild(el("p", "source-note", `出典: ${data.source?.name || "内閣府 国民経済計算"} / 公表年次 ${data.source_vintage || "—"}。前年比は同一年次推計の公式レベルから算出。`));

  const comparison = document.getElementById("industry-comparison");
  if (comparison && comparison.parentNode === host) host.insertBefore(section, comparison.nextSibling);
  else host.insertBefore(section, host.firstChild);
}
