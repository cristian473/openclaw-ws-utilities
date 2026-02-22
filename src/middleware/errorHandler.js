const { toErrorResponse } = require('../errors');

const notFoundHandler = (_req, _res, next) => {
  const err = new Error('Not Found');
  err.code = 'NOT_FOUND';
  err.status = 404;
  next(err);
};

const errorHandler = (err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      code: 'FILE_TOO_LARGE',
      message: 'Uploaded file exceeds the max size limit',
      details: null,
    });
  }

  if (err.code === 'NOT_FOUND') {
    return res.status(404).json({
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
      details: null,
    });
  }

  const { status, body } = toErrorResponse(err);
  return res.status(status).json(body);
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
