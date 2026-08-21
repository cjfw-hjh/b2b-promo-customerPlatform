const pool = require('../db/pool');
const notificationService = require('./notificationService');
const summaryService = require('./summaryService');

const ACTIVITY_TYPES = ['외근', '내근', '기타'];

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}
function notFound(message) {
  const err = new Error(message);
  err.status = 404;
  return err;
}
function forbidden(message) {
  const err = new Error(message);
  err.status = 403;
  return err;
}

function validateActivityType(activityType) {
  if (!ACTIVITY_TYPES.includes(activityType)) {
    throw badRequest("activityType은 '외근', '내근', '기타' 중 하나여야 합니다.");
  }
}

function validateActivityContent(activityContent) {
  if (typeof activityContent !== 'string' || activityContent.length === 0) {
    throw badRequest('activityContent는 비어있을 수 없습니다.');
  }
}

// 상태 계산: comments 개수가 0이면 "작성 완료", 1개 이상이면 "코멘트 진행중".
// DB 컬럼으로 저장하지 않고 매 조회 시 계산한다(파생값, 4-project-principle.md 1번 원칙).
function computeStatus(commentCount) {
  return Number(commentCount) > 0 ? '코멘트 진행중' : '작성 완료';
}

function mapRow(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    activityType: row.activity_type,
    activityContent: row.activity_content,
    summary: row.summary,
    createdAt: row.created_at.toISOString(),
    status: computeStatus(row.comment_count),
  };
}

// BE-8(commentService)이 코멘트 권한 검사(author_id/customer_id 확인)에 재사용한다.
// 기존 export 함수들의 시그니처는 그대로 두고 이 조회 전용 함수만 추가로 export한다.
async function findSalesLogRow(id) {
  const result = await pool.query(
    `SELECT sl.id, sl.customer_id, sl.author_id, sl.activity_type, sl.activity_content, sl.summary, sl.created_at,
            COUNT(c.id) AS comment_count
     FROM sales_logs sl
     LEFT JOIN comments c ON c.sales_log_id = sl.id
     WHERE sl.id = $1
     GROUP BY sl.id`,
    [id]
  );
  return result.rows[0];
}

// RULE-LOG-002/003: 작성자 본인만 조회 결과에 접근할 수 있다 — 없으면 404, 있어도 작성자가 아니면 403.
async function requireOwnedRow(id, authorId, verb) {
  const row = await findSalesLogRow(id);
  if (!row) {
    throw notFound('영업일지를 찾을 수 없습니다.');
  }
  if (row.author_id !== authorId) {
    throw forbidden(`본인이 작성한 영업일지만 ${verb} 있습니다.`);
  }
  return row;
}

// RULE-LOG-001: created_at은 DB 기본값(now())으로만 설정한다 — 이 함수는 애초에 createdAt을
// 인자로 받지 않으므로 요청 바디에 무엇을 실어 보내도 덮어쓸 수 없다.
// UC-003 Actor는 영업사원뿐 — requireRole('salesperson')은 라우트에서 적용.
async function createSalesLog({ customerId, activityType, activityContent, authorId }) {
  validateActivityType(activityType);
  validateActivityContent(activityContent);

  const summary = await summaryService.summarizeActivityContent(activityContent);

  let row;
  try {
    const result = await pool.query(
      `INSERT INTO sales_logs (customer_id, author_id, activity_type, activity_content, summary)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, customer_id, activity_type, activity_content, summary, created_at`,
      [customerId, authorId, activityType, activityContent, summary]
    );
    row = result.rows[0];
  } catch (err) {
    // RULE-CUSTOMER-001: 사전 등록된 거래처만 선택 가능 — DB FK 위반(존재하지 않는 customerId)을
    // 단일 진실 공급원으로 재사용해 400으로 변환한다(BE-3의 unique_violation 처리와 같은 패턴).
    if (err.code === '23503') {
      throw badRequest('존재하지 않는 거래처입니다.');
    }
    throw err;
  }

  // RULE-ORG-004: 팀장이 가입 안 했어도(manager_id 매칭 여부 무관) 입력된 manager_email로 무조건 발송을 시도한다.
  // RULE-NOTIFICATION-001: 알림 조회/발송 실패가 저장 성공에 영향을 주면 안 되므로 try/catch로 감싼다(2차 방어선).
  try {
    const { rows } = await pool.query('SELECT manager_email FROM users WHERE id = $1', [authorId]);
    const managerEmail = rows[0] && rows[0].manager_email;
    if (managerEmail) {
      await notificationService.sendNotification({
        to: managerEmail,
        subject: '[정성을 보여줘] 새 영업일지가 등록되었습니다',
        text: `영업일지가 등록되었습니다. (활동유형: ${activityType})\n${activityContent}`,
      });
    }
  } catch (err) {
    console.error('[notification] 알림 발송 실패, 저장은 이미 완료됨:', err.message);
  }

  // 방금 생성한 로그는 코멘트가 있을 수 없으므로 comment_count는 항상 0.
  return mapRow({ ...row, comment_count: 0 });
}

// "내 일지 조회" — 로그인한 사용자 본인이 작성한 영업일지만 반환한다.
// RULE-SEARCH-001: filters가 뭐가 오든 author_id = authorId 조건은 항상 유지된다.
// 도메인 정의서 13.1 검색 조건(기간/거래처/영업 형태/키워드) — 전부 선택적, 있는 것만 AND로 결합.
async function listMySalesLogs(authorId, filters = {}) {
  const { from, to, customerId, activityType, keyword } = filters;
  const conditions = ['sl.author_id = $1'];
  const values = [authorId];

  if (from) {
    values.push(from);
    conditions.push(`sl.created_at::date >= $${values.length}`);
  }
  if (to) {
    values.push(to);
    conditions.push(`sl.created_at::date <= $${values.length}`);
  }
  if (customerId !== undefined && customerId !== null && !Number.isNaN(customerId)) {
    values.push(customerId);
    conditions.push(`sl.customer_id = $${values.length}`);
  }
  if (activityType) {
    values.push(activityType);
    conditions.push(`sl.activity_type = $${values.length}`);
  }
  if (keyword) {
    values.push(`%${keyword}%`);
    conditions.push(`sl.activity_content ILIKE $${values.length}`);
  }

  const result = await pool.query(
    `SELECT sl.id, sl.customer_id, sl.activity_type, sl.activity_content, sl.summary, sl.created_at,
            COUNT(c.id) AS comment_count
     FROM sales_logs sl
     LEFT JOIN comments c ON c.sales_log_id = sl.id
     WHERE ${conditions.join(' AND ')}
     GROUP BY sl.id
     ORDER BY sl.id`,
    values
  );
  return result.rows.map(mapRow);
}

// UC-007 / RULE-ORG-008: 팀장에게 매핑된 영업사원들(authorIds)의 영업일지를 전부 반환한다.
// 여러 영업사원의 일지가 섞여 나오므로, 작성자 식별용으로 employee_no(이름 컬럼이 없음)를 조인해 붙인다.
async function listManagedSalesLogs(authorIds) {
  if (authorIds.length === 0) {
    return [];
  }
  const result = await pool.query(
    `SELECT sl.id, sl.customer_id, sl.activity_type, sl.activity_content, sl.summary, sl.created_at,
            u.employee_no, COUNT(c.id) AS comment_count
     FROM sales_logs sl
     JOIN users u ON u.id = sl.author_id
     LEFT JOIN comments c ON c.sales_log_id = sl.id
     WHERE sl.author_id = ANY($1)
     GROUP BY sl.id, u.employee_no
     ORDER BY sl.id`,
    [authorIds]
  );
  return result.rows.map((row) => ({ ...mapRow(row), authorEmployeeNo: row.employee_no }));
}

// commentService.isManagerOfAuthor와 같은 판별이지만, 각 서비스가 자기 소관의 조회 권한만
// 소규모로 체크하는 이 코드베이스의 기존 패턴(customerService.getCustomerKnowhow 등)을 따른다.
async function isManagerOfAuthor(authorId, requesterId) {
  const result = await pool.query('SELECT 1 FROM users WHERE id = $1 AND manager_id = $2', [
    authorId,
    requesterId,
  ]);
  return result.rows.length > 0;
}

// FE-5(SalesLogDetailPage)는 작성자 본인, FE-7(SalesLogReviewPage)는 담당 팀장이 호출한다.
async function getSalesLogById(id, requesterId, requesterRole) {
  const row = await findSalesLogRow(id);
  if (!row) {
    throw notFound('영업일지를 찾을 수 없습니다.');
  }
  const isAuthor = row.author_id === requesterId;
  const isManager = requesterRole === 'manager' && (await isManagerOfAuthor(row.author_id, requesterId));
  if (!isAuthor && !isManager) {
    throw forbidden('본인이 작성한 영업일지이거나 담당 팀장만 조회할 수 있습니다.');
  }
  // listManagedSalesLogs와 같은 컨벤션 — SalesLogReviewPage(FE-7)가 작성자를 표시하는 데 쓴다.
  const author = await pool.query('SELECT employee_no FROM users WHERE id = $1', [row.author_id]);
  return { ...mapRow(row), authorEmployeeNo: author.rows[0].employee_no };
}

// RULE-LOG-002: 작성자 본인만 수정 가능.
// RULE-LOG-004: created_at은 수정 대상에서 절대 제외한다(UPDATE 쿼리에 포함하지 않음).
// RULE-LOG-005 후단: 코멘트 존재 여부와 무관하게 수정은 항상 허용한다.
async function updateSalesLog(id, authorId, updates) {
  const row = await requireOwnedRow(id, authorId, '수정할 수');

  const fields = [];
  const values = [];
  let idx = 1;

  if (updates.customerId !== undefined) {
    fields.push(`customer_id = $${idx++}`);
    values.push(updates.customerId);
  }
  if (updates.activityType !== undefined) {
    validateActivityType(updates.activityType);
    fields.push(`activity_type = $${idx++}`);
    values.push(updates.activityType);
  }
  if (updates.activityContent !== undefined) {
    validateActivityContent(updates.activityContent);
    fields.push(`activity_content = $${idx++}`);
    values.push(updates.activityContent);
    // 활동 내역이 바뀌면 요약도 최신 내용 기준으로 다시 생성한다(안 그러면 예전 내용 기준 요약이 남는다).
    const summary = await summaryService.summarizeActivityContent(updates.activityContent);
    fields.push(`summary = $${idx++}`);
    values.push(summary);
  }

  if (fields.length === 0) {
    return mapRow(row);
  }

  values.push(id);
  try {
    const result = await pool.query(
      `UPDATE sales_logs SET ${fields.join(', ')} WHERE id = $${idx}
       RETURNING id, customer_id, activity_type, activity_content, summary, created_at`,
      values
    );
    // 코멘트는 이 수정으로 변하지 않으므로 requireOwnedRow에서 조회한 comment_count를 그대로 재사용한다.
    return mapRow({ ...result.rows[0], comment_count: row.comment_count });
  } catch (err) {
    if (err.code === '23503') {
      throw badRequest('존재하지 않는 거래처입니다.');
    }
    throw err;
  }
}

// RULE-LOG-003: 작성자 본인만 삭제 가능.
// RULE-LOG-005: 팀장이 코멘트를 하나라도 등록한 영업일지는 작성자 본인도 삭제할 수 없다.
async function deleteSalesLog(id, authorId) {
  const row = await requireOwnedRow(id, authorId, '삭제할 수');
  if (Number(row.comment_count) > 0) {
    throw forbidden('팀장 코멘트가 등록된 영업일지는 삭제할 수 없습니다.');
  }
  await pool.query('DELETE FROM sales_logs WHERE id = $1', [id]);
}

module.exports = {
  createSalesLog,
  listMySalesLogs,
  listManagedSalesLogs,
  getSalesLogById,
  updateSalesLog,
  deleteSalesLog,
  findSalesLogRow,
};
