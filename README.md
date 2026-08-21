# 정성을 보여줘 (No How? No - Know-how Yes)

영업사원이 거래처 방문/활동 내역을 영업일지로 남기고, 팀장이 코멘트로 피드백을 주고받는 B2B 영업 관리 서비스.

## 문서

기획/설계 단계에서 작성한 문서는 `prompts/docs/`에 순서대로 있다. 모든 업무 규칙(RULE-ID)과 Use Case(UC-ID)의 유일한 근원은 도메인 정의서다.

| 문서 | 내용 |
| --- | --- |
| [도메인 정의서](prompts/docs/정성을%20보여줘%20도메인%20정의서.md) | 업무 규칙(RULE-ID), Use Case(UC-ID), 변경이력의 근원 문서 |
| [2-PRD.md](prompts/docs/2-PRD.md) | 목표/범위/기능요구사항/기술스택/우선순위(P0·P1)/5일 일정 |
| [3-user-scenario.md](prompts/docs/3-user-scenario.md) | 페르소나 기반 사용자 시나리오 |
| [4-project-principle.md](prompts/docs/4-project-principle.md) | 프로젝트 구조 설계 원칙(레이어/네이밍/디렉토리 구조, DB 네이밍 매핑) |
| [5-arch-diagram.md](prompts/docs/5-arch-diagram.md) | 기술 아키텍처 다이어그램 |
| [6-wireframe.md](prompts/docs/6-wireframe.md) | 화면별 와이어프레임 |
| [7-erd.md](prompts/docs/7-erd.md) | ERD |
| [7-schema.sql](prompts/docs/7-schema.sql) | PostgreSQL DDL(users/customers/sales_logs/comments) |
| [8-plan.md](prompts/docs/8-plan.md) | 실행계획(DB/Backend/Frontend Task 분해, 완료조건 체크리스트) |

## Demo Site

https://b2b-promo-customer-platform-srwt.vercel.app

## 테스트용 사용자 계정

| 역할 | 이메일 | 비밀번호 | 사번 |
| --- | --- | --- | --- |
| 팀장 | `manager@example.com` | `Demo1234!` | `100001` |
| 영업사원 | `sales@example.com` | `Demo1234!` | `200001` |

두 계정은 서로 팀장-영업사원으로 연결되어 있고, 영업일지 2건(그중 1건은 팀장 코멘트 + 답변까지 등록된 상태)이 미리 준비되어 있다.

## 테스트 시나리오

1. `sales@example.com`으로 로그인 → 영업일지 작성 화면으로 이동
2. 거래처를 선택하고 활동 내역을 입력해 새 영업일지 작성 (마이크 아이콘으로 음성 입력도 가능)
3. "내 일지 조회"에서 방금 쓴 일지와 기존 일지들을 확인, 기간/거래처/키워드로 검색
4. 코멘트가 있는 일지("코멘트 진행중" 상태) 클릭 → 팀장 코멘트/내 답변 스레드 확인, 삭제 버튼이 비활성화되어 있음을 확인
5. 로그아웃 후 `manager@example.com`으로 로그인 → 팀원 영업일지 목록에서 두 일지 확인
6. 아직 코멘트가 없는 일지(견적서 관련)를 열어 코멘트 등록 → 다시 영업사원 계정으로 로그인해 답변 등록까지 확인
7. 팀장 계정에서 "내 코멘트 이력" 화면으로 이동해 지금까지 남긴 코멘트가 시간순으로 보이는지 확인
