# ADAM Lab@PNU

부산대학교 ADAM Lab 공개 홈페이지입니다. Google Sites([adam-pnu](https://sites.google.com/view/adam-pnu))와 같은 메뉴·페이지 트리를 유지하고, 목록·글 블록은 **Google Sheet를 직접 읽어** 이 사이트에서 렌더링합니다 (위젯 iframe/embed 없음).

- **Repo:** https://github.com/soonjokwon/adam-pnu  
- **Pages URL:** https://soonjokwon.github.io/adam-pnu/  
- **데이터 시트:** [ADAM Lab 위젯 시트](https://docs.google.com/spreadsheets/d/1bmfsOkVl16OJ2KWzWJG6NtV5Ds98fXKnSiRtxKxgzlw)  
- Sites용 위젯 저장소([adam-lab-widgets](https://github.com/soonjokwon/adam-lab-widgets))는 별도로 유지되며, 이 사이트는 수정하지 않습니다. 시트 이미지 경로(`assets/…`)만 위젯 Pages CDN에서 불러옵니다.

## 페이지 트리

| 메뉴 | 경로 | 시트 탭 / 렌더 |
| --- | --- | --- |
| Home | `/` | Hero(로컬) · `news` · `sections` (`home-*`) |
| Research | `/research/` | `sections` (`research`) · `projects` |
| Team | `/team/` | `members` (`alumni` 펼침) |
| Team → Professor | `/team/professor/` | `sections` (`professor`) · `talks` |
| Team → Recruiting | `/team/recruiting/` | `sections` (`recruit-*`) · `projects` (모집 중) |
| Awards | `/awards/` | `awards` |
| Publications | `/publications/` | `publications` · `patents` |
| Board | `/board/` | `news` 목록형 · `gallery` |

## 로컬에서 보기

```bash
python3 -m http.server 8080
# 또는
npx --yes serve -l 8080
```

http://localhost:8080/ — 시트·이미지 CDN 접근을 위해 인터넷이 필요합니다.

## GitHub Pages

**GitHub Actions 워크플로는 사용하지 않습니다.** `main` 브랜치 루트 + `.nojekyll`.

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

- 시트 ID: `1bmfsOkVl16OJ2KWzWJG6NtV5Ds98fXKnSiRtxKxgzlw` (링크가 있는 사용자 = 뷰어)  
- 로더: `js/sheet/sheet-loader.js` (widgets의 gviz/CSV 로더를 사이트에 복제)  
- 렌더러: `js/widgets/*.js` + `css/widgets/*` (사이트 내 복제본; 원본 widgets 저장소는 그대로)  
- 시트 실패 시 `https://soonjokwon.github.io/adam-lab-widgets/data/<tab>.json` 폴백  
- 모바일: iframe 고정 높이 없음 — 페이지 스크롤로 자연스럽게 흐름  

## 히어로

Home 상단 **ADAM Lab Intro**는 `assets/hero/index.html`에 호스팅합니다. Research Pillars 왼쪽 이미지는 `assets/home/pillars/`.

## 구조

```
index.html research/ team/ awards/ publications/ board/
assets/hero/  assets/home/pillars/
css/site.css  css/sheet/  css/widgets/
js/site.js    js/sheet/   js/widgets/
.nojekyll
```
