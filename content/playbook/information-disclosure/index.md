+++
date = '2026-08-04T21:00:00+09:00'
draft = false
title = '[Playbook] Information Disclosure 진단 Cheat Sheet'
summary = "Information Disclosure 진단 중 오류·주석·디버그·백업·HTTP 메서드·Git 히스토리의 단서를 분류하고 영향 확인 방향을 고르기 위한 Playbook"
toc = true
tags = ["Information Disclosure", "Sensitive Data Exposure", "Playbook", "Cheat Sheet", "Testing Workflow"]
+++

---

이 문서는 Information Disclosure 진단 중 **응답에 남은 단서를 노출 경로별로 분류하고, 그 정보가 어떤 영향으로 연결되는지 판단해 다음 확인을 고르기 위한 빠른 참고서**다. 유형별 원리와 대응 방안은 [Information Disclosure Note](/note/portswigger-information-disclosure/)에 정리했다.

## 30초 진단 흐름

1. 정상 요청과 응답을 저장하고 HTML·주석·헤더·쿠키·오류 본문을 분리해 본다.
2. 파라미터 타입·경계·존재 여부를 하나씩 바꾸어 **정보성 응답**을 유도한다.
3. 페이지 소스와 `/robots.txt`·`/sitemap.xml`에서 보이지 않는 경로 힌트를 찾는다.
4. 백업 확장자, 디렉터리 인덱싱, 진단 메서드, 버전 관리 메타데이터를 각각 확인한다.
5. 발견한 정보를 공개 취약점·자격증명·인증 판단·과거 이력과 연결해 실제 영향을 판단한다.

| 관찰 결과 | 판단 | 다음 단계 |
| --- | --- | --- |
| 잘못된 타입에 스택 트레이스 표시 | 상세 오류 노출 | 제품·버전·내부 경로를 분류 |
| HTML 주석에 디버그 링크 | 내부용 페이지 배포 | 접근 제어와 환경 정보 노출 범위 확인 |
| `robots.txt`에 미노출 디렉터리 | 공개 힌트 | 직접 요청 후 실제 접근 제어를 별도 판단 |
| 디렉터리 목록에 `.bak`·`.old`·`~` | 백업 파일 노출 | 소스·설정·하드코딩 여부 확인 |
| `TRACE` 응답에 원본에 없던 헤더 | 중간 계층의 내부 헤더 | 헤더의 위조 가능성과 인증 판단 사용 여부 확인 |
| `/.git/HEAD`·`/.git/logs/` 응답 | 버전 관리 이력 노출 | 최소 이력에서 삭제된 비밀값 여부 확인 |
| 현재 파일에는 없는 키가 과거 커밋에 있음 | 삭제로 폐기되지 않음 | 비밀값 교체 여부를 최우선 확인 |

## 1. 응답 기준선 만들기

정상 상태, 존재하지 않는 값, 타입이 다른 값, 파라미터를 삭제한 요청을 별도로 남긴다.

| 비교 항목 | 확인할 내용 |
| --- | --- |
| 상태 코드·리다이렉트 | 검증 실패와 내부 예외가 다른 경로인지 |
| `Content-Type`·길이 | 화면은 같지만 본문 구조가 다른지 |
| 오류 문구 | 클래스·파일 경로·DB 이름·파라미터 타입이 보이는지 |
| 응답 헤더·쿠키 | 내부 호스트, 버전, 디버그 상태가 담겼는지 |
| 처리 시간 | 본문이 같아도 다른 내부 처리가 수행되는지 |

- 한 번에 조건 하나만 바꾸어 응답 차이의 원인을 분리한다.
- 스택 트레이스에서 프레임워크 이름과 버전을 얻었다면 해당 버전에 실제 영향을 주는 공개 취약점이 있는지를 별도로 검증한다.
- 타입 오류로 Apache Struts 2 2.3.31을 확인한 흐름은 [Information disclosure in error messages](/write-up/portswigger/information-disclosure/information-disclosure-in-error-messages/)에서 다룬다.

## 2. 주석·디버그 페이지 확인

렌더링된 화면만 보지 말고 원본 HTML, JavaScript 번들, source map 참조, 주석을 본다. `debug`, `test`, `internal`, `todo`, `secret`, `key`, `password`, `cgi-bin`은 빠르게 분류할 키워드다.

1. 주석이 가리키는 경로를 본다.
2. 해당 경로의 인증 유무를 확인한다.
3. 설정·모듈·경로·환경 변수가 표시되는지 분류한다.
4. 노출된 값이 일반 설정인지 자격증명·암호화 키인지, 어느 컴포넌트에서 쓰이는지를 분류한다.

HTML 주석에서 `/cgi-bin/phpinfo.php`를 찾고 `SECRET_KEY`를 확인한 흐름은 [Information disclosure on debug page](/write-up/portswigger/information-disclosure/information-disclosure-on-debug-page/)에 정리했다.

## 3. 공개 힌트·디렉터리·백업 파일

`/robots.txt`와 `/sitemap.xml`은 경로 목록을 얻는 출발점이다. `Disallow: /backup`은 탐색 자동화에게 수집하지 말라는 힌트일 뿐이며, 사용자 요청을 거부하는 접근 제어가 아니다.

| 관찰 | 가설 | 변경·확인 |
| --- | --- | --- |
| 원본 파일 이름이 보임 | 편집기·배포가 사본을 남겼을 수 있음 | `.bak`, `.old`, `~`, `.swp` 사본 여부 |
| 디렉터리 목록이 보임 | 인덱스 파일 없이 목록 기능이 켜짐 | 실행 파일과 설정·백업 사본 구분 |
| 소스가 텍스트로 반환됨 | 백업 소스가 정적 파일로 배포됨 | DB 접속 정보·API 키·내부 로직 분류 |

랩에서 `/backup`을 직접 확인하고 `ProductTemplate.java.bak`의 DB 비밀번호로 연결한 과정은 [Source code disclosure via backup files](/write-up/portswigger/information-disclosure/source-code-disclosure-via-backup-files/)에 정리했다.

## 4. HTTP 메서드·프록시 헤더

지원되는 HTTP 메서드를 확인하고, `TRACE`가 켜져 있다면 서버가 실제로 받은 요청을 반사하는지 본다. 원본 요청에 없던 헤더가 보이면 로드 밸런서·CDN·리버스 프록시가 추가한 값일 수 있다.

- 헤더 이름이 노출됐다는 사실과 권한 우회가 된다는 사실을 구분한다.
- 외부 요청자가 같은 헤더를 직접 지정할 수 있고, 원본 서버가 그 값을 권한 판단에 사용할 때 결함이 완성된다.
- `X-Custom-IP-Authorization: 127.0.0.1`로 관리자 패널에 접근한 흐름은 [Authentication bypass via information disclosure](/write-up/portswigger/information-disclosure/authentication-bypass-via-information-disclosure/)에서 다룬다.

## 5. 버전 관리 메타데이터

`/.git/HEAD`, `/.git/config`, `/.git/logs/HEAD`가 반환되면 웹 루트에 Git 메타데이터가 배포된 것이다. 로그가 가리키는 commit·tree·blob 객체까지 접근되는지 보고 복구 가능한 이력의 범위를 판단한다.

1. 로그와 `COMMIT_EDITMSG`에서 `remove`, `password`, `secret`, `key`, `config`가 들어간 변경을 찾는다.
2. 현재 트리와 해당 커밋의 트리를 비교한다.
3. 삭제된 비밀값이 어느 시스템에서 쓰였는지, 현재 설정에서 교체됐는지를 확인한다.
4. 히스토리 재작성은 추가 노출을 줄이지만, 이미 복제된 히스토리와 캐시에서 비밀값을 폐기하지 못한다.

Git 객체를 zlib로 직접 풀어 commit → tree → `admin.conf` blob을 따라간 방법은 [Information disclosure in version control history](/write-up/portswigger/information-disclosure/information-disclosure-in-version-control-history/)에 정리했다.

## 6. 영향 판단

| 관찰한 정보 | 영향 판단 기준 | 다음 확인 |
| --- | --- | --- |
| 프레임워크·서버 버전 | 현재 패치 상태와 해당 버전의 공개 취약점 | 제조사 보안 공지·운영 설정 |
| 내부 경로·클래스·DB 스키마 | 경로와 컴포넌트가 외부 입력에서 도달 가능한지 | 관련 엔드포인트·정적 파일·오류 분기 |
| 자격증명·암호화 키 | 값의 유효 기간, 권한, 적용 컴포넌트 | 발급 주체·사용 범위·교체 상태 |
| 내부 인증 헤더 | 외부 요청자의 지정 가능성과 프록시 신뢰 경계 | 원본 서버의 헤더 신뢰·덮어쓰기 로직 |
| 소스·Git 히스토리 | 외부에서 복구할 수 있는 현재·과거 소스의 범위 | 하드코딩 비밀값·숨은 기능·비밀값 교체 상태 |

- 정리할 때는 **관찰한 응답 → 세운 가설 → 바꾼 요청 → 확인한 결과 → 근본 원인** 순서를 유지한다.
- 현재 배포본에서 발견한 값인지 과거 커밋에만 남은 값인지를 구분한다.
- 자격증명과 키는 노출 위치, 사용 주체, 권한 범위, 교체 상태를 하나의 흐름으로 본다.

유형별 상세 풀이는 [Information Disclosure Write-up 아카이브](/write-up/portswigger/information-disclosure/)에서 확인할 수 있다.

## Quick Checklist

- [ ] 정상·타입 변경·존재하지 않는 값·파라미터 삭제 응답을 비교했는가?
- [ ] 상태 코드, 리다이렉트, 본문 길이, 오류 문구, 처리 시간을 나란히 봤는가?
- [ ] 렌더링된 화면 외에 HTML 소스·주석·JavaScript·헤더·쿠키를 확인했는가?
- [ ] `/robots.txt`와 `/sitemap.xml`의 경로를 접근 제어가 아닌 공개 힌트로 확인했는가?
- [ ] 디렉터리 인덱싱과 `.bak`·`.old`·`~`·`.swp` 사본을 확인했는가?
- [ ] 디버그 페이지에서 환경 변수·자격증명·암호화 키 노출을 분류했는가?
- [ ] `TRACE`·응답 헤더에서 중간 계층이 추가한 내부 헤더를 확인했는가?
- [ ] 내부 헤더의 노출과 실제 위조·권한 우회 가능성을 구분했는가?
- [ ] `/.git/HEAD`·설정·로그가 가리키는 관련 객체까지 접근되는지 확인했는가?
- [ ] 현재 파일에서 삭제된 비밀값이 히스토리에 남는다는 점을 반영했는가?
- [ ] 노출된 비밀값의 최우선 조치를 폐기·교체로 기록했는가?
- [ ] 정보 자체와 그 정보로 연결되는 실제 영향을 분리해 보고했는가?
- [ ] 노출 정보의 위치·사용 주체·유효성·권한 범위를 함께 확인했는가?
