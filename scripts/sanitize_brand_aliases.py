#!/usr/bin/env python3
"""Remove Japanese/localized aliases of individual beauty monitoring targets."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALIASES = [
    "ディオール", "ゲラン", "ジバンシイ", "ジバンシー", "メイクアップフォーエバー",
    "ビュリー", "ディプティック", "シャネル", "イヴ・サンローラン", "イヴサンローラン",
    "ランコム", "エスケーツー", "資生堂", "クレ・ド・ポー ボーテ", "クレドポー ボーテ",
    "ジョー マローン ロンドン", "ジョーマローン", "ラ・メール", "バイレード",
]
PATTERN = re.compile("|".join(sorted((re.escape(x) for x in ALIASES), key=len, reverse=True)), re.IGNORECASE)


def clean_text(value: str) -> str:
    out = PATTERN.sub("個別ブランド", value)
    return re.sub(r"(?:個別ブランド\s*[、,・/]\s*)+個別ブランド", "複数ブランド", out)


def clean(value):
    if isinstance(value, str):
        return clean_text(value)
    if isinstance(value, list):
        return [clean(v) for v in value]
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items()}
    return value


def main() -> None:
    for rel in ["data/reports.json", "data/topic-intelligence.json", "data/critical-news.json", "data/buzz.json"]:
        path = ROOT / rel
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            path.write_text(json.dumps(clean(data), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for path in (ROOT / "reports").glob("**/*.html"):
        path.write_text(clean_text(path.read_text(encoding="utf-8")), encoding="utf-8")
    print("Japanese beauty-brand aliases sanitized")


if __name__ == "__main__":
    main()
