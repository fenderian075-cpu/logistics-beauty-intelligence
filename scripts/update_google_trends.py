#!/usr/bin/env python3
import json, math, time
from datetime import datetime, timezone
from pathlib import Path

from pytrends.request import TrendReq

ROOT = Path(__file__).resolve().parents[1]
WATCH = ROOT / "data" / "buzz-watchlist.json"
OUT = ROOT / "data" / "buzz.json"


def mean(xs):
    vals = [float(x) for x in xs if x is not None]
    return sum(vals) / len(vals) if vals else 0.0


def load_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def main():
    cfg = load_json(WATCH, {})
    anchor = cfg.get("anchor", "化粧品")
    terms = cfg.get("terms", [])
    batch_size = 4  # + anchor = 5, Google Trends comparison limit
    pytrends = TrendReq(hl="ja-JP", tz=-540, retries=2, backoff_factor=0.4)
    observations = []
    errors = []

    for i in range(0, len(terms), batch_size):
        group = terms[i:i+batch_size]
        keywords = [anchor] + [x["term"] for x in group]
        try:
            pytrends.build_payload(keywords, timeframe="today 3-m", geo="JP")
            df = pytrends.interest_over_time()
            if df is None or df.empty:
                raise RuntimeError("empty response")
            anchor_mean = max(mean(df[anchor].tail(28).tolist()), 1.0)
            for item in group:
                term = item["term"]
                series = df[term]
                recent7 = mean(series.tail(7).tolist())
                prev21 = mean(series.iloc[-28:-7].tolist()) if len(series) >= 28 else mean(series.head(max(len(series)-7,1)).tolist())
                recent28 = mean(series.tail(28).tolist())
                ratio = (recent7 / prev21) if prev21 > 0 else (2.0 if recent7 > 0 else 1.0)
                normalized = recent28 / anchor_mean
                observations.append({
                    "term": term,
                    "category": item.get("category", "other"),
                    "brand": item.get("brand"),
                    "interest_7d": round(recent7, 1),
                    "interest_prev21d": round(prev21, 1),
                    "change_ratio": round(ratio, 2),
                    "change_pct": round((ratio - 1.0) * 100, 1),
                    "anchor_normalized": round(normalized, 2),
                    "source": "Google Trends",
                    "geo": "JP",
                    "confidence": "medium"
                })
            time.sleep(1.2)
        except Exception as exc:
            errors.append({"batch": keywords, "error": str(exc)[:250]})

    observations.sort(key=lambda x: (x["change_ratio"], x["interest_7d"]), reverse=True)
    signals = [x for x in observations if x["change_ratio"] >= 1.25 and x["interest_7d"] >= 5][:20]

    old = load_json(OUT, {})
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    if not observations:
        old["last_attempt"] = now
        old["collector_status"] = "error"
        old["collector_errors"] = errors
        OUT.write_text(json.dumps(old, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        raise SystemExit("Google Trends returned no usable observations; preserved previous data")

    result = {
        "schema_version": "1.1",
        "updated_at": now,
        "collector_status": "ok" if not errors else "partial",
        "source": {
            "name": "Google Trends",
            "method": "pytrends",
            "official_api": False,
            "geo": "JP",
            "timeframe": "today 3-m",
            "note": "Google Trendsの公開データを非公式クライアントpytrends経由で取得。指数は相対値であり検索件数ではありません。"
        },
        "anchor": anchor,
        "observations": observations,
        "signals": signals,
        "collector_errors": errors
    }
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

if __name__ == "__main__":
    main()
