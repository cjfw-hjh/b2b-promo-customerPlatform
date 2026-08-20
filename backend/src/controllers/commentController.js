const commentService = require('../services/commentService');

async function list(req, res, next) {
  try {
    const comments = await commentService.listComments(
      Number(req.params.id),
      req.session.userId,
      req.session.role
    );
    res.status(200).json(comments);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const comment = await commentService.createComment(
      Number(req.params.id),
      req.session.userId,
      req.session.role,
      req.body.content
    );
    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
}

// UC-007 계열 / "내가 남긴 코멘트 이력" — 팀장 본인 전용, requireRole('manager')는 app.js에서 건다.
async function listManagedComments(req, res, next) {
  try {
    const comments = await commentService.listManagedComments(req.session.userId);
    res.status(200).json(comments);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, listManagedComments };
