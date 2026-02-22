const rateLimit = require('express-rate-limit');
const config = require('../config');

const apiRateLimit = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const apiKey = req.header('x-api-key') || 'anonymous';
    return `${req.ip}:${apiKey}`;
  },
  message: {
    code: 'RATE_LIMITED',
    message: 'Too many requests',
    details: null,
  },
});

module.exports = {
  apiRateLimit,
};
