+++
date = '2026-06-05T18:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - Reflected XSS into a JavaScript string with angle brackets and double quotes HTML-encoded and single quotes escaped'
summary = "작은따옴표 앞에 추가되는 역슬래시를 공격자가 입력한 역슬래시로 상쇄해 JavaScript 문자열을 탈출하는 Reflected XSS 풀이"
toc = true
tags = ["XSS", "Reflected XSS", "JavaScript Context", "Escape Bypass", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [Reflected XSS into a JavaScript string with angle brackets and double quotes HTML-encoded and single quotes escaped](https://portswigger.net/web-security/cross-site-scripting/contexts/lab-javascript-string-angle-brackets-double-quotes-encoded-single-quotes-escaped)

> ![image.png](/writeup/portswigger/xss/20/1.png)

검색어는 JavaScript 문자열에 반사된다. 꺾쇠와 큰따옴표는 HTML 인코딩되고 작은따옴표에는 역슬래시가 추가되지만, 역슬래시 자체는 이스케이프되지 않는다. 이 처리 차이를 이용해 문자열을 탈출하고 `alert()`를 호출하면 문제가 해결된다.

### XSS 진단

반사 위치는 다음과 같다.

```html
<script>
    var searchTerms = 'xss';
    document.write('<img src="/resources/images/tracker.gif?searchTerms=' +
                   encodeURIComponent(searchTerms) + '">');
</script>
```

`'`를 입력하면 서버가 `\'`로 바꾸므로 문자열을 닫을 수 없다. 반면 `\`를 입력해도 추가 이스케이프가 적용되지 않는다. 공격자가 작은따옴표 앞에 역슬래시를 하나 넣으면 서버가 추가한 역슬래시와 `\\` 쌍을 이루고, 뒤의 작은따옴표는 더 이상 이스케이프되지 않은 문자열 구분자가 된다.

---

## 익스플로잇

다음 검색어를 입력한다.

```javascript
\';alert(1);//
```

서버 처리 후 인라인 스크립트는 다음과 같은 형태가 된다.

```javascript
var searchTerms = '\\';alert(1);//';
```

`\\`는 문자열 안의 역슬래시로 소비되고, 작은따옴표가 원래 문자열을 닫는다. 이어지는 `alert(1)`이 실행되며 `//`는 뒤에 남은 작은따옴표와 세미콜론을 주석 처리한다.

![image.png](/writeup/portswigger/xss/20/2.png)

페이지를 로드하면 `alert()`가 호출되어 문제가 해결된다.

![image.png](/writeup/portswigger/xss/20/3.png)

---

## 정리

이스케이프를 적용할 때는 이스케이프 문자 자체도 함께 처리해야 한다. 작은따옴표 앞에 역슬래시만 추가하는 방어는 공격자가 선행 역슬래시를 넣어 두 문자를 한 쌍으로 만들면 무력화된다. 가능하면 사용자 데이터를 실행 코드에 문자열 연결하지 않는 구조가 안전하다.
