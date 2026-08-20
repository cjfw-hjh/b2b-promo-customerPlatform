# 정성을 보여줘 프론트엔드앱 개발을 위한 지침

## 기술 스택 (2-PRD.md 7번 근거)

- **Frontend**: React. 반응형 UI, 데스크톱 우선 + 모바일 대응(별도 네이티브 앱 없음).
- **인증/세션**: 세션 기반 인증(`express-session` + `connect-pg-simple`, 서버 세션을 PostgreSQL에 저장). **JWT가 아니다** — 프론트에서 토큰을 직접 저장/첨부하지 않고, `httpOnly` 세션 쿠키에 의존한다(요청 시 `fetch`의 `credentials: 'include'` 또는 동일 origin이면 기본값으로 충분).
- **배포 구성**: Express가 React 빌드 결과물(`frontend/build`)을 같은 origin에서 정적 파일로 서빙하는 것이 기본 구성이다 — 이 구성에서는 **별도 CORS 설정이 필요 없다**. 프론트/백을 다른 origin에 배포하는 예외 상황에서만 쿠키에 `SameSite=None; Secure` + 요청에 `credentials: true`가 필요하다.
- **STT(음성 입력)**: 브라우저 내장 Web Speech API(`SpeechRecognition`/`webkitSpeechRecognition`)만 프론트엔드에서 사용한다. 외부/유료 STT 서비스 연동 없음(RULE-STT-001). 변환된 텍스트만 백엔드로 전달하고, 음성 원본은 다루지 않는다.
- **거래처 마스터**: 관리자 화면 없이 DB에 직접 등록·관리한다(RULE-CUSTOMER-003) — 프론트엔드에는 거래처 등록/수정 UI를 두지 않고, 목록 API 조회 결과만 선택용 드롭다운 등에 사용한다.
- **접근성/성능**: 이번 MVP 범위에서 a11y 대응과 별도의 성능·확장성 목표는 두지 않는다.
- **범위 밖**: Google Calendar/Slack 등 외부 서비스 연동, 네이티브 모바일 앱 — 이번 범위에 포함하지 않는다.

## 개발 전 참고할 문서

- 도메인 정의서 — [정성을 보여줘 도메인 정의서.md](../docs/정성을%20보여줘%20도메인%20정의서.md) : RULE-ID/UC-ID의 유일한 근원. 화면 문구/입력 제약/버튼 활성화 조건 등은 여기 RULE-ID를 근거로 구현한다.
- PRD — [2-PRD.md](../docs/2-PRD.md) : 목표/범위/기능요구사항/기술스택/우선순위(P0·P1)
- 사용자 시나리오 — [3-user-scenario.md](../docs/3-user-scenario.md) : 페르소나 기반 내러티브, 화면 흐름 이해용
- 프로젝트 구조 설계 원칙 — [4-project-principle.md](../docs/4-project-principle.md) : 레이어/네이밍/디렉토리 구조(`pages/`, `components/`, `api/`, `hooks/`)
- 기술 아키텍처 다이어그램 — [5-arch-diagram.md](../docs/5-arch-diagram.md) : 프론트-백엔드 연동 구조
- 와이어프레임 — [6-wireframe.md](../docs/6-wireframe.md) : 화면별 ASCII 와이어프레임, 반응형 원칙
- 실행계획 — [8-plan.md](../docs/8-plan.md) : Frontend Task 분해, 선행조건, 완료조건 체크리스트
