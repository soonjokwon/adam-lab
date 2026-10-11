# Data pipeline (sheet → JSON → Pages)

The public site **never** fetches Google Sheets in the browser. Editors update a management spreadsheet; a snapshot script writes committed `data/*.json` that GitHub Pages serves.

## Roles

| Who | Where | What |
| --- | --- | --- |
| Editors | [Management sheet](https://docs.google.com/spreadsheets/d/1bmfsOkVl16OJ2KWzWJG6NtV5Ds98fXKnSiRtxKxgzlw) | Edit tabs (`news`, `publications`, …) |
| Maintainer | This repo | Run snapshot → commit JSON → push `main` |
| Visitors | https://soonjokwon.github.io/adam-pnu/ | Load `data/<tab>.json` only |

`adam-lab-widgets` is untouched; image paths still resolve to its Pages CDN when needed.

## Tabs

`news`, `publications`, `patents`, `awards`, `members`, `projects`, `talks`, `gallery`, `sections`

Tab names and columns must match `scripts/snapshot_sheet.py` (`TABS`).

## Refresh snapshot

```bash
# from repo root (needs network; sheet must be link-shared Viewer)
python3 scripts/snapshot_sheet.py

git add data/ js/sheet/sheets.js
git commit -m "data: refresh sheet snapshot"
git push origin main
```

Optional: `python3 scripts/snapshot_sheet.py --tabs news members`

The script also updates `js/sheet/sheets.js` (`ADAM_DATA_VERSION` cache-bust) and writes `data/snapshot.json` metadata.

## Deploy checklist

1. Edit the Sheet (or confirm it is current).  
2. Run `python3 scripts/snapshot_sheet.py`.  
3. Review `git diff data/`.  
4. Commit JSON (+ `sheets.js`) and push `main`.  
5. GitHub Pages (branch deploy, **no Actions required**) publishes the site.

## Runtime

- Loader: `js/sheet/sheet-loader.js` → `ADAM.load(tab)` fetches `data/<tab>.json?v=<ADAM_DATA_VERSION>`.  
- `window.ADAM_SHEETS` is empty; `ADAM.sheetUrl()` returns `""`.  
- Network tab on Pages should show **no** `docs.google.com` / `gviz` requests.

## GitHub Actions

Not required. Prefer local (or any CI you control) snapshot + commit. Do not add workflows that need Google credentials or `workflow` scope you do not have.
