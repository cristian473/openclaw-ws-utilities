const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const config = {
  port: toInt(process.env.PORT, 3000),
  apiKey: process.env.API_KEY || '',
  databaseUrl: process.env.DATABASE_URL || '',
  baileysAuthDir: path.resolve(process.cwd(), process.env.BAILEYS_AUTH_DIR || 'storage/baileys-auth'),
  stickersDir: path.resolve(process.cwd(), process.env.STICKERS_DIR || 'storage/stickers'),
  rateLimitWindowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
  rateLimitMax: toInt(process.env.RATE_LIMIT_MAX, 60),
  maxUploadMb: toInt(process.env.MAX_UPLOAD_MB, 2),
};

if (!config.apiKey) {
  throw new Error('Missing API_KEY in environment');
}

if (!config.databaseUrl) {
  throw new Error('Missing DATABASE_URL in environment');
}

module.exports = config;
