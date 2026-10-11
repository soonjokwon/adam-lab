# Data pipeline (sheet → JSON → Pages)

The public site **never** fetches Google Sheets in the browser. Editors update a management spreadsheet; a snapshot writes committed `data/*.json` that GitHub Pages serves from `main`.

## Roles

| Who | Where | What |
| --- | --- | --- |
| Editors | [Management sheet](https://docs.google.com/spreadsheets/d/1bmfsOkVl16OJ2KWzWJG6NtV5Ds98fXKnSiRtxKxgzlw) | Edit tabs (`news`, `publications`, …) |
| Automation | `.github/workflows/snapshot-pages.yml` | Preferred: schedule / manual snapshot → commit JSON → push `main` |
| Maintainer | This repo | Fallback: run snapshot locally → commit → push |
| Visitors | https://soonjokwon.github.io/adam-pnu/ | Load `data/<tab>.json` only |

`adam-lab-widgets` is untouched; image paths still resolve to its Pages CDN when needed. The management sheet stays **link-shared Viewer** (public gviz) so Actions need no Google secrets.

## Tabs

`news`, `publications`, `patents`, `awards`, `members`, `projects`, `talks`, `gallery`, `sections`

Tab names and columns must match `scripts/snapshot_sheet.py` (`TABS`).

## Preferred: GitHub Actions

Workflow: [`.github/workflows/snapshot-pages.yml`](../.github/workflows/snapshot-pages.yml)

- **Triggers:** `workflow_dispatch` (Actions → Run workflow) and a weekday schedule (`cron: 18,48 0-9 * * 1-5` ≈ 09:18–18:48 KST, every 30 minutes).
- **Job:** checkout → Python 3.12 → `python3 scripts/snapshot_sheet.py` → if `data/` / `js/sheet/sheets.js` changed, commit `data: refresh sheet snapshot` and push to `main` (`permissions: contents: write`, `GITHUB_TOKEN`).
- **Pages:** Deploy from branch on `main` — no `actions/deploy-pages` step.

Once the workflow file is on `main` (requires a token with **workflow** scope to add/update `.github/workflows/*`), this is the preferred path.

## Fallback: manual snapshot

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
2. Prefer: Actions → **Snapshot sheet → Pages** → Run workflow (or wait for cron).  
3. Fallback: run `python3 scripts/snapshot_sheet.py`, review `git diff data/`, commit, push `main`.  
4. GitHub Pages (branch deploy from `main`) publishes the site.

## Runtime

- Loader: `js/sheet/sheet-loader.js` → `ADAM.load(tab)` fetches `data/<tab>.json?v=<ADAM_DATA_VERSION>`.  
- `window.ADAM_SHEETS` is empty; `ADAM.sheetUrl()` returns `""`.  
- Network tab on Pages should show **no** `docs.google.com` / `gviz` requests.
