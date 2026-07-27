+++
date = '2026-06-02T12:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - DOM XSS in jQuery selector sink using a hashchange event'
summary = "location.hash가 jQuery 선택자에 전달되는 DOM XSS를 iframe의 hashchange 이벤트로 자동 트리거하는 풀이"
toc = true
tags = ["XSS", "DOM-Based", "jQuery", "PortSwigger", "Apprentice"]
+++

---

## 문제 분석

> **난이도**: `APPRENTICE`  
> **Lab**: [DOM XSS in jQuery selector sink using a hashchange event](https://portswigger.net/web-security/cross-site-scripting/dom-based/lab-jquery-selector-hash-change-event)

> ![image.png](/writeup/portswigger/xss/06/1.png)

홈 페이지는 URL fragment에 지정된 제목을 찾아 해당 게시글로 자동 스크롤한다. 이 과정에서 `location.hash`가 취약한 버전의 jQuery `$()` 선택자에 전달된다. 피해자의 상호작용 없이 `print()` 함수를 실행하는 익스플로잇을 전달하면 문제가 해결된다.

### DOM XSS 진단

페이지에서 다음 이벤트 핸들러를 확인할 수 있다.

```html
<script>
    $(window).on('hashchange', function() {
        var post = $('section.blog-list h2:contains(' + decodeURIComponent(window.location.hash.slice(1)) + ')');
        if (post) post.get(0).scrollIntoView();
    });
</script>
```

fragment에서 가져온 문자열이 jQuery 선택자 표현식에 직접 연결된다. 취약한 jQuery는 선택자에 포함된 HTML 형태의 문자열을 새로운 요소로 해석할 수 있으므로 다음과 같은 fragment를 주입 지점으로 사용할 수 있다.

```html
#<img src=x onerror=print()>
```

다만 페이지를 처음 열 때 fragment가 이미 존재하면 `hashchange`가 발생하지 않는다. 피해자가 별도의 동작을 하지 않아도 이벤트가 발생하도록 전달 방식을 구성해야 한다.

---

## 익스플로잇

Exploit Server에 다음 HTML을 저장한다.

```html
<iframe
  src="https://<lab-id>.web-security-academy.net/#"
  onload="this.src+='<img src=x onerror=print()>'">
</iframe>
```

iframe은 먼저 빈 fragment인 `#`로 대상 페이지를 로드한다. 로드가 끝나면 `onload` 핸들러가 XSS 벡터를 fragment 뒤에 추가하고, URL fragment가 바뀌면서 `hashchange` 이벤트가 발생한다. 이벤트 핸들러가 공격 문자열을 `$()`에 전달하면 `img` 요소가 생성되고 `onerror`에서 `print()`가 호출된다.

![image.png](/writeup/portswigger/xss/06/2.png)

익스플로잇을 피해자에게 전달하면 문제가 해결된다.

---

## 정리

이 랩의 핵심은 취약한 jQuery 선택자 sink와 이벤트 트리거를 함께 구성하는 것이다. 페이로드가 sink에 도달할 수 있어도 해당 코드가 실행되는 이벤트를 일으킬 수 없다면 실제 공격으로 이어지지 않는다. iframe의 `onload`에서 fragment를 변경하면 사용자 동작 없이 `hashchange`를 발생시킬 수 있다.
