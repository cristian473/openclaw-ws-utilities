const { AppError } = require('../errors');

const normalizeSelector = (input) => {
  const stickerId = input?.stickerId ? String(input.stickerId).trim() : '';
  const alias = input?.alias ? String(input.alias).trim() : '';
  const query = input?.query ? String(input.query).trim() : '';

  const keys = [
    stickerId ? 'stickerId' : null,
    alias ? 'alias' : null,
    query ? 'query' : null,
  ].filter(Boolean);

  if (keys.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Provide one selector: stickerId, alias, or query', 400);
  }

  if (keys.length > 1) {
    throw new AppError('VALIDATION_ERROR', 'Use only one selector: stickerId, alias, or query', 400);
  }

  return {
    type: keys[0],
    value: stickerId || alias || query,
  };
};

module.exports = {
  normalizeSelector,
};
