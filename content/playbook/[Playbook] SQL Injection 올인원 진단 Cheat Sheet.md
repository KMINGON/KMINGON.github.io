+++
date = '2026-06-28T09:00:00+09:00'
draft = false
title = '[Playbook] SQL Injection 올인원 진단 Cheat Sheet'
summary = "SQL Injection 진단 중 입력 컨텍스트와 관찰 가능한 신호를 빠르게 판별하고 다음 테스트를 선택하기 위한 올인원 Playbook"
toc = true
tags = ["SQL Injection", "Playbook", "Cheat Sheet", "Testing Workflow"]
+++

---

이 문서는 SQL Injection 진단 중 **현재 입력 위치를 추정하고 다음 테스트를 고르기 위한 빠른 참고서**다. 전체 쿼리 조립 과정이나 추출 스크립트는 관련 Write-up으로 연결한다.

> 승인된 테스트 환경과 실습에서만 사용한다. 입력이 `UPDATE`·`DELETE` 등 여러 쿼리에 재사용될 수 있으므로, 원본 쿼리를 모르는 상태에서 `OR 1=1` 같은 범위 확대 조건을 사용하지 않는다.

## 30초 진단 흐름

1. 정상 요청을 기준으로 응답 상태·길이·핵심 문구를 기록한다.
2. 입력이 문자열, 숫자, LIKE, SQL 구조 중 어디에 들어가는지 추정한다.
3. 구문을 깨는 Probe와 다시 복구하는 Probe를 한 쌍으로 비교한다.
4. 참·거짓 조건으로 제어 가능한 응답 차이가 있는지 확인한다.
5. 화면, 오류, Boolean, 시간, OAST 중 사용할 수 있는 신호를 선택한다.

| 관찰 결과 | 판단 | 다음 단계 |
| --- | --- | --- |
| 쿼리 결과가 화면에 표시됨 | In-band 가능 | 컬럼 수·타입 확인 후 `UNION` |
| DB 오류와 원본 값이 표시됨 | Visible Error 가능 | 형 변환 오류로 데이터 노출 확인 |
| 참·거짓 조건에 따라 본문이 달라짐 | Boolean-Based 가능 | 조건식으로 데이터 추론 |
| 조건에 따라 오류 발생 여부가 달라짐 | Conditional Error 가능 | 오류를 Boolean 신호로 사용 |
| 조건에 따라 응답 시간만 달라짐 | Time-Based 가능 | 여러 번 측정해 지연 신호 검증 |
| 인밴드 차이가 전혀 없음 | OAST 검토 | DBMS·권한·네트워크 조건 확인 |

## 1. 입력 컨텍스트 확인

하나의 결과만으로 취약 여부를 확정하지 않는다. 항상 `정상 입력 → 구문 변화 → 구문 복구 → 의미가 다른 대조군` 순서로 비교한다.

| 추정 컨텍스트 | 최소 Probe 예시 | 관찰할 신호 | 주의점 |
| --- | --- | --- | --- |
| 문자열 리터럴 | `'`, `''` | 오류 후 정상 복구 여부 | 애플리케이션이 오류를 숨길 수 있음 |
| 알려진 문자열 값 | `<KNOWN>' AND '1'='1` / `<KNOWN>' AND '1'='2` | 같은 기본값에서 응답만 달라지는지 | 뒤쪽 따옴표·괄호가 맞아야 함 |
| 숫자 표현식 | `1-0`, `1-1` | 계산 결과에 따라 조회 대상이 달라지는지 | 단순 숫자 검증도 같은 반응을 낼 수 있음 |
| 숫자 조건 | `1 AND 1=1` / `1 AND 1=2` | 참·거짓 응답 차이 | Mutation query에서는 상태 변경 위험 |
| `LIKE '%{input}%'` | `' || 'abc' || '` | 문자열 연결 후 abc 검색 여부 | `||` 의미가 DBMS·SQL mode마다 다름 |
| 괄호 내부 | `')`, `'))`처럼 닫는 괄호 수를 조절 | 특정 깊이에서 구문 복구 | 무작정 괄호를 늘리면 원인 판별이 어려움 |
| `ORDER BY` | `1 ASC`, `1 DESC`, 컬럼 번호 증가 | 정렬 방향·오류 경계 변화 | 문자열 탈출·`UNION` 방식과 다름 |
| JSON·XML 본문 | 원문 marker와 인코딩 marker 비교 | 파싱 전후 값의 변화 | WAF와 애플리케이션이 서로 다른 값을 볼 수 있음 |

`<KNOWN>`에는 정상적으로 결과가 존재하는 기존 값을 넣는다. `<COMMENT>`는 DBMS에 맞는 주석으로 바꾸되, 처음부터 뒤쪽 구문을 모두 제거하기보다 가능한 경우 원래 구문을 정상적으로 재조립하는 편이 진단에 유리하다.

### 문자열 값

다음 쿼리를 추정한다고 가정한다.

```sql
SELECT * FROM users WHERE username = '{input}'
```

존재하는 사용자명이 `wiener`라면 다음 두 입력을 비교할 수 있다.

```sql
wiener' AND '1'='1
wiener' AND '1'='2
```

최종 쿼리는 각각 참과 거짓 조건을 만든다.

```sql
WHERE username = 'wiener' AND '1'='1'
WHERE username = 'wiener' AND '1'='2'
```

두 요청에서 일관된 응답 차이가 나타나면 입력이 문자열 조건에 연결됐을 가능성이 높다. 로그인 쿼리처럼 뒤에 추가 조건이 이어지는 경우에는 남은 구문까지 확인해야 한다.

- [실습: WHERE 절의 숨겨진 데이터 조회](/write-up/portswigger/sql-injection/write-up-portswigger---sql-injection-vulnerability-in-where-clause-allowing-retrieval-of-hidden-data/)
- [실습: 로그인 로직 우회](/write-up/portswigger/sql-injection/write-up-portswigger---sql-injection-vulnerability-allowing-login-bypass/)

### LIKE 검색

다음 검색 쿼리를 추정한다고 가정한다.

```sql
SELECT id, title FROM articles WHERE title LIKE '%{input}%'
```

Oracle·PostgreSQL 계열에서 다음 입력은 원래의 `%`를 유지하면서 문자열을 다시 조립하는 Probe가 될 수 있다.

```sql
' || 'abc' || '
```

```sql
WHERE title LIKE '%' || 'abc' || '%'
```

정상 실행만으로 DBMS를 확정하지 않는다. MySQL 기본 설정에서는 `||`가 논리 OR로 처리될 수 있으며, 암시적 형 변환 때문에 오류 없이 전혀 다른 결과가 나올 수도 있다. 검색 결과, 오류, 결과 개수를 함께 비교한 뒤 DBMS별 문법으로 교차 확인한다.

뒤쪽을 주석 처리할 수 있는 환경에서는 참·거짓 조건을 다음 형태로 조립할 수 있다.

```sql
<KNOWN>%' AND '1'='1' <COMMENT>
<KNOWN>%' AND '1'='2' <COMMENT>
```

### SQL 구조 위치

정렬, 컬럼명, 테이블명처럼 입력이 SQL 구조에 직접 들어가면 따옴표를 탈출하는 Probe가 맞지 않는다.

```sql
SELECT id, title FROM articles ORDER BY {input}
```

이 경우 `1 ASC`와 `1 DESC`로 정렬 방향을 비교하고, 컬럼 번호를 증가시켜 오류 경계를 확인한다. `ORDER BY` 위치에서는 일반적인 `UNION`, `AND`, `OR`가 그대로 이어지지 않을 수 있다.

## 2. DBMS 빠른 교차 확인

한 가지 문법만으로 DBMS를 확정하지 않고 두 가지 이상을 교차 확인한다.

| 기능 | Oracle | PostgreSQL | Microsoft SQL Server | MySQL |
| --- | --- | --- | --- | --- |
| 문자열 연결 | `'a'\|\|'b'` | `'a'\|\|'b'` | `'a'+'b'` | `CONCAT('a','b')` 또는 인접 문자열 |
| 한 줄 주석 | `--` | `--` | `--` | `-- `, `#` |
| 블록 주석 | `/* */` | `/* */` | `/* */` | `/* */` |
| 단일 행 SELECT | `FROM dual` 필요 | `SELECT 'a'` | `SELECT 'a'` | `SELECT 'a'` |
| 버전 | `v$version` | `version()` | `@@version` | `@@version` |

MySQL의 `--` 뒤에는 공백이 필요하다. 연결 연산자, 주석, 버전 표현식, Oracle의 `dual` 중 최소 두 가지를 조합해 판단한다.

- [실습: DBMS 종류와 버전 조회](/write-up/portswigger/sql-injection/write-up-portswigger---sql-injection-attack-querying-the-database-type-and-version/)
- [실습: 데이터베이스 테이블·컬럼 조회](/write-up/portswigger/sql-injection/write-up-portswigger---sql-injection-attack-listing-the-database-contents/)

## 3. 화면에 결과가 보일 때

`UNION`은 다음 세 조건을 순서대로 확인한다.

> 원본 `SELECT`의 컬럼 수 → 문자열을 받을 수 있는 컬럼 → 해당 컬럼이 응답에 표시되는지

| 단계 | Probe 방향 | 성공 신호 | 실습 |
| --- | --- | --- | --- |
| 컬럼 수 | `ORDER BY` 번호 증가 또는 `UNION SELECT NULL...` | 오류 경계·추가 행 | [컬럼 수 확인](/write-up/portswigger/sql-injection/write-up-portswigger---sql-injection-union-attack-determining-the-number-of-columns-returned-by-the-query/) |
| 문자열 컬럼 | 한 위치씩 문자열 배치 | marker가 응답에 표시 | [문자열 컬럼 확인](/write-up/portswigger/sql-injection/write-up-portswigger---sql-injection-union-attack-finding-a-column-containing-text/) |
| 데이터 조회 | 컬럼 수·타입에 맞춘 서브쿼리 | 조회 값 표시 | [다른 테이블 조회](/write-up/portswigger/sql-injection/write-up-portswigger---sql-injection-union-attack-retrieving-data-from-other-tables/) |
| 한 컬럼에 여러 값 | DBMS별 문자열 연결 | 구분자가 포함된 한 문자열 | [단일 컬럼 값 연결](/write-up/portswigger/sql-injection/write-up-portswigger---sql-injection-union-attack-retrieving-multiple-values-in-a-single-column/) |

DB 오류가 응답에 그대로 보이면 `UNION`보다 짧은 Error-Based 경로가 가능할 수 있다.

- [실습: Visible Error-Based SQL Injection](/write-up/portswigger/sql-injection/write-up-portswigger---visible-error-based-sql-injection/)

## 4. 화면에 결과가 보이지 않을 때

| 사용할 수 있는 신호 | 확인 방식 | 다음 단계 | 실습 |
| --- | --- | --- | --- |
| 특정 문구·행 존재 | 동일한 조건의 참·거짓 쌍 비교 | Boolean-Based 추출 | [Conditional Responses](/write-up/portswigger/sql-injection/write-up-portswigger---blind-sql-injection-with-conditional-responses/) |
| HTTP 오류 발생 여부 | 조건에 따라 런타임 오류 유발 | Conditional Error 추출 | [Conditional Errors](/write-up/portswigger/sql-injection/write-up-portswigger---blind-sql-injection-with-conditional-errors/) |
| 응답 시간 | 지연 없음·지연 있음 반복 측정 | Time-Based 추출 | [Time Delays](/write-up/portswigger/sql-injection/write-up-portswigger---blind-sql-injection-with-time-delays/), [정보 추출](/write-up/portswigger/sql-injection/write-up-portswigger---blind-sql-injection-with-time-delays-and-information-retrieval/) |
| 외부 상호작용 | 고유 OAST 도메인으로 조회 유도 | OOB 확인·데이터 유출 | [OOB Interaction](/write-up/portswigger/sql-injection/write-up-portswigger---blind-sql-injection-with-out-of-band-interaction/) |

Time-Based는 한 번의 느린 응답으로 확정하지 않는다. 정상 요청과 지연 요청을 번갈아 여러 번 측정하고 네트워크 지연과 서버 부하를 분리한다.

## 5. 상태 변경 쿼리 주의

입력이 `INSERT`, `UPDATE`, `DELETE`에 사용될 가능성이 있다면 일반적인 Boolean Probe도 데이터를 바꿀 수 있다.

| 상황 | 먼저 확인할 것 | 피해야 할 초기 행동 |
| --- | --- | --- |
| `INSERT VALUES` | 저장 후 표시되는 위치, 컬럼·괄호 수 | 다중 행 삽입·stacked query |
| `UPDATE SET` | 테스트 전용 행과 원래 값 | 구문을 주석 처리해 WHERE 제거 |
| `UPDATE WHERE` | 항상 거짓인 조건에서 변경 행 0개 확인 | `OR 1=1` |
| `DELETE WHERE` | rollback 가능한 로컬 환경 | 범위를 넓히는 모든 참 조건 |
| Second-order | 저장 지점과 재사용 지점 분리 | 최초 저장 성공만 보고 안전하다고 판단 |

이 영역은 원본 쿼리와 테스트 데이터 범위를 알 수 있는 로컬·실습 환경에서만 진행한다.

## 6. 특수·예외 상황

아래 항목은 일반 진단 흐름에서 벗어날 때만 확인한다. 자세한 페이로드와 동작 원리는 연결된 글을 참고한다.

| 상황 | 짧은 판단 기준 | 관련 글 |
| --- | --- | --- |
| XML 입력에서 SQL 키워드만 차단 | WAF 검사 뒤 XML Entity가 복원되는지 확인 | [XML Encoding 우회 Write-up](/write-up/portswigger/sql-injection/write-up-portswigger---sql-injection-with-filter-bypass-via-xml-encoding/) |
| 오류·본문·시간 신호가 모두 없음 | DBMS의 외부 통신 기능과 네트워크 조건 확인 | [OOB Data Exfiltration](/write-up/portswigger/sql-injection/write-up-portswigger---blind-sql-injection-with-out-of-band-data-exfiltration/) |
| 입력과 조회 결과가 같아야 함 | 자기 참조 문자열이 필요한 특수 로직 | [Quine SQL Injection 분석](/analysis/analysis-quine-sql-injection-%EB%B6%84%EC%84%9D/) |
| `ORDER BY`·식별자 위치 | 문자열 탈출 대신 유효한 SQL 구조를 직접 구성 | [관련: `ORDER BY`로 컬럼 수 확인](/write-up/portswigger/sql-injection/write-up-portswigger---sql-injection-union-attack-determining-the-number-of-columns-returned-by-the-query/) |
| 특정 DBMS에서만 오류·지연 발생 | 함수·형 변환·평가 순서를 DBMS 문서로 교차 확인 | [관련: Conditional Error](/write-up/portswigger/sql-injection/write-up-portswigger---blind-sql-injection-with-conditional-errors/), [Time Delay](/write-up/portswigger/sql-injection/write-up-portswigger---blind-sql-injection-with-time-delays/) |

## Quick Checklist

- [ ] 정상 응답의 상태·길이·핵심 문구를 기록했는가?
- [ ] 문자열·숫자·LIKE·SQL 구조 위치를 구분했는가?
- [ ] 구문 파괴와 구문 복구 Probe를 비교했는가?
- [ ] 참·거짓 대조군이 같은 기본값에서 출발하는가?
- [ ] DBMS를 두 가지 이상의 문법으로 교차 확인했는가?
- [ ] 화면·오류·Boolean·시간·OAST 중 가장 단순한 신호를 골랐는가?
- [ ] 입력이 상태 변경 쿼리에도 사용될 가능성을 확인했는가?
