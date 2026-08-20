# 실행 계획 — 정성을 보여줘

이 문서는 `prompts/` 디렉토리의 문서(도메인 정의서, `2-PRD.md`, `3-user-scenario.md`, `4-project-principle.md`, `5-arch-diagram.md`, `6-wireframe.md`, `7-erd.md`, `7-schema.sql`)를 근거로, 실제 구현을 Database / Backend / Frontend 단위의 독립적인 Task로 분해한 실행계획이다.

## 사용법

- Task ID는 `DB-N`, `BE-N`, `FE-N`, `INT-N` 형식이며, 선행 Task는 이 ID로 표기한다.
- `(P0)`는 PRD 8번 섹션의 핵심 플로우, `(P1)`은 5일 일정이 촉박할 경우 가장 먼저 잘라낼 수 있는 항목이다(PRD 8번 그대로).
- 완료 조건은 실제로 확인 가능한 체크리스트다 — "화면이 예쁘다" 같은 주관적 조건은 넣지 않았다.
- 범위 제외: 정성적 활동 검증 로직(도메인 정의서 21.2-5), 개인정보 공유 통제(21.2-7), 거래처 등록 UI(RULE-CUSTOMER-003)는 이번 계획에 Task로 포함하지 않는다 — PRD가 이미 MVP 범위에서 제외했다.

---

## 1. Database

### DB-1. 개발 DB 인스턴스 준비

- **선행 Task**: 없음
- **수행 작업**:
  - 로컬(또는 개발용) PostgreSQL 인스턴스를 준비한다.
  - 데이터베이스를 생성하고, 접속 정보(`DB_CONN_STRING`)를 `.env`에 기록한다(4-project-principle.md 5번, 환경변수 원칙).
  - `.env`는 `.gitignore`에 포함시키고 `.env.example`에 키 목록만 남긴다.
- **완료 조건**:
  - [x] `psql` 또는 동등한 클라이언트로 DB에 접속이 확인된다.
  - [x] `.env`가 git 추적에서 제외되어 있다(`git status`에 안 뜸).
  - [x] `.env.example`에 `DB_CONN_STRING`, `SESSION_SECRET`, SMTP 관련 키 이름이 값 없이 나열되어 있다.

### DB-2. 스키마 적용

- **선행 Task**: DB-1
- **수행 작업**:
  - `prompts/7-schema.sql`을 그대로 실행해 `users`, `customers`, `sales_logs`, `comments` 테이블과 인덱스를 생성한다.
  - `connect-pg-simple` 패키지가 제공하는 세션 테이블 생성 SQL을 별도로 실행한다(`7-schema.sql`은 이 테이블을 포함하지 않는다).
- **완료 조건**:
  - [x] `\dt` 실행 시 `users`, `customers`, `sales_logs`, `comments`, `session`(또는 `connect-pg-simple` 기본 테이블명) 5개 테이블이 모두 보인다.
  - [x] `users.role`에 `'salesperson'`/`'manager'` 외의 값을 넣으면 CHECK 제약으로 INSERT가 실패한다(수동 확인).
  - [x] `sales_logs.activity_type`에 `'외근'/'내근'/'기타'` 외의 값을 넣으면 실패한다(수동 확인).
  - [x] `comments.sales_log_id`에 존재하지 않는 ID를 넣으면 FK 위반으로 실패한다(수동 확인).

### DB-3. 거래처 마스터 시드 데이터 등록

- **선행 Task**: DB-2
- **수행 작업**:
  - 관리자 화면 없이 `customers` 테이블에 테스트/실사용 거래처 데이터를 직접 INSERT한다(RULE-CUSTOMER-003).
  - 반복 사용을 위해 `sql/seed.sql`로 저장해둔다(4-project-principle.md 7번 구조 참고).
- **완료 조건**:
  - [x] `SELECT * FROM customers;` 결과 1건 이상 존재한다.
  - [ ] `seed.sql` 파일이 저장소에 커밋되어 있다. (파일은 `prompts/backend/sql/seed.sql`에 생성 완료, 커밋은 보류 — 나중에 모아서 커밋 예정)

---

## 2. Backend

### BE-1. 프로젝트 셋업 및 공통 미들웨어

- **선행 Task**: DB-1
- **수행 작업**:
  - Express 프로젝트를 4-project-principle.md 7번 디렉토리 구조(`routes/`, `controllers/`, `services/`, `db/`, `middleware/`, `config/`)대로 스캐폴딩한다.
  - `db/pool.js`(pg Pool), `config/env.js`(환경변수 로딩), `morgan` 요청 로깅을 구성한다.
  - 전역 에러 핸들링 미들웨어를 추가한다.
- **완료 조건**:
  - [x] `npm run dev`(또는 동등 스크립트)로 서버가 기동되고 `GET /health` 같은 헬스체크 응답이 200을 반환한다.
  - [x] `db/pool.js`를 통해 DB-1의 DB에 커넥션이 정상적으로 맺어진다(콘솔 로그로 확인).
  - [x] ESLint + Prettier 설정이 레포 루트에 있고 `npm run lint`가 통과한다(4-project-principle.md 4번).

### BE-2. 세션/인증 미들웨어 구성

- **선행 Task**: BE-1, DB-2
- **수행 작업**:
  - `config/session.js`에 `express-session` + `connect-pg-simple`을 연결한다(PRD 6·7번 확정 사항 — JWT 아님).
  - `middleware/auth.js`에 `requireAuth`(세션 확인), `requireRole`(role별 접근 제어)를 구현한다.
- **완료 조건**:
  - [x] 로그인 후 발급된 세션 쿠키가 `httpOnly`로 설정되어 있다(브라우저 개발자도구로 확인). (자동화 테스트로 `Set-Cookie` 헤더의 `HttpOnly` 확인 완료 — 실제 로그인 API는 BE-3에서 구현되므로 브라우저 수동 확인은 BE-3 완료 후 재확인)
  - [x] 세션 데이터가 `connect-pg-simple`의 세션 테이블에 실제로 저장된다(DB에서 직접 조회 확인). (테스트에서 `session` 테이블 직접 SELECT로 확인)
  - [x] 로그인하지 않은 상태로 보호된 라우트 호출 시 401이 반환된다.
  - [x] `role`이 다른 사용자가 접근 제한된 라우트(예: 팀장 전용) 호출 시 403이 반환된다.

### BE-3. 인증/회원가입 API `(P0)`

- **선행 Task**: BE-2
- **수행 작업**:
  - `authService.js`, `authController.js`, `authRoutes.js`(`POST /api/auth/signup`, `/login`, `/logout`)를 구현한다.
  - RULE-AUTH-001~006(사번 6자리, 이메일 형식, 비밀번호 7자리 이상, 사번/이메일 중복 불가, 역할 필수)을 Service 레이어에서 검증한다.
  - bcrypt로 비밀번호를 해시하여 저장한다(평문 저장 금지).
  - RULE-ORG-001·002·006(영업사원은 팀장 이메일 필수, 팀장은 미입력)을 회원가입 로직에 반영한다.
- **완료 조건**:
  - [x] 정상 입력값으로 영업사원/팀장 각각 회원가입이 성공한다.
  - [x] 6자리가 아닌 사번, 형식이 잘못된 이메일, 7자리 미만 비밀번호로 가입 시도 시 각각 400이 반환된다.
  - [x] 동일 사번/이메일로 중복 가입 시도 시 실패한다.
  - [x] 영업사원 가입 시 `manager_email` 없이 요청하면 실패하고, 팀장 가입 시 `manager_email`을 보내도 무시되거나 저장되지 않는다.
  - [x] DB에서 `password_hash` 컬럼 값이 평문이 아님을 육안으로 확인한다.
  - [x] 로그인 성공 시 세션이 생성되고, 로그아웃 시 세션이 즉시 제거된다.

### BE-4. 조직/상사 관계 로직 `(P0)`

- **선행 Task**: BE-3
- **수행 작업**:
  - `organizationService.js`를 구현한다: 영업사원 가입 시 `manager_email`만 저장하고 `manager_id`는 NULL로 둔다(RULE-ORG-003).
  - 팀장이 매핑된 영업사원만 조회할 수 있도록 하는 조회 헬퍼(RULE-ORG-008)를 구현한다.
  - 영업사원은 정확히 하나의 팀장에게만 매핑됨을 보장한다(RULE-ORG-007 — 스키마상 단일 컬럼이라 자동 보장되지만 Service 레벨에서도 재확인).
- **완료 조건**:
  - [x] 단위테스트: 영업사원 1명은 `manager_id` 컬럼 값이 최대 1개임을 검증하는 테스트가 통과한다(RULE-ORG-007).
  - [x] 팀장 계정으로 자신에게 매핑되지 않은 영업사원의 데이터를 조회하는 헬퍼 호출 시 빈 결과가 반환됨을 테스트로 확인한다.

### BE-5. 거래처 마스터 조회 API `(P0)`

- **선행 Task**: BE-1, DB-3
- **수행 작업**:
  - `customerService.js`, `customerController.js`, `customerRoutes.js`(`GET /api/customers`)를 구현한다.
  - 등록/수정 API는 만들지 않는다(RULE-CUSTOMER-003).
- **완료 조건**:
  - [x] `GET /api/customers` 호출 시 DB-3에서 시드한 거래처 목록이 반환된다.
  - [x] `POST /api/customers` 같은 등록용 라우트가 존재하지 않음을 코드 리뷰로 확인한다.

### BE-6. 영업일지 CRUD API `(P0)`

- **선행 Task**: BE-4, BE-5
- **수행 작업**:
  - `salesLogService.js`, `salesLogController.js`, `salesLogRoutes.js`를 구현한다: `POST/GET/PATCH/DELETE /api/sales-logs`, `GET /api/sales-logs/:id`.
  - RULE-LOG-001(작성일 자동 기록, 변경 불가), RULE-LOG-002~003(작성자 본인만 수정/삭제)을 구현한다.
  - RULE-LOG-005(팀장 코멘트가 1건이라도 있으면 삭제 불가, 수정은 항상 가능)를 구현한다.
  - 영업일지 상태("작성 완료"/"코멘트 진행중")는 DB 컬럼 없이 `comments` 존재 여부로 매 조회 시 계산한다(4-project-principle.md 1번 원칙).
- **완료 조건**:
  - [x] 작성 API 호출 시 `created_at`이 서버 시간으로 자동 설정되고 요청 바디로 덮어쓸 수 없다.
  - [x] 작성자가 아닌 사용자가 수정/삭제를 시도하면 403이 반환된다.
  - [x] 단위테스트: 코멘트가 1건 이상 있는 영업일지에 DELETE 요청 시 403이 반환된다(RULE-LOG-005).
  - [x] 단위테스트: 코멘트가 있어도 PATCH(수정) 요청은 성공한다(RULE-LOG-005 — 삭제만 막힘).
  - [x] 수정 후에도 `created_at` 값이 최초 저장 시점과 동일함을 확인한다(RULE-LOG-004).
  - [x] 응답 객체에 상태값("작성 완료"/"코멘트 진행중")이 `comments` 개수 기준으로 정확히 계산되어 내려온다.

### BE-7. 팀장 영업일지 조회 API `(P0)`

- **선행 Task**: BE-6
- **수행 작업**:
  - `GET /api/managed/sales-logs`를 `salesLogRoutes.js`/`salesLogController.js`에 추가한다(UC-007).
  - `organizationService.js`의 매핑 헬퍼를 사용해 자신에게 매핑된 영업사원의 일지만 반환하도록 한다(RULE-ORG-008).
- **완료 조건**:
  - [x] 팀장 계정으로 호출 시 자신에게 매핑된 영업사원의 일지만 반환된다.
  - [x] 다른 팀장에게 매핑된 영업사원의 일지는 결과에 포함되지 않음을 테스트로 확인한다.
  - [x] 영업사원 계정으로 이 엔드포인트 호출 시 403이 반환된다.

### BE-8. 코멘트 스레드 API `(P0)`

- **선행 Task**: BE-6
- **수행 작업**:
  - `commentService.js`, `commentController.js`, `commentRoutes.js`(`GET/POST /api/sales-logs/:id/comments`, `GET /api/managed/comments`)를 구현한다.
  - RULE-FEEDBACK-001~~004(팀장 코멘트 무제한, 최초 코멘트는 팀장부터, 작성 권한은 해당 영업사원의 팀장), RULE-REPLY-001~~005(팀장 코멘트 1건 이상 있어야 답변 가능, 작성 권한은 작성자 본인, 답변 무제한)를 구현한다.
  - `author_id`를 통해 `users.role`을 조인해서 화면에 "팀장 코멘트"/"답변" 구분값을 내려준다(별도 `comment_type` 컬럼 없음).
- **완료 조건**:
  - [x] 팀장이 아닌 사용자가 코멘트 작성을 시도하면 403이 반환된다.
  - [x] 코멘트가 하나도 없는 영업일지에 영업사원이 답변을 시도하면 실패한다(RULE-REPLY-001).
  - [x] 팀장 코멘트 등록 후 같은 영업사원이 여러 번 답변해도 전부 성공한다(횟수 제한 없음).
  - [x] 팀장도 같은 영업일지에 여러 번 코멘트를 남길 수 있다(RULE-FEEDBACK-001).
  - [x] `GET /api/managed/comments` 호출 시 해당 팀장이 과거에 남긴 코멘트만 시간순으로 반환된다.
  - [x] 단위테스트: "최초 코멘트는 팀장부터" 규칙 위반(영업사원이 아무 코멘트 없는 일지에 먼저 답변 시도) 시 실패하는 테스트가 통과한다.

### BE-9. 이메일 알림 서비스 `(P0)`

- **선행 Task**: BE-6, BE-8
- **수행 작업**:
  - `notificationService.js`에 Nodemailer 래핑 함수를 구현한다.
  - 영업일지 저장(RULE-ORG-004), 코멘트/답변 등록(RULE-FEEDBACK-004, RULE-REPLY-005) 시점에 각각 호출하도록 `salesLogService.js`/`commentService.js`에서 연결한다.
  - 발송 로직은 try/catch로 감싸 실패해도 저장 트랜잭션에 영향을 주지 않는다(RULE-NOTIFICATION-001).
  - SMTP 계정이 아직 없으면 콘솔 로그로 발송 내용을 대체한다(PRD 7번에 명시된 리스크).
- **완료 조건**:
  - [x] 영업일지 저장 시 팀장 이메일로(또는 콘솔 로그로) 알림이 발송/기록된다.
  - [x] 코멘트/답변 등록 시 상대방에게 알림이 발송/기록된다.
  - [x] 이메일 발송 함수가 강제로 예외를 던지도록 만들어도 영업일지/코멘트 저장 자체는 성공함을 테스트로 확인한다(RULE-NOTIFICATION-001).
  - [x] 미가입 팀장 이메일로도(계정이 없어도) 발송 시도가 이루어진다(RULE-ORG-004).

### BE-10. 개인 영업일지 검색 `(P0)`

- **선행 Task**: BE-6
- **수행 작업**:
  - `GET /api/sales-logs`에 쿼리파라미터(`from`, `to`, `customerId`, `activityType`, `keyword`)를 추가한다(RULE-SEARCH-001).
  - 검색 결과는 요청자 본인이 작성한 영업일지로만 제한한다.
- **완료 조건**:
  - [x] 각 쿼리파라미터가 단독/조합으로 정상 필터링된다.
  - [x] 단위테스트: 다른 사용자가 작성한 영업일지는 검색 결과에 절대 포함되지 않는다(RULE-SEARCH-001).

### BE-11. 거래처 Know-how 조회 API `(P1)`

- **선행 Task**: BE-6, BE-4
- **수행 작업**:
  - `GET /api/customers/:id/knowhow`를 구현한다.
  - RULE-KNOWHOW-002~006: 정성적 활동 내용만 노출, 팀장 코멘트/답변 제외, 삭제된 일지 제외, 조회자와 동일한 팀장에게 매핑된 영업사원 그룹으로 범위 제한.
- **완료 조건**:
  - [x] 응답에 코멘트/답변 데이터가 전혀 포함되지 않는다.
  - [x] 삭제된 영업일지는 결과에서 제외된다.
  - [x] 단위테스트: 조회자와 다른 팀장에게 매핑된 영업사원이 작성한 활동은 결과에서 제외됨을 확인한다(RULE-KNOWHOW-006).

### BE-12. 미가입 팀장 자동 연결 `(P1)`

- **선행 Task**: BE-4
- **수행 작업**:
  - `organizationService.js`에 팀장 가입 시 트리거를 추가한다: 동일한 `manager_email`을 가진 기존 영업사원들의 `manager_id`를 트랜잭션으로 일괄 백필한다(RULE-ORG-005).
  - `pool.connect()`로 얻은 단일 client에 BEGIN/COMMIT을 적용한다(4-project-principle.md 5번 트랜잭션 원칙).
- **완료 조건**:
  - [x] 영업사원 2명 이상이 동일 이메일을 팀장 이메일로 입력해둔 상태에서 그 이메일로 팀장이 가입하면, 두 영업사원의 `manager_id`가 모두 새 팀장 ID로 업데이트된다.
  - [x] 매칭 과정 중 하나라도 실패하면 전체가 롤백됨을 테스트로 확인한다(트랜잭션 원자성).
  - [x] 매칭 후 팀장이 `GET /api/managed/sales-logs` 호출 시 기존에 쌓여있던 영업일지가 바로 조회된다.

### BE-13. 배포 설정

- **선행 Task**: BE-3, FE-9
- **수행 작업**:
  - Express가 React 빌드 산출물(`frontend/build` 또는 `dist`)을 정적 파일로 서빙하도록 구성한다(같은 origin, PRD 7번 기본 구성).
  - 프로덕션용 `.env` 값(세션 시크릿, DB 접속정보 등)을 준비한다.
- **완료 조건**:
  - [ ] 프로덕션 빌드된 React 앱이 Express 서버 하나로 접속·동작한다.
  - [ ] 별도의 CORS 설정 없이 로그인/세션이 정상 동작한다(같은 origin 구성이므로).

---

## 3. Frontend

### FE-1. 프로젝트 셋업 및 공통 레이아웃

- **선행 Task**: 없음 (백엔드와 병행 착수 가능, 실제 연동은 각 화면 Task에서 진행)
- **수행 작업**:
  - React 프로젝트를 4-project-principle.md 6번 디렉토리 구조(`pages/`, `components/`, `api/`, `hooks/`)대로 스캐폴딩한다.
  - 라우팅, 공통 네비게이션 바(`components/common/Layout.jsx`), `RoleGuard.jsx`(role별 화면 분기), `api/` 하위 fetch 래퍼 베이스를 구성한다.
- **완료 조건**:
  - [x] `npm start`(또는 동등 스크립트)로 앱이 기동되고 빈 라우트들이 렌더링된다. (Vite는 `npm run dev`)
  - [x] 로그인 안 된 상태로 보호된 라우트 접근 시 로그인 화면으로 리다이렉트된다.

### FE-2. 회원가입/로그인 화면 `(P0)`

- **선행 Task**: FE-1, BE-3
- **수행 작업**:
  - `SignupPage.jsx`, `LoginPage.jsx`를 6-wireframe.md 1·2번 와이어프레임대로 구현한다.
  - 역할이 '영업사원'일 때만 팀장 이메일 입력란을 노출한다.
  - 로그인 성공 시 `role`에 따라 `/salesperson` 또는 `/manager` 하위로 자동 이동한다(UC-002).
- **완료 조건**:
  - [x] 실제 BE-3 API와 연동해 회원가입/로그인이 동작한다.
  - [x] 서버가 반환하는 검증 오류(사번 중복 등)가 화면에 표시된다.
  - [x] 영업사원으로 로그인 시 영업일지 작성 화면으로, 팀장으로 로그인 시 팀장 View로 각각 이동한다.

### FE-3. 영업일지 작성 화면 `(P0)`

- **선행 Task**: FE-2, BE-5, BE-6
- **수행 작업**:
  - `SalesLogFormPage.jsx`, `CustomerSelect.jsx`, `SalesLogForm.jsx`를 6-wireframe.md 3번 와이어프레임대로 구현한다.
  - 거래처 드롭다운은 BE-5의 `GET /api/customers` 결과만 노출하고 신규 등록 UI는 두지 않는다(RULE-CUSTOMER-002).
  - 작성일은 화면에 표시만 하고 입력 불가 처리한다.
  - 동일 폼을 수정 모드로 재사용한다(작성자 본인 접근 시).
- **완료 조건**:
  - [ ] 저장 성공 시 BE-6에 실제로 영업일지가 생성된다.
  - [ ] 활동 내역 입력란 위/아래에 "가격·계약조건이 아닌 관계 활동을 적어달라"는 안내 문구가 노출된다(PRINCIPLE-ACTIVITY-001).
  - [ ] 기존 영업일지 수정 진입 시 기존 값이 폼에 채워지고, 저장 시 PATCH가 호출된다.

### FE-4. 영업일지 조회/검색 화면 `(P0)`

- **선행 Task**: FE-2, BE-10
- **수행 작업**:
  - `SalesLogListPage.jsx`를 6-wireframe.md 4번 와이어프레임대로 구현한다: 기간/거래처/영업형태/키워드 검색 조건 + 목록.
- **완료 조건**:
  - [ ] 검색 조건 입력 후 BE-10 API 결과가 목록에 반영된다.
  - [ ] 목록 항목 클릭 시 FE-5(상세 화면)로 이동한다.
  - [ ] 상태 배지("작성 완료"/"코멘트 진행중")가 서버 응답값 그대로 표시된다.

### FE-5. 영업일지 상세 + 코멘트 확인/답변 화면 `(P0)`

- **선행 Task**: FE-3, BE-8
- **수행 작업**:
  - `SalesLogDetailPage.jsx`, `CommentThread.jsx`, `CommentForm.jsx`를 6-wireframe.md 5번 와이어프레임대로 구현한다.
  - 팀장 코멘트가 1건이라도 있으면 삭제 버튼을 비활성화하고, 수정 버튼은 항상 활성 상태로 둔다(RULE-LOG-005).
  - 팀장 코멘트가 1건 이상 있어야 답변 입력창을 활성화한다(RULE-REPLY-001).
- **완료 조건**:
  - [ ] 코멘트 스레드가 시간순으로 표시되고, 답변 등록 시 즉시 스레드에 반영된다.
  - [ ] 코멘트가 있는 영업일지에서 삭제 버튼 클릭이 비활성화되어 있음을 화면에서 확인한다.
  - [ ] 코멘트가 없는 영업일지에서는 답변 입력창이 비활성화되어 있다.

### FE-6. 팀장 View — 팀원 영업일지 목록 `(P0)`

- **선행 Task**: FE-2, BE-7
- **수행 작업**:
  - `ManagedSalesLogListPage.jsx`를 6-wireframe.md 7번 와이어프레임대로 구현한다.
  - 코멘트 미작성 건(상태="작성 완료")을 별도 상태값을 만들지 않고 강조 표시(★ 등)로만 구분한다(PRD 5.11).
- **완료 조건**:
  - [ ] 로그인한 팀장에게 매핑된 영업사원의 일지만 목록에 나타난다.
  - [ ] 목록 클릭 시 FE-7(팀장용 상세)로 이동한다.

### FE-7. 팀장 View — 상세 + 코멘트 작성 화면 `(P0)`

- **선행 Task**: FE-6, BE-8
- **수행 작업**:
  - `SalesLogReviewPage.jsx`를 6-wireframe.md 8번 와이어프레임대로 구현한다.
  - 영업일지 내용/기존 코멘트 스레드는 읽기 전용으로 표시하고, 팀장 본인만 코멘트 입력창을 사용할 수 있게 한다.
- **완료 조건**:
  - [ ] 영업일지 자체를 수정/삭제하는 버튼이 이 화면에는 존재하지 않는다(팀장 권한 없음, FE-5와 대비).
  - [ ] 코멘트 등록 시 즉시 스레드에 반영되고, 여러 번 등록해도 전부 성공한다.

### FE-8. 팀장 코멘트 이력 화면 `(P0)`

- **선행 Task**: FE-6, BE-8
- **수행 작업**:
  - `MyCommentHistoryPage.jsx`를 6-wireframe.md 9번 와이어프레임대로 구현한다(`GET /api/managed/comments` 연동).
- **완료 조건**:
  - [ ] 로그인한 팀장이 과거에 남긴 코멘트만 작성일순으로 표시된다.
  - [ ] 항목 클릭 시 FE-7(SalesLogReviewPage)로 이동한다.

### FE-9. 반응형 스타일 적용 `(P0)`

- **선행 Task**: FE-3, FE-4, FE-5, FE-6, FE-7, FE-8
- **수행 작업**:
  - 6-wireframe.md의 반응형 원칙(네비게이션 축약, 표→카드형 리스트, 입력 필드 세로 배치)을 CSS 미디어쿼리로 적용한다.
  - 별도의 `Mobile*` 컴포넌트/접근성(a11y) 대응은 만들지 않는다(PRD 6번).
- **완료 조건**:
  - [ ] 좁은 화면(모바일 폭)에서 모든 목록형 화면이 카드형으로 전환됨을 브라우저 반응형 모드로 확인한다.
  - [ ] 검색 조건/폼 입력 필드가 좁은 화면에서 세로로 쌓인다.

### FE-10. STT 음성 입력 `(P1)`

- **선행 Task**: FE-3
- **수행 작업**:
  - `VoiceInputButton.jsx`를 구현한다: 브라우저 `SpeechRecognition`/`webkitSpeechRecognition`(ko-KR) 사용, 변환 결과를 활동 내역 입력란에 반영만 하고 즉시 저장하지 않는다(RULE-STT-001~006).
  - 미지원 브라우저에서는 버튼을 숨기거나 비활성화하고 직접 입력만 가능하게 둔다(RULE-STT-007).
- **완료 조건**:
  - [ ] 음성 인식 결과가 활동 내역 입력란에 반영되고, 저장 전 자유롭게 수정 가능하다.
  - [ ] 직접 입력한 텍스트와 음성 입력 결과가 한 입력란에서 자연스럽게 공존한다.
  - [ ] `SpeechRecognition` 미지원 브라우저에서도 폼 작성/저장 자체는 정상 동작한다.

### FE-11. 거래처 Know-how 조회 화면 `(P1)`

- **선행 Task**: FE-2, BE-11
- **수행 작업**:
  - `CustomerKnowhowPage.jsx`를 6-wireframe.md 6번 와이어프레임대로 구현한다.
- **완료 조건**:
  - [ ] 거래처 선택 시 BE-11 결과(작성자·작성일·활동내용만)가 시간순으로 표시된다.
  - [ ] 코멘트/답변 데이터가 화면 어디에도 노출되지 않는다.

---

## 4. 통합 및 배포

### INT-1. 핵심 시나리오 통합 확인

- **선행 Task**: FE-3, FE-5, FE-6, FE-7, BE-9
- **수행 작업**:
  - `3-user-scenario.md`의 P0 시나리오(1~7번: 회원가입, 로그인, 작성, 코멘트, 답변, 삭제 제한, 검색)를 실제 화면에서 순서대로 수동 실행한다.
- **완료 조건**:
  - [ ] 시나리오 1~7번이 문서에 서술된 대로 오류 없이 재현된다.
  - [ ] 발견된 불일치/버그가 있으면 이슈로 기록하고 해당 BE/FE Task에 역으로 반영한다.

### INT-2. P1 시나리오 통합 확인 (여유 시)

- **선행 Task**: BE-11, BE-12, FE-10, FE-11, INT-1
- **수행 작업**:
  - `3-user-scenario.md` 시나리오 8~10번(STT, Know-how 조회, 팀장 자동 연결)을 수동 실행한다.
- **완료 조건**:
  - [ ] 시나리오 8~10번이 문서에 서술된 대로 재현된다.
  - [ ] 일정이 부족하면 이 Task 전체를 보류하고 P0만으로 배포 가능함을 확인한다(PRD 9번 리스크 대응).

### INT-3. 배포

- **선행 Task**: BE-13, INT-1
- **수행 작업**:
  - 단일 서버(Express + 정적 React 빌드) + 단일 PostgreSQL 인스턴스로 배포한다(4-project-principle.md 5번).
- **완료 조건**:
  - [ ] 배포된 URL에서 회원가입부터 코멘트 작성까지 핵심 플로우가 실사용 환경에서 동작한다.
  - [ ] 프로덕션 환경변수(세션 시크릿, DB 접속정보)가 저장소에 노출되지 않았음을 확인한다.
