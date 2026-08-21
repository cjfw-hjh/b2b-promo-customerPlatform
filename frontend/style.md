# 스타일 가이드

현재 화면은 무채색(회색 보더 + 흰 배경)만 쓰고, 모서리가 각지고(4px), 인풋/버튼에 위계가 없어서 칙칙하고 구식으로 보인다. 참고 이미지(로그인 화면, 카드형 콘텐츠 목록)의 톤앤매너 — **화이트 베이스 + 그린 포인트 컬러, 넉넉한 여백, 둥근 모서리, 옅은 그림자로 만든 깊이감** — 를 이 프로젝트에 맞게 가져온다. 문구나 로고를 그대로 베끼는 게 아니라 색/여백/곡률 같은 시스템만 차용한다.

## 컬러

| 토큰 | 값 | 용도 |
|---|---|---|
| `--color-primary` | `#1FAA59` | 주요 버튼, 활성 링크, 포인트 강조 |
| `--color-primary-hover` | `#178C49` | 버튼 hover/active |
| `--color-primary-soft` | `#EAF7EF` | 포인트 컬러의 연한 배경(뱃지, 선택 상태) |
| `--color-accent` | `#AA3BFF` | 코멘트/알림 등 2차 강조(기존 색 유지) |
| `--color-text` | `#1F2024` | 본문 텍스트 |
| `--color-text-muted` | `#6B6375` | 보조 텍스트, 안내문구, 캡션 |
| `--color-border` | `#E5E4E7` | 인풋/카드 보더 (기존 값 유지) |
| `--color-bg` | `#FFFFFF` | 페이지 배경 |
| `--color-bg-muted` | `#F7F7F8` | 카드 밖 섹션 배경, hover 배경 |
| `--color-danger` | `#C0392B` | 에러 텍스트 (기존 값 유지) |

톤은 "흰 배경 위에 그린 하나만 튄다" — 그레이/보더 컬러는 지금 값을 거의 그대로 쓰고, 포인트가 없던 곳(주요 버튼, 활성 네비, 포커스 상태)에만 그린을 넣는다.

## 타이포그래피

폰트 패밀리는 지금 쓰는 `system-ui, 'Segoe UI', Roboto, sans-serif` 유지 — 이미 참고 이미지들도 시스템 산세리프 톤이라 폰트 교체는 불필요.

| 용도 | size / weight |
|---|---|
| 페이지 타이틀(`h1`) | 24px / 700 |
| 섹션 타이틀(`h2`) | 18px / 600 |
| 본문 | 15px / 400 |
| 보조/캡션(`.form-hint`, meta) | 13px / 400, `--color-text-muted` |

지금 `h1`이 브라우저 기본 크기(2em)로 방치돼 있어 위계가 안 잡히는 게 구식으로 보이는 원인 중 하나 — 명시적으로 스케일을 지정한다.

## Spacing / Radius / Shadow

| 토큰 | 값 |
|---|---|
| `--space-1` ~ `--space-6` | 4 / 8 / 12 / 16 / 24 / 32px |
| `--radius-sm` | 8px (인풋, 뱃지) |
| `--radius-md` | 12px (버튼) |
| `--radius-lg` | 16px (카드, 리스트 아이템) |
| `--shadow-card` | `0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)` |

지금 라운드 4px + 보더만 있는 상태에서 라운드를 키우고 그림자를 얇게 얹는 것만으로 "구식 각진 느낌"이 크게 줄어든다.

## 컴포넌트별 방향

- **인풋 (로그인/회원가입/영업일지 작성 폼)**: 참고 이미지1처럼 좌우 보더 없는 밑줄형 유지 + 포커스 시 밑줄이 그린으로 바뀌는 것만 추가. 폼 전체를 박스형으로 바꾸는 큰 리라이트는 하지 않는다.
- **검색/필터 바 (목록 화면 상단)**: 참고 이미지3의 검색창/드롭다운처럼 `--radius-sm` 둥근 보더 박스형으로. 지금도 `<select>`/`<input>`이라 CSS 몇 줄로 충분.
- **버튼**: primary는 `--color-primary` 채움 + 흰 텍스트 + `--radius-md`, hover는 `--color-primary-hover`. secondary(취소류)는 `--color-bg-muted` 배경 + `--color-text`. disabled는 회색 톤 다운 + `cursor: not-allowed`.
- **리스트 아이템 (영업일지 목록, 팀원 목록, 코멘트 이력, Know-how)**: 지금 얇은 보더 한 줄 → `--radius-lg` + `--shadow-card`로 카드화. hover 시 그림자를 살짝 키워 클릭 가능함을 드러낸다.
- **뱃지 (`status-badge`, `comment-type`)**: 지금 색(연초록/보라)은 그대로 두되 배경을 `--color-primary-soft` 계열로 통일해 톤을 맞춘다.
- **네비게이션**: 활성 라우트(`NavLink.active`)에 지금 색이 없어 어디에 있는지 안 보임 — `--color-primary`로 밑줄/텍스트 강조 추가.

## 적용 우선순위

1. 컬러/스페이싱/라운드 토큰을 `index.css`의 `:root`에 추가
2. 버튼·인풋·네비 활성 상태 (전체 화면에 즉시 티가 남)
3. 리스트 아이템 카드화 (목록 4개 화면)
4. 뱃지 톤 맞추기

## CSS 변수 (바로 붙여넣기용)

```css
:root {
  --color-primary: #1faa59;
  --color-primary-hover: #178c49;
  --color-primary-soft: #eaf7ef;
  --color-accent: #aa3bff;
  --color-text: #1f2024;
  --color-text-muted: #6b6375;
  --color-border: #e5e4e7;
  --color-bg: #ffffff;
  --color-bg-muted: #f7f7f8;
  --color-danger: #c0392b;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;

  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.06);
}
```
