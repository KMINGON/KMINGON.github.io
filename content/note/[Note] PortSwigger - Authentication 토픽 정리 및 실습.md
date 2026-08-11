+++
date = '2026-07-12T14:00:00+09:00'
draft = false
title = '[Note] PortSwigger - Authentication 토픽 정리 및 실습'
summary = "인증의 세 가지 요소와 인증·인가의 구분, 취약점이 생기는 두 갈래(취약한 브루트포스 방어·구현 로직 결함), Username 열거·브루트포스·MFA·세션 유지·비밀번호 재설정 등 유형별 우회 경로, 그리고 진단 방법과 대응 방안을 정리한 자료"
toc = true
tags = ["Authentication", "Username Enumeration", "Brute Force", "Multi-Factor Authentication", "PortSwigger"]
+++

---

## 들어가며

Authentication(인증)은 "당신이 주장하는 그 사람이 맞는가"를 확인하는 절차다. 애플리케이션의 정문에 해당하며, 이 문이 뚫리면 그 뒤에 걸려 있던 모든 접근 제어가 함께 무너진다. 그래서 인증은 가장 오래되고 흔한 취약점 영역이면서도, 여전히 실무에서 가장 많이 발견되는 결함이 몰리는 지점이다.

이 글에서는 인증의 세 가지 요소와 인증·인가의 구분, 취약점이 생기는 두 갈래, 실무에서 관찰되는 유형별 우회 경로, 그리고 진단과 대응 방법을 정리한다.  
유형별 Lab 풀이는 별도의 Write-up으로 정리했으며, 본문 곳곳과 마지막에서 연결한다.

![image.png](/note/8/image.png)
*https://portswigger.net/web-security/authentication*

---

## Authentication이란?

인증은 사용자 또는 클라이언트의 신원을 검증하는 과정이다. 웹은 인터넷에 연결된 불특정 다수에게 노출되므로, 신원을 확인하는 메커니즘이 견고하지 않으면 곧바로 계정 탈취로 이어진다.

인증은 아래 세 가지 요소(factor) 중 하나 이상을 근거로 신원을 증명한다.

| 요소 | 근거 | 예시 |
| --- | --- | --- |
| 지식(Knowledge) | 사용자가 **아는 것** | 비밀번호, 보안 질문의 답 |
| 소유(Possession) | 사용자가 **가진 것** | 휴대폰, 하드웨어 토큰, OTP 생성기 |
| 존재(Inherence) | 사용자 **그 자체·행동** | 지문·홍채 같은 생체정보, 행동 패턴 |

하나의 요소만 쓰면 단일 인증(SFA), 서로 다른 종류의 요소를 둘 이상 결합하면 다단계 인증(MFA)이다. "비밀번호 + OTP"처럼 **지식과 소유를 함께** 요구하면, 한쪽이 유출돼도 나머지 하나가 남아 방어선이 이중이 된다.

### 인증과 인가

인증(Authentication)과 인가(Authorization)는 자주 뭉뚱그려지지만 다른 질문에 답한다.

| 구분 | 질문 | 역할 |
| --- | --- | --- |
| 인증(Authentication) | 당신은 누구인가? | `Carlos123`을 쓰는 사람이 실제 그 계정 주인인지 확인 |
| 인가(Authorization) | 그 행위를 할 권한이 있는가? | 확인된 사용자가 무엇을 할 수 있는지 결정 |

인증이 먼저고 인가가 그 위에 선다. 누구인지 확정돼야 무엇을 허용할지 정할 수 있기 때문이다. 인가 쪽 결함은 [Access Control Note](/note/note-portswigger---access-control-%ED%86%A0%ED%94%BD-%EC%A0%95%EB%A6%AC-%EB%B0%8F-%EC%8B%A4%EC%8A%B5/)에서 별도로 정리했으며, 이 글은 "정문"인 인증 자체가 뚫리는 경로를 다룬다.

---

## 인증 취약점은 왜 위험한가

인증이 무너지면 피해는 탈취된 계정의 권한을 그대로 따른다. 일반 사용자 계정이면 그 사용자의 데이터와 기능이 열리고, 관리자 계정이면 애플리케이션 전체의 통제권과 그 너머 인프라까지 넘어간다. 낮은 권한 계정이라도 그 자체로 민감정보가 노출되고, 다른 공격의 발판(공격 표면 확대)이 된다.

인증 취약점이 특히 위험한 이유는 **성공하면 곧바로 정당한 사용자로 위장**된다는 점이다. 이후 요청은 모두 "인증된 요청"으로 처리되므로, 접근 제어가 아무리 잘 설계돼 있어도 그 검사를 정상적으로 통과한다.

---

## 취약점은 어디서 생기는가

PortSwigger는 인증 취약점의 발생 원인을 크게 두 갈래로 정리한다.

1. **브루트포스 방어가 취약한 경우.** 메커니즘 자체는 정상 동작하지만, 무차별 대입을 충분히 막지 못해 공격자가 자격증명을 알아낸다.
2. **구현의 로직 결함·부실한 코딩.** 인증 절차를 통째로 **우회**할 수 있는 논리적 허점이 있다.

이 두 갈래는 진단의 방향을 가른다. 앞쪽은 "얼마나 많은 시도를 얼마나 빠르게 던질 수 있는가"의 문제이고, 뒤쪽은 "정해진 절차를 건너뛰거나 비틀 수 있는가"의 문제다. 아래 유형들도 이 기준으로 읽으면 정리가 쉽다.

---

## 취약점 유형과 우회

### 1. 비밀번호 기반 로그인

가장 흔한 인증 방식이자 가장 많은 결함이 몰리는 지점이다. 공격은 대개 **유효한 username을 특정**하고 → **그 계정의 비밀번호를 브루트포스**하는 2단계로 진행된다.

#### Username 열거 (enumeration)

존재하는 계정과 존재하지 않는 계정에 대해 애플리케이션의 **반응이 조금이라도 다르면**, 그 차이로 유효한 username 목록을 좁힐 수 있다. 차이는 여러 형태로 샌다.

| 신호 | 관찰 포인트 | 관련 실습 |
| --- | --- | --- |
| 응답 메시지 차이 | `Invalid username` vs `Incorrect password` | [different responses](/write-up/portswigger/authentication/write-up-portswigger---username-enumeration-via-different-responses/) |
| 미묘한 문구 차이 | 마침표 유무·공백 등 사람 눈엔 안 띄는 차이 | [subtly different responses](/write-up/portswigger/authentication/write-up-portswigger---username-enumeration-via-subtly-different-responses/) |
| 응답 시간 차이 | 유효 계정에서만 비밀번호 해시 검증이 돌아 지연 발생 | [response timing](/write-up/portswigger/authentication/write-up-portswigger---username-enumeration-via-response-timing/) |
| 계정 잠금 반응 | 존재하는 계정만 여러 번 실패 시 잠금 메시지 노출 | [account lock](/write-up/portswigger/authentication/write-up-portswigger---username-enumeration-via-account-lock/) |

핵심은 **상태를 드러내는 관찰 가능한 차이**다. 메시지가 같아도 응답 길이가 2바이트 다르거나, HTTP 상태 코드·리다이렉트·응답 시간이 다르면 그 신호가 곧 열거 통로가 된다. Burp Intruder나 Turbo Intruder로 후보 목록을 던지고 응답 길이·상태·시간으로 정렬하면 이상치(anomaly)가 드러난다.

#### 비밀번호 브루트포스와 방어 우회

유효한 username을 얻었으면 비밀번호를 대입한다. 흔한 비밀번호 목록·규칙 기반 후보로 대부분의 약한 계정이 뚫린다. 그래서 애플리케이션은 브루트포스를 막으려 하지만, 그 방어 로직 자체에 결함이 있는 경우가 많다.

| 방어 방식 | 결함·우회 | 관련 실습 |
| --- | --- | --- |
| IP 기반 요청 제한 | 중간에 로그인 성공하면 실패 카운터 초기화 → 실패·성공을 섞어 회피 | [IP block](/write-up/portswigger/authentication/write-up-portswigger---broken-brute-force-protection-ip-block/) |
| 요청당 자격증명 1개 가정 | `password` 필드에 배열로 여러 값을 한 번에 전송 | [multiple credentials](/write-up/portswigger/authentication/write-up-portswigger---broken-brute-force-protection-multiple-credentials-per-request/) |
| 계정 잠금 | 잠금 상태에서도 응답 차이가 남아 유효 비밀번호 식별 가능 | [account lock](/write-up/portswigger/authentication/write-up-portswigger---username-enumeration-via-account-lock/) |
| 비밀번호 변경 기능 | 로그인이 아닌 변경 폼이 현재 비밀번호를 검증하며 응답을 흘림 | [via password change](/write-up/portswigger/authentication/write-up-portswigger---password-brute-force-via-password-change/) |

`X-Forwarded-For` 헤더는 IP 기반 제한을 우회하는 첫 번째 시도지만, 서버가 이 헤더를 신뢰하지 않으면 통하지 않는다. 그럴 땐 방어 로직의 **가정 자체를 깬다.** "성공하면 카운터가 초기화된다", "요청당 비밀번호는 하나다", "브루트포스는 로그인 엔드포인트에서만 일어난다" 같은 암묵적 전제가 우회의 재료다.

> HTTP Basic 인증은 `Authorization: Basic` 헤더에 base64로 인코딩된 자격증명을 매 요청에 실어 보낸다. 인코딩은 암호화가 아니므로 평문과 다를 바 없고, 대개 세션·CSRF·브루트포스 방어와 무관하게 동작해 별도의 결함을 얹는다. (해당 토픽의 Lab은 이번 정리 범위에 포함하지 않았다.)

### 2. 다단계 인증 (MFA)

MFA는 비밀번호가 뚫려도 두 번째 요소가 남아 방어선을 하나 더 세운다. 그러나 두 번째 요소를 **검증하는 방식**에 결함이 있으면 그 방어선은 이름뿐이다.

| 유형 | 결함 | 관련 실습 |
| --- | --- | --- |
| 단계 건너뛰기 | 1단계 후 2단계를 거치지 않고 인증 이후 페이지로 직행 | [2FA simple bypass](/write-up/portswigger/authentication/write-up-portswigger---2fa-simple-bypass/) |
| 검증 로직 결함 | 2단계 코드가 세션이 아닌 쿠키 값(`verify=user`)에 묶여 다른 사용자로 위조 | [2FA broken logic](/write-up/portswigger/authentication/write-up-portswigger---2fa-broken-logic/) |
| 코드 브루트포스 | 4자리 숫자 코드에 시도 제한이 없어 전수 대입 | [2FA brute-force](/write-up/portswigger/authentication/write-up-portswigger---2fa-bypass-using-a-brute-force-attack/) |

MFA 결함의 공통 원인은 **"두 번째 요소가 첫 번째 요소를 통과한 바로 그 사용자에게 발급·검증되는가"**를 서버가 제대로 묶지 않은 것이다. 2단계 코드를 세션이 아니라 클라이언트가 통제하는 값(쿠키·파라미터)에 연결하거나, 2단계를 통과하지 않아도 최종 리소스에 접근이 되거나, 코드에 시도 제한이 없으면 — MFA는 우회된다.

### 3. 그 밖의 인증 메커니즘

로그인 자체가 아니라 그 주변 기능에서 인증이 뚫리는 경우다. 이쪽이 오히려 실무에서 더 자주 노출된다.

#### 세션 유지 (stay logged in)

"로그인 상태 유지"는 브라우저를 닫아도 유지되는 장기 쿠키로 구현된다. 이 쿠키가 **예측·위조 가능한 값**으로 만들어지면 그대로 계정 탈취로 이어진다.

- 쿠키가 `base64(username:md5(password))`처럼 자격증명에서 유도되면, 후보 비밀번호를 같은 방식으로 인코딩해 브루트포스할 수 있다. → [stay-logged-in cookie](/write-up/portswigger/authentication/write-up-portswigger---brute-forcing-a-stay-logged-in-cookie/)
- 같은 쿠키에 XSS가 결합되면, 오프라인에서 해시를 크랙해 평문 비밀번호까지 복원한다. → [offline password cracking](/write-up/portswigger/authentication/write-up-portswigger---offline-password-cracking/)

#### 비밀번호 재설정 (password reset)

비밀번호를 아예 모르는 상태에서 계정을 되찾는 기능이라, 인증의 "우회로"가 되기 쉽다.

| 유형 | 결함 | 관련 실습 |
| --- | --- | --- |
| 재설정 로직 결함 | 재설정 요청 파라미터의 username을 타인으로 바꿔 그 계정 비밀번호를 변경 | [reset broken logic](/write-up/portswigger/authentication/write-up-portswigger---password-reset-broken-logic/) |
| 재설정 포이즈닝 | `X-Forwarded-Host`로 재설정 링크의 도메인을 공격자 서버로 바꿔 토큰 탈취 | [reset poisoning](/write-up/portswigger/authentication/write-up-portswigger---password-reset-poisoning-via-middleware/) |

재설정 토큰이 아무리 강력해도, **토큰이 어디로 전달되는지**나 **누구의 계정에 적용되는지**를 공격자가 통제할 수 있으면 토큰의 강도는 무의미해진다.

#### 비밀번호 변경 (change password)

로그인된 사용자가 비밀번호를 바꾸는 기능이지만, 현재 비밀번호를 검증하는 과정에서 응답이 유효 여부에 따라 갈리면 그 자체가 브루트포스 오라클이 된다. → [password brute-force via change](/write-up/portswigger/authentication/write-up-portswigger---password-brute-force-via-password-change/)

---

## 진단 방법

진단은 다음 순서로 진행한다.

1. **인증 표면을 목록화한다.** 로그인뿐 아니라 회원가입·비밀번호 재설정·비밀번호 변경·"로그인 유지"·MFA까지, 인증과 연관된 모든 엔드포인트를 모은다.
2. **Username 열거를 시도한다.** 유효·무효 계정에 대한 응답의 **메시지·길이·상태 코드·리다이렉트·응답 시간·잠금 반응** 차이를 관찰한다. 후보 목록을 던져 이상치를 정렬한다.
3. **브루트포스와 방어 로직을 점검한다.** 몇 번 실패 시 어떤 제한이 걸리는지, 그 제한이 IP·계정·세션 중 무엇을 기준으로 하는지 확인하고, `X-Forwarded-For`·성공 요청 삽입·다중 값 전송·엔드포인트 전환으로 우회를 시도한다.
4. **MFA를 검증한다.** 2단계를 거치지 않고 이후 페이지에 접근되는지, 2단계 코드가 세션에 묶여 있는지(쿠키·파라미터 위조), 코드에 시도 제한이 있는지 본다.
5. **주변 기능을 점검한다.** "로그인 유지" 쿠키를 디코딩해 구조를 분석하고, 재설정 요청의 username 파라미터·`Host`/`X-Forwarded-Host` 헤더, 변경 폼의 응답 분기를 확인한다.

각 단계의 판단 기준과 다음 시도는 [Authentication Playbook](/playbook/playbook-authentication-%EC%A7%84%EB%8B%A8-cheat-sheet/)에 표로 정리했다.

> 인증 진단은 실제 계정의 비밀번호·세션 상태를 바꾼다. 승인된 테스트 환경과 실습에서만, 본인 계정과 되돌릴 수 있는 대상으로 검증한다.

---

## 대응 방안

- **관찰 가능한 차이를 없앤다.** 로그인 실패 응답은 username 유효 여부와 무관하게 **동일한 메시지·길이·상태·시간**으로 반환한다. 유효 계정에서만 비밀번호 해시 검증이 돌아 생기는 시간 차이도 상수 시간 비교로 제거한다.
- **브루트포스를 실효적으로 막는다.** IP뿐 아니라 계정 단위로도 시도를 제한하고, 성공이 실패 카운터를 무효화하지 못하게 한다. CAPTCHA·점증 지연을 병행하고, 요청당 자격증명이 하나임을 서버가 강제한다.
- **MFA를 세션에 단단히 묶는다.** 두 번째 요소는 첫 번째 요소를 통과한 바로 그 세션에만 발급·검증하고, 클라이언트가 통제하는 값(쿠키·파라미터)에 신원을 싣지 않는다. 코드에도 시도 제한을 건다.
- **인증 절차를 건너뛸 수 없게 한다.** 각 단계의 완료 상태를 서버 세션에 저장하고, 이후 단계는 앞 단계가 실제로 완료됐는지 검증한다.
- **주변 기능을 본체만큼 지킨다.** "로그인 유지" 토큰은 자격증명에서 유도하지 말고 추측 불가능한 난수로 발급한다. 재설정 링크의 도메인은 요청 헤더가 아니라 **서버 설정값**으로 생성하고, 토큰은 일회성·단기 만료로 한다.

핵심은 두 가지다. 첫째, **인증의 근거를 클라이언트가 통제할 수 없는 값에만 둔다.** 쿠키·헤더·파라미터로 실려 온 신원·상태는 모두 위조 대상이다.  
둘째, **인증을 로그인 폼 하나로 좁게 보지 않는다.** 재설정·변경·세션 유지·MFA까지 인증 표면 전체에서 같은 강도를 유지해야, 한 곳의 허점으로 정문 전체가 열리는 일을 막는다.

---

## 실습

PortSwigger Web Security Academy의 Authentication 랩을 유형별로 풀어 정리했다.  
각 랩의 상세 풀이는 Write-up으로 별도 정리했으며, 아래는 유형별 개요다.

| 유형 | 대표 Lab | 난이도 |
| --- | --- | --- |
| Username 열거 | different / subtly different / response timing / account lock | APPRENTICE–PRACTITIONER |
| 브루트포스 방어 우회 | IP block / multiple credentials per request | PRACTITIONER–EXPERT |
| 다단계 인증(MFA) | 2FA simple bypass / broken logic / brute-force | APPRENTICE–EXPERT |
| 세션 유지 | Brute-forcing a stay-logged-in cookie / Offline password cracking | PRACTITIONER |
| 비밀번호 재설정 | Password reset broken logic / poisoning via middleware | APPRENTICE–PRACTITIONER |
| 비밀번호 변경 | Password brute-force via password change | PRACTITIONER |

전체 풀이는 [Authentication Write-up 아카이브](/write-up/portswigger/authentication/)에서 확인할 수 있다.

---

## 마치며

이 글에서는 인증의 세 가지 요소와 인증·인가의 구분, 취약점이 생기는 두 갈래, Username 열거·브루트포스·MFA·세션 유지·비밀번호 재설정 등 유형별 우회 경로, 진단과 대응 방법을 정리했다.

인증 취약점을 관통하는 교훈은 두 가지로 모인다. 하나는 애플리케이션이 **의도치 않게 흘리는 차이**다. 메시지 한 줄, 응답 시간 몇 밀리초, 잠금 반응 하나가 유효한 계정을 특정하는 신호가 된다. 다른 하나는 **인증의 근거를 클라이언트에 맡긴 순간** 그 근거가 위조된다는 점이다. 2단계 코드를 쿠키에 싣고, 재설정 도메인을 헤더로 정하고, 세션 토큰을 비밀번호 해시로 만드는 것 — 모두 통제권을 공격자에게 넘기는 설계다.

방어의 방향은 그래서 하나다. 인증의 모든 표면에서 **관찰 가능한 차이를 지우고, 신원과 상태를 위조 불가능한 서버 세션에만 두는 것.** 이 글이 Authentication을 학습하거나 진단을 준비하는 과정에서 하나의 참고 자료로 활용되기를 바란다.

---

> 참고자료  
> https://portswigger.net/web-security/authentication  
> https://portswigger.net/web-security/authentication/securing  
> https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/  
> https://cwe.mitre.org/data/definitions/287.html
