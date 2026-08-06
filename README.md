# MINGON's Lab — 보안 연구 노트

보안 학습 과정에서 얻은 인사이트를 기록하는 아카이브입니다.
Hugo 정적 사이트 생성기와 Anatole 테마를 기반으로 제작되었습니다. → https://blog.mingon.dev/

---

## 콘텐츠 구성

| 섹션 | 내용 |
|---|---|
| **Review** | 실제 CVE·공개 리포트·컨퍼런스 발표를 분석하며 익스플로잇 체인과 근본 원인을 정리 |
| **Analysis** | 특정 기법·브라우저 동작·표준 스펙을 파고들어 "왜 그렇게 동작하는가"를 규명한 심층 분석 |
| **Note** | 취약점 토픽을 체계적으로 정리한 학습 노트와 참고 리소스 |
| **Write-up** | PortSwigger·Dreamhack 등 취약점 실습·CTF 풀이를 플랫폼·주제별로 정리한 아카이브 |

- **태그**로도 횡단 탐색이 가능합니다(예: `SQL Injection` 태그로 Review·Analysis·Note·Write-up을 한 번에).
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
새로 clone한 환경에서는 CI와 동일한 버전의 Hugo Extended / Dart Sass / Go 가 필요합니다.
아래 스크립트가 `~/.local` 에 설치하고 PATH까지 등록합니다 (sudo 불필요, WSL2 x86_64 기준).
```bash
bash scripts/setup.sh
source ~/.bashrc   # 또는 새 터미널
```

### 로컬 개발 서버
```bash
# 의존성 초기화
hugo mod tidy

# 초안 포함 개발 서버 실행
hugo server -D
```
→ http://localhost:1313 에서 확인 가능

### 배포용 빌드
```bash
hugo --minify
```

→ public/ 디렉터리에 정적 파일 생성

GitHub Actions 워크플로우가 main 브랜치 푸시 시 자동으로 Pages에 배포합니다.

### 포스팅 방법

1. 섹션 선택
- `content/review/` · `content/analysis/` · `content/note/`
- `content/write-up/<플랫폼>/<주제>/` (예: `content/write-up/portswigger/sql-injection/`)

2. 새 글 생성
```bash
hugo new note/my-first-note.md
```

3. Front Matter 수정 (TOML)
```toml
+++
title = "My First Note"
date = 2025-08-29
draft = false   # 배포 시 반드시 false
summary = ""
toc = true
# tags 순서: [대분류, 세부기법, 플랫폼/출처, 난이도, 기술스택]
tags = []
+++
```

4. 커밋 및 푸시

```bash
git add .
git commit -m "Add new post"
git push origin main
```
→ GitHub Actions가 자동으로 빌드/배포를 실행합니다.

### 라이선스

Hugo: Apache 2.0  
Anatole Theme: MIT

---