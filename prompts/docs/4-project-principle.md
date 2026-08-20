# 프로젝트 구조 설계 원칙 — 정성을 보여줘

> 본 문서는 코드가 아니라 **설계 원칙**을 정의한다. 실제 구현 코드는 포함하지 않으며, 필요한 곳에만 폴더 트리와 네이밍 예시를 짧게 곁들인다. 근거 문서: `2-PRD.md`, `3-user-scenario.md`, `정성을 보여줘 도메인 정의서.md`.

전제: 1인 개발자, 5일 일정, PostgreSQL 4개 테이블(users, customers, sales_logs, comments) 규모의 REST API 단일 서버 + React 반응형 웹. 이 규모를 벗어나는 구조는 전부 오버엔지니어링으로 간주하고 배제한다.

---

## 1. 최상위 원칙

이 프로젝트의 모든 구조적 판단은 다음 다섯 가지 원칙으로 환원된다.

1. **YAGNI (지금 필요한 것만 만든다)**
   PRD 5번에 명시된 기능(P0) 외에는 만들지 않는다. "나중에 팀 개념이 생기면", "나중에 DB를 바꾸면", "나중에 관리자 화면이 생기면" 같은 가정에 대비한 구조·레이어·설정값은 두지 않는다. 거래처 마스터에 관리자 CRUD API를 만들지 않는 것(RULE-CUSTOMER-003)이 대표 사례다 — DB 직접 INSERT로 끝낸다.

2. **관심사 분리는 하되, 레이어 수는 최소로**
   "HTTP 요청 처리"와 "업무 규칙(RULE-ID)"과 "데이터 저장"은 섞이지 않아야 하지만, 이를 위해 몇 겹으로 나눌지는 별개 문제다. 이 프로젝트는 백엔드 3단계(Route/Controller/Service, Service가 DB 접근까지 담당), 프론트 3단계(Page/Component/API client)로 못박는다. 그 이상 쪼개지 않는다(2번 섹션에서 근거 설명).

3. **RULE-ID의 코드 내 추적 가능성**
   도메인 정의서/PRD의 모든 RULE-ID(RULE-LOG-005 등)는 이를 구현한 코드 바로 위에 주석으로 남긴다. 이것이 이 프로젝트에서 유일하게 강제하는 "문서화 규칙"이다 — 별도의 요구사항 추적 매트릭스나 위키 페이지는 만들지 않는다. 코드 자체가 추적표다.

4. **모노레포 + 폴더 분리 (도구 없이)**
   1인 개발이므로 `frontend/`, `backend/` 두 폴더를 하나의 git 레포에 둔다. 단, Nx/Turborepo/Lerna 같은 모노레포 관리 도구는 도입하지 않는다 — 두 앱은 각자 독립된 `package.json`을 가지며, 배포 시 백엔드가 프론트엔드 빌드 산출물을 정적 파일로 서빙하는 것으로 "연결"이 끝난다.

5. **단일 진실 공급원(Single Source of Truth)**
   데이터의 정의는 PostgreSQL 스키마(`schema.sql`) 하나다. 프론트/백엔드 타입을 자동 동기화하는 코드젠(OpenAPI, GraphQL 스키마 등)은 두지 않는다 — 대신 3번 섹션의 "도메인 용어 매핑표"를 사람이 지키는 단일 기준으로 삼는다.

6. **파생 가능한 값은 저장하지 않는다**
   영업일지 상태("작성 완료" / "코멘트 진행중", PRD 5.11)는 `sales_logs`에 별도 컬럼을 두지 않고, 해당 일지에 연결된 `comments` 존재 여부로 매 조회 시 계산한다. 상태 컬럼과 실제 코멘트 데이터가 어긋나는 동기화 버그 자체를 원천 차단하는 선택이다.

---

## 2. 의존성/레이어 원칙

### 백엔드: Route → Controller → Service (3단계, 단방향)

| 레이어 | 책임 | 하지 않는 일 |
|---|---|---|
| Route | 경로/HTTP 메서드 선언, 인증/역할 미들웨어 연결 | 로직 없음 |
| Controller | `req`/`res` 변환, 입력값 꺼내기, Service 호출, 응답 반환 | RULE-ID 판단 없음 |
| Service | RULE-ID 구현 지점(비즈니스 규칙), `pool.query`로 DB 접근까지 직접 담당 | HTTP(req/res) 객체를 알지 못함 |

의존 방향은 항상 위 → 아래 한 방향이다. Service가 Controller를 참조하는 일은 없다(순환 의존 금지).

**별도 DB/Repository 레이어를 두지 않는 이유**: "DB를 나중에 바꿀 수도 있다"는 가정 자체를 하지 않는다. PostgreSQL을 그대로 쓴다는 전제이므로 Service가 `db/pool.js`(pg Pool)를 직접 호출해 SQL을 실행한다. Service와 DB 사이에 쿼리 함수 모듈이나 Repository 인터페이스를 끼워 넣는 것은 파일 수만 늘리고 실익이 없다. ORM 도입 여부도 자유이나, 4개 테이블 규모에서는 pg 드라이버로 Service 안에 얇은 쿼리를 직접 쓰는 편이 Sequelize/Prisma 같은 별도 학습·설정 비용보다 싸다.

**왜 3단계에서 멈추는가**: 유즈케이스 계층, DTO 계층, 도메인 엔티티 계층을 추가로 두는 헥사고날/클린 아키텍처는 조직 규모나 장기 유지보수 팀을 전제로 한 패턴이다. 이 프로젝트는 4테이블 CRUD + 코멘트 스레드가 전부이며, Controller/Service 분리만으로도 이미 "HTTP 없이 Service 함수만 단위테스트할 수 있다"는 핵심 이득을 얻는다. 그 이상은 없다.

### 프론트엔드: Page → Component → API client (3단계, 단방향)

| 레이어 | 책임 |
|---|---|
| Page | 라우트에 매핑되는 화면 단위. API client 호출로 데이터를 가져와 Component에 내려줌 |
| Component | 재사용 가능한 프레젠테이션 조각. props로만 데이터를 받음 |
| API client | fetch 래퍼. 백엔드 REST 엔드포인트 호출 함수 모음, 그 이상의 역할 없음 |

Component는 Page를 알지 못하고(props 계약으로만 소통), API client는 아무도 알지 못한다(가장 하위, 순수 HTTP 통신).

**왜 3단계인가**: Redux/Zustand 같은 전역 상태관리, Container/Presentational 이중 분리, 화면마다 별도 custom hook 계층을 강제하는 것은 화면 수가 10개 안팎인 이 프로젝트에 불필요하다. React 기본 `useState`/`useEffect`/`Context`(로그인 세션 정보 정도)로 충분하며, Page가 컨테이너 역할을 겸해도 무방하다.

---

## 3. 코드/네이밍 원칙

### 파일명 컨벤션

- React 컴포넌트/페이지: **PascalCase** — `SalesLogForm.jsx`, `CommentThread.jsx`, `ManagedSalesLogListPage.jsx`
- 훅: **camelCase**, `use` 접두사 — `useSession.js`
- 유틸/API client: **camelCase** — `formatDate.js`, `salesLogApi.js`
- 백엔드 라우트/컨트롤러/서비스: **camelCase** — `salesLogRoutes.js`, `salesLogController.js`, `salesLogService.js`

### DB 네이밍 (PostgreSQL)

- 테이블명: **snake_case, 복수형** — `users`, `customers`, `sales_logs`, `comments`
- 컬럼명: **snake_case** — `employee_no`, `activity_type`, `created_at`
- PK는 `id`, FK는 `{단수}_id` — `customer_id`, `manager_id`, `sales_log_id`, `author_id`

### API 엔드포인트 네이밍

REST 원칙, 리소스는 복수형 명사, 다중 단어는 kebab-case.

```
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/logout

GET    /api/customers                 (거래처 마스터 조회 전용 — 등록 API 없음, RULE-CUSTOMER-003)
GET    /api/customers/:id/knowhow      (P1, RULE-KNOWHOW-001~006)

GET    /api/sales-logs                 (본인 목록/검색 — 쿼리파라미터: from, to, customerId, activityType, keyword. RULE-SEARCH-001)
POST   /api/sales-logs
GET    /api/sales-logs/:id
PATCH  /api/sales-logs/:id
DELETE /api/sales-logs/:id             (RULE-LOG-005 위반 시 403 — 하드 삭제. 소프트 삭제 플래그를 두지 않으므로 RULE-KNOWHOW-005도 별도 로직 없이 자동 충족된다)

GET    /api/managed/sales-logs         (팀장 View — 매핑된 영업사원 일지 목록, UC-007)
GET    /api/managed/comments           (팀장 View — 본인이 과거에 작성한 코멘트 이력, PRD 5.6/섹션 18)

GET    /api/sales-logs/:id/comments
POST   /api/sales-logs/:id/comments    (role에 따라 피드백/답변 자동 구분)
```

검색을 위한 별도 `/search` 엔드포인트를 만들지 않고 목록 조회에 쿼리파라미터를 얹는 이유: 검색은 결국 "조건이 걸린 목록 조회"일 뿐이라 리소스를 분리할 근거가 없다.

### 도메인 용어 ↔ 코드 네이밍 매핑표

| 도메인 용어 (PRD/도메인 정의서) | DB 테이블/컬럼 | JS 클래스/변수 | API 리소스 |
|---|---|---|---|
| 사용자 | `users` | `User` / `user` | `/api/auth` (별도 `/api/users` CRUD는 두지 않음 — 프로필 수정 기능 자체가 PRD에 없음, YAGNI) |
| 사번 | `employee_no` | `employeeNo` | — |
| 역할(영업사원/팀장) | `role` (`'salesperson'` \| `'manager'`) | `role` | — |
| 거래처 | `customers` | `Customer` / `customer` | `/api/customers` |
| 영업일지 | `sales_logs` | `SalesLog` / `salesLog` | `/api/sales-logs` |
| 영업 형태(외근/내근/기타) | `activity_type` | `activityType` | — |
| 활동 내역 | `activity_content` | `activityContent` | — |
| 작성일(최초 등록일, 불변) | `created_at` | `createdAt` | — |
| 팀장 이메일(가입 시 입력) | `manager_email` — 영업사원은 필수(RULE-ORG-001), 팀장 행에서는 NULL(RULE-ORG-006) | `managerEmail` | — |
| 실제 팀장 계정 매핑 | `manager_id` — 매칭 전까지 NULL(RULE-ORG-003), 매칭되는 팀장이 가입하면 채워짐(RULE-ORG-005) | `managerId` | — |
| 코멘트(팀장 피드백 + 영업사원 답변) | `comments` | `Comment` / `comment` | `/api/sales-logs/:id/comments` |
| 코멘트 작성자 구분 | `author_id` → `users.role`로 판별 | `type` (`'팀장 코멘트'` \| `'답변'`) | — |

`comments` 테이블은 하나로 두되(별도 feedback/reply 테이블 분리 없음), 작성자의 `users.role`을 조인해 화면에서 "팀장 코멘트"인지 "영업사원 답변"인지 구분한다 — 테이블을 쪼개면 스레드 조회 쿼리가 UNION이 필요해지는데, 4테이블 원칙과도 맞지 않는다.

`manager_email`과 `manager_id`를 분리하는 이유: RULE-ORG-003은 팀장이 아직 가입하지 않은 상태에서도 그 이메일로 상사 관계를 먼저 등록해야 한다고 요구한다. 정수 FK인 `manager_id` 하나만으로는 "아직 존재하지 않는 사용자의 이메일"을 담을 수 없으므로, 가입 시 입력받는 원본 값(`manager_email`)과 실제 매칭된 계정을 가리키는 FK(`manager_id`)를 별개 컬럼으로 둔다. `manager_email`이 있으면 팀장 계정 존재 여부와 무관하게 알림 발송(RULE-ORG-004)이 가능하고, `manager_id`는 팀장이 가입하는 순간 일괄 백필된다(RULE-ORG-005, 상세는 7번 `organizationService.js` 및 5번 트랜잭션 원칙 참조).

### RULE-ID 주석 규칙

RULE-ID를 구현하는 코드 바로 위에 한 줄 주석으로 남긴다.

```js
// RULE-LOG-005: 팀장 코멘트가 1건이라도 있으면 작성자도 삭제 불가
```

커밋 메시지에 관련 RULE-ID를 적으면 좋으나 강제하지는 않는다(1인 개발, 별도 PR 리뷰 프로세스 없음).

---

## 4. 테스트/품질 원칙

**단위테스트는 핵심 비즈니스 규칙에만 집중한다.** 전체 커버리지 목표는 두지 않는다. 5일 일정에서 우선순위를 두는 대상(Jest, Service 레이어 함수 기준):

- RULE-LOG-005 — 코멘트가 있는 영업일지는 삭제 불가
- RULE-ORG-007 — 영업사원은 정확히 하나의 팀장에게만 매핑
- RULE-FEEDBACK-002 / RULE-REPLY-001 — 최초 코멘트는 팀장부터 시작, 팀장 코멘트 없이는 답변 불가
- RULE-SEARCH-001 — 검색은 본인 작성 영업일지로 한정
- (P1 여유 시) RULE-ORG-005 — 미가입 팀장이 뒤늦게 가입할 때 매칭되는 영업사원들의 `manager_id`가 한 번에 백필되는지
- (P1 여유 시) RULE-KNOWHOW-003/005/006 — 코멘트 제외, 삭제 건 제외, 조직 범위 필터링

나머지(화면 렌더링, 단순 CRUD happy path, 이메일 발송)는 수동 확인으로 대체한다.

**린트**: ESLint + Prettier의 recommended 설정 정도만 사용한다. airbnb 등 무거운 룰셋을 강제하지 않는다. 레포 루트에 설정 하나를 두고 frontend/backend가 공유한다.

**PR 없음 — 커밋 전 체크리스트로 대체** (1인 개발이므로 리뷰 프로세스 자체가 불필요):

- [ ] 이번 변경이 구현하는 RULE-ID를 코드 주석으로 남겼는가
- [ ] 핵심 규칙(위 목록)을 건드렸다면 관련 단위테스트가 통과하는가
- [ ] 화면에서 한 번 직접 눌러 확인했는가
- [ ] `.env` 값이나 비밀정보가 커밋에 섞이지 않았는가

---

## 5. 설정/보안/운영 원칙

- **환경변수**: `.env`(gitignore 대상)에 DB 접속정보, `SESSION_SECRET`, SMTP 설정 보관. `.env.example`에는 키 목록과 형식만 남겨 온보딩 시 참고하게 한다.
- **비밀번호**: bcrypt로 해시 저장, 평문 저장 금지. 2FA/SSO 등 고급 인증체계는 두지 않는다(PRD 6번 확정 사항).
- **세션**: `express-session` + `connect-pg-simple`로 기존 PostgreSQL에 세션 저장(별도 Redis 없음). `SESSION_SECRET`은 `.env`로 관리, `httpOnly` 쿠키 사용. 같은 origin으로 서빙하는 기본 구성에서는 `SameSite=Lax`로 충분하며, 프론트/백을 다른 origin에 배포하는 예외 상황에서만 `SameSite=None; Secure` + CORS `credentials: true` + HTTPS를 추가한다(PRD 7번 그대로).
- **CORS**: 기본 배포 구성(Express가 React 빌드 산출물을 같은 origin에서 서빙)에서는 CORS 자체가 필요 없다 — `cors` 패키지 설치도 기본값으로는 생략한다.
- **트랜잭션**: 대부분의 CRUD는 단일 INSERT/UPDATE라 트랜잭션이 필요 없다. 예외적으로 여러 행을 함께 갱신하는 RULE-ORG-005(팀장 가입 시 매칭되는 영업사원 여러 명의 `manager_id`를 한 번에 백필)만 Service에서 `pool.connect()`로 얻은 단일 client에 BEGIN/COMMIT을 걸어 처리한다 — 이 예외 하나를 위해 모든 DB 함수에 범용 트랜잭션 지원을 미리 깔아두지 않는다.
- **로깅**: `morgan` 등으로 요청 로그만 최소 수준으로 남긴다. 별도 로그 수집 인프라(ELK, Datadog 등)는 두지 않는다. 에러는 콘솔 로그로 충분하다.
- **이메일 알림 실패 격리**: 발송 로직은 반드시 try/catch로 감싸고 실패해도 영업일지/코멘트 저장 트랜잭션에 영향을 주지 않는다(RULE-NOTIFICATION-001). 실제 SMTP 연동 전에는 콘솔 로그로 발송 내용을 대체할 수 있다(PRD 7번에 명시된 리스크).
- **배포**: 단일 Node 프로세스 + 단일 PostgreSQL 인스턴스. Express가 React 빌드 결과물을 정적 파일로 서빙(같은 origin이 기본 구성). PM2 등 프로세스 매니저 사용은 선택사항. CI/CD 파이프라인 구축은 이번 범위 밖이며 수동 배포를 전제로 한다.

---

## 6. 프론트엔드 디렉토리 구조

PRD 3번의 역할 구분(영업사원 View / 팀장 View)을 `pages/` 하위 폴더로 그대로 반영한다.

반응형(PRD 6번)은 별도의 모바일 전용 페이지/컴포넌트 트리를 만들지 않고, 동일한 Component에 CSS 미디어 쿼리만 적용해 대응한다 — `Mobile*` 접두사 컴포넌트나 브레이크포인트별 분기 로직은 두지 않는다. 접근성(a11y)은 PRD 6번에 따라 이번 범위에서 고려하지 않으며, 별도의 ARIA 유틸리티나 접근성 테스트 도구도 추가하지 않는다.

```
frontend/
  src/
    pages/
      auth/
        SignupPage.jsx
        LoginPage.jsx
      salesperson/                     # 영업사원 View
        SalesLogFormPage.jsx           # 작성 (5.4)
        SalesLogListPage.jsx           # 본인 조회/검색 (5.9)
        SalesLogDetailPage.jsx         # 상세 + 코멘트 확인/답변 (5.7)
        CustomerKnowhowPage.jsx        # 거래처 Know-how 조회 (5.10, P1)
      manager/                         # 팀장 View
        ManagedSalesLogListPage.jsx    # 매핑된 영업사원 일지 목록 (5.6, UC-007)
        SalesLogReviewPage.jsx         # 상세 + 코멘트 작성 (5.7)
        MyCommentHistoryPage.jsx       # 본인이 남긴 코멘트 이력 (5.6, 섹션 18) — GET /api/managed/comments 호출
    components/
      salesLog/
        SalesLogForm.jsx
        SalesLogListItem.jsx
        CustomerSelect.jsx             # 사전 등록 거래처 선택 전용, 신규 등록 UI 없음 (RULE-CUSTOMER-002)
        VoiceInputButton.jsx           # STT, P1 (RULE-STT-001~007)
        StatusBadge.jsx                # 작성 완료 / 코멘트 진행중
      comment/
        CommentThread.jsx
        CommentForm.jsx
      common/
        Layout.jsx
        RoleGuard.jsx                  # 로그인 후 role에 따라 salesperson/manager 라우트로 분기
    api/
      authApi.js
      salesLogApi.js
      commentApi.js
      customerApi.js
    hooks/
      useSession.js
    App.jsx
    main.jsx
```

로그인 성공 후 역할 기반 라우팅(UC-002)은 별도 권한관리 라이브러리 없이 `RoleGuard` 컴포넌트 하나로 처리한다 — 세션의 `role` 값을 보고 `/salesperson` 또는 `/manager` 하위로 리다이렉트한다.

---

## 7. 백엔드 디렉토리 구조

PRD 5번의 기능 단위가 라우트/서비스로 어떻게 매핑되는지 표시했다. STT(5.5)는 브라우저 전용 기능이라 백엔드에 대응 라우트/서비스가 없다 — 활동 내역 텍스트가 `salesLogController`를 통해 그냥 저장될 뿐이다(RULE-STT-006).

```
backend/
  src/
    routes/
      authRoutes.js            # 5.1 인증/회원가입
      salesLogRoutes.js         # 5.4 CRUD, 5.6 팀장 조회, 5.9 검색 (쿼리파라미터로 분기)
      commentRoutes.js          # 5.7 코멘트 스레드 (nested: /sales-logs/:id/comments), 5.6 팀장 코멘트 이력(/api/managed/comments, 섹션 18)
      customerRoutes.js         # 5.3 거래처 마스터 조회 전용, 5.10 Know-how(P1)
    controllers/
      authController.js
      salesLogController.js
      commentController.js
      customerController.js
    services/
      authService.js            # RULE-AUTH-001~006, RULE-USER-001~002
      organizationService.js    # RULE-ORG-001~008 — 영업사원 가입 시 manager_email을 저장하고, 그 이메일로 팀장이 가입하면 매칭되는 영업사원들의 manager_id를 일괄 백필한다(RULE-ORG-005, P1). authService/salesLogService/commentService가 공용으로 참조
      salesLogService.js        # RULE-LOG-001~005, RULE-SEARCH-001, 상태 계산(5.11)
      commentService.js         # RULE-FEEDBACK-001~004, RULE-REPLY-001~005
      customerService.js        # RULE-CUSTOMER-001~003, RULE-KNOWHOW-001~006(P1)
      notificationService.js    # RULE-NOTIFICATION-001(발송 실패 격리), Nodemailer 래핑 — salesLogService(RULE-ORG-004 신규 일지 알림)와 commentService(RULE-FEEDBACK-004/RULE-REPLY-005 코멘트·답변 알림)가 호출하는 공용 유틸리티
    db/
      pool.js                   # pg Pool
      userQueries.js
      customerQueries.js
      salesLogQueries.js
      commentQueries.js
    middleware/
      auth.js                    # requireAuth(세션 확인) + requireRole(영업사원/팀장 접근 제어) — 둘 다 짧아 파일 하나로 묶음
    config/
      session.js                 # express-session + connect-pg-simple
      env.js
    app.js
    server.js
  sql/
    schema.sql                  # users, customers, sales_logs, comments DDL만 포함 — session 테이블은 connect-pg-simple이 별도로 생성(schema.sql에 포함하지 않음, 7-schema.sql 하단 참고)
    seed.sql                    # 거래처 마스터 시드 데이터 (RULE-CUSTOMER-003)
```

`organizationService.js`, `notificationService.js`는 특정 화면 하나에 속하지 않고 여러 기능이 공용으로 참조하는 로직이라 별도 하위 폴더를 만들지 않고 `services/` 바로 아래 평평하게 둔다 — 폴더 깊이 2단계 이내 원칙을 유지하기 위함이다.
