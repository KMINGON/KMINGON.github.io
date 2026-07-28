+++
date = '2026-06-28T10:00:00+09:00'
draft = false
title = '[Playbook] XSS 올인원 진단 Cheat Sheet'
summary = "XSS 진단 중 입력이 도달한 파서 컨텍스트와 실행 조건을 빠르게 판별하고 다음 페이로드를 선택하기 위한 올인원 Playbook"
toc = true
tags = ["XSS", "Playbook", "Cheat Sheet", "Testing Workflow"]
+++

---

이 문서는 XSS 진단 중 **입력이 어느 파서 컨텍스트에 도달했는지 확인하고 다음 페이로드를 고르기 위한 빠른 참고서**다. 복잡한 필터 우회와 프레임워크 내부 동작은 짧은 예외 상황으로만 정리하고 관련 Write-up과 Analysis로 연결한다.

> 승인된 테스트 환경과 실습에서만 사용한다. 처음부터 세션·사용자 데이터를 외부로 전송하지 않고 `alert(1)`, `print()`, DOM marker처럼 영향이 없는 방식으로 JavaScript 실행 여부만 확인한다.

## 30초 진단 흐름

1. 고유 marker가 Raw Response 또는 DOM에 나타나는지 확인한다.
2. ``< > " ' ` \\ & / $ { }`` 문자가 어떻게 변환되는지 비교한다.
3. HTML, Attribute, URL, JavaScript, JSON, DOM 중 컨텍스트를 결정한다.
4. `BREAKOUT → EXECUTION → TRIGGER → REPAIR` 순서로 페이로드를 조립한다.
5. 실행되지 않으면 필터, 이벤트 조건, CSP, 프레임워크 순서로 확인한다.

| marker 위치 | 우선 판단 | 다음 단계 |
| --- | --- | --- |
| HTTP 응답 HTML에 그대로 존재 | Reflected·Stored 가능 | HTML parser 컨텍스트 확인 |
| Raw Response에서는 인코딩되지만 DOM 값은 복원됨 | 다단계 파싱 가능 | DOM property와 다음 parser 확인 |
| Raw Response에는 없고 JavaScript 실행 후 DOM에 생성 | DOM-Based 가능 | Source → Transform → Sink 추적 |
| JSON 응답에 존재 | 즉시 XSS로 확정 불가 | `JSON.parse`, `eval`, HTML sink 사용 여부 확인 |
| URL·href·src에 존재 | URL 컨텍스트 | 허용 scheme과 클릭·탐색 조건 확인 |

## 1. 반사 위치와 문자 변환 확인

실행 페이로드보다 먼저 고유 marker와 경계 문자를 넣는다.

``KMINGON<>'"`\\&/${}``

다음 세 값을 비교한다.

1. HTTP Raw Response
2. 개발자 도구 Elements의 DOM
3. JavaScript가 읽은 실제 property 값

| 확인 결과 | 의미 | 다음 단계 |
| --- | --- | --- |
| `<`·`>`가 그대로 태그로 파싱 | HTML 요소 삽입 가능 | 이벤트가 있는 안전한 PoC 요소 사용 |
| `<`·`>`는 인코딩되지만 따옴표가 남음 | 기존 속성 탈출 가능성 | 새 속성·이벤트 추가 |
| 따옴표가 escape되지만 역슬래시는 남음 | escape 상쇄 가능성 | 최종 JavaScript 문자열 확인 |
| Entity가 DOM에서 문자로 복원 | 다음 parser가 복원값을 해석할 수 있음 | 이벤트 핸들러·`srcdoc` 등 확인 |
| 입력이 텍스트로만 표시 | 실행 컨텍스트가 아닐 수 있음 | 다른 반사 위치와 client-side sink 확인 |

- [원리: 브라우저의 인코딩 해석 규칙](/analysis/analysis-%EB%B8%8C%EB%9D%BC%EC%9A%B0%EC%A0%80%EC%9D%98-%EC%9D%B8%EC%BD%94%EB%94%A9-%ED%95%B4%EC%84%9D-%EA%B7%9C%EC%B9%99-%EB%B6%84%EC%84%9D/)

## 2. 출력 컨텍스트별 빠른 선택

페이로드는 다음 네 부분으로 나누어 생각한다.

> `BREAKOUT → EXECUTION PRIMITIVE → TRIGGER → SYNTAX REPAIR`

| 컨텍스트 | 1차 확인 예시 | 핵심 조건 | 관련 실습 |
| --- | --- | --- | --- |
| HTML 태그 사이 | `<img src=x onerror=alert(1)>` | 새 요소가 태그로 파싱되는가 | [HTML Context](/write-up/portswigger/xss/write-up-portswigger---reflected-xss-into-html-context-with-nothing-encoded/) |
| 큰따옴표 속성 | `" autofocus onfocus=alert(1) x="` | `"`로 기존 값을 닫을 수 있는가 | [Attribute Context](/write-up/portswigger/xss/write-up-portswigger---reflected-xss-into-attribute-with-angle-brackets-html-encoded/) |
| 작은따옴표 속성 | `' autofocus onfocus=alert(1) x='` | 작은따옴표가 인코딩되는가 | [Canonical Link](/write-up/portswigger/xss/write-up-portswigger---reflected-xss-in-canonical-link-tag/) |
| URL 속성 | `javascript:alert(1)` | scheme 검증과 사용자 클릭 조건 | [Stored href](/write-up/portswigger/xss/write-up-portswigger---stored-xss-into-anchor-href-attribute-with-double-quotes-html-encoded/) |
| 작은따옴표 JS 문자열 | `'-alert(1)-'` | HTML보다 JavaScript 문자열 경계가 핵심 | [JavaScript String](/write-up/portswigger/xss/write-up-portswigger---reflected-xss-into-a-javascript-string-with-angle-brackets-html-encoded/) |
| Template Literal | `${alert(1)}` | backtick 탈출 없이 표현식 삽입 가능 여부 | [Template Literal](/write-up/portswigger/xss/write-up-portswigger---reflected-xss-into-a-template-literal-with-angle-brackets-single-double-quotes-backslash-and-backticks-unicode-escaped/) |
| 이벤트 핸들러 내부 문자열 | Entity로 구분자 복원 여부 확인 | HTML parse 후 JavaScript compile | [onclick Context](/write-up/portswigger/xss/write-up-portswigger---stored-xss-into-onclick-event-with-angle-brackets-and-double-quotes-html-encoded-and-single-quotes-and-backslash-escaped/) |
| JSON 응답 | `"`·`\\` 처리 비교 | JSON이 이후 `eval` 또는 HTML sink로 이동하는가 | [Reflected DOM XSS](/write-up/portswigger/xss/write-up-portswigger---reflected-dom-xss/) |

PoC가 실행되면 남은 HTML·JavaScript가 문법 오류를 만들지 않도록 빈 속성, 문자열, 연산자, 주석 등으로 뒤쪽 구문을 복구한다.

## 3. DOM-Based XSS 빠른 확인

Raw Response에서 취약한 반사 지점을 찾지 못했다면 client-side 데이터 흐름을 확인한다.

> `Source → decode·replace·concatenation → Sink → Trigger`

### 자주 확인할 Source

| Source | 확인할 값 |
| --- | --- |
| `location.search` | URL decoding 전후 query string |
| `location.hash` | 서버로 전송되지 않는 fragment |
| `location.href` | 전체 URL과 재직렬화 결과 |
| `document.referrer` | 외부에서 유입된 이전 URL |
| `postMessage` | origin 검증과 message 데이터 |
| `localStorage`·`sessionStorage` | 이전 요청에서 저장된 사용자 제어 값 |

### 자주 확인할 Sink

| Sink | 입력이 해석되는 컨텍스트 | 빠른 판단 | 실습 |
| --- | --- | --- | --- |
| `innerHTML` | HTML | `<script>`보다 이벤트 요소로 확인 | [innerHTML Sink](/write-up/portswigger/xss/write-up-portswigger---dom-xss-in-innerhtml-sink-using-source-location.search/) |
| `document.write` | 현재 HTML parser 상태 | 주변 태그·속성·`select` 컨텍스트 확인 | [document.write](/write-up/portswigger/xss/write-up-portswigger---dom-xss-in-document.write-sink-using-source-location.search/), [select 내부](/write-up/portswigger/xss/write-up-portswigger---dom-xss-in-document.write-sink-using-source-location.search-inside-a-select-element/) |
| `eval`·`Function` | JavaScript | 서버·클라이언트 escape를 모두 추적 | [Reflected DOM XSS](/write-up/portswigger/xss/write-up-portswigger---reflected-dom-xss/) |
| jQuery `$()` | Selector 또는 HTML | 버전과 입력 첫 문자 확인 | [jQuery Selector](/write-up/portswigger/xss/write-up-portswigger---dom-xss-in-jquery-selector-sink-using-a-hashchange-event/) |
| jQuery `.attr('href', value)` | URL | `javascript:`와 클릭 조건 확인 | [jQuery href](/write-up/portswigger/xss/write-up-portswigger---dom-xss-in-jquery-anchor-href-attribute-sink-using-location.search-source/) |

`innerHTML`에 `<script>`가 보이지만 실행되지 않는 것과, 기존의 비어 있는 `<script>` 요소 내용이 변경되며 실행되는 것은 서로 다른 동작이다.

- [원리: InnerHTML과 Script 태그 분석](/analysis/analysis-innerhtml%EA%B3%BC-script-%ED%83%9C%EA%B7%B8-%EB%B6%84%EC%84%9D/)

## 4. Trigger 확인

DOM에 페이로드가 생성됐다는 사실과 이벤트가 발생해 실행됐다는 사실을 분리한다.

| Trigger | 주로 사용하는 상황 | 확인할 조건 | 실습 |
| --- | --- | --- | --- |
| `error` | 잘못된 이미지·미디어 URL | 오류가 실제로 발생하는가 | [innerHTML Sink](/write-up/portswigger/xss/write-up-portswigger---dom-xss-in-innerhtml-sink-using-source-location.search/) |
| `load` | SVG·iframe·body | 요소의 load 이벤트 지원 여부 | [관련: SVG 이벤트 실습](/write-up/portswigger/xss/write-up-portswigger---reflected-xss-with-some-svg-markup-allowed/) |
| `focus` | input·포커스 가능한 요소 | `autofocus`, fragment focus | [Attribute Context](/write-up/portswigger/xss/write-up-portswigger---reflected-xss-into-attribute-with-angle-brackets-html-encoded/) |
| `hashchange` | fragment를 읽는 handler | 페이지 로드 후 fragment가 변경되는가 | [jQuery hashchange](/write-up/portswigger/xss/write-up-portswigger---dom-xss-in-jquery-selector-sink-using-a-hashchange-event/) |
| `resize` | resize handler | iframe 크기 변화로 이벤트 발생 가능 여부 | [body onresize](/write-up/portswigger/xss/write-up-portswigger---reflected-xss-into-html-context-with-most-tags-and-attributes-blocked/) |
| click·accesskey | URL·보이지 않는 요소 | 사용자 상호작용이 필요한가 | [Canonical Link](/write-up/portswigger/xss/write-up-portswigger---reflected-xss-in-canonical-link-tag/) |

자동 실행이 필요하면 먼저 기존 페이지에서 자연스럽게 발생하는 이벤트를 찾는다. 이벤트가 없으면 fragment 변경, focus, iframe load 같은 전달 조건을 별도로 구성한다.

## 5. 필터에 막혔을 때

차단 응답과 정상 응답을 비교해 **태그 → 속성 → 값 → Trigger** 순서로 범위를 좁힌다.

| 증상 | 우선 확인 | 다음 선택 | 실습 |
| --- | --- | --- | --- |
| `<`·`>`만 인코딩 | 기존 요소의 따옴표가 남는지 | 속성 탈출·이벤트 추가 | [Attribute Context](/write-up/portswigger/xss/write-up-portswigger---reflected-xss-into-attribute-with-angle-brackets-html-encoded/) |
| 일반 태그 대부분 차단 | 허용 태그와 이벤트를 따로 열거 | body·SVG 등 허용 조합 | [태그·속성 차단](/write-up/portswigger/xss/write-up-portswigger---reflected-xss-into-html-context-with-most-tags-and-attributes-blocked/) |
| 표준 태그 전부 차단 | Custom element 허용 여부 | focus 가능한 사용자 정의 요소 | [Custom Tag](/write-up/portswigger/xss/write-up-portswigger---reflected-xss-into-html-context-with-all-tags-blocked-except-custom-ones/) |
| 이벤트 속성 차단 | SVG animation·URL 속성 등 다른 실행면 | 허용된 동적 속성 확인 | [SVG href 변경](/write-up/portswigger/xss/write-up-portswigger---reflected-xss-with-event-handlers-and-href-attributes-blocked/) |
| 작은따옴표가 escape | 공격자 역슬래시도 escape되는지 | escape 상쇄 또는 HTML 종료 규칙 | [Escape 상쇄](/write-up/portswigger/xss/write-up-portswigger---reflected-xss-into-a-javascript-string-with-angle-brackets-and-double-quotes-html-encoded-and-single-quotes-escaped/), [script 종료](/write-up/portswigger/xss/write-up-portswigger---reflected-xss-into-a-javascript-string-with-single-quote-and-backslash-escaped/) |
| 공백·괄호 등 일부 문자 차단 | 대체 문법이 필요한지 | 특수 상황 표 확인 | [JavaScript URL](/write-up/portswigger/xss/write-up-portswigger---reflected-xss-in-a-javascript-url-with-some-characters-blocked/) |

## 6. CSP 빠른 확인

PoC 요소가 DOM에 존재하지만 실행되지 않는다면 Console의 CSP 오류와 응답 헤더를 확인한다.

| 확인 항목 | 의미 |
| --- | --- |
| `script-src` | 기본 script 로드·실행 정책 |
| `script-src-elem` | `<script>` 요소에 더 구체적으로 적용 |
| `script-src-attr` | 이벤트 핸들러 속성에 적용 |
| nonce·hash | 허용된 inline script 식별 |
| `strict-dynamic` | nonce·hash 기반 신뢰 전파 여부 |
| `base-uri`, `form-action` | script 외 탐색·폼 제출 제한 |

CSP는 XSS 존재 여부와 별개인 추가 방어선이다. HTML Injection이 가능하지만 script 실행만 차단된 상황인지, 입력 자체가 안전하게 인코딩된 상황인지 구분한다.

- [원리: CSP Nonce 우회 방법 분석](/analysis/analysis-csp-nonce-%EC%9A%B0%ED%9A%8C-%EB%B0%A9%EB%B2%95-%EB%B6%84%EC%84%9D/)

## 7. 특수·예외 상황

아래 항목은 일반 컨텍스트 페이로드가 맞지 않을 때만 확인한다. 레거시 프레임워크나 복잡한 우회 문법은 여기서 확장하지 않고 관련 실습으로 연결한다.

| 상황 | 짧은 판단 기준 | 관련 글 |
| --- | --- | --- |
| 일부 SVG만 허용 | 애니메이션 요소와 `onbegin` 같은 SVG 이벤트 확인 | [SVG Markup Write-up](/write-up/portswigger/xss/write-up-portswigger---reflected-xss-with-some-svg-markup-allowed/) |
| `href`와 이벤트가 모두 차단 | SVG가 실행 시점에 링크 속성을 변경할 수 있는지 확인 | [SVG animate href](/write-up/portswigger/xss/write-up-portswigger---reflected-xss-with-event-handlers-and-href-attributes-blocked/) |
| AngularJS 표현식이 평가됨 | `{{7*7}}` 결과와 버전을 먼저 확인 | [AngularJS 기본 표현식](/write-up/portswigger/xss/write-up-portswigger---dom-xss-in-angularjs-expression-with-angle-brackets-and-double-quotes-html-encoded/), [Sandbox Escape](/write-up/portswigger/xss/write-up-portswigger---reflected-xss-with-angularjs-sandbox-escape-without-strings/) |
| AngularJS와 CSP가 함께 적용 | 브라우저 이벤트 속성이 아닌 framework directive 경로 확인 | [AngularJS + CSP](/write-up/portswigger/xss/write-up-portswigger---reflected-xss-with-angularjs-sandbox-escape-and-csp/) |
| CSP 헤더 일부에 입력이 반사 | 세미콜론으로 새 지시어가 주입되는지 확인 | [CSP Policy Injection](/write-up/portswigger/xss/write-up-portswigger---reflected-xss-protected-by-csp-with-csp-bypass/) |
| script 실행 없이 정보 유출 필요 | `form-action` 등 빠진 navigation 제한 확인 | [Strict CSP + Form Hijacking](/write-up/portswigger/xss/write-up-portswigger---reflected-xss-protected-by-very-strict-csp-with-dangling-markup-attack/) |
| 괄호·공백이 차단된 JavaScript URL | 암시적 형 변환·전역 오류 처리 같은 대체 실행 경로 | [Blocked Characters](/write-up/portswigger/xss/write-up-portswigger---reflected-xss-in-a-javascript-url-with-some-characters-blocked/) |
| Stored DOM에서 일부 문자만 치환 | 전체가 아닌 첫 번째 일치만 replace되는지 확인 | [Stored DOM XSS](/write-up/portswigger/xss/write-up-portswigger---stored-dom-xss/) |

## Quick Checklist

- [ ] 고유 marker가 Raw Response와 DOM 중 어디에 나타나는지 확인했는가?
- [ ] 경계 문자의 인코딩·escape·복원 결과를 비교했는가?
- [ ] HTML·Attribute·URL·JavaScript·JSON·DOM 컨텍스트를 구분했는가?
- [ ] BREAKOUT·EXECUTION·TRIGGER·REPAIR를 각각 확인했는가?
- [ ] DOM XSS라면 Source → Transform → Sink 흐름을 추적했는가?
- [ ] 페이로드가 생성된 것과 실제 Trigger가 발생한 것을 구분했는가?
- [ ] CSP가 존재한다면 차단된 실행 종류와 적용 지시어를 확인했는가?
- [ ] 일반 흐름에 맞지 않을 때만 특수·예외 상황을 확인했는가?
