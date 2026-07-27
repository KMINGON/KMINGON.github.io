+++
date = '2026-06-02T09:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - DOM XSS in jQuery anchor href attribute sink using location.search source'
summary = "returnPath 파라미터가 jQuery attr 함수로 링크의 href에 대입되는 흐름에서 javascript URL을 주입하는 DOM XSS 풀이"
toc = true
tags = ["XSS", "DOM-Based", "jQuery", "JavaScript URL", "PortSwigger", "Apprentice"]
+++

---

## 문제 분석

> **난이도**: `APPRENTICE`  
> **Lab**: [DOM XSS in jQuery anchor href attribute sink using location.search source](https://portswigger.net/web-security/cross-site-scripting/dom-based/lab-jquery-href-attribute-sink)

> ![image.png](/writeup/portswigger/xss/05/1.png)

Submit feedback 페이지가 jQuery의 `attr()` 함수로 Back 링크의 `href` 속성을 변경한다. 이때 URL의 `returnPath` 파라미터를 그대로 사용하므로, 링크를 클릭했을 때 `document.cookie`를 `alert()`로 출력하면 문제가 해결된다.

### DOM XSS 진단

페이지에서 다음 코드를 확인할 수 있다.

```html
<script>
    $(function() {
        $('#backLink').attr('href', (new URLSearchParams(window.location.search)).get('returnPath'));
    });
</script>
```

`location.search`에서 가져온 `returnPath`가 `backLink` 요소의 `href` 속성에 그대로 대입된다. 예를 들어 `returnPath=/test`를 전달하면 다음과 같은 링크가 만들어진다.

```html
<a id="backLink" href="/test">Back</a>
```

`href`는 일반 경로뿐 아니라 `javascript:` URL도 허용하므로 속성 값을 탈출하지 않고도 실행 가능한 코드를 지정할 수 있다.

---

## 익스플로잇

`returnPath` 파라미터에 다음 값을 전달한다.

```text
javascript:alert(document.cookie)
```

![image.png](/writeup/portswigger/xss/05/2.png)

jQuery가 해당 값을 Back 링크의 `href`로 설정한다. 이후 링크를 클릭하면 브라우저가 JavaScript URL을 실행하여 쿠키를 출력하고 문제가 해결된다.

![image.png](/writeup/portswigger/xss/05/3.png)

---

## 정리

DOM XSS는 HTML 문자열을 삽입할 때만 발생하는 취약점이 아니다. 공격자가 제어하는 값을 `href` 같은 URL 속성에 대입하면 `javascript:` 스킴이 실행 경로가 될 수 있다. URL을 링크에 적용할 때는 허용된 프로토콜과 목적지를 검증하고, 단순히 따옴표를 인코딩하는 것만으로 안전하다고 판단해서는 안 된다.
