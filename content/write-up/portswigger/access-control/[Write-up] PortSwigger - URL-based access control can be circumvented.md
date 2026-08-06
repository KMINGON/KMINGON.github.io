+++
date = '2026-07-04T12:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - URL-based access control can be circumvented'
summary = "프런트엔드가 /admin 접근을 차단하지만 백엔드가 X-Original-URL 헤더를 신뢰하는 점을 이용해 관리자 기능을 우회하는 풀이"
toc = true
tags = ["Access Control", "Authorization", "Filter Bypass", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [URL-based access control can be circumvented](https://portswigger.net/web-security/access-control/lab-url-based-access-control-can-be-circumvented)

> ![image.png](/writeup/portswigger/access-control/10/1.png)

`/admin`에 인증 없이 접근 가능한 관리자 패널이 존재하지만, 프런트엔드가 해당 경로로의 외부 접근을 차단하도록 구성되어 있다. 다만 백엔드는 `X-Original-URL` 헤더를 지원하는 프레임워크로 구축되어 있다. 이를 이용해 관리자 패널에서 `carlos` 사용자를 삭제하면 문제가 해결된다.

### Access Control 진단

먼저 `/admin`에 직접 접근을 시도하면 차단 응답이 돌아온다.

```http
HTTP/2 403 Forbidden
Content-Type: application/json; charset=utf-8
X-Frame-Options: SAMEORIGIN
Content-Length: 15

"Access denied"
```

이 차단은 백엔드가 아니라 앞단(프런트엔드 프록시)이 요청 URL의 경로를 보고 거는 것이다. 문제에서 백엔드가 `X-Original-URL` 헤더를 지원한다고 했으므로, **프런트엔드가 보는 경로와 백엔드가 처리하는 경로를 분리**할 수 있다. 요청 라인의 경로는 `/`로 두어 프런트엔드의 차단을 피하고, 실제 목적지는 헤더에 담는다.

```http
GET / HTTP/2
Host: <lab-id>.web-security-academy.net
X-Original-URL: /admin
```

프런트엔드는 경로가 `/`이므로 통과시키고, 백엔드는 `X-Original-URL` 값을 실제 요청 경로로 해석해 관리자 패널을 반환한다.

![image.png](/writeup/portswigger/access-control/10/2.png)

### 삭제 요청

패널에서 사용자 삭제를 누르면 실제 삭제 경로(`/admin/delete`)로 요청이 나가는데, 이 경로 역시 프런트엔드가 차단한다. 삭제 대상은 쿼리 파라미터로, 경로는 다시 `X-Original-URL`로 전달한다.

```http
GET /?username=carlos HTTP/2
Host: <lab-id>.web-security-academy.net
X-Original-URL: /admin/delete
```

---

## 익스플로잇

위 요청을 전송하면 백엔드가 `/admin/delete?username=carlos`로 해석해 `carlos`를 삭제하고, 문제가 해결된다.

![image.png](/writeup/portswigger/access-control/10/3.png)

---

## 정리

이 랩의 결함은 접근 제어를 **엉뚱한 계층에** 둔 데서 온다. 관리자 패널 자체(백엔드)에는 권한 검사가 없고, 대신 그 앞의 프런트엔드가 요청 경로 문자열이 `/admin`으로 시작하는지만 보고 차단한다. 두 계층이 요청을 서로 다르게 해석할 수 있다면, 공격자는 그 틈을 파고들어 한쪽은 통과시키고 다른 쪽에는 원하는 경로를 전달한다.

`X-Original-URL`(과 `X-Rewrite-URL`)은 원래 리버스 프록시 뒤에서 원본 경로를 백엔드에 전달하려고 만들어진 헤더다. 백엔드가 이 헤더를 요청 경로보다 우선해 신뢰하면, 클라이언트가 그 값을 직접 지정해 프런트엔드의 경로 기반 규칙을 통째로 무력화할 수 있다. 프런트엔드는 요청 라인의 `/`만 보고, 백엔드는 헤더의 `/admin`을 처리하는 것이다.

이는 Path Traversal의 이중 인코딩이나 request smuggling과 같은 계열의 문제다 — **하나의 요청을 두 컴포넌트가 다르게 해석**할 때 그 사이에서 우회가 성립한다. 진단에서는 `403`으로 차단되는 관리자 경로를 만나면 `X-Original-URL`·`X-Rewrite-URL`에 그 경로를 담아 요청 라인은 무해하게 두고 보내 보거나, 대소문자(`/ADMIN`)·후행 슬래시·`.` 접미사 같은 URL 매칭 불일치를 함께 시도한다.

방어는 접근 제어를 프런트엔드의 경로 필터가 아니라 **기능을 실제로 수행하는 백엔드에서** 일관되게 적용하는 것이다. 그리고 애플리케이션이 필요로 하지 않는 `X-Original-URL` 같은 재작성 헤더는 신뢰하지 않아야 한다. 접근 제어를 걸어야 할 계층에 대한 논의는 [Access Control Note](/note/note-portswigger---access-control-%ED%86%A0%ED%94%BD-%EC%A0%95%EB%A6%AC-%EB%B0%8F-%EC%8B%A4%EC%8A%B5/)에 정리했다.
