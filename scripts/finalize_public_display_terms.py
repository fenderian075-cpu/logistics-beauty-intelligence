#!/usr/bin/env python3
"""Localize final display-only terms without touching stable machine values."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

NAME_REPLACEMENTS = {
    "Beauty需要": "化粧品需要",
    "Beauty Demand": "化粧品需要",
}
HTML_REPLACEMENTS = {
    "Corporate / Market": "企業・市場",
    "Beauty需要": "化粧品需要",
}


def fix_source_names() -> None:
    for path in sorted((ROOT / "data").glob("source-matrix*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        changed = False
        for source in data.get("sources", []):
            name = source.get("name")
            if isinstance(name, str):
                new_name = name
                for old, new in NAME_REPLACEMENTS.items():
                    new_name = new_name.replace(old, new)
                if new_name != name:
                    source["name"] = new_name
                    changed = True
        if changed:
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def fix_report_html() -> None:
    for path in (ROOT / "reports").glob("**/*.html"):
        text = path.read_text(encoding="utf-8")
        updated = text
        for old, new in HTML_REPLACEMENTS.items():
            updated = updated.replace(old, new)
        if updated != text:
            path.write_text(updated, encoding="utf-8")


def main() -> None:
    fix_source_names()
    fix_report_html()
    print("Final display-only terms localized; machine values untouched.")


if __name__ == "__main__":
    main()
