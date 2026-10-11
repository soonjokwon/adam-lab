# ADAM Lab@PNU

부산대학교 ADAM Lab 공개 홈페이지입니다. Google Sites([adam-pnu](https://sites.google.com/view/adam-pnu))와 같은 메뉴·페이지 트리를 유지합니다. 목록·글 블록은 **커밋된 `data/*.json` 스냅샷**만 읽어 렌더링합니다 (브라우저에서 Google Sheet / gviz 호출 없음, 위젯 iframe 없음).

- **Repo:** https://github.com/soonjokwon/adam-pnu  
- **Pages URL:** https://soonjokwon.github.io/adam-pnu/  
- **편집용 시트 (사이트는 직접 읽지 않음):** [ADAM Lab 위젯 시트](https://docs.google.com/spreadsheets/d/1bmfsOkVl16OJ2KWzWJG6NtV5Ds98fXKnSiRtxKxgzlw)  
- Sites용 위젯 저장소([adam-lab-widgets](https://github.com/soonjokwon/adam-lab-widgets))는 별도로 유지되며, 이 사이트는 수정하지 않습니다. 시트 이미지 경로(`assets/…`)만 위젯 Pages CDN에서 불러옵니다.
- 데이터 파이프라인 상세: [`docs/DATA.md`](docs/DATA.md)

## 페이지 트리

| 메뉴 | 경로 | 데이터 (`data/*.json`) |
| --- | --- | --- |
| Home | `/` | Hero(로컬) · `news` · `sections` (`home-*`) |
| Research | `/research/` | `sections` (`research`) · `projects` |
| Team | `/team/` | `members` |
| Team → Professor | `/team/professor/` | `sections` (`professor`) · `talks` |
| Team → Recruiting | `/team/recruiting/` | `sections` (`recruit-*`) · `projects` (모집 중) |
| Awards | `/awards/` | `awards` |
| Publications | `/publications/` | `publications` · `patents` |
| Board | `/board/` | `news` · `gallery` |

## 데이터 스냅샷 (시트 → JSON → Pages)

시트는 **편집용**입니다. 브라우저는 Sheet를 읽지 않습니다. 공개 반영은 JSON 스냅샷을 `main`에 커밋하는 방식입니다.

### 권장: GitHub Actions

워크플로: [`.github/workflows/snapshot-pages.yml`](.github/workflows/snapshot-pages.yml)

- 트리거: `workflow_dispatch`만 (주기 cron 없음). 시트 변경 시 Apps Script가 외부에서 dispatch, 또는 Actions에서 수동 Run  
- Sheets API + 서비스 계정 (repo secret **`GOOGLE_SERVICE_ACCOUNT_JSON`**); 시트는 SA 이메일에 Viewer로 공유  
- 변경이 있을 때만 `data: refresh sheet snapshot` 커밋 후 `main` 푸시 → Pages(브랜치 배포) 갱신  

상세: [`docs/DATA.md`](docs/DATA.md).

### 대안: 수동 스냅샷

```bash
python3 -m pip install google-auth google-api-python-client
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json
python3 scripts/snapshot_sheet.py
git add data/ js/sheet/sheets.js
git commit -m "data: refresh sheet snapshot"
git push origin main
```

## 로컬에서 보기

```bash
python3 -m http.server 8080
```

http://localhost:8080/ — JSON·이미지 CDN만 사용합니다 (Sheet 네트워크 호출 없음).

## GitHub Pages

Pages는 **`main` 브랜치 루트** 배포입니다 (`.nojekyll`). Actions는 JSON 스냅샷 커밋용이며 `actions/deploy-pages`는 쓰지 않습니다.

1. Settings → Pages → Deploy from a branch  
2. Branch: `main` / folder: `/ (root)` → Save  

CLI 예:

```bash
gh api -X PUT repos/soonjokwon/adam-pnu/pages \
  -f build_type=legacy \
  -f source[branch]=main \
  -f source[path]=/
```

### Custom domain

나중에 도메인을 붙일 때는 루트 `CNAME`(도메인 한 줄)과 DNS만 맞춥니다. 이 저장소는 특정 도메인을 가정하지 않습니다.

## 데이터·렌더

- 스냅샷 스크립트: `scripts/snapshot_sheet.py` (gviz CSV → `data/<tab>.json`)  
- 로더: `js/sheet/sheet-loader.js` — `ADAM.load`는 로컬 JSON만  
- 렌더러: `js/widgets/*.js` + `css/widgets/*` (사이트 내 복제본; 원본 widgets 저장소는 그대로)  
- 이미지 `assets/…` → `https://soonjokwon.github.io/adam-lab-widgets/` CDN  
- 모바일: iframe 고정 높이 없음 — 페이지 스크롤로 자연스럽게 흐름  

## 히어로

Home 상단 **ADAM Lab Intro**는 `assets/hero/index.html`에 호스팅합니다. Research Pillars 왼쪽 이미지는 `assets/home/pillars/`.

## 구조

```
index.html research/ team/ awards/ publications/ board/
data/*.json          scripts/snapshot_sheet.py  docs/DATA.md
assets/hero/  assets/home/pillars/
css/site.css  css/sheet/  css/widgets/
js/site.js    js/sheet/   js/widgets/
.nojekyll
```
