+++
date = '2025-10-16T01:39:26+09:00'
draft = false
title = '[Analysis] InnerHTML과 Script 태그 분석'
summary = "`<script>` 태그의 실행 과정과 브라우저의 스크립트 처리 메커니즘을 분석해보았다."
toc = true
tags = ["Web", "DOM-XSS", "CSP", "HTML"]
+++

## 들어가며

이 글은 [Dreamhack DOM XSS](https://dreamhack.io/wargame/challenges/438) 문제를 풀던 중 발생한 의문과, 그 의문을 명세를 통해 검증·해소한 과정을 정리한 것이다.
주요 주제는 `<script>` 태그의 실행 과정과 브라우저의 스크립트 처리 메커니즘이다.

---
## 문제 제기

```html
<script nonce={nonce}>
  window.addEventListener("load", function() {
    var name_elem = document.getElementById("name");
    name_elem.innerHTML = `${location.hash.slice(1)}`;
  });
</script>

<script id="name"></script>
```

위 코드는 문제에서 제시된 예제를 약간 수정한 것이다.
코드의 동작은 location.hash 값을 가져와 id=name인 `<script>` 태그의 자식 노드(innerHTML) 로 삽입하는 것이다.

CSP(Content Security Policy)의 script-src 설정은 nonce와 strict-dynamic 옵션이 적용되어 있다고 가정한다.

직관적으로 보면, nonce를 가진 신뢰된 스크립트가 단순히 요소 삽입만 수행하므로 id=name 스크립트는 CSP 정책상 신뢰되지 않은 코드로 실행되지 않아야 한다.  
그러나 실제 실행 결과는 삽입된 스크립트가 정상적으로 실행된다.

이에 다음 두 가지 의문이 생겼다.

>1️⃣ InnerHTML로 단순히 `<script>` 태그 내부 내용을 바꿨을 뿐인데, 왜 코드가 실행되는가?  
2️⃣ strict-dynamic의 신뢰 전파 범위는 어디까지인가?

---

## 비교 실험

이 의문을 검증하기 위해 InnerHTML을 사용해 `<script>`를 삽입하거나 수정했을 때 어떤 조건에서 실행되는지를 실험하였다.

### 실험 1. InnerHTML로 `<script>` 태그 삽입

```html
<script>
  window.addEventListener("load", function() {
    var name_elem = document.getElementById("name");
    name_elem.innerHTML = `<script>${location.hash.slice(1)}<\/script>`;
  });
</script>

<pre id="name"></pre>
```

위 코드는 hash fragment 를 `<script>` 태그의 내용으로 받아와 태그 전체를 삽입하는 코드이다.

![image.png](/note/3-1.png)

결과적으로 개발자 도구에서는 `<script>` 태그가 정상적으로 삽입되었지만,
코드는 실행되지 않았다.

### 실험 2. 기존 `<script>` 요소의 내용 변경

`InnerHTML` 로 `<script>` 요소를 바꾸기만 하면 트리거가 되는지 확인하기 위해 다음과 같은 실험을 진행하였다.

```html
<script>
  window.addEventListener("load", function() {
    var name_elem = document.getElementById("name");
    name_elem.innerHTML = `${location.hash.slice(1)}`;
  });
</script>

<script id="name">var foo = "bar";</script>
```

`InnerHTML`로 `<script>` 의 내용을 변경했을 때 실행이 된다면 `alert(1)` 이 실행되어야 할 것이다.

![image.png](/note/3-2.png)

이 경우에는 기존 `<script>`에 `alert(1)`을 삽입했으나,
역시 실행되지 않았다.

---

## 명세를 통한 검증

위 두 실험 결과를 비교하면, **비어 있던 `<script>` 요소의 내용이 InnerHTML로 갱신**될 때만 실행이 발생한다는 점을 추측할 수 있다.  
이 현상은 HTML 명세의 스크립트 실행 준비 단계(prepare a script) 에 정의되어 있다.

### Script 실행 준비 과정
참고 명세
- [W3C HTML5 - 4.11 Scripting](https://www.w3.org/TR/2014/REC-html5-20141028/scripting-1.html)
- [HTML Stadard - 4.12.1.1 Processing model](https://html.spec.whatwg.org/multipage/scripting.html#prepare-the-script-element)

명세에 따르면 스크립트 실행에는 다음 두 조건이 중요하다.

1. **parser가 삽입한 script**여야 한다.
2. **아직 실행되지 않은 script**여야 한다.

이 과정에서 parser-inserted, was-parser-inserted, already started 등의 상태 플래그가 사용된다.

### parser-inserted 플래그

HTML 파서에 의해 삽입된 `<script>` 요소는 `parser document` 상태가 `non-null`로 설정되며,
이 경우 해당 스크립트를 “parser-inserted”라고 부른다.  
즉, **HTML 파서가 직접 삽입한 스크립트인지, 혹은 JS로 동적으로 생성된 스크립트**인지를 구분하는 역할이다.

### was-parser-inserted 플래그

`was-parser-inserted`는 원래의 `parser-inserted` 값을 복사한 것으로,
파서에 의해 삽입된 스크립트가 **비어있거나 실행에 실패했을 때,
후에 수정되어 실행될 가능성**을 보존하기 위한 장치이다.  
즉, 한 번 파서가 삽입했지만 **아직 실행되지 않은 스크립트**는
후에 내용이 바뀌면 실행될 수 있다.

### already started 플래그

`already started`는 해당 `<script>`가 이미 prepare 또는 execute 단계에 진입했음을 표시한다.
즉, 한 번 실행된 스크립트는 이 플래그가 설정되어 **재실행되지 않는다.**

### Children changed steps

위 개념들을 종합하면,
명세에 정의된 [HTML Standard - 4.12.1.1 Processing model Children changed steps](https://html.spec.whatwg.org/multipage/scripting.html#script-processing-model) 절을 이해할 수 있다.

```html
<script id=outer-script></script>

<script>
  const outerScript = document.querySelector('#outer-script');

  const start = new Text('console.log(1);');
  const innerScript = document.createElement('script');
  innerScript.textContent = `console.log('inner script executing')`;
  const end = new Text('console.log(2);');

  outerScript.append(start, innerScript, end);

  // Logs:
  // 1
  // 2
  // inner script executing
</script>
```

즉,
`outer-script`는 **parser-inserted 상태이지만 비어 있어 실행되지 않은 스크립트**이다.
따라서 `already started`가 설정되지 않았고,
내용이 바뀌면 **Children changed steps** 알고리즘에 따라 **실행 대기 상태**로 남는다.

두 번째 스크립트가 `outer-script`의 내용을 변경하면
그 즉시 `outer-script`가 실행되고,
내부에 새로 삽입된 `inner-script`도 순서대로 실행된다.

---

## 실험 결과 해석

### 실험 1. InnerHTML로 새 `<script>` 삽입

```html
<script>
  window.addEventListener("load", function() {
    var name_elem = document.getElementById("name");
    name_elem.innerHTML = `<script>${location.hash.slice(1)}<\/script>`;
  });
</script>

<pre id="name"></pre>
```

`parser-inserted` 플래그가 없는 스크립트이므로,
명세상 실행 준비 단계를 거치지 않아 실행되지 않는다.

### 실험 2. 기존 `<script>` 내용 변경

```html
<script>
  window.addEventListener("load", function() {
    var name_elem = document.getElementById("name");
    name_elem.innerHTML = `${location.hash.slice(1)}`;
  });
</script>

<script id="name">var foo = "bar";</script>
```

기존 스크립트는 이미 한 번 실행되어 `already started`가 설정되어 있으므로
내용이 바뀌어도 재실행되지 않는다.

### 문제 코드

```html
<script nonce={nonce}>
  window.addEventListener("load", function() {
    var name_elem = document.getElementById("name");
    name_elem.innerHTML = `${location.hash.slice(1)}`;
  });
</script>

<script id="name"></script>
```

`id=name` 스크립트는 parser에 의해 삽입되었지만 내용이 비어 있어 실행되지 않은 상태이며,
`already started`가 설정되지 않았다.  
따라서 첫 번째 스크립트가 내용을 변경하면
**Children changed steps**에 따라 실행이 트리거된다.

---

## 남은 의문 — strict-dynamic 신뢰 전파

여기서 여전히 남는 문제는 **CSP의 strict-dynamic 규칙**이다.
`name` 스크립트는 `nonce`가 없지만 CSP를 우회해 실행된다.

`strict-dynamic` 명세에 따르면,
“신뢰된 스크립트가 **동적으로 생성하거나 로드한 스크립트**”에 한해 신뢰가 전파된다.
그러나 `InnerHTML`로 변경된 기존 `<script>`는
“동적으로 생성된 스크립트”로 보기 애매하다.

관련 명세에서는 이에 대한 명확한 정의를 찾기 어렵다.
따라서 필자는 다음과 같이 **가설적 결론**을 내렸다.

>`nonce`를 가진 신뢰된 스크립트가 `InnerHTML`을 통해
기존 `<script>`의 **Children changed steps**을 트리거했고,
이 과정에서 브라우저는 실행 컨텍스트를 신뢰된 스크립트의 맥락으로 처리했을 가능성이 높다.

---

## 참고자료

- https://www.w3.org/TR/CSP3/#strict-dynamic-usage
- https://content-security-policy.com/strict-dynamic/
- https://github.com/cure53/XSSChallengeWiki/wiki/H5SC-Minichallenge-3:-%22Sh*t,-it%27s-CSP!%22#107-bytes
- https://html.spec.whatwg.org/#parser-inserted
- https://www.w3.org/TR/CSP3/#strict-dynamic-usage
- https://www.w3.org/TR/2014/REC-html5-20141028/scripting-1.html