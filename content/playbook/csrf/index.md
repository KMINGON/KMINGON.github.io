+++
date = '2026-06-27T10:00:00+09:00'
draft = false
title = '[Playbook] CSRF 진단 Cheat Sheet'
summary = "CSRF 진단 중 어떤 방어가 어느 조건에 걸려 있는지 빠르게 판별하고 다음 우회 시도를 선택하기 위한 Playbook"
toc = true
tags = ["CSRF", "SameSite", "Playbook", "Cheat Sheet", "Testing Workflow"]
aliases = ['/playbook/playbook-csrf-올인원-진단-cheat-sheet/']
url = '/playbook/playbook-csrf-진단-cheat-sheet/'
+++

---

이 문서는 CSRF 진단 중 **요청에 어떤 방어가 걸려 있고 그 방어가 어느 조건에서만 작동하는지 판별해 다음 시도를 고르기 위한 빠른 참고서**다. 방어별 상세 원리와 전체 풀이는 관련 Write-up과 Note로 연결한다.

> 승인된 테스트 환경과 실습에서만 사용한다. CSRF는 성공하는 순간 실제 계정 상태가 바뀌므로, 처음부터 비밀번호·권한·결제 기능을 대상으로 삼지 않고 이메일 변경처럼 되돌릴 수 있는 기능과 본인 계정으로만 검증한다.

## 30초 진단 흐름

1. 상태를 변경하는 요청을 하나 잡아 전체 헤더와 본문을 기록한다.
2. 쿠키 외에 인증에 쓰이는 값이 있는지 확인한다.
3. 세션 쿠키의 `SameSite` 값을 확인한다(미명시면 기본 `Lax`).
4. 방어 값을 하나씩 **변조 → 삭제 → 메서드 변경** 순으로 시도해 검증 조건을 좁힌다.
5. 조건이 확인되면 그에 맞는 전달 페이로드를 고른다.

| 관찰 결과 | 판단 | 다음 단계 |
| --- | --- | --- |
| 쿠키 외 인증 값이 없고 `SameSite=None` | 기본 CSRF 성립 | 폼 자동 제출로 바로 PoC |
| 토큰이 있으나 삭제하면 통과 | 존재 여부 의존 검증 | 파라미터 생략 페이로드 |
| 토큰이 있으나 `GET`이면 통과 | 메서드 의존 검증 | `img` 태그 한 줄로 PoC |
| 다른 계정 토큰이 통과 | 세션 미결합 | 공격자 토큰 하드코딩 |
| 토큰이 쿠키에도 함께 존재 | Double Submit 또는 비세션 쿠키 결합 | 쿠키 주입 가젯 탐색 |
| `SameSite` 미명시 | 기본 `Lax` + 2분 완화 | 세션 재발급 가젯 탐색 |
| `SameSite=Strict` | 교차 사이트 전송 불가 | 사이트 내부 가젯·서브도메인 탐색 |
| `Referer` 변조 시 거부 | Referer 검증 존재 | 헤더 삭제와 문자열 비교 방식 확인 |

## 1. 대상 행위와 요청 파악

먼저 공격 가치가 있는 요청을 하나 골라 원본을 그대로 확보한다.

| 기록 항목 | 확인 이유 |
| --- | --- |
| 메서드와 엔드포인트 | `GET` 허용 여부가 페이로드 난이도를 결정 |
| `Content-Type` | 폼으로 재현 가능한 값인지(`x-www-form-urlencoded`·`multipart`·`text/plain`) |
| 본문 파라미터 전체 | `submit` 같은 부가 파라미터가 필수인지 |
| 요청에 실린 쿠키 전부 | 세션 외에 `csrfKey` 등 별도 쿠키가 있는지 |
| `Origin`·`Referer`·`Sec-Fetch-Site` | 서버가 출처 판단에 쓸 수 있는 값 |
| 응답의 `Set-Cookie` 속성 | `SameSite`·`Secure`·`Domain` 범위 |

- `Content-Type`이 JSON이면 폼으로 재현할 수 없다. 서버가 form-urlencoded도 받아들이는지 먼저 확인한다.
- 응답을 읽을 필요는 없다. CORS 오류는 응답 읽기 차단일 뿐 요청은 이미 전달된 상태다.

## 2. 토큰 검증 결함 판별

토큰이 있으면 아래 다섯 가지를 순서대로 시도한다. 각각 독립적이므로 하나가 막혀도 나머지를 모두 확인한다.

| 시도 | 통과하면 | 페이로드 방향 | 관련 실습 |
| --- | --- | --- | --- |
| 토큰 값만 변조 | (거부되는 것이 정상) | 검증 자체는 동작 | — |
| `csrf` 파라미터 이름째 삭제 | 존재 여부 의존 검증 | 토큰 없는 폼 제출 | [token being present](/write-up/portswigger/csrf/write-up-portswigger---csrf-where-token-validation-depends-on-token-being-present/) |
| 메서드를 `GET`으로 변경 | 메서드 의존 검증 | `img src` 또는 `location.href` | [request method](/write-up/portswigger/csrf/write-up-portswigger---csrf-where-token-validation-depends-on-request-method/) |
| 다른 계정의 토큰으로 교체 | 세션 미결합 | 공격자 토큰 하드코딩 | [not tied to user session](/write-up/portswigger/csrf/write-up-portswigger---csrf-where-token-is-not-tied-to-user-session/) |
| 다른 계정의 쿠키+토큰 쌍으로 교체 | 비세션 쿠키 결합 | 쿠키 주입 후 쌍 이식 | [non-session cookie](/write-up/portswigger/csrf/write-up-portswigger---csrf-where-token-is-tied-to-non-session-cookie/) |
| 쿠키·파라미터를 같은 임의 값으로 교체 | Double Submit | 쿠키 주입 후 동일 값 제출 | [duplicated in cookie](/write-up/portswigger/csrf/write-up-portswigger---csrf-where-token-is-duplicated-in-cookie/) |

- 다른 계정 토큰 확보는 시크릿 탭이나 별도 브라우저 프로필로 동시 로그인해서 진행한다.
- 마지막 두 항목이 통과하면 **쿠키를 심을 수단**이 추가로 필요하다. 5번 항목으로 이동한다.
- `OPTIONS`로 `Allow` 헤더를 확인하면 메서드 전환 가능성을 먼저 좁힐 수 있다.

## 3. SameSite 판정과 우회 경로

응답의 `Set-Cookie`에서 세션 쿠키의 `SameSite`를 확인하고 분기한다.

| 설정 | 교차 사이트에서 쿠키가 실리는 요청 | 다음 선택 |
| --- | --- | --- |
| `None` | 전부 | 제한 없음. 폼 자동 제출로 진행 |
| 미명시(기본 `Lax`) | 최상위 `GET` 탐색 + 생성 후 2분 내 최상위 `POST` | 메서드 오버라이드 또는 세션 재발급 |
| `Lax` 명시 | 최상위 `GET` 탐색만 | 2분 완화 미적용. `GET` 전환 경로만 확인 |
| `Strict` | 없음 | 사이트 내부 가젯 또는 서브도메인 확보 |

기본 `Lax`인 경우:

| 시도 | 확인할 것 | 관련 실습 |
| --- | --- | --- |
| `_method=POST`·`X-HTTP-Method-Override` | 프레임워크가 오버라이드를 지원하는가 | [method override](/write-up/portswigger/csrf/write-up-portswigger---samesite-lax-bypass-via-method-override/) |
| 세션 재발급 지점 탐색 | OAuth·SSO 랜딩 재진입 시 새 세션이 발급되는가 | [cookie refresh](/write-up/portswigger/csrf/write-up-portswigger---samesite-lax-bypass-via-cookie-refresh/) |

`Strict`인 경우:

| 시도 | 확인할 것 | 관련 실습 |
| --- | --- | --- |
| 클라이언트 측 리다이렉트 가젯 | 목적지가 사용자 입력으로 구성되는가(`../` 탈출 가능한가) | [client-side redirect](/write-up/portswigger/csrf/write-up-portswigger---samesite-strict-bypass-via-client-side-redirect/) |
| 서브도메인 열거 | CORS 헤더·CSP·인증서·리소스 URL에 다른 서브도메인이 노출되는가 | [sibling domain](/write-up/portswigger/csrf/write-up-portswigger---samesite-strict-bypass-via-sibling-domain/) |

- 서버 측 `302` 리다이렉트는 원래 컨텍스트를 이어받아 교차 사이트로 판단되므로 우회에 쓸 수 없다. **클라이언트 측(JavaScript) 탐색**이어야 same-site가 된다.
- SameSite의 "사이트"는 eTLD+1이다. 서브도메인은 출처가 달라도 same-site이므로, 서브도메인 하나의 XSS로 조건이 충족된다.

## 4. Referer·Origin 검증 우회

`Referer` 값을 임의 도메인으로 바꿔 거부되면 검증이 존재한다. 이후 두 방향으로 나눠 확인한다.

| 시도 | 통과하면 | 페이로드 방향 | 관련 실습 |
| --- | --- | --- | --- |
| 헤더 통째로 삭제 | 부재 시 폴백 통과 | `referrerPolicy: "no-referrer"` 또는 `<meta name="referrer" content="no-referrer">` | [header being present](/write-up/portswigger/csrf/write-up-portswigger---csrf-where-referer-validation-depends-on-header-being-present/) |
| 스킴·경로 제거 후 도메인 문자열만 전송 | 부분 문자열 비교 | 경로에 대상 도메인을 넣고 `unsafe-url` | [broken validation](/write-up/portswigger/csrf/write-up-portswigger---csrf-with-broken-referer-validation/) |
| `https://attacker.com/target.com` | 경로 위치 매칭 | Exploit Server 파일 경로를 `/target.com`으로 지정 | 위와 동일 |
| `https://target.com.attacker.com/` | 접두 매칭 | 서브도메인 형태로 구성 | 위와 동일 |

- `Referer`는 forbidden header라 `headers`에 직접 지정해도 무시된다. **값을 정할 수는 없지만 정책으로 제거하거나 전체 URL로 확장할 수는 있다.**
- 경로를 이용하는 우회는 브라우저 기본 정책(`strict-origin-when-cross-origin`)이 경로를 잘라내므로 `referrerPolicy: 'unsafe-url'`이 반드시 필요하다.
- `Origin` 검증은 값을 조작할 수 없으므로 `null` Origin 처리(샌드박스 iframe)나 접미사 매칭 결함 여부만 확인한다.

## 5. 쿠키 주입 가젯 찾기

토큰이 쿠키에 결합되어 있거나 Double Submit이면 쿠키를 심을 수단이 필요하다.

| 후보 지점 | 확인 방법 | 성공 신호 |
| --- | --- | --- |
| 검색어·언어·정렬 등 상태 저장 파라미터 | 응답에 `Set-Cookie`로 반영되는가 | 입력값이 쿠키 값에 그대로 등장 |
| 위 지점의 CRLF 주입 | `%0D%0ASet-Cookie%3A+name%3Dvalue` 삽입 | `Set-Cookie` 헤더가 하나 더 생성 |
| 서브도메인 XSS | `document.cookie`로 상위 도메인 쿠키 설정 가능한가 | 대상 도메인 요청에 쿠키가 실림 |
| 하위 경로의 파일 업로드·리다이렉트 | 응답 헤더를 통제할 수 있는가 | 임의 헤더 반영 |

- 주입하는 쿠키에는 `SameSite=None`을 함께 지정한다. 그래야 이후 교차 사이트 요청에도 실린다.
- 쿠키 설정과 폼 제출은 순서가 중요하다. `img`의 `onerror`를 완료 신호로 쓰면 타이밍을 맞출 수 있다.
- 헤더 주입은 단독 심각도가 낮아 보이지만 CSRF 방어를 통째로 무력화하는 발판이 된다. 개별 심각도가 아니라 조합으로 평가한다.

## 6. 전달 페이로드 선택

확인한 조건에 맞춰 최소한의 형태를 고른다.

| 조건 | 페이로드 | 비고 |
| --- | --- | --- |
| `POST` + 쿠키 첨부 가능 | 히든 필드 폼 + `submit()` | 가장 기본. `Content-Type`이 자동으로 맞음 |
| `GET`으로 상태 변경 가능 | `<img src="...">` | 스크립트 없이 동작 |
| 최상위 탐색이 필요(`Lax`) | `location.href = "..."` | `img`·`iframe`은 최상위 탐색이 아님 |
| 쿠키 주입 후 제출 | `<img ... onerror="form.submit()">` | 주입 완료 시점 동기화 |
| 새 창에서 가젯 실행 후 제출 | `window.onclick` 안에서 `window.open` + `setTimeout` | 사용자 제스처 없이는 팝업이 차단됨 |
| 헤더 제어가 필요 | `fetch` + `credentials: "include"` + `referrerPolicy` | 응답은 못 읽지만 요청은 전달됨 |

- 랩에서 이메일 변경이 반영되지 않으면 **이미 사용한 주소인지** 먼저 의심한다. 요청은 성공했는데 중복 거부로 결과만 안 바뀌는 경우가 잦다.
- 페이로드 안의 `</script>`는 바깥 스크립트를 조기 종료시키므로 `<\/script>`로 이스케이프한다.

## 7. 특수·예외 상황

아래 항목은 일반 흐름에 맞지 않을 때만 확인한다.

| 상황 | 짧은 판단 기준 | 관련 글 |
| --- | --- | --- |
| 토큰 검증이 완벽한데 XSS가 있음 | 같은 출처에서 토큰을 읽어 유효 요청 생성 가능 | [XSS로 CSRF 우회](/write-up/portswigger/xss/write-up-portswigger---exploiting-xss-to-bypass-csrf-defenses/) |
| WebSocket 핸드셰이크에 쿠키만 존재 | CSRF가 CSWSH로 확장되어 응답까지 열람 가능 | [WebSocket Playbook](/playbook/playbook-websocket-%EC%A7%84%EB%8B%A8-cheat-sheet/) |
| 반사 지점은 있는데 실행이 막힘 | 토큰 탈취용 dangling markup으로 전환 | [XSS Playbook](/playbook/playbook-xss-%EC%A7%84%EB%8B%A8-cheat-sheet/) |
| `SameSite` 명시인데 2분 완화가 통함 | 명시 `Lax`에는 적용되지 않음. 실제 응답 헤더 재확인 | [cookie refresh](/write-up/portswigger/csrf/write-up-portswigger---samesite-lax-bypass-via-cookie-refresh/) |
| `Content-Type`이 JSON 고정 | form-urlencoded 수용 여부 → 아니면 폼 CSRF 불가 | 커스텀 헤더 요구 여부 확인 |
| 요청에 커스텀 헤더가 필수 | 폼으로 재현 불가. preflight가 발생해 교차 사이트 차단 | 사실상 방어로 기능 |
| 토큰이 URL 쿼리에만 존재 | `Referer`·로그에 유출되어 별도 문제 | 유출 경로를 함께 보고 |

## Quick Checklist

- [ ] 상태를 변경하는 요청의 헤더·본문 원본을 확보했는가?
- [ ] 쿠키 외 인증 값의 유무와 예측 가능성을 확인했는가?
- [ ] 토큰에 대해 변조·삭제·메서드 변경·타계정 재사용을 모두 시도했는가?
- [ ] 세션 쿠키의 `SameSite`가 명시값인지 기본값인지 구분했는가?
- [ ] `Strict`라면 사이트 내부 가젯과 서브도메인을 탐색했는가?
- [ ] `Referer` 검증을 삭제와 문자열 조작 양쪽으로 확인했는가?
- [ ] 쿠키가 필요한 우회라면 주입 가젯을 먼저 확보했는가?
- [ ] 페이로드가 요구하는 컨텍스트(최상위 탐색·사용자 제스처)를 만족하는가?
- [ ] 결과가 안 바뀔 때 요청 실패인지 중복 값 거부인지 구분했는가?
