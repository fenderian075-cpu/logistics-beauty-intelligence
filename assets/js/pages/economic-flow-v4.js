import { init as initBase } from "./economic-flow.js";
import { mountIndustryDeflatorPanel } from "../render/industry-deflator-panel.js";
import { mountCostTrendPanel } from "../render/cost-trend-panel.js";

export async function init() {
  await initBase();
  await mountCostTrendPanel();
  await mountIndustryDeflatorPanel();
}
