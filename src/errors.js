class AppError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const mapPgError = (err) => {
  if (!err || !err.code) return null;

  if (err.code === '23505') {
    if (err.constraint === 'stickers_alias_unique_active') {
      return new AppError('ALIAS_TAKEN', 'Alias is already in use', 409, {
        constraint: err.constraint,
      });
    }

    if (err.constraint === 'stickers_sha256_active_unique') {
      return new AppError('STICKER_ALREADY_EXISTS', 'A sticker with the same sha256 already exists', 409, {
        constraint: err.constraint,
      });
    }

    return new AppError('CONFLICT', 'Resource already exists', 409, {
      constraint: err.constraint || null,
    });
  }

  if (err.code === '22P02') {
    return new AppError('INVALID_INPUT', 'Invalid input format', 400, {
      detail: err.detail || null,
    });
  }

  if (err.code === '23503') {
    return new AppError('FOREIGN_KEY_ERROR', 'Related resource does not exist', 409, {
      constraint: err.constraint || null,
    });
  }

  return null;
};

const toErrorResponse = (err) => {
  if (err instanceof AppError) {
    return {
      status: err.status,
      body: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    };
  }

  const mappedPgError = mapPgError(err);
  if (mappedPgError) {
    return {
      status: mappedPgError.status,
      body: {
        code: mappedPgError.code,
        message: mappedPgError.message,
        details: mappedPgError.details,
      },
    };
  }

  return {
    status: 500,
    body: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: process.env.NODE_ENV === 'production' ? null : err.message,
    },
  };
};

module.exports = {
  AppError,
  toErrorResponse,
};
