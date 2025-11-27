+++
date = '2025-08-29T04:47:52+09:00'
draft = false
title = '[Analysis] 브라우저의 인코딩 해석 규칙 분석'
summary = "HTML Parser, URL Parser 의 동작 방식을 표준 문서를 통해 확인하고, 인코딩·이스케이프 방식을 통한 필터링 우회 방법을 분석해보았다."
toc = true
tags = ["Web", "XSS", "HTML Parser", "URL Parser"]
+++

---

## 문자열 필터링 우회

XSS 우회 기법을 공부하다 보면 `\u`, `\x`, `%`, `&#` 등 다양한 인코딩·이스케이프 방식이 사용되는 것을 자주 보게 된다. 그런데 실제로는 상황에 따라 어떤 방식은 통하고, 어떤 방식은 전혀 통하지 않는다.  
이를 정확히 이해하기 위해 나는 먼저 기본적인 사실들을 정리하고, 그 과정에서 든 의문들을 표준 문서를 통해 확인해 보았다.

---

## 기본 사실: HTML Entity로 우회가 가능하다?
일반적으로 알려진 기법 중 하나는 **HTML Entity Encoding**을 속성 값에 삽입하는 것이다.  
예를 들어 `srcdoc="<s&#63;ript>..."`처럼 속성 값에서 `&#...;`로 문자를 치환하면 필터를 우회할 수 있다.  

여기서 의문이 생겼다.  
> “그렇다면 태그 이름이나 속성 이름에도 `&#...;`를 써서 우회할 수 있지 않을까?”

---

## 의문 확인: 태그/속성 이름에서의 동작
실제로 `<s&#x63;ript>` 같은 태그를 넣어 보면, `&#x63;`이 `c`로 변환되지 않고 그대로 출력된다.  
하지만 `<&#x73;cript>`를 넣으면 결과 화면에는 `<script>`처럼 보인다.  
이 차이는 어디서 오는 걸까?

### HTML Standard 문서 확인
[HTML Standard - Tokenization](https://html.spec.whatwg.org/multipage/parsing.html#tokenization) 규칙을 보면 답이 나온다.
- **Data state, RCDATA state**: `&`를 만나면 **character reference state**로 진입 → `&#...;`가 변환됨  
- **Tag name state, Attribute name state**: `&`를 만나도 문자 참조 해석 없음 → 그냥 글자로 붙음  
- **Tag open state**: `<` 다음 잘못된 문자가 오는 경우, 토크나이저는 다시 **Data state**로 돌아감 → `<&#x73;cript>`의 경우 `<`이후 `&`라는 잘못된 문자가 있기에 `<`가 텍스트로 처리되고, 이어진 `&#x73;`는 Data state에서 문자 참조로 해석되어 `'s'`가 됨 → 최종 출력은 `<script>` 이지만 문자열이지 태그가 아님

즉, 태그/속성 이름에는 엔티티 해석이 적용되지 않으므로 우회가 불가능하다.

---

## 새로운 의문: URL Encoding과 특수문자는 왜 통하나?
다음으로 `<iframe src="javasc%09ript:%66%65%74%63%68..">` 같은 코드를 보자. `%NN`은 URL Encoding 문자이다.  
보통 HTML 파서는 URL 디코딩을 하지 않는데, 왜 이런 입력이 결국 `javasc{TAB}ript:fetch`로 인식될까?  
또한 `javasc{TAB}ript:`처럼 TAB, LF, CR 문자를 넣어도 문제없이 `javascript:`로 동작하기도 한다.

### URL 파서 호출
HTML 파서는 문서를 토큰화하여 DOM 트리를 구성할 뿐이지만 [HTML Standard URLs and Fetching - 2.4.2 Parsing URLs](https://html.spec.whatwg.org/multipage/urls-and-fetching.html#resolving-urls)에 따르면 이후 `iframe` 요소의 `src`와 같이 URL 속성값을 탐색하거나 리소스를 로드해야 하는 순간 URL 파서가 호출되어 URL Encoding이 해석된다.

하지만 여전히 TAB, LF, CR와 같은 문자가 사이에 끼어있음에도 문제없이 동작하는 이유는 알 수 없었다.

### URL Standard 문서 확인
이는 HTML 파서가 아니라 **URL 파서** 단계에서 설명된다.  
[URL Standard - URL parsing](https://url.spec.whatwg.org/#url-parsing)에 따르면:
- URL 파서는 입력을 받으면 **모든 ASCII 탭(U+0009)과 개행(U+000A, U+000D)을 제거**한다.  
- 이어서 퍼센트 인코딩(`%xx`)을 디코딩한다.

따라서 `%09`, `%0A`, `%0D`는 전부 제거되어 최종적으로 `javascript:` 스킴이 남는다.

*`%20`(SPACE)은 제거되지 않기 때문에 `javascript:`로 인식되지 않는다.*

---

## 또 다른 의문: Script 데이터에서는 왜 엔티티가 안 먹히지?
`<script>` 내부에서 `&#x61;lert(1)`을 써 보면 동작하지 않는다.  
이유는 [HTML Standard - Script data state](https://html.spec.whatwg.org/multipage/parsing.html#script-data-state) 규칙 때문이다.
- Script data 상태에서는 `&`가 문자 참조로 전환되지 않고 그냥 문자로 처리된다.  
- 따라서 이 구간에서 우회하려면 HTML 엔티티가 아니라 JS 파서가 제공하는 **escape sequence** (`\uXXXX`, `\xHH`)를 써야 한다.

---

## 최종 정리
내가 확인한 내용을 정리하면 다음과 같다:

- **HTML Entity Encoding**  
  → Data/RCDATA/속성 값에서만 동작, 태그 이름·속성 이름·Script data에서는 불가
- **URL Encoding 및 특수문자**  
  → URL 파서가 퍼센트 디코딩 및 탭/개행 제거를 수행하기 때문에 우회 가능
- **JS Escape (`\u`, `\x`)**  
  → Script data나 이벤트 핸들러 속성 값에서 자바스크립트 파서가 해석해줌

즉, 우회의 핵심은 현재 문자열이 어떤 파서 상태에 놓여 있는지 알고, 각 파서의 파싱 규칙을 이용하는 것이다.

>참고자료  
>[WHATWG URL Standard](https://url.spec.whatwg.org/)  
>[WHATWG HTML Standard: URLs and Fetching](https://html.spec.whatwg.org/multipage/urls-and-fetching.html)  
>[WHATWG HTML Standard: Parsing](https://html.spec.whatwg.org/multipage/parsing.html)  
[WHATWG HTML Standard: Semantics](https://html.spec.whatwg.org/dev/semantics.html)