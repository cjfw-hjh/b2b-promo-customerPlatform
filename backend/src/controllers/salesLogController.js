const salesLogService = require('../services/salesLogService');
const organizationService = require('../services/organizationService');

async function create(req, res, next) {
  try {
    const { customerId, activityType, activityContent } = req.body;
    const log = await salesLogService.createSalesLog({
      customerId,
      activityType,
      activityContent,
      authorId: req.session.userId,
    });
    res.status(201).json(log);
  } catch (err) {
    next(err);
  }
}

// 도메인 정의서 13.1 / 6-wireframe.md SalesLogListPage: 기간/거래처/영업 형태/키워드 검색.
// 전부 선택적 — 하나도 없으면 기존과 동일하게 전체 목록(본인 것만) 반환.
async function list(req, res, next) {
  try {
    const { from, to, customerId, activityType, keyword } = req.query;
    const logs = await salesLogService.listMySalesLogs(req.session.userId, {
      from,
      to,
      customerId: customerId !== undefined && customerId !== '' ? Number(customerId) : undefined,
      activityType,
      keyword,
    });
    res.status(200).json(logs);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const log = await salesLogService.getSalesLogById(Number(req.params.id), req.session.userId);
    res.status(200).json(log);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { customerId, activityType, activityContent } = req.body;
    const log = await salesLogService.updateSalesLog(Number(req.params.id), req.session.userId, {
      customerId,
      activityType,
      activityContent,
    });
    res.status(200).json(log);
  } catch (err) {
    next(err);
  }
}

// UC-007 / RULE-ORG-008: 팀장이 자신에게 매핑된 영업사원들의 영업일지를 전부 조회한다.
async function listManaged(req, res, next) {
  try {
    const salespeople = await organizationService.getManagedSalespeople(req.session.userId);
    const logs = await salesLogService.listManagedSalesLogs(salespeople.map((s) => s.id));
    res.status(200).json(logs);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await salesLogService.deleteSalesLog(Number(req.params.id), req.session.userId);
    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, listManaged, getById, update, remove };
