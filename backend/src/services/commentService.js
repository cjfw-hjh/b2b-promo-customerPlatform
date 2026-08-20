const pool = require('../db/pool');
const salesLogService = require('../services/salesLogService');
const notificationService = require('./notificationService');

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

function validateContent(content) {
  if (typeof content !== 'string' || content.length === 0) {
    throw badRequest('content는 비어있을 수 없습니다.');
  }
}

// comment_type 컬럼이 없으므로 작성자의 role로 '팀장 코멘트'/'답변'을 매 조회 시 계산한다(파생값).
function mapCommentRow(row) {
  return {
    id: row.id,
    content: row.content,
    createdAt: row.created_at.toISOString(),
    type: row.author_role === 'manager' ? '팀장 코멘트' : '답변',
  };
}

// RULE-FEEDBACK-003: 요청자가 sales_log 작성자(영업사원)의 manager_id와 같은지 확인한다.
async function isManagerOfAuthor(authorId, requesterId) {
  const result = await pool.query('SELECT 1 FROM users WHERE id = $1 AND manager_id = $2', [
    authorId,
    requesterId,
  ]);
  return result.rows.length > 0;
}

async function requireSalesLogRow(salesLogId) {
  const log = await salesLogService.findSalesLogRow(salesLogId);
  if (!log) {
    throw notFound('영업일지를 찾을 수 없습니다.');
  }
  return log;
}

// RULE-FEEDBACK-004 / RULE-REPLY-005 / RULE-NOTIFICATION-001:
// 코멘트 저장 성공 후 상대방에게 알림을 시도한다 — 조회/발송 실패는 여기서 전부 삼켜서
// createComment의 저장 결과 반환에 영향을 주지 않는다(2차 방어선).
async function notifyAfterComment(log, requesterRole) {
  try {
    if (requesterRole === 'manager') {
      // RULE-FEEDBACK-004: 팀장 코멘트 -> 영업일지 작성자(영업사원)에게 알림.
      const { rows } = await pool.query('SELECT email FROM users WHERE id = $1', [log.author_id]);
      const authorEmail = rows[0] && rows[0].email;
      if (authorEmail) {
        await notificationService.sendNotification({
          to: authorEmail,
          subject: '[정성을 보여줘] 팀장 코멘트가 등록되었습니다',
          text: '작성하신 영업일지에 팀장 코멘트가 등록되었습니다.',
        });
      }
    } else if (requesterRole === 'salesperson') {
      // RULE-REPLY-005: 영업사원 답변 -> 담당 팀장(manager_id로 매칭된 실제 계정)에게 알림.
      const { rows } = await pool.query(
        `SELECT u2.email AS manager_email
         FROM users u1 JOIN users u2 ON u2.id = u1.manager_id
         WHERE u1.id = $1`,
        [log.author_id]
      );
      const managerEmail = rows[0] && rows[0].manager_email;
      if (managerEmail) {
        await notificationService.sendNotification({
          to: managerEmail,
          subject: '[정성을 보여줘] 영업사원 답변이 등록되었습니다',
          text: '담당 영업사원이 영업일지에 답변을 등록했습니다.',
        });
      }
    }
  } catch (err) {
    console.error('[notification] 알림 발송 실패, 저장은 이미 완료됨:', err.message);
  }
}

// GET 조회 권한: 작성자 본인(영업사원) 또는 그 영업사원의 담당 팀장만 가능.
async function listComments(salesLogId, requesterId, requesterRole) {
  const log = await requireSalesLogRow(salesLogId);

  const isAuthor = log.author_id === requesterId;
  const isManager = requesterRole === 'manager' && (await isManagerOfAuthor(log.author_id, requesterId));
  if (!isAuthor && !isManager) {
    throw forbidden('본인이 작성한 영업일지이거나 담당 팀장만 조회할 수 있습니다.');
  }

  const result = await pool.query(
    `SELECT c.id, c.content, c.created_at, u.role AS author_role
     FROM comments c
     JOIN users u ON u.id = c.author_id
     WHERE c.sales_log_id = $1
     ORDER BY c.created_at ASC, c.id ASC`,
    [salesLogId]
  );
  return result.rows.map(mapCommentRow);
}

// POST 권한(순서대로 판단):
// 1. 영업일지 없음 -> 404
// 2. requester가 manager -> RULE-FEEDBACK-003(담당 팀장인지) 확인, 통과하면 횟수 제한 없이 항상 성공.
// 3. requester가 salesperson -> RULE-REPLY-002(작성자 본인) + RULE-REPLY-001(기존 코멘트 1건 이상) 확인.
async function createComment(salesLogId, requesterId, requesterRole, content) {
  validateContent(content);
  const log = await requireSalesLogRow(salesLogId);

  if (requesterRole === 'manager') {
    if (!(await isManagerOfAuthor(log.author_id, requesterId))) {
      throw forbidden('담당 영업사원의 팀장만 코멘트를 작성할 수 있습니다.');
    }
  } else if (requesterRole === 'salesperson') {
    if (log.author_id !== requesterId) {
      throw forbidden('본인이 작성한 영업일지에만 답변할 수 있습니다.');
    }
    if (Number(log.comment_count) === 0) {
      // RULE-FEEDBACK-002/RULE-REPLY-001: 최초 코멘트는 팀장부터 시작되어야 한다.
      throw forbidden('아직 팀장 코멘트가 없어 답변할 수 없습니다.');
    }
  } else {
    throw forbidden('권한이 없습니다.');
  }

  const result = await pool.query(
    `INSERT INTO comments (sales_log_id, author_id, content)
     VALUES ($1, $2, $3)
     RETURNING id, content, created_at`,
    [salesLogId, requesterId, content]
  );
  const comment = mapCommentRow({ ...result.rows[0], author_role: requesterRole });

  await notifyAfterComment(log, requesterRole);

  return comment;
}

// "내가 남긴 코멘트 이력" — 요청자(팀장) 본인이 작성한 코멘트만, 최신순으로 반환한다.
// authorEmployeeNo는 코멘트 작성자가 아니라 그 영업일지를 쓴 영업사원의 사번이다(BE-7과 동일 컨벤션).
async function listManagedComments(managerId) {
  const result = await pool.query(
    `SELECT c.id, c.content, c.created_at, c.sales_log_id,
            cu.name AS customer_name, u.employee_no AS author_employee_no
     FROM comments c
     JOIN sales_logs sl ON sl.id = c.sales_log_id
     JOIN customers cu ON cu.id = sl.customer_id
     JOIN users u ON u.id = sl.author_id
     WHERE c.author_id = $1
     ORDER BY c.created_at DESC, c.id DESC`,
    [managerId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    content: row.content,
    createdAt: row.created_at.toISOString(),
    salesLogId: row.sales_log_id,
    customerName: row.customer_name,
    authorEmployeeNo: row.author_employee_no,
  }));
}

module.exports = { listComments, createComment, listManagedComments };
