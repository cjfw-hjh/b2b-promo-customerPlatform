const authService = require('../services/authService');

async function signup(req, res, next) {
  try {
    const user = await authService.signup(req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await authService.login({ email, password });
    req.session.userId = user.id;
    req.session.role = user.role;
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
}

function logout(req, res, next) {
  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }
    res.clearCookie('connect.sid');
    res.sendStatus(204);
  });
}

module.exports = { signup, login, logout };
