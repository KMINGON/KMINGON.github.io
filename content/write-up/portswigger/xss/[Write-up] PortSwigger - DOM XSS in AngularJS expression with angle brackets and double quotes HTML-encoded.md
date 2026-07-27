+++
date = '2026-06-03T15:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - DOM XSS in AngularJS expression with angle brackets and double quotes HTML-encoded'
summary = "HTML 인코딩된 검색어가 ng-app 범위에 삽입되는 환경에서 AngularJS 표현식과 Function 생성자로 alert를 실행하는 DOM XSS 풀이"
toc = true
tags = ["XSS", "DOM-Based", "AngularJS", "CSTI", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [DOM XSS in AngularJS expression with angle brackets and double quotes HTML-encoded](https://portswigger.net/web-security/cross-site-scripting/dom-based/lab-angularjs-expression)

> ![image.png](/writeup/portswigger/xss/11/1.png)

검색 기능의 입력값은 꺾쇠와 큰따옴표가 HTML 인코딩된 상태로 출력되지만, 출력 위치가 AngularJS의 `ng-app` 범위에 포함된다. HTML 태그 대신 AngularJS 표현식을 실행해 `alert()`를 호출하면 문제가 해결된다.

### XSS 진단

`ng-app` 지시어가 선언된 요소와 그 하위 DOM은 AngularJS가 컴파일한다. 검색어로 고유 문자열 `xss`를 입력하면 해당 값이 이 범위 안에 반사되는 것을 확인할 수 있다.

![image.png](/writeup/portswigger/xss/11/2.png)

AngularJS 표현식이 평가되는지 확인하기 위해 다음 값을 검색한다.

```text
{{1+1}}
```

화면에 `2`가 출력되므로 서버가 반환한 중괄호 표현식을 AngularJS가 클라이언트에서 평가한다는 사실을 확인할 수 있다.

![image.png](/writeup/portswigger/xss/11/3.png)

---

## 익스플로잇

AngularJS 표현식 안에서 전역 `alert`를 직접 참조하는 대신, 모든 scope에서 사용할 수 있는 `$on` 메서드의 `constructor`를 이용해 `Function` 생성자에 도달한다.

```javascript
{{$on.constructor('alert(1)')()}}
```

`$on.constructor('alert(1)')`는 본문이 `alert(1)`인 함수를 만들고, 마지막 `()`가 생성한 함수를 즉시 호출한다.

![image.png](/writeup/portswigger/xss/11/4.png)

표현식이 AngularJS에 의해 평가되면서 `alert()`가 실행되고 문제가 해결된다.

![image.png](/writeup/portswigger/xss/11/5.png)

---

## 정리

HTML 인코딩은 HTML 태그 삽입을 막지만, 출력값을 다시 해석하는 클라이언트 템플릿 엔진까지 보호하지는 못한다. AngularJS의 활성 범위에 신뢰할 수 없는 입력이 들어가면 `{{...}}`가 데이터가 아닌 표현식으로 평가될 수 있다. 이런 유형은 XSS와 함께 Client-Side Template Injection 관점으로도 확인해야 한다.
