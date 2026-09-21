from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT_ID = "2026-09-22-daily"
REPORT_PATH = "reports/2026/09/2026-09-22-daily.html"
AS_OF_JA = "2026年9月22日 08:30 JST"
AS_OF_ISO = "2026-09-22T08:30:00+09:00"


def load_json(rel: str):
    return json.loads((ROOT / rel).read_text(encoding="utf-8"))


def dump_json(rel: str, obj):
    (ROOT / rel).write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def upsert_observation(series: list[dict], obs: dict, key: str = "period"):
    for i, old in enumerate(series):
        if old.get(key) == obs.get(key):
            series[i] = obs
            return
    series.append(obs)


def upsert_metric_observation(items: list[dict], obs: dict):
    for i, old in enumerate(items):
        if old.get("period") == obs.get("period") and old.get("metric") == obs.get("metric"):
            items[i] = obs
            return
    items.append(obs)


def topic_by_id(data: dict, topic_id: str):
    for topic in data.get("topics", []):
        if topic.get("topic_id") == topic_id:
            return topic
    return None


def add_topic_development(topic: dict | None, development: dict):
    if not topic:
        return
    devs = topic.setdefault("developments", [])
    key = (development.get("date"), development.get("headline"))
    devs[:] = [d for d in devs if (d.get("date"), d.get("headline")) != key]
    devs.insert(0, development)
    ids = topic.setdefault("related_report_ids", [])
    if REPORT_ID not in ids:
        ids.insert(0, REPORT_ID)


# ---------------------------------------------------------------------------
# 1. Persist newly verified primary / credible observations before prose use.
# ---------------------------------------------------------------------------
ocean = load_json("data/economy/ocean-freight-market.json")
series_by_id = {s.get("metric_id"): s for s in ocean.get("series", [])}
upsert_observation(
    series_by_id["drewry_wci"]["observations"],
    {
        "period": "2026-09-17",
        "value": 4500,
        "wow_pct": 1.0,
        "comparison": {"type": "wow", "base_period": "2026-09-10"},
        "published_at": "2026-09-17",
        "status": "official",
        "source_note": "Drewry World Container Index public tracker",
    },
)
upsert_observation(
    series_by_id["drewry_iaci"]["observations"],
    {
        "period": "2026-09-17",
        "value": 1402,
        "wow_pct": 6.0,
        "comparison": {"type": "wow", "base_period": "2026-09-10"},
        "published_at": "2026-09-17",
        "status": "official",
        "source_note": "Drewry Intra-Asia Container Index public tracker",
    },
)
upsert_observation(
    series_by_id["planned_blank_sailing_share"]["observations"],
    {
        "period": "2026-W39-W43",
        "value": 11.0,
        "planned_sailings": 720,
        "cancelled_sailings": 77,
        "window": "2026-09-21/2026-10-25",
        "published_at": "2026-09-18",
        "status": "official_forward_snapshot",
        "source_note": "Drewry Cancelled Sailings Tracker 18 Sep 2026",
    },
)
ocean["last_collected_at"] = "2026-09-21T23:30:00+00:00"
dump_json("data/economy/ocean-freight-market.json", ocean)

beauty_market = load_json("data/economy/beauty-market.json")
beauty_obs = beauty_market.setdefault("observations", [])
upsert_metric_observation(
    beauty_obs,
    {
        "period": "2025",
        "metric": "domestic_cosmetics_shipments_value",
        "value": 1390700000000,
        "unit": "JPY",
        "yoy": 1.2,
        "comparison_type": "YoY",
        "base_period": "2024",
        "published_at": "2026-09-17",
        "status": "official_industry_association_from_meti",
        "source": "日本化粧品工業会（経済産業省 生産動態統計）",
        "source_url": "https://www.jcia.org/user/statistics/shipment",
    },
)
for metric, value in [
    ("skincare_shipment_value_share", 45.2),
    ("haircare_shipment_value_share", 26.9),
    ("makeup_shipment_value_share", 20.2),
    ("special_use_shipment_value_share", 7.0),
    ("fragrance_shipment_value_share", 0.7),
]:
    upsert_metric_observation(
        beauty_obs,
        {
            "period": "2025",
            "metric": metric,
            "value": value,
            "unit": "percent_share",
            "comparison_type": "share",
            "published_at": "2026-09-17",
            "status": "official_industry_association_from_meti",
            "source": "日本化粧品工業会（経済産業省 生産動態統計）",
            "source_url": "https://www.jcia.org/user/statistics/shipment",
        },
    )
beauty_market["updated_at"] = AS_OF_ISO
dump_json("data/economy/beauty-market.json", beauty_market)

# ---------------------------------------------------------------------------
# 2. Report registry entry. Keep economics separate from today's ops decision.
# ---------------------------------------------------------------------------
report = {
    "date": "2026-09-22",
    "status": "watch",
    "as_of": AS_OF_JA,
    "sample": False,
    "id": REPORT_ID,
    "type": "daily",
    "period": "2026-09-22",
    "title": "物流・化粧品インテリジェンス・ブリーフ — DAILY",
    "summary": "台風25号後も関東発→北海道向け宅配に全商品遅延が残る一方、全国一律停止は不要。NACCS関連では一部手数料の電子納付が9月24日08:30まで計画停止中。海上はSuez復帰がservice単位で進むが、域内運賃とblank sailingを含む実効供給制約は継続。",
    "bottom_line": "関東発→北海道のSLA-critical貨物はdispatch前にcarrier lead timeを確認し、必要時のみcutoff前倒し・代替手段を検討する。NACCSの対象手数料業務は電子納付を前提にせず代替手続を確認。海上はSuez復帰を全面正常化とみなさず、重点輸入レーンはservice routing・ETA・接続を個別確認する。Beautyは短期promotion/launchと発送休業をorganic demandから分離する。",
    "key_issues": [
        "ヤマト運輸: 2026-09-22 08:00時点で関東地域発→北海道行きの全商品に台風25号由来の遅延",
        "NACCS関連: RPC/RPE/AEC/CPC/WCPの手数料電子納付等が2026-09-18 19:00〜09-24 08:30に計画停止",
        "Drewry WCI 4,500 USD/40ft、WoW +1.0%（2026-09-17 vs 2026-09-10）; IACI 1,402 USD/40ft、WoW +6.0%（同）",
        "Drewry: 2026-W39〜W43の主要East-West予定720便中77便がcancel予定、blank sailing share 11%",
        "Hapag-Lloyd: NE4東航は2026-09-22からRed Sea/Suez routingへ移行。service単位の復帰であり全面正常化ではない",
        "Brand.com: Diptyqueオンライン発送・CSは9月22日休業。資生堂INOUI限定色は9月21日から予約開始。短期波動をorganic demandと分離",
    ],
    "tags": ["Daily", "Typhoon 25", "Domestic Delivery", "NACCS", "Suez", "IACI", "Beauty promotion"],
    "status_board": {
        "domestic": "watch",
        "weather": "watch",
        "customs": "watch",
        "ocean": "watch",
        "air": "unconfirmed",
        "global": "watch",
    },
    "signals": {
        "wci": {
            "value": 4500,
            "unit": "USD/40ft",
            "data_date": "2026-09-17",
            "source": "https://www.drewry.co.uk/trackers-and-indices/latest-trackers-and-indices/world-container-index-assessed-by-drewry",
        },
        "scfi": {"value": None, "unit": None, "data_date": None, "source": None},
    },
    "cost_snapshot": {
        "as_of": AS_OF_ISO,
        "metrics": {
            "regular_gasoline_national": {
                "value": 169.9,
                "unit": "JPY/L",
                "data_date": "2026-09-14",
                "source": "資源エネルギー庁 石油製品価格調査 / data/economy/fuel-prices.json",
            },
            "diesel_national": {
                "value": 159.3,
                "unit": "JPY/L",
                "data_date": "2026-09-14",
                "source": "資源エネルギー庁 石油製品価格調査 / data/economy/fuel-prices.json",
            },
            "drewry_wci": {
                "value": 4500,
                "unit": "USD/40ft",
                "data_date": "2026-09-17",
                "source": "Drewry World Container Index / data/economy/ocean-freight-market.json",
            },
            "drewry_iaci": {
                "value": 1402,
                "unit": "USD/40ft",
                "data_date": "2026-09-17",
                "source": "Drewry Intra-Asia Container Index / data/economy/ocean-freight-market.json",
            },
        },
        "interpretation_ja": "Daily作成時点の直近検証済み公表値。燃料・spot海上運賃はphysical demandや本日の実輸送capacityと同一視しない。IACI上昇とblank sailingは供給制約の補助材料だが、運用変更はcarrierのobserved impactとservice別routingを優先する。",
    },
    "intelligence": {
        "disruption": [
            {
                "id": "japan-domestic-delivery",
                "signal": "ヤマト運輸は2026年9月22日08:00時点で、関東地域発→北海道行きの全商品に台風25号の影響による遅延を掲示。八丈島・青ヶ島、南西諸島等の局地例外も継続している。",
                "lens": "disruption",
                "direction": "rising",
                "impact": "high",
                "change_status": "deteriorating",
                "confidence": "high",
                "evidence": [{"source": "ヤマト運輸", "date": "2026-09-22", "url": "https://www.kuronekoyamato.co.jp/ytc/chien/chien_hp.html"}],
                "operational_implication": "関東発→北海道の時限貨物は通常lead timeを固定前提にせず、carrier受託・到着見込みをdispatch前に確認する。",
                "action_direction": "SLA-critical貨物のみcutoff前倒し・代替輸送を検討し、全国一律の出荷停止へ一般化しない。",
            },
            {
                "id": "japan-weather-disruption",
                "signal": "台風25号の通過後も国内配送ネットワークに残留影響があり、関東→北海道および島しょ・南西諸島で遅延が確認される。",
                "lens": "disruption",
                "direction": "stable",
                "impact": "medium",
                "change_status": "unchanged",
                "confidence": "high",
                "evidence": [{"source": "ヤマト運輸", "date": "2026-09-22", "url": "https://www.kuronekoyamato.co.jp/ytc/chien/chien_hp.html"}],
                "operational_implication": "予報ではなく実際のcarrier制限を基準に、対象レーンのみ例外管理する。",
                "action_direction": "遅延対象外の国内出荷は通常運用を維持する。",
            },
            {
                "id": "middle-east-maritime-risk",
                "signal": "Hapag-Lloyd/MaerskはNE4など一部serviceをRed Sea/Suez routingへ戻し、NE4 eastboundは2026年9月22日から移行。一方、安全保障条件と他serviceの移行時期には不確実性が残り、全面正常化ではない。",
                "lens": "disruption",
                "direction": "volatile",
                "impact": "high",
                "change_status": "unchanged_high_risk",
                "confidence": "high",
                "evidence": [{"source": "Hapag-Lloyd", "date": "2026-09-21", "url": "https://www.hapag-lloyd.com/en/services-information/news/2026/09/routing-update-for-our-ne4--se1--se2-and-iex-services.html"}],
                "operational_implication": "Suez復帰の一般論ではなく、booking対象serviceの実routing・接続・ETAを確認する。",
                "action_direction": "重点輸入レーンは主要T/S接続とETA varianceをshipment単位で確認する。",
            },
        ],
        "cost_capacity": [],
        "reliability": [],
        "demand_commerce": [
            {
                "id": "beauty-japan-ec-promotion",
                "signal": "設定済みBrand.com群を巡回し、9月22日はDiptyqueオンラインストアの発送・カスタマーサービス休業を確認。資生堂INOUI限定色は9月21日から予約開始しており、launch/promotion起因の短期波動はあるがorganic demand上振れの新証拠ではない。",
                "lens": "demand_commerce",
                "direction": "volatile",
                "impact": "medium",
                "change_status": "new",
                "confidence": "high",
                "demand_driver": "promotion",
                "duration": "temporary",
                "evidence": [
                    {"source": "Diptyque Japan", "date": "2026-09-14", "url": "https://jp.diptyqueparis.com/ja-jp/pages/information"},
                    {"source": "資生堂オンラインストア INOUI", "date": "2026-09-21", "url": "https://www.shiseido.co.jp/sw/onlinestore/campaign/inoui/261021/"},
                ],
                "operational_implication": "発送休業・予約施策をEC/倉庫の短期波動として扱い、基礎需要予測から分離する。",
                "action_direction": "Brand×Category×Channelでcutoff・GWP/同梱・予約出荷を確認し、在庫を一律に積み増さない。",
            }
        ],
        "regulatory_structural": [
            {
                "id": "japan-customs-naccs",
                "signal": "NACCS連携の歳入金電子納付システムは、2026年9月18日19:00〜9月24日08:30にRPC/RPE/AEC/CPC/WCP関連の手数料電子納付等を計画停止中。NACCS全体停止ではない。",
                "lens": "regulatory_structural",
                "direction": "volatile",
                "impact": "medium",
                "change_status": "new",
                "confidence": "high",
                "evidence": [{"source": "NACCS掲示板", "date": "2026-09-07", "url": "https://bbs.naccscenter.com/docs/2026090700017/"}],
                "operational_implication": "対象手続を本日行う場合、電子納付を前提にせず書面・印紙等の代替手順を事前確認する。",
                "action_direction": "該当業務のみ手順切替を行い、通関全体の停止とは扱わない。",
            }
        ],
    },
    "change_summary": {
        "comparison_base": "2026-09-21-daily",
        "new": ["japan-customs-naccs", "beauty-japan-ec-promotion"],
        "deteriorating": ["japan-domestic-delivery"],
        "improving": [],
        "resolved": [],
        "unchanged_high_risk": ["middle-east-maritime-risk"],
    },
    "path": REPORT_PATH,
}

reports = load_json("data/reports.json")
old_ids = {r.get("id") for r in reports.get("reports", [])}
reports["reports"] = [r for r in reports.get("reports", []) if r.get("id") != REPORT_ID]
reports["reports"].insert(0, report)
new_ids = {r.get("id") for r in reports.get("reports", [])}
missing = old_ids - new_ids
if missing:
    raise RuntimeError(f"existing report IDs disappeared: {sorted(missing)}")
dump_json("data/reports.json", reports)

# ---------------------------------------------------------------------------
# 3. Critical radar / topic digests — additive, preserve history.
# ---------------------------------------------------------------------------
critical = load_json("data/critical-news.json")
new_item = {
    "id": "2026-09-22-typhoon25-kanto-hokkaido-delivery-delay",
    "date": "2026-09-22",
    "event_date": "2026-09-22",
    "headline": "台風25号の残留影響で関東発→北海道向け全商品に配送遅延",
    "domain": "domestic_delivery",
    "importance": "high",
    "japan_relevance": "high",
    "operational_scope": "network",
    "status": "observed",
    "market_dimension": "risk",
    "market_materiality": "material",
    "market_change": "deterioration",
    "time_horizon": "immediate",
    "confidence": "high",
    "summary": "ヤマト運輸は9月22日08:00時点で、関東地域発から北海道行きの全商品に台風25号の影響によるお届け遅延を掲示。遅延了承のうえ荷受けは継続している。",
    "observed_impact": "carrierの実運用として関東→北海道の広域レーンに全商品遅延が残存。全国一律の荷受停止ではなく、対象レーンのlead time悪化として確認された。",
    "japan_implication": "関東から北海道へ向かう店舗補充・EC・時限貨物は通常lead timeを固定前提にできない。",
    "operational_implication": "SLA-critical貨物はdispatch前にcarrierの到着見込みを確認し、必要時のみcutoff前倒し・代替手段を検討する。全国一律停止へ一般化しない。",
    "topic_ids": ["japan-weather-disruption", "japan-domestic-delivery"],
    "evidence": [{"class": "primary_operational", "source": "ヤマト運輸", "date": "2026-09-22", "url": "https://www.kuronekoyamato.co.jp/ytc/chien/chien_hp.html"}],
}
critical["items"] = [x for x in critical.get("items", []) if x.get("id") != new_item["id"]]
critical["items"].insert(0, new_item)
critical["updated_at"] = AS_OF_ISO
dump_json("data/critical-news.json", critical)

topics = load_json("data/topic-intelligence.json")
topics["updated_at"] = AS_OF_ISO
weather = topic_by_id(topics, "japan-weather-disruption")
if weather:
    weather["current_state"] = "watch"
    weather["summary"] = "台風25号の通過後も残留影響があり、9月22日08:00時点で関東発→北海道向け宅配の全商品遅延が確認される。全国一律の停止ではなく、対象レーンと島しょ等を例外管理する局面。"
    weather["japan_implication"] = "関東→北海道の時限貨物と、島しょ・南西諸島の配送では通常lead timeを固定前提にできない。"
    weather["operational_implication"] = "carrierのobserved impactを基準に対象レーンのみdispatch前確認し、全国一律の出荷停止には一般化しない。"
    weather["outlook_7d"] = "関東→北海道の遅延解消と、島しょ・南西諸島の海空輸送正常化を日次確認する。"
    add_topic_development(weather, {
        "date": "2026-09-22", "type": "observed_impact",
        "headline": "関東発→北海道向け全商品に台風25号由来の遅延が残存",
        "summary": "ヤマト運輸は9月22日08:00時点で関東地域発→北海道行きの全商品に遅延を掲示。荷受けは遅延了承のうえ継続。",
        "evidence": [{"class": "primary_operational", "source": "ヤマト運輸", "url": "https://www.kuronekoyamato.co.jp/ytc/chien/chien_hp.html"}],
    })

domestic = topic_by_id(topics, "japan-domestic-delivery")
if domestic:
    domestic["current_state"] = "watch"
    domestic["summary"] = "9月22日は台風25号の残留影響として関東発→北海道向け全商品遅延が確認され、八丈島・青ヶ島、能登、南西諸島等の局地例外も残る。全国一律停止ではなくレーン別例外管理が必要。"
    domestic["japan_implication"] = "関東→北海道の時限貨物、島しょ・災害影響地域を分け、通常lead timeを固定前提にしない。"
    domestic["operational_implication"] = "carrier受付・到着見込みを対象shipmentごとに確認し、SLA-criticalのみ代替手段を準備する。"
    domestic["outlook_7d"] = "関東→北海道の遅延収束と局地配送の受付・輸送正常化を確認する。"
    add_topic_development(domestic, {
        "date": "2026-09-22", "type": "observed_impact",
        "headline": "関東発→北海道の宅配遅延を新たな広域例外として確認",
        "summary": "ヤマト運輸は関東地域発→北海道行きの全商品に台風25号由来の遅延を掲示。全国一律停止ではなく対象レーンのlead time悪化。",
        "evidence": [{"class": "primary_operational", "source": "ヤマト運輸", "url": "https://www.kuronekoyamato.co.jp/ytc/chien/chien_hp.html"}],
    })

middle_east = topic_by_id(topics, "middle-east-maritime-risk")
if middle_east:
    middle_east["current_state"] = "watch"
    middle_east["summary"] = "一部Gemini serviceのRed Sea/Suez復帰が進み、NE4 eastboundは9月22日から移行。一方でserviceごとの実施時期が異なり、安全保障条件も残るため全面正常化とは扱わない。"
    middle_east["operational_implication"] = "Suez復帰を一括適用せず、輸送会社・service・voyage単位でrouting、寄港、ETA、surchargeを確認する。"
    add_topic_development(middle_east, {
        "date": "2026-09-22", "type": "reported_event",
        "headline": "NE4 eastboundがRed Sea/Suez routingへ移行",
        "summary": "Hapag-LloydはNE4 eastboundのMaastricht Maersk 637Eについて、Algeciras ETD 9月22日からRed Sea/Suez routingへ移行すると案内。SE2/IEX等は別日程で、service単位の変更。",
        "evidence": [{"class": "primary_operational", "source": "Hapag-Lloyd", "url": "https://www.hapag-lloyd.com/en/services-information/news/2026/09/routing-update-for-our-ne4--se1--se2-and-iex-services.html"}],
    })

customs = topic_by_id(topics, "japan-customs-naccs")
if customs:
    customs["current_state"] = "watch"
    customs["summary"] = "NACCS連携の歳入金電子納付システムは9月18日19:00〜9月24日08:30に一部手数料業務を計画停止中。NACCS全体停止ではなく、対象業務の代替納付手順が必要。"
    customs["operational_implication"] = "RPC/RPE/AEC/CPC/WCPを利用する場合は電子納付を前提にせず、案内された書面・印紙等の代替手順を確認する。"
    add_topic_development(customs, {
        "date": "2026-09-22", "type": "observed_impact",
        "headline": "一部手数料の電子納付等が計画停止期間中",
        "summary": "歳入金電子納付システム連携の計画停止は9月24日08:30まで継続。対象はRPC/RPE/AEC/CPC/WCP関連で、NACCS全体停止ではない。",
        "evidence": [{"class": "primary_operational", "source": "NACCS掲示板", "url": "https://bbs.naccscenter.com/docs/2026090700017/"}],
    })

beauty_topic = topic_by_id(topics, "beauty-japan-ec-promotion")
if beauty_topic:
    beauty_topic["current_state"] = "watch"
    beauty_topic["summary"] = "Brand.com巡回では9月22日のDiptyque発送・CS休業と、9月21日開始の資生堂INOUI限定色予約など短期calendar/launch要因を確認。organic demand上振れとは分離する。"
    beauty_topic["operational_implication"] = "Brand×Category×Channelでcutoff・予約・GWP/同梱を確認し、短期波動を基礎需要予測から分離する。"
    add_topic_development(beauty_topic, {
        "date": "2026-09-22", "type": "observed_impact",
        "headline": "Brand.com発送休業と予約施策が短期波動要因",
        "summary": "Diptyqueは9月22日にオンライン発送・カスタマーサービスを休業。資生堂INOUI限定色は9月21日から予約受付。いずれもorganic demandの新証拠ではない。",
        "evidence": [
            {"class": "primary_operational", "source": "Diptyque Japan", "url": "https://jp.diptyqueparis.com/ja-jp/pages/information"},
            {"class": "primary_operational", "source": "資生堂オンラインストア", "url": "https://www.shiseido.co.jp/sw/onlinestore/campaign/inoui/261021/"},
        ],
    })

dump_json("data/topic-intelligence.json", topics)

# ---------------------------------------------------------------------------
# 4. Build full report from the CURRENT canonical report template shell.
#    The main content is freshly generated; old report HTML is never copied.
# ---------------------------------------------------------------------------
template = (ROOT / "templates/report-template.html").read_text(encoding="utf-8")
template = re.sub(r"\A\s*<!DOCTYPE html>\s*<!--.*?-->", "<!DOCTYPE html>", template, count=1, flags=re.S)
main_marker = '<main class="app-main" id="main">'
if main_marker not in template or "</main>" not in template:
    raise RuntimeError("canonical report template main shell markers not found")
prefix, rest = template.split(main_marker, 1)
_, suffix = rest.split("</main>", 1)

main = r'''
<main class="app-main" id="main">
  <div class="wrap report">
    <nav class="breadcrumb" aria-label="パンくずリスト">
      <ol>
        <li><a href="../../../index.html">ホーム</a></li>
        <li><a href="../../../archive.html">過去のレポート</a></li>
        <li><a href="../../../archive.html?year=2026">2026</a></li>
        <li><a href="../../../archive.html?year=2026&amp;month=09">9月</a></li>
        <li aria-current="page">2026年9月22日（火） デイリー</li>
      </ol>
    </nav>

    <nav class="timeline-nav no-print" aria-label="レポート間の移動（上部）">
      <span class="tl-prev is-disabled" data-tl="prev"></span>
      <span class="tl-center" data-tl="center"><a href="../../../archive.html">過去のレポート</a></span>
      <span class="tl-next is-disabled" data-tl="next"></span>
    </nav>

    <header class="report-head" data-status="watch">
      <p class="eyebrow">デイリー</p>
      <h1>2026年9月22日（火） 物流・化粧品インテリジェンス・ブリーフ</h1>
      <div class="chip-row"><span class="status-pill" data-status="watch"><span class="dot"></span><span>総合ステータス</span>: <span>Watch</span></span></div>
      <div class="report-head__meta">
        <span><time datetime="2026-09-22">2026年9月22日（火）</time></span>
        <span>基準時点: 2026年9月22日 08:30 JST</span>
        <span>出典: 公開情報のみ</span>
        <span><a href="#" data-print>印刷・PDF</a></span>
      </div>
    </header>

    <section aria-labelledby="board-h">
      <h2 id="board-h">物流ステータス</h2>
      <div class="status-board">
        <div class="status-cell" data-status="watch"><div class="status-cell__name">国内配送</div><div class="status-cell__value"><span class="dot"></span><span>監視</span></div><p class="status-cell__note">関東発→北海道で全商品遅延。全国一律停止ではない。</p></div>
        <div class="status-cell" data-status="watch"><div class="status-cell__name">気象・災害</div><div class="status-cell__value"><span class="dot"></span><span>監視</span></div><p class="status-cell__note">台風25号の残留影響をcarrier実績ベースで管理。</p></div>
        <div class="status-cell" data-status="watch"><div class="status-cell__name">通関・法令</div><div class="status-cell__value"><span class="dot"></span><span>監視</span></div><p class="status-cell__note">一部手数料の電子納付等が9月24日08:30まで計画停止。</p></div>
        <div class="status-cell" data-status="watch"><div class="status-cell__name">海上輸送</div><div class="status-cell__value"><span class="dot"></span><span>監視</span></div><p class="status-cell__note">Suez復帰と域内rate/blank sailing制約が併存。</p></div>
        <div class="status-cell" data-status="unconfirmed"><div class="status-cell__name">航空貨物</div><div class="status-cell__value"><span class="dot"></span><span>未確認</span></div><p class="status-cell__note">全国規模の新規航空貨物停止は確認できず。局地weather影響はcarrier単位で確認。</p></div>
        <div class="status-cell" data-status="watch"><div class="status-cell__name">グローバルサプライチェーン</div><div class="status-cell__value"><span class="dot"></span><span>監視</span></div><p class="status-cell__note">Red Sea/Suez routingはservice単位で移行。全面正常化とは扱わない。</p></div>
      </div>
    </section>

    <section aria-labelledby="chg-h">
      <h2 id="chg-h">前回からの変化</h2>
      <div class="changes">
        <p class="changes__meta"><span>比較対象: <a href="2026-09-21-daily.html">2026年9月21日（月） デイリー</a></span><span>同じWatchでも対象レーン・手続の例外が更新</span></p>
        <ul class="change-list">
          <li class="change-row" data-direction="side"><span class="change-row__key">総合</span><span class="change-row__from"><span class="status-pill" data-status="watch"><span class="dot"></span>Watch</span></span><span class="change-row__arrow" aria-hidden="true">&rarr;</span><span class="change-row__to"><span class="status-pill" data-status="watch"><span class="dot"></span>Watch</span></span></li>
          <li class="change-row" data-direction="worse"><span class="change-row__key">通関・法令</span><span class="change-row__from"><span class="status-pill" data-status="normal"><span class="dot"></span>平常</span></span><span class="change-row__arrow" aria-hidden="true">&rarr;</span><span class="change-row__to"><span class="status-pill" data-status="watch"><span class="dot"></span>監視</span></span></li>
        </ul>
        <div class="change-groups">
          <div class="change-group" data-kind="new"><p class="eyebrow">新規・悪化</p><ul><li>関東発→北海道の全商品遅延を新たな広域例外として確認。</li><li>NACCS関連の一部手数料電子納付等が計画停止期間中。</li><li>Brand.comで発送休業・予約施策の短期波動を確認。</li></ul></div>
          <div class="change-group" data-kind="improved"><p class="eyebrow">改善</p><p class="none">全国一律の追加停止は確認せず。</p></div>
          <div class="change-group" data-kind="resolved"><p class="eyebrow">解消</p><p class="none">なし</p></div>
        </div>
      </div>
    </section>

    <section aria-labelledby="sig-list-h"><h2 id="sig-list-h">構造化シグナル</h2><div id="report-signals"></div></section>

    <section aria-labelledby="summary-h">
      <h2 id="summary-h">本日の結論</h2>
      <p class="fact"><span class="fact__label">Fact</span> ヤマト運輸は9月22日08:00時点で、関東地域発→北海道行きの全商品に台風25号由来の遅延を掲示。NACCS関連では一部手数料の電子納付等が9月24日08:30まで計画停止中です。</p>
      <div class="analysis"><p><strong>運用判断:</strong> 全国一律の出荷停止・緊急モード切替は不要です。関東→北海道のSLA-critical貨物と、対象NACCS手続だけを通常フローから外して確認します。海上はSuez復帰を全面正常化とみなさず、重点輸入レーンのservice routing・ETA・接続を個別確認します。</p></div>
    </section>

    <section aria-labelledby="action-h">
      <h2 id="action-h">今日やること</h2>
      <div class="priority-list">
        <article class="priority-item"><p class="eyebrow">国内</p><h3>関東→北海道はSLA別に確認</h3><p>時限・発売日・店舗補充など遅延許容度が低い貨物だけ、carrier到着見込み、cutoff前倒し、代替輸送の可否を確認します。</p></article>
        <article class="priority-item"><p class="eyebrow">通関</p><h3>対象NACCS手続は電子納付を前提にしない</h3><p>RPC/RPE/AEC/CPC/WCPを本日利用する場合は、NACCS案内の書面・印紙等の代替手順を事前確認します。NACCS全体停止とは扱いません。</p></article>
        <article class="priority-item"><p class="eyebrow">海上</p><h3>Suez復帰はservice/voyage単位</h3><p>NE4 eastboundは9月22日からRed Sea/Suez routingへ移行。ほかのserviceは別日程で、安全保障条件も残るためrouting・寄港・ETA・surchargeを個別確認します。</p></article>
        <article class="priority-item"><p class="eyebrow">Beauty</p><h3>promotion/launchとorganic demandを分離</h3><p>Diptyqueの9月22日発送・CS休業、資生堂INOUI予約施策などは短期calendar要因としてcapacityへ反映し、在庫を一律に積み増しません。</p></article>
      </div>
    </section>

    <details class="fold" open>
      <summary>国内配送・気象</summary>
      <div class="fold__body">
        <p class="fact"><span class="fact__label">Observed Impact</span> ヤマト運輸は関東地域発→北海道行きの全商品について、台風25号の影響で遅延が発生していると案内。遅延了承のうえ荷受けは継続しています。</p>
        <p class="fact"><span class="fact__label">Observed Impact</span> 八丈島・青ヶ島、鹿児島の島しょ部、沖縄全域などでも海空輸送の制約による遅延が継続しています。</p>
        <div class="analysis"><p>対象レーンの実影響はある一方、全国ネットワーク停止ではありません。障害範囲を拡大解釈せず、shipment単位で例外管理します。</p></div>
      </div>
    </details>

    <details class="fold" open>
      <summary>通関・NACCS</summary>
      <div class="fold__body">
        <p class="fact"><span class="fact__label">Reported Event</span> 歳入金電子納付システムとの連携機能は9月18日19:00〜9月24日08:30に計画停止。RPC/RPE/AEC/CPC/WCP関連の手数料で電子納付等が利用できません。</p>
        <div class="analysis"><p>NACCS全体の停止ではありません。対象業務だけ代替納付手順へ切り替えるのが適切です。</p></div>
      </div>
    </details>

    <details class="fold" open>
      <summary>海上輸送・実効供給力</summary>
      <div class="fold__body">
        <p class="fact"><span class="fact__label">Rate</span> Drewry WCIは4,500 USD/40ft、WoW +1.0%（2026-09-17 vs 2026-09-10）。IACIは1,402 USD/40ft、WoW +6.0%（同）で4週連続の過去最高。</p>
        <p class="fact"><span class="fact__label">Supply</span> 2026-W39〜W43は主要East-West予定720便中77便がcancel予定、blank sailing shareは11%。89%の予定便は運航見込みです。</p>
        <p class="fact"><span class="fact__label">Reported Event</span> Hapag-Lloyd/MaerskはNE4、SE2、IEX等をRed Sea/Suez routeへ段階移行し、NE4 eastboundは9月22日から変更。</p>
        <div class="analysis"><p>Rate、blank sailing、routing変更を同じ概念にまとめません。IACI上昇は域内cost pressure、blank sailingは予定供給調整、Suez復帰はservice-specific routing changeです。重点輸入レーンは実bookingのspace、接続、ETA varianceで判断します。</p></div>
      </div>
    </details>

    <details class="fold">
      <summary>Beauty / Brand.com</summary>
      <div class="fold__body">
        <p class="fact"><span class="fact__label">Promotion / Commerce</span> 設定済みBrand.com群をMakeup / Skincare / Fragrance横断で巡回。Diptyqueは9月22日・23日にオンライン発送とカスタマーサービスを休業。注文受付は継続します。</p>
        <p class="fact"><span class="fact__label">Launch / Promotion</span> 資生堂INOUI限定色08/09は9月21日〜10月16日に予約受付、10月21日発売。予約特典は数量限定です。</p>
        <p class="fact"><span class="fact__label">Structural context</span> 日本化粧品工業会が9月17日に更新した2025年国内化粧品出荷額は1兆3,907億円、YoY +1.2%（2025 vs 2024）。この年次統計は本日の在庫増減判断には直接使いません。</p>
        <div class="analysis"><p>発送休業・予約施策は短期波動、年次市場統計は構造文脈です。どちらもorganic demandの本日急増を示すものではありません。</p></div>
      </div>
    </details>

    <details class="fold">
      <summary>コストスナップショット</summary>
      <div class="fold__body">
        <ul>
          <li>レギュラーガソリン全国平均: 169.9 JPY/L（2026-09-14）</li>
          <li>軽油全国平均: 159.3 JPY/L（2026-09-14）</li>
          <li>Drewry WCI: 4,500 USD/40ft（2026-09-17、WoW +1.0% vs 2026-09-10）</li>
          <li>Drewry IACI: 1,402 USD/40ft（2026-09-17、WoW +6.0% vs 2026-09-10）</li>
        </ul>
        <p class="note">価格指標をphysical demandや本日の実輸送capacityと同一視しません。</p>
      </div>
    </details>

    <section class="evidence-block" aria-labelledby="src-h">
      <h2 id="src-h">主な出典</h2>
      <ul>
        <li><a href="https://www.kuronekoyamato.co.jp/ytc/chien/chien_hp.html">ヤマト運輸 — お荷物の集配および営業所の営業状況</a>（2026-09-22 08:00）</li>
        <li><a href="https://bbs.naccscenter.com/docs/2026090700017/">NACCS掲示板 — 手数料納付関連業務に係る電子納付等の停止</a></li>
        <li><a href="https://www.drewry.co.uk/trackers-and-indices/latest-trackers-and-indices/world-container-index-assessed-by-drewry">Drewry — World Container Index / Intra-Asia Container Index</a>（2026-09-17）</li>
        <li><a href="https://www.drewry.co.uk/supply-chain-advisors/supply-chain-expertise/cancelled-sailings-tracker">Drewry — Cancelled Sailings Tracker</a>（2026-09-18）</li>
        <li><a href="https://www.hapag-lloyd.com/en/services-information/news/2026/09/routing-update-for-our-ne4--se1--se2-and-iex-services.html">Hapag-Lloyd — Routing update for NE4, SE1, SE2 and IEX</a></li>
        <li><a href="https://jp.diptyqueparis.com/ja-jp/pages/information">Diptyque Japan — シルバーウィーク休業案内</a></li>
        <li><a href="https://www.shiseido.co.jp/sw/onlinestore/campaign/inoui/261021/">資生堂オンラインストア — INOUI予約キャンペーン</a></li>
        <li><a href="https://www.jcia.org/user/statistics/shipment">日本化粧品工業会 — 化粧品出荷</a>（2026-09-17更新）</li>
      </ul>
    </section>

    <nav class="timeline-nav no-print" aria-label="レポート間の移動（下部）">
      <span class="tl-prev is-disabled" data-tl="prev"></span>
      <span class="tl-center" data-tl="center"><a href="../../../archive.html">過去のレポート</a></span>
      <span class="tl-next is-disabled" data-tl="next"></span>
    </nav>
  </div>
</main>
'''

html = prefix + main + suffix
for token, value in {
    "{{DATE_JA}}": "2026年9月22日（火）",
    "{{TYPE_JA}}": "デイリー",
    "{{SUMMARY_ONE_LINE}}": "台風25号後の関東→北海道配送遅延、NACCS一部電子納付停止、Suez service別復帰を反映した2026年9月22日Daily Exception Intelligence。",
    "{{DATE}}": "2026-09-22",
    "{{TYPE}}": "daily",
}.items():
    html = html.replace(token, value)
if "{{" in html or "}}" in html:
    raise RuntimeError("unresolved template placeholder remains in report shell")
report_file = ROOT / REPORT_PATH
report_file.parent.mkdir(parents=True, exist_ok=True)
report_file.write_text(html, encoding="utf-8")

# Contract / preservation sanity checks before repository validators.
json.loads((ROOT / "data/reports.json").read_text(encoding="utf-8"))
json.loads((ROOT / "data/critical-news.json").read_text(encoding="utf-8"))
json.loads((ROOT / "data/topic-intelligence.json").read_text(encoding="utf-8"))
json.loads((ROOT / "data/economy/ocean-freight-market.json").read_text(encoding="utf-8"))
json.loads((ROOT / "data/economy/beauty-market.json").read_text(encoding="utf-8"))
if not report_file.exists():
    raise RuntimeError("report HTML was not created")
if '<nav class="app-rail"' not in html or 'id="tool-help" title="キーボードショートカット"' not in html:
    raise RuntimeError("canonical shell rail is missing")
if '<div class="changes changes--none">' in html:
    raise RuntimeError("comparison block contains mutually exclusive no-data variant")
print("2026-09-22 Daily content generated and preservation checks passed")
