#!/usr/bin/env python3
"""Fail closed unless a Weekly publication diff stays inside LBI content guardrails."""
from __future__ import annotations
import json, re, subprocess, sys
from pathlib import Path

ALLOWED_PREFIXES = (
    "reports/", "data/economy/", "data/commerce", "data/source-matrix",
)
ALLOWED_FILES = {
    "data/reports.json", "data/critical-news.json", "data/topic-intelligence.json",
    "data/buzz.json", "data/report-required-metrics.json",
}
FORBIDDEN_PREFIXES = ("assets/", "templates/", "docs/", ".github/", "scripts/", "tests/")
PRIVATE_TERMS = (
    # Publication rules deliberately keep private priority origin/routing dimensions
    # out of public content. The concrete private terms live outside this public repo.
    "private priority flow monitoring",
)

def sh(*args: str) -> str:
    return subprocess.check_output(args, text=True).strip()

def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "origin/main"
    changed = [x for x in sh("git","diff","--name-only",f"{base}...HEAD").splitlines() if x]
    if not changed:
        raise SystemExit("Weekly guard: empty diff")
    bad = [p for p in changed if p.startswith(FORBIDDEN_PREFIXES) or not (p in ALLOWED_FILES or p.startswith(ALLOWED_PREFIXES))]
    if bad:
        raise SystemExit("Weekly guard: unexpected paths: " + ", ".join(bad))
    weekly = [p for p in changed if re.fullmatch(r"reports/\d{4}/\d{2}/\d{4}-\d{2}-\d{2}-weekly\.html", p)]
    if len(weekly) != 1:
        raise SystemExit(f"Weekly guard: expected exactly one Weekly HTML, found {weekly}")
    html = Path(weekly[0]).read_text(encoding="utf-8").lower()
    if "economic" not in html or "physical" not in html:
        raise SystemExit("Weekly guard: mandatory Economic & Physical Flow section not detected")
    for term in PRIVATE_TERMS:
        if term in html:
            raise SystemExit("Weekly guard: private monitoring rationale leaked to report")
    json.loads(Path("data/reports.json").read_text(encoding="utf-8"))
    print("Weekly publication guard passed:", ", ".join(changed))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
