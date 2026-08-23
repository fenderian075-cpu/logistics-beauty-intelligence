#!/usr/bin/env python3
"""Compatibility and source-fallback runner for the SNA industry collector.

The canonical source is Cabinet Office ESRI. e-Stat mirrors the same 2024 annual
SNA tables and is used only if the ESRI workbook cannot be retrieved. Japanese-era
year labels are normalized before the core parser sees them.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Optional

import requests
import update_sna_industry_deflators as collector

ERA_BASE = {"令和": 2018, "平成": 1988, "昭和": 1925}

# Exact e-Stat file mirrors for the 2024 annual SNA vintage. Future vintages keep
# ESRI as primary until their e-Stat statInfIds are verified.
ESTAT_2024 = {
    "nominal": "https://www.e-stat.go.jp/stat-search/file-download?fileKind=0&statInfId=000040408807",
    "real": "https://www.e-stat.go.jp/stat-search/file-download?fileKind=0&statInfId=000040408808",
    "deflator": "https://www.e-stat.go.jp/stat-search/file-download?fileKind=0&statInfId=000040408809",
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

    era = re.search(r"(令和|平成|昭和)\s*(元|\d{1,2})\s*(?:暦年|年度|年)?", text)
    if not era:
        return None
    era_name, era_year_text = era.groups()
    era_year = 1 if era_year_text == "元" else int(era_year_text)
    return ERA_BASE[era_name] + era_year


def valid_xlsx(blob: bytes) -> bool:
    # XLSX is an OOXML ZIP archive. This catches HTML error/redirect pages that
    # otherwise produce confusing openpyxl failures.
    return len(blob) >= 5000 and blob[:2] == b"PK"


def fetch_xlsx(url: str) -> bytes:
    response = requests.get(
        url,
        timeout=60,
        allow_redirects=True,
        headers={"User-Agent": "LBI-SNA-Collector/1.1"},
    )
    response.raise_for_status()
    if not valid_xlsx(response.content):
        content_type = response.headers.get("content-type", "unknown")
        raise RuntimeError(f"Not an XLSX payload ({content_type}): {url}")
    return response.content


def source_kind(url: str) -> Optional[str]:
    if "fcm3n_jp.xlsx" in url:
        return "nominal"
    if "fcm3rn_jp.xlsx" in url:
        return "real"
    if "fcm3dn_jp.xlsx" in url:
        return "deflator"
    return None


def download_with_fallback(url: str) -> bytes:
    try:
        return fetch_xlsx(url)
    except Exception as primary_error:
        kind = source_kind(url)
        # The current production vintage is 2024. Do not silently map future
        # vintages to stale 2024 e-Stat files.
        if kind and "/files/2024/" in url:
            fallback = ESTAT_2024[kind]
            try:
                return fetch_xlsx(fallback)
            except Exception as fallback_error:
                raise RuntimeError(
                    f"Both ESRI and e-Stat failed for {kind}: "
                    f"ESRI={primary_error}; e-Stat={fallback_error}"
                ) from fallback_error
        raise


def main() -> None:
    collector.year_of = year_of
    collector.download = download_with_fallback
    collector.main()


if __name__ == "__main__":
    main()
