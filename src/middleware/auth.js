const config = require('../config');
const { AppError } = require('../errors');

const authMiddleware = (req, _res, next) => {
  if (req.path === '/health') {
    return next();
  }

  const token = req.header('x-api-key');
  if (!token || token !== config.apiKey) {
    return next(new AppError('UNAUTHORIZED', 'Invalid or missing API key', 401));
  }

  return next();
};

module.exports = {
  authMiddleware,
};
