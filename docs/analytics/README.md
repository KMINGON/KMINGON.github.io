# 블로그 방문 통계 운영

확인일: 2026-09-23. 대상: `KMINGON.github.io` main, `https://blog.mingon.dev/`.

## 현재 진행 상태

**GTM 버전 2 게시와 실제 Google tag / GA4 수집 요청 검증을 완료했다. 사용자 배포 지시에 따라 사이트 이관을 진행하며, 배포 완료 후 운영 검증 결과를 갱신한다.**

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
| 운영 사이트 | 기존 직접 GA 및 Cloudflare 삽입 상태 유지, 새 코드 미배포 |

게시 권한은 버전 2의 실제 게시 성공으로 확인했다. GTM을 게시해도 운영 사이트가 아직 새 컨테이너를 로드하지 않으므로 사이트 이관은 완료되지 않았다. 사용자가 커밋·푸시·운영 배포를 지시했으며, 배포 후 결과를 아래에 기록한다. toy 컨테이너와 속성은 수정하지 않았다.

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

## 로컬 구현

`hugo.toml`에는 실제 블로그 컨테이너 ID와 기존 GA4 측정 ID만 둔다. 직접 `gtagId`는 제거한다. `layouts/partials/analytics/gtm.html`은 production 빌드에만 로컬 동의 스크립트를 삽입한다. 실제 GTM 요청은 HTTPS `blog.mingon.dev`에서 동의한 경우에만 발생한다. 404에는 추적 스크립트를 넣지 않는다.

`layouts/partials/footer.html`을 로컬에서 오버라이드하여 직접 GA 코드를 제거했다. 동의 UI와 공통 확대 스크립트는 base footer에서 한 번만 넣는다. HOME의 Analysis·Review 9편과 기존 카테고리/글 내용은 그대로 둔다.

분석 경로를 GTM의 기존 GA4로 통일하면서 Cloudflare beacon 설정·삽입은 제거했다. Cloudflare 분석의 새 데이터는 사이트 배포 시점부터 들어오지 않는다. 과거 데이터나 Cloudflare 계정 자체를 삭제한 것은 아니다.

### 동의와 철회

- 최초 방문·거부·기간 만료: GTM/GA를 요청하지 않는다. 동의 상태를 보내는 cookieless ping도 발생시키지 않는다.
- 허용: 컨테이너를 로드하기 **전에** `analytics_storage=granted`, 광고 관련 세 항목은 `denied`로 설정한다. 이미 확인된 동의 상태로 시작하므로 실행 중인 GTM에 `gtag('consent', 'update', ...)`를 보내는 순서 문제를 피한다.
- 컨테이너 로드 요청 후 `dataLayer`에 `blog_analytics_ready` 이벤트를 한 번 넣는다. 이 이벤트는 GTM 트리거용이며 GA4의 커스텀 이벤트 태그는 만들지 않는다.
- 선택은 `blog.analytics-consent.v1` 로컬 저장소에 최대 180일 보관한다. 저장소 차단 시 해당 문서에서만 선택이 유효하다.
- ‘분석 설정’에서 철회하면 GA4 전송 차단 플래그를 설정하고 쿠키를 정리한 뒤 페이지를 새로 불러온다. 다른 탭에서 동의를 철회하거나 저장소를 비운 경우에도 `storage` 이벤트로 중지한다.
- 새 분석 쿠키는 `blog.mingon.dev` 범위, 만료 180일을 GTM Google tag에서 지정한다. 철회 시 블로그 쿠키와 과거 상위 도메인의 블로그 스트림 쿠키를 지운다. 다른 서비스의 `_ga_*` 및 상위 도메인의 공용 `_ga` 쿠키는 삭제하지 않는다.
- `<noscript>` GTM iframe은 넣지 않는다. JavaScript 없이 동의를 확인할 수 없는 상황에서 요청이 발생하는 경로를 만들지 않기 위해서다.

### 수집 항목 제한

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

## 게시한 설정과 남은 배포 순서

2026-09-23에 toy 세션의 명시적인 브라우저 재인계를 받은 뒤 블로그 컨테이너에 후보 JSON을 병합했다. 가져오기 미리보기는 추가 5개, 수정·삭제 0개였으며, Google tag의 모든 구성 매개변수와 추가 동의, 페이지당 한 번 실행, 블로그 전용 hostname·이벤트 조건을 UI에서 확인했다.

[블로그 GTM 버전 2](https://tagmanager.google.com/#/versions/accounts/6378414723/containers/264952584/versions/2)가 Live / 최신으로 표시됐고 공개 `gtm.js` 응답도 HTTP 200이었다. 게시한 실제 내보내기 JSON을 `gtm-blog.json`에 보관했다. Windows Downloads의 `gtm-blog-migration.json`은 가져오기에 쓴 후보이며, 이후 복구·비교에는 저장소의 실제 내보내기를 기준으로 한다.

남은 작업:

1. 승인된 변경 파일을 커밋·푸시한다. main push는 GitHub Pages 운영 배포를 시작한다.
2. Actions의 Hugo 빌드와 분석 검증이 통과하는지 확인한다.
3. 운영 HOME·글·개인정보 페이지에서 새 동의 UI, 기존 GA 중복 제거, 실제 GTM 요청과 단일 page_view를 확인한다.
4. GA4 실시간/DebugView·일반 보고서의 처리 결과를 확인하고 운영 배포 커밋·시각을 기록한다. HTTP 204는 수집 요청 성공을 뜻하며 보고서 집계 완료의 증거로 대신하지 않는다.

다음 GTM 변경도 블로그 전용 컨테이너에서 수행하며, 게시 후 실제 내보내기·검증 결과를 이 문서와 함께 갱신한다.

## 검증 결과

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
- **남은 검증:** 실제 운영 사이트 배포 후 재검증과 GA4 보고서 처리 결과 확인. 최초 실시간 확인에서는 데이터가 표시되지 않아 보고서 수신 완료로 기록하지 않았다.

```bash
PATH="$HOME/.local/dart-sass:$PATH" hugo --minify
node scripts/check-analytics.mjs public
```

CI에서도 빌드 다음에 동일한 검증을 실행한다. 컨테이너를 수정할 때는 게시 전후 JSON을 비교하고 개인정보 안내와 이 문서를 함께 갱신한다. ID를 바꾸는 것만으로 태그 설정이 이관되지는 않는다.

## 유지보수와 복구

- 새로운 태그나 이벤트를 추가할 때 수집 목적·동의·전송 값부터 확인한다. 입력 원문, 검색어, 쿼리 문자열, 사용자 ID는 기본 수집 항목으로 추가하지 않는다.
- 테마를 갱신하면 로컬 `head.html` / `footer.html`과 upstream 차이를 확인한다. 직접 GA 삽입이 되살아나지 않도록 CI 검증을 유지한다.
- 분석 전송만 급히 중단해야 하면 GTM의 `Google tag - blog`를 일시중지한 버전을 게시한다. toy 컨테이너에는 손대지 않는다.
- 사이트 측 긴급 중단은 `gtmContainerId`를 비우고 재배포할 수 있다. 이 경우 위의 ‘항상 하나의 로더’ 검사 기대값도 함께 조정해야 한다. 안전한 기본 복구는 동의 처리를 유지하면서 태그만 중지하는 것이다.
- 이관 전 직접 GA를 복원하면 중복 삽입·무동의 수집도 다시 생기므로 단순 복구 수단으로 쓰지 않는다.

참고: [Google 동의 모드](https://developers.google.com/tag-platform/security/concepts/consent-mode), [동의 구현](https://developers.google.com/tag-platform/security/guides/consent), [페이지 조회](https://developers.google.com/analytics/devguides/collection/ga4/views), [GA4 구성 매개변수](https://developers.google.com/analytics/devguides/collection/ga4/reference/config), [향상된 측정](https://support.google.com/analytics/answer/9216061?hl=ko), [데이터 수정](https://support.google.com/analytics/answer/13544947?hl=ko).
