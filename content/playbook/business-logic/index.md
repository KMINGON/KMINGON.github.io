+++
date = '2026-09-20T15:00:00+09:00'
draft = false
title = '[Playbook] Business Logic 진단 Cheat Sheet'
summary = "Business Logic 진단 중 값의 출처, 검증 시점, 요청 순서와 반복, 기능 간 데이터 해석을 비교해 업무 규칙이 깨지는 지점을 찾기 위한 Playbook"
toc = true
tags = ["Business Logic", "Logic Flaws", "Playbook", "Cheat Sheet", "Testing Workflow"]
+++

---

이 문서는 Business Logic 진단 중 **서버가 어떤 값과 상태를 믿는지 확인하고, 업무 규칙이 깨지는 조건에 따라 다음 시도를 고르기 위한 빠른 참고서**다. 유형별 상세 원리와 전체 풀이는 관련 Write-up과 [Business Logic Note](/note/portswigger-business-logic/)로 연결한다.

## 30초 진단 흐름

1. 정상 흐름을 한 번 수행하고 가격·잔액·이메일 확인 상태·권한이 바뀌는 요청을 기록한다.
2. 서버가 결정해야 할 값이 요청에 실려 있는지 보고, **변조·경계값·빈 값·파라미터 삭제**를 나눠 확인한다.
3. 검증이 끝난 뒤 값을 바꾸고, 변경된 값에도 기존 검증 상태가 유지되는지 본다.
4. 중간 단계를 생략하거나 완료 요청을 다시 보내 **현재 상태에서 가능한 동작**을 확인한다.
5. 쿠폰·상품권, 알림·인증 쿠키, 이메일 검증·발송을 연결해 **기능 사이의 차이**를 찾는다.

| 관찰 결과 | 판단 | 다음 단계 |
| --- | --- | --- |
| 장바구니 요청에 `price`가 포함됨 | 가격 결정 근거가 클라이언트에 있을 가능성 | 값 변경 후 장바구니와 최종 결제 금액 비교 |
| 음수 수량이 항목에 반영됨 | 개별 수량 검증 누락 | 다른 상품과 합쳐 잔액 범위의 양수 합계 구성 |
| 요청당 수량은 제한되지만 계속 추가됨 | 누적 수량·금액 제한 별도 확인 필요 | 누적값과 연산 경계에서 합계 변화 관찰 |
| 이메일 변경 직후 권한이 달라짐 | 변경된 주소를 재확인하지 않을 가능성 | 확인 메일·확인 상태·관리자 접근을 함께 비교 |
| 긴 주소가 계정 화면에서 잘림 | 저장값과 발송값 불일치 가능성 | 잘리는 위치와 실제 수신 주소 비교 |
| 잘못된 필수 값은 거부하지만 삭제하면 통과 | 파라미터 존재 여부로 처리 경로 분기 | 대상 계정과 최종 변경 결과 확인 |
| 결제·역할 선택 전에도 다음 기능이 열림 | 선행 조건을 서버에서 강제하지 않음 | 새 흐름에서 중간 단계 생략 후 결과 재확인 |
| 같은 쿠폰은 막히지만 다른 쿠폰 뒤에는 재사용됨 | 직전 사용값만 비교할 가능성 | A → B → A 순서로 할인 누적 확인 |
| 할인 상품권 구매 후 액면가로 충전됨 | 구매·충전의 결합으로 순이익 발생 | 한 주기 전후 잔액과 새 코드 사용 여부 확인 |
| 입력이 암호화된 쿠키로 돌아오고 내용도 표시됨 | 암호화·복호화 오라클 가능성 | 다른 용도 쿠키와 형식·수용 여부 비교 |
| 조직 도메인을 통과한 주소의 메일이 외부로 도착 | 검증기와 발송기의 파싱 차이 | 입력·저장 주소·실제 수신자를 나란히 비교 |

## 1. 정상 흐름과 업무 규칙 확보

무작정 값을 바꾸기 전에 무엇이 유지되어야 하는지 정한다. 응답 성공 여부보다 최종 상태가 기준이다.

| 기능 | 먼저 남길 것 | 유지되어야 할 조건 |
| --- | --- | --- |
| 주문 | 상품 ID·단가·수량·할인·합계·잔액 | 유효한 항목으로 계산한 금액만 결제됨 |
| 이메일 | 입력값·저장값·확인 상태·수신자 | 확인된 주소만 권한 판단에 사용됨 |
| 비밀번호 변경 | 세션 사용자·대상 계정·필수 입력 | 대상 계정을 변경할 권한이 검증됨 |
| 단계형 로그인 | 각 단계의 요청·쿠키·접근 가능한 기능 | 완료 전에는 완료 후 권한을 갖지 않음 |
| 상품권 | 구매액·코드·충전액·전후 잔액 | 반복만으로 의도하지 않은 이익이 생기지 않음 |

- Burp HTTP history에서 정상 요청을 확보하고, Repeater에서는 한 번에 조건 하나씩 바꾼다.
- 순서가 중요한 시도는 새 장바구니나 새 로그인 흐름에서 비교해 이전 상태의 영향을 구분한다.

## 2. 가격·수량·계산 결과

요청 한 번의 입력 제한과 여러 요청이 쌓인 결과를 나눠 본다.

| 시도 | 확인할 것 | 관련 실습 |
| --- | --- | --- |
| `price` 변경 | 서버 가격을 다시 조회하는가, 입력 금액으로 결제되는가 | [client-side controls](/write-up/portswigger/business-logic/excessive-trust-in-client-side-controls/) |
| `quantity`에 0·음수 | 항목별 수량과 합계가 어떻게 변하는가 | [high-level logic](/write-up/portswigger/business-logic/high-level-logic-vulnerability/) |
| 허용 수량 반복 추가 | 누적 수량·금액이 제한되는가, 합계가 갑자기 음수로 바뀌는가 | [low-level logic](/write-up/portswigger/business-logic/low-level-logic-flaw/) |

- 합계가 음수라 결제가 거절돼도 개별 항목 검증까지 정상이라는 뜻은 아니다. 다른 항목을 조정했을 때 잘못된 수량이 남은 채 구매되는지 본다.
- 오버플로는 실제 단가와 내부 금액 단위에 따라 경계가 달라진다. 다른 랩의 반복 횟수를 그대로 쓰지 않고 현재 합계를 기준으로 계산한다.

## 3. 검증 후 변경 · 입력 길이

검증한 값이 최종 판단에 사용될 때까지 그대로 유지되는지 따라간다.

| 시도 | 확인할 것 | 관련 실습 |
| --- | --- | --- |
| 확인된 이메일을 조직 도메인으로 변경 | 새 주소 확인 전에 권한이 바뀌는가 | [inconsistent controls](/write-up/portswigger/business-logic/inconsistent-security-controls/) |
| 이메일 길이를 늘려 등록 | 거부되는가, 저장 시 잘리는가, 어느 주소로 메일이 가는가 | [exceptional input](/write-up/portswigger/business-logic/inconsistent-handling-of-exceptional-input/) |
| 잘리는 위치에 도메인 경계 배치 | 저장된 조직 도메인과 실제 외부 수신자가 달라지는가 | [exceptional input](/write-up/portswigger/business-logic/inconsistent-handling-of-exceptional-input/) |

- 긴 문자열이 잘리면 **원본 → 저장값 → 권한 판단 → 메일 수신자**를 각각 확인한다.
- 화면 표시만 짧아진 경우와 서버에 저장된 값이 잘린 경우를 구분한다. 권한·메일 처리 결과까지 연결되어야 영향이 확인된다.

## 4. 필수 파라미터 · 단계 생략

빈 값과 파라미터 삭제는 별도 시도다. 이후 단계까지 진행해야 차이가 드러나는 경우도 있다.

| 시도 | 확인할 것 | 관련 실습 |
| --- | --- | --- |
| `current-password` 삭제 | 현재 비밀번호 확인 없이 변경 요청이 처리되는가 | [dual-use endpoint](/write-up/portswigger/business-logic/weak-isolation-on-dual-use-endpoint/) |
| 변경 대상 `username` 비교 | 세션 사용자와 다른 계정에도 동일하게 적용되는가 | [dual-use endpoint](/write-up/portswigger/business-logic/weak-isolation-on-dual-use-endpoint/) |
| 결제 요청 없이 주문 완료 URL 호출 | 실제 주문이 생성되고 상품이 구매 처리되는가 | [workflow validation](/write-up/portswigger/business-logic/insufficient-workflow-validation/) |
| 로그인 후 역할 선택 요청 생략 | 역할 미확정 상태에서 관리자 기능이 열리는가 | [flawed state machine](/write-up/portswigger/business-logic/authentication-bypass-via-flawed-state-machine/) |

- `order-confirmed=true` 같은 값이나 완료 화면 자체를 성공 근거로 삼지 않는다. 주문 내역·잔액·실습 성공 상태를 함께 본다.
- 정상 흐름에서 발급된 CSRF 토큰과 세션은 유지하고, 생략하려는 조건만 바꿔 원인을 구분한다.

## 5. 할인 · 상품권 반복

같은 요청의 재전송과 여러 기능을 거쳐 다시 돌아오는 반복을 나눠 확인한다.

| 시도 | 확인할 것 | 관련 실습 |
| --- | --- | --- |
| 쿠폰 A → A | 같은 쿠폰의 연속 사용이 막히는가 | [business rules](/write-up/portswigger/business-logic/flawed-enforcement-of-business-rules/) |
| 쿠폰 A → B → A | 다른 쿠폰 뒤에 기존 쿠폰이 다시 적용되는가 | [business rules](/write-up/portswigger/business-logic/flawed-enforcement-of-business-rules/) |
| 상품권 할인 구매 → 등록 | 구매액보다 충전액이 커지는가 | [infinite money](/write-up/portswigger/business-logic/infinite-money-logic-flaw/) |
| 새 상품권으로 같은 주기 반복 | 새 코드마다 잔액이 일정하게 증가하는가 | [infinite money](/write-up/portswigger/business-logic/infinite-money-logic-flaw/) |

- 한 주기의 순이익은 `충전액 - 구매액`으로 계산한다. 같은 코드의 중복 등록과 할인 구조의 결함을 혼동하지 않는다.
- 매크로가 필요하면 구매 응답에서 **이번에 발급된 코드**를 추출해 다음 등록 요청에 넣는다. 순차 실행과 한 주기의 결과를 먼저 확인한다.

## 6. 암호화 결과 · 이메일 파싱

기능 사이를 이동하는 데이터가 같은 의미로 처리되는지 확인한다.

| 관찰 | 다음 시도 | 관련 실습 |
| --- | --- | --- |
| 입력한 값이 암호화된 알림 쿠키로 돌아옴 | 쿠키를 다시 보냈을 때 평문이 어디에 표시되는지 확인 | [encryption oracle](/write-up/portswigger/business-logic/authentication-bypass-via-encryption-oracle/) |
| 알림 기능이 인증 쿠키도 복호화함 | 평문 구조·접두사·블록 경계를 확인하고 용도 간 재사용 검증 | [encryption oracle](/write-up/portswigger/business-logic/authentication-bypass-via-encryption-oracle/) |
| 이메일의 인코딩 표현에 따라 허용 여부가 다름 | 검증을 통과한 주소와 실제 메일 수신자를 비교 | [email parsing discrepancies](/write-up/portswigger/business-logic/bypassing-access-controls-using-email-address-parsing-discrepancies/) |

- 암호문을 자르는 경우 URL·Base64 표현과 원시 바이트를 구분한다. 블록 길이 오류 하나만으로 암호화 모드나 padding oracle을 단정하지 않는다.
- 인증 쿠키를 검증할 때는 기존 로그인 세션 때문에 성공한 것인지 구분한다.
- 이메일 파싱은 구현에 따라 결과가 달라진다. 특정 인코딩을 받아들였다는 사실과 표준 문법으로 유효하다는 주장을 분리한다.

## Quick Checklist

- [ ] 정상 요청과 가격·잔액·권한의 변경 지점을 확보했는가?
- [ ] 클라이언트가 전달한 가격·대상 계정·역할을 서버가 다시 검증하는가?
- [ ] 0·음수·경계값과 여러 요청의 누적 결과를 나눠 확인했는가?
- [ ] 합계뿐 아니라 개별 항목의 유효성도 확인했는가?
- [ ] 빈 값과 파라미터 삭제를 각각 시도했는가?
- [ ] 이메일이나 주문 내용 변경 후 검증 상태가 그대로 남는지 봤는가?
- [ ] 결제·역할 선택 등 중간 단계를 생략한 뒤 최종 상태를 확인했는가?
- [ ] 같은 요청의 반복과 여러 기능을 조합한 반복을 구분했는가?
- [ ] 상품권 한 주기의 구매액·충전액·새 코드를 확인했는가?
- [ ] 다른 용도의 암호문이 인증에 재사용되는지 확인했는가?
- [ ] 이메일 입력값·저장값·권한 판단·실제 수신자를 비교했는가?
