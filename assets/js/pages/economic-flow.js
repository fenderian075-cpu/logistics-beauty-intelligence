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

function latest(series) {
  const list = (series && series.observations) || [];
  return list.length ? list[list.length - 1] : null;
}

function renderDataset(host, data) {
  if (!data || !data.dataset) return;
  const section = el("section", "flow-dataset");
  section.id = data.dataset;
  const head = el("div", "section__head");
  const title = el("div");
  title.appendChild(el("p", "eyebrow", (data.frequency || "dataset").toUpperCase()));
  title.appendChild(el("h2", "section__title", data.title_ja || data.dataset));
  head.appendChild(title);
  section.appendChild(head);

  const series = data.series || [];
  if (!series.length && !(data.observations || []).length) {
    section.appendChild(el("p", "empty-state", "系列定義のみ。観測値を蓄積中です。"));
  } else if (series.length) {
    const wrap = el("div", "table-scroll");
    const table = el("table", "data-table economy-table");
    const thead = el("thead");
    const trh = el("tr");
    ["指標", "期間", "値", "前年比", "前月比"].forEach((label) => trh.appendChild(el("th", null, label)));
    thead.appendChild(trh); table.appendChild(thead);
    const tbody = el("tbody");
    series.forEach((s) => {
      const obs = latest(s);
      const tr = el("tr");
      tr.appendChild(el("td", null, s.name_ja || s.metric_id));
      tr.appendChild(el("td", null, obs ? (obs.period || "—") : "—"));
      tr.appendChild(el("td", null, `${formatValue(obs)}${obs && s.unit ? ` ${s.unit}` : ""}`));
      tr.appendChild(el("td", null, obs && obs.yoy != null ? `${obs.yoy > 0 ? "+" : ""}${obs.yoy}%` : "—"));
      tr.appendChild(el("td", null, obs && obs.mom != null ? `${obs.mom > 0 ? "+" : ""}${obs.mom}%` : "—"));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody); wrap.appendChild(table); section.appendChild(wrap);
  } else {
    const wrap = el("div", "table-scroll");
    const table = el("table", "data-table economy-table");
    const thead = el("thead");
    const trh = el("tr");
    ["指標", "期間", "値", "前年比", "区分"].forEach((label) => trh.appendChild(el("th", null, label)));
    thead.appendChild(trh); table.appendChild(thead);
    const tbody = el("tbody");
    (data.observations || []).forEach((obs) => {
      const tr = el("tr");
      tr.appendChild(el("td", null, obs.metric || "—"));
      tr.appendChild(el("td", null, obs.period || "—"));
      tr.appendChild(el("td", null, obs.value != null ? `${Number(obs.value).toLocaleString("ja-JP")} ${obs.unit || ""}` : "—"));
      tr.appendChild(el("td", null, obs.yoy != null ? `${obs.yoy > 0 ? "+" : ""}${obs.yoy}%` : "—"));
      tr.appendChild(el("td", null, obs.status || "—"));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody); wrap.appendChild(table); section.appendChild(wrap);
  }

  const source = data.source || ((data.sources || [])[0]);
  if (source && source.url) {
    const p = el("p", "source-note", "出典: ");
    const a = el("a", null, source.name || "一次情報");
    a.href = source.url; a.target = "_blank"; a.rel = "noopener noreferrer";
    p.appendChild(a); section.appendChild(p);
  }
  host.appendChild(section);
}

function renderOverview(data) {
  const host = byId("flow-overview");
  if (!host) return;
  clear(host);
  (data.cards || []).forEach((card) => {
    const box = el("article", "economy-card economy-card--static");
    box.id = card.id;
    box.setAttribute("data-direction", card.direction || "unknown");
    box.appendChild(el("p", "eyebrow", card.label));
    box.appendChild(el("strong", "economy-card__headline", card.headline));
    box.appendChild(el("p", "economy-card__value", card.value));
    box.appendChild(el("p", "economy-card__meta", card.period || "—"));
    box.appendChild(el("p", "economy-card__detail", card.detail || ""));
    host.appendChild(box);
  });
}

function renderChain(data) {
  const host = byId("flow-chain");
  if (!host) return;
  clear(host);
  (data.transmission_chain || []).forEach((item, index, list) => {
    host.appendChild(el("span", "transmission-node", item));
    if (index < list.length - 1) host.appendChild(el("span", "transmission-arrow", "→"));
  });
}

export async function init() {
  const [overview, bundle, reports, news] = await Promise.all([
    loadEconomyOverview(), loadEconomyBundle(), loadReports(), loadCriticalNews()
  ]);
  mountShell({ reports: reports.reports, news: (news && news.items) || [] });
  bindLatestReportNav(reports.reports); markCurrent();
  renderOverview(overview); renderChain(overview);
  const host = byId("flow-datasets");
  if (host) {
    clear(host);
    [bundle.trade, bundle.warehouse, bundle.port, bundle.cost, bundle.trucking, bundle.air, bundle.beauty, bundle.beautyMarket, bundle.macro].forEach((dataset) => renderDataset(host, dataset));
  }
}
