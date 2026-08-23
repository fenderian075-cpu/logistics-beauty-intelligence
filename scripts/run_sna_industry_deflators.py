#!/usr/bin/env python3
"""Compatibility runner for the SNA industry-deflator collector.

Cabinet Office / e-Stat workbooks may label calendar-year columns in Japanese-era
notation (for example 平成6暦年 or 令和6暦年). The core collector intentionally
keeps its table parser generic; this runner extends only year parsing and then
executes the normal collector.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Optional

import update_sna_industry_deflators as collector

ERA_BASE = {
    "令和": 2018,
    "平成": 1988,
    "昭和": 1925,
}


def year_of(value) -> Optional[int]:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        try:
            n = int(value)
        except (TypeError, ValueError, OverflowError):
            return None
        return n if 1900 <= n <= 2100 else None

    text = unicodedata.normalize("NFKC", str(value)).strip()

    western = re.search(r"(?<!\d)(19\d{2}|20\d{2})(?!\d)", text)
    if western:
        return int(western.group(1))

    era = re.search(r"(令和|平成|昭和)\s*(元|\d{1,2})\s*(?:年|暦年|年度)?", text)
    if not era:
        return None
    era_name, era_year_text = era.groups()
    era_year = 1 if era_year_text == "元" else int(era_year_text)
    return ERA_BASE[era_name] + era_year


def main() -> None:
    collector.year_of = year_of
    collector.main()


if __name__ == "__main__":
    main()
