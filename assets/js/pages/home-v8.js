/* Composite dashboard entry: preserves the v7 control-tower dashboard and
   adds the Economic & Physical Flow layer as a first-class section. */
import { init as initHome } from "./home.js";
import { el, link, root } from "../core/dom.js";
import { loadEconomyOverview } from "../data/store.js";

function directionLabel(value) {
  return { rising:"上昇", falling:"低下", improving:"改善", deteriorating:"悪化", stable:"横ばい", unknown:"未確認" }[value] || "未確認";
}

function economyCard(card) {
  const a = link(`${root()}economic-flow.html#${encodeURIComponent(card.id)}`, "economy-card");
  a.setAttribute("data-direction", card.direction || "unknown");
  a.appendChild(el("p", "eyebrow", card.label || card.id));
  a.appendChild(el("strong", "economy-card__headline", card.headline || "—"));
  a.appendChild(el("p", "economy-card__value", card.value || "未確認"));
  const meta = el("p", "economy-card__meta", `${card.period || "—"} / ${directionLabel(card.direction)}`);
  a.appendChild(meta);
  if (card.detail) a.appendChild(el("p", "economy-card__detail", card.detail));
  a.appendChild(el("span", "economy-card__drill", "実体物流を見る →"));
  return a;
}

function chainNode(text, index, total) {
  const frag = document.createDocumentFragment();
  frag.appendChild(el("span", "transmission-node", text));
  if (index < total - 1) frag.appendChild(el("span", "transmission-arrow", "→"));
  return frag;
}

async function renderEconomy() {
  const dashboard = document.getElementById("dashboard");
  if (!dashboard || document.getElementById("economic-flow-home")) return;

  const data = await loadEconomyOverview();
  const section = el("section", "section section--span section--economy");
  section.id = "economic-flow-home";
  section.setAttribute("aria-labelledby", "economic-flow-title");

  const head = el("div", "section__head");
  const titleBox = el("div");
  titleBox.appendChild(el("p", "eyebrow", "ECONOMIC & PHYSICAL FLOW"));
  titleBox.appendChild(el("h2", "section__title", "実体経済と物流"));
  titleBox.lastChild.id = "economic-flow-title";
  head.appendChild(titleBox);
  head.appendChild(link(`${root()}economic-flow.html`, "section__link", "詳細を見る →"));
  section.appendChild(head);

  if (data.thesis) section.appendChild(el("p", "economy-thesis", data.thesis));

  const grid = el("div", "economy-grid");
  (data.cards || []).forEach((card) => grid.appendChild(economyCard(card)));
  if (!(data.cards || []).length) grid.appendChild(el("p", "empty-state", "実体物流データを蓄積中です。"));
  section.appendChild(grid);

  const chain = el("div", "transmission-chain");
  (data.transmission_chain || []).forEach((item, i, list) => chain.appendChild(chainNode(item, i, list.length)));
  section.appendChild(chain);
  if (data.interpretation) section.appendChild(el("p", "regime-note", data.interpretation));

  const regime = document.getElementById("market-regime-strip");
  const regimeSection = regime && regime.closest("section");
  if (regimeSection) dashboard.insertBefore(section, regimeSection);
  else dashboard.appendChild(section);
}

export async function init() {
  await initHome();
  await renderEconomy();
}
