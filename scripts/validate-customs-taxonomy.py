#!/usr/bin/env python3
"""Validate customs/regulation subtype taxonomy without breaking legacy history."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TAXONOMY = ROOT / "data" / "customs-regulation-taxonomy.json"
SOURCES = ROOT / "data" / "source-matrix.json"
REPORTS = ROOT / "data" / "reports.json"
SIGNAL_ID = "japan-customs-naccs"
VALID = {"operational", "regulatory", "mixed"}
ENFORCE_FROM = "2026-08-24"


def fail(message: str) -> None:
    print(f"[ERROR] {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    taxonomy = json.loads(TAXONOMY.read_text(encoding="utf-8"))
    if taxonomy.get("signal_id") != SIGNAL_ID:
        fail("taxonomy signal_id mismatch")
    if set(taxonomy.get("subtypes", {})) != VALID:
        fail(f"taxonomy must define exactly {sorted(VALID)}")

    source_data = json.loads(SOURCES.read_text(encoding="utf-8"))
    customs_sources = [s for s in source_data.get("sources", []) if s.get("layer") == "Customs & Regulation"]
    if not customs_sources:
        fail("no Customs & Regulation sources found")
    for source in customs_sources:
        subtype = source.get("customs_subtype")
        if subtype not in VALID:
            fail(f"source {source.get('name')} has invalid/missing customs_subtype: {subtype!r}")

    reports = json.loads(REPORTS.read_text(encoding="utf-8"))
    checked = 0
    for report in reports.get("reports", []):
        if str(report.get("date", "")) < ENFORCE_FROM:
            continue
        intel = report.get("intelligence") or {}
        for lens, rows in intel.items():
            if not isinstance(rows, list):
                continue
            for signal in rows:
                if not isinstance(signal, dict) or signal.get("id") != SIGNAL_ID:
                    continue
                checked += 1
                subtype = signal.get("customs_subtype")
                if subtype not in VALID:
                    fail(f"{report.get('id')} {lens}: customs_subtype must be one of {sorted(VALID)}")
                if subtype == "operational" and lens != "disruption":
                    fail(f"{report.get('id')}: operational customs event must use disruption lens")
                if subtype in {"regulatory", "mixed"} and lens != "regulatory_structural":
                    fail(f"{report.get('id')}: {subtype} customs event must use regulatory_structural lens")

    print(f"customs taxonomy valid: {len(customs_sources)} sources, {checked} enforced report signals")


if __name__ == "__main__":
    main()
