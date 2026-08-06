+++
date = '2026-07-03T15:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - User ID controlled by request parameter with data leakage in redirect'
summary = "리다이렉트 응답이 함께 실어 보내는 본문에서 다른 사용자의 API Key가 유출되는 IDOR 풀이"
toc = true
tags = ["Access Control", "IDOR", "Information Disclosure", "PortSwigger", "Apprentice"]
+++

---

## 문제 분석

> **난이도**: `APPRENTICE`  
> **Lab**: [User ID controlled by request parameter with data leakage in redirect](https://portswigger.net/web-security/access-control/lab-user-id-controlled-by-request-parameter-with-data-leakage-in-redirect)

> ![image.png](/writeup/portswigger/access-control/07/1.png)

리다이렉트 응답의 본문에 민감한 데이터가 유출되는 Access Control 취약점이 존재한다. 이를 이용해 `carlos`의 API Key를 획득해 제출하면 문제가 해결된다. 실습 계정은 `wiener:peter`다.

### Access Control 진단

실습 계정으로 로그인한 뒤, 계정 페이지 요청의 `id` 파라미터에 `carlos`를 넣어 보낸다.

```http
HTTP/2 302 Found
Location: /login
Content-Type: text/html; charset=utf-8
Cache-Control: no-cache
Set-Cookie: session=SteYjZ9EwY36Ad8R7Hez8mJFw29dM8aY; Secure; HttpOnly; SameSite=None
X-Frame-Options: SAMEORIGIN
Content-Length: 3749
```

응답 상태는 `302 Found`이고 `Location: /login`으로 로그인 페이지로 되돌리려 한다. 화면상으로는 접근이 차단된 것처럼 보인다. 그러나 `Content-Length: 3749` — **리다이렉트 응답이 본문을 함께 담고 있다.** 브라우저는 302를 만나면 본문을 버리고 `Location`으로 이동하지만, 서버는 이미 본문을 렌더링해 보내 버린 것이다.

프록시에서 이 응답 본문을 확인하면 `carlos`의 계정 페이지가 그대로 들어 있다.

```html
<p>Your username is: carlos</p>
<div>Your API Key is: lvPhkxPDILikqbnwzeDfbFeQaO3y0jKZ</div>
```

---

## 익스플로잇

리다이렉트 응답 본문에서 얻은 API Key를 제출하면 문제가 해결된다.

```text
carlos의 API Key: lvPhkxPDILikqbnwzeDfbFeQaO3y0jKZ
```

![image.png](/writeup/portswigger/access-control/07/2.png)

---

## 정리

이 랩은 접근 제어가 **잘못된 순서**로 걸린 사례다. 서버는 `carlos`의 데이터를 볼 권한이 없다는 것을 알고 `/login`으로 리다이렉트하려 했다. 그러나 그 판단이 **페이지를 렌더링한 뒤에** 이루어졌다. 응답 헤더로는 접근을 막았지만, 막아야 할 데이터는 이미 본문에 실려 나갔다.

브라우저만 보면 이 결함은 드러나지 않는다. 302를 받은 브라우저는 본문을 표시하지 않고 곧장 이동하므로, 화면에는 로그인 페이지만 보인다. 결함이 보이는 곳은 프록시다 — 리다이렉트의 상태 코드와 무관하게 서버가 실제로 보낸 바이트를 그대로 확인할 수 있기 때문이다. 이것이 접근 제어 진단에서 프록시로 원본 응답을 봐야 하는 이유다.

진단 습관은 하나 더 늘어난다. 리다이렉트 응답을 만나면 상태 코드만 보고 "차단됨"으로 넘기지 말고 `Content-Length`와 본문을 확인한다. 302에 실린 본문, 403 에러 페이지에 남은 데이터 조각, 접근 거부 응답에 포함된 부분 렌더링이 모두 유출 지점이 된다.

방어는 접근 제어를 렌더링보다 **먼저** 수행하는 것이다. 권한이 없으면 어떤 데이터도 조립하기 전에 요청을 거부해야 하며, 리다이렉트로 사용자를 돌려보낼 때도 본문에 보호 대상 데이터를 남기지 않아야 한다. IDOR 자체의 기본형은 [User ID controlled by request parameter](/write-up/portswigger/access-control/write-up-portswigger---user-id-controlled-by-request-parameter/)에서 다뤘다.
