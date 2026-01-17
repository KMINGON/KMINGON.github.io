+++
date = '2026-01-17T19:06:29+09:00'
draft = false
title = '[Analysis] Quine SQL Injection 분석'
summary = "Quine SQL Injection의 페이로드를 분석하고, 해당 기법이 왜 그리고 어떻게 동작하는지 이해해 보았다."
toc = true
tags = ["Quine SQL Injection", "SQL Injection", "Quine's Pardox", "UNION SQL Injection"]
+++

---

## 들어가며

이 글은 Quine SQL Injection의 페이로드를 분석하고, 해당 기법이 왜 그리고 어떻게 동작하는지를 이해하는 것을 목표로 한다.  
단순한 기법 소개가 아니라, 내부 동작 원리를 중심으로 Quine SQL Injection을 깊이 있게 살펴본다.

---

## Quine SQL Injection이란?

Quine SQL Injection은 SQL 쿼리의 출력 결과가 입력으로 사용된 쿼리(또는 페이로드)와 동일하도록 만드는 공격 기법이다.

다음과 같은 로직이 있다고 가정하자.

```php
if($row['id'] == $_GET['id'])
```

이 로직은 데이터베이스에서 조회된 `id` 컬럼 값과 사용자 입력값을 직접 비교한다.  
만약 SQL Injection이 가능한 지점이 `id` 파라미터 하나뿐이고, 다른 컬럼 값을 추출할 수 없는 상황이라면, 쿼리 결과로 반환되는 `id` 값 자체가 입력한 페이로드와 완전히 동일해야만 조건을 만족하게 된다.

즉, 공격자는 자신이 입력한 페이로드와 동일한 값을 쿼리 결과로 다시 반환하도록 만들어야 한다.

그렇다면 이러한 조건을 어떻게 만족시킬 수 있을까?

### UNION SQL Injection

가장 먼저 떠올릴 수 있는 방법은 [UNION SQL Injection](https://www.skshieldus.com/download/files/download.do?o_fname=EQST%20insight_%20Special%20Report_202205.pdf&r_fname=20220516094829139.pdf)이다.

UNION SQL Injection은 기존의 SELECT 문 뒤에 UNION SELECT 구문을 추가하여, 공격자가 원하는 값을 쿼리 결과에 포함시키는 기법이다.  
이를 통해 실제 테이블의 데이터가 아닌, 공격자가 임의로 지정한 값이 결과로 반환되도록 조작할 수 있다.

예를 들어 다음과 같은 쿼리가 있다고 가정하자.

```sql
SELECT id FROM mem WHERE id = '$id'
```

사용자 입력값에 대한 검증이 없고 SQL Injection이 가능한 환경이라면, id 파라미터에 다음과 같은 값을 삽입할 수 있다.
```sql
' UNION SELECT 'foo
```
이 경우 최종적으로 실행되는 쿼리는 다음과 같다.

```sql
SELECT id FROM mem WHERE id = '' UNION SELECT 'foo'
```

그 결과, 쿼리는 'foo'라는 문자열을 id 값으로 반환하게 된다.

![image.png](/analysis/4/image.png)

---

## Quine’s Paradox

이제 다시 원래의 문제로 돌아가 보자.  
UNION SQL Injection을 이용해 입력한 페이로드와 동일한 값을 반환하도록 만들고자 한다.

가장 단순하게 생각하면, 페이로드 자체를 UNION SELECT 구문을 통해 그대로 반환하면 될 것처럼 보인다.  
예를 들어 페이로드를 다음과 같이 구성하는 방식이다.

```sql
payload = ' UNION SELECT '{payload}' -- 
```
그러나 이 접근 방식에는 치명적인 문제가 있다.  
페이로드 내부에 포함된 `{payload}`를 수정하는 순간, 전체 페이로드의 형태가 다시 변경되기 때문이다.

이처럼 “나를 출력하라”라는 명령을 수행하기 위해 “나”를 정의하는 순간 “나”의 정의가 수정되어야 하는 모순에 빠지게 되며  
이와 같은 현상을 [Quine’s Pardox(Self-referential Paradox)](https://grokipedia.com/page/Quine's_paradox), 즉 자기 참조의 역설이라고 한다.

Quine SQL Injection은 이 문제를 해결하기 위해, 쿼리 전체를 직접 문자열로 작성하는 대신 특정 패턴을 자기 자신으로 치환하는 함수를 활용하여 실행 시점에 자기 자신의 형태를 완성하는 방식을 사용한다.

---

## Quine SQL Injection Payload

다음은 Quine SQL Injection의 대표적인 페이로드 예시이다.

```sql
SELECT
REPLACE(
    REPLACE(
        'SELECT REPLACE(REPLACE("$",CHAR(34),CHAR(39)),CHAR(36),"$") AS Quine',
        CHAR(34),
        CHAR(39)
    ),
    CHAR(36),
    'SELECT REPLACE(REPLACE("$",CHAR(34),CHAR(39)),CHAR(36),"$") AS Quine'
) AS Quine 
```

![image.png](/analysis/4/image%201.png)

이 쿼리를 실행하면, 실행된 쿼리 문자열 자체가 그대로 결과로 반환된다.  
여기서 CHAR() 함수는 각각  `char(34)` : `"` , `char(39)` : `'` , `char(36)` : `$` 를 의미한다.

먼저 내부 `REPLACE` 함수부터 살펴본다.

```sql
SELECT REPLACE(REPLACE("$",CHAR(34),CHAR(39)),CHAR(36),"$") AS Quine
```
이 문자열에서 `"` 문자를 `'` 문자로 치환하면 다음과 같은 결과가 된다.

```sql
SELECT REPLACE(REPLACE('$',CHAR(34),CHAR(39)),CHAR(36),'$') AS Quine
```

그 다음, `$` 문자를 다시 전체 쿼리 문자열로 치환한다.

결과적으로 최종 `REPLACE` 함수의 반환값은 다음과 같아진다

```sql
SELECT REPLACE(REPLACE('SELECT REPLACE(REPLACE("$",CHAR(34),CHAR(39)),CHAR(36),"$") AS Quine',CHAR(34),CHAR(39)),CHAR(36),'SELECT REPLACE(REPLACE("$",CHAR(34),CHAR(39)),CHAR(36),"$") AS Quine') AS Quine

```

즉, 자기 자신을 완벽하게 복제한 문자열이 결과로 반환된다.

### Payload의 핵심 구조

이 구조의 핵심은 특정 문자열을 코드(Code)와 데이터(Data)로 동시에 사용하는 것이다.

이를 단순화해 설명하면 다음과 같다. 

`"$를 출력하라"` 라는 명령이 있다고 가정하자.  
이때 `$`가 `"$를 출력하라"`라는 문자열을 의미한다면,

해당 명령의 결과는 다시 `"$를 출력하라"`가 된다.

이를 SQL의 REPLACE 함수 구조로 옮기면 다음과 같은 형태가 된다.
```sql
REPLACE("$를 출력하라", "$", "$를 출력하라")
``` 
여기에 문자열 리터럴 처리를 위한 문자 치환과 SELECT 구문을 결합하면, 앞서 살펴본 Quine SQL Injection 페이로드가 완성된다.

---

## 마치며

Quine SQL Injection은 이름에서 알 수 있듯이 Quine's Paradox 개념을 기반으로 하기 때문에, 처음 접하면 직관적으로 이해하기 어렵다.

그러나 Quine 기법은 SQL Injection에 국한되지 않고, 다양한 분야에서 활용되어 왔다.  
대표적으로 1984년 튜링상 수상자인 켄 톰슨(Ken Thompson)의 논문
["Reflections on Trusting Trust"](https://www.cs.cmu.edu/~rdriley/487/papers/Thompson_1984_ReflectionsonTrustingTrust.pdf)에서는 Quine 프로그램을 이용해 소스 코드에 흔적을 남기지 않고 컴파일러에 트로이 목마를 삽입하는 방법이 소개된다.

이처럼 Quine 기법은 직관적으로 이해하기 어려운 만큼, 방어자의 입장에서도 탐지하기도 까다로운 특징을 가진다.  
따라서 오늘 살펴본 Quine SQL Injection과 같은 비직관적인 기법을 깊이 이해하고 분석하는 과정은, 모의해킹 전문가로 성장하는 데 있어 중요한 기술적 자산이 될 수 있다고 생각한다.

---

>참고자료  
> https://www.skshieldus.com/download/files/download.do?o_fname=EQST%20insight_%20Special%20Report_202205.pdf&r_fname=20220516094829139.pdf  
> https://aboutsc.tistory.com/147  
> https://domdom.tistory.com/575  
> https://plato.stanford.edu/entries/self-reference/  
> https://gist.github.com/jbrr/d6b66b4fde6c403537f3  
> https://grokipedia.com/page/Quine's_paradox  
> https://en.wikipedia.org/wiki/Quine_(computing)  
> https://www.cs.cmu.edu/~rdriley/487/papers/Thompson_1984_ReflectionsonTrustingTrust.pdf  
> https://ospace.tistory.com/959  
> https://www.postype.com/@cpuu/post/402071  