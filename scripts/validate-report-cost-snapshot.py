#!/usr/bin/env python3
"""Enforce mandatory logistics-cost observations in reports from 2026-08-24 onward."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICY = json.loads((ROOT / "data/report-required-metrics.json").read_text(encoding="utf-8"))
REPORTS = json.loads((ROOT / "data/reports.json").read_text(encoding="utf-8"))
EFFECTIVE = POLICY["effective_from"]
errors = []

for report in REPORTS.get("reports", []):
    if report.get("date", "") < EFFECTIVE:
        continue
    rtype = report.get("type")
    required = (POLICY.get(rtype) or {}).get("required", [])
    if not required:
        continue
    rid = report.get("id", "?")
    snap = report.get("cost_snapshot")
    if not isinstance(snap, dict):
        errors.append(f"{rid}: cost_snapshot is required from {EFFECTIVE}")
        continue
    metrics = snap.get("metrics")
    if not isinstance(metrics, dict):
        errors.append(f"{rid}: cost_snapshot.metrics must be an object")
        continue
    for mid in required:
        obs = metrics.get(mid)
        if not isinstance(obs, dict):
            errors.append(f"{rid}: required cost metric missing: {mid}")
            continue
        for field in ("value", "unit", "data_date", "source"):
            if field not in obs:
                errors.append(f"{rid}: cost_snapshot.metrics.{mid} missing {field}")
        if obs.get("value") is not None and not isinstance(obs.get("value"), (int, float)):
            errors.append(f"{rid}: {mid}.value must be numeric or null")
        if obs.get("data_date") is not None and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(obs.get("data_date"))):
            errors.append(f"{rid}: {mid}.data_date must be YYYY-MM-DD or null")
    if not snap.get("interpretation_ja"):
        errors.append(f"{rid}: cost_snapshot.interpretation_ja is required")

if errors:
    raise SystemExit("\n".join(f"[ERROR] {e}" for e in errors))
print(f"report cost snapshot policy valid from {EFFECTIVE}")
