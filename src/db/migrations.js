const runMigrations = async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wa_session (
      id SMALLINT PRIMARY KEY,
      state TEXT NOT NULL,
      phone TEXT,
      qr_text TEXT,
      qr_expires_at TIMESTAMPTZ,
      last_connection_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stickers (
      id TEXT PRIMARY KEY,
      alias TEXT,
      description TEXT,
      tags TEXT[] NOT NULL DEFAULT '{}',
      file_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_chat_id TEXT,
      source_message_id TEXT,
      is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS stickers_alias_unique_active
      ON stickers ((LOWER(alias)))
      WHERE alias IS NOT NULL AND deleted_at IS NULL;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS stickers_search_idx
      ON stickers USING GIN (to_tsvector('simple', COALESCE(alias, '') || ' ' || COALESCE(description, '') || ' ' || array_to_string(tags, ' ')));
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS stickers_sha256_active_unique
      ON stickers (sha256)
      WHERE deleted_at IS NULL;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sticker_send_log (
      id TEXT PRIMARY KEY,
      sticker_id TEXT NOT NULL REFERENCES stickers(id),
      to_jid TEXT NOT NULL,
      wa_message_id TEXT,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL,
      error TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS wa_message_index (
      chat_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      message_type TEXT NOT NULL,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      has_sticker BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (chat_id, message_id)
    );
  `);

  await pool.query(`
    INSERT INTO wa_session (id, state)
    VALUES (1, 'disconnected')
    ON CONFLICT (id) DO NOTHING;
  `);
};

module.exports = {
  runMigrations,
};
