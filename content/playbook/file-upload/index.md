+++
date = '2026-10-09T21:10:00+09:00'
draft = false
title = '[Playbook] File Upload 진단 Cheat Sheet'
summary = "File Upload 진단 중 파일명·MIME 타입·본문의 검증을 분리하고 저장 경로·실행 설정·검증 시점에 따라 다음 확인을 고르기 위한 Playbook"
toc = true
tags = ["File Upload", "Web Shell", "Playbook", "Cheat Sheet", "Testing Workflow"]
+++

---

이 문서는 File Upload 진단 중 **업로드 거부, 파일 저장, 코드 실행을 각각 판별하고 관찰한 조건에 맞춰 다음 시도를 고르기 위한 빠른 참고서**다. 유형별 원리와 상세 풀이는 [File Upload Lab](/lab/portswigger-file-upload/)과 관련 Write-up으로 연결한다.

## 30초 진단 흐름

1. 정상 파일을 업로드하고 저장된 파일의 **GET 요청까지** 확보한다.
2. 파일명·파일 부분의 MIME 타입·본문을 각각 바꿔 거부 조건을 나눈다.
3. 업로드된 파일을 조회해 원문 반환과 코드 실행 결과를 구분한다.
4. 원문이면 저장 위치와 실행 설정, 거부되면 오류가 가리키는 검증을 확인한다.
5. 검증·삭제가 업로드 이후라면 공개되는 시간대를 확인한다.

| 관찰 결과 | 판단 | 다음 단계 |
| --- | --- | --- |
| PHP를 올리고 조회하자 실행 결과가 돌아옴 | 업로드와 서버 측 실행 성립 | 실행 범위와 랩 목표 확인 |
| 파일 부분의 MIME 타입만 바꾸면 통과 | 선언된 타입에 검증이 의존할 가능성 | 동일한 파일명·본문으로 GET 결과 비교 |
| PHP 코드가 그대로 보임 | 현재 경로에서는 원문 제공 | 저장 경로 변경 가능성과 디렉터리별 실행 차이 확인 |
| `.php`는 거부, 다른 확장자는 저장됨 | 특정 확장자 차단 가능성 | 허용된 확장자의 처리 방식 확인 |
| JPG·PNG만 허용한다는 응답 | 파일명 또는 내용의 이미지 검사 | 이름·MIME·내용을 분리해 거부 조건 좁히기 |
| 요청한 이름과 저장된 이름이 다름 | 디코딩·제거·재명명 발생 | 입력 이름, 응답 이름, 최종 조회 경로 비교 |
| 정상 이미지는 되고 PHP 본문은 거부됨 | 내용 검사 가능성 | 시그니처·전체 디코딩·재생성 여부 확인 |
| 업로드 중에는 조회되지만 이후 사라짐 | 검증 전 공개되는 중간 상태 가능성 | 저장·검사·삭제 순서와 조회 응답 재확인 |

## 1. 업로드와 조회 기준선 확보

정상 업로드 요청을 Repeater에 보관하고, 계정 페이지나 응답에서 찾은 파일 조회 요청을 별도 탭에 둔다.

| 기록할 항목 | 확인할 내용 |
| --- | --- |
| 업로드 엔드포인트 | 세션·CSRF 토큰·파일 필드 이름 |
| 요청의 파일 이름 | 이름과 확장자, 경로 구분자 포함 여부 |
| 파일 부분의 `Content-Type` | `image/png`·`image/jpeg` 등 선언한 타입 |
| 업로드 응답 | 오류 문구, 저장 이름, 상태 코드 |
| 조회 URL | 원본 이름 유지, 재명명, 별도 호스트 사용 여부 |
| 조회 응답 | 상태 코드·본문·타입·다운로드 처리 여부 |

- 새 시도에는 식별 가능한 파일 이름이나 본문 마커를 사용해 이전에 올린 파일과 구분한다.
- 업로드 성공 안내가 돌려준 경로와 실제 파일 조회 결과를 함께 남긴다.
- 캐시된 이미지와 새 파일을 혼동하지 않도록 응답 본문을 비교한다.

## 2. 검증이 보는 입력 분리

요청 전체의 `Content-Type: multipart/form-data`를 유지하고, 본문 안의 파일 부분을 변경한다.

| 변경할 값 | 유지할 값 | 비교할 결과 |
| --- | --- | --- |
| 확장자 | 파일 내용·파일 부분 MIME 타입 | 확장자 오류와 최종 저장 이름 |
| 파일 부분 MIME 타입 | 파일 이름·내용 | 같은 바이트를 다른 타입으로 선언했을 때 허용 여부 |
| 파일 내용 | 파일 이름·MIME 타입 | 실제 이미지 구조 검사 여부 |
| 파일명에 포함한 경로 | 확장자·내용 | 저장 위치와 조회 가능한 URL |

거부 문구가 바뀌면 다른 검증 단계에 도달했을 수 있다. 예를 들어 확장자 오류가 사라진 뒤 이미지 내용 오류가 나오면, 다음 시도는 내용 검사에 맞춰 진행한다.

MIME 선언에 의존하는 사례는 [Content-Type restriction bypass](/write-up/portswigger/file-upload/web-shell-upload-via-content-type-restriction-bypass/)에서 확인할 수 있다.

## 3. 저장 결과와 실행 결과 판정

실행 여부는 일정한 결과를 출력하는 코드로 비교할 수 있다.

```php
<?php echo 'upload-check-' . (6 * 7); ?>
```

| GET 응답 | 확인된 것 | 다음 확인 |
| --- | --- | --- |
| `upload-check-42` | PHP 코드 실행 | 실행 프로세스 권한과 진단 대상 영향 |
| `<?php ... ?>`가 그대로 보임 | 파일 저장과 원문 조회 | 해당 디렉터리의 실행 설정 |
| 404 | 요청 경로에서 찾지 못함 | 재명명·저장 경로·검증 후 삭제 여부 |
| 403 | 조회 단계의 접근 제한 | 업로드 응답과 조회 인증 조건 |
| 500 | 서버 처리 오류 | 오류 본문과 설정·구문 변경의 영향 |

- `200`과 `Content-Type`만으로 실행 여부를 확정하지 않고 본문을 확인한다.
- 단순 업로드부터 실행까지 연결한 흐름은 [Remote code execution via web shell upload](/write-up/portswigger/file-upload/remote-code-execution-via-web-shell-upload/)에 정리했다.

## 4. 저장 경로와 실행 설정

파일을 올릴 수 있지만 원문으로 보인다면 저장 위치를 확인한다.

| 관찰 | 다음 시도 | 판정 기준 |
| --- | --- | --- |
| 파일 이름이 그대로 URL에 반영됨 | `../`를 포함한 이름의 저장 결과 확인 | 요청·응답·GET에서 가리키는 경로 비교 |
| 경로를 붙여도 원래 디렉터리에 저장됨 | `%2f` 등 인코딩된 구분자 처리 확인 | 디코딩 후 상위 경로로 저장되는지 |
| 상위 경로에 같은 코드가 저장됨 | 기존 경로와 새 경로의 GET 응답 비교 | 원문에서 실행 결과로 바뀌는지 |

`..%2ffake-image.php`로 `/files/avatars/` 밖에 저장한 과정은 [path traversal](/write-up/portswigger/file-upload/web-shell-upload-via-path-traversal/)에 정리했다. 저장 성공 문구에 경로가 찍혀도 실제 위치와 다를 수 있으므로 최종 GET으로 확인한다.

## 5. 확장자 검증과 설정 파일

확장자가 거부되는 경우에는 파일을 검사하는 규칙과 서버가 실행하는 규칙을 나누어 본다.

| 관찰 | 다음 확인 | 관련 실습 |
| --- | --- | --- |
| `.php`는 거부되고 `.php5`·`.php7`은 저장됨 | 각 확장자를 실행하는 처리기가 연결되어 있는지 GET 비교 | [extension blacklist bypass](/write-up/portswigger/file-upload/web-shell-upload-via-extension-blacklist-bypass/) |
| Apache이며 `.htaccess`도 저장 가능 | 해당 디렉터리에서 설정 지시문이 적용되는지 확인 | [extension blacklist bypass](/write-up/portswigger/file-upload/web-shell-upload-via-extension-blacklist-bypass/) |
| `.php%00.png`는 통과하고 이름이 바뀜 | `fake-image.php` 등 최종 저장 이름으로 조회 | [obfuscated file extension](/write-up/portswigger/file-upload/web-shell-upload-via-obfuscated-file-extension/) |

- `.htaccess` 방식은 파일 저장, 지시문 허용, PHP 처리기 연결이 함께 필요하다. 랩에서는 `AddType application/x-httpd-php .file`이 적용된 뒤 `.file`이 실행됐다.
- 인코딩·잘림은 처리 구현에 따라 달라진다. `%00`을 넣었다는 사실보다 **서버가 어떤 이름을 저장했고 그 파일을 어떻게 처리했는지**가 판단 근거다.
- 서버가 파일명을 새로 생성한다면 원본 이름의 우회 문자열이 최종 경로에도 전달되는지 먼저 확인한다.

## 6. 내용 검사와 파일 변환

이름과 MIME 타입을 맞춰도 거부된다면 본문을 처리하는 단계를 살펴본다.

| 비교 | 살펴볼 차이 | 다음 판단 |
| --- | --- | --- |
| 정상 이미지와 임의 텍스트 | 파일 내용에 따른 허용·거부 | 내용 검사가 있는지 |
| 시그니처를 붙인 본문과 정상 이미지 | 앞부분의 형식 표식만으로 통과하는지 | 구조 검사의 범위 |
| 원본 이미지와 내려받은 이미지 | 메타데이터·크기·바이트가 달라졌는지 | 재인코딩·재생성 여부 |
| 코드가 포함된 파일의 저장·조회 | PHP 부분이 보존되고 실행되는지 | 내용 검사와 실행 설정의 결합 |

- PNG 시그니처를 붙여 통과한 기록은 [polyglot web shell upload](/write-up/portswigger/file-upload/remote-code-execution-via-polyglot-web-shell-upload/)에서 다룬다. [공식 풀이](https://portswigger.net/web-security/file-upload/lab-file-upload-remote-code-execution-via-polyglot-web-shell-upload)는 JPEG 메타데이터를 사용한다.
- 서버가 이미지를 재생성한다면 업로드 전후 파일을 비교한다. 코드가 검사 단계에서 거부됐는지, 변환 과정에서 제거됐는지에 따라 다음 판단이 달라진다.

## 7. 검증 전 공개와 Race Condition

검사 후 파일을 삭제하는 구조라면 업로드 요청의 최종 응답과 검사 중 조회 결과를 나누어 본다.

1. 업로드할 파일명과 조회 URL을 확정한다.
2. 업로드 POST와 같은 파일의 GET을 준비한다.
3. 업로드 처리 중 GET이 도달하도록 요청하고 응답들을 비교한다.
4. 반환된 내용이 이번 파일의 실행 결과인지 확인한다.
5. 이후 파일이 사라지는지까지 기록해 검증·삭제 흐름과 연결한다.

| 결과 | 판단 |
| --- | --- |
| 업로드 거부 + 처리 중 실행 결과 반환 | 검사 완료 전에 파일이 실행 가능한 상태로 공개됨 |
| 처리 중 조회 가능 + 이후 404 | 잠시 노출된 뒤 삭제되는 흐름과 일치 |
| GET 모두 404 | 해당 요청들에서는 접근 가능한 시점을 확인하지 못함 |
| 계속 같은 파일 반환 | 이전 파일·캐시·실제 저장 결과를 다시 확인 |

주어진 코드의 저장 → 검사 → 삭제 순서와 조회 결과를 연결한 풀이는 [race condition](/write-up/portswigger/file-upload/web-shell-upload-via-race-condition/)에 정리했다.

## Quick Checklist

- [ ] 업로드 요청과 파일 조회 요청을 함께 확보했는가?
- [ ] 파일명·파일 부분의 MIME 타입·본문을 한 번에 하나씩 바꿨는가?
- [ ] 검증 오류가 어느 입력에 따라 바뀌는지 기록했는가?
- [ ] 업로드 성공과 서버 측 코드 실행을 각각 확인했는가?
- [ ] 요청한 파일명·응답의 파일명·조회 경로를 비교했는가?
- [ ] 코드가 원문으로 보인다면 저장 위치와 실행 설정을 확인했는가?
- [ ] 허용된 변형 확장자가 실제로 실행되는지 확인했는가?
- [ ] 설정 파일 업로드와 그 설정이 적용되는 조건을 함께 봤는가?
- [ ] 이미지 내용 검사와 업로드 후 재생성을 구분했는가?
- [ ] 검사 중 공개되는 파일과 검사 후 삭제된 파일의 상태를 비교했는가?
- [ ] 최종 결과가 이번 요청의 파일에서 나온 것인지 확인했는가?

---

> 참고자료  
> https://portswigger.net/web-security/file-upload/  
> https://portswigger.net/web-security/file-upload/lab-file-upload-web-shell-upload-via-race-condition  
> https://httpd.apache.org/docs/2.4/mod/core.html#allowoverride  
