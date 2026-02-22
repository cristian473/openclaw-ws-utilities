const express = require('express');
require('express-async-errors');
const healthRoutes = require('./routes/health');
const waRoutes = require('./routes/wa');
const stickerRoutes = require('./routes/stickers');
const { authMiddleware } = require('./middleware/auth');
const { apiRateLimit } = require('./middleware/rateLimit');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(authMiddleware);
app.use(apiRateLimit);

app.use(healthRoutes);
app.use(waRoutes);
app.use(stickerRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
