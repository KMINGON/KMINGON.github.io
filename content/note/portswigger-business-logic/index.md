+++
date = '2026-09-17T21:10:00+09:00'
draft = false
title = '[Note] PortSwigger - Business Logic 토픽 정리 및 실습'
summary = "클라이언트 값 신뢰, 수량·금액의 경계값, 검증 시점과 처리 순서, 할인·상품권의 결합, 암호화 오라클과 이메일 파싱 차이로 발생하는 Business Logic 취약점의 원리와 진단·대응 방법을 정리한 자료"
toc = true
tags = ["Business Logic", "Logic Flaws", "Access Control", "PortSwigger"]
+++

---

## 들어가며

쇼핑몰에서 수량을 고르고 쿠폰을 적용한 뒤 결제하는 흐름은 자연스럽다. 하지만 서버가 사용자가 반드시 그 순서로 요청을 보낸다고 가정하거나, 화면에서 선택할 수 있는 값만 전송된다고 믿으면 문제가 생긴다. 공격자는 요청의 값뿐 아니라 순서와 반복 횟수도 바꿀 수 있기 때문이다.

이 글에서는 Business Logic 취약점을 값의 검증, 상태와 처리 순서, 기능 간 결합으로 나눠 정리한다. 금액 변조부터 권한 상승, 암호화 오라클과 이메일 파싱 차이까지 살펴보고, 각 유형의 상세 풀이는 별도의 Write-up으로 연결한다.

![Business Logic 취약점 개요](images/logic-flaws.jpg)
*https://portswigger.net/web-security/logic-flaws*

---

## Business Logic 취약점이란?

Business Logic은 애플리케이션이 지켜야 하는 업무 규칙이다. 상품 가격은 서버가 정하고, 결제가 완료된 주문만 확정하며, 조직 구성원만 관리자 기능에 접근할 수 있다는 조건이 여기에 해당한다. 이 규칙이 설계나 구현 과정에서 빠지면, 제공된 기능만으로도 의도하지 않은 결과를 만들 수 있다.

특정 문자열 하나가 모든 기능에 통하는 취약점은 아니다. 같은 `quantity=-1`도 장바구니에서는 금액을 줄이고, 다른 기능에서는 단순히 거부될 수 있다. 따라서 입력의 형태와 함께 **그 값이 어떤 판단에 사용되는지**를 봐야 한다.

이번 실습은 다음 세 가지 질문으로 나눠 볼 수 있다.

| 구분 | 확인할 질문 | 대표 사례 |
| --- | --- | --- |
| 값의 검증 | 서버가 받는 값과 계산 결과가 업무 규칙에 맞는가 | 가격 변조, 음수 수량, 정수 오버플로 |
| 상태와 처리 순서 | 이전 검증이 현재 값과 요청에도 유효한가 | 이메일 변경, 필수 파라미터 누락, 결제·역할 선택 생략 |
| 기능 간 결합 | 각 기능이 같은 값과 결과를 일관되게 해석하는가 | 쿠폰·상품권 조합, 암호화 결과 재사용, 이메일 파싱 차이 |

이 분류는 진단을 위한 기준이다. 이메일 변경으로 관리자 권한을 얻는 경우처럼 하나의 결함이 Business Logic과 Access Control 양쪽에 걸칠 수 있다.

---

## 취약점은 어디서 생기는가

랩에서 반복해서 드러난 문제는 **앞 단계나 다른 기능이 이미 검증했을 것이라는 가정**이다. 회원가입에서 이메일을 확인했으니 이후 변경된 이메일도 믿고, 결제 완료 페이지에 도착했으니 실제 결제가 끝났다고 판단한다. 하지만 최초 검증과 최종 사용 사이에서 값이나 상태가 달라지면 그 근거는 더 이상 유효하지 않다.

| 가정 | 놓치기 쉬운 조건 |
| --- | --- |
| 화면에 없는 값은 들어오지 않는다 | 가격·수량·대상 계정을 요청에서 직접 변경 |
| 한 번 검증한 정보는 계속 믿을 수 있다 | 검증 후 이메일이나 주문 내용 변경 |
| 필수 입력과 중간 단계는 생략되지 않는다 | 파라미터 삭제, 다음 엔드포인트 직접 호출 |
| 각각 정상인 기능을 합쳐도 정상이다 | 할인된 상품권을 액면가로 충전하는 반복 |
| 암호화되거나 확인 메일을 받았으면 신뢰할 수 있다 | 다른 용도로 발급된 암호문, 다르게 해석된 수신 주소 |

입력 검증을 한 번 추가하는 것만으로 해결되지 않는 이유도 여기에 있다. 어떤 값이 어느 단계에서 확정되고, 이후 어디에서 다시 사용되는지까지 따라가야 한다.

---

## 취약점 유형과 우회

### 1. 클라이언트가 전달한 가격 신뢰

상품을 장바구니에 넣는 요청에 `productId`와 `quantity` 외에 `price`가 포함되어 있다면, 서버가 이 값을 어떻게 사용하는지 확인한다. 화면에서 가격을 수정할 수 없더라도 요청 자체는 바꿀 수 있다.

[Excessive trust in client-side controls](/write-up/portswigger/business-logic/excessive-trust-in-client-side-controls/)에서는 전달한 가격이 장바구니와 결제에 반영된다. 상품 ID로 서버의 가격을 조회하지 않고 클라이언트 값을 신뢰한 것이다. 핵심은 가격 필드를 숨기는 것이 아니라, 최종 금액을 결정하는 근거를 서버가 관리하는 데 있다.

### 2. 음수·누적값·계산 결과 검증 누락

수량을 정수로 받는다고 해서 업무적으로 유효한 수량인 것은 아니다. 개별 요청의 제한과 장바구니 전체의 제한도 서로 다르다.

| 유형 | 동작 | 관련 실습 |
| --- | --- | --- |
| 음수 수량 | 다른 상품의 음수 금액으로 구매할 상품의 가격 상쇄 | [High-level logic vulnerability](/write-up/portswigger/business-logic/high-level-logic-vulnerability/) |
| 누적 금액 오버플로 | 요청당 수량 제한 안에서 반복 추가해 합계가 표현 범위를 넘도록 유도 | [Low-level logic flaw](/write-up/portswigger/business-logic/low-level-logic-flaw/) |

두 랩 모두 최종 합계가 음수인 상태에서는 결제가 막힌다. 그러나 다른 상품의 수량을 조정해 합계를 잔액 안의 양수로 만들면 구매가 가능하다. **합계가 결제 가능한 범위인지 확인하는 것과 각 항목이 유효한지 확인하는 것은 별개**다.

진단에서도 응답 코드만 보면 이 차이를 놓친다. 요청은 정상 처리되더라도 장바구니 수량, 항목별 금액, 최종 합계가 서로 맞는지 함께 확인해야 한다.

### 3. 검증 후 변경되거나 잘리는 입력

[Inconsistent security controls](/write-up/portswigger/business-logic/inconsistent-security-controls/)에서는 회원가입 시 이메일 소유권을 확인하지만, 가입 후 이메일을 변경할 때는 같은 검증을 하지 않는다. 변경한 주소의 도메인이 관리자 권한 판단에 바로 사용되면서 최초 확인 절차를 우회한다.

[Inconsistent handling of exceptional input](/write-up/portswigger/business-logic/inconsistent-handling-of-exceptional-input/)은 저장 길이 제한이 원인이다. 긴 주소의 원본으로 확인 메일을 보내면서 계정에는 잘린 주소를 저장한다. 저장된 값이 조직 도메인으로 끝나도록 길이를 맞추면, 실제 확인 메일은 외부 주소에서 받았는데도 조직 사용자로 처리된다.

둘의 공통점은 **검증한 주소와 권한 판단에 사용한 주소가 다르다**는 것이다. 주소가 변경되거나 잘렸다면 기존 확인 상태를 그대로 이어받아서는 안 된다.

### 4. 필수 파라미터와 중간 단계 생략

잘못된 값을 넣는 시도와 값을 아예 보내지 않는 시도는 다르다. 서버가 파라미터의 존재 여부로 기능을 구분한다면, 삭제만으로 다른 처리 경로에 들어갈 수 있다.

| 생략 대상 | 결과 | 관련 실습 |
| --- | --- | --- |
| 현재 비밀번호 파라미터 | 현재 비밀번호 검증 없이 지정한 계정의 비밀번호 변경 | [Weak isolation on dual-use endpoint](/write-up/portswigger/business-logic/weak-isolation-on-dual-use-endpoint/) |
| 결제 단계 | 결제 검증을 거치지 않고 주문 완료 요청으로 구매 처리 | [Insufficient workflow validation](/write-up/portswigger/business-logic/insufficient-workflow-validation/) |
| 로그인 후 역할 선택 | 제한된 역할이 설정되기 전의 세션으로 관리자 기능 접근 | [Authentication bypass via flawed state machine](/write-up/portswigger/business-logic/authentication-bypass-via-flawed-state-machine/) |

브라우저의 리다이렉트나 필수 입력 속성은 사용자가 정상 흐름을 따르도록 돕는 장치다. 해당 단계의 완료 여부는 서버가 별도로 확인해야 한다. 특히 중간 상태의 세션에 권한을 먼저 부여하면, 뒤 단계에서 권한을 줄이는 코드가 실행되지 않을 때 문제가 된다.

### 5. 할인과 잔액 충전의 결합

쿠폰은 정상적인 할인 기능이고 상품권은 정상적인 충전 수단이다. 하지만 할인 조건과 충전 금액을 함께 검토하지 않으면 두 기능의 조합으로 잔액을 늘릴 수 있다.

| 유형 | 빠진 검증 | 관련 실습 |
| --- | --- | --- |
| 쿠폰 교대 적용 | 직전 쿠폰만 비교하고 주문 전체의 사용 이력을 확인하지 않음 | [Flawed enforcement of business rules](/write-up/portswigger/business-logic/flawed-enforcement-of-business-rules/) |
| 할인 상품권 구매·등록 반복 | 할인 구매가와 계정에 충전되는 액면가의 차이를 허용 | [Infinite money logic flaw](/write-up/portswigger/business-logic/infinite-money-logic-flaw/) |

앞의 랩은 `NEWCUST5`와 `SIGNUP30`을 번갈아 적용하면 같은 쿠폰의 할인이 다시 누적된다. 뒤의 랩은 10달러 상품권을 30% 할인된 7달러에 구매하고 10달러를 충전해 한 번에 3달러씩 잔액이 늘어난다.

상품권 코드 하나를 여러 번 쓰는 결함과는 구분해야 한다. 매번 새 상품권을 구매해도 동일한 이익이 생기므로, 일회성 코드 검증만으로는 이 흐름을 막지 못한다.

### 6. 암호화 결과를 다른 기능에서 재사용

[Authentication bypass via encryption oracle](/write-up/portswigger/business-logic/authentication-bypass-via-encryption-oracle/)에서는 잘못된 이메일 입력을 알림 쿠키로 암호화하고, 쿠키를 읽어 복호화된 내용을 화면에 표시한다. 이 경로로 로그인 유지 쿠키의 평문 구조를 확인하고, 관리자 계정에 맞는 암호문을 만들어 인증에 사용할 수 있다.

암호화 키를 알아내는 공격은 아니다. 공격자가 원하는 내용을 서버가 암호화해 주고, 그 결과가 다른 용도의 쿠키에서도 받아들여지는 것이 문제다. 따라서 암호화 여부뿐 아니라 **어떤 기능이 발급한 값을 어떤 기능이 신뢰하는지**를 확인해야 한다. 알림과 인증 토큰의 용도를 구분하고, 변조된 값이 유효하게 처리되지 않도록 무결성도 검증해야 한다.

### 7. 이메일 주소 파싱 차이

도메인 제한이 있는 회원가입에서는 화면의 이메일 문자열만으로 판단을 끝낼 수 없다. 검증 코드가 확인한 도메인과 메일 발송기가 최종적으로 선택한 수신자가 같은지 봐야 한다.

[Bypassing access controls using email address parsing discrepancies](/write-up/portswigger/business-logic/bypassing-access-controls-using-email-address-parsing-discrepancies/)에서는 인코딩된 주소를 검증기와 메일 처리기가 다르게 해석한다. 조직 도메인 제한을 통과한 주소의 확인 메일을 외부 메일함에서 받을 수 있고, 확인을 마치면 관리자 기능이 열린다.

긴 주소가 저장 과정에서 잘리는 앞의 랩과 달리, 이 경우에는 **같은 입력을 서로 다른 방식으로 해석**하는 것이 원인이다. 한 라이브러리에서 통하는 인코딩이 다른 환경에서도 동일하게 동작한다고 가정해서는 안 된다.

---

## 진단 방법

진단은 정상 흐름을 먼저 확보한 뒤, 각 단계의 조건을 하나씩 바꾸며 진행한다.

1. **업무 규칙을 적는다.** 주문이라면 가격·수량·할인 조건·결제 완료 여부, 계정이라면 이메일 확인 상태·역할·변경 권한을 정리한다.
2. **요청과 상태 변화를 연결한다.** 어떤 요청이 장바구니·잔액·확인 상태·권한을 바꾸는지 기록한다. 정상 요청은 이후 비교 기준으로 남겨 둔다.
3. **값과 경계값을 바꾼다.** 가격·수량을 수정하고, 음수·0·길이 경계·누적값을 확인한다. 파라미터가 비어 있는 경우와 아예 없는 경우도 구분한다.
4. **검증 시점과 순서를 바꾼다.** 확인 후 값을 변경하거나 중간 단계를 생략한다. 응답 문구만 보지 않고 마지막 기능까지 이어서 실제 상태를 확인한다.
5. **기능을 조합한다.** 쿠폰과 상품권, 알림과 인증 쿠키, 이메일 검증과 발송처럼 같은 데이터를 주고받는 기능을 연결해 본다.

반복 요청이 필요해도 먼저 한 번의 상태 변화부터 확인한다. 자동화는 재현한 흐름을 반복하는 데 사용하고, 어느 요청 때문에 결과가 달라졌는지 구분할 수 있도록 순서와 응답을 남긴다.

각 단계의 관찰 결과와 다음 시도는 [Business Logic Playbook](/playbook/business-logic/)에 정리했다.

---

## 대응 방안

- **가격과 권한의 근거를 서버에서 결정한다.** 클라이언트가 전달한 가격이나 역할을 그대로 적용하지 않고, 서버가 관리하는 상품 정보와 인증된 사용자의 권한으로 판단한다.
- **입력과 계산 결과를 함께 검증한다.** 수량·길이·금액의 허용 범위를 정하고, 개별 값뿐 아니라 누적 수량과 연산 결과에도 같은 제한을 적용한다. 범위를 넘는 값은 조용히 자르거나 순환시키지 않고 거부한다.
- **검증 상태를 검증한 값에 묶는다.** 이메일이 바뀌면 소유권을 다시 확인하고, 주문 내용이 바뀌면 할인·결제 조건도 다시 평가한다.
- **단계마다 선행 조건을 확인한다.** 결제 완료나 역할 확정 여부를 서버 상태로 관리한다. 중간 단계의 세션에는 완료된 사용자와 같은 권한을 부여하지 않는다.
- **반복과 기능 간 조합을 검토한다.** 주문 전체의 쿠폰 사용 이력, 상품권 할인 대상 여부, 실제 지급한 금액과 충전액의 관계를 함께 확인한다.
- **같은 데이터를 일관되게 처리한다.** 인증 토큰은 다른 용도의 암호문과 구분하고 무결성을 검증한다. 이메일은 검증·저장·발송 과정에서 동일한 수신자를 가리키는지 확인한다.

개별 우회 문자열만 막으면 같은 가정을 이용하는 다른 경로가 남을 수 있다. 수정 후에는 정상 순서뿐 아니라 생략·변경·반복한 요청에서도 업무 규칙이 유지되는지 확인해야 한다.

---

## 실습

PortSwigger Web Security Academy의 Business Logic 랩 12개를 유형별로 풀어 정리했다. 본문의 각 유형에서 상세 풀이로 이동할 수 있으며, 전체 구성은 다음과 같다.

| 유형 | 대표 Lab | 난이도 |
| --- | --- | --- |
| 클라이언트 값 신뢰 | Excessive trust in client-side controls | APPRENTICE |
| 수량·연산 검증 | High-level logic vulnerability / Low-level logic flaw | APPRENTICE–PRACTITIONER |
| 검증 후 변경·입력 길이 | Inconsistent security controls / Inconsistent handling of exceptional input | APPRENTICE–PRACTITIONER |
| 필수 입력·처리 순서 | Weak isolation on dual-use endpoint / Insufficient workflow validation / Flawed state machine | PRACTITIONER |
| 할인·잔액 규칙 | Flawed enforcement of business rules / Infinite money logic flaw | APPRENTICE–PRACTITIONER |
| 암호화 결과 재사용 | Authentication bypass via encryption oracle | PRACTITIONER |
| 이메일 파싱 차이 | Bypassing access controls using email address parsing discrepancies | EXPERT |

전체 풀이는 [Business Logic Write-up 아카이브](/write-up/portswigger/business-logic/)에서 확인할 수 있다.

---

## 마치며

Business Logic 랩에서는 요청 하나만 보면 정상처럼 보이는 경우가 많았다. 쿠폰 적용도, 상품권 구매도, 이메일 확인도 각각은 제공된 기능이다. 문제가 드러나는 지점은 그 기능을 예상과 다른 값·순서·조합으로 사용했을 때다.

진단에서 중요한 것은 정상 흐름을 이해한 뒤 **서버가 실제로 확인하는 조건과 사용자가 지킬 것이라 기대한 조건을 구분하는 것**이다. 가격을 누가 정하는지, 확인한 값이 이후에도 같은지, 완료되지 않은 상태에서 무엇을 할 수 있는지를 따라가면 겉으로 드러나지 않던 결함을 찾을 수 있다.

이 글이 Business Logic 취약점을 학습하거나 기능별 진단 흐름을 정리하는 데 참고 자료가 되기를 바란다.

---

> 참고자료  
> https://portswigger.net/web-security/logic-flaws  
> https://portswigger.net/web-security/logic-flaws/examples
