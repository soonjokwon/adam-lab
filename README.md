# ADAM Lab@PNU — GitHub Pages site

부산대학교 ADAM Lab 공개 홈페이지입니다. Google Sites([adam-pnu](https://sites.google.com/view/adam-pnu))와 같은 메뉴·페이지 트리를 유지하고, 목록·글 블록은 [adam-lab-widgets](https://github.com/soonjokwon/adam-lab-widgets) iframe으로 재사용합니다.

- **Repo:** https://github.com/soonjokwon/adam-lab-site
- **Pages URL:** https://soonjokwon.github.io/adam-lab-site/
- **데이터 시트:** [ADAM Lab 위젯 시트](https://docs.google.com/spreadsheets/d/1bmfsOkVl16OJ2KWzWJG6NtV5Ds98fXKnSiRtxKxgzlw)
- **위젯 Pages:** https://soonjokwon.github.io/adam-lab-widgets/

## 페이지 트리 (Sites와 동일)

| 메뉴 | 경로 | 주요 위젯 |
| --- | --- | --- |
| Home | `/` | Hero(로컬) · `news/` · `sections/?block=home-*` |
| Research | `/research/` | `sections/?block=research` · `projects/` |
| Team | `/team/` | `members/?alumni=1` |
| Team → Professor | `/team/professor/` | `sections/?block=professor` · `talks/` |
| Team → Recruiting | `/team/recruiting/` | `sections/?block=recruit-*` · `projects/?recruit=1&compact=1` |
| Awards | `/awards/` | `awards/` |
| Publications | `/publications/` | `publications/` · `patents/` |
| Board | `/board/` | `news/?view=list` · `gallery/` |

## 로컬에서 보기

저장소 루트에서 정적 서버만 띄우면 됩니다 (파일 프로토콜은 iframe·모듈 경로에 불리합니다).

```bash
# Python 3
python3 -m http.server 8080
# 또는
npx --yes serve -l 8080
```

브라우저에서 http://localhost:8080/ 을 엽니다. 위젯은 원격 Pages(`soonjokwon.github.io/adam-lab-widgets`)를 iframe으로 불러오므로 인터넷이 필요합니다.

## GitHub Pages 설정

**Actions 워크플로는 사용하지 않습니다.** `main` 브랜치 루트를 그대로 게시합니다.

1. 저장소 → **Settings → Pages**
2. **Build and deployment → Source:** Deploy from a branch
3. Branch: `main` / folder: `/ (root)` → Save
4. 루트에 `.nojekyll`이 있어 Jekyll 처리를 건너뜁니다.

CLI로 켜기 (권한 있는 토큰 필요):

```bash
gh api -X POST repos/soonjokwon/adam-lab-site/pages \
  -f build_type=legacy \
  -f source[branch]=main \
  -f source[path]=/
# 이미 있으면
gh api -X PUT repos/soonjokwon/adam-lab-site/pages \
  -f build_type=legacy \
  -f source[branch]=main \
  -f source[path]=/
```

게시까지 1–2분 걸릴 수 있습니다. `404`면 Pages가 아직 안 켜졌거나 빌드 중입니다 — Settings → Pages에서 상태를 확인하세요.

### Custom domain

나중에 도메인을 붙일 때는 루트에 `CNAME` 파일(도메인 한 줄)을 추가하고 DNS를 맞춥니다. 이 저장소는 도메인을 가정하지 않습니다.

## 히어로

Home 상단의 **ADAM Lab Intro** 애니메이션은 Sites 코드 삽입본을 추출해 `assets/hero/index.html`에 호스팅합니다. Google Sites 만료·프록시 URL을 핫링크하지 않습니다. 폰트만 Google Fonts를 사용합니다.

Research Pillars 왼쪽 캐러셀은 Sites `sitesv-images` CDN이 403을 반환해, 동일 연구실 공개 자산(`adam-lab-widgets` research figures)을 `assets/home/pillars/`에 복사해 사용합니다. 원본 3D 슬라이드 파일이 생기면 이 폴더만 교체하면 됩니다.

## 위젯 높이 (모바일)

부모 페이지(`js/site.js`)는 `message` 이벤트에서 `{ type: "adam-widget-height", height }` 를 받아 iframe 높이를 맞춥니다.

위젯 쪽(`adam-lab-widgets` shared loader)이 같은 메시지를 보내도록 최소 변경이 필요합니다. 반영 전에는 README 권장 `min-height`와 **전체 화면으로 보기** 링크로 동작합니다. Sites 임베드는 메시지를 무시해도 기존 비율 박스가 유지됩니다.

## 구조

```
index.html              Home
research/ team/ awards/ publications/ board/
assets/hero/            Intro 애니메이션
assets/home/pillars/    Research Pillars 이미지
css/site.css  js/site.js
.nojekyll
```
