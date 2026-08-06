+++
date = '2026-07-07T10:00:00+09:00'
draft = false
title = '[Playbook] Access Control 진단 Cheat Sheet'
summary = "Access Control 진단 중 어떤 접근면에 검증이 빠져 있는지 빠르게 판별하고 다음 우회 시도를 선택하기 위한 Playbook"
toc = true
tags = ["Access Control", "Authorization", "Playbook", "Cheat Sheet", "Testing Workflow"]
+++

---

이 문서는 Access Control 진단 중 **어떤 접근면에 권한 검사가 빠져 있고, 그 검사가 어느 조건에만 걸려 있는지 판별해 다음 시도를 고르기 위한 빠른 참고서**다. 유형별 상세 원리와 전체 풀이는 관련 Write-up과 [Access Control Note](/note/note-portswigger---access-control-%ED%86%A0%ED%94%BD-%EC%A0%95%EB%A6%AC-%EB%B0%8F-%EC%8B%A4%EC%8A%B5/)로 연결한다.

> 승인된 테스트 환경과 실습에서만 사용한다. 접근 제어 결함은 성공하는 순간 실제 계정·데이터의 상태가 바뀌므로(사용자 삭제, 역할 변경, 타인 데이터 열람), 되돌릴 수 있는 대상과 본인 계정으로만 검증하고 파괴적 행위(삭제·권한 부여)는 실습 환경에 한정한다.

## 30초 진단 흐름

1. 접근면을 수직(관리자·내부 기능)과 수평(사용자별 리소스)으로 나눠 목록화한다.
2. 링크되지 않은 기능을 `robots.txt`·JS 소스·강제 브라우징으로 찾는다.
3. 권한성 값(쿠키·파라미터·헤더)을 하나씩 **변조 → 삭제 → 치환**한다.
4. 막히면 조건을 바꾼다 — 메서드, URL 재작성 헤더, `Referer`, 단계 순서.
5. 리다이렉트·에러 응답은 상태 코드가 아니라 **본문**까지 확인한다.

| 관찰 결과 | 판단 | 다음 단계 |
| --- | --- | --- |
| `robots.txt`·JS에 관리자 경로 노출 | 미보호 기능 | 경로 직접 접근 |
| 응답에 `Admin`·`role` 값 존재 | 파라미터 기반 역할 | 값 뒤집어 재접근 |
| 요청에 없던 필드가 응답에 등장 | Mass assignment 가능 | 그 필드를 요청에 추가 |
| `id`·파일명으로 리소스 지정 | IDOR 가능 | 다른 사용자 값으로 치환 |
| 식별자가 GUID | 노출 지점 탐색 | 프로필·글·API에서 GUID 수집 |
| 302인데 `Content-Length`가 큼 | 리다이렉트 본문 유출 | 본문 원문 확인 |
| `/admin`이 403 | 프런트엔드 경로 필터 | `X-Original-URL`·메서드·매칭 불일치 |
| `POST`만 401 | 메서드 의존 검증 | `OPTIONS`·`GET`으로 전환 |
| 관리자 기능이 세션 없이도 통과 | 헤더 기반 검증 | `Referer` 유지·위조 |

## 1. 접근면 목록화

먼저 검사가 있어야 할 지점을 나눠 정리한다.

| 구분 | 후보 기능 | 확인 포인트 |
| --- | --- | --- |
| 수직(관리자) | 사용자 삭제·역할 변경·설정, 내부 대시보드 | 낮은 권한 계정으로 접근 시 차단되는가 |
| 수평(사용자) | 계정 페이지·주문·메시지·다운로드 | "내 것"을 식별자로 지정하는가 |
| 컨텍스트 | 결제·확인·완료 등 다단계 | 각 단계가 개별 요청인가 |

- 관리자 기능은 `administrator` 계정이 주어지면 먼저 정상 흐름을 관찰해 요청 형태를 확보한다.
- 수평 리소스는 두 계정(본인·대상)을 동시에 로그인해 두면 치환 검증이 빠르다.

## 2. 미보호 기능 탐색

링크되지 않은 관리자·내부 기능을 찾는다.

| 후보 지점 | 확인 방법 | 관련 실습 |
| --- | --- | --- |
| `robots.txt`·메타데이터 | `robots.txt`·`sitemap.xml`·`/.well-known/` 요청 | [unprotected admin](/write-up/portswigger/access-control/write-up-portswigger---unprotected-admin-functionality/) |
| 클라이언트 JS | 소스에서 `admin`·`role`·`panel` 검색, 조건부 링크의 경로 문자열 | [unpredictable URL](/write-up/portswigger/access-control/write-up-portswigger---unprotected-admin-functionality-with-unpredictable-url/) |
| 강제 브라우징 | `/admin`·`/administrator`·`/admin-panel`·`/admin-roles` 대입 | 위 두 랩 |

- 예측 불가능한 경로(`/admin-xxxx`)여도 애플리케이션이 어딘가에서 노출한다. JS의 `if(isAdmin)` 블록 안 경로 문자열이 대표적이다.
- 경로를 찾으면 그 하위 기능(삭제·변경)의 실제 요청 형태까지 확보한다.

## 3. 수직 권한 상승

일반 계정으로 관리자 기능에 도달하는 통로를 하나씩 시도한다.

| 시도 | 통과하면 | 페이로드 방향 | 관련 실습 |
| --- | --- | --- | --- |
| 권한성 쿠키 변조 | 쿠키 기반 역할 | `Admin=false`→`true` | [role via parameter](/write-up/portswigger/access-control/write-up-portswigger---user-role-controlled-by-request-parameter/) |
| 파라미터 추가 | Mass assignment | 응답에 뜬 `roleid` 등을 요청에 삽입 | [role in profile](/write-up/portswigger/access-control/write-up-portswigger---user-role-can-be-modified-in-user-profile/) |
| 메서드 전환 | 메서드 의존 검증 | `POST`→`OPTIONS`·`GET`, 파라미터를 쿼리로 | [method-based](/write-up/portswigger/access-control/write-up-portswigger---method-based-access-control-can-be-circumvented/) |
| URL 재작성 헤더 | 프런트엔드 경로 필터 | 요청 라인 `/` + `X-Original-URL: /admin` | [URL-based](/write-up/portswigger/access-control/write-up-portswigger---url-based-access-control-can-be-circumvented/) |
| `Referer` 위조 | 헤더 기반 검증 | `Referer: .../admin` 유지 | [referer-based](/write-up/portswigger/access-control/write-up-portswigger---referer-based-access-control/) |
| URL 매칭 불일치 | 정규화 차이 | 대소문자·후행 슬래시·`.anything` | — |

- `X-Original-URL`이 통하지 않으면 `X-Rewrite-URL`도 시도한다.
- 메서드 전환 시 인증이 특정 메서드에만 걸린 것이므로, 같은 행위가 다른 메서드로 처리되는지 응답으로 확인한다.

## 4. 수평 권한 상승 · IDOR

사용자별 리소스를 다른 사용자 것으로 열 수 있는지 확인한다.

| 시도 | 통과하면 | 페이로드 방향 | 관련 실습 |
| --- | --- | --- | --- |
| `id` 파라미터 치환 | 인가 누락 | 다른 사용자명으로 교체 | [user id parameter](/write-up/portswigger/access-control/write-up-portswigger---user-id-controlled-by-request-parameter/) |
| GUID 수집 후 치환 | 식별자 노출 | 프로필·작성 글·API에서 GUID 확보 | [unpredictable IDs](/write-up/portswigger/access-control/write-up-portswigger---user-id-controlled-by-request-parameter-with-unpredictable-user-ids/) |
| 리다이렉트 본문 확인 | 렌더 후 차단 | 302의 `Content-Length`·본문 열람 | [data leakage in redirect](/write-up/portswigger/access-control/write-up-portswigger---user-id-controlled-by-request-parameter-with-data-leakage-in-redirect/) |
| 소스의 민감 값 | 정보 노출 | `type=password`의 `value` 속성 | [password disclosure](/write-up/portswigger/access-control/write-up-portswigger---user-id-controlled-by-request-parameter-with-password-disclosure/) |
| 정적 파일명 치환 | 파일 IDOR | 순번(`2.txt`→`1.txt`)·확장자 유지 | [IDOR](/write-up/portswigger/access-control/write-up-portswigger---insecure-direct-object-references/) |

- 식별자가 GUID라 포기하지 않는다. 대상 사용자가 남긴 흔적(글·댓글·공유 링크)이 GUID 노출처다.
- 리다이렉트·403을 "차단됨"으로 넘기지 말고 본문을 확인한다. 접근 제어가 렌더 이후에 걸리면 데이터는 이미 나간 상태다.
- 수평으로 관리자 데이터에 닿으면 수평→수직 상승으로 확장 가능한지 본다(관리자 비밀번호·세션·API Key).

## 5. 다단계 · 컨텍스트

| 시도 | 확인할 것 | 관련 실습 |
| --- | --- | --- |
| 마지막 단계 단독 전송 | 확인·완료 요청을 앞 단계 없이 보내도 처리되는가 | [multi-step](/write-up/portswigger/access-control/write-up-portswigger---multi-step-process-with-no-access-control-on-one-step/) |
| 낮은 권한 세션으로 각 단계 | 단계마다 개별 권한 검증이 있는가 | 위와 동일 |

- 두 단계 요청이 같은 엔드포인트로 가고 `confirmed=true` 같은 플래그로만 구분되면, 그 플래그를 포함한 요청을 단독으로 시도한다.
- 마지막 단계 하나라도 검사가 빠지면 앞의 모든 검사가 우회된다.

## 6. 특수 · 예외 상황

아래 항목은 일반 흐름에 맞지 않을 때만 확인한다.

| 상황 | 짧은 판단 기준 | 관련 글 |
| --- | --- | --- |
| IP·지역으로 차단됨 | 위치 기반 제어. VPN·프록시·`X-Forwarded-For`로 우회 | [WebSocket Note](/note/note-portswigger---websocket-%ED%86%A0%ED%94%BD-%EC%A0%95%EB%A6%AC-%EB%B0%8F-%EC%8B%A4%EC%8A%B5/) |
| 프런트엔드만 차단 | 백엔드 직접 접근·재작성 헤더로 계층 분리 | [URL-based](/write-up/portswigger/access-control/write-up-portswigger---url-based-access-control-can-be-circumvented/) |
| 검사가 특정 메서드에만 | CSRF의 메서드 의존 검증과 동형 | [CSRF method](/write-up/portswigger/csrf/write-up-portswigger---csrf-where-token-validation-depends-on-request-method/) |
| `Referer`만 보고 통과 | 위조 가능한 값을 근거로 삼음 | [CSRF referer](/write-up/portswigger/csrf/write-up-portswigger---csrf-with-broken-referer-validation/) |
| 완벽해 보이는데 XSS 있음 | 같은 출처에서 관리자 세션·토큰 탈취 가능 | [XSS Playbook](/playbook/playbook-xss-%EC%A7%84%EB%8B%A8-cheat-sheet/) |

## Quick Checklist

- [ ] 접근면을 수직·수평·컨텍스트로 나눠 목록화했는가?
- [ ] `robots.txt`·JS 소스·강제 브라우징으로 미보호 기능을 찾았는가?
- [ ] 권한성 쿠키·파라미터를 변조·삭제·치환해 봤는가?
- [ ] 응답에 뜬 미제출 필드(mass assignment)를 요청에 되넣어 봤는가?
- [ ] 식별자 파라미터·파일명을 다른 사용자 값으로 치환했는가?
- [ ] GUID는 노출 지점을 먼저 찾았는가?
- [ ] 리다이렉트·에러 응답의 본문까지 확인했는가?
- [ ] 403이면 메서드 전환·`X-Original-URL`·URL 매칭 불일치를 시도했는가?
- [ ] 다단계 기능의 마지막 단계를 낮은 권한 세션으로 단독 전송했는가?
- [ ] 파괴적 행위를 실습 환경·본인 계정으로 한정했는가?
