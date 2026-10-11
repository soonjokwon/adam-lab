#!/usr/bin/env python3
"""Snapshot the ADAM Lab management Google Sheet into committed data/*.json.

Editors update a private Sheet shared with a Google Cloud service account
(Viewer). The public site reads only these JSON files — never Sheets/gviz.

Install deps:
  python3 -m pip install google-auth google-api-python-client

Auth (one of):
  GOOGLE_SERVICE_ACCOUNT_JSON   full service-account key JSON string (Actions)
  GOOGLE_APPLICATION_CREDENTIALS  path to key JSON file
  --credentials PATH            path to key JSON file

Share the spreadsheet with the service account email as Viewer
(File → Share). Link-share Viewer is not required.

Run (local or Actions):
  python3 scripts/snapshot_sheet.py
  git add data/ js/sheet/sheets.js '*.html'
  git commit -m "data: refresh sheet snapshot"
  git push origin main

Also rewrites sheets.js?v=… on every HTML page that loads sheets.js
(placeholder __SHEETS_JS_V__ or any prior ?v=) so GitHub Pages does not
serve a stale sheets.js for ~10 minutes after a snapshot.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SHEETS_JS = ROOT / "js" / "sheet" / "sheets.js"
SHEETS_JS_V_PLACEHOLDER = "__SHEETS_JS_V__"
# Match src="…/sheets.js" or src="…/sheets.js?v=…" (relative paths OK).
SHEETS_JS_SRC_RE = re.compile(
    r'(src=["\'](?:\.\./)*(?:js/sheet/)?sheets\.js)(?:\?v=[^"\']*)?(["\'])'
)

DEFAULT_SHEET_ID = "1bmfsOkVl16OJ2KWzWJG6NtV5Ds98fXKnSiRtxKxgzlw"
SCOPES = ("https://www.googleapis.com/auth/spreadsheets.readonly",)

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
    # Research-topic vocabulary for publications/patents `topics` cells.
    "topics": [
        "topic_key", "label_en", "label_ko", "label_short",
        "aliases", "sort", "active", "color",
    ],
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
    "topics": (
        "topic_key (id in publications/patents topics cells); "
        "label_en / label_ko / label_short (tag text); "
        "aliases (semicolon-separated); sort; active Y/N; color optional."
    ),
}

# Tabs that may be absent until editors create them. Missing → keep committed
# data/<tab>.json and do not fail the whole snapshot run.
OPTIONAL_TABS = frozenset({"topics"})


def _cell_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def load_credentials(credentials_path: str | None = None):
    """Build service-account credentials from env JSON or a key file path."""
    try:
        from google.oauth2 import service_account
    except ImportError as exc:
        raise SystemExit(
            "Missing dependency: google-auth. Install with:\n"
            "  python3 -m pip install google-auth google-api-python-client"
        ) from exc

    raw = (os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON") or "").strip()
    if raw:
        try:
            info = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise SystemExit(
                "GOOGLE_SERVICE_ACCOUNT_JSON is set but is not valid JSON "
                f"(parse error: {exc}). Do not log the secret value."
            ) from exc
        if not isinstance(info, dict) or info.get("type") != "service_account":
            raise SystemExit(
                "GOOGLE_SERVICE_ACCOUNT_JSON must be a service_account key object "
                '(field "type": "service_account").'
            )
        return service_account.Credentials.from_service_account_info(info, scopes=SCOPES)

    path = (
        credentials_path
        or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        or ""
    ).strip()
    if path:
        p = Path(path).expanduser()
        if not p.is_file():
            raise SystemExit(f"Credentials file not found: {p}")
        return service_account.Credentials.from_service_account_file(str(p), scopes=SCOPES)

    raise SystemExit(
        "Missing Google service account credentials.\n"
        "Set GOOGLE_SERVICE_ACCOUNT_JSON (full key JSON string), or\n"
        "GOOGLE_APPLICATION_CREDENTIALS / --credentials to a key file path.\n"
        "Share the spreadsheet with the SA email as Viewer."
    )


def sheets_service(credentials):
    try:
        from googleapiclient.discovery import build
    except ImportError as exc:
        raise SystemExit(
            "Missing dependency: google-api-python-client. Install with:\n"
            "  python3 -m pip install google-auth google-api-python-client"
        ) from exc
    return build("sheets", "v4", credentials=credentials, cache_discovery=False)


def fetch_tab(service, sheet_id: str, tab: str) -> tuple[list[str], list[dict[str, str]]]:
    """Read one worksheet via Sheets API values.get. Raises with tab context on API errors."""
    from googleapiclient.errors import HttpError

    # Quote sheet title for A1 notation (handles spaces / punctuation).
    safe = tab.replace("'", "''")
    a1 = f"'{safe}'!A:ZZ"
    try:
        resp = (
            service.spreadsheets()
            .values()
            .get(
                spreadsheetId=sheet_id,
                range=a1,
                majorDimension="ROWS",
                valueRenderOption="FORMATTED_VALUE",
                dateTimeRenderOption="FORMATTED_STRING",
            )
            .execute()
        )
    except HttpError as exc:
        status = getattr(exc.resp, "status", None) or "?"
        reason = ""
        try:
            body = json.loads(exc.content.decode("utf-8"))
            reason = body.get("error", {}).get("message", "") or str(exc)
        except Exception:  # noqa: BLE001
            reason = str(exc)
        raise RuntimeError(
            f"Sheets API {status} for tab '{tab}': {reason}. "
            "Check that the sheet is shared Viewer with the service account email, "
            "and that the tab name matches exactly."
        ) from exc

    values = resp.get("values") or []
    if not values:
        return [], []
    header = [_cell_str(c) for c in values[0]]
    while header and header[-1] == "":
        header.pop()
    rows: list[dict[str, str]] = []
    for cells in values[1:]:
        cells = list(cells)
        if not any(_cell_str(c) for c in cells):
            continue
        item: dict[str, str] = {}
        for i, col in enumerate(header):
            if not col:
                continue
            item[col] = _cell_str(cells[i]) if i < len(cells) else ""
        rows.append(item)
    return header, rows


def ensure_columns(got: list[str], expected: list[str], tab: str) -> None:
    missing = [c for c in expected if c not in got]
    if missing:
        raise RuntimeError(
            f"tab '{tab}' missing columns {missing}; got {got}. "
            "Confirm the worksheet tab name and header row."
        )


def _is_missing_tab_error(message: str) -> bool:
    """True when Sheets API cannot find the worksheet tab (range parse / not found)."""
    m = (message or "").lower()
    return any(
        needle in m
        for needle in (
            "unable to parse range",
            "unable to parse sheet",
            "not found",
            "no sheet with that name",
            "does not exist",
        )
    )


def write_json(tab: str, columns: list[str], items: list[dict], sheet_id: str, extracted: str) -> Path:
    ordered = [c for c in TABS[tab] if c in columns] + [c for c in columns if c not in TABS[tab]]
    normalized = [{c: row.get(c, "") for c in ordered} for row in items]
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
    content = f'''/* ADAM Lab management sheet metadata (editors only).
   The browser never fetches Google Sheets — it loads committed data/*.json.
   Refresh JSON:  python3 scripts/snapshot_sheet.py
   Sheet: https://docs.google.com/spreadsheets/d/{sheet_id}
   (Share Viewer with the snapshot service account; tab names → scripts/snapshot_sheet.py).
   ADAM_DATA_VERSION is for debug/display; HTML cache-busts this file via ?v=. */
window.ADAM_SHEET_ID = "{sheet_id}";
window.ADAM_DATA_VERSION = "{version}";
/* Intentionally empty: no docs.google.com / gviz URLs in the browser. */
window.ADAM_SHEETS = {{}};
'''
    SHEETS_JS.write_text(content, encoding="utf-8")


def update_html_sheets_js_v(version: str) -> list[Path]:
    """Rewrite sheets.js?v=… (or bare sheets.js / __SHEETS_JS_V__) on all site HTML pages."""
    changed: list[Path] = []
    for path in sorted(ROOT.rglob("*.html")):
        if any(part.startswith(".") for part in path.parts):
            continue
        text = path.read_text(encoding="utf-8")
        if "sheets.js" not in text:
            continue
        new_text, n = SHEETS_JS_SRC_RE.subn(rf"\1?v={version}\2", text)
        # Also replace explicit placeholder if present outside the regex edge cases.
        new_text = new_text.replace(
            f"sheets.js?v={SHEETS_JS_V_PLACEHOLDER}", f"sheets.js?v={version}"
        )
        if new_text != text or n:
            if new_text != text:
                path.write_text(new_text, encoding="utf-8")
                changed.append(path)
                print(f"OK  html           sheets.js?v={version} → {path.relative_to(ROOT)}")
    return changed


def snapshot(
    sheet_id: str,
    tabs: list[str] | None = None,
    credentials_path: str | None = None,
) -> int:
    credentials = load_credentials(credentials_path)
    service = sheets_service(credentials)
    sa_email = getattr(credentials, "service_account_email", "") or "(service account)"
    print(f"Auth OK  service_account={sa_email}")

    DATA.mkdir(parents=True, exist_ok=True)
    extracted = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    version = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    wanted = tabs or list(TABS.keys())
    errors: list[str] = []

    for tab in wanted:
        if tab not in TABS:
            errors.append(f"unknown tab '{tab}'")
            print(f"ERR {tab:14} unknown tab", file=sys.stderr)
            continue
        try:
            columns, rows = fetch_tab(service, sheet_id, tab)
            ensure_columns(columns, TABS[tab], tab)
            path = write_json(tab, columns, rows, sheet_id, extracted)
            print(f"OK  {tab:14} {len(rows):4d} rows → {path.relative_to(ROOT)}")
        except Exception as exc:  # noqa: BLE001 — report per-tab and continue
            msg = str(exc)
            soft = tab in OPTIONAL_TABS and _is_missing_tab_error(msg)
            if soft:
                keep = DATA / f"{tab}.json"
                print(
                    f"SKIP {tab:14} sheet tab missing — keep "
                    f"{keep.relative_to(ROOT) if keep.is_file() else '(no local file)'}",
                    file=sys.stderr,
                )
                print(f"     {msg}", file=sys.stderr)
                continue
            errors.append(f"{tab}: {exc}")
            print(f"ERR {tab:14} {exc}", file=sys.stderr)

    update_sheets_js(version, sheet_id)
    print(f"OK  sheets.js       ADAM_DATA_VERSION={version}")
    update_html_sheets_js_v(version)
    meta = {
        "sheet_id": sheet_id,
        "extracted": extracted,
        "version": version,
        "tabs": wanted,
        "auth": "sheets_api_service_account",
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
    ap.add_argument(
        "--credentials",
        default=None,
        help="Path to service-account JSON key (or use GOOGLE_APPLICATION_CREDENTIALS / GOOGLE_SERVICE_ACCOUNT_JSON)",
    )
    args = ap.parse_args()
    return snapshot(args.sheet_id, args.tabs, args.credentials)


if __name__ == "__main__":
    sys.exit(main())
