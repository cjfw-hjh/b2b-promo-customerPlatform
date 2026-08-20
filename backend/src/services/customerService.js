const pool = require('../db/pool');

// RULE-CUSTOMER-003: 거래처 마스터는 관리자 화면 없이 DB에 직접 등록·관리한다.
// 그래서 이 서비스는 조회만 제공하고 등록/수정 함수는 두지 않는다.
async function listCustomers() {
  const result = await pool.query('SELECT id, name FROM customers ORDER BY id');
  return result.rows;
}

function notFound(message) {
  const err = new Error(message);
  err.status = 404;
  return err;
}

// RULE-KNOWHOW-001~006: 거래처 단위로 축적된 영업활동을, 조회자와 같은 팀장 산하 그룹에 한해 공유한다.
// - comments는 아예 join하지 않는다(RULE-KNOWHOW-003: 팀장 코멘트/영업사원 답변은 공유 대상 제외).
// - sales_logs를 그대로 조회하므로 삭제된 일지는 이미 물리적으로 없어 자동 제외된다(RULE-KNOWHOW-005).
async function getCustomerKnowhow(customerId, requesterId, requesterRole) {
  const customer = await pool.query('SELECT id FROM customers WHERE id = $1', [customerId]);
  if (customer.rows.length === 0) {
    throw notFound('거래처를 찾을 수 없습니다.');
  }

  // RULE-KNOWHOW-006: 팀장이면 자기 자신이 곧 그룹 팀장, 영업사원이면 본인의 manager_id가 그룹 팀장.
  // (RULE-ORG-005 백필 전이라 manager_id가 NULL인 영업사원은 그룹이 비어 빈 배열이 되는데, 알려진 제약이라 그대로 둔다.)
  let groupManagerId = requesterId;
  if (requesterRole !== 'manager') {
    const requester = await pool.query('SELECT manager_id FROM users WHERE id = $1', [requesterId]);
    groupManagerId = requester.rows[0] && requester.rows[0].manager_id;
  }

  const result = await pool.query(
    `SELECT u.employee_no, sl.created_at, sl.activity_content
     FROM sales_logs sl
     JOIN users u ON u.id = sl.author_id
     WHERE sl.customer_id = $1 AND u.manager_id = $2
     ORDER BY sl.created_at ASC`,
    [customerId, groupManagerId]
  );
  return result.rows.map((row) => ({
    authorEmployeeNo: row.employee_no,
    createdAt: row.created_at.toISOString(),
    activityContent: row.activity_content,
  }));
}

module.exports = { listCustomers, getCustomerKnowhow };
