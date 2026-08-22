#!/usr/bin/env python3
import json, random, time
from datetime import datetime, timezone
from pathlib import Path
from pytrends.request import TrendReq

ROOT = Path(__file__).resolve().parents[1]
WATCH = ROOT / "data" / "buzz-watchlist.json"
OUT = ROOT / "data" / "buzz.json"

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36",
]

def mean(xs):
    vals = [float(x) for x in xs if x is not None]
    return sum(vals) / len(vals) if vals else 0.0

def load_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default

def trend_client():
    return TrendReq(
        hl="ja-JP",
        tz=-540,
        retries=0,
        requests_args={"headers": {"User-Agent": random.choice(USER_AGENTS)}},
    )

def fetch_pair(anchor, term, attempts=3):
    last = None
    for attempt in range(1, attempts + 1):
        try:
            pytrends = trend_client()
            pytrends.build_payload([anchor, term], timeframe="today 1-m", geo="JP")
            df = pytrends.interest_over_time()
            if df is None or df.empty:
                raise RuntimeError("empty response")
            return df
        except Exception as exc:
            last = exc
            print(f"[WARN] {term}: attempt {attempt}/{attempts}: {type(exc).__name__}: {exc}", flush=True)
            if attempt < attempts:
                time.sleep(5 * attempt + random.uniform(1.0, 3.0))
    raise last

def main():
    cfg = load_json(WATCH, {})
    anchor = cfg.get("anchor", "化粧品")
    terms = cfg.get("terms", [])
    observations, errors = [], []

    print(f"Google Trends collector: {len(terms)} terms / geo=JP / timeframe=today 1-m", flush=True)

    for idx, item in enumerate(terms, 1):
        term = item["term"]
        try:
            df = fetch_pair(anchor, term)
            anchor_mean = max(mean(df[anchor].tail(28).tolist()), 1.0)
            series = df[term]
            recent7 = mean(series.tail(7).tolist())
            prev21 = mean(series.iloc[-28:-7].tolist()) if len(series) >= 28 else mean(series.head(max(len(series)-7, 1)).tolist())
            recent28 = mean(series.tail(28).tolist())
            ratio = (recent7 / prev21) if prev21 > 0 else (2.0 if recent7 > 0 else 1.0)
            observations.append({
                "term": term,
                "category": item.get("category", "other"),
                "brand": item.get("brand"),
                "interest_7d": round(recent7, 1),
                "interest_prev21d": round(prev21, 1),
                "change_ratio": round(ratio, 2),
                "change_pct": round((ratio - 1.0) * 100, 1),
                "anchor_normalized": round(recent28 / anchor_mean, 2),
                "source": "Google Trends",
                "geo": "JP",
                "confidence": "medium",
            })
            print(f"[OK] {idx}/{len(terms)} {term}: 7d={recent7:.1f}, prev21d={prev21:.1f}", flush=True)
        except Exception as exc:
            msg = f"{type(exc).__name__}: {exc}"[:350]
            errors.append({"term": term, "error": msg})
            print(f"[ERROR] {idx}/{len(terms)} {term}: {msg}", flush=True)
        time.sleep(random.uniform(3.0, 6.0))

    observations.sort(key=lambda x: (x["change_ratio"], x["interest_7d"]), reverse=True)
    signals = [x for x in observations if x["change_ratio"] >= 1.25 and x["interest_7d"] >= 5][:20]
    old = load_json(OUT, {})
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    if not observations:
        old["last_attempt"] = now
        old["collector_status"] = "error"
        old["collector_errors"] = errors
        old.setdefault("source", {"name": "Google Trends", "method": "pytrends", "official_api": False, "geo": "JP"})
        OUT.write_text(json.dumps(old, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("[ERROR] Google Trends returned no usable observations; previous successful data preserved.", flush=True)
        # Collector failure should not make the whole repository workflow red.
        return 0

    result = {
        "schema_version": "1.1",
        "updated_at": now,
        "collector_status": "ok" if not errors else "partial",
        "source": {
            "name": "Google Trends",
            "method": "pytrends",
            "official_api": False,
            "geo": "JP",
            "timeframe": "today 1-m",
            "note": "Google Trendsの公開データを非公式クライアントpytrends経由で取得。指数は相対値であり検索件数ではありません。",
        },
        "anchor": anchor,
        "observations": observations,
        "signals": signals,
        "collector_errors": errors,
    }
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Collector finished: {len(observations)} observations / {len(signals)} signals / {len(errors)} errors", flush=True)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
