+++
date = '2026-10-08T20:30:00+09:00'
draft = false
title = '[Lab] PortSwigger - File Upload 토픽 정리 및 실습'
summary = "파일 업로드의 검증·저장·실행 과정과 Content-Type, 저장 경로, 확장자, 서버 설정, 파일 내용, 검증 시점에서 발생하는 취약점을 7개 실습으로 정리한 자료"
toc = true
tags = ["File Upload", "Web Shell", "Path Traversal", "Race Condition", "PortSwigger"]
+++

---

## 들어가며

프로필 사진을 바꾸면 브라우저는 이미지 파일을 서버로 보내고, 서버는 저장한 이미지의 주소를 돌려준다. 이후 그 주소로 다시 요청하면 업로드한 사진이 보인다. 이번 실습도 이 익숙한 기능에서 시작한다.

그렇다면 이미지 대신 PHP 코드를 보냈을 때는 어떻게 될까? 파일을 거부할 수도 있고, 저장한 내용을 그대로 보여 줄 수도 있다. PHP가 실행되어 결과가 돌아오는 경우도 있다. 같은 업로드 기능이지만 **어떤 파일을 받아들이고, 어디에 저장하며, 저장한 파일을 어떻게 처리하는지**에 따라 결과가 달라지는 것이다.

이 글에서는 PortSwigger의 File Upload 랩 7개를 통해 그 차이가 생기는 지점을 정리한다. 각 요청과 응답을 따라가는 상세 풀이는 별도의 Write-up으로 연결한다.

---

## File Upload 취약점이란?

File Upload 취약점은 사용자가 보낸 파일의 이름·내용·크기·저장 위치 등을 충분히 제한하지 못해 의도하지 않은 파일 처리가 가능해지는 문제다. 이미지 기능으로 서버 코드를 실행하거나, 업로드 경로를 벗어나 파일을 저장하는 경우가 여기에 해당한다.

이번 랩의 목표는 PHP 파일을 업로드한 뒤 `/home/carlos/secret`의 내용을 읽는 것이다. 이를 위해서는 다음 조건이 이어져야 한다.

| 단계 | 필요한 조건 | 확인할 결과 |
| --- | --- | --- |
| 업로드 | 실행할 코드가 검증을 통과하거나 검증 전에 저장됨 | 업로드 응답과 저장된 이름 |
| 접근 | 저장한 파일을 요청할 경로를 알 수 있음 | 계정 페이지의 이미지 URL과 GET 응답 |
| 실행 | 해당 경로의 파일이 PHP 처리기로 전달됨 | 코드가 생성한 출력 |
| 파일 읽기 | 실행 프로세스에 대상 파일을 읽을 권한이 있음 | 랩에서 지정한 파일의 내용 |

어느 단계에서 막혔는지 확인하면 다음 시도도 좁혀진다. 업로드 자체가 거부되면 검증 조건을 살펴보고, PHP 코드가 텍스트로 반환되면 저장 경로의 실행 설정을 살펴보는 식이다.

---

## 업로드 요청에서 서버가 받는 것

랩의 아바타 업로드는 `multipart/form-data` 요청을 사용한다. 요청 전체의 `Content-Type`은 본문이 여러 부분으로 나뉜다는 것을 나타내고, 파일 부분에는 별도의 이름과 타입이 들어 있다.

파일 부분을 보면 다음과 같다.

```text
Content-Disposition: form-data; name="avatar"; filename="fake-image.php"
Content-Type: image/png

<?php phpinfo(); ?>
```

여기서 `avatar`는 폼 필드 이름, `fake-image.php`는 전송한 파일 이름이다. `image/png`는 클라이언트가 지정한 타입이며 그 아래가 실제 파일 내용이다. Burp Repeater에서는 세 값을 각각 바꿀 수 있다.

| 입력 | 랩에서 바꾼 값 | 살펴볼 처리 |
| --- | --- | --- |
| 파일 이름 | `.php`, `.file`, `.php%00.png` | 확장자 검사와 최종 저장 이름 |
| 파일 부분의 타입 | `image/png` | 클라이언트가 선언한 MIME 타입에 대한 의존 |
| 파일 내용 | PHP 코드, 이미지 시그니처와 PHP 코드 | 파일 내용 검사와 이후 실행 |
| 파일 이름의 경로 | `..%2ffake-image.php` | 저장 디렉터리 결정과 디코딩 |

이번 실습에서 반복되는 문제는 **검증할 때 사용한 정보와 파일을 저장·실행할 때 사용한 정보가 어긋난다**는 점이다. 타입을 보고 이미지로 받아들인 파일이 `.php`라는 이름으로 저장되고, 이후 요청에서는 PHP 처리기로 넘어가는 흐름이 대표적이다.

---

## 취약점 유형과 우회

### 1. 검증 없이 저장되는 파일

[Remote code execution via web shell upload](/write-up/portswigger/file-upload/remote-code-execution-via-web-shell-upload/)에서는 파일 내용을 `image`라는 텍스트로 보내도 업로드가 됐다. 이후 파일 이름을 `phpinfo.php`, 내용을 `<?php phpinfo(); ?>`로 변경하자 `/files/avatars/phpinfo.php`에서 PHP 정보 페이지가 반환됐다.

이 결과로 파일 저장과 PHP 실행이 모두 가능함을 확인했다. 다음에는 랩의 대상 파일을 읽는 코드를 업로드해 내용을 확인할 수 있다. 실행되는 코드는 웹 애플리케이션 프로세스의 권한을 따르므로, 읽을 수 있는 파일의 범위도 그 권한에 의해 결정된다.

### 2. 파일 부분의 Content-Type 신뢰

[Web shell upload via Content-Type restriction bypass](/write-up/portswigger/file-upload/web-shell-upload-via-content-type-restriction-bypass/)에서는 이미지 타입만 허용한다고 안내한다. 하지만 원래 업로드 요청의 `Content-Type: image/png`를 유지하면서 파일 이름과 본문만 PHP로 바꾸면 업로드와 실행이 가능했다.

검증 코드가 받은 타입은 여전히 `image/png`다. 이 값과 실제 파일 내용이 일치하는지 확인하지 않으면, 공격자가 직접 붙인 설명을 근거로 파일을 허용하게 된다. [공식 풀이](https://portswigger.net/web-security/file-upload/lab-file-upload-web-shell-upload-via-content-type-restriction-bypass)에서도 파일 부분의 MIME 타입을 바꾸는 방식으로 같은 조건을 확인한다.

### 3. 실행 제한이 다른 디렉터리로 이동

[Web shell upload via path traversal](/write-up/portswigger/file-upload/web-shell-upload-via-path-traversal/)에서는 PHP 파일 업로드까지는 가능했지만 `/files/avatars/`에서 요청하면 코드가 그대로 보였다.

![avatars 디렉터리에서 텍스트로 반환된 PHP 코드](images/php-source-in-avatars.png)

파일 내용을 바꿀 필요는 없었다. 이름에 경로를 넣어 실행 설정이 다른 위치에 저장할 수 있는지가 다음 확인 대상이다. 일반적인 `../`를 넣었을 때는 기존 아바타 경로에 파일이 남았고, 슬래시를 인코딩한 `..%2ffake-image.php`로 보내자 `/files/fake-image.php`에서 PHP가 실행됐다.

![상위 files 디렉터리에서 실행된 phpinfo](images/php-execution-in-files.png)

두 화면의 차이는 같은 코드가 어느 디렉터리에 저장되었는지다. 업로드 시 파일명에 포함된 경로를 제한하는 처리와 이후 디코딩이 일관되지 않아 저장 위치가 달라졌고, 그 위치의 실행 설정이 적용됐다. 경로가 해석되는 과정은 [Path Traversal Lab](/lab/portswigger-path-traversal/)과도 연결된다.

### 4. 설정 파일로 확장자 처리 변경

`.php`를 거부하는데 다른 확장자는 허용한다면, 허용된 확장자를 서버가 어떻게 처리하는지 확인하게 된다. [Web shell upload via extension blacklist bypass](/write-up/portswigger/file-upload/web-shell-upload-via-extension-blacklist-bypass/)에서는 `.php5`와 `.php7` 업로드가 가능했지만 PHP는 실행되지 않았다.

이 랩에서는 `.htaccess`도 업로드할 수 있었다. 다음 내용을 저장한 뒤 PHP 코드를 `.file` 확장자로 올리자 실행 결과가 반환됐다.

```apache
AddType application/x-httpd-php .file
```

업로드한 설정이 해당 디렉터리의 `.file`을 PHP로 처리하도록 연결한 것이다. 이 흐름에는 Apache가 해당 `.htaccess`의 지시문을 허용하고, 지정한 타입을 처리할 PHP 모듈이 연결되어 있다는 조건이 필요하다. 디렉터리별 설정 허용 범위는 Apache의 [AllowOverride 문서](https://httpd.apache.org/docs/2.4/mod/core.html#allowoverride)에서 확인할 수 있다.

즉 실행 파일의 확장자를 제한하더라도, **확장자의 의미를 바꾸는 설정 파일을 업로드할 수 있으면** 같은 위치에 저장한 다른 파일의 처리 방식까지 바뀐다.

### 5. 검증한 확장자와 저장된 확장자의 차이

[Web shell upload via obfuscated file extension](/write-up/portswigger/file-upload/web-shell-upload-via-obfuscated-file-extension/)에서는 `.php` 요청에 JPG와 PNG만 허용한다는 응답이 돌아왔다. 파일 이름을 `fake-image.php%00.png`로 바꾸면 업로드가 되었고, 이후 `fake-image.php`로 요청했을 때 PHP 실행 결과를 확인했다.

| 확인 시점 | 이름 |
| --- | --- |
| 업로드 요청 | `fake-image.php%00.png` |
| 이후 접근한 파일 | `fake-image.php` |

허용 확장자가 붙은 입력과 최종적으로 접근하는 파일명이 달라진 것이다. `%00` 처리와 파일명 잘림은 서버 구현에 따라 달라지므로, 진단에서는 업로드 응답에 표시된 이름과 실제 조회 경로를 함께 비교해야 한다. [공식 풀이](https://portswigger.net/web-security/file-upload/lab-file-upload-web-shell-upload-via-obfuscated-file-extension)도 이 이름의 변화를 우회가 성립한 단서로 사용한다.

### 6. 이미지 내용 검사와 PHP 실행의 결합

[Remote code execution via polyglot web shell upload](/write-up/portswigger/file-upload/remote-code-execution-via-polyglot-web-shell-upload/)에서는 이름과 `Content-Type`을 이미지처럼 지정해도 본문이 단순 텍스트이면 거부됐다. 앞의 MIME 타입 랩보다 파일 내용을 더 살펴보는 것이다.

풀이에서는 PHP 코드 앞에 PNG 시그니처 `89 50 4E 47 0D 0A 1A 0A`를 넣었고, 그 파일을 `.php`로 업로드해 실행 결과를 확인했다. 이때 드러나는 문제는 내용 검사를 통과한 파일이 그대로 PHP 실행 경로에 도달한다는 점이다.

같은 주제를 다루는 [공식 풀이](https://portswigger.net/web-security/file-upload/lab-file-upload-remote-code-execution-via-polyglot-web-shell-upload)는 정상 JPEG의 메타데이터에 PHP 코드를 넣는 방법을 사용한다. 하나의 파일이 이미지로 처리될 수 있는 구조를 유지하면서 PHP 코드도 담는 방식이다. 이미지 시그니처 확인, 이미지 전체 디코딩, 이미지 재생성은 서로 다른 처리이므로 어떤 단계까지 수행하는지에 따라 남는 내용도 달라진다.

### 7. 검증이 끝나기 전에 공개되는 파일

앞의 랩들이 검증 조건을 바꾸는 문제였다면, [Web shell upload via race condition](/write-up/portswigger/file-upload/web-shell-upload-via-race-condition/)은 처리 순서에서 문제가 생긴다. 주어진 코드는 먼저 파일을 아바타 디렉터리로 옮긴 후 바이러스와 확장자를 확인하고, 검사에 실패하면 삭제한다.

```text
업로드 요청: 파일 저장 ───── 검사 진행 ───── 검사 실패 → 파일 삭제
조회 요청:                  GET 요청
                              ↓
                         저장된 PHP 실행
```

파일이 저장된 시점부터 삭제되는 시점까지는 URL로 접근할 수 있다. 풀이에서도 업로드와 조회 요청을 준비한 뒤 빠르게 이어 보내자, 파일이 삭제되기 전에 실행되어 대상 파일의 내용이 반환됐다.

따라서 업로드 요청의 최종 응답이 거부여도 중간 상태에서 파일이 노출될 수 있다. 검증이 끝나기 전 파일을 외부에서 요청할 수 있는지가 이 랩의 핵심이다.

---

## 진단 방법

진단에서는 업로드 요청과 파일 조회 요청을 한 쌍으로 확보한다. 이후 한 번에 조건 하나씩 바꾸며 어느 처리 단계의 결과가 달라졌는지 확인한다.

1. **정상 저장 흐름을 확인한다.** 파일 이름이 유지되는지, 서버가 새 이름을 부여하는지, 계정 페이지에서 어떤 URL로 파일을 조회하는지 기록한다.
2. **입력별 검증을 나눈다.** 파일 이름·파일 부분의 MIME 타입·본문을 각각 바꿔 거부 조건을 좁힌다.
3. **저장과 실행 결과를 연결한다.** 저장한 URL에서 원문이 반환되는지, 코드가 생성한 결과가 반환되는지 확인한다.
4. **검증 후 변화를 확인한다.** 인코딩된 이름이 어떻게 저장되는지, 이미지가 재생성되는지, 디렉터리가 바뀌는지 비교한다.
5. **공개 시점을 확인한다.** 파일 검사와 삭제가 있다면, 검사 중인 파일의 조회 가능성까지 살펴본다.

오류 메시지는 다음 시도를 고르는 단서다. 확장자 오류가 내용 오류로 바뀌면 첫 번째 검증을 넘어 다른 검사에 도달했을 가능성이 있다. 최종 판단은 저장된 이름·조회 경로·응답 본문을 묶어서 내린다.

관찰한 결과별 다음 선택은 [File Upload Playbook](/playbook/file-upload/)에 정리했다.

---

## 대응 방안

이번 랩에서 확인한 결함에 맞춰 대응도 검증·저장·공개·실행 단계에 나누어 적용한다.

- **필요한 파일 형식만 허용한다.** 확장자, 서버가 판별한 타입, 실제 파일 구조를 함께 검사하고 클라이언트의 MIME 타입을 그대로 신뢰하지 않는다.
- **저장 이름과 위치는 서버에서 결정한다.** 원본 이름은 표시용 정보로 다루고, 저장 경로에는 서버가 만든 식별자를 사용한다. 파일 충돌과 설정 파일 덮어쓰기도 함께 방지한다.
- **사용자 파일의 코드 실행을 차단한다.** 업로드 저장소를 웹 애플리케이션의 실행 경로와 분리하고, 그 위치에서 설정 파일로 처리 방식을 변경할 수 없게 한다.
- **검증한 파일만 공개한다.** 외부에서 접근할 수 없는 임시 저장소에서 검사한 뒤 승인된 파일을 공개한다. 저장 후 검사에 실패하면 지우는 흐름은 중간 노출을 남긴다.
- **이미지는 필요한 내용으로 재생성한다.** 이미지 디코딩 후 재인코딩하는 과정에서 불필요한 메타데이터를 제거하고, 처리 라이브러리도 최신 상태로 관리한다.
- **크기와 처리 자원을 제한한다.** 파일 크기뿐 아니라 이미지 해상도, 압축 해제 결과, 처리 시간과 저장 용량도 제한한다.

각 단계의 구현 시 고려할 사항은 [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)에 정리되어 있다.

---

## 실습

PortSwigger Web Security Academy의 File Upload 랩 7개를 처리 단계별로 정리했다.

| 유형 | Lab | 난이도 |
| --- | --- | --- |
| 검증 부재 | [Remote code execution via web shell upload](/write-up/portswigger/file-upload/remote-code-execution-via-web-shell-upload/) | APPRENTICE |
| MIME 타입 신뢰 | [Web shell upload via Content-Type restriction bypass](/write-up/portswigger/file-upload/web-shell-upload-via-content-type-restriction-bypass/) | APPRENTICE |
| 저장 경로와 실행 설정 | [Web shell upload via path traversal](/write-up/portswigger/file-upload/web-shell-upload-via-path-traversal/) | PRACTITIONER |
| 설정 파일 업로드 | [Web shell upload via extension blacklist bypass](/write-up/portswigger/file-upload/web-shell-upload-via-extension-blacklist-bypass/) | PRACTITIONER |
| 파일명 해석 차이 | [Web shell upload via obfuscated file extension](/write-up/portswigger/file-upload/web-shell-upload-via-obfuscated-file-extension/) | PRACTITIONER |
| 파일 내용 검사 | [Remote code execution via polyglot web shell upload](/write-up/portswigger/file-upload/remote-code-execution-via-polyglot-web-shell-upload/) | PRACTITIONER |
| 검증 전 파일 접근 | [Web shell upload via race condition](/write-up/portswigger/file-upload/web-shell-upload-via-race-condition/) | EXPERT |

전체 풀이는 [File Upload Write-up 아카이브](/write-up/portswigger/file-upload/)에서 확인할 수 있다.

---

## 마치며

File Upload 랩은 모두 같은 아바타 기능에서 시작하지만, 다음 시도를 결정하는 단서는 달랐다. PHP가 원문으로 보이면 저장 위치를 살펴보고, 변형 확장자가 실행되지 않으면 그 확장자를 해석하는 설정을 살펴봤다. 검사에 실패한 파일도 잠시 존재한다면 그 시간대가 새로운 접근 경로가 됐다.

핵심은 **사용자가 보낸 파일이 검증되고, 저장되고, 공개되어 처리되는 전체 과정을 따라가는 것**이다. 업로드 응답과 파일 조회 결과를 함께 보면, 어떤 검증이 작동했고 어느 단계에서 그 판단이 무너졌는지 구분할 수 있다.

---

> 참고자료  
> https://portswigger.net/web-security/file-upload/  
> https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html  
> https://httpd.apache.org/docs/2.4/mod/core.html#allowoverride  
