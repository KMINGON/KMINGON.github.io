+++
date = '2026-06-28T09:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - File path traversal, simple case'
summary = "이미지 표시 기능의 filename 파라미터에 상대경로 탈출을 넣어 /etc/passwd를 읽어내는 기본 Path Traversal 풀이"
toc = true
tags = ["Path Traversal", "Directory Traversal", "PortSwigger", "Apprentice"]
+++

---

## 문제 분석

> **난이도**: `APPRENTICE`  
> **Lab**: [File path traversal, simple case](https://portswigger.net/web-security/file-path-traversal/lab-simple)

> ![image.png](/writeup/portswigger/path-traversal/01/1.png)

상품 이미지를 표시하는 기능에 path traversal 취약점이 존재한다. `/etc/passwd` 파일의 내용을 가져오면 문제가 해결된다.

### Path Traversal 진단

상품 페이지의 HTML을 확인하면 이미지가 별도 엔드포인트를 통해 로드된다.

```html
<img src="/image?filename=7.jpg">
```

전달되는 값이 파일의 경로가 아니라 **파일명 하나뿐**이라는 점이 출발점이다. 서버가 기준 디렉터리를 미리 정해 두고 그 뒤에 `filename` 값을 이어 붙인다는 뜻이므로, 이어 붙이기 전에 검증이 없다면 두 방향으로 기준 디렉터리를 벗어날 수 있다.

| 시도 | 의도 | 성립 조건 |
| --- | --- | --- |
| 절대경로 | 기준 디렉터리를 무시하고 경로를 직접 지정 | 파일 API가 절대경로 인자를 만나면 앞 경로를 버림 |
| 상대경로 탈출 | 기준 디렉터리에서 `../`로 상위 디렉터리 이동 | 조립된 문자열이 그대로 파일 API에 전달됨 |

먼저 절대경로를 시도한다.

```http
GET /image?filename=/etc/passwd HTTP/2
Host: <lab-id>.web-security-academy.net
```

파일을 찾지 못했다는 응답이 돌아온다. 기준 디렉터리가 접두로 남은 채 조립되어 존재하지 않는 경로가 만들어졌다는 뜻이다. 이 실패는 그 자체로 **서버가 입력 앞에 기준 디렉터리를 붙인다**는 사실을 확인해 주므로, 다음 시도는 상대경로 탈출이 된다.

---

## 익스플로잇

`../`를 붙여 기준 디렉터리에서 상위로 빠져나오는 페이로드를 구성한다.

```http
GET /image?filename=../../../etc/passwd HTTP/2
Host: <lab-id>.web-security-academy.net
```

서버에서 조립되어 실제로 열리는 경로는 다음과 같다.

```text
/var/www/images/ + ../../../etc/passwd  →  /var/www/images/../../../etc/passwd  →  /etc/passwd
```

`../`의 개수는 기준 디렉터리의 깊이 이상이기만 하면 된다. 경로 정규화는 애플리케이션이 아니라 커널이 수행하고, 루트 디렉터리에서 `..`는 다시 루트를 가리키기 때문에 깊이를 정확히 모를 때는 넉넉하게 붙여도 결과가 달라지지 않는다.

요청을 전송하면 응답 본문에 `/etc/passwd`의 내용이 그대로 포함되며 문제가 해결된다.

![image.png](/writeup/portswigger/path-traversal/01/2.png)

응답의 `Content-Type`은 여전히 이미지로 지정되어 있어 브라우저에서는 깨진 이미지로만 표시된다. 파일 내용은 프록시에서 응답 원문으로 확인해야 한다.

---

## 정리

이 랩은 path traversal의 기본형이다. 취약점의 뿌리는 **애플리케이션과 운영체제가 같은 문자열을 다르게 취급한다**는 데 있다. 애플리케이션에게 `../../../etc/passwd`는 그저 파일명이라는 데이터지만, 그 문자열이 `open()`에 전달되는 순간 커널은 `..`를 상위 디렉터리로 이동하라는 명령으로 해석한다. 값으로 다루던 것이 경계를 넘으면서 구조가 되는, 인젝션 계열 취약점의 전형적인 형태다.

진단 관점에서 두 가지를 짚어둘 만하다.

첫째, 절대경로가 실패하고 상대경로가 성공했다는 사실 자체가 정보다. 두 시도의 결과 조합으로 서버가 경로를 어떻게 조립하는지 좁힐 수 있다. 절대경로가 통했다면 `os.path.join()`이나 `Path.resolve()`처럼 절대경로 인자를 만나면 앞 경로를 버리는 API를 쓰고 있다는 뜻이고, 이번처럼 실패했다면 문자열을 단순 연결하거나 절대경로를 유지한 채 조립하는 방식이라는 뜻이다.

둘째, `/etc/passwd`가 검증 대상으로 쓰이는 이유는 그 안에 민감한 값이 있어서가 아니다. 실제 해시는 `/etc/shadow`에 있고 그 파일은 일반 권한으로 읽히지 않는다. `/etc/passwd`는 어떤 리눅스 배포판에도 존재하고, 모든 사용자에게 읽기 권한이 있으며, 텍스트라서 응답에 섞여 있어도 즉시 식별된다. 즉 **임의 파일 읽기가 성립했다는 사실을 최소한의 부작용으로 증명하는 마커**다. 진단 환경에서도 같은 이유로 설정 파일이나 키 파일을 먼저 건드리지 않고 이 파일로 성립 여부만 확인하는 편이 안전하다.

방어의 방향도 여기서 정해진다. 입력에서 `../`를 찾아 지우는 것이 아니라, 조립된 경로를 정규화한 뒤 그 결과가 기준 디렉터리 하위인지 확인해야 한다. 다음 랩들은 이 순서를 지키지 않은 검증이 어떤 식으로 하나씩 무너지는지를 보여준다.
