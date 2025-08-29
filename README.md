# Personal Blog with Hugo + Anatole

보안 공부 기록 및 개인 아카이브를 위한 블로그입니다.  
Hugo 정적 사이트 생성기와 Anatole 테마를 기반으로 제작되었습니다.

---

## 환경
- **OS**: Windows + WSL2 Ubuntu
- **IDE**: VSCode
- **Framework**: Hugo (extended)
- **Theme**: [Anatole](https://github.com/lxndrblz/anatole)
- **Hosting**: GitHub Pages (Actions 배포)

---

## 실행 방법

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

- content/note/
- content/project/
- content/review/

2. 새 글 생성
```bash
hugo new note/my-first-note.md
```

3. Front Matter 수정
```yaml
---
title: "My First Note"
date: 2025-08-29
draft: false   # 배포 시 반드시 false
---
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