/* Economic Flow entry: base page, long-term history explorer and SNA deflator panel. */
import { init as initBase } from "./economic-flow.js";
import { loadEconomyBundle } from "../data/store.js";
import { bindHistoryTargets } from "../render/history-bindings.js";
import { mountHistoryExplorer } from "../render/history-analysis.js";
import { mountIndustryDeflatorPanel } from "../render/industry-deflator-panel.js";

export async function init() {
  await initBase();
  const bundle = await loadEconomyBundle();
  bindHistoryTargets(bundle);
  mountHistoryExplorer(bundle);
  await mountIndustryDeflatorPanel();
}
