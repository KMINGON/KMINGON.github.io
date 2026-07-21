+++
date = '2026-05-21T09:12:54+09:00'
draft = false
title = '[Write-up] PortSwigger - SQL injection UNION attack, retrieving data from other tables'
summary = "앞서 파악한 컬럼 수와 문자열 컬럼을 이용해 users 테이블의 사용자명·비밀번호를 조회하고 administrator로 로그인하는 PortSwigger 랩 풀이"
toc = true
tags = ["SQL Injection", "UNION-Based", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [SQL injection UNION attack, retrieving data from other tables](https://portswigger.net/web-security/sql-injection/union-attacks/lab-retrieve-data-from-other-tables)

> ![image.png](/writeup/portswigger/sqli/07/1.png)

Product Category Filter에 SQL Injection이 존재한다.  
UNION 기반 SQL Injection으로 모든 사용자명과 비밀번호를 추출한 뒤 administrator 계정으로 로그인하면 문제가 해결된다. 이 랩에서는 대상 테이블이 `users`, 컬럼이 `username` 과 `password` 라는 정보가 문제에서 주어진다.

---

## 익스플로잇

문제 페이지는 앞선 UNION 랩들과 동일한 구조로, 컬럼이 2개이며 모두 문자열 타입이다.  
주어진 테이블·컬럼 정보를 이용해 사용자명과 비밀번호를 조회하는 페이로드를 구성한다.

```sql
' UNION SELECT username,password FROM users--
```

조회 결과, 전체 계정 정보는 다음과 같다.

```
administrator   hxncb4z9tlp5ossmdryc
carlos          0roiv5szsnzdub2kyyfu
wiener          1re2gvi8xkkywfklv33r
```

획득한 administrator 계정 정보로 로그인하면 문제가 해결된다.

![image.png](/writeup/portswigger/sqli/07/2.png)

---

## 정리

UNION 기반 공격은 컬럼 수 파악과 문자열 컬럼 식별을 마친 뒤, 대상 테이블·컬럼을 알면 `UNION SELECT` 로 실제 데이터를 직접 조회하는 단계로 이어진다.  
이 랩은 테이블명과 컬럼명이 문제에서 주어졌지만, 실제 진단에서는 앞선 "listing the database contents" 랩처럼 `information_schema` 등 메타데이터 뷰로 스키마를 먼저 열거해 테이블·컬럼명을 알아낸 뒤 이 단계를 수행한다.
