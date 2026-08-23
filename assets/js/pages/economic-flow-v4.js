import { init as initBase } from "./economic-flow.js";
import { mountIndustryDeflatorPanel } from "../render/industry-deflator-panel.js";

export async function init() {
  await initBase();
  await mountIndustryDeflatorPanel();
}
