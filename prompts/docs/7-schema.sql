-- ============================================================
-- 정성을 보여줘 — PostgreSQL 스키마 (MVP)
-- 근거: prompts/7-erd.md (컬럼/제약/카디널리티 그대로 반영)
-- 실행: psql -d <dbname> -f 7-schema.sql
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- users: 영업사원 / 팀장 (RULE-USER-001~002)
-- ------------------------------------------------------------
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,

    -- RULE-AUTH-001(6자리), RULE-AUTH-004(중복 불가)
    employee_no     VARCHAR(6) NOT NULL UNIQUE
                        CONSTRAINT chk_users_employee_no_length CHECK (char_length(employee_no) = 6),

    -- RULE-AUTH-002(이메일 형식), RULE-AUTH-005(중복 불가)
    -- 형식 검증(정규식 등)은 DB가 아닌 Service 레이어 책임(4-project-principle.md 2번 레이어 원칙)
    email           VARCHAR(255) NOT NULL UNIQUE,

    -- RULE-AUTH-003(7자리 이상) — bcrypt 해시만 저장, 평문 금지(원칙문서 5번 보안)
    password_hash   VARCHAR(255) NOT NULL,

    -- RULE-AUTH-006, RULE-USER-001~002
    role            VARCHAR(20) NOT NULL
                        CONSTRAINT chk_users_role CHECK (role IN ('salesperson', 'manager')),

    -- RULE-ORG-001(영업사원 필수), RULE-ORG-002(이메일 형식), RULE-ORG-006(팀장은 미입력)
    -- "영업사원이면 필수" 같은 역할 조건부 제약은 Service 레이어에서 검증(DB는 구조적 제약만 담당)
    manager_email   VARCHAR(255),

    -- RULE-ORG-003(매칭 전 NULL), RULE-ORG-005(팀장 가입 시 백필), RULE-ORG-007(영업사원 1인 : 팀장 1인)
    manager_id      INTEGER
                        CONSTRAINT fk_users_manager_id REFERENCES users(id),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RULE-ORG-005 매칭 시 manager_email로 조회, RULE-ORG-008 팀장이 매핑된 영업사원 조회
CREATE INDEX idx_users_manager_email ON users(manager_email);
CREATE INDEX idx_users_manager_id ON users(manager_id);

-- ------------------------------------------------------------
-- customers: 거래처 마스터 (RULE-CUSTOMER-001~003)
-- 관리자 화면 없이 DB에 직접 등록하므로 컬럼도 최소 구성
-- ------------------------------------------------------------
CREATE TABLE customers (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL
);

-- ------------------------------------------------------------
-- sales_logs: 영업일지 (RULE-LOG-001~005)
-- 상태(작성완료/코멘트진행중)는 저장하지 않고 comments 존재 여부로 계산(파생값, 원칙문서 1번)
-- updated_at도 두지 않음(도메인 정의서 7.4 "추후 결정" 유보 항목)
-- ------------------------------------------------------------
CREATE TABLE sales_logs (
    id                  SERIAL PRIMARY KEY,

    -- RULE-CUSTOMER-001(사전 등록된 거래처만 선택)
    customer_id         INTEGER NOT NULL
                            CONSTRAINT fk_sales_logs_customer_id REFERENCES customers(id),

    -- RULE-LOG-002~003(작성자 본인만 수정/삭제)
    author_id           INTEGER NOT NULL
                            CONSTRAINT fk_sales_logs_author_id REFERENCES users(id),

    -- 도메인 정의서 7.3
    activity_type       VARCHAR(10) NOT NULL
                            CONSTRAINT chk_sales_logs_activity_type CHECK (activity_type IN ('외근', '내근', '기타')),

    -- 도메인 정의서 7.2, PRINCIPLE-ACTIVITY-001
    activity_content    TEXT NOT NULL,

    -- activity_content 앞부분을 발췌한 요약(80자 초과일 때만). 짧으면 NULL.
    summary             TEXT,

    -- RULE-LOG-001(임의 변경 불가), RULE-LOG-004(수정해도 불변) — 애플리케이션에서 UPDATE 시 이 컬럼을 건드리지 않는다
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RULE-SEARCH-001(본인 작성 일지 조회), RULE-KNOWHOW-006(조직 범위 조회) 등 목록/검색에 사용
CREATE INDEX idx_sales_logs_customer_id ON sales_logs(customer_id);
CREATE INDEX idx_sales_logs_author_id ON sales_logs(author_id);

-- ------------------------------------------------------------
-- comments: 팀장 피드백 + 영업사원 답변 (단일 테이블, RULE-FEEDBACK-001~004, RULE-REPLY-001~005)
-- 팀장/영업사원 구분은 author_id → users.role 조인으로 판별(comment_type 컬럼 없음)
-- ------------------------------------------------------------
CREATE TABLE comments (
    id              SERIAL PRIMARY KEY,

    -- RULE-FEEDBACK-001(횟수 제한 없음), RULE-REPLY-003(스레드 연결)
    -- ON DELETE 기본값(RESTRICT)이 RULE-LOG-005(코멘트 있으면 삭제 불가)를 DB 레벨에서도 이중으로 보장한다
    sales_log_id    INTEGER NOT NULL
                        CONSTRAINT fk_comments_sales_log_id REFERENCES sales_logs(id),

    -- RULE-FEEDBACK-003(팀장만 코멘트 작성), RULE-REPLY-002(작성자 본인만 답변)
    author_id       INTEGER NOT NULL
                        CONSTRAINT fk_comments_author_id REFERENCES users(id),

    content         TEXT NOT NULL,

    -- RULE-FEEDBACK-002 / RULE-REPLY-001(최초 코멘트는 팀장부터) 순서 판별에 사용
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 상세 화면 진입 시 스레드 전체 조회(매번 발생)
CREATE INDEX idx_comments_sales_log_id ON comments(sales_log_id);
CREATE INDEX idx_comments_author_id ON comments(author_id);

COMMIT;

-- ============================================================
-- 참고: connect-pg-simple 세션 테이블은 이 파일에 포함하지 않는다.
-- 해당 패키지가 제공하는 테이블 생성 SQL(session 테이블, sid/sess/expire 컬럼)을
-- 별도로 실행해 생성한다 — 도메인 엔티티가 아니므로 7-erd.md에서도 제외했다.
--
-- 스코프 밖으로 의도적으로 뺀 것 (오버엔지니어링 방지):
-- - activity_content 키워드 검색용 전문 검색 인덱스(GIN/tsvector) — RULE-SEARCH-001은
--   단순 "키워드" 필터라 ILIKE로 충분하며, 5일/1인 규모에 전문 검색 인프라는 과하다.
-- - email 정규식 CHECK, role별 manager_email 필수 여부 CHECK — 비즈니스 규칙은
--   DB가 아닌 Service 레이어 책임(4-project-principle.md 2번 레이어 원칙).
-- ============================================================
