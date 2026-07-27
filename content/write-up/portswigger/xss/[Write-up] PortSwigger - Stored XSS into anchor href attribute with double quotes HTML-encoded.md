+++
date = '2026-06-02T18:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - Stored XSS into anchor href attribute with double quotes HTML-encoded'
summary = "댓글의 Website 값이 작성자 링크 href에 저장되는 지점에 javascript URL을 삽입하는 Stored XSS 풀이"
toc = true
tags = ["XSS", "Stored XSS", "JavaScript URL", "PortSwigger", "Apprentice"]
+++

---

## 문제 분석

> **난이도**: `APPRENTICE`  
> **Lab**: [Stored XSS into anchor href attribute with double quotes HTML-encoded](https://portswigger.net/web-security/cross-site-scripting/contexts/lab-href-attribute-double-quotes-html-encoded)

> ![image.png](/writeup/portswigger/xss/08/1.png)

댓글 기능의 Website 입력값이 작성자 이름을 감싸는 링크의 `href` 속성에 저장된다. 큰따옴표는 HTML 인코딩되므로 속성 탈출 대신 링크가 허용하는 URL 스킴을 이용해야 한다. 작성자 이름을 클릭했을 때 `alert()`를 호출하면 문제가 해결된다.

### XSS 진단

Website 필드에 `xss`를 입력하고 댓글을 조회하면 다음 요소가 만들어진다.

```html
<a id="author" href="xss">name</a>
```

입력값 전체가 `href` 속성값으로 사용된다. 큰따옴표가 인코딩되더라도 `href`가 가리키는 URL 자체는 제어할 수 있으므로 `javascript:` 스킴을 지정할 수 있다.

---

## 익스플로잇

댓글의 Website 필드에 다음 값을 입력한다.

```text
javascript:alert(1)
```

![image.png](/writeup/portswigger/xss/08/2.png)

저장된 댓글에서 작성자 이름을 클릭하면 브라우저가 `href`의 JavaScript URL을 실행한다.

![image.png](/writeup/portswigger/xss/08/3.png)

`alert()`가 호출되며 문제가 해결된다.

---

## 정리

속성 구분 문자를 인코딩하는 것만으로 URL 속성이 안전해지는 것은 아니다. 공격자가 `href` 전체를 제어할 수 있다면 위험한 프로토콜을 직접 지정할 수 있다. 링크를 생성할 때는 `http:`와 `https:`처럼 필요한 스킴만 허용하는 검증이 함께 적용되어야 한다.
