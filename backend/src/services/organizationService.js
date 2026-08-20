const pool = require('../db/pool');

// RULE-ORG-008: 팀장은 자신에게 매핑된(manager_id가 일치하는) 영업사원만 조회할 수 있다.
// RULE-ORG-003 / RULE-ORG-005: manager_id는 팀장이 실제로 매칭되기 전까지 NULL이며,
// 미가입 팀장 자동 연결(RULE-ORG-005, 백필)은 BE-12(P1) 범위라 아직 매칭되지 않은
// 영업사원은 manager_email이 같아도 이 목록에 나타나지 않는다.
async function getManagedSalespeople(managerId) {
  const result = await pool.query(
    `SELECT id, employee_no, email, role, manager_email, manager_id, created_at
     FROM users
     WHERE role = 'salesperson' AND manager_id = $1`,
    [managerId]
  );
  return result.rows;
}

module.exports = { getManagedSalespeople };
