# MINGON's Lab — 보안 연구 노트

보안 학습 과정에서 얻은 인사이트를 기록하는 아카이브입니다.
Hugo 정적 사이트 생성기와 Anatole 테마를 기반으로 제작되었습니다. → https://blog.mingon.dev/

---

## 콘텐츠 구성

| 섹션 | 내용 |
|---|---|
| **Review** | 실제 CVE·공개 리포트·컨퍼런스 발표를 분석하며 익스플로잇 체인과 근본 원인을 정리 |
| **Analysis** | 특정 기법·브라우저 동작·표준 스펙을 파고들어 "왜 그렇게 동작하는가"를 규명한 심층 분석 |
| **Note** | 보안·개발 개념과 도구의 동작 원리, 경험과 참고 자료 |
| **Lab** | 취약점 토픽의 개념과 실습에서 확인한 동작을 함께 정리한 학습 기록 |
| **Playbook** | 취약점 진단 절차와 확인할 항목을 정리한 실무용 Cheat Sheet |
| **Write-up** | PortSwigger·Dreamhack 등 취약점 실습·CTF 풀이를 플랫폼·주제별로 정리한 아카이브 |

- **태그**로도 횡단 탐색이 가능합니다(예: `SQL Injection` 태그로 Review·Analysis·Lab·Write-up을 한 번에).
- 태그 표기 규칙: `[대분류, 세부기법, 플랫폼/출처, 난이도, 기술스택]` 순서, 통제 어휘 사용.

### 대표 글
- KakaoTalk 1-click account hijacking 분석 (CVE-2023-51219)
- Samsung Galaxy S24 - Pwn2Own Ireland 2024 White Paper 분석
- TikTok 1-click account hijacking 분석 (CVE-2022-28799)
- OAuth/OIDC 프로토콜 취약점 분석

---

## 환경
- **OS**: Windows + WSL2 Ubuntu
- **IDE**: VSCode
- **Framework**: Hugo (extended)
- **Theme**: [Anatole](https://github.com/lxndrblz/anatole)
- **Hosting**: GitHub Pages (Actions 배포)

---

## 실행 방법

### 최초 1회 셋업 (새 로컬)
아래 스크립트가 Hugo Extended 0.149.0 / Dart Sass 1.91.0 / Go 1.24.6을 이 저장소의 `.cache/toolchain/`에 설치합니다. CI도 같은 스크립트를 사용합니다. Linux x86_64에서 Bash, curl, tar가 필요하며 분석 검사는 기존 Node.js로 실행합니다.

```bash
bash scripts/setup.sh
bash scripts/check-toolchain.sh
```

`scripts/run.sh`는 실행하는 명령에만 전용 PATH와 Go/Hugo 캐시(`.cache/`)를 적용하고 저장소 루트에서 실행합니다. 사용자 홈의 도구·`.bashrc`와 다른 프로젝트는 수정하지 않습니다. 환경 분리이며 파일 접근을 제한하는 보안 샌드박스는 아닙니다.

### 로컬 개발 서버
```bash
# 초안 포함 개발 서버 실행
bash scripts/run.sh hugo server -D
```
→ http://localhost:1313 에서 확인 가능

모듈 의존성을 변경할 때만 `bash scripts/run.sh hugo mod tidy`를 실행합니다.

### 배포용 빌드
```bash
bash scripts/run.sh hugo --minify
bash scripts/run.sh node scripts/check-analytics.mjs public
```

→ public/ 디렉터리에 정적 파일 생성

GitHub Actions 워크플로우가 main 브랜치 푸시 시 자동으로 Pages에 배포합니다.

HOME에는 Analysis, Review, Note를 최신순으로 노출합니다. Lab, Playbook, Write-up은 각 메뉴에서 탐색합니다.

방문 통계의 계정·컨테이너, 동의 처리와 배포 검증은 [분석 운영 문서](docs/analytics/README.md)를 참고합니다.
배포 전에는 위 분석 검사로 직접 GA 중복 삽입과 동의 처리도 확인합니다.

### 포스팅 방법

글 하나를 폴더 하나로 관리하는 Hugo Leaf Bundle 구조를 사용합니다.
섹션 목록은 `_index.md`, 개별 글은 `<글 이름>/index.md`로 구분합니다.

```text
content/
├── analysis/
│   ├── _index.md
│   └── email-parser-differential/
│       ├── index.md
│       └── images/
│           ├── validation-vs-delivery.png
│           └── validation-vs-delivery.drawio
├── review/<글 이름>/index.md
├── note/<글 이름>/index.md
├── lab/<토픽 이름>/index.md
├── playbook/<주제>/index.md
└── write-up/<플랫폼>/<주제>/<문제 이름>/index.md
```

폴더명은 짧고 고정된 영문 소문자·숫자·하이픈으로 작성하고, 표시할 한글 제목과 `[Analysis]` 같은 분류는 `title`에 기록합니다.
이미지가 없는 글은 `index.md`만 두면 됩니다.

1. 섹션을 선택하고 초안을 생성합니다.

```bash
bash scripts/run.sh hugo new content note/my-first-note/index.md
```

2. Front Matter를 수정합니다. 작성 중에는 `draft = true`를 유지합니다.

```toml
+++
title = "[Note] 새 글 제목"
date = '2026-09-22T12:00:00+09:00'
draft = true
summary = ""
toc = true
# tags 순서: [대분류, 세부기법, 플랫폼/출처, 난이도, 기술스택]
tags = []
+++
```

3. 글 전용 이미지는 같은 폴더의 `images/`에 넣고 상대 경로로 참조합니다.
   draw.io·SVG 편집 원본도 함께 보관합니다. 번들에 넣는 첨부 파일은 공개 배포 대상으로 관리합니다.

```markdown
![검증과 전송의 해석 차이](images/validation-vs-delivery.png)
```

프로필·파비콘 등 사이트 공통 파일은 `static/`에 둡니다.
`static/analysis/`, `static/review/`, `static/note/`, `static/writeup/`의 기존 파일은 이전 이미지 URL을 유지하는 호환용 복사본입니다. 새 글은 이 경로를 사용하지 않습니다.
과거 파일명에 기반한 글 주소는 각 글의 `url` 값으로 고정되어 있으므로, 제목이나 폴더명을 바꿀 때도 유지합니다. `url`에는 `%EB...` 같은 인코딩 문자열 대신 디코딩된 경로를 기록합니다.
섹션 이동으로 주소를 바꾸는 경우에는 기존 주소를 `aliases`에 남기고, 내부 링크는 새 주소로 갱신합니다. Note에서 Lab으로 옮긴 PortSwigger 토픽 글은 이 방식으로 이전 `/note/` 주소를 유지합니다.

4. `bash scripts/run.sh hugo server -D`로 확인한 뒤 `draft = false`로 바꿔 발행합니다. 초안과 정식 글의 폴더 위치는 같습니다.
   기존 `draft/`·`temp/`는 Git에서 제외되는 임시 작업 공간이며, 보관할 글과 편집 원본은 번들 안에 둡니다.

5. 변경한 글 폴더를 커밋하고 푸시합니다.

```bash
git add content/note/my-first-note/
git commit -m "Add new post"
git push origin main
```
→ GitHub Actions가 자동으로 빌드/배포를 실행합니다.

### 라이선스

Hugo: Apache 2.0  
Anatole Theme: MIT

---
