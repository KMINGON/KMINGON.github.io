# archive — 미노출 보관 글

블로그에 더 이상 노출하지 않지만 기록으로 남겨둘 글과 그 자산을 모아두는 곳이다.

Hugo는 `content/`와 `static/`만 읽으므로, 이 폴더 아래 파일은 **빌드·사이트맵·태그·RSS 어디에도 포함되지 않는다.**
동시에 `.gitignore` 대상이 아니므로 git 이력에는 그대로 남는다.
(로컬 작업용 임시 폴더인 `draft/`, `temp/`와는 목적이 다르다 — 그쪽은 gitignore 대상이다.)

## 구조

공개 글과 같은 Leaf Bundle 구조를 사용하며, `archive/` 아래에 두어 미노출 상태를 유지한다.

```
archive/
├── content/rookies/
│   ├── final-project-week-1/index.md
│   ├── final-project-week-2/index.md
│   ├── final-project-week-3/index.md
│   └── wargame-write-up/
│       ├── index.md
│       └── images/
└── static/review/1/  → 복원 시 이전 이미지 URL을 유지할 호환용 파일
```

## 보관 목록

| 경로 | 내용 | 보관 사유 |
| --- | --- | --- |
| `content/rookies/` | SK Shieldus Rookies 과정 관련 글 4편 (Wargame Write-Up, 최종 프로젝트 1~3주차 회고) | 교육과정 관련 글은 블로그 주제에서 제외 |
| `content/rookies/wargame-write-up/images/` | Wargame Write-Up 전용 이미지 13개 | 본문과 함께 관리 |
| `static/review/1/` | 위 이미지의 이전 경로 복사본 | 복원 시 기존 이미지 URL 유지 |

## 복원 방법

글 폴더를 `content/`로 옮기면 된다. 각 글의 `url` 값이 이전 글 주소를 유지하며, 본문은 번들 안의 `images/`를 참조한다.
이전 이미지 주소도 다시 제공하려면 호환용 파일을 함께 복원한다.

```bash
git mv archive/content/rookies content/rookies
git mv archive/static/review/1 static/review/1
```

복원 시 확인할 것:

- `hugo.toml`의 `[[menu.main]]`에 해당 섹션 메뉴가 필요한지 (rookies 메뉴 항목은 아카이브 시점에 제거함)
- 노출하려는 글의 front matter `draft` 값 (Wargame Write-Up은 `draft = true` 상태로 보관됨)
- 홈 목록에 띄우려면 `hugo.toml`의 `params.mainSections`에 섹션 추가
