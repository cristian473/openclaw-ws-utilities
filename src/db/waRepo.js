const { pool } = require('./index');

const setWaState = async ({ state, phone = null, qrText = null, qrExpiresAt = null, lastConnectionAt = null }) => {
  await pool.query(
    `
      UPDATE wa_session
      SET
        state = $1,
        phone = COALESCE($2, phone),
        qr_text = $3,
        qr_expires_at = $4,
        last_connection_at = COALESCE($5, last_connection_at),
        updated_at = NOW()
      WHERE id = 1
    `,
    [state, phone, qrText, qrExpiresAt, lastConnectionAt]
  );
};

const getWaSession = async () => {
  const { rows } = await pool.query(`SELECT * FROM wa_session WHERE id = 1`);
  const row = rows[0];
  return {
    state: row.state,
    phone: row.phone,
    qrText: row.qr_text,
    qrExpiresAt: row.qr_expires_at,
    lastConnectionAt: row.last_connection_at,
    updatedAt: row.updated_at,
  };
};

const upsertMessageIndex = async ({ chatId, messageId, messageType, hasSticker }) => {
  await pool.query(
    `
      INSERT INTO wa_message_index (chat_id, message_id, message_type, has_sticker)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (chat_id, message_id)
      DO UPDATE SET
        message_type = EXCLUDED.message_type,
        has_sticker = EXCLUDED.has_sticker,
        received_at = NOW()
    `,
    [chatId, messageId, messageType, Boolean(hasSticker)]
  );
};

module.exports = {
  setWaState,
  getWaSession,
  upsertMessageIndex,
};
