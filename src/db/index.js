const { Pool } = require('pg');
const config = require('../config');
const { runMigrations } = require('./migrations');

const pool = new Pool({
  connectionString: config.databaseUrl,
});

const initDb = async () => {
  await pool.query('SELECT 1');
  await runMigrations(pool);
};

module.exports = {
  pool,
  initDb,
};
