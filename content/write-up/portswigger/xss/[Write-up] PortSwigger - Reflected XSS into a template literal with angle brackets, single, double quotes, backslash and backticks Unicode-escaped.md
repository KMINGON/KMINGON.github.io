+++
date = '2026-06-06T09:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - Reflected XSS into a template literal with angle brackets, single, double quotes, backslash and backticks Unicode-escaped'
summary = "여러 구분 문자가 인코딩된 JavaScript 템플릿 리터럴에서 ${} 표현식을 이용해 코드를 실행하는 Reflected XSS 풀이"
toc = true
tags = ["XSS", "Reflected XSS", "JavaScript Context", "Template Literal", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [Reflected XSS into a template literal with angle brackets, single, double quotes, backslash and backticks Unicode-escaped](https://portswigger.net/web-security/cross-site-scripting/contexts/lab-javascript-template-literal-angle-brackets-single-double-quotes-backslash-backticks-escaped)

> ![image.png](/writeup/portswigger/xss/21/1.png)

검색어는 JavaScript 템플릿 리터럴 안에 반사된다. 꺾쇠와 따옴표는 HTML 인코딩되고 역슬래시와 백틱도 이스케이프되므로 문자열 경계를 직접 닫을 수 없다. 템플릿 리터럴이 제공하는 표현식 문법으로 `alert()`를 호출하면 문제가 해결된다.

### XSS 진단

임의의 검색어를 입력하면 다음 반사 지점을 확인할 수 있다.

```html
<script>
    var message = `0 search results for 'xss'`;
    document.getElementById('searchMessage').innerText = message;
</script>
```

일반 문자열과 달리 템플릿 리터럴은 `${expression}`을 만나면 중괄호 안을 JavaScript 표현식으로 평가하고 그 결과를 문자열에 삽입한다. 이 문법에는 필터링되는 따옴표나 백틱이 필요하지 않다.

---

## 익스플로잇

검색어에 다음 표현식을 입력한다.

```javascript
${alert(1)}
```

![image.png](/writeup/portswigger/xss/21/2.png)

템플릿 문자열이 만들어지는 과정에서 `alert(1)`이 먼저 평가된다. 반환값은 문자열에 포함되지만, 함수 호출 자체가 이미 실행되므로 문제가 해결된다.

![image.png](/writeup/portswigger/xss/21/3.png)

---

## 정리

템플릿 리터럴에서는 백틱을 탈출하지 못하더라도 `${}`가 별도의 코드 실행 경로가 된다. 따라서 사용자 입력을 템플릿 리터럴 안에 삽입할 때는 따옴표와 백틱뿐 아니라 달러 기호와 중괄호가 만드는 표현식 컨텍스트까지 고려해야 한다.
