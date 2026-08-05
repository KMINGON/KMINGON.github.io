# archive — 미노출 보관 글

블로그에 더 이상 노출하지 않지만 기록으로 남겨둘 글과 그 자산을 모아두는 곳이다.

Hugo는 `content/`와 `static/`만 읽으므로, 이 폴더 아래 파일은 **빌드·사이트맵·태그·RSS 어디에도 포함되지 않는다.**
동시에 `.gitignore` 대상이 아니므로 git 이력에는 그대로 남는다.
(로컬 작업용 임시 폴더인 `draft/`, `temp/`와는 목적이 다르다 — 그쪽은 gitignore 대상이다.)

## 구조

복원이 쉽도록 **원래 프로젝트 경로를 그대로 유지**한다.

```
archive/
├── content/      → 원래 content/ 아래에 있던 글
└── static/       → 그 글에서만 참조하던 이미지 등 정적 자산
```

## 보관 목록

| 경로 | 내용 | 보관 사유 |
| --- | --- | --- |
| `content/rookies/` | SK Shieldus Rookies 과정 관련 글 4편 (Wargame Write-Up, 최종 프로젝트 1~3주차 회고) | 교육과정 관련 글은 블로그 주제에서 제외 |
| `static/review/1/` | 위 Wargame Write-Up 전용 이미지 13개 | 해당 글에서만 참조 |

## 복원 방법

경로 구조가 같으므로 `archive/` 접두사만 떼고 되돌리면 된다.

```bash
git mv archive/content/rookies content/rookies
git mv archive/static/review/1 static/review/1
```

복원 시 확인할 것:

- `hugo.toml`의 `[[menu.main]]`에 해당 섹션 메뉴가 필요한지 (rookies 메뉴 항목은 아카이브 시점에 제거함)
- 노출하려는 글의 front matter `draft` 값 (Wargame Write-Up은 `draft = true` 상태로 보관됨)
- 홈 목록에 띄우려면 `hugo.toml`의 `params.mainSections`에 섹션 추가
