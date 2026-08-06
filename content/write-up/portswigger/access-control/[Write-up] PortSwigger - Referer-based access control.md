+++
date = '2026-07-05T09:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - Referer-based access control'
summary = "관리자 기능이 Referer 헤더로 접근을 판단하는 점을 이용해, 헤더를 /admin으로 위조한 채 자신을 승격시키는 풀이"
toc = true
tags = ["Access Control", "Authorization", "Referer Validation", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [Referer-based access control](https://portswigger.net/web-security/access-control/lab-referer-based-access-control)

> ![image.png](/writeup/portswigger/access-control/13/1.png)

특정 관리자 기능의 접근 제어를 `Referer` 헤더 기반으로 수행한다. 관리자 패널은 `administrator:admin` 계정으로 미리 둘러볼 수 있으며, `wiener:peter` 계정으로 로그인해 접근 제어 결함을 이용해 스스로 관리자가 되면 문제가 해결된다.

### Access Control 진단

관리자 계정으로 패널 기능을 둘러본다.

![image.png](/writeup/portswigger/access-control/13/2.png)

사용자를 선택해 업그레이드·다운그레이드할 수 있으며, 각 요청은 `GET`으로 파라미터를 담아 보낸다.

```http
GET /admin-roles?username=carlos&action=upgrade HTTP/2
Host: <lab-id>.web-security-academy.net
Referer: https://<lab-id>.web-security-academy.net/admin
```

`/admin` 메인 페이지에는 접근 제어가 걸려 있지만, 역할 변경 엔드포인트(`/admin-roles`)는 요청의 `Referer`가 `/admin`인지만 확인한다. 쿠키를 제거하고 요청을 보내면 `"Unauthorized"`가 돌아오지만, **`Referer` 헤더를 `/admin`으로 유지한 채** `wiener` 세션으로 보내면 변경이 정상 수행된다. 권한 판단의 근거가 세션이 아니라 위조 가능한 `Referer`에 있음이 확인된다.

---

## 익스플로잇

`Referer`를 `/admin`으로 둔 채, `wiener` 세션으로 자신을 승격시키는 요청을 구성한다.

```http
GET /admin-roles?username=wiener&action=upgrade HTTP/2
Host: <lab-id>.web-security-academy.net
Cookie: session=<wiener-session>
Referer: https://<lab-id>.web-security-academy.net/admin
```

요청이 정상 처리되어 `wiener`가 관리자로 승격되며, 문제가 해결된다.

![image.png](/writeup/portswigger/access-control/13/3.png)

---

## 정리

이 랩은 접근 제어의 근거를 **클라이언트가 통제하는 값**에 둔 결함이다. 개발자는 `/admin-roles`에 정상적으로 도달하는 요청은 관리자 패널(`/admin`)에서 출발할 테니 `Referer`가 그 증거가 되리라 본 것 같다. 그러나 `Referer`는 브라우저가 붙이는 값일 뿐 서버가 강제할 수 없고, 공격자는 요청을 만들 때 이 헤더를 자유롭게 설정할 수 있다.

이는 CSRF의 [Referer 기반 방어 우회](/write-up/portswigger/csrf/write-up-portswigger---csrf-with-broken-referer-validation/) 랩과 같은 뿌리를 공유한다. `Referer`는 인증이나 인가의 근거가 아니라 참고용 정보이며, 공격자가 통제하는 값을 보안 판단의 기준으로 삼는 순간 그 판단은 무력해진다. 앞선 쿠키·파라미터 랩들이 요청 본문에 실린 값을 신뢰한 것이라면, 이번은 요청 헤더에 실린 값을 신뢰한 것으로, 신뢰의 대상만 다를 뿐 구조는 같다.

주목할 점은 이 방어가 흔적을 남긴다는 것이다. `Referer`를 검사한다는 것은 서버가 그 값을 읽고 있다는 뜻이고, 진단에서는 관리자 기능이 세션만으로는 막히는데 특정 조건에서 통과한다면 `Referer`·`Origin`·커스텀 헤더를 유지·제거·위조해 어떤 값이 판단에 쓰이는지 좁힌다. 여기서는 `Referer`를 `/admin`으로 유지하는 것이 열쇠였다.

방어는 접근 제어를 위조 불가능한 근거, 즉 **서버 세션에 연결된 사용자의 권한**으로만 판단하는 것이다. `Referer`나 `Origin` 같은 헤더는 심층 방어의 보조 신호는 될 수 있어도 단독 근거가 될 수 없다. 접근 제어를 어디에 걸어야 하는지에 대한 정리는 [Access Control Note](/note/note-portswigger---access-control-%ED%86%A0%ED%94%BD-%EC%A0%95%EB%A6%AC-%EB%B0%8F-%EC%8B%A4%EC%8A%B5/)에 담았다.
