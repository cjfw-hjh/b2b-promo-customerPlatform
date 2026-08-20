const pool = require('../db/pool');

// RULE-ORG-008: 팀장은 자신에게 매핑된(manager_id가 일치하는) 영업사원만 조회할 수 있다.
// RULE-ORG-003: manager_id는 실제로 매칭되기(가입 시점 자동 매칭은 없음, RULE-ORG-005로만 매칭) 전까지 NULL이며,
// manager_email이 같아도 아직 매칭되지 않은 영업사원은 이 목록에 나타나지 않는다.
async function getManagedSalespeople(managerId) {
  const result = await pool.query(
    `SELECT id, employee_no, email, role, manager_email, manager_id, created_at
     FROM users
     WHERE role = 'salesperson' AND manager_id = $1`,
    [managerId]
  );
  return result.rows;
}

// RULE-ORG-005: 팀장이 가입하면, 이미 그 이메일을 팀장 이메일로 입력해둔 기존 영업사원들의
// manager_id를 한 번에 백필한다. 여러 행을 함께 갱신하므로 pool.connect()로 얻은 단일
// client에 BEGIN/COMMIT을 걸어 트랜잭션으로 처리한다(4-project-principle.md 5번 트랜잭션 예외 규정).
async function linkExistingSalespeople(managerEmail, managerId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE users SET manager_id = $1 WHERE role = 'salesperson' AND manager_email = $2`,
      [managerId, managerEmail]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getManagedSalespeople, linkExistingSalespeople };
