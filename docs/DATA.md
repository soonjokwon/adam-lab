# Data pipeline (sheet → JSON → Pages)

The public site **never** fetches Google Sheets in the browser. Editors update a **private** management spreadsheet; Actions (or a local snapshot) writes committed `data/*.json` that GitHub Pages serves from `main`.

## Roles

| Who | Where | What |
| --- | --- | --- |
| Editors | [Management sheet](https://docs.google.com/spreadsheets/d/1bmfsOkVl16OJ2KWzWJG6NtV5Ds98fXKnSiRtxKxgzlw) | Edit tabs (`news`, `publications`, …) |
| Automation | `.github/workflows/snapshot-pages.yml` | Preferred: schedule / manual snapshot via Sheets API → commit JSON → push `main` |
| Maintainer | This repo | Fallback: run snapshot locally with SA credentials → commit → push |
| Visitors | https://soonjokwon.github.io/adam-pnu/ | Load `data/<tab>.json` only |

`adam-lab-widgets` is untouched. Link-share Viewer is **not** required; the sheet stays private.

## Service account + GitHub Secret

1. Create a Google Cloud service account and download its JSON key.  
2. Share the management spreadsheet with the **service account email** as **Viewer** (File → Share).  
3. In the GitHub repo: Settings → Secrets and variables → Actions → New repository secret  
   - Name: **`GOOGLE_SERVICE_ACCOUNT_JSON`**  
   - Value: the full contents of the SA key JSON file (one string).  
4. Do not commit the key. Do not print the secret in logs.

Local / fallback auth (same SA):

```bash
python3 -m pip install google-auth google-api-python-client
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json
# or: export GOOGLE_SERVICE_ACCOUNT_JSON="$(cat /path/to/sa.json)"
python3 scripts/snapshot_sheet.py
```

## Tabs

`news`, `publications`, `patents`, `awards`, `members`, `projects`, `talks`, `gallery`, `sections`

Tab names and columns must match `scripts/snapshot_sheet.py` (`TABS`).

## Preferred: GitHub Actions

Workflow: [`.github/workflows/snapshot-pages.yml`](../.github/workflows/snapshot-pages.yml)

- **Triggers:** `workflow_dispatch` only — no periodic cron. Refresh is triggered manually or by Apps Script when the management sheet changes (external `workflow_dispatch`).  
- **Job:** checkout → Python 3.12 → write `secrets.GOOGLE_SERVICE_ACCOUNT_JSON` to a temp file → `pip install google-auth google-api-python-client` → `python3 scripts/snapshot_sheet.py` → if `data/` / `js/sheet/sheets.js` changed, commit `data: refresh sheet snapshot` and push `main`.  
- **Pages:** Deploy from branch on `main` — no `actions/deploy-pages` step.

## Fallback: manual snapshot

```bash
python3 -m pip install google-auth google-api-python-client
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json
python3 scripts/snapshot_sheet.py

git add data/ js/sheet/sheets.js
git commit -m "data: refresh sheet snapshot"
git push origin main
```

Optional: `python3 scripts/snapshot_sheet.py --tabs news members`

The script also updates `js/sheet/sheets.js` (`ADAM_DATA_VERSION` cache-bust) and writes `data/snapshot.json` metadata.

## Deploy checklist

1. Edit the Sheet (shared Viewer with the SA email).  
2. Prefer: sheet change → Apps Script `workflow_dispatch`, or Actions → **Snapshot sheet → Pages** → Run workflow.  
3. Fallback: run `python3 scripts/snapshot_sheet.py` with SA credentials, review `git diff data/`, commit, push `main`.  
4. GitHub Pages (branch deploy from `main`) publishes the site.

## Runtime

- Loader: `js/sheet/sheet-loader.js` → `ADAM.load(tab)` fetches `data/<tab>.json?v=<ADAM_DATA_VERSION>`.  
- `window.ADAM_SHEETS` is empty; `ADAM.sheetUrl()` returns `""`.  
- Network tab on Pages should show **no** `docs.google.com` / `gviz` requests.
