+++
date = '2026-05-21T08:12:44+09:00'
draft = false
title = '[Write-up] PortSwigger - SQL injection UNION attack, finding a column containing text'
summary = "컬럼 수를 파악한 뒤 각 컬럼에 문자열을 삽입해, 문자열 데이터와 호환되는 컬럼을 찾아내는 PortSwigger 랩 풀이"
toc = true
tags = ["SQL Injection", "PortSwigger", "PRACTITIONER", "UNION"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [SQL injection UNION attack, finding a column containing text](https://portswigger.net/web-security/sql-injection/union-attacks/lab-find-column-containing-text)

> ![image.png](/writeup/portswigger/sqli/06/1.png)

Product Category Filter에 SQL Injection이 존재한다.  
이전 랩에서 사용한 컬럼 수 파악 기법으로 컬럼 개수를 확인한 뒤, 문자열 데이터와 호환되는 컬럼을 찾아 문제에서 제시한 문자열 `vg2fCI` 를 응답에 표시하면 문제가 해결된다. 제시되는 문자열은 랩 인스턴스마다 다르게 부여된다.

### SQL Injection 진단

먼저 Product Category Filter에 삽입해 컬럼 개수를 파악한다. `ORDER BY` 인덱스를 하나씩 늘려가며 확인한다.

```sql
' ORDER BY 4--
```

`ORDER BY 4` 에서 오류가 발생하므로 컬럼의 개수는 3개로 판단된다.

---

## 익스플로잇

각 컬럼 자리에 문자열을 하나씩 넣어, 오류가 발생하지 않는(문자열 데이터와 호환되는) 위치를 찾는다.

```sql
' UNION SELECT NULL,'a',NULL--
```

두 번째 자리에서 오류 없이 값이 반환되므로, 두 번째 컬럼이 문자열과 호환됨을 알 수 있다.  
이제 해당 자리에 문제에서 제시한 문자열을 넣어 응답에 표시되도록 페이로드를 구성한다.

```sql
' UNION SELECT NULL,'vg2fCI',NULL--
```

![image.png](/writeup/portswigger/sqli/06/2.png)

제시된 문자열이 응답에 표시되며 문제가 해결된다.

---

## 정리

UNION 기반 SQL Injection의 두 번째 단계는, 파악한 컬럼 중에서 문자열 데이터를 담을 수 있는 컬럼을 찾는 것이다.  
각 컬럼 자리에 문자열(`'a'`)을 차례로 넣어보고, 오류가 나지 않는 위치가 문자열과 호환되는 컬럼이다. 정수형 등 문자열과 호환되지 않는 컬럼에 문자열을 삽입하면 타입 변환 오류가 발생하는데, 이 성질을 역으로 이용하는 것이다. 문자열 호환 컬럼을 확인하면, 이후 실제 데이터(사용자명·비밀번호 등)를 그 자리에 조회할 수 있다.
