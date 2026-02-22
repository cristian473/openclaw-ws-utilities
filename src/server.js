const fs = require('fs/promises');
const app = require('./app');
const config = require('./config');
const { initDb } = require('./db');
const waService = require('./services/waService');

const bootstrap = async () => {
  await fs.mkdir(config.stickersDir, { recursive: true });
  await fs.mkdir(config.baileysAuthDir, { recursive: true });

  await initDb();

  const server = app.listen(config.port, () => {
    console.log(`Sticker API listening on http://localhost:${config.port}`);
  });

  process.on('SIGINT', async () => {
    await waService.disconnect().catch(() => null);
    server.close(() => process.exit(0));
  });
};

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
