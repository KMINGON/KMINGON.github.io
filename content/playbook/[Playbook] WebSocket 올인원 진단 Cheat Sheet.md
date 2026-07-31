+++
date = '2026-06-21T11:00:00+09:00'
draft = false
title = '[Playbook] WebSocket 올인원 진단 Cheat Sheet'
summary = "WebSocket 진단 중 조작 지점(메시지·핸드셰이크·연결)과 사용할 수 있는 신호를 빠르게 판별하고 다음 테스트를 선택하기 위한 올인원 Playbook"
toc = true
tags = ["WebSocket", "Playbook", "Cheat Sheet", "Testing Workflow"]
+++

---

이 문서는 WebSocket 진단 중 **어느 지점을 조작할지 정하고 다음 테스트를 고르기 위한 빠른 참고서**다. WebSocket을 통해 드러나는 개별 취약점의 페이로드 문법은 각 주제의 Playbook으로, 상세 풀이는 Write-up으로 연결한다.

> 승인된 테스트 환경과 실습에서만 사용한다. WebSocket 메시지는 다른 사용자에게 즉시 중계되는 경우가 많으므로, 처음부터 실행 페이로드를 보내지 않고 무해한 marker로 도달 지점만 확인한다. CSWSH는 연결 수립 여부까지만 확인하고, 실제 사용자 데이터를 외부로 전송하지 않는다.

## 30초 진단 흐름

1. WebSockets history에서 엔드포인트, 핸드셰이크, 메시지 형식을 기록한다.
2. 클라이언트가 값을 인코딩·검증하는지, 프록시에서 원문을 보내면 통과하는지 비교한다.
3. 메시지가 나에게만 돌아오는지, 다른 사용자에게 중계되는지 확인한다.
4. 핸드셰이크에 CSRF 토큰과 `Origin` 검증이 있는지 확인한다.
5. 메시지, 핸드셰이크, 연결(CSWSH) 중 조작할 지점을 선택한다.

| 관찰 결과 | 판단 | 다음 단계 |
| --- | --- | --- |
| 입력이 인코딩된 상태로 전송됨 | 클라이언트 측 처리 | 프록시에서 원문 전송으로 우회 확인 |
| 원문 태그가 그대로 중계·출력됨 | 메시지 기반 XSS 가능 | 수신 측 sink와 Trigger 확인 |
| 메시지가 조회·검색 결과에 반영됨 | 서버 측 입력 취약점 가능 | SQL Injection 등 Probe 적용 |
| 특정 메시지만 오류 응답 | 메시지 단위 필터 | 문자·대소문자·인코딩 변형 |
| 오류 후 재연결까지 차단됨 | 연결·IP 단위 차단 | 핸드셰이크 헤더 조작 |
| 핸드셰이크에 쿠키만 존재 | CSWSH 가능 | `Origin` 검증 여부 확인 |

## 1. 연결 파악

페이로드보다 먼저 연결 자체를 기록한다. WebSocket은 핸드셰이크 한 번으로 이후 모든 메시지의 권한과 컨텍스트가 결정되므로, 연결 정보가 곧 공격면의 범위다.

| 기록 항목 | 확인 이유 |
| --- | --- |
| 엔드포인트 URL과 scheme | `ws`면 평문 노출, 경로에 사용자 입력이 포함되는지 |
| 핸드셰이크 요청 헤더 전체 | 인증 값, 커스텀 헤더, 프록시 관련 헤더 유무 |
| 인증에 사용되는 값 | 쿠키만인지, 토큰·헤더가 함께 있는지 |
| 메시지 형식 | 단순 문자열인지 JSON인지, 필드별로 처리가 다른지 |
| 메시지 방향 | 클라이언트 주도인지, 서버가 먼저 보내는지 |
| 연결 직후 규약 메시지 | `READY` 같은 값이 이전 상태·대화를 반환하는지 |

`Sec-WebSocket-Key`와 `Sec-WebSocket-Accept`는 규격상 핸드셰이크 확인용 값이며 인증이나 CSRF 방어 역할을 하지 않는다. 예측 불가능한 값처럼 보이지만 방어로 계산하지 않는다.

- [개념: WebSocket 토픽 정리](/note/note-portswigger---websocket-%ED%86%A0%ED%94%BD-%EC%A0%95%EB%A6%AC-%EB%B0%8F-%EC%8B%A4%EC%8A%B5/)

## 2. 클라이언트 측 처리 우회

브라우저 입력창을 거치는 검증과 인코딩은 방어가 아니다. 메시지는 프록시에서 직접 만들어 보낼 수 있으므로, 같은 값을 두 경로로 보내 비교하는 것이 첫 단계다.

> `입력창으로 전송한 값` ↔ `프록시에서 직접 전송한 값`

| 확인 결과 | 의미 | 다음 단계 |
| --- | --- | --- |
| 입력창에서는 인코딩되지만 원문 전송은 통과 | 검증이 클라이언트에만 존재 | 서버·수신 측 처리로 진행 |
| 원문 전송도 인코딩되어 저장 | 서버 측 인코딩 존재 | 인코딩 시점과 출력 컨텍스트 재확인 |
| 원문 전송 시 오류 응답 | 서버 측 필터 존재 | 차단 기준 역추적 |
| 값이 JSON 필드 중 일부만 처리 | 필드별 처리 차이 | 필드마다 별도 marker 삽입 |

JSON 메시지는 `message`, `user`, `room`처럼 필드가 여러 개인 경우가 많다. 한 필드가 안전하게 처리된다고 나머지도 같다고 보지 않고, 필드별로 서로 다른 marker를 넣어 도달 지점을 분리한다.

- [실습: 메시지 조작으로 클라이언트 측 인코딩 우회](/write-up/portswigger/websocket/write-up-portswigger---manipulating-websocket-messages-to-exploit-vulnerabilities/)

## 3. 메시지 기반 취약점

원문 전송이 통과했다면, 그 값이 최종적으로 어디에서 해석되는지에 따라 취약점 종류가 갈린다.

| 처리 지점 | 확인할 것 | 사용할 Probe | 관련 문서 |
| --- | --- | --- | --- |
| 다른 사용자 화면에 출력 | 수신 측이 어떤 sink로 삽입하는가 | 태그 파싱 여부 → 이벤트 요소 | [XSS Playbook](/playbook/playbook-xss-%EC%98%AC%EC%9D%B8%EC%9B%90-%EC%A7%84%EB%8B%A8-cheat-sheet/) |
| DB 조회·검색 조건 | 구문 파괴와 복구 응답 차이 | `'`, 참·거짓 조건 쌍 | [SQL Injection Playbook](/playbook/playbook-sql-injection-%EC%98%AC%EC%9D%B8%EC%9B%90-%EC%A7%84%EB%8B%A8-cheat-sheet/) |
| XML·파일 파서 | 외부 엔티티 처리 여부 | 무해한 엔티티 선언 | 서버 측 파서 동작 확인 |
| 서버의 외부 요청 | 응답에 반영되지 않는 처리 | 고유 OAST 도메인 | 인밴드 신호가 없을 때만 |
| 응답이 전혀 관측되지 않음 | Blind 여부 | OAST 또는 다른 사용자 화면 | 신호를 먼저 확보 |

메시지가 다른 사용자에게 중계되는 구조는 Stored XSS와 성격이 같다. 저장 후 조회를 기다리는 대신 즉시 전파되므로, 실제 서비스에서는 무해한 marker 단계에서 멈추고 영향 범위를 먼저 판단한다.

수신 측 sink 확인은 XSS 진단과 동일하다. `innerHTML`로 삽입하는 구조에서는 `<script>`가 DOM에 보여도 실행되지 않으므로, 파싱 직후 자동으로 발생하는 이벤트를 사용해야 한다.

- [원리: InnerHTML과 Script 태그 분석](/analysis/analysis-innerhtml%EA%B3%BC-script-%ED%83%9C%EA%B7%B8-%EB%B6%84%EC%84%9D/)

## 4. 핸드셰이크 조작

Repeater에서 WebSocket URL 옆의 연필 아이콘으로 새 연결을 수립하거나 기존 연결을 복제·재연결하면서 핸드셰이크 요청을 직접 편집할 수 있다. 메시지 단위 방어가 촘촘해도 연결 단계에서 무력화되는 경우가 있으므로 항상 함께 확인한다.

| 조작 대상 | 확인할 것 | 성공 신호 |
| --- | --- | --- |
| `X-Forwarded-For`·`X-Real-IP` | 애플리케이션이 헤더로 클라이언트 IP를 판단하는가 | 차단된 상태에서 재연결 성공 |
| `Origin` | 서버가 출처를 검증하는가 | 값을 바꿔도 `101` 응답 |
| `Cookie`·`Authorization` | 다른 세션으로 연결 시 권한이 달라지는가 | 권한이 다른 메시지 처리 결과 |
| 커스텀 헤더 | 애플리케이션 고유 값을 신뢰하는가 | 분기 동작 변화 |
| `Sec-WebSocket-Protocol` | 서브프로토콜에 따라 처리가 갈리는가 | 다른 응답·다른 메시지 규약 |
| 경로·쿼리 파라미터 | 엔드포인트에 사용자 입력이 들어가는가 | 다른 채널·방으로 연결 |

핸드셰이크를 다시 만들어야 하는 상황은 헤더 조작으로 공격면을 넓힐 때, 공격 시도로 끊긴 연결을 되살릴 때, 만료된 토큰을 갱신할 때다.

- [실습: 핸드셰이크 조작으로 IP 차단·필터 우회](/write-up/portswigger/websocket/write-up-portswigger---manipulating-the-websocket-handshake-to-exploit-vulnerabilities/)

## 5. CSWSH 빠른 확인

세 조건이 모두 성립하면 Cross-Site WebSocket Hijacking이 가능하다.

1. 핸드셰이크 인증이 쿠키에만 의존한다.
2. CSRF 토큰이나 예측 불가능한 값이 없다.
3. 서버가 `Origin`을 검증하지 않는다.

브라우저는 WebSocket 연결에 동일 출처 정책을 강제하지 않고 `Origin` 헤더만 전달하므로, 교차 출처 차단 여부는 전적으로 서버 검증에 달려 있다.

| `Origin` 조작 결과 | 판단 | 다음 단계 |
| --- | --- | --- |
| 임의 값·삭제에도 `101` 응답 | 검증 없음 | 교차 사이트 연결 PoC |
| `101` 이후 즉시 close | 부분 검증 또는 메시지 단계 인증 | 종료 코드와 첫 메시지 확인 |
| `400`·`403` 응답 | 검증 존재 | `null` Origin, 서브도메인, 접미사 매칭 확인 |
| 쿠키 없이도 연결 성공 | 인증 자체가 없음 | 인증 없이 접근 가능한 데이터 범위 확인 |

PoC는 데이터 유출 전에 연결 수립 여부만 확인한다.

```html
<script>
    const ws = new WebSocket('wss://<target-host>/chat');
    ws.onopen = () => console.log('opened');
    ws.onclose = (e) => console.log('closed', e.code);
</script>
```

연결이 열리면 세션 쿠키가 교차 사이트 요청에 실렸다는 뜻이다. 메시지 전송과 응답 수집으로 확장하는 단계는 실습 환경에서만 진행한다. 세션 쿠키의 `SameSite` 설정도 함께 확인한다. `None`이면 교차 사이트 요청에 쿠키가 자동으로 첨부된다.

- [실습: Cross-site WebSocket hijacking](/write-up/portswigger/websocket/write-up-portswigger---cross-site-websocket-hijacking/)

## 6. 차단에 막혔을 때

WebSocket은 차단이 메시지 하나에 그치지 않고 연결 전체에 적용되는 경우가 많다. **어느 단위로 차단됐는지**를 먼저 구분해야 다음 시도를 고를 수 있다.

| 증상 | 차단 단위 | 다음 선택 |
| --- | --- | --- |
| 해당 메시지만 오류 응답, 연결 유지 | 메시지 | 대소문자·인코딩·대체 문법 변형 |
| 오류 후 연결 종료, 재연결은 가능 | 연결 | 새 핸드셰이크로 재연결 후 재시도 |
| 세션을 바꿔도 재연결 불가 | IP | `X-Forwarded-For` 등으로 출처 IP 위장 |
| 차단 사유가 응답에 노출 | 탐지 규칙 노출 | 사유를 근거로 매칭 방식 역추적 |
| 일정 시간 후 자동 해제 | 임시 차단 | 요청 간격과 재시도 조건 확인 |

차단 사유가 `{"error":"Attack detected: Event handler"}`처럼 그대로 노출되면 필터가 무엇을 보고 판단했는지 알 수 있다. 이벤트 핸들러라면 HTML 속성 이름이 대소문자를 구분하지 않는다는 점을, 특정 문자라면 대체 문법을 먼저 확인한다.

## 7. 특수·예외 상황

아래 항목은 일반 흐름에 맞지 않을 때만 확인한다.

| 상황 | 짧은 판단 기준 | 관련 글 |
| --- | --- | --- |
| 연결 직후 규약 메시지가 과거 데이터를 반환 | 세션 컨텍스트만 있으면 이전 대화·상태를 열람 가능 | [CSWSH Write-up](/write-up/portswigger/websocket/write-up-portswigger---cross-site-websocket-hijacking/) |
| 서버→클라이언트 메시지만 취약 | Proxy의 interception 방향 설정을 바꿔 수신 메시지 확인 | [메시지 조작 Write-up](/write-up/portswigger/websocket/write-up-portswigger---manipulating-websocket-messages-to-exploit-vulnerabilities/) |
| 라이브러리 래퍼 사용(Socket.IO 등) | 자체 프레임 형식을 유지해야 메시지가 파싱됨 | 라이브러리 프레임 규격 확인 |
| 핸드셰이크가 `HTTP/2`로 표시 | 프록시 표기 차이이며 조작 방식은 동일 | [핸드셰이크 Write-up](/write-up/portswigger/websocket/write-up-portswigger---manipulating-the-websocket-handshake-to-exploit-vulnerabilities/) |
| 메시지에 자체 인증 값이 포함 | 핸드셰이크가 아닌 메시지 단계 인증 여부 확인 | 재사용·만료 조건 확인 |
| `ws://` 평문 연결 | 네트워크 구간 노출과 메시지 조작 가능성 | [개념: 대응 방안](/note/note-portswigger---websocket-%ED%86%A0%ED%94%BD-%EC%A0%95%EB%A6%AC-%EB%B0%8F-%EC%8B%A4%EC%8A%B5/) |

## Quick Checklist

- [ ] 엔드포인트·핸드셰이크·메시지 형식을 먼저 기록했는가?
- [ ] 입력창 전송과 프록시 원문 전송 결과를 비교했는가?
- [ ] JSON 필드별로 도달 지점을 분리해 확인했는가?
- [ ] 메시지가 다른 사용자에게 중계되는 구조인지 확인했는가?
- [ ] 값이 최종적으로 해석되는 지점(수신 측 sink·DB·파서)을 특정했는가?
- [ ] 핸드셰이크 헤더를 근거로 보안 결정을 내리는지 확인했는가?
- [ ] CSWSH 성립 조건 세 가지를 각각 확인했는가?
- [ ] 차단이 메시지·연결·IP 중 어느 단위인지 구분했는가?
