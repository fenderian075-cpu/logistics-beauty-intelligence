#!/usr/bin/env python3
"""
validate-report.py — repository QA for the Logistics & Beauty Intelligence Portal.

v2.1: also validates the structured `intelligence` block against
data/signal-registry.json. Reports without that block are legacy and pass.

Checks that data/reports.json and the report HTML files agree with each other.
Standard library only. Not a dependency of the publishing flow: it is a
human / CI check that can be run at any time.

Usage:
    python3 scripts/validate-report.py                 # validate everything
    python3 scripts/validate-report.py 2026-08-24-daily  # validate one report

Exit codes:
    0  all checks passed (warnings may still be printed)
    1  at least one error
    2  could not read data/reports.json
"""

from __future__ import annotations

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, "data", "reports.json")
REGISTRY = os.path.join(ROOT, "data", "signal-registry.json")

VALID_STATUS = {"normal", "watch", "disruption", "unconfirmed"}
VALID_TYPES = {"daily", "weekly", "monthly"}
BOARD_KEYS = {"domestic", "weather", "customs", "ocean", "air", "global"}
REQUIRED_FIELDS = ("id", "date", "type", "title", "status", "summary", "path")

# Sections whose Japanese prose must be reachable by the translation layer.
# ---- v2.1 enums ----------------------------------------------------------
LENSES = ["disruption", "cost_capacity", "reliability", "demand_commerce", "regulatory_structural"]
DIRECTIONS = {"rising", "falling", "stable", "volatile", "unknown"}
IMPACTS = {"high", "medium", "low"}
CONFIDENCES = {"high", "medium", "low"}
CHANGE_STATUSES = {"new", "deteriorating", "improving", "resolved", "unchanged", "unchanged_high_risk"}
DEMAND_DRIVERS = {"organic", "promotion", "launch", "buzz"}
DURATIONS = {"temporary", "persistent", "unknown"}
CHANGE_SUMMARY_V21_KEYS = ["new", "deteriorating", "improving", "resolved", "unchanged_high_risk"]

REQUIRED_TRANSLATE_IDS = {
    "daily": ["exec-h", "bl-h"],
    "weekly": ["exec-h", "bl-h"],
    "monthly": ["exec-h", "bl-h"],
}

errors: list[str] = []
warnings: list[str] = []


def err(entry_id: str, message: str) -> None:
    errors.append(f"[ERROR] {entry_id}: {message}")


def warn(entry_id: str, message: str) -> None:
    warnings.append(f"[WARN ] {entry_id}: {message}")


def attr(html: str, name: str) -> str | None:
    m = re.search(rf'{name}="([^"]*)"', html)
    return m.group(1) if m else None


# --------------------------------------------------------------------------
# index-level checks
# --------------------------------------------------------------------------

def check_index(data: dict) -> list[dict]:
    reports = data.get("reports")
    if not isinstance(reports, list):
        err("reports.json", "top-level 'reports' must be a list")
        return []

    seen_ids: dict[str, int] = {}
    seen_keys: dict[tuple, int] = {}
    seen_paths: dict[str, int] = {}

    for i, entry in enumerate(reports):
        eid = entry.get("id") or f"index[{i}]"

        for field in REQUIRED_FIELDS:
            if not entry.get(field):
                err(eid, f"missing required field '{field}'")

        date = entry.get("date", "")
        rtype = entry.get("type", "")

        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
            err(eid, f"date must be YYYY-MM-DD, got {date!r}")
        if rtype not in VALID_TYPES:
            err(eid, f"type must be one of {sorted(VALID_TYPES)}, got {rtype!r}")
        if entry.get("status") not in VALID_STATUS:
            err(eid, f"status must be one of {sorted(VALID_STATUS)}, got {entry.get('status')!r}")

        # id convention: <date>-<type>
        if entry.get("id") and date and rtype and entry["id"] != f"{date}-{rtype}":
            warn(eid, f"id does not follow <date>-<type> (expected {date}-{rtype})")

        # uniqueness
        if entry.get("id") in seen_ids:
            err(eid, f"duplicate id (also at index {seen_ids[entry['id']]})")
        seen_ids[entry.get("id")] = i

        key = (date, rtype)
        if key in seen_keys:
            err(eid, f"duplicate date+type {key} (also at index {seen_keys[key]}) — "
                     "retries must replace the existing entry, not append a second one")
        seen_keys[key] = i

        path = entry.get("path", "")
        if path in seen_paths:
            err(eid, f"duplicate path (also at index {seen_paths[path]})")
        seen_paths[path] = i

        # path convention
        if path:
            expected = f"reports/{date[:4]}/{date[5:7]}/{date}-{rtype}.html"
            if path != expected:
                err(eid, f"path should be {expected!r}, got {path!r}")

        # status_board
        board = entry.get("status_board")
        if board is not None:
            unknown = set(board) - BOARD_KEYS
            if unknown:
                err(eid, f"status_board has unknown keys: {sorted(unknown)}")
            for k, v in board.items():
                if v not in VALID_STATUS:
                    err(eid, f"status_board.{k} invalid value {v!r}")
        elif rtype == "daily":
            warn(eid, "daily entry has no status_board — the dashboard will show Unconfirmed")

        # signals
        signals = entry.get("signals")
        if signals is not None:
            if not isinstance(signals, dict):
                err(eid, "signals must be an object")
            else:
                for k, sig in signals.items():
                    if not isinstance(sig, dict):
                        err(eid, f"signals.{k} must be an object")
                        continue
                    for f in ("value", "unit", "data_date"):
                        if f not in sig:
                            err(eid, f"signals.{k} missing '{f}' (use null when unknown)")
                    if sig.get("value") is not None and not isinstance(sig["value"], (int, float)):
                        err(eid, f"signals.{k}.value must be a number or null")
                    dd = sig.get("data_date")
                    if dd is not None and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(dd)):
                        err(eid, f"signals.{k}.data_date must be YYYY-MM-DD or null")

        # Derived-only fields must never be authored. ACTION REQUIRED is
        # computed by the dashboard from status + signals, so a stored value
        # could contradict the signals it sits next to.
        for derived in ("action_required", "action_state", "lens_status"):
            if derived in entry:
                warn(eid, f"'{derived}' is a derived display value and must not be stored — remove it")

        # change_summary
        cs = entry.get("change_summary")
        if cs is None:
            warn(eid, "no change_summary — the dashboard cannot show new/resolved risks")
        elif not isinstance(cs, dict):
            err(eid, "change_summary must be an object")
        elif any(isinstance(cs.get(k), list) for k in CHANGE_SUMMARY_V21_KEYS):
            # v2.1 signal-based shape — validated in check_change_summary_v21()
            pass
        else:
            for f in ("compared_with", "overall", "changed_categories",
                      "new_risks", "resolved_risks"):
                if f not in cs:
                    err(eid, f"change_summary missing '{f}'")
            for f in ("changed_categories", "new_risks", "improved_risks", "resolved_risks"):
                if f in cs and not isinstance(cs[f], list):
                    err(eid, f"change_summary.{f} must be a list")
            unknown = set(cs.get("changed_categories") or []) - BOARD_KEYS
            if unknown:
                err(eid, f"change_summary.changed_categories has unknown keys: {sorted(unknown)}")
            cw = cs.get("compared_with")
            if cw is None:
                if cs.get("overall") != "no_previous":
                    warn(eid, "compared_with is null but overall is not 'no_previous'")
            elif cw not in seen_ids and cw not in {e.get("id") for e in reports}:
                err(eid, f"change_summary.compared_with {cw!r} is not an id in reports.json")

    return reports



# --------------------------------------------------------------------------
# v2.1 — signal registry and the intelligence block
# --------------------------------------------------------------------------

def load_registry() -> dict:
    """The registry is optional: a repository with no v2.1 data validates fine
    without it. It becomes required as soon as any report carries signals."""
    if not os.path.isfile(REGISTRY):
        return {}
    try:
        data = json.load(open(REGISTRY, encoding="utf-8"))
    except json.JSONDecodeError as e:
        err("signal-registry.json", f"not valid JSON: {e}")
        return {}

    signals = data.get("signals")
    if not isinstance(signals, dict):
        err("signal-registry.json", "top-level 'signals' must be an object")
        return {}

    for sid, entry in signals.items():
        where = f"signal-registry.json:{sid}"
        if not isinstance(entry, dict):
            err(where, "registry entry must be an object")
            continue
        if not entry.get("name_ja"):
            err(where, "missing required field 'name_ja'")
        if entry.get("lens") not in LENSES:
            err(where, f"lens must be one of {LENSES}, got {entry.get('lens')!r}")
        if "polarity" in entry and entry["polarity"] not in ("up_is_bad", "down_is_bad", "neutral"):
            err(where, f"polarity invalid: {entry['polarity']!r}")
    return signals


def check_intelligence(entry: dict, registry: dict) -> set:
    """Validate the optional v2.1 intelligence block.
    Returns the set of signal ids found in this report (empty for legacy)."""
    eid = entry.get("id", "?")
    intel = entry.get("intelligence")
    found: set = set()

    if intel is None:
        return found                     # legacy report — nothing to check
    if not isinstance(intel, dict):
        err(eid, "intelligence must be an object keyed by lens")
        return found

    unknown_lenses = set(intel) - set(LENSES)
    if unknown_lenses:
        err(eid, f"intelligence has unknown lens keys: {sorted(unknown_lenses)}")

    if not registry:
        err(eid, "report carries structured signals but data/signal-registry.json is missing or unusable")

    seen_in_report: dict = {}

    for lens in LENSES:
        bucket = intel.get(lens)
        if bucket is None:
            continue
        if not isinstance(bucket, list):
            err(eid, f"intelligence.{lens} must be a list")
            continue

        for i, sig in enumerate(bucket):
            where = f"{eid} · {lens}[{i}]"
            if not isinstance(sig, dict):
                err(where, "signal must be an object")
                continue

            sid = sig.get("id")
            if not sid:
                err(where, "signal is missing 'id'")
            else:
                where = f"{eid} · {sid}"
                found.add(sid)
                if sid in seen_in_report:
                    err(where, f"signal id appears twice in this report (also in {seen_in_report[sid]})")
                seen_in_report[sid] = lens

                reg = registry.get(sid)
                if reg is None:
                    err(where, "signal id is not in data/signal-registry.json — "
                               "register the id before using it, so history stays linkable")
                else:
                    reg_lens = reg.get("lens")
                    sig_lens = sig.get("lens", lens)
                    if reg_lens and sig_lens != reg_lens:
                        err(where, f"lens {sig_lens!r} does not match registry lens {reg_lens!r}")
                    if sig.get("lens") and sig["lens"] != lens:
                        err(where, f"signal.lens {sig['lens']!r} contradicts the block it sits in ({lens!r})")

            if not sig.get("signal"):
                err(where, "missing 'signal' (the one-sentence observation)")

            for field, allowed in (("direction", DIRECTIONS),
                                   ("impact", IMPACTS),
                                   ("confidence", CONFIDENCES),
                                   ("change_status", CHANGE_STATUSES)):
                value = sig.get(field)
                if value is None:
                    err(where, f"missing '{field}'")
                elif value not in allowed:
                    err(where, f"{field} must be one of {sorted(allowed)}, got {value!r}")

            reg = registry.get(sid) or {}
            beauty = bool(reg.get("beauty")) or "demand_driver" in sig or "duration" in sig
            if beauty:
                dd = sig.get("demand_driver")
                if dd is None:
                    warn(where, "beauty signal has no demand_driver")
                elif dd not in DEMAND_DRIVERS:
                    err(where, f"demand_driver must be one of {sorted(DEMAND_DRIVERS)}, got {dd!r}")
                du = sig.get("duration")
                if du is None:
                    warn(where, "beauty signal has no duration")
                elif du not in DURATIONS:
                    err(where, f"duration must be one of {sorted(DURATIONS)}, got {du!r}")
            else:
                if "demand_driver" in sig or "duration" in sig:
                    warn(where, "demand_driver / duration are only meaningful on beauty signals")

            # Evidence. Presence is checked; reachability deliberately is NOT —
            # the validator never performs network access.
            evidence = sig.get("evidence")
            has_evidence = bool(evidence) and (not isinstance(evidence, list) or len(evidence) > 0)
            if not has_evidence:
                if sig.get("confidence") == "high":
                    warn(where, "confidence is 'high' but no evidence is recorded")
                else:
                    warn(where, "no evidence recorded")
            elif isinstance(evidence, list):
                for j, item in enumerate(evidence):
                    if isinstance(item, dict) and not (item.get("source") or item.get("url")):
                        warn(where, f"evidence[{j}] has neither 'source' nor 'url'")

            if not sig.get("operational_implication"):
                warn(where, "no operational_implication — the signal states a fact but not its consequence")

    return found


def check_change_summary_v21(entry: dict, found_ids: set) -> None:
    """The v2.1 change_summary references signal ids. They must resolve to
    signals present in this same report."""
    eid = entry.get("id", "?")
    cs = entry.get("change_summary")
    if not isinstance(cs, dict):
        return
    if not any(isinstance(cs.get(k), list) for k in CHANGE_SUMMARY_V21_KEYS):
        return                            # v1.1 shape, already checked above

    if not cs.get("comparison_base") and not cs.get("compared_with"):
        warn(eid, "change_summary has no comparison_base")

    for key in CHANGE_SUMMARY_V21_KEYS:
        value = cs.get(key)
        if value is None:
            continue
        if not isinstance(value, list):
            err(eid, f"change_summary.{key} must be a list of signal ids")
            continue
        for sid in value:
            if sid not in found_ids:
                err(eid, f"change_summary.{key} references {sid!r}, "
                         "which is not a signal in this report")

# --------------------------------------------------------------------------
# HTML-level checks
# --------------------------------------------------------------------------

def check_html(entry: dict) -> None:
    eid = entry.get("id", "?")
    rel = entry.get("path", "")
    if not rel:
        return
    full = os.path.join(ROOT, rel)

    if not os.path.isfile(full):
        err(eid, f"HTML file does not exist: {rel}")
        return

    html = open(full, encoding="utf-8").read()

    if '<html lang="ja">' not in html:
        err(eid, 'missing <html lang="ja"> — Japanese is the canonical language')

    depth = rel.count("/")            # reports/YYYY/MM/file.html -> 3
    expected_root = "../" * depth
    root_attr = attr(html, "data-root")
    if root_attr != expected_root:
        err(eid, f'data-root should be "{expected_root}", got {root_attr!r}')

    if attr(html, "data-report-date") != entry.get("date"):
        err(eid, f'data-report-date {attr(html, "data-report-date")!r} != json date {entry.get("date")!r}')
    if attr(html, "data-report-type") != entry.get("type"):
        err(eid, f'data-report-type {attr(html, "data-report-type")!r} != json type {entry.get("type")!r}')
    if entry.get("type") == "monthly" and 'data-report-period=' not in html:
        warn(eid, "monthly report has no data-report-period attribute")

    # asset paths must resolve
    for m in re.findall(r'(?:href|src)="((?:\.\./)+[^"]+)"', html):
        target = os.path.normpath(os.path.join(os.path.dirname(full), m.split("?")[0].split("#")[0]))
        if not os.path.exists(target):
            err(eid, f"broken relative link: {m}")

    # translation coverage
    if 'data-translate' not in html:
        err(eid, "no data-translate anywhere — the English view would show nothing translated")
    for sid in REQUIRED_TRANSLATE_IDS.get(entry.get("type", ""), []):
        pattern = rf'<section[^>]*aria-labelledby="{sid}"[^>]*data-translate'
        if not re.search(pattern, html):
            err(eid, f'section "{sid}" is missing data-translate=""')

    # comparison component
    if 'id="chg-h"' not in html:
        warn(eid, "no 前回からの変化 section (id=\"chg-h\")")
    else:
        has_full = 'class="changes"' in html
        has_none = 'changes--none' in html
        if has_full and has_none:
            err(eid, "both .changes and .changes--none present — keep exactly one")
        if not has_full and not has_none:
            err(eid, "前回からの変化 section has neither .changes nor .changes--none")
        cs = entry.get("change_summary") or {}
        if has_none and cs.get("compared_with"):
            warn(eid, "HTML says 'no previous data' but change_summary.compared_with is set")
        if has_full and cs.get("overall") == "no_previous":
            warn(eid, "HTML shows a comparison but change_summary.overall is 'no_previous'")

    # tables must not break the mobile layout
    for m in re.finditer(r"<table[\s>]", html):
        before = html[max(0, m.start() - 400):m.start()]
        if 'class="table-scroll"' not in before:
            err(eid, "a <table> is not wrapped in <div class=\"table-scroll\">")
            break

    # sample banner should be gone on real reports
    if not entry.get("sample") and "sample-banner" in html:
        warn(eid, "sample banner is still present but the entry is not marked sample")
    if entry.get("sample") and "sample-banner" not in html:
        warn(eid, "entry is marked sample but the page has no sample banner")


# --------------------------------------------------------------------------

def main() -> int:
    try:
        data = json.load(open(INDEX, encoding="utf-8"))
    except FileNotFoundError:
        print(f"[FATAL] {INDEX} not found")
        return 2
    except json.JSONDecodeError as e:
        print(f"[FATAL] data/reports.json is not valid JSON: {e}")
        return 2

    reports = check_index(data)
    registry = load_registry()

    for entry in reports:
        found_ids = check_intelligence(entry, registry)
        check_change_summary_v21(entry, found_ids)

    wanted = sys.argv[1:]
    targets = [r for r in reports if not wanted or r.get("id") in wanted]
    if wanted and not targets:
        print(f"[FATAL] no entry in reports.json matches: {', '.join(wanted)}")
        return 1

    for entry in targets:
        check_html(entry)

    # orphan HTML files (created but never indexed) — expected after a failed
    # step 4, harmless for the live site, but worth surfacing.
    indexed = {r.get("path") for r in reports}
    for dirpath, _dirs, files in os.walk(os.path.join(ROOT, "reports")):
        for f in files:
            if not f.endswith(".html"):
                continue
            rel = os.path.relpath(os.path.join(dirpath, f), ROOT).replace(os.sep, "/")
            if rel not in indexed:
                warnings.append(f"[WARN ] {rel}: orphan HTML — no reports.json entry points to it")

    for line in warnings:
        print(line)
    for line in errors:
        print(line)

    print()
    print(f"checked {len(targets)} report(s): {len(errors)} error(s), {len(warnings)} warning(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
