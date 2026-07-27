+++
date = '2026-06-03T12:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - DOM XSS in document.write sink using source location.search inside a select element'
summary = "storeId 파라미터가 document.write를 통해 select 내부 option으로 삽입되는 컨텍스트를 탈출하는 DOM XSS 풀이"
toc = true
tags = ["XSS", "DOM-Based", "document.write", "HTML Context", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [DOM XSS in document.write sink using source location.search inside a select element](https://portswigger.net/web-security/cross-site-scripting/dom-based/lab-document-write-sink-inside-select-element)

> ![image.png](/writeup/portswigger/xss/10/1.png)

상품 재고 확인 기능은 `location.search`에서 `storeId`를 읽어 `document.write()`로 `<select>` 요소 내부에 새로운 `<option>`을 만든다. 현재 option과 select 컨텍스트를 탈출해 `alert()` 함수를 호출하면 문제가 해결된다.

### DOM XSS 진단

상품 상세 페이지에서 재고 확인 기능의 JavaScript를 확인한다.

![image.png](/writeup/portswigger/xss/10/2.png)

코드는 URL에서 `storeId`를 가져와 다음과 같은 HTML 문자열을 생성한다.

```html
<select name="storeId">
    <option selected value="USER_INPUT">USER_INPUT</option>
</select>
```

`/product?productId=1&storeId=xss`로 요청하면 드롭다운에 `xss`가 새로운 option으로 표시된다.

![image.png](/writeup/portswigger/xss/10/3.png)

입력값이 큰따옴표로 감싼 `value` 속성과 option 본문에 들어가므로, 속성과 요소를 순서대로 닫아 select 바깥의 HTML 컨텍스트로 이동할 수 있다.

---

## 익스플로잇

`storeId` 파라미터에 다음 페이로드를 전달한다.

```html
"></select><img src=1 onerror=alert(1)>
```

URL에 적용할 때는 다음과 같이 인코딩한다.

```text
/product?productId=1&storeId=%22%3E%3C%2Fselect%3E%3Cimg%20src%3D1%20onerror%3Dalert%281%29%3E
```

첫 `">`가 option의 `value` 속성과 시작 태그를 닫고, `</select>`가 현재 select 컨텍스트를 끝낸다. 뒤의 `img`는 일반 HTML 컨텍스트에서 생성되며 잘못된 `src`로 인해 `onerror`를 실행한다.

![image.png](/writeup/portswigger/xss/10/4.png)

`alert()`가 호출되면서 문제가 해결된다.

![image.png](/writeup/portswigger/xss/10/5.png)

---

## 정리

`document.write()`에 입력이 도달한다는 사실만으로 페이로드가 결정되지는 않는다. 이 랩에서는 입력이 `<select>`와 `<option>` 안에 있기 때문에 기존 속성과 요소를 모두 닫아야 안정적으로 실행 가능한 요소를 삽입할 수 있다. DOM 트리에서 현재 파싱 컨텍스트를 확인하는 과정이 중요한 이유다.
