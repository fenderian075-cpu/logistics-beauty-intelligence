#!/usr/bin/env python3
"""Fail CI when public files expose individual beauty brands or selected English UI terms."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PUBLIC_FILES = [
    ROOT / "data/beauty-priority-brands.json",
    ROOT / "data/buzz-watchlist.json",
    ROOT / "data/reports.json",
    ROOT / "data/topic-intelligence.json",
    ROOT / "data/critical-news.json",
    ROOT / "data/buzz.json",
    ROOT / "assets/js/core/labels.js",
    ROOT / "assets/js/pages/source-matrix.js",
    ROOT / "index.html", ROOT / "radar.html", ROOT / "topic.html", ROOT / "economic-flow.html",
    ROOT / "source-matrix.html", ROOT / "status-history.html", ROOT / "lens-history.html",
]
PUBLIC_FILES.extend(sorted((ROOT / "data").glob("source-matrix*.json")))
PUBLIC_FILES.extend((ROOT / "reports").glob("**/*.html"))

BANNED_BRAND_PATTERNS = [
    r"\bDior\b", r"\bGuerlain\b", r"Givenchy", r"MAKE UP FOR EVER", r"\bBuly\b",
    r"Diptyque", r"\bCHANEL\b", r"YSL Beauty", r"Lanc[oô]me", r"SK-II", r"Shiseido|資生堂",
    r"Clé de Peau|クレ[・ドポー]+", r"Jo Malone", r"La Mer", r"Byredo", r"Rare Beauty",
    r"Rhode", r"Fenty Beauty", r"Charlotte Tilbury", r"L['’]Oréal", r"Estée Lauder",
    r"dior\.com", r"guerlain\.com", r"givenchybeauty\.com", r"makeupforever\.com",
    r"buly1803\.com", r"diptyqueparis\.com", r"chanel\.com", r"yslb\.jp", r"lancome\.jp",
    r"sk-ii\.jp", r"shiseido\.co\.jp", r"cledepeau-beaute\.com", r"jomalone\.jp",
    r"cremedelamer\.jp", r"byredo\.com", r"loreal-finance\.com", r"elcompanies\.com",
]

# Presentation vocabulary that should be Japanese in the public UI/data layer.
# Proper source names and established technical acronyms are intentionally allowed.
BANNED_UI_TERMS = [
    "Economic & Physical Flow", "Economic Flow", "Critical Radar", "Source Matrix", "Status History",
    "Topic Intelligence", "Beauty Demand", "Beauty商流", "Beauty需要", "通関・NACCS", "この signal の推移",
    "Retail / Department Store", "Industry Statistics", "Production / Shipment", "Retail / Commerce",
    "Market Research", "Industry Media", "Trade / Physical Flow", "Warehouse / Physical Flow",
    "Port / Physical Flow", "Truck / Physical Flow", "Air / Physical Flow", "Logistics Cost",
    "Inbound Demand", "Corporate / Market", "Corporate / IR", "Warehouse / IR", "Port / IR",
    "Integrated Logistics / IR", "Carrier IR / Network", "Structural Outlook", "Synthesis / Discovery",
    "Buzz / Search", "港湾・Reliability", "船腹・Supply",
]


def main() -> None:
    errors = []
    unique_files = list(dict.fromkeys(PUBLIC_FILES))
    for path in unique_files:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        rel = path.relative_to(ROOT)
        for pattern in BANNED_BRAND_PATTERNS:
            if re.search(pattern, text, flags=re.IGNORECASE):
                errors.append(f"{rel}: prohibited individual beauty brand/URL matched {pattern!r}")
        for term in BANNED_UI_TERMS:
            if term in text:
                errors.append(f"{rel}: untranslated public UI term {term!r}")
    if errors:
        print("\n".join(f"[ERROR] {e}" for e in errors), file=sys.stderr)
        raise SystemExit(1)
    print(f"public-content audit passed: {len(unique_files)} files checked")


if __name__ == "__main__":
    main()
