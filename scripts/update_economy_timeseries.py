#!/usr/bin/env python3
"""Refresh public economy time-series that materially affect logistics costs.

- Appends Drewry WCI/IACI public weekly snapshots without overwriting history.
- Normalizes macro metric display names to Japanese while preserving metric IDs.
- Keeps fuel series as an official-data store; full historical fuel ingestion is handled
  separately because the Agency for Natural Resources and Energy publishes a workbook
  whose layout can change. This script never fabricates missing fuel values.
"""
from __future__ import annotations

import json, re
from datetime import datetime, timezone
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[1]
UA = {"User-Agent": "Mozilla/5.0 LBI-public-data-collector/1.0"}

MACRO_NAMES = {
    "nominal_gdp_fy_level": "名目GDP（年度）",
    "nominal_gdp_fy_growth_pct": "名目GDP成長率（年度）",
    "real_gdp_fy_growth_pct": "実質GDP成長率（年度）",
    "real_gdp_fy_level": "実質GDP（年度）",
    "real_gdp_qoq_pct": "実質GDP 前期比",
    "nominal_gdp_qoq_pct": "名目GDP 前期比",
    "real_gdp_quarterly_level_saar": "実質GDP 季節調整済年率",
    "nominal_gdp_quarterly_level_saar": "名目GDP 季節調整済年率",
    "industrial_production": "鉱工業生産指数",
    "manufacturing_shipments": "製造工業出荷指数",
    "eur_jpy": "ユーロ円相場",
    "usd_jpy": "ドル円相場",
    "crude_oil_import_cost": "原油輸入価格"
}

DREWRY_URL = "https://www.drewry.co.uk/trackers-and-indices/latest-trackers-and-indices/world-container-index-assessed-by-drewry"


def load(path): return json.loads((ROOT / path).read_text(encoding="utf-8"))
def save(path, data): (ROOT / path).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def localize_macro():
    data = load("data/economy/macro.json")
    for s in data.get("series", []):
        if s.get("metric_id") in MACRO_NAMES:
            s["name_ja"] = MACRO_NAMES[s["metric_id"]]
    data["frequency_ja"] = "月次・四半期・年次"
    data["revision_policy_ja"] = "GDPは改定されるため、速報値は最新公表値へ更新し、過去年次は出典vintageを保持する。vintage差を景気変化として扱わない。"
    data["rule_ja"] = "マクロ経済は単独で物流シグナルに昇格させず、貿易・物量・コスト・需要への伝播経路が確認できる場合に使う。"
    save("data/economy/macro.json", data)

def append_obs(series, obs):
    rows = series.setdefault("observations", [])
    rows[:] = [r for r in rows if r.get("period") != obs["period"]]
    rows.append(obs); rows.sort(key=lambda r: r.get("period", ""))

def refresh_drewry():
    html = requests.get(DREWRY_URL, headers=UA, timeout=30).text
    data = load("data/economy/ocean-freight-market.json")
    patterns = {
        "drewry_wci": r"(\d{1,2})\s+Aug\s+2026.*?World Container Index.*?(?:increased|rose).*?(\d+(?:\.\d+)?)%.*?\$([0-9,]+).*?40ft",
        "drewry_iaci": r"(\d{1,2})\s+Aug\s+2026.*?Intra-Asia Container Index.*?(?:increased|rose).*?(\d+(?:\.\d+)?)%.*?\$([0-9,]+).*?40ft",
    }
    # Generic current-page fallbacks, with date taken from the visible 20 Aug 2026 release.
    generic = {
        "drewry_wci": r"World Container Index \(WCI\).*?(?:increased|rose).*?(\d+(?:\.\d+)?)%.*?\$([0-9,]+)",
        "drewry_iaci": r"Intra-Asia Container Index \(IACI\).*?(?:increased|rose).*?(\d+(?:\.\d+)?)%.*?\$([0-9,]+)",
    }
    for s in data.get("series", []):
        mid = s.get("metric_id")
        if mid not in generic: continue
        m = re.search(generic[mid], html, re.I | re.S)
        if not m: continue
        wow, value = float(m.group(1)), float(m.group(2).replace(",", ""))
        # Date is extracted independently to avoid binding to page layout.
        dm = re.search(r"(\d{1,2})\s+Aug\s+2026", html, re.I)
        period = f"2026-08-{int(dm.group(1)):02d}" if dm else datetime.now(timezone.utc).date().isoformat()
        append_obs(s, {"period": period, "value": value, "wow_pct": wow, "status": "official", "source_note": "Drewry public tracker"})
    data["last_collected_at"] = datetime.now(timezone.utc).isoformat()
    save("data/economy/ocean-freight-market.json", data)

def main():
    localize_macro()
    refresh_drewry()
    print("economy time-series refresh completed")

if __name__ == "__main__": main()
