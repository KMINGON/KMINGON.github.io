+++
date = '2026-06-26T14:00:00+09:00'
draft = false
title = '[Note] PortSwigger - Cross-Site Request Forgery(CSRF) 토픽 정리 및 실습'
summary = "CSRF의 성립 조건과 공격 구성 방식, XSS와의 차이, CSRF 토큰·SameSite·Referer 세 가지 방어와 각각의 우회 경로, 그리고 진단 방법과 대응 방안을 정리한 자료"
toc = true
tags = ["CSRF", "SameSite", "PortSwigger"]
+++

---

## 들어가며

Cross-Site Request Forgery(CSRF)는 사용자가 의도하지 않은 행위를 대신 수행하게 만드는 취약점이다.  
공격자가 코드를 실행시키는 것이 아니라 **브라우저가 원래 하던 일**, 즉 요청에 쿠키를 자동으로 붙이는 동작을 그대로 이용한다는 점이 특징이다.

이 글에서는 CSRF의 성립 조건과 공격이 구성되는 방식, XSS와의 차이, CSRF 토큰·SameSite·Referer 세 가지 방어와 각각이 무너지는 지점, 그리고 진단과 대응 방법을 정리한다.  
유형별 Lab 풀이는 별도의 Write-up으로 정리했으며, 본문 마지막에서 연결한다.

![image.png](/note/5/image.png)
*https://portswigger.net/web-security*

---

## CSRF란?

CSRF는 인증된 사용자가 자신의 의도와 무관한 요청을 애플리케이션에 보내도록 유도하는 취약점이다.  
공격자가 만든 페이지를 피해자가 여는 것만으로, 피해자의 권한으로 이메일 주소 변경이나 비밀번호 변경, 자금 이체 같은 행위가 수행된다.

피해 규모는 침해된 계정의 권한에 좌우된다. 일반 사용자라면 그 계정과 데이터가 영향을 받고, 관리자 계정이라면 애플리케이션 전체에 대한 통제권까지 넘어갈 수 있다. 특히 이메일 주소나 비밀번호처럼 **계정 소유권 자체를 옮길 수 있는 기능**이 공격 대상이 되면 CSRF 한 번으로 계정 탈취까지 이어진다.

---

## CSRF는 어떻게 동작하는가

CSRF가 성립하려면 세 가지 조건이 모두 충족되어야 한다.

| 조건 | 내용 | 확인 방법 |
| --- | --- | --- |
| 유의미한 행위 | 권한 변경이나 데이터 수정처럼 공격자가 유도할 가치가 있는 기능이 존재한다 | 상태를 변경하는 엔드포인트 목록화 |
| 쿠키 기반 세션 처리 | 요청을 식별하는 수단이 쿠키뿐이고, 다른 검증 장치가 없다 | 요청에서 쿠키 외 인증 값 유무 확인 |
| 예측 불가능한 파라미터 부재 | 요청에 공격자가 알 수 없는 값이 포함되지 않는다 | CSRF 토큰·논스 유무 확인 |

세 번째 조건이 방어의 핵심이다. 요청에 공격자가 알 수 없는 값이 하나라도 필요하면, 요청을 만들 수는 있어도 유효한 요청은 만들 수 없다.

이메일 변경 기능을 예로 보자.

```html
POST /email/change HTTP/1.1
Host: vulnerable-website.com
Content-Type: application/x-www-form-urlencoded
Cookie: session=yvthwsztyeQkAPzeQ5gHgTvlyxHfsAfE

email=wiener@normal-user.com
```

파라미터는 `email` 하나뿐이고 세션은 쿠키로만 식별된다. 공격자는 같은 형태의 요청을 자신의 페이지에서 만들어 두기만 하면 된다.

```html
<form action="https://vulnerable-website.com/email/change" method="POST">
    <input type="hidden" name="email" value="pwned@evil-user.net" />
</form>
<script>
    document.forms[0].submit();
</script>
```

피해자가 이 페이지를 열면 폼이 자동으로 제출되고, 브라우저는 대상 사이트의 쿠키를 붙인다. 서버 입장에서 이 요청은 정상 요청과 구분되지 않는다.

여기서 짚어둘 점은 **인증된 요청과 사용자가 의도한 요청이 같지 않다**는 것이다. 쿠키는 요청을 누가 만들었는지와 무관하게 첨부되므로, 쿠키만으로는 요청의 출처를 판단할 수 없다.

---

## CSRF 공격의 구성과 전달

공격 페이로드는 대상 요청의 형태에 따라 달라진다.

| 대상 요청 | 페이로드 형태 | 조건 |
| --- | --- | --- |
| `POST` (form-urlencoded) | 히든 필드를 담은 폼 + 자동 제출 스크립트 | 교차 사이트 `POST`에 쿠키가 실려야 함 |
| `GET` | `<img src="...">` 또는 `location.href` | 상태 변경이 `GET`으로 처리되어야 함 |
| 응답을 읽을 필요가 있는 경우 | `fetch` + `credentials: "include"` | CORS로 응답 읽기는 차단되지만 요청은 전달됨 |

`fetch`로 공격을 구성하면 콘솔에 CORS 오류가 표시되는데, 이를 요청이 차단된 것으로 오해하기 쉽다. CORS는 교차 출처 **응답을 읽을 수 있는지**를 통제하는 규칙이고, 폼과 동일한 `Content-Type`을 쓰는 단순 요청(simple request)은 preflight 없이 전송되어 서버에서 정상 처리된다. CSRF는 애초에 응답을 읽을 필요가 없는 단방향 공격이므로 CORS는 방어가 되지 못한다.

복잡한 요청은 Burp Suite Professional의 CSRF PoC 생성기로 HTML을 만들 수 있다. 전달은 대개 공격자가 통제하는 페이지에 올려 두고 피해자가 방문하도록 유도하는 방식이며, `GET` 기반 공격이라면 URL 하나로 완결되므로 대상 도메인 안에 심어 두는 것도 가능하다.

---

## XSS와 CSRF의 차이

두 취약점은 모두 피해자의 브라우저를 경유하지만 성격이 다르다.

| 구분 | XSS | CSRF |
| --- | --- | --- |
| 공격자가 얻는 것 | 대상 출처에서의 임의 코드 실행 | 특정 요청 한 건의 전송 |
| 방향성 | 양방향(요청 전송 + 응답 열람) | 단방향(요청 전송만) |
| 적용 범위 | 사용자가 할 수 있는 모든 행위 | 방어가 누락된 개별 기능 |

CSRF 토큰이 XSS 방어를 겸할 수 있는지에 대한 답은 "부분적으로만"이다. 토큰이 필요한 기능에 한해 일부 반사형 XSS의 익스플로잇을 막을 수는 있지만 다음 세 가지 한계가 있다.

- 토큰으로 보호되지 않는 기능의 XSS는 그대로 익스플로잇 가능하다
- 사이트 어딘가에 XSS가 있으면 그 코드로 토큰을 읽어낼 수 있으므로 보호가 무의미해진다
- 저장형 XSS는 피해자가 페이지를 여는 것만으로 실행되므로 토큰과 무관하다

두 번째 항목은 [Exploiting XSS to bypass CSRF defenses](/write-up/portswigger/xss/write-up-portswigger---exploiting-xss-to-bypass-csrf-defenses/) 랩에서 직접 확인할 수 있다. XSS 코드는 대상 애플리케이션과 같은 출처에서 실행되므로 계정 페이지를 읽어 토큰을 추출한 뒤 유효한 요청을 만들 수 있다. 즉 CSRF 방어는 XSS의 대체 방어가 될 수 없고, 두 취약점은 각각 제거해야 한다.

---

## CSRF 방어와 우회

실무에서 사용되는 방어는 크게 세 가지다.

| 방어 | 원리 | 주된 실패 지점 |
| --- | --- | --- |
| CSRF 토큰 | 요청에 공격자가 알 수 없는 값을 요구 | 검증이 조건부로만 적용되거나 세션과 결합되지 않음 |
| SameSite 쿠키 | 교차 사이트 요청에 쿠키 첨부를 제한 | 예외 조건과 사이트 내부 가젯 |
| Referer 검증 | 요청 출처를 헤더로 판단 | 헤더 부재 시 폴백, 느슨한 문자열 비교 |

### CSRF 토큰

가장 확실한 방어다. 서버가 예측 불가능한 값을 발급해 사용자 세션에 저장하고, 상태를 변경하는 요청마다 그 값이 함께 제출되었는지 확인한다. 공격자는 피해자의 토큰 값을 알 수 없으므로 유효한 요청을 만들지 못한다.

문제는 이 전제가 구현 과정에서 쉽게 깨진다는 점이다. 대표적인 결함은 다섯 가지다.

| 결함 | 내용 | 관련 실습 |
| --- | --- | --- |
| 메서드 의존 검증 | `POST`에만 검증이 걸려 있어 `GET`으로 전환하면 우회 | [request method](/write-up/portswigger/csrf/write-up-portswigger---csrf-where-token-validation-depends-on-request-method/) |
| 존재 여부 의존 검증 | 토큰이 제출된 경우에만 비교하므로 파라미터를 생략하면 우회 | [token being present](/write-up/portswigger/csrf/write-up-portswigger---csrf-where-token-validation-depends-on-token-being-present/) |
| 세션 미결합 | 토큰을 전역 풀로 관리해 공격자 계정의 토큰을 재사용 가능 | [not tied to user session](/write-up/portswigger/csrf/write-up-portswigger---csrf-where-token-is-not-tied-to-user-session/) |
| 비세션 쿠키 결합 | 토큰이 인증과 무관한 별도 쿠키에 묶여, 쿠키 주입으로 쌍을 이식 | [non-session cookie](/write-up/portswigger/csrf/write-up-portswigger---csrf-where-token-is-tied-to-non-session-cookie/) |
| 쿠키 중복 제출 | 서버가 값을 보관하지 않고 쿠키와 파라미터의 일치만 확인 | [duplicated in cookie](/write-up/portswigger/csrf/write-up-portswigger---csrf-where-token-is-duplicated-in-cookie/) |

앞의 두 가지는 검증이 행위가 아니라 **조건**에 걸려 있는 경우이고, 뒤의 세 가지는 토큰이 **세션과 올바르게 결합되지 않은** 경우다. 특히 뒤의 두 결함은 쿠키를 설정할 수 있는 수단(헤더 주입, 서브도메인 XSS 등)이 있어야 성립하므로, 단독으로는 심각도가 낮아 보이는 취약점이 CSRF 방어를 무력화하는 발판이 된다.

### SameSite 쿠키

브라우저가 쿠키를 교차 사이트 요청에 첨부할지 결정하는 메커니즘이다. Chrome은 `SameSite`가 명시되지 않은 쿠키에 `Lax`를 기본 적용한다.

먼저 "사이트"의 범위를 짚어야 한다. SameSite에서 말하는 사이트는 **eTLD+1**, 즉 `.com`이나 `.co.kr` 같은 유효 최상위 도메인에 한 단계를 더한 범위다. 동일 출처 정책이 스킴·도메인·포트를 모두 따지는 것과 달리, `app.example.com`과 `cms.example.com`은 출처는 다르지만 같은 사이트다. 즉 **교차 출처지만 same-site인 요청이 존재한다.**

| 값 | 동작 |
| --- | --- |
| `Strict` | 교차 사이트 요청에 쿠키를 전혀 첨부하지 않음 |
| `Lax` | 최상위 탐색(top-level navigation)으로 발생하는 `GET` 요청에만 첨부 |
| `None` | 제한 없음. `Secure` 속성 필수 |

여기에 기본값 `Lax`에만 적용되는 예외가 하나 더 있다. 생성 후 2분 이내의 쿠키는 교차 사이트 최상위 `POST` 요청에도 전송되는데, SSO나 결제처럼 교차 사이트 `POST`로 세션을 넘기는 플로우가 깨지지 않도록 둔 한시적 완화책이다. 이를 Lax-allowing-unsafe(통칭 Lax+POST)라 하며, **명시적으로 `SameSite=Lax`를 선언한 쿠키에는 적용되지 않는다.** 기본값에 기대는 것과 명시하는 것의 차이가 여기서 갈린다.

우회 경로는 네 갈래로 정리된다.

| 상황 | 우회 방법 | 관련 실습 |
| --- | --- | --- |
| 기본 `Lax`, 대상이 `POST` | 메서드 오버라이드(`_method`)로 `GET` 탐색을 `POST`로 처리시킴 | [method override](/write-up/portswigger/csrf/write-up-portswigger---samesite-lax-bypass-via-method-override/) |
| `Strict` | 사이트 내부의 클라이언트 측 리다이렉트 가젯으로 same-site 요청 생성 | [client-side redirect](/write-up/portswigger/csrf/write-up-portswigger---samesite-strict-bypass-via-client-side-redirect/) |
| `Strict` | 같은 사이트에 속한 서브도메인의 XSS를 발판으로 same-site 컨텍스트 확보 | [sibling domain](/write-up/portswigger/csrf/write-up-portswigger---samesite-strict-bypass-via-sibling-domain/) |
| 기본 `Lax`, 대상이 `POST` | 세션 재발급 가젯으로 2분 완화 구간을 되살림 | [cookie refresh](/write-up/portswigger/csrf/write-up-portswigger---samesite-lax-bypass-via-cookie-refresh/) |

네 경로를 관통하는 공통점은 SameSite가 **요청이 어디서 출발했는지만 볼 뿐, 그 요청이 사용자가 의도한 것인지는 판단하지 않는다**는 점이다. 사이트 내부에서 요청을 만들어낼 수단이 있으면 제한은 성립하지 않는다.

### Referer 기반 검증

`Referer` 헤더로 요청 출처를 확인하는 방식이다. 토큰보다 구현이 간단해 보조 수단으로 쓰이지만 단독 방어로는 신뢰하기 어렵다.

첫 번째 문제는 헤더가 항상 오지는 않는다는 점이다. 프라이버시 설정이나 참조자 정책 때문에 생략될 수 있으므로 구현자는 "없으면 통과"라는 폴백을 넣게 되고, 공격자는 `<meta name="referrer" content="no-referrer">`나 `fetch`의 `referrerPolicy`로 헤더를 지워 그 폴백을 이용한다.

두 번째 문제는 비교 방식이다. URL을 파싱하지 않고 문자열 포함 여부로 판단하면 다음 값들이 모두 통과한다.

```text
https://attacker.com/vulnerable-website.com
https://vulnerable-website.com.attacker.com/
```

최신 브라우저의 기본 참조자 정책(`strict-origin-when-cross-origin`)이 교차 출처 요청에서 경로를 잘라내므로 첫 번째 형태는 한 번 걸러진다. 하지만 참조자 정책은 요청을 보내는 쪽이 정하는 값이라, 공격자가 자기 페이지에 `Referrer-Policy: unsafe-url`을 적용하면 전체 URL이 그대로 전달된다. 공격자가 통제하는 값을 근거로 보안을 판단한다는 구조적 한계가 그대로 드러나는 지점이다.

두 결함은 각각 [header being present](/write-up/portswigger/csrf/write-up-portswigger---csrf-where-referer-validation-depends-on-header-being-present/), [broken Referer validation](/write-up/portswigger/csrf/write-up-portswigger---csrf-with-broken-referer-validation/) 랩에서 확인할 수 있다.

---

## CSRF 진단 방법

진단은 다음 순서로 진행한다.

1. **상태를 변경하는 요청을 수집한다.** 이메일·비밀번호 변경, 권한 부여, 결제, 삭제처럼 공격 가치가 있는 기능을 목록화한다.
2. **요청의 인증 수단을 확인한다.** 쿠키 외에 헤더나 본문에 인증 값이 있는지, 그 값이 예측 가능한지 본다.
3. **토큰이 있다면 검증 방식을 확인한다.** 값 변조, 파라미터 삭제, 메서드 변경, 다른 계정의 토큰 재사용을 각각 시도해 어떤 조건에서 검증이 작동하는지 좁힌다.
4. **세션 쿠키의 `SameSite` 설정을 확인한다.** 명시값이 없으면 기본 `Lax`이며, 2분 완화 구간과 세션 재발급 지점을 함께 확인한다.
5. **Referer·`Origin` 검증 여부를 확인한다.** 값 변조와 헤더 제거를 모두 시도해 폴백과 비교 방식을 파악한다.
6. **쿠키 주입 가젯을 찾는다.** 검색어나 파라미터가 `Set-Cookie`에 반영되는 지점, 서브도메인의 XSS는 토큰·SameSite 방어를 우회하는 발판이 된다.

각 단계에서 판단이 갈리는 지점과 다음 시도는 [CSRF Playbook](/playbook/playbook-csrf-%EC%98%AC%EC%9D%B8%EC%9B%90-%EC%A7%84%EB%8B%A8-cheat-sheet/)에 표로 정리했다.

---

## 대응 방안

- **세션에 결합된 CSRF 토큰 사용**: CSPRNG로 높은 엔트로피의 값을 생성하고, 사용자 세션에 저장한 뒤 요청 값과 대조한다. 토큰의 강도는 생성 방식이 아니라 무엇과 대조되는지로 결정된다.
- **토큰 전달 방식**: `POST` 요청의 히든 필드로 전달하고 문서 앞쪽에 배치한다. 쿼리 문자열은 로그와 `Referer`에 남으므로 사용하지 않으며, **토큰을 쿠키로 전달해서는 안 된다.**
- **예외 없는 검증**: 메서드와 무관하게, 행위를 실행하기 직전에 검증한다. 토큰이 누락된 경우와 값이 틀린 경우를 동일하게 거부하고 응답도 구분되지 않게 한다.
- **`SameSite=Strict` 명시**: 기본값에 의존하지 말고 명시적으로 선언한다. 불가피한 경우에만 `Lax`로 낮춘다.
- **same-site 공격면 관리**: 서브도메인은 SameSite 관점에서 같은 사이트다. 사용자 업로드 콘텐츠나 신뢰 수준이 다른 기능은 별도 사이트로 분리해 쿠키 경계를 나누고, 서브도메인의 XSS와 헤더 주입을 본 서비스와 같은 기준으로 제거한다.

핵심은 두 가지다. 첫째, **SameSite는 심층 방어이지 단독 방어가 아니다.** 예외 조건과 사이트 내부 가젯으로 우회되므로 토큰과 함께 써야 한다.  
둘째, **검증은 조건이 아니라 행위에 걸어야 한다.** 메서드나 파라미터 존재 여부에 따라 검증이 갈리는 순간, 공격자는 값을 맞출 필요 없이 검증 대상에서 벗어나기만 하면 된다.

---

## 실습

PortSwigger Web Security Academy의 CSRF 랩을 유형별로 풀어 정리했다.  
각 랩의 상세 풀이는 Write-up으로 별도 정리했으며, 아래는 유형별 개요다.

| 유형 | 대표 Lab | 난이도 |
| --- | --- | --- |
| 방어 부재 | CSRF vulnerability with no defenses | APPRENTICE |
| 토큰 검증 결함 | request method / token being present / not tied to session / non-session cookie / duplicated in cookie | PRACTITIONER |
| SameSite 우회 | method override / client-side redirect / sibling domain / cookie refresh | PRACTITIONER |
| Referer 검증 우회 | header being present / broken Referer validation | PRACTITIONER |

전체 풀이는 [CSRF Write-up 아카이브](/write-up/portswigger/csrf/)에서 확인할 수 있다.

---

## 마치며

이 글에서는 CSRF의 성립 조건과 공격 구성 방식, XSS와의 차이, 토큰·SameSite·Referer 세 가지 방어와 각각의 우회 경로, 진단과 대응 방법을 정리했다.

CSRF는 새로운 실행 경로를 여는 취약점이 아니다. 브라우저가 쿠키를 자동으로 첨부한다는 정상 동작과, 서버가 그 쿠키만으로 요청의 정당성을 판단한다는 설계 사이의 간극에서 생긴다. 그래서 방어의 방향도 하나로 모인다. 요청에 **공격자가 알 수 없는 값**을 요구하거나, 애초에 교차 사이트 요청에 **쿠키가 실리지 않게** 하는 것이다.

랩들을 관통하는 교훈은 방어의 유무보다 방어가 걸리는 위치가 중요하다는 점이다. 토큰이 있어도 특정 메서드에만 검증되면, 토큰이 세션이 아닌 다른 쿠키에 묶여 있으면, SameSite가 명시되지 않아 예외 구간이 열려 있으면 방어는 성립하지 않는다.  
이 글이 CSRF를 학습하거나 진단을 준비하는 과정에서 하나의 참고 자료로 활용되기를 바란다.

---

> 참고자료  
> https://portswigger.net/web-security/csrf  
> https://portswigger.net/web-security/csrf/xss-vs-csrf  
> https://portswigger.net/web-security/csrf/bypassing-token-validation  
> https://portswigger.net/web-security/csrf/bypassing-samesite-restrictions  
> https://portswigger.net/web-security/csrf/bypassing-referer-based-defenses  
> https://portswigger.net/web-security/csrf/preventing
