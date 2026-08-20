const bcrypt = require('bcrypt');
const pool = require('../db/pool');

const EMPLOYEE_NO_LENGTH = 6;
const PASSWORD_MIN_LENGTH = 7;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALT_ROUNDS = 10;

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

// RULE-AUTH-001: 사번은 반드시 6자리여야 한다.
// RULE-AUTH-002: 이메일은 정상적인 이메일 형식이어야 한다.
// RULE-AUTH-003: 비밀번호는 최소 7자리 이상.
// RULE-AUTH-006 / RULE-USER-001·002: 역할은 'salesperson' 또는 'manager' 중 필수 선택.
// RULE-ORG-001: 영업사원 회원가입 시 팀장 이메일(managerEmail) 필수.
// RULE-ORG-002: 팀장 이메일도 정상 이메일 형식이어야 함.
function validateSignupInput({ employeeNo, email, password, role, managerEmail }) {
  if (typeof employeeNo !== 'string' || employeeNo.length !== EMPLOYEE_NO_LENGTH) {
    throw badRequest('사번은 6자리여야 합니다.');
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    throw badRequest('이메일 형식이 올바르지 않습니다.');
  }
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    throw badRequest('비밀번호는 최소 7자리 이상이어야 합니다.');
  }
  if (role !== 'salesperson' && role !== 'manager') {
    throw badRequest("역할은 'salesperson' 또는 'manager' 중 하나여야 합니다.");
  }
  if (role === 'salesperson') {
    if (typeof managerEmail !== 'string' || !EMAIL_RE.test(managerEmail)) {
      throw badRequest('영업사원은 팀장 이메일(managerEmail)이 필요합니다.');
    }
  }
}

async function signup(input) {
  validateSignupInput(input);
  const { employeeNo, email, password, role } = input;
  // RULE-ORG-006: 팀장으로 가입 시 managerEmail은 보내더라도 무시하고 NULL로 저장한다.
  // RULE-ORG-003: manager_id는 가입 시점엔 항상 NULL(실제 매칭은 BE-4 범위).
  const managerEmail = role === 'salesperson' ? input.managerEmail : null;
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    const result = await pool.query(
      `INSERT INTO users (employee_no, email, password_hash, role, manager_email)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, employee_no, email, role`,
      [employeeNo, email, passwordHash, role, managerEmail]
    );
    const row = result.rows[0];
    return { id: row.id, employeeNo: row.employee_no, email: row.email, role: row.role };
  } catch (err) {
    // RULE-AUTH-004 / RULE-AUTH-005: 사번/이메일 중복 등록 불가.
    // DB의 UNIQUE 제약(unique_violation)을 단일 진실 공급원으로 재사용해 TOCTOU를 회피한다.
    if (err.code === '23505') {
      throw badRequest('이미 등록된 사번 또는 이메일입니다.');
    }
    throw err;
  }
}

async function login({ email, password }) {
  const result = await pool.query(
    'SELECT id, role, password_hash FROM users WHERE email = $1',
    [email]
  );
  const user = result.rows[0];

  // 이메일 없음/비밀번호 불일치를 구분하지 않고 동일한 메시지로 401 응답(보안 관행).
  const genericError = () => {
    const err = new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
    err.status = 401;
    return err;
  };

  if (!user) {
    throw genericError();
  }
  const matched = await bcrypt.compare(password, user.password_hash);
  if (!matched) {
    throw genericError();
  }
  return { id: user.id, role: user.role };
}

module.exports = { signup, login };
