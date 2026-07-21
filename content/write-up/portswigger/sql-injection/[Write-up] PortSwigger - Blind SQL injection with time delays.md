+++
date = '2026-05-21T15:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - Blind SQL injection with time delays'
summary = "응답 내용 차이도 오류도 없는 환경에서, 지연 함수(pg_sleep)를 삽입해 응답 시간으로 취약점을 확인하는 Time-Based Blind SQL Injection 풀이 (PostgreSQL)"
toc = true
tags = ["SQL Injection", "Blind SQLi", "Time-Based", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [Blind SQL injection with time delays](https://portswigger.net/web-security/sql-injection/blind/lab-time-delays)

> ![image.png](/writeup/portswigger/sqli/12/1.png)

Tracking Cookie 값이 SQL 쿼리에 사용되며, 이 지점에 Blind SQL Injection 취약점이 존재한다.  
쿼리 결과나 오류는 반환되지 않지만, 쿼리가 동기적으로 처리되므로 응답 시간의 변화로 정보를 추론할 수 있다. SQL Injection으로 10초의 지연을 발생시키면 문제가 해결된다.

---

## 익스플로잇

앞선 랩들이 대부분 PostgreSQL이었으므로, PostgreSQL의 지연 함수 `pg_sleep` 을 사용해 지연 구문을 구성한다.

```sql
'||pg_sleep(10)--
```

`pg_sleep` 은 `void` 를 반환하므로 문자열 연결 연산자(`||`)에 붙여도 문법 오류 없이 실행된다.  
아래와 같은 형태도 가능하다.

```sql
' OR pg_sleep(10) IS NULL--
```

위 페이로드를 쿠키에 넣어 전송했을 때 응답이 약 10초 지연되면 문제가 해결된다.

![image.png](/writeup/portswigger/sqli/12/2.png)

---

## 정리

Time-Based Blind SQL Injection은 응답 내용의 차이도, 오류 메시지도 없는 환경에서 사용한다. 지연 함수를 삽입한 뒤 응답 시간의 변화로 조건의 참·거짓을 추론하는 방식이다.  
지연 함수는 DB마다 다르다. PostgreSQL은 `pg_sleep(N)`, MySQL은 `SLEEP(N)`, Microsoft SQL Server는 `WAITFOR DELAY 'hh:mm:ss'`, Oracle은 `dbms_pipe.receive_message(('a'),N)` 을 사용한다. DB별 문법은 이론 노트의 치트시트에서 정리한 바 있다.  
이 랩은 단순히 지연을 유발하는 것이 목표이지만, 실제로는 조건이 참일 때만 지연을 거는 형태(`CASE WHEN ... THEN pg_sleep(10) ...`)로 데이터를 한 문자씩 추출한다. 이는 다음 랩에서 다룬다.