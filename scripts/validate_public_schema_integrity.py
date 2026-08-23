#!/usr/bin/env python3
"""Guard stable internal values from presentation-layer localization."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []


def err(message: str) -> None:
    errors.append(message)


def load(rel: str):
    return json.loads((ROOT / rel).read_text(encoding="utf-8"))


def check_source_matrix() -> None:
    allowed_cadence = {"daily", "weekly", "monthly"}
    for path in sorted((ROOT / "data").glob("source-matrix*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        for i, source in enumerate(data.get("sources", [])):
            for cadence in source.get("cadence", []):
                if cadence not in allowed_cadence:
                    err(f"{path.name}[{i}] cadence changed from stable enum: {cadence!r}")
            url = source.get("url")
            if isinstance(url, str) and re.search(r"[ぁ-んァ-ヶ一-龠]", url):
                err(f"{path.name}[{i}] URL contains translated Japanese text: {url}")


def check_critical_news() -> None:
    data = load("data/critical-news.json")
    dimensions = {"rate", "supply", "demand", "reliability", "risk", "mixed"}
    materiality = {"structural", "material", "notable", "routine"}
    changes = {"regime_shift", "acceleration", "deterioration", "improvement", "normalization", "no_material_change"}
    scopes = {"global", "network", "market", "regional", "shipment"}
    drivers = {"organic", "promotion", "launch", "buzz", "mixed", "unknown"}
    for item in data.get("items", []):
        iid = item.get("id", "?")
        if item.get("market_dimension") not in dimensions:
            err(f"critical-news {iid}: invalid market_dimension {item.get('market_dimension')!r}")
        if item.get("market_materiality") not in materiality:
            err(f"critical-news {iid}: invalid market_materiality {item.get('market_materiality')!r}")
        if item.get("market_change") not in changes:
            err(f"critical-news {iid}: invalid market_change {item.get('market_change')!r}")
        if item.get("operational_scope") not in scopes:
            err(f"critical-news {iid}: invalid operational_scope {item.get('operational_scope')!r}")
        if "demand_driver" in item and item.get("demand_driver") not in drivers:
            err(f"critical-news {iid}: invalid demand_driver {item.get('demand_driver')!r}")


def check_commerce() -> None:
    data = load("data/commerce-calendar.json")
    drivers = {"organic", "promotion", "launch", "buzz", "mixed", "unknown"}
    statuses = {"active", "scheduled", "ended", "cancelled", "unknown"}
    for event in data.get("events", []):
        eid = event.get("id", event.get("name", "?"))
        if event.get("driver") not in drivers:
            err(f"commerce {eid}: driver enum changed: {event.get('driver')!r}")
        if event.get("status") not in statuses:
            err(f"commerce {eid}: status enum changed: {event.get('status')!r}")


def check_buzz() -> None:
    data = load("data/buzz.json")
    for row in data.get("observations", []):
        if row.get("category") == "brand" or row.get("brand"):
            err(f"buzz public output still contains brand-target observation: {row.get('term')!r}")


def check_html_contracts() -> None:
    for rel in ["index.html", "archive.html", "radar.html", "topic.html", "economic-flow.html", "source-matrix.html"]:
        path = ROOT / rel
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        for report_type in ("daily", "weekly", "monthly"):
            if f'data-nav="{report_type}"' not in text:
                err(f"{rel}: missing stable data-nav={report_type!r}")
            if f'id="nav-latest-{report_type}"' not in text:
                err(f"{rel}: missing stable nav id nav-latest-{report_type}")
        for match in re.findall(r'https?://[^\s\"\'<>]+', text):
            if re.search(r"[ぁ-んァ-ヶ一-龠]", match):
                err(f"{rel}: URL contains translated Japanese text: {match}")


def main() -> None:
    check_source_matrix()
    check_critical_news()
    check_commerce()
    check_buzz()
    check_html_contracts()
    if errors:
        print("\n".join(f"[ERROR] {e}" for e in errors), file=sys.stderr)
        raise SystemExit(1)
    print("public schema integrity valid")


if __name__ == "__main__":
    main()
