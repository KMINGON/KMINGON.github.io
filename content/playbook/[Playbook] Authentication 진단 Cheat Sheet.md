+++
date = '2026-08-11T09:00:00+09:00'
draft = false
title = '[Playbook] Authentication 진단 Cheat Sheet'
summary = "Authentication 진단 중 인증 표면 어디에 관찰 가능한 차이가 새는지, 어떤 방어가 어떤 조건에서 우회되는지 빠르게 판별하고 다음 시도를 선택하기 위한 Playbook"
toc = true
tags = ["Authentication", "Username Enumeration", "Playbook", "Cheat Sheet", "Testing Workflow"]
+++

---

이 문서는 Authentication 진단 중 **인증 표면 어디에 관찰 가능한 차이가 새고, 어떤 방어가 어떤 조건에서 우회되는지 판별해 다음 시도를 고르기 위한 빠른 참고서**다. 유형별 상세 원리와 전체 풀이는 관련 Write-up과 [Authentication Note](/note/note-portswigger---authentication-%ED%86%A0%ED%94%BD-%EC%A0%95%EB%A6%AC-%EB%B0%8F-%EC%8B%A4%EC%8A%B5/)로 연결한다.

> 승인된 테스트 환경과 실습에서만 사용한다. 인증 진단은 성공하는 순간 실제 계정의 비밀번호·세션 상태를 바꾸므로(비밀번호 재설정·변경, 세션 탈취), 되돌릴 수 있는 대상과 본인 계정으로만 검증하고 브루트포스·계정 잠금 같은 파괴적·서비스 영향 행위는 실습 환경에 한정한다.

## 30초 진단 흐름

1. 인증 표면을 목록화한다 — 로그인·회원가입·비밀번호 재설정·비밀번호 변경·"로그인 유지"·MFA.
2. 유효·무효 계정의 실패 응답을 나란히 놓고 **메시지·길이·상태 코드·리다이렉트·응답 시간·잠금 반응**의 차이를 본다.
3. 브루트포스를 시도하며 **몇 회에 무엇으로 막히는지**(IP·계정·세션) 확인하고 우회를 고른다.
4. MFA는 **건너뛰기 → 세션 결합 → 시도 제한** 순으로 깬다.
5. 재설정·변경·세션 유지 쿠키 등 **주변 기능**을 로그인만큼 파고든다.

| 관찰 결과 | 판단 | 다음 단계 |
| --- | --- | --- |
| 실패 메시지가 `Invalid username` vs `Incorrect password` | 응답 기반 열거 | username 후보로 응답 분기 정렬 |
| 메시지 같은데 길이·문구가 미세하게 다름 | 미묘한 응답 차이 | Anomaly Rank·길이로 이상치 탐색 |
| 메시지·길이 동일 | 타이밍 채널 의심 | 긴 비밀번호 고정 후 TTFB 비교 |
| 반복 실패 시 특정 계정만 잠김 | 잠금 반응 열거 | 계정별 N회 시도로 잠금 유도 |
| N회 실패 후 차단, 세션 바꿔도 지속 | IP 기반 rate limit | `X-Forwarded-For` → 성공 삽입 → 다중 값 |
| 로그인이 JSON | 다중 자격증명 가능성 | `password`에 배열로 후보 일괄 전송 |
| 2FA 화면에서 이후 페이지 직접 접근됨 | 2단계 미강제 | 코드 없이 `/my-account` 접근 |
| 2FA 대상이 쿠키/파라미터에 있음 | 세션 미결합 | `verify` 값 치환·세션 제거 후 시도 |
| 2FA 코드가 4자리 + 시도 제한 없음 | 코드 브루트포스 | 0000–9999 전수(상태 체인 필요 시 구성) |
| 재설정/변경 본문에 `username` | 대상 파라미터화 | 타인으로 치환해 적용 여부 확인 |
| 재설정 링크 도메인이 헤더로 바뀜 | reset poisoning | `X-Forwarded-Host`에 공격자 호스트 |
| `stay-logged-in` 쿠키가 base64/해시 | 유도형 토큰 | 디코딩 후 구조 분석·재현 |

## 1. 인증 표면 목록화

먼저 검증이 있어야 할 지점을 나눠 정리한다. 인증은 로그인 폼 하나가 아니다.

| 구분 | 후보 기능 | 확인 포인트 |
| --- | --- | --- |
| 로그인 | username/password, HTTP Basic | 실패 응답이 유효 여부로 갈리는가 |
| 다단계(MFA) | 2FA 코드 입력 | 세션에 묶여 강제되는가 |
| 세션 유지 | "로그인 상태 유지" 쿠키 | 값이 난수인가, 자격증명 유도인가 |
| 재설정 | Forgot password | 대상·토큰 전달 경로를 통제 가능한가 |
| 변경 | Change password | 현재 비밀번호 검증이 응답을 흘리는가 |

- 실습 계정(`wiener:peter` 등)이 주어지면 먼저 정상 흐름을 관찰해 각 요청의 원본을 확보한다.
- 대상 계정(`carlos`)에 대한 파괴적 시도 전에, 본인 계정으로 로직을 먼저 재현한다.

## 2. Username 열거

유효·무효 계정의 실패 응답에서 **관찰 가능한 차이**를 찾는다. 신호는 여러 채널로 샌다.

| 채널 | 관찰 방법 | 관련 실습 |
| --- | --- | --- |
| 메시지 분기 | `Invalid username` vs `Incorrect password` | [different responses](/write-up/portswigger/authentication/write-up-portswigger---username-enumeration-via-different-responses/) |
| 미묘한 차이 | 마침표·공백·길이, Turbo Intruder Anomaly Rank | [subtly different](/write-up/portswigger/authentication/write-up-portswigger---username-enumeration-via-subtly-different-responses/) |
| 응답 시간 | 긴 비밀번호 고정 후 TTFB 정렬 | [response timing](/write-up/portswigger/authentication/write-up-portswigger---username-enumeration-via-response-timing/) |
| 잠금 반응 | 계정별 N회 실패로 잠금 유도 후 응답 비교 | [account lock](/write-up/portswigger/authentication/write-up-portswigger---username-enumeration-via-account-lock/) |

- 한 번의 시도로 응답이 같아도 포기하지 않는다. **반복**(잠금 유도)이나 **타이밍**으로 차이가 드러날 수 있다.
- 열거가 되면 대상을 그 계정으로 좁히고 password 브루트포스로 넘어간다.

## 3. 비밀번호 브루트포스 · 방어 우회

rate limit을 만나면 **차단 후 우회 → 차단 전 리셋 → 요청당 다중 시도** 순으로 본다.

| 시도 | 통하면 | 방향 | 관련 실습 |
| --- | --- | --- | --- |
| `X-Forwarded-For` 위조 | 헤더 신뢰형 IP 제한 | 매 요청 다른 IP 값 | [response timing](/write-up/portswigger/authentication/write-up-portswigger---username-enumeration-via-response-timing/) |
| 성공 요청 삽입 | 성공이 카운터 초기화 | 실패 N회마다 본인 성공 1회 | [IP block](/write-up/portswigger/authentication/write-up-portswigger---broken-brute-force-protection-ip-block/) |
| 배열 다중 값 | 요청 단위로만 계수 | JSON `password`에 후보 일괄 | [multiple credentials](/write-up/portswigger/authentication/write-up-portswigger---broken-brute-force-protection-multiple-credentials-per-request/) |
| 다른 엔드포인트 | 로그인 밖의 검증 경로 | 변경 폼을 오라클로 사용 | [via password change](/write-up/portswigger/authentication/write-up-portswigger---password-brute-force-via-password-change/) |
| 잠금 중 응답 차이 | 잠금이 검증을 안 막음 | 잠긴 상태로 후보 대입 | [account lock](/write-up/portswigger/authentication/write-up-portswigger---username-enumeration-via-account-lock/) |

- `X-Forwarded-For`가 막히면 방어의 **가정**을 깬다 — "성공은 정상", "요청당 1시도", "브루트포스는 로그인에서만".
- 순서가 중요한 우회(성공 삽입)는 Turbo Intruder `concurrentConnections=1`로 실행 순서를 보장한다.

## 4. 다단계 인증 (MFA)

MFA는 세 층위로 무너진다. 위에서부터 시도한다.

| 시도 | 확인할 것 | 관련 실습 |
| --- | --- | --- |
| 단계 건너뛰기 | 2FA 화면에서 코드 없이 `/my-account` 접근되는가 | [2FA simple bypass](/write-up/portswigger/authentication/write-up-portswigger---2fa-simple-bypass/) |
| 세션 결합 확인 | 대상이 쿠키·파라미터(`verify=user`)에 있는가, 세션 없이 통과되는가 | [2FA broken logic](/write-up/portswigger/authentication/write-up-portswigger---2fa-broken-logic/) |
| 코드 브루트포스 | 4자리 코드에 시도 제한이 없는가 | [2FA brute-force](/write-up/portswigger/authentication/write-up-portswigger---2fa-bypass-using-a-brute-force-attack/) |

- 대상이 쿠키에 있으면 남의 계정으로 코드 발급을 유도할 수 있다(`verify=carlos`로 `/login2` 호출).
- 매 시도 CSRF 갱신·세션 무효화가 걸리면 **상태 머신**으로 재로그인→CSRF 재확보→다음 코드를 자동 연쇄한다. CSRF 갱신은 브루트포스 방어가 아니다.

## 5. 세션 유지 · 재설정 · 변경

로그인 주변 기능이 오히려 더 자주 뚫린다.

| 기능 | 시도 | 관련 실습 |
| --- | --- | --- |
| 세션 유지 쿠키 | 디코딩해 구조 분석, 자격증명 유도면 재현·브루트포스 | [stay-logged-in cookie](/write-up/portswigger/authentication/write-up-portswigger---brute-forcing-a-stay-logged-in-cookie/) |
| 세션 유지 + XSS | 쿠키 탈취 후 오프라인 해시 크랙 | [offline cracking](/write-up/portswigger/authentication/write-up-portswigger---offline-password-cracking/) |
| 재설정 로직 | 본문 `username`을 타인으로 치환 | [reset broken logic](/write-up/portswigger/authentication/write-up-portswigger---password-reset-broken-logic/) |
| 재설정 포이즈닝 | `X-Forwarded-Host`로 링크 도메인 탈취 | [reset poisoning](/write-up/portswigger/authentication/write-up-portswigger---password-reset-poisoning-via-middleware/) |
| 변경 폼 | 새 비밀번호 불일치 + 현재 비밀번호 정오 분기 | [via password change](/write-up/portswigger/authentication/write-up-portswigger---password-brute-force-via-password-change/) |

- `stay-logged-in`처럼 base64가 보이면 무조건 디코딩한다. `username:md5(password)` 구조면 온라인 브루트포스·오프라인 크랙 둘 다 가능하다.
- 재설정 토큰이 강력해도 **대상**(파라미터)이나 **전달 경로**(Host 헤더)를 통제할 수 있으면 무력화된다.

## 6. 특수 · 예외 상황

아래 항목은 일반 흐름에 맞지 않을 때만 확인한다.

| 상황 | 짧은 판단 기준 | 관련 글 |
| --- | --- | --- |
| `Host` 변경 시 `Invalid host` | 비표준 `X-Forwarded-Host`로 우회 | [reset poisoning](/write-up/portswigger/authentication/write-up-portswigger---password-reset-poisoning-via-middleware/) |
| 쿠키 `HttpOnly` 없음 | XSS로 탈취 가능 → 세션 사슬 | [offline cracking](/write-up/portswigger/authentication/write-up-portswigger---offline-password-cracking/) |
| 로그인이 JSON | 배열·중복 필드로 다중 시도 | [multiple credentials](/write-up/portswigger/authentication/write-up-portswigger---broken-brute-force-protection-multiple-credentials-per-request/) |
| 각 시도가 이전 응답에 의존 | 상태 머신 스크립트 필요 | [2FA brute-force](/write-up/portswigger/authentication/write-up-portswigger---2fa-bypass-using-a-brute-force-attack/) |
| 완벽해 보이는데 XSS 있음 | 같은 출처에서 세션·자격증명 탈취 | [XSS Playbook](/playbook/playbook-xss-%EC%A7%84%EB%8B%A8-cheat-sheet/) |

## Quick Checklist

- [ ] 인증 표면을 로그인·MFA·세션 유지·재설정·변경으로 나눠 목록화했는가?
- [ ] 유효·무효 계정의 실패 응답을 메시지·길이·상태·시간으로 비교했는가?
- [ ] 한 번에 안 되는 열거를 반복(잠금)·타이밍으로 다시 시도했는가?
- [ ] rate limit을 만나면 `X-Forwarded-For`·성공 삽입·다중 값·다른 엔드포인트를 모두 봤는가?
- [ ] 2FA를 건너뛰기·세션 결합·시도 제한 순으로 점검했는가?
- [ ] 2FA 대상이 쿠키·파라미터에 실려 있지는 않은가?
- [ ] `stay-logged-in` 등 인증 쿠키를 디코딩해 구조를 분석했는가?
- [ ] 재설정·변경 요청의 `username` 파라미터와 `Host`/`X-Forwarded-Host`를 확인했는가?
- [ ] 각 시도가 이전 응답에 의존하면 상태 머신으로 연쇄했는가?
- [ ] 파괴적·서비스 영향 행위를 실습 환경·본인 계정으로 한정했는가?
