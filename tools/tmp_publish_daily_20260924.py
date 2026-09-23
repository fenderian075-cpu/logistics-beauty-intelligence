#!/usr/bin/env python3
from __future__ import annotations

import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC_PATH = ROOT / "data/tmp-daily-20260924.json"
TEMPLATE_PATH = ROOT / "templates/report-template.html"
REPORTS_PATH = ROOT / "data/reports.json"
CRITICAL_PATH = ROOT / "data/critical-news.json"
TOPICS_PATH = ROOT / "data/topic-intelligence.json"
REGISTRY_PATH = ROOT / "data/signal-registry.json"
REPORT_PATH = ROOT / "reports/2026/09/2026-09-24-daily.html"
TARGET_ID = "2026-09-24-daily"
UPDATED_AT = "2026-09-24T08:00:00+09:00"


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def dump_compact(path: Path, obj) -> None:
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one occurrence, found {count}")
    return text.replace(old, new, 1)


def extract_block(text: str, pattern: str, label: str) -> str:
    m = re.search(pattern, text, flags=re.S)
    if not m:
        raise RuntimeError(f"{label}: canonical block not found")
    return m.group(0)


def issue_html(issue: dict) -> str:
    return f'''      <article class="item">
        <h3 class="item__title">{html.escape(issue["title"])}</h3>
        <div class="chip-row">
          <span class="chip-row__label">重要度</span>
          <span class="chip" data-level="{html.escape(issue["importance"])}"><span class="dot"></span>{html.escape(issue["importance_label"])}</span>
          <span class="chip-row__label">日本への関連度</span>
          <span class="chip" data-level="{html.escape(issue["relevance"])}"><span class="dot"></span>{html.escape(issue["relevance_label"])}</span>
        </div>
        <p class="fact"><span class="fact__label">Fact</span>{html.escape(issue["fact"])}</p>
        <div class="analysis">
          <p><span class="analysis__label">分析</span>{html.escape(issue["analysis"])}</p>
        </div>
        <p class="source-note">出典: <a href="{html.escape(issue["source_url"], quote=True)}">{html.escape(issue["source_name"])}</a>（{html.escape(issue["source_date"]) }）</p>
      </article>'''


def render_report(spec: dict) -> str:
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    body = spec["report_body"]
    entry = spec["report_entry"]

    replacements = {
        "{{TYPE}}": "daily",
        "{{TYPE_JA}}": "デイリー",
        "{{DATE}}": entry["date"],
        "{{DATE_JA}}": body["date_ja"],
        "{{YEAR}}": "2026",
        "{{MONTH}}": "09",
        "{{MONTH_JA}}": body["month_ja"],
        "{{STATUS}}": entry["status"],
        "{{STATUS_LABEL}}": body["status_label"],
        "{{SUMMARY_ONE_LINE}}": html.escape(body["summary_one_line"], quote=True),
        "{{TITLE}}": body["title"],
        "{{AS_OF}}": body["as_of"],
        "{{S_DOMESTIC}}": entry["status_board"]["domestic"],
        "{{S_DOMESTIC_LABEL}}": body["status_labels_ja"]["domestic"],
        "{{S_DOMESTIC_NOTE}}": html.escape(body["status_notes"]["domestic"]),
        "{{S_WEATHER}}": entry["status_board"]["weather"],
        "{{S_WEATHER_LABEL}}": body["status_labels_ja"]["weather"],
        "{{S_WEATHER_NOTE}}": html.escape(body["status_notes"]["weather"]),
        "{{S_CUSTOMS}}": entry["status_board"]["customs"],
        "{{S_CUSTOMS_LABEL}}": body["status_labels_ja"]["customs"],
        "{{S_CUSTOMS_NOTE}}": html.escape(body["status_notes"]["customs"]),
        "{{S_OCEAN}}": entry["status_board"]["ocean"],
        "{{S_OCEAN_LABEL}}": body["status_labels_ja"]["ocean"],
        "{{S_OCEAN_NOTE}}": html.escape(body["status_notes"]["ocean"]),
        "{{S_AIR}}": entry["status_board"]["air"],
        "{{S_AIR_LABEL}}": body["status_labels_ja"]["air"],
        "{{S_AIR_NOTE}}": html.escape(body["status_notes"]["air"]),
        "{{S_GLOBAL}}": entry["status_board"]["global"],
        "{{S_GLOBAL_LABEL}}": body["status_labels_ja"]["global"],
        "{{S_GLOBAL_NOTE}}": html.escape(body["status_notes"]["global"]),
        "{{EXEC_SUMMARY}}": html.escape(body["exec_summary"]),
        "{{BOTTOM_LINE}}": html.escape(body["bottom_line"]),
        "{{PORTS}}": body["details"]["ports"],
        "{{CARRIERS}}": body["details"]["carriers"],
        "{{REGULATIONS}}": body["details"]["regulations"],
        "{{INDICES}}": body["details"]["indices"],
        "{{SECONDARY}}": body["details"]["secondary"],
        "{{BEAUTY}}": body["details"]["beauty"],
        "{{WCI_VALUE}}": body["wci_value"],
        "{{WCI_DATE}}": body["wci_date"],
    }

    rendered = template
    for old, new in replacements.items():
        rendered = rendered.replace(old, new)

    rendered, chg_count = re.subn(
        r'<section aria-labelledby="chg-h">[\s\S]*?</section>',
        body["change_html"],
        rendered,
        count=1,
    )
    if chg_count != 1:
        raise RuntimeError(f"changes section replacement failed: {chg_count}")

    issues_block = '''    <section aria-labelledby="issues-h">
      <h2 id="issues-h">主要ポイント</h2>

''' + "\n\n".join(issue_html(i) for i in body["issues"]) + '''

    </section>'''
    rendered, issues_count = re.subn(
        r'<section aria-labelledby="issues-h">[\s\S]*?</section>',
        issues_block,
        rendered,
        count=1,
    )
    if issues_count != 1:
        raise RuntimeError(f"issues section replacement failed: {issues_count}")

    # No verified fresh SCFI observation: omit the row rather than fabricating one.
    rendered, scfi_count = re.subn(
        r'\s*<tr><td>SCFI</td><td class="num">\{\{SCFI_VALUE\}\}</td><td>index</td><td>\{\{SCFI_DATE\}\}</td></tr>',
        "",
        rendered,
        count=1,
    )
    if scfi_count != 1:
        raise RuntimeError(f"SCFI row removal failed: {scfi_count}")

    source_rows = "\n".join(
        f'        <li><a href="{html.escape(s["url"], quote=True)}">{html.escape(s["name"])}</a></li>'
        for s in body["sources"]
    )
    rendered = replace_once(rendered, "        <li>{{SOURCE_LIST}}</li>", source_rows, "source list")

    unresolved = sorted(set(re.findall(r"\{\{[^{}]+\}\}", rendered)))
    if unresolved:
        raise RuntimeError(f"unresolved template placeholders: {unresolved}")

    # Canonical shell assertions: the generated report must retain the CURRENT template shell.
    template_nav = extract_block(template, r'<nav class="app-rail"[\s\S]*?</nav>', "template nav")
    rendered_nav = extract_block(rendered, r'<nav class="app-rail"[\s\S]*?</nav>', "rendered nav")
    if template_nav != rendered_nav:
        raise RuntimeError("generated report navigation differs from current template")

    template_footer = extract_block(template, r'<footer class="site-footer">[\s\S]*?</footer>', "template footer")
    rendered_footer = extract_block(rendered, r'<footer class="site-footer">[\s\S]*?</footer>', "rendered footer")
    if template_footer != rendered_footer:
        raise RuntimeError("generated report footer differs from current template")

    template_script = extract_block(template, r'<script type="module" src="\.\./\.\./\.\./assets/js/app\.js"></script>', "template app script")
    rendered_script = extract_block(rendered, r'<script type="module" src="\.\./\.\./\.\./assets/js/app\.js"></script>', "rendered app script")
    if template_script != rendered_script:
        raise RuntimeError("generated report app script differs from current template")

    if 'data-root="../../../" data-page="report"' not in rendered:
        raise RuntimeError("generated report has invalid data-root/data-page shell")
    return rendered


def update_reports(spec: dict) -> tuple[int, int]:
    data = load_json(REPORTS_PATH)
    reports = data.get("reports", [])
    old_ids = [r.get("id") for r in reports]
    if len(old_ids) != len(set(old_ids)):
        raise RuntimeError("data/reports.json already contains duplicate report IDs")

    reports = [r for r in reports if r.get("id") != TARGET_ID]
    reports.insert(0, spec["report_entry"])
    data["reports"] = reports

    new_ids = [r.get("id") for r in reports]
    disappeared = sorted(set(old_ids) - set(new_ids))
    if disappeared:
        raise RuntimeError(f"existing report IDs disappeared: {disappeared}")
    if new_ids.count(TARGET_ID) != 1:
        raise RuntimeError("target report ID must appear exactly once")
    dump_compact(REPORTS_PATH, data)
    return len(old_ids), len(new_ids)


def update_critical(spec: dict) -> None:
    data = load_json(CRITICAL_PATH)
    item = spec["critical_news_item"]
    items = [x for x in data.get("items", []) if x.get("id") != item["id"]]
    data["items"] = [item] + items
    data["updated_at"] = UPDATED_AT
    dump_compact(CRITICAL_PATH, data)


def update_topics(spec: dict) -> None:
    data = load_json(TOPICS_PATH)
    topics = {t.get("topic_id"): t for t in data.get("topics", [])}
    for upd in spec["topic_updates"]:
        topic_id = upd["topic_id"]
        if topic_id not in topics:
            raise RuntimeError(f"topic not found: {topic_id}")
        topic = topics[topic_id]
        topic.update(upd["fields"])
        dev = upd["development"]
        developments = [d for d in topic.get("developments", []) if not (
            d.get("date") == dev.get("date") and d.get("headline") == dev.get("headline")
        )]
        topic["developments"] = [dev] + developments
        related = [x for x in topic.get("related_report_ids", []) if x != TARGET_ID]
        topic["related_report_ids"] = [TARGET_ID] + related
    data["updated_at"] = UPDATED_AT
    dump_compact(TOPICS_PATH, data)


def validate_local_contracts(old_count: int, new_count: int) -> None:
    if new_count < old_count:
        raise RuntimeError(f"report count decreased: {old_count} -> {new_count}")
    for path in (REPORTS_PATH, CRITICAL_PATH, TOPICS_PATH, REGISTRY_PATH):
        load_json(path)

    reports_data = load_json(REPORTS_PATH)
    report = next((r for r in reports_data["reports"] if r.get("id") == TARGET_ID), None)
    if not report:
        raise RuntimeError("target report entry missing after update")
    expected_rel = "reports/2026/09/2026-09-24-daily.html"
    if report.get("path") != expected_rel:
        raise RuntimeError(f"invalid report path: {report.get('path')}")
    if not (ROOT / expected_rel).is_file():
        raise RuntimeError("report HTML does not exist at canonical path")

    registry = load_json(REGISTRY_PATH).get("signals", {})
    allowed_lenses = {"disruption", "cost_capacity", "reliability", "demand_commerce", "regulatory_structural"}
    for lens, signals in report.get("intelligence", {}).items():
        if lens not in allowed_lenses:
            raise RuntimeError(f"invalid lens: {lens}")
        for signal in signals:
            sid = signal.get("id")
            if sid not in registry:
                raise RuntimeError(f"unregistered signal ID: {sid}")
            if registry[sid].get("lens") != lens:
                raise RuntimeError(f"signal {sid} is in wrong lens {lens}")

    report_html = REPORT_PATH.read_text(encoding="utf-8")
    if "{{" in report_html or "}}" in report_html:
        raise RuntimeError("unresolved placeholder marker remains in report HTML")


def main() -> None:
    spec = load_json(SPEC_PATH)
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(render_report(spec), encoding="utf-8")
    old_count, new_count = update_reports(spec)
    update_critical(spec)
    update_topics(spec)
    validate_local_contracts(old_count, new_count)
    print(f"Generated {REPORT_PATH.relative_to(ROOT)} from current template")
    print(f"Preserved reports registry: {old_count} existing -> {new_count} total")
    print("Updated critical-news and topic-intelligence with 2026-09-24 observations")


if __name__ == "__main__":
    main()
