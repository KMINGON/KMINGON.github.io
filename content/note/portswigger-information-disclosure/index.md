+++
date = '2026-08-01T15:30:00+09:00'
draft = false
title = '[Note] PortSwigger - Information Disclosure 토픽 정리 및 실습'
summary = "Information Disclosure의 의미와 발생 원인, 오류·디버그·백업·진단 기능·Git 히스토리에서 정보가 누출되는 구조, 진단 방법과 대응 방안을 정리한 자료"
toc = true
tags = ["Information Disclosure", "Sensitive Data Exposure", "Debugging", "Version Control", "PortSwigger"]
+++

---

## 들어가며

Information Disclosure는 웹사이트가 사용자에게 보여 주지 않아야 할 정보를 의도치 않게 노출하는 취약점이다. 자격증명이나 개인정보처럼 즉시 영향을 주는 값도 있지만, 프레임워크 버전·내부 경로·커스텀 헤더 이름처럼 다음 공격의 빈칸을 채우는 기술 정보도 포함된다.

이 글에서는 오류 메시지, 디버그 페이지, 백업 파일, 진단용 HTTP 메서드, Git 히스토리로 정보가 노출되는 조건을 정리한다. 각 유형은 PortSwigger Lab에서 관찰한 흐름과 별도 Write-up으로 연결한다.

![Information Disclosure](images/information-disclosure.jpg)
*https://portswigger.net/web-security/information-disclosure*

---

## Information Disclosure란?

노출 정보는 크게 세 범주로 나눌 수 있다.

| 범주 | 예시 | 주요 영향 |
| --- | --- | --- |
| 사용자 정보 | 계정, 주소, 결제 정보 | 프라이버시 침해, 계정 탈취 |
| 비즈니스 정보 | 내부 문서, 가격 정책, 미공개 데이터 | 기밀 유출, 업무 피해 |
| 기술 정보 | 스택 트레이스, 버전, 경로, 헤더, 소스 | 공격 표면 확장, 추가 취약점 악용 |

정보가 보였다는 사실만으로 위험도를 단정하기는 어렵다. 어떤 정보인지, 누가 접근할 수 있는지, 그 정보가 인증 우회나 추가 취약점으로 연결되는지를 함께 봐야 한다. 구버전 프레임워크 이름은 혼자서는 단서이지만, 공개된 취약점과 결합되면 실제 공격 경로가 된다.

---

## 정보 노출은 왜 발생하는가

PortSwigger가 정리한 발생 원인은 다음 세 가지로 모인다.

1. **내부용 내용을 배포물에서 제거하지 못한다.** HTML 주석, 백업 파일, 소스와 버전 관리 메타데이터가 웹 루트에 남는 경우다.
2. **운영 환경에 불안전한 설정을 남겨 둔다.** 상세 오류, 디버그 페이지, 디렉터리 인덱싱, `TRACE` 메서드가 대표적이다.
3. **다른 상태를 서로 다른 응답으로 표현한다.** 오류 문구·길이·상태 코드·처리 시간의 차이가 내부 로직을 반영하면 그 차이 자체가 정보가 된다.

공통 원인은 **운영 사용자에게 필요한 최소 정보와 개발·운영자에게 필요한 상세 정보의 경계가 분리되지 않았다**는 점이다.

---

## 노출 채널과 관찰 포인트

정보는 화면에 보이는 문장으로만 나오지 않는다. 정상 페이지도 응답 계층을 나누어 보면 다른 단서를 제공한다.

| 채널 | 관찰 포인트 | 노출될 수 있는 정보 |
| --- | --- | --- |
| HTML·JavaScript | 주석, 숨겨진 링크, source map | 디버그 경로, 내부 기능, API 구조 |
| 오류 본문 | 스택 트레이스, 예외 이름, SQL 문구 | 프레임워크 버전, 파일 경로, DB 스키마 |
| 응답 헤더·쿠키 | `Server`, 디버그 플래그, 내부 호스트 | 웹 스택, 배포 구조, 세션 설정 |
| 공개 탐색 파일 | `robots.txt`, `sitemap.xml` | 화면에 연결되지 않은 경로 |
| 정적 파일 | 백업, 로그, 설정, 디렉터리 목록 | 소스, 자격증명, 서버 상태 |
| 진단 응답 | `TRACE`, 디버그·상태 페이지 | 중간 헤더, 환경 변수, 런타임 설정 |
| 버전 관리 자료 | `.git`, 커밋 로그, 객체 | 과거 소스, 삭제된 비밀값, 변경 의도 |

이 채널들은 서로 연결된다. `robots.txt`의 경로가 디렉터리 인덱싱으로 이어지고, 그 목록의 백업 파일이 소스와 DB 자격증명을 노출하는 식이다. 단서 하나를 발견했을 때는 같은 정보가 다른 채널에도 남았는지 확인한다.

---

## 영향은 어떻게 판단하는가

같은 정보도 환경에 따라 영향이 다르다. 프레임워크 버전이 최신 보안 패치를 적용한 것이라면 직접 영향은 제한적일 수 있지만, 백업 소스에 현재 사용 중인 DB 비밀번호가 있다면 노출 자체로 즉시 조치가 필요하다.

판단은 다음 질문 순서로 진행한다.

1. **민감도:** 정보 자체가 자격증명·개인정보·기업 기밀인가?
2. **접근 범위:** 인터넷의 비인증 사용자도 직접 얻을 수 있는가?
3. **유효성:** 비밀값·세션·엔드포인트가 현재도 사용되는가?
4. **연쇄 가능성:** 노출 정보가 인증 우회·추가 취약점·내부 접근의 조건을 만드는가?

---

## 주요 노출 유형과 실습

### 1. 오류 메시지의 스택·버전 정보

상세 오류는 잘못된 요청을 어떤 컴포넌트가 처리했고 어디서 실패했는지를 연속적으로 드러낸다.

| 노출 정보 | 의미 | 후속 확인 |
| --- | --- | --- |
| 제품·프레임워크 버전 | 사용 중인 기술 스택 식별 | 제조사 보안 공지·패치 상태 |
| 예외 클래스·메서드 | 내부 처리 흐름과 기대 타입 | 어떤 입력과 분기가 예외를 만드는지 |
| 파일·디렉터리 경로 | 배포 구조와 서버 내부 레이아웃 | 정적 파일·백업·설정 노출 여부 |
| 호출 스택 | 요청이 지나간 라이브러리와 계층 | 다른 응답에도 같은 상세 정보가 노출되는지 |

랩에서는 상품 조회의 `productId`를 정수에서 문자열로 바꾸자 전체 스택 트레이스가 반환됐고, 그 안에서 `Apache Struts 2 2.3.31`을 확인했다. 상세 풀이는 [Information disclosure in error messages](/write-up/portswigger/information-disclosure/information-disclosure-in-error-messages/)에 정리했다.

### 2. 디버그 페이지의 환경 정보

요청 값이나 존재하지 않는 경로를 바꾸어도 상세 오류는 나오지 않았다. 대신 페이지 소스의 HTML 주석에서 `/cgi-bin/phpinfo.php`를 가리키는 디버그 링크가 발견됐다. 해당 페이지는 PHP 설정과 환경 변수를 노출했고, 랩의 `SECRET_KEY`도 그중 하나였다.

환경 변수에 비밀값을 보관하는 것 자체가 원인은 아니다. 운영 환경에서 `phpinfo()`처럼 런타임 정보 전체를 출력하는 페이지에 외부 접근을 허용한 것이 원인이다. 상세 풀이는 [Information disclosure on debug page](/write-up/portswigger/information-disclosure/information-disclosure-on-debug-page/)에 정리했다.

### 3. 백업 파일의 소스와 자격증명

배포 과정에서 백업 소스가 웹 루트의 정적 파일로 남으면 내부 구현이 텍스트로 반환될 수 있다. 랩에서는 직접 `/backup`을 확인했을 때 디렉터리 인덱싱으로 `ProductTemplate.java.bak`가 드러났고, 파일 안의 하드코딩된 PostgreSQL 비밀번호가 노출됐다.

`robots.txt`에도 `/backup`이 표시됐지만, 이 파일은 검색 로봇에게 수집하지 말라고 요청하는 **공개 힌트**일 뿐 접근 제어가 아니다. `Disallow` 규칙이 있어도 사용자의 HTTP 요청을 막지 않는다. 상세 풀이는 [Source code disclosure via backup files](/write-up/portswigger/information-disclosure/source-code-disclosure-via-backup-files/)에 정리했다.

### 4. `TRACE`가 노출한 내부 인증 헤더

`/admin`은 로컬 사용자만 접근할 수 있다는 응답을 반환했다. 서버가 어떤 정보로 요청자의 IP를 판단하는지 확인하기 위해 `TRACE /admin`을 보내자, 서버가 수신한 요청에 프록시가 붙인 `X-Custom-IP-Authorization`이 포함되어 반사됐다.

그다음 요청에 해당 헤더를 `127.0.0.1`로 직접 지정하자 관리자 패널이 반환됐다. `TRACE`가 헤더 이름을 누출했고, 인증 여부를 클라이언트가 위조할 수 있는 헤더에 맡긴 구조가 권한 우회로 연결됐다. 상세 풀이는 [Authentication bypass via information disclosure](/write-up/portswigger/information-disclosure/authentication-bypass-via-information-disclosure/)에 정리했다.

### 5. Git 히스토리에 남은 삭제된 비밀값

운영 사이트의 `/.git/HEAD`·로그·관련 객체에 함께 접근할 수 있으면 현재 파일뿐 아니라 과거 커밋과 이력까지 복구할 수 있다. 랩에서는 `COMMIT_EDITMSG`와 `logs`에서 관리자 비밀번호를 제거한 커밋을 찾았다. 이후 Git의 zlib 압축 객체를 직접 풀고 commit → tree → `admin.conf` blob을 따라가 과거의 `ADMIN_PASSWORD`를 확인했다.

현재 설정 파일에서 비밀값을 지워도 Git 객체와 히스토리에는 남는다. 이미 노출된 비밀값은 현재 파일에서 제거하는 것으로 끝나지 않으며, **폐기하고 즉시 교체**해야 한다. 상세 풀이는 [Information disclosure in version control history](/write-up/portswigger/information-disclosure/information-disclosure-in-version-control-history/)에 정리했다.

---

## 진단 방법

정보 노출 진단은 특정 페이로드 하나를 대입하는 작업이 아니다. 정상 응답에서 버려지는 단서를 수집하고, 가설을 세운 뒤 요청의 조건 하나만 바꾸어 결과를 비교하는 과정이다.

1. **응답 표면을 수집한다.** HTML·JavaScript·주석·응답 헤더·쿠키·오류 본문을 확인한다.
2. **공개 힌트를 확인한다.** `/robots.txt`와 `/sitemap.xml`의 경로는 숨겨진 리소스 후보이지 접근 제어 규칙이 아니다.
3. **예상 타입과 경계를 바꾸어 정보성 응답을 유도한다.** 숫자 대신 문자열, 존재하지 않는 값, 빈 값, 파라미터 삭제를 각각 분리해 비교한다.
4. **노출 파일과 메타데이터를 찾는다.** 디렉터리 인덱싱, 백업 확장자, `/.git/HEAD` 같은 식별자를 확인한다.
5. **진단 기능을 분리해 확인한다.** 지원 메서드와 `TRACE`의 요청 반사 여부를 보고, 내부 프록시가 추가한 헤더가 드러나는지 본다.
6. **정보와 영향을 연결한다.** 버전은 공개 취약점, 소스는 하드코딩된 키, 헤더는 인증 판단, Git 이력은 삭제된 비밀값과 결합해 실제 위험을 판단한다.

관찰 결과에 따른 다음 선택은 [Information Disclosure Playbook](/playbook/information-disclosure/)에 표로 정리했다.

---

## 대응 방안

- **외부 오류를 일반화한다.** 사용자에게는 요청 실패와 추적 코드만 반환하고, 스택 트레이스와 내부 예외는 접근 제어된 로그에 남긴다.
- **운영에서 디버그·진단 기능을 끄며, 관리 경로를 별도 인증 뒤에 둔다.** `phpinfo()`·프로파일러·디버그 콘솔·`TRACE`를 필요한 환경에만 제한한다.
- **배포물을 허용 목록으로 구성한다.** 개발 디렉터리 전체를 복사하지 말고, 실행에 필요한 산출물만 새 디렉터리에 생성한다. `.git`, 백업, 테스트, 로그 파일은 웹 루트 밖에 둔다.
- **서버에서 민감 파일 패턴을 거부한다.** `.git`, `.svn`, `.bak`, `.old`, `~` 및 환경 설정 파일에 대한 HTTP 접근을 웹 서버 계층에서도 차단한다. `robots.txt`는 대체재가 아니다.
- **프록시 신뢰 경계를 강제한다.** 원본 서버는 신뢰할 수 있는 프록시에서 온 연결만 받고, 외부 요청의 내부용 헤더는 제거한 뒤 다시 설정한다. 권한 판단을 위조 가능한 IP 헤더 하나에 의존하지 않는다.
- **비밀값을 소스와 히스토리에서 분리한다.** 전용 비밀 관리 시스템을 사용하고 시크릿 스캔을 CI와 프리커밋 단계에 둔다.
- **이미 노출된 비밀값은 교체한다.** 현재 파일에서 삭제하거나 Git 히스토리를 재작성하는 것은 추가 노출을 줄일 뿐, 이미 다운로드된 사본과 캐시를 회수하지 못한다.

---

## 실습

PortSwigger Web Security Academy의 Information Disclosure 랩 5개를 노출 경로별로 정리했다.

| 유형 | 대표 Lab | 난이도 | 핵심 단서 |
| --- | --- | --- | --- |
| 상세 오류 | [Information disclosure in error messages](/write-up/portswigger/information-disclosure/information-disclosure-in-error-messages/) | APPRENTICE | 타입 오류 → Apache Struts 2 버전 |
| 디버그 페이지 | [Information disclosure on debug page](/write-up/portswigger/information-disclosure/information-disclosure-on-debug-page/) | APPRENTICE | HTML 주석 → `phpinfo.php` → `SECRET_KEY` |
| 백업 소스 | [Source code disclosure via backup files](/write-up/portswigger/information-disclosure/source-code-disclosure-via-backup-files/) | APPRENTICE | `/backup` 인덱싱 → `.java.bak` → DB 비밀번호 |
| 불안전한 진단 설정 | [Authentication bypass via information disclosure](/write-up/portswigger/information-disclosure/authentication-bypass-via-information-disclosure/) | APPRENTICE | `TRACE` → 내부 헤더 → 인증 우회 |
| 버전 관리 이력 | [Information disclosure in version control history](/write-up/portswigger/information-disclosure/information-disclosure-in-version-control-history/) | PRACTITIONER | `/.git` → 과거 blob → 삭제된 비밀값 |

전체 풀이는 [Information Disclosure Write-up 아카이브](/write-up/portswigger/information-disclosure/)에서 확인할 수 있다.

---

## 마치며

Information Disclosure는 내부 정보가 신뢰 경계 밖으로 흘러나오는 문제다. 숫자 타입 하나를 바꾼 오류, 소스에 남은 주석, 백업 확장자, 진단용 메서드, Git 메타데이터가 각각 다른 통로가 된다.

진단에서는 **무엇이 노출됐는지보다 그 정보가 다음 판단을 어떻게 바꾸는지**를 봐야 한다. 프레임워크 버전은 공개 취약점과, 내부 헤더는 권한 판단과, 과거 커밋은 아직 유효한 비밀값과 연결될 때 실제 영향이 드러난다.

---

> 참고자료  
> https://portswigger.net/web-security/information-disclosure  
> https://portswigger.net/web-security/information-disclosure/exploiting
