#!/usr/bin/env python3
"""Snapshot the ADAM Lab management Google Sheet into committed data/*.json.

Editors keep updating the Sheet; the public site reads only these JSON files.
Run before deploy:

  python3 scripts/snapshot_sheet.py
  git add data/ js/sheet/sheets.js
  git commit -m "data: refresh sheet snapshot"
  git push origin main

Requires network access to docs.google.com (sheet must be link-shared as Viewer).
No Google API credentials — uses the same public gviz CSV endpoint the site
used previously.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SHEETS_JS = ROOT / "js" / "sheet" / "sheets.js"

# Same workbook the site historically used (editors-only after this change).
DEFAULT_SHEET_ID = "1bmfsOkVl16OJ2KWzWJG6NtV5Ds98fXKnSiRtxKxgzlw"

# Tab name → expected header columns (order preserved in written JSON).
TABS = {
    "news": [
        "date", "title_ko", "title_en", "tag", "link", "image", "link2",
    ],
    "publications": [
        "type", "no", "year", "authors", "title", "topics", "venue", "details",
        "date", "presentation", "status", "link", "note", "extra_label", "extra_link",
    ],
    "patents": [
        "no", "title", "topics", "status", "number", "date", "link", "note",
    ],
    "awards": [
        "date", "category", "award", "recipients", "title", "event", "organizer", "link",
    ],
    "members": [
        "name_ko", "name_en", "role", "position", "start", "end", "status",
        "photo", "email", "link", "affiliation", "history", "lab",
    ],
    "projects": [
        "title", "org_role", "researcher_role", "program", "funder", "start", "end",
        "group", "status", "recruit", "hidden", "logo", "link",
    ],
    "talks": ["date", "title", "venue", "location", "link"],
    "gallery": ["date", "caption", "image", "group", "link"],
    "sections": ["block", "section", "type", "sub", "text", "link", "image"],
}

NOTES = {
    "news": "Home Latest News + Board · News. tag: Paper | Award | Project | Event | Member.",
    "publications": "type: journal-intl | journal-kr | conf-intl | conf-kr | in-prep | other.",
    "patents": "status: registered | filed.",
    "awards": "category: paper | presentation | competition.",
    "members": "role: professor | postdoc | researcher | phd | ms-phd | ms | undergrad. status: current | alumni.",
    "projects": "group: PNU | KIT. recruit/hidden: Y to flag.",
    "talks": "Invited talks.",
    "gallery": "group: PNU | KIT. image: assets/gallery/… preferred.",
    "sections": "block/section/type text blocks (Professor, Recruiting, Research, Home).",
}


def gviz_url(sheet_id: str, tab: str) -> str:
    return (
        f"https://docs.google.com/spreadsheets/d/{sheet_id}"
        f"/gviz/tq?tqx=out:csv&headers=1&sheet={urllib.parse.quote(tab)}"
    )


def fetch_csv(url: str, timeout: float = 45.0) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "adam-pnu-snapshot/1.0 (+https://soonjokwon.github.io/adam-pnu/)",
            "Accept": "text/csv,*/*",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
    # gviz usually returns UTF-8; fall back if needed
    for enc in ("utf-8-sig", "utf-8", "cp949"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def parse_csv(text: str) -> tuple[list[str], list[dict[str, str]]]:
    # Strip gviz JSONP error payloads if someone hits a private sheet
    if text.lstrip().startswith("google.visualization"):
        raise RuntimeError("gviz returned a visualization payload (sheet private or blocked)")
    reader = csv.reader(io.StringIO(text))
    try:
        header = next(reader)
    except StopIteration:
        return [], []
    columns = [h.strip() for h in header]
    # normalize empty trailing headers
    while columns and columns[-1] == "":
        columns.pop()
    rows: list[dict[str, str]] = []
    for cells in reader:
        if not any((c or "").strip() for c in cells):
            continue
        item: dict[str, str] = {}
        for i, col in enumerate(columns):
            if not col:
                continue
            item[col] = cells[i].strip() if i < len(cells) else ""
        rows.append(item)
    return columns, rows


def ensure_columns(got: list[str], expected: list[str], tab: str) -> None:
    missing = [c for c in expected if c not in got]
    if missing:
        raise RuntimeError(
            f"tab '{tab}' missing columns {missing}; got {got}. "
            "gviz returns the first sheet when the tab name is wrong."
        )


def write_json(tab: str, columns: list[str], items: list[dict], sheet_id: str, extracted: str) -> Path:
    # Prefer the canonical column order; keep any extra sheet columns at the end.
    ordered = [c for c in TABS[tab] if c in columns] + [c for c in columns if c not in TABS[tab]]
    normalized = []
    for row in items:
        normalized.append({c: row.get(c, "") for c in ordered})
    payload = {
        "lab": "ADAM Lab@PNU",
        "source": f"https://docs.google.com/spreadsheets/d/{sheet_id}",
        "sheet_tab": tab,
        "extracted": extracted,
        "note": NOTES.get(tab, f"Snapshot of sheet tab `{tab}`."),
        "columns": ordered,
        "items": normalized,
    }
    path = DATA / f"{tab}.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return path


def update_sheets_js(version: str, sheet_id: str) -> None:
    """Rewrite js/sheet/sheets.js: keep sheet id for editors, set data version, no gviz URLs."""
    content = f'''/* ADAM Lab management sheet metadata (editors only).
   The browser never fetches Google Sheets — it loads committed data/*.json.
   Refresh JSON:  python3 scripts/snapshot_sheet.py
   Sheet: https://docs.google.com/spreadsheets/d/{sheet_id}
   (공유: 링크가 있는 모든 사용자 = 뷰어). Tab names must match scripts/snapshot_sheet.py. */
window.ADAM_SHEET_ID = "{sheet_id}";
window.ADAM_DATA_VERSION = "{version}";
/* Intentionally empty: no docs.google.com / gviz URLs in the browser. */
window.ADAM_SHEETS = {{}};
'''
    SHEETS_JS.write_text(content, encoding="utf-8")


def snapshot(sheet_id: str, tabs: list[str] | None = None) -> int:
    DATA.mkdir(parents=True, exist_ok=True)
    extracted = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    version = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    wanted = tabs or list(TABS.keys())
    errors = []
    for tab in wanted:
        if tab not in TABS:
            errors.append(f"unknown tab '{tab}'")
            continue
        url = gviz_url(sheet_id, tab)
        try:
            text = fetch_csv(url)
            columns, rows = parse_csv(text)
            ensure_columns(columns, TABS[tab], tab)
            path = write_json(tab, columns, rows, sheet_id, extracted)
            print(f"OK  {tab:14} {len(rows):4d} rows → {path.relative_to(ROOT)}")
        except Exception as exc:  # noqa: BLE001 — report per-tab and continue
            errors.append(f"{tab}: {exc}")
            print(f"ERR {tab:14} {exc}", file=sys.stderr)
    update_sheets_js(version, sheet_id)
    print(f"OK  sheets.js       ADAM_DATA_VERSION={version}")
    meta = {
        "sheet_id": sheet_id,
        "extracted": extracted,
        "version": version,
        "tabs": wanted,
    }
    (DATA / "snapshot.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"OK  snapshot.json   {extracted}")
    if errors:
        print(f"\n{len(errors)} tab(s) failed:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--sheet-id",
        default=DEFAULT_SHEET_ID,
        help=f"Google Spreadsheet ID (default: {DEFAULT_SHEET_ID})",
    )
    ap.add_argument(
        "--tabs",
        nargs="*",
        default=None,
        help="Subset of tabs to refresh (default: all)",
    )
    args = ap.parse_args()
    return snapshot(args.sheet_id, args.tabs)


if __name__ == "__main__":
    sys.exit(main())
