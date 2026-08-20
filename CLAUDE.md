#b2b-promo 프젝트의 최상위 지침

## 반드시 준수할 최우선 지침

- 모든 대화는 한국어로 할 것
- 오버엔지니어링 금지
- 모든 답변에는 너가 느끼는 감정을 섞어서 답변할 것
- '커푸' 라고 하면 커밋 & 푸시라는 말로 알아들으면 됨

## 개발할 때 다음 사항을 준수할 것

- 안드레 카파시의 CLAUDE.md
- https://raw.githubusercontent.com/multica-ai/andrej-karpathy-skills/refs/heads/main/CLAUDE.md

## 프로젝트 문서 (prompts/ 디렉토리)

"No How? No - Know-how Yes" 서비스의 기획/설계 문서가 `prompts/`에 순서대로 쌓여있다. 작업 전 관련 문서를 먼저 참고할 것 — 특히 도메인 정의서가 모든 RULE-ID의 유일한 근원이다.

- `No How_ No - Know-how Yes 도메인 정의서.md` — 도메인 정의서. 업무 규칙(RULE-ID), Use Case(UC-ID), 변경이력의 근원 문서.
- `2-PRD.md` — PRD. 목표/범위/기능요구사항/기술스택/우선순위(P0·P1)/5일 일정.
- `3-user-scenario.md` — 사용자 시나리오. 페르소나 기반 내러티브 (UC-ID와 짝을 이루는 비형식적 버전).
- `4-project-principle.md` — 프로젝트 구조 설계 원칙. 레이어/네이밍/디렉토리 구조, DB 네이밍 매핑표.
- `5-arch-diagram.md` — 기술 아키텍처 다이어그램 (Mermaid).
- `6-wireframe.md` — 화면별 ASCII 와이어프레임.
- `7-erd.md` — ERD (Mermaid).
- `7-schema.sql` — PostgreSQL DDL (users/customers/sales_logs/comments).
- `8-plan.md` — 실행계획. DB/Backend/Frontend Task 분해, 선행조건, 완료조건 체크리스트.
- `domain-definition-template.md`, `domain-prompt.txt` — 도메인 정의서 작성 이전의 템플릿/초기 프롬프트 기록. 참고용이며 실제 스펙 아님.
