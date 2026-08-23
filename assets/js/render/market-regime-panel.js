import { el, clear } from "../core/dom.js";
import { loadCriticalNews, loadEconomyBundle, loadBuzz, loadCommerceCalendar } from "../data/store.js";
import { deriveMarketRegimes } from "../domain/market-regimes.js";

const CONFIDENCE = { high: "高", medium: "中", low: "低" };

function regimeCard(regime) {
  const card = el("article", "radar-group market-regime-card");
  card.setAttribute("data-regime", regime.state || "");

  const head = el("div", "radar-group__head");
  head.appendChild(el("h2", "radar-group__title", regime.title));
  head.appendChild(el("span", "radar-group__count", regime.label));
  head.appendChild(el("p", "radar-group__note", `判定確度: ${CONFIDENCE[regime.confidence] || regime.confidence || "不明"}`));
  card.appendChild(head);

  const body = el("div", "radar-detail");
  const col = el("div", "radar-detail__col");
  const block = el("div", "radar-block radar-block--reported");
  block.appendChild(el("p", "radar-block__label", "クロスソース判定"));
  block.appendChild(el("p", "radar-block__text", regime.summary));
  col.appendChild(block);
  body.appendChild(col);
  card.appendChild(body);
  return card;
}

export async function mountMarketRegimePanel(target) {
  if (!target) return [];
  const [newsData, economy, buzz, commerce] = await Promise.all([
    loadCriticalNews(), loadEconomyBundle(), loadBuzz(), loadCommerceCalendar()
  ]);
  const regimes = deriveMarketRegimes({ newsData, economy, buzz, commerce });
  clear(target);
  regimes.forEach((regime) => target.appendChild(regimeCard(regime)));
  return regimes;
}
