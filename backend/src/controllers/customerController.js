const customerService = require('../services/customerService');

async function list(req, res, next) {
  try {
    const customers = await customerService.listCustomers();
    res.status(200).json(customers);
  } catch (err) {
    next(err);
  }
}

// RULE-KNOWHOW-001~006: 같은 거래처에 다른 영업사원이 남긴 활동 이력(같은 팀장 산하 그룹만) 조회.
async function knowhow(req, res, next) {
  try {
    const logs = await customerService.getCustomerKnowhow(
      Number(req.params.id),
      req.session.userId,
      req.session.role
    );
    res.status(200).json(logs);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, knowhow };
