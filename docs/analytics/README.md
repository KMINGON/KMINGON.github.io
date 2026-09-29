# 블로그 방문 통계 운영

확인일: 2026-09-29. 대상: `KMINGON.github.io` main, `https://blog.mingon.dev/`.

## 현재 진행 상태

**2026-09-29 Cloudflare 기본 통계 추가의 main 푸시·GitHub Pages 운영 배포를 완료했다.** 구현 커밋은 `5ae28d766985458c9a594e0fcaafa8aec82d1076`, [배포 실행 36528911022](https://github.com/KMINGON/KMINGON.github.io/actions/runs/36528911022)은 build/deploy 모두 성공했다. 배포 완료는 2026-09-29 15:01:36 KST다. 운영 응답 + 실제 SDK 검증이 통과했고, 정상 HOME 조회의 Cloudflare 수집 POST 1건에서 실제 HTTP 204를 확인했다. 관리자 설정은 변경하지 않았으며 계정 대시보드·지역 설정·집계 반영은 미확인, 수동 스크립트의 지역 제외는 미구현이다.

| Cloudflare 구성 | 값 / 상태 |
| --- | --- |
| 실행 대상 | production 빌드 + HTTPS `blog.mingon.dev`의 기본 포트, 404 제외 |
| 공개 사이트 토큰 | `ba6343dfd33a4e5998a37308989dd022` (사용자 제공, API 인증키 아님) |
| 설치 방식 | GTM 밖의 로컬 로더 → `type="module"`, `https://static.cloudflareinsights.com/beacon.min.js`, `data-cf-beacon` JSON token |
| Google 분석 | `GTM-KLNKCLLG` / `G-GGY59YGHKJ`, 기존 명시적 동의 조건 유지 |
| 기본 통계 거부 | 개인정보 안내 페이지와 footer의 ‘기본 통계 설정’, 저장 후 새로고침 |
| 계정 설정 확인 | 관리자 화면 미조회. 운영 응답의 자동 삽입 없음과 지정 토큰·도메인의 RUM HTTP 204 확인. 계정 메타데이터·지역 설정·대시보드 집계는 별도 확인 필요 |
| 검증 | 네 가지 빌드·Node/Chromium 스텁 및 배포 전후 실제 SDK 검증 통과. 정상 HOME의 CF POST 1건만 실제 전송(204), 나머지 검증 수집 요청은 가로챔 |

### 기존 운영 상태 (2026-09-23)

**GTM 버전 2와 사이트 운영 배포를 완료했다. 운영 응답을 사용한 동의·페이지 조회·민감 값 제외 검증과 실제 GA4 HTTP 204 응답을 확인했다. GA4 보고서 화면의 집계 반영 여부는 별도로 남아 있다.**

| 항목 | 상태 |
| --- | --- |
| 블로그 웹 컨테이너 | `GTM-KLNKCLLG`, Live 버전 2 |
| Google tag / 트리거 / 사용자 정의 변수 | 1개 / 1개 / 3개, 가져오기 및 UI 설정 확인 완료 |
| 게시 버전 이름 | `Blog GA4 - consent gated migration` |
| 게시 시각 | 2026-09-23 19:19 KST (GTM UI 기준) |
| 실제 게시 설정 | [GTM 버전 2 내보내기](gtm-blog.json), exportTime `2026-09-23 10:21:07` UTC |
| GA4 기존 속성·측정 ID | 확인 완료, 기존 값 유지 |
| GA4 스트림 URL | `https://kmingon.github.io` → `https://blog.mingon.dev` 변경 완료 |
| GA4 향상된 측정 | 사용 안 함, 게시 후 UI에서도 비활성 상태 재확인 |
| 게시된 GTM + 로컬 사이트 검증 | 실제 태그 실행·동의 차단·민감 값 제거·page_view 1회 확인 |
| GA4 수집 서버 | 기존 측정 ID로 `/g/collect` HTTP 204 확인 |
| 운영 사이트 | `b5c356d` 배포 완료, 직접 GA·Cloudflare 제거 및 동의 기반 GTM 적용 |
| 사이트 배포 완료 | 2026-09-23 22:03:19 KST, [GitHub Actions](https://github.com/KMINGON/KMINGON.github.io/actions/runs/35864259243) 성공 |
| 운영 검증 기록 | [production-validation.json](production-validation.json) |

GTM 게시와 사이트 배포를 각각 완료했다. 운영 사이트는 동의한 방문에만 블로그 컨테이너를 로드한다. toy 컨테이너와 속성은 수정하지 않았다.

## 계정과 조회 위치

| 구분 | 값 |
| --- | --- |
| GTM 계정 | `personal-web` / `6378414723` |
| 블로그 컨테이너 | `blog.mingon.dev` / `GTM-KLNKCLLG` |
| GTM 내부 containerId / workspace | `264952584` / `2` |
| GA4 계정 | `김민곤` / `381072497` |
| GA4 속성 | `Github-Blog` / `520438050` |
| GA4 웹 스트림 | `Github-Blog` / `13322659823` |
| GA4 측정 ID | `G-GGY59YGHKJ` |

- [블로그 GTM 작업공간](https://tagmanager.google.com/#/container/accounts/6378414723/containers/264952584/workspaces/2)
- [기존 GA4 속성](https://analytics.google.com/analytics/web/#/a381072497p520438050/reports/intelligenthome): 관리 → 데이터 스트림 → Github-Blog에서 측정 ID와 향상된 측정을 확인한다.
- 페이지별 조회: GA4 보고서 → 참여도 → 페이지 및 화면. 보고서 메뉴는 계정의 보고서 모음에 따라 달라질 수 있다.
- 이관 직후: GA4 실시간 / DebugView와 브라우저 Network를 함께 확인한다. 일반 보고서는 집계 지연이 있으므로 즉시 검증 수단으로 삼지 않는다.

`GTM-W63DRPTG`는 toy 전용이다. 블로그에 설치하거나 해당 컨테이너의 초안을 수정하지 않는다. 같은 GTM 계정에서 서로 다른 웹 컨테이너를 사용하며 GA4 속성도 그대로 분리한다.

## 이관 전 확인 결과

- `hugo.toml`의 `gtagId`로 Anatole 테마의 직접 GA 스니펫을 사용했다.
- 테마 `footer.html`이 sidebar와 base에서 각각 호출되면서 운영 HOME에 같은 `gtag/js?id=G-GGY59YGHKJ`와 `gtag('config', ...)`가 두 번 들어갔다. HTML 중복은 확인했지만 과거 통계가 정확히 두 배였다는 뜻은 아니다.
- 로컬 `head.html`에서 Cloudflare Web Analytics beacon도 별도로 삽입했다.
- 동의 UI·동의 기록·개인정보 안내는 없었다.
- 2026-09-23 운영 응답에는 CSP 및 CSP Report-Only 헤더가 없었고 HTML에도 CSP meta가 없었다.
- GitHub Pages가 정적 파일을 제공한다. `.github/workflows/deploy.yml`에서 main push → Hugo Extended 0.149.0 / Dart Sass 1.91.0 → Pages 배포가 실행된다. 별도 서버·DB는 없다.

## 사이트 구현

`hugo.toml`에는 실제 블로그 컨테이너 ID·기존 GA4 측정 ID와 사용자 제공 Cloudflare 공개 사이트 토큰을 둔다. 직접 `gtagId`는 제거한다. `layouts/partials/analytics/gtm.html`과 `cloudflare.html`은 production 빌드이며 baseURL이 `https://blog.mingon.dev/`인 경우에만 각 로컬 스크립트를 삽입한다. 실제 GTM 요청은 HTTPS `blog.mingon.dev`에서 동의한 경우에만 발생한다. 404에는 추적 스크립트를 넣지 않는다.

`layouts/partials/footer.html`을 로컬에서 오버라이드하여 직접 GA 코드를 제거했다. 동의 UI와 공통 확대 스크립트는 base footer에서 한 번만 넣는다. HOME의 Analysis·Review 9편과 기존 카테고리/글 내용은 그대로 둔다.

2026-09-23 GTM 이관 당시 Cloudflare beacon을 제거했다. 2026-09-29 변경은 Cloudflare 기본 통계를 다시 별도로 추가하며, 당시의 제거·배포 기록은 과거 상태를 나타낸다.

### Cloudflare 기본 통계 (2026-09-29)

- `assets/js/cloudflare-analytics.js`는 Google의 `dataLayer`나 동의 기록을 사용하지 않는다. 기본 통계를 켠 상태에서만 공식 module 스크립트를 한 번 추가한다. Google 동의가 미선택·거부여도 기본 통계는 독립적으로 동작한다.
- 호스트는 런타임의 `location.origin === 'https://blog.mingon.dev'`로 다시 제한한다. 개발 빌드, 다른 baseURL의 preview 빌드, `kmingon.github.io`, localhost, HTTP, 비표준 포트에서는 실행하지 않는다. 두 로더 모두 같은 배포·호스트 경계를 따른다.
- `blog.basic-analytics-disabled.v1` 로컬 저장소 값이 `1`이면 스크립트를 요청하지 않는다. `0` 또는 기록 없음은 기본 통계 사용이다. 만료를 따로 두지 않으며 사이트 저장소 삭제 시 초기화된다. 이 기록은 방문자 식별이 아닌 거부 선택 보존용이다.
- ‘기본 통계 끄고 새로고침’ / ‘켜고 새로고침’ 버튼은 저장 후 페이지를 다시 로드한다. 이미 실행된 스크립트의 리스너는 DOM에서 태그를 지워도 남으므로 새로고침이 필요하다. **현재 페이지의 종료 시점 전송까지 소급 차단하는 기능은 아니다. 새 문서부터 로드를 막으며, 기존 데이터도 삭제하지 않는다.** 다른 탭의 기본 통계 변경도 `storage` 이벤트로 새로고침한다.
- 거부 기록을 읽을 수 없으면 수집하지 않는다. 저장 실패 시 성공으로 표시하거나 새로고침하지 않고 실패 안내를 표시한다. Google 동의 키는 건드리지 않는다.
- 기존 `data-cf-beacon` 또는 Cloudflare beacon script가 DOM에 있으면 추가하지 않는다. 이는 중복 삽입을 줄이는 방어일 뿐, **계정에서 자동 삽입된 스크립트의 실행·opt-out 우회를 막아주지는 않는다. 자동 삽입을 꺼야 한다.** MutationObserver나 Google 태그를 통한 우회 로더는 추가하지 않는다.
- 2026-09-29 운영 HOME을 HTTP로 읽은 결과 `server: GitHub.com`, Cloudflare beacon 0개, CSP 헤더·meta 없음이었다. 읽기만 했으며 분석 스크립트를 실행하지 않았다. 계정 전체나 지역별 응답을 검증한 결과는 아니다.
- Cloudflare 기본 방문·성능 지표만 사용한다. 입력값·검색어·사용자 ID를 보내는 커스텀 이벤트는 추가하지 않는다. Google의 canonical URL/origin 정제는 Google에만 적용된다. Cloudflare의 URL 정제·수집 필드는 제공 업체의 동작이므로 동일한 필터를 적용했다고 설명하지 않는다. `strict-origin` referrer meta는 유지한다.
- Cloudflare는 통계용 쿠키·localStorage·지문을 사용하지 않는다고 안내하지만, 네트워크 요청 처리 자체는 IP/브라우저 정보를 동반한다. 쿠키 없음이 전세계 동의 면제라는 법적 결론은 내리지 않는다.

### Google 동의와 철회

- 최초 방문·거부·기간 만료: GTM/GA를 요청하지 않는다. 동의 상태를 보내는 cookieless ping도 발생시키지 않는다.
- 허용: 컨테이너를 로드하기 **전에** `analytics_storage=granted`, 광고 관련 세 항목은 `denied`로 설정한다. 이미 확인된 동의 상태로 시작하므로 실행 중인 GTM에 `gtag('consent', 'update', ...)`를 보내는 순서 문제를 피한다.
- 컨테이너 로드 요청 후 `dataLayer`에 `blog_analytics_ready` 이벤트를 한 번 넣는다. 이 이벤트는 GTM 트리거용이며 GA4의 커스텀 이벤트 태그는 만들지 않는다.
- 선택은 `blog.analytics-consent.v1` 로컬 저장소에 최대 180일 보관한다. 저장소 차단 시 해당 문서에서만 선택이 유효하다.
- ‘Google 통계 설정’에서 철회하면 GA4 전송 차단 플래그를 설정하고 쿠키를 정리한 뒤 페이지를 새로 불러온다. 다른 탭에서 동의를 철회하거나 저장소를 비운 경우에도 `storage` 이벤트로 중지한다.
- 새 분석 쿠키는 `blog.mingon.dev` 범위, 만료 180일을 GTM Google tag에서 지정한다. 철회 시 블로그 쿠키와 과거 상위 도메인의 블로그 스트림 쿠키를 지운다. 다른 서비스의 `_ga_*` 및 상위 도메인의 공용 `_ga` 쿠키는 삭제하지 않는다.
- `<noscript>` GTM iframe은 넣지 않는다. JavaScript 없이 동의를 확인할 수 없는 상황에서 요청이 발생하는 경로를 만들지 않기 위해서다.

### Google 수집 항목 제한

| 값 | 처리 |
| --- | --- |
| `page_location` | Hugo가 만든 공개 글의 canonical origin + pathname. 주소창 쿼리·해시를 읽어 전달하지 않음 |
| `page_title` | 빌드 시 정해진 글 제목 |
| `page_referrer` | 유입 URL의 origin만, 경로·쿼리·해시 제거 |
| 검색어·폼 값·클릭 URL | 별도 수집 코드 없음. GA4 향상된 측정도 비활성화 |
| 광고·Signals | 광고 태그 없음. 광고 동의 세 항목 denied, 두 signals 설정 false |

`Referrer-Policy`에 해당하는 HTML meta는 `strict-origin`으로 지정해 스크립트 요청의 Referer에도 상세 경로와 쿼리가 실리지 않게 한다. HTTP 요청 자체에는 IP·User-Agent 등의 정보가 포함된다. 이 구현을 ‘개인정보를 전혀 처리하지 않는 분석’이라고 설명하지 않는다.

GTM의 Google tag 하나가 문서당 자동 `page_view`를 한 번 보낸다. 수동 `page_view` 이벤트 태그는 추가하지 않는다. GA4의 `session_start`, `first_visit`, `user_engagement` 같은 기본 이벤트는 별도로 발생할 수 있다. 향상된 측정의 history 기반 page_view를 다시 켜거나 Google tag를 All Pages에도 중복 연결하지 않는다.

### CSP

이번 변경은 새 CSP를 강제로 적용하거나 `unsafe-inline` / `unsafe-eval` 허용을 추가하지 않는다. GitHub Pages용 `_headers` 파일을 만드는 것으로 응답 헤더가 적용된다고 가정하지 않는다.

추후 CSP를 도입한다면 페이지의 기존 스크립트·스타일·외부 이미지까지 별도로 조사하고, 실제 헤더를 설정할 수 있는 제공 계층에서 검증한다. GTM/GA에 필요한 출처는 Google의 [CSP 가이드](https://developers.google.com/tag-platform/security/guides/csp)를 기준으로 최소화한다. 로컬 로더는 외부 JS 파일로 제공하며 Custom HTML / Custom JavaScript 변수는 이 컨테이너에 추가하지 않는다.

Cloudflare 수동 설치에 필요한 추가 범위는 `script-src`의 `https://static.cloudflareinsights.com/beacon.min.js`와 `connect-src`의 `https://cloudflareinsights.com`이다. `script-src-elem`을 별도로 쓴다면 그 지시자에도 스크립트를 허용해야 한다. 자동 삽입의 같은 출처 `/cdn-cgi/rum`과 혼동하지 않는다. 기존 사이트 전체 CSP 검증 없이 이 항목만으로 완전한 정책을 만들지 않는다. 현재 CSP가 없어 이번 변경에서 새 정책·와일드카드·`unsafe-inline`·`unsafe-eval`을 추가하지 않았다. 수동 beacon은 버전 고정을 지원하지 않아 외부 스크립트에 임의의 SRI를 고정하지 않으며, 로컬 로더의 Hugo fingerprint/SRI는 유지한다.

## Cloudflare 운영 확인사항과 한계

1. Cloudflare Dashboard → Web Analytics → `blog.mingon.dev` → Manage site에서 사용자 제공 토큰과 사이트 연결을 확인한다. 저장소의 토큰과 정확히 일치해야 한다. 공급자의 도메인 검증이 서브도메인별 엄격한 격리를 보장한다고 가정하지 않고, 사이트 로더의 정확한 origin 검사도 유지한다.
2. 수동 스크립트 설치를 사용하고 Web Analytics 자동 삽입, 프록시/Zaraz/기타 태그의 중복 삽입 여부를 확인한다. 자동 삽입이 켜져 있으면 로컬 opt-out이 무력화될 수 있으므로 해결 전 배포하지 않는다. 배포 전 실제 운영 응답에 자동 삽입이 없는 것을 확인했다. 이번 요청은 관리자 설정 변경을 포함하지 않으며, 로그인된 계정 대시보드는 조회하지 않았다. 응답 검사로 계정 전체 설정 확인을 대신하지 않는다.
3. **수동 스크립트는 자동 삽입 설정의 ‘Enable, excluding visitor data in the EU’를 자동 상속하지 않는다.** 이번 코드는 지역 조회나 EU 제외를 구현하지 않는다. 사용자는 이 미구현 사항을 한계로 기록하면서 현 구조를 배포하도록 승인했다. 계정/지역 설정 및 지역별 적합성은 확인되지 않았으며, 필요한 지역 제외나 별도 동의 정책을 구현한 것으로 간주하지 않는다. 쿠키 없는 분석이라는 설명을 이 판단의 대체물로 사용하지 않는다.
4. 배포 시에는 배포 응답과 브라우저 Network에서 수동 CF script 1개, 지정 토큰, Google 미선택·거부 요청 0개를 확인한다. 기본 통계를 끈 뒤 새 문서에는 CF 요청도 0개여야 한다. 새 preview 호스트나 CF 프록시를 붙일 때도 이 조건을 재검증한다.
5. Cloudflare Dashboard → Web Analytics → `blog.mingon.dev`에서 방문·페이지·유입 및 성능 지표를 조회한다. 스텁 응답은 실제 RUM 수신·대시보드 집계의 성공 증거가 아니다. 승인된 운영 검증에서 민감한 값이 없는 정상 HOME 조회의 CF 수집 POST 1건만 실제 전송해 HTTP 204를 확인했다. 나머지 수집 요청은 가로챘다. HTTP 성공 응답은 계정의 사이트 연결 표시나 대시보드 집계 완료의 증거로 대신하지 않는다.

참고: [Cloudflare 수동 설치와 EU 자동 삽입 옵션](https://developers.cloudflare.com/web-analytics/get-started/), [FAQ: CSP·URL·수동 설치](https://developers.cloudflare.com/web-analytics/faq/), [통계 전송 경로](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/), [Web Analytics 개인정보 안내](https://www.cloudflare.com/web-analytics/).

## 게시 및 운영 배포 (2026-09-23 기록)

2026-09-23에 toy 세션의 명시적인 브라우저 재인계를 받은 뒤 블로그 컨테이너에 후보 JSON을 병합했다. 가져오기 미리보기는 추가 5개, 수정·삭제 0개였으며, Google tag의 모든 구성 매개변수와 추가 동의, 페이지당 한 번 실행, 블로그 전용 hostname·이벤트 조건을 UI에서 확인했다.

[블로그 GTM 버전 2](https://tagmanager.google.com/#/versions/accounts/6378414723/containers/264952584/versions/2)가 Live / 최신으로 표시됐고 공개 `gtm.js` 응답도 HTTP 200이었다. 게시한 실제 내보내기 JSON을 `gtm-blog.json`에 보관했다. Windows Downloads의 `gtm-blog-migration.json`은 가져오기에 쓴 후보이며, 이후 복구·비교에는 저장소의 실제 내보내기를 기준으로 한다.

사이트 변경 커밋 `b5c356de143440646225237540350a17c47aba4f`를 main에 푸시했다. [배포 실행 35864259243](https://github.com/KMINGON/KMINGON.github.io/actions/runs/35864259243)의 빌드·분석 검증·Pages 배포가 모두 성공했다. 실제 배포 완료 시각은 2026-09-23 13:03:19 UTC / 22:03:19 KST다.

운영 검증에서는 HTML을 로컬 파일로 대체하지 않고 `https://blog.mingon.dev/`의 실제 응답을 사용했다. HOME·Analysis·개인정보·Note·Playbook·Write-up 페이지에서 로더 1개, 직접 GA/Cloudflare 제거를 확인했고 HOME의 Analysis·Review 9편도 유지됐다. 데스크톱·모바일에서 실제 Google 태그의 동의 처리와 전송 값을 검사했으며 별도 정상 조회를 실제 GA4 서버로 보내 HTTP 204를 확인했다.

GA4 계정 화면의 보고서 집계 확인은 아직 완료하지 못했다. 운영 배포 시점의 Orca CLI는 Windows 실행 경로 `C:\Users\Brain\AppData\Local\Programs\orca\resources\bin`이 없다는 `Push-Location ... PathNotFound` 오류로 실행되지 않았다. 다른 실행 파일이나 세션으로 우회하지 않았으며, 로그인된 Chrome 창도 조작하지 않았다. 도구 복구 후 Github-Blog `520438050`의 실시간/일반 보고서를 확인한다. HTTP 204를 보고서 집계 완료의 증거로 대신하지 않는다.

다음 GTM 변경도 블로그 전용 컨테이너에서 수행하며, 게시 후 실제 내보내기·검증 결과를 이 문서와 함께 갱신한다.

## Cloudflare 검증 (2026-09-29)

- production/development/preview/옛 github.io baseURL 빌드가 각각 통과했다. 각 빌드의 HTML 298개에서 로더 개수·토큰·404 제외·직접 GA 및 toy 컨테이너 미포함을 확인했다. development/다른 baseURL에는 두 로더 모두 없다.
- `scripts/check-analytics.mjs`: 기본 통계 1회 로드, 전용 토큰 및 module 속성, 호스트/포트 제한, 저장된 거부, 재활성화, 중복 삽입, 읽기·쓰기 실패, 다른 탭 변경과 기존 Google 동의·철회·민감 값 제외 검증 통과. DOM과 저장소 스텁이므로 네트워크 요청은 없다.
- `scripts/check-analytics-browser.mjs`: 실제 Chromium에서 로컬 빌드 파일을 제공하고 Google/CF를 스텁으로 대체한다. 모든 요청을 로컬 응답 또는 차단으로 처리해 실제 분석 서버에 전송하지 않는다. 데스크톱 1365×900 / 모바일 390×844에서 독립 설정, 새로고침 후 거부, Google 반복 허용/철회, CF module/token, 요청 Referer의 origin 제한과 안내창 크기를 확인한다. 제외 호스트·404·JavaScript 비활성·저장소 차단·저장된 opt-out·다른 탭 거부도 포함한다.
- [스텁 브라우저 검증 결과](cloudflare-validation-2026-09-29.json). **외부 vendor 스크립트 자체의 실제 payload나 RUM HTTP 수신·계정 집계는 이 테스트로 검증하지 않는다.** 이전 2026-09-23 실제 GA HTTP 204 기록과 구분한다.

```bash
PATH="$HOME/.local/dart-sass:$PATH" hugo --minify --destination /tmp/blog-cf-production
node scripts/check-analytics.mjs /tmp/blog-cf-production
PATH="$HOME/.local/dart-sass:$PATH" hugo --environment development --destination /tmp/blog-cf-development
node scripts/check-analytics.mjs /tmp/blog-cf-development --excluded
PATH="$HOME/.local/dart-sass:$PATH" hugo --minify --baseURL https://preview.mingon.dev/ --destination /tmp/blog-cf-preview
node scripts/check-analytics.mjs /tmp/blog-cf-preview --excluded
PATH="$HOME/.local/dart-sass:$PATH" hugo --minify --baseURL https://kmingon.github.io/ --destination /tmp/blog-cf-legacy
node scripts/check-analytics.mjs /tmp/blog-cf-legacy --excluded

# 브라우저 검증 도구는 저장소 의존성을 늘리지 않고 임시 경로에 설치한다.
npm install --prefix /tmp/blog-analytics-test --no-save playwright
/tmp/blog-analytics-test/node_modules/.bin/playwright install chromium
BLOG_PLAYWRIGHT_MODULE=file:///tmp/blog-analytics-test/node_modules/playwright/index.mjs \
  node scripts/check-analytics-browser.mjs /tmp/blog-cf-production
# 설치된 Chromium을 재사용할 때는 BLOG_CHROMIUM_EXECUTABLE에 실행 파일 경로를 지정한다.
```

### 배포 전 실제 SDK 검증

로컬 production HTML에 실제 Cloudflare module beacon과 게시된 Google GTM/GA SDK를 로드했다. 쿼리·해시·민감 canary를 넣지 않았으며 수집 POST는 전부 브라우저에서 가로채 HTTP 204로 대체했다. 이 204는 벤더의 실제 수신 응답이 아니다.

데스크톱·모바일 모두 CF 로더 1개, 지정 siteToken과 블로그 URL, Google 미선택/거부 요청 0건, 기본 통계 거부 후 새 문서의 CF 요청 0건을 확인했다. CF가 꺼진 상태에서도 명시적 Google 동의 후에는 기존 측정 ID로 page_view 1건만 생성됐고, 반복 동의 시 중복 로드가 없었다. 기본 통계 재활성화가 Google 동의를 바꾸지 않는 것도 확인했다. 실제 SDK는 로드 및 페이지 종료 시 서로 다른 RUM 이벤트를 만들 수 있으므로 RUM 요청이 여러 개라는 이유만으로 중복 삽입이라고 판단하지 않는다.

검증 기록: [배포 및 실제 SDK 검증](cloudflare-deployment-2026-09-29.json).

### 운영 배포 후 검증

- GitHub Pages의 `build_type=workflow`, `cname=blog.mingon.dev`를 확인했다. 기존 `.github/workflows/deploy.yml` 경로로 main 커밋을 배포했다.
- 운영 HOME·개인정보·Analysis HTML에서 로컬 CF 로더 1개, 자동 삽입 beacon 0개, 지정 토큰 및 Google 동의 로더 1개를 확인했다. 내려받은 CF 로더 바이트는 검증한 production 빌드와 일치했다. 응답은 `server: GitHub.com`이며 CSP 헤더/meta는 여전히 없다.
- **운영 HTML을 로컬 파일로 대체하지 않고** 실제 응답과 실제 Cloudflare/Google SDK를 사용했다. 데스크톱·모바일 모두 CF module script 1개, Google 미선택/거부 요청 0건, 기본 통계 거부 후 새 문서의 CF 요청 0건이었다. Google 동의 후 기존 측정 ID의 page_view 1건, 반복 동의 중복 없음, 독립 설정과 철회도 확인했다. 이 기능 검증의 수집 POST는 모두 가로채 실제 통계를 늘리지 않았다.
- 별도의 깨끗한 브라우저에서 쿼리·해시·민감 canary 없이 `https://blog.mingon.dev/`를 정상 조회했다. 지정 `siteToken`과 HOME URL을 확인한 **CF POST 1건만** 실제로 보내 `https://cloudflareinsights.com/cdn-cgi/rum`의 HTTP 204를 받았다. 이 조회에서도 Google 요청은 0건이었다. 종료 등 추가 수집 요청은 가로챘다.
- 운영 응답에서 자동 삽입 중복이 관찰되지 않았다는 결과는 계정 전체·다른 지역의 설정 검증을 뜻하지 않는다. 공유 관리자 브라우저는 사용하지 않았고 대시보드 집계·토큰 연결 UI는 미조회다. 수동 beacon에 EU 등 지역 제외가 적용됐다고 주장하지 않는다.
- 사용자 profile 미추적 파일 3개는 커밋 대상에서 제외하고 SHA-256 동일성을 확인했다. toy 파일·컨테이너·Google 설정은 변경하지 않았다.

## 기존 검증 결과 (2026-09-23)

- Hugo production/development 빌드 통과.
- `node scripts/check-analytics.mjs /tmp/blog-gtm-build/public`: 동의 상태, 중복 로드 방지, 철회·다른 탭 철회, 저장소 차단, 도메인 분리와 생성된 HTML 298개 검증 통과.
- production HTML에 직접 GA / Cloudflare beacon / GTM noscript iframe / toy 컨테이너가 없음을 확인.
- 로컬 Chromium의 데스크톱 1365×900 / 모바일 390×844 검증 통과: 미동의·거부 시 외부 요청 0건, 허용 시 컨테이너 요청 1건, 재허용 클릭 시 중복 요청 없음, 철회 후 새로고침·추가 요청 없음. 두 화면에서 안내창의 가로·세로 넘침 없음.
- 주소창·유입 주소에 넣은 테스트용 민감 문자열이 dataLayer에 없고, GTM 로더 요청 Referer는 `https://blog.mingon.dev/`만 전달됨을 확인했다. 블로그 쿠키는 제거되고 toy의 스트림 쿠키는 보존됐다.
- 저장된 허용/만료 상태, JavaScript 비활성화, 알 수 없는 404 경로의 비수집도 Chromium에서 확인했다. 이 브라우저 검증은 GTM 응답을 스텁으로 대체해 **사이트 코드의 동의·로더 계약만** 확인했다.
- **게시 후 실제 태그 검증:** 로컬 production HTML만 브라우저에서 대신 제공하고 Google의 게시된 GTM/GA 스크립트를 실제로 로드했다. 운영 사이트 파일은 바꾸지 않았다. 데스크톱·모바일 모두 미동의/거부 외부 요청 0건, 허용 후 GTM 1회·page_view 1건, 재허용 중복 0건, 철회 후 추가 요청 0건이었다.
- 실제 Google 태그가 만든 전송 데이터에서 측정 ID `G-GGY59YGHKJ`, canonical page_location, origin만 남긴 page_referrer, `npa=1`과 블로그 범위 쿠키를 확인했다. 쿼리·해시·유입 경로의 테스트 문자열 및 toy 측정 ID는 없었다. 이 두 시나리오의 collect는 브라우저에서 가로채 테스트 트래픽을 줄였다.
- 별도의 깨끗한 브라우저에서 정상 페이지 조회 1건을 실제 Google 수집 서버로 전송했고 `https://www.google-analytics.com/g/collect`의 HTTP 204 응답을 확인했다. 검증 결과는 [2026-09-23 기록](validation-2026-09-23.json)에 저장했다.
- 블로그 GA4 스트림 ID·측정 ID·현재 URL과 향상된 측정 비활성 상태를 게시 후 다시 확인했다. 기존 Internal Traffic 데이터 필터는 `테스트` 상태였으며 변경하지 않았다.
- **운영 배포 후 검증:** 실제 배포된 HTML/JS로 데스크톱·모바일 각각 미동의·거부 외부 분석 요청 0건, 허용 후 GTM 1회·page_view 1건, 반복 허용 중복 0건, 철회 후 추가 요청 0건을 확인했다. 테스트 문자열 미전송과 블로그 범위 쿠키도 확인했다. 별도 정상 조회의 실제 collect 응답은 HTTP 204였다.
- **남은 확인:** GA4 보고서 집계 반영 여부. 배포 전 최초 실시간 확인에는 데이터가 없었고, 배포 후에는 Orca 실행 경로 오류로 계정 화면에 접근하지 못했다. 보고서 수신 완료로 기록하지 않는다.

```bash
PATH="$HOME/.local/dart-sass:$PATH" hugo --minify
node scripts/check-analytics.mjs public
```

CI에서도 빌드 다음에 동일한 검증을 실행한다. 컨테이너를 수정할 때는 게시 전후 JSON을 비교하고 개인정보 안내와 이 문서를 함께 갱신한다. ID를 바꾸는 것만으로 태그 설정이 이관되지는 않는다.

## 유지보수와 복구

- 새로운 태그나 이벤트를 추가할 때 수집 목적·동의·전송 값부터 확인한다. 입력 원문, 검색어, 쿼리 문자열, 사용자 ID는 기본 수집 항목으로 추가하지 않는다.
- 테마를 갱신하면 로컬 `head.html` / `footer.html`과 upstream 차이를 확인한다. 직접 GA 삽입이 되살아나지 않도록 CI 검증을 유지한다.
- Cloudflare만 중단하려면 `cloudflareAnalyticsToken`을 비우고 이후 승인된 배포를 수행한다. Google 설정은 별개이며 그대로 유지된다. 로더/토큰을 요구하는 검증 기대값도 함께 조정한다. 계정 자동 삽입이 켜져 있다면 사이트 코드 제거만으로 멈추지 않으므로 계정 측 설치를 확인한다.
- Google 분석 전송만 급히 중단해야 하면 GTM의 `Google tag - blog`를 일시중지한 버전을 게시한다. toy 컨테이너에는 손대지 않는다.
- 사이트 측 긴급 중단은 `gtmContainerId`를 비우고 재배포할 수 있다. 이 경우 위의 ‘항상 하나의 로더’ 검사 기대값도 함께 조정해야 한다. 안전한 기본 복구는 동의 처리를 유지하면서 태그만 중지하는 것이다.
- 이관 전 직접 GA를 복원하면 중복 삽입·무동의 수집도 다시 생기므로 단순 복구 수단으로 쓰지 않는다.

참고: [Google 동의 모드](https://developers.google.com/tag-platform/security/concepts/consent-mode), [동의 구현](https://developers.google.com/tag-platform/security/guides/consent), [페이지 조회](https://developers.google.com/analytics/devguides/collection/ga4/views), [GA4 구성 매개변수](https://developers.google.com/analytics/devguides/collection/ga4/reference/config), [향상된 측정](https://support.google.com/analytics/answer/9216061?hl=ko), [데이터 수정](https://support.google.com/analytics/answer/13544947?hl=ko).
