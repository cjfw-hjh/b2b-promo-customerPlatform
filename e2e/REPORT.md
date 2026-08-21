# E2E 테스트 리포트 — 정성을 보여줘

- 테스트 대상: `localhost:5173`(프론트, vite dev) + `localhost:3000`(백엔드, Express+PostgreSQL, `/api` 프록시)
- 테스트 방법: Playwright MCP로 실제 브라우저를 조작 (desktop 1280x800, mobile 375x700)
- 테스트 일시: 2026-08-21
- 기준 문서: `prompts/docs/3-user-scenario.md`(시나리오 1~10), `prompts/docs/6-wireframe.md`, `prompts/docs/8-plan.md`(INT-1/INT-2)

## 전체 요약

| 구분 | 케이스 수 | PASS | FAIL |
|---|---|---|---|
| P0 시나리오 (1~7) | 7 | 7 | 0 |
| P1 시나리오 (8~10) | 3 | 3 | 0 |
| 엣지 케이스 | 12 | 11 | 1 |
| 모바일 반응형 | 2 (+보너스 4화면) | 2 | 0 |
| **총합** | **24** | **23** | **1** |

스크린샷 총 40개, `e2e/screenshots/` 아래 저장.

### 발견된 이슈

1. **[버그] 존재하지 않는 영업일지 id로 상세 조회 시 무한 로딩** (EDGE-10, FAIL)
   백엔드는 `GET /api/sales-logs/:id`, `GET /api/sales-logs/:id/comments`에 대해 정확히 404("영업일지를 찾을 수 없습니다.")를 반환하지만, `SalesLogDetailPage`가 이 에러를 catch해서 사용자에게 보여주는 처리가 없어 화면이 "불러오는 중..."에 영원히 멈춘다. 사용자는 뒤로 갈 수 있는 안내조차 받지 못한다.
   재현: 로그인 후 `http://localhost:5173/salesperson/logs/999999999` 접속 → 콘솔에 404 에러 2건, "Error: 영업일지를 찾을 수 없습니다." 2건 발생 → 화면은 "불러오는 중..."에서 멈춤(스크린샷 `edge-10-nonexistent-log-id-stuck-loading.png`).
   같은 컴포넌트를 팀장용 `SalesLogReviewPage`도 재사용/유사 구조일 가능성이 높아 동일 증상이 있을 것으로 추정된다(팀장 쪽은 별도로 재현하지 않음, 근본 원인이 같은 fetch 에러 처리 부재이므로 함께 확인 권장).

2. **[경미/참고] 로그아웃 상태에서 `/api/auth/me` 401이 브라우저 콘솔에 error 레벨로 노출됨**
   세션 체크 목적의 정상적인 흐름(비로그인 상태 확인)인데도 매 페이지 진입 시 콘솔에 빨간 에러로 찍힌다. 기능 동작에는 영향 없으나 개발/QA 시 실제 에러와 혼동될 여지가 있다.

3. **[참고, 버그 아님] 상세화면 '취소'/뒤로가기 버튼이 목록이 아니라 브라우저 히스토리상 직전 페이지로 이동**
   수정 화면의 '취소' 버튼이 `navigate(-1)` 방식으로 동작해, 목록 화면을 거치지 않고 다른 상세 화면을 보다가 수정에 들어간 경우 그 이전 상세 화면으로 돌아간다. 시나리오/와이어프레임에 명시된 동작은 아니라 버그로 규정하기는 애매하지만, 항상 목록으로 돌아가는 편이 사용자 예측 가능성 면에서 더 나을 수 있다.

4. **[확인, 버그 아님] users 테이블에 이름(name) 컬럼이 없어 화면에 사번이 표시됨**
   `6-wireframe.md`/시나리오 문서에는 "김민준", "박서연" 같은 이름이 예시로 등장하지만, 실제 `7-schema.sql`의 `users` 테이블에는 `name` 컬럼이 존재하지 않는다(문서의 이름은 서사적 장치일 뿐 실제 스펙 아님). 화면에는 사번(900002 등)이 작성자 식별자로 표시되는데, 이는 스키마와 정합적인 정상 동작이라 이슈로 볼 수 없다. 혼란 방지를 위해 기록만 남긴다.

### 테스트 계정

| 이메일 | 사번 | 역할 | 비고 |
|---|---|---|---|
| styletest001@example.com | 999001 | 영업사원 | 사전 존재, managerEmail=manager001@example.com(미가입) |
| e2e.sales2@example.com | 900002 | 영업사원 | managerEmail=e2e.manager1@example.com |
| e2e.sales3@example.com | 900003 | 영업사원 | managerEmail=e2e.manager1@example.com (sales2와 동일 팀장) |
| e2e.manager1@example.com | 900001 | 팀장 | sales2/sales3 담당 |
| manager001@example.com | 900004 | 팀장 | RULE-ORG-005 검증용, styletest001의 기존 팀장 이메일 |

영업일지: id 3898(교촌 치킨, sales2, 코멘트 4턴 진행), 3899(메가 요거트, sales2, 코멘트 없음), 3900(교촌 치킨, sales3, 코멘트 없음), 3409(교촌 치킨, styletest001, 사전 존재).

---

## P0 시나리오

### 시나리오 1 — 회원가입 (미가입 팀장 이메일 허용 + 역할별 폼 차이)

- **목적**: 영업사원 가입 시 팀장 이메일 입력란 노출 및 미가입 이메일도 형식만 맞으면 가입 허용, 팀장 가입 시 팀장 이메일 입력란 자체가 없는지 확인.
- **절차**: `/signup`에서 역할=영업사원으로 사번 900002/이메일 e2e.sales2@example.com/비밀번호/팀장이메일(e2e.manager1@example.com, 이 시점에 미가입) 입력 후 가입 → 역할=팀장으로 라디오 전환 시 팀장 이메일 입력란이 사라짐을 확인 → 사번 900001/이메일 e2e.manager1@example.com으로 가입.
- **기대 결과**: 미가입 팀장 이메일이어도 가입 성공, 역할 전환 시 팀장 이메일 입력란 노출/숨김이 즉시 반영.
- **실제 결과**: 기대대로 동작. 가입 성공 후 `/login`으로 리다이렉트.
- **PASS**
- 스크린샷: `screenshots/01-signup-salesperson-form-filled.png`, `screenshots/01-signup-manager-no-manageremail-field.png`

### 시나리오 2 — 로그인 후 역할별 화면 진입 + 세션 유지/즉시 종료

- **목적**: 로그인 성공 시 role에 따라 자동으로 다른 화면(영업사원→작성 폼, 팀장→팀원 목록)으로 이동하는지, 세션이 페이지 이동/재접속에도 유지되는지, 로그아웃 시 즉시 끊기는지 확인.
- **절차**: e2e.sales2로 로그인 → `/salesperson/logs/new`로 자동 이동 확인 → e2e.manager1로 로그인 → `/manager/logs`로 자동 이동 확인 → styletest001로 로그인 후 다른 URL로 이동했다가 다시 `/salesperson/logs`로 돌아와도 로그인 유지되는지 확인 → 로그아웃 후 같은 보호된 라우트 재접속 시 로그인 화면으로 튕기는지 확인.
- **기대 결과**: role별 자동 라우팅, 세션 유지, 로그아웃 즉시 무효화.
- **실제 결과**: 모두 기대대로 동작.
- **PASS**
- 스크린샷: `screenshots/02-login-salesperson-redirect-to-form.png`, `screenshots/02-login-manager-redirect-to-list.png`

### 시나리오 3 — 외근 후 영업일지 작성

- **목적**: 거래처 드롭다운(사전 등록 목록만), 영업 형태, 활동 내역 입력 후 저장 시 작성일 자동 기록 및 상태 "작성 완료" 확인.
- **절차**: e2e.sales2로 로그인 → 거래처 "교촌 치킨", 영업형태 "외근", 활동 내역에 시나리오 문구 입력 후 저장.
- **기대 결과**: 저장 성공, 작성일 자동 기록(오늘 날짜, 2026-08-21), 상태 "작성 완료", 답변 입력창은 코멘트가 없으므로 비활성.
- **실제 결과**: 기대대로 동작(id=3898 생성). 답변 입력창 비활성 문구 "※ 팀장 코멘트가 1건 이상 있어야 입력 가능합니다." 확인.
- **PASS**
- 스크린샷: `screenshots/03-sales-log-form-filled.png`, `screenshots/03-sales-log-detail-after-create.png`

### 시나리오 4 — 팀장이 영업일지를 확인하고 코멘트를 남기다

- **목적**: 팀장 View에서 자신에게 매핑된 영업사원의 일지만 보이는지, 코멘트 등록 시 상태가 "코멘트 진행중"으로 바뀌는지, 코멘트 이력 화면이 동작하는지 확인.
- **절차**: e2e.manager1로 로그인 → `/manager/logs`에서 sales2/sales3의 일지 3건만 보임(다른 팀장 소속 styletest001 일지는 안 보임) 확인 → id=3898 진입, 읽기 전용 확인 → 코멘트 등록 → 상태 변화 확인 → `/manager/comments`에서 이력 확인.
- **기대 결과**: 매핑된 영업사원 일지만 표시, 코멘트 등록 후 상태 "코멘트 진행중", 코멘트 이력에 방금 남긴 코멘트가 나타남.
- **실제 결과**: 기대대로 동작.
- **PASS**
- 스크린샷: `screenshots/04-manager-review-comment-form.png`, `screenshots/04-manager-comment-registered.png`, `screenshots/04-manager-comment-history.png`

### 시나리오 5 — 코멘트 확인 후 답변, 여러 차례 오가기

- **목적**: 팀장 코멘트가 있으면 답변 입력창이 활성화되는지, 코멘트/답변이 횟수 제한 없이 여러 번 오갈 수 있는지 확인.
- **절차**: e2e.sales2로 로그인 → id=3898에서 팀장 코멘트 확인, 답변 등록 → e2e.manager1로 로그인 후 같은 일지에 2차 코멘트 등록 → e2e.sales2로 다시 로그인해 2차 답변 등록. 총 코멘트 2건 + 답변 2건(4턴) 확인.
- **기대 결과**: 답변 입력창 활성화, 코멘트/답변 모두 여러 번 등록 가능, 시간순으로 스레드에 쌓임.
- **실제 결과**: 기대대로 동작. 4턴 스레드가 순서대로 표시됨.
- **PASS**
- 스크린샷: `screenshots/05-delete-disabled-with-comment.png`, `screenshots/05-salesperson-reply-registered.png`, `screenshots/05-manager-second-comment.png`, `screenshots/05-full-comment-thread-four-turns.png`

### 시나리오 6 — 코멘트가 달린 영업일지를 삭제하려다 막히다 / 수정은 가능

- **목적**: 팀장 코멘트가 1건 이상 있으면 삭제 버튼이 비활성화되고, 수정은 코멘트 존재 여부와 무관하게 항상 가능한지, 수정 후에도 최초 작성일이 유지되는지 확인.
- **절차**: id=3898(코멘트 존재)에서 삭제 버튼이 "삭제 (비활성화)"로 disabled 상태인지 확인 → 수정 버튼 클릭 → 활동 내역 일부 수정 후 저장 → 작성일 불변 확인 → 대조군으로 id=3899(코멘트 없음)에서 삭제 버튼이 활성 상태("삭제")인지 확인.
- **기대 결과**: 코멘트 있으면 삭제 비활성/수정 가능, 코멘트 없으면 삭제도 가능, 수정해도 작성일 불변.
- **실제 결과**: 기대대로 동작. 수정 후에도 "작성일: 2026-08-21 (수정해도 최초 작성일은 변경되지 않음)" 그대로 유지, 코멘트/답변 스레드도 그대로 보존.
- **PASS**
- 스크린샷: `screenshots/06-edit-form-with-comment-existing.png`, `screenshots/edge-11-reply-disabled-no-comment.png`(대조군, 삭제 활성 상태 확인용)

### 시나리오 7 — 지난 영업일지를 검색하다

- **목적**: 키워드/거래처/영업형태/기간 필터가 동작하는지, 검색 결과가 본인 작성 일지로만 제한되는지 확인.
- **절차**: e2e.sales2로 로그인 → `/salesperson/logs`에서 본인 일지 2건(교촌 치킨/메가 요거트) 확인 → 키워드 "대학" 입력 후 검색 → 교촌 치킨 1건만 필터링되는지 확인.
- **기대 결과**: 키워드에 맞는 본인 일지만 반환, 타인의 일지는 애초에 노출되지 않음.
- **실제 결과**: 기대대로 동작. 검색 전 2건 → 검색 후 1건("교촌 치킨"만 남음).
- **PASS**
- 스크린샷: `screenshots/07-search-list-before-filter.png`, `screenshots/07-search-keyword-filtered.png`

---

## P1 시나리오

### 시나리오 8 — 음성으로 활동 내역 입력 (STT)

- **목적**: Web Speech API 지원 브라우저에서 음성 입력 버튼이 노출/동작하는지, 직접 입력한 텍스트와 공존 가능한지 확인.
- **절차**: 활동 내역에 "직접 입력한 문장입니다." 입력 → "마이크 음성 입력" 버튼 클릭 → 버튼이 "듣는 중... (클릭하여 중지)"로 전환되는지 확인 → 다시 클릭해 중지 → 기존 입력 텍스트가 유지되는지 확인.
- **기대 결과**: 버튼 노출, 클릭 시 리스닝 상태 토글, 기존 텍스트 보존.
- **실제 결과**: Playwright(Chromium)는 `webkitSpeechRecognition`을 전역에 노출하므로 버튼이 정상적으로 보였고, 클릭 시 "듣는 중..." 상태로 전환/복귀가 정확히 동작했다. 기존 텍스트("직접 입력한 문장입니다.")는 그대로 유지됨.
- **한계**: 이 테스트 환경은 실제 마이크 입력이 없는 headless/CI 환경이라, 실제 음성을 말해서 텍스트로 변환되는 종단 결과(예: "매장"→"매정" 같은 오인식, 최종 텍스트 반영)까지는 확인할 수 없었다. 버튼의 존재/토글 동작과 기존 텍스트와의 공존 가능성만 검증했다.
- **PASS** (범위 내)
- 스크린샷: `screenshots/08-stt-listening-state.png`

### 시나리오 9 — 거래처 Know-how 조회 (같은 팀장 산하 공유 + 범위 제한)

- **목적**: 같은 팀장에게 매핑된 영업사원끼리는 서로의 활동 이력을 볼 수 있고, 다른 팀장 산하는 보이지 않는지, 코멘트/답변은 노출되지 않는지 확인.
- **절차**: e2e.sales3(팀장=e2e.manager1)로 "교촌 치킨" Know-how 조회 → e2e.sales2(같은 팀장)의 기록과 자신의 기록이 함께 보이는지 확인 → styletest001(팀장=manager001, 다른 팀장)로 같은 "교촌 치킨" Know-how 조회 → sales2/sales3의 기록이 보이지 않고 자신의 기록만 보이는지 확인.
- **기대 결과**: 동일 팀장 산하는 서로 공유, 다른 팀장 산하는 격리, 코멘트/답변 미노출.
- **실제 결과**: 기대대로 동작. sales3 조회 시 sales2(900002)와 sales3(900003) 기록 2건이 함께 보였고, styletest001 조회 시 자신(999001)의 기록 1건만 보였다. 두 조회 모두 코멘트/답변 텍스트는 어디에도 포함되지 않음.
- **PASS**
- 스크린샷: `screenshots/09-knowhow-same-manager-scope.png`, `screenshots/09-knowhow-scope-restricted-different-manager.png`

### 시나리오 10 — 팀장이 뒤늦게 가입하자 기존 영업사원과 자동 연결

- **목적**: 영업사원이 미가입 팀장 이메일을 입력해둔 상태에서 그 팀장이 나중에 가입하면, 팀장 가입 즉시 기존 영업사원들이 자동으로 매핑되고 팀장 View에 기존 영업일지가 바로 보이는지 확인.
- **절차**: 사전 조건(styletest001이 manager001@example.com을 팀장 이메일로 입력해둔 채 영업일지 1건 이미 작성됨, manager001은 미가입 상태)에서 manager001@example.com으로 팀장 역할 가입 → 로그인 → `/manager/logs` 확인.
- **기대 결과**: 별도 팀원 등록 절차 없이 styletest001의 기존 영업일지(id=3409)가 팀장 목록에 즉시 나타남.
- **실제 결과**: 기대대로 동작. 가입 직후 첫 로그인에서 바로 999001의 "교촌 치킨" 일지가 목록에 나타남.
- **PASS**
- 스크린샷: `screenshots/10-signup-manager001-before-submit.png`, `screenshots/10-manager001-sees-existing-log-after-signup.png`

---

## 엣지 케이스

| ID | 항목 | 기대 결과 | 실제 결과 | 판정 | 스크린샷 |
|---|---|---|---|---|---|
| EDGE-01 | 사번 5자리(6자리 아님)로 가입 시도 | 400/오류 메시지, 가입 차단 | "사번은 6자리여야 합니다." 표시, 차단됨 | PASS | `screenshots/edge-01-signup-invalid-employee-no.png` |
| EDGE-02 | 이메일 형식 오류("not-an-email", "a@b") | 가입 차단 | 브라우저 native validation("@") 및 서버 검증("이메일 형식이 올바르지 않습니다.") 모두 차단 확인 | PASS | `screenshots/edge-02-signup-invalid-email-format.png`, `screenshots/edge-02b-signup-invalid-email-server-validation.png` |
| EDGE-03 | 비밀번호 6자리(7자리 미만) | 가입 차단 | "비밀번호는 최소 7자리 이상이어야 합니다." 표시 | PASS | `screenshots/edge-03-signup-short-password.png` |
| EDGE-04 | 사번 중복(999001 재사용) | 가입 차단 | "이미 등록된 사번 또는 이메일입니다." | PASS | `screenshots/edge-04-signup-duplicate-employee-no.png` |
| EDGE-05 | 이메일 중복(styletest001@example.com 재사용) | 가입 차단 | 동일 메시지로 차단 | PASS | `screenshots/edge-05-signup-duplicate-email.png` |
| EDGE-06 | 영업사원 가입 시 팀장 이메일 미입력 | 가입 차단 | 브라우저 native required 필드 검증으로 제출 자체가 막힘("이 입력란을 작성하세요") | PASS | `screenshots/edge-06-signup-missing-manager-email.png` |
| EDGE-07 | 비로그인 상태로 `/salesperson/logs` 접근 | `/login`으로 리다이렉트 | 정확히 리다이렉트됨 | PASS | `screenshots/edge-07-protected-route-redirect-to-login.png` |
| EDGE-08 | 팀장 계정으로 `/salesperson/logs/new` 접근 | 팀장 자신의 화면으로 리다이렉트 | `/manager/logs`로 리다이렉트 | PASS | `screenshots/edge-08-manager-accessing-salesperson-route-redirected.png` |
| EDGE-09 | 영업사원 계정으로 `/manager/logs` 접근 | 영업사원 자신의 화면으로 리다이렉트 | `/salesperson/logs`로 리다이렉트 | PASS | `screenshots/edge-09-salesperson-accessing-manager-route-redirected.png` |
| EDGE-10 | 존재하지 않는 영업일지 id(999999999) 상세 조회 | 404 안내 또는 목록으로 리다이렉트 | 백엔드는 404 반환하나 프론트가 처리하지 않아 "불러오는 중..."에 무한 정지(버그, 상세는 "발견된 이슈" #1) | **FAIL** | `screenshots/edge-10-nonexistent-log-id-stuck-loading.png` |
| EDGE-11 | 팀장 코멘트 없는 일지의 삭제 버튼(대조군) | 활성 상태 | "삭제" 버튼 활성 상태 확인(코멘트 있는 일지의 비활성 상태와 대비) | PASS | `screenshots/edge-11-reply-disabled-no-comment.png` |
| (시나리오 3/6 내 포함) | 코멘트 없는 일지의 답변 입력창 비활성 / 코멘트 있는 일지의 삭제 버튼 비활성 | 각각 비활성 | 둘 다 정확히 비활성 상태로 렌더링 | PASS | `screenshots/03-sales-log-detail-after-create.png`, `screenshots/05-delete-disabled-with-comment.png` |

---

## 모바일 반응형 (375px)

| ID | 화면 | 기대 결과 | 실제 결과 | 판정 | 스크린샷 |
|---|---|---|---|---|---|
| MOBILE-01 | 영업일지 목록/검색 (`/salesperson/logs`) | 검색 조건 세로 배치, 목록이 카드형으로 전환 | 네비게이션 축약(세로 스택), 기간/거래처/영업형태/키워드 필드 모두 세로 배치, 목록이 카드형으로 정상 전환 | PASS | `screenshots/mobile-01-salesperson-list-card-view.png`, `screenshots/mobile-02-salesperson-list-cards-scrolled.png` |
| MOBILE-02 | 영업일지 작성 폼 (`/salesperson/logs/new`) | 입력 필드 세로 배치 | 거래처/영업형태(라디오 포함)/활동내역/버튼 모두 세로로 쌓임, 가로 스크롤 없음 | PASS | `screenshots/mobile-03-sales-log-form.png` |
| 보너스 | 상세+코멘트 스레드 (`/salesperson/logs/3898`) | CSS 회귀 없이 카드형 유지 | 코멘트 카드, 배지, 버튼 모두 정상 렌더링, 가로 스크롤 없음 | PASS | `screenshots/mobile-04-detail-comment-thread.png` |
| 보너스 | 로그인 화면 | 중앙 정렬 폼 유지 | 정상 | PASS | `screenshots/mobile-05-login-screen.png` |
| 보너스 | 팀장 목록 (`/manager/logs`) | 카드형 전환 | 정상 | PASS | `screenshots/mobile-06-manager-list-cards.png` |

---

## CSS 스타일 회귀 확인

전체 테스트 과정에서 촬영한 40장의 스크린샷 기준으로, 최근 스타일 개편(그린 포인트 컬러 버튼/링크, 라운드 카드형 리스트, 인증 화면 중앙 정렬)이 데스크톱(1280px)과 모바일(375px) 양쪽에서 모두 깨지지 않고 유지되고 있음을 확인했다. 상태 배지도 "작성 완료"(연두색)와 "코멘트 진행중"(연보라색)으로 시각적으로 구분되어 렌더링되었다. 새로 발견된 스타일 회귀는 없다.
