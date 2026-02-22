const { randomUUID } = require('crypto');
const { pool } = require('./index');

const mapRow = (row) => ({
  id: row.id,
  alias: row.alias,
  description: row.description,
  tags: row.tags || [],
  filePath: row.file_path,
  mimeType: row.mime_type,
  sha256: row.sha256,
  sourceType: row.source_type,
  sourceChatId: row.source_chat_id,
  sourceMessageId: row.source_message_id,
  isFavorite: row.is_favorite,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});

const createSticker = async (input) => {
  const id = randomUUID();
  const { rows } = await pool.query(
    `
      INSERT INTO stickers (
        id, alias, description, tags, file_path, mime_type, sha256,
        source_type, source_chat_id, source_message_id, is_favorite
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `,
    [
      id,
      input.alias || null,
      input.description || null,
      input.tags || [],
      input.filePath,
      input.mimeType,
      input.sha256,
      input.sourceType,
      input.sourceChatId || null,
      input.sourceMessageId || null,
      Boolean(input.isFavorite),
    ]
  );

  return mapRow(rows[0]);
};

const getStickerById = async (id) => {
  const { rows } = await pool.query(
    `SELECT * FROM stickers WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] ? mapRow(rows[0]) : null;
};

const getStickerByAlias = async (alias) => {
  const { rows } = await pool.query(
    `SELECT * FROM stickers WHERE LOWER(alias) = LOWER($1) AND deleted_at IS NULL`,
    [alias]
  );
  return rows[0] ? mapRow(rows[0]) : null;
};

const getStickerByHash = async (sha256) => {
  const { rows } = await pool.query(
    `SELECT * FROM stickers WHERE sha256 = $1 AND deleted_at IS NULL`,
    [sha256]
  );
  return rows[0] ? mapRow(rows[0]) : null;
};

const searchStickers = async ({ q, alias, tag, sha256, page = 1, limit = 20, sort = 'created_at_desc' }) => {
  const values = [];
  const where = ['deleted_at IS NULL'];

  if (q) {
    values.push(`%${q}%`);
    const p = `$${values.length}`;
    where.push(`(alias ILIKE ${p} OR description ILIKE ${p} OR array_to_string(tags, ',') ILIKE ${p})`);
  }

  if (alias) {
    values.push(alias);
    where.push(`LOWER(alias) = LOWER($${values.length})`);
  }

  if (tag) {
    values.push(tag);
    where.push(`$${values.length} = ANY(tags)`);
  }

  if (sha256) {
    values.push(sha256);
    where.push(`LOWER(sha256) = LOWER($${values.length})`);
  }

  const orderBy = sort === 'created_at_asc' ? 'created_at ASC' : 'created_at DESC';
  const offset = (page - 1) * limit;

  values.push(limit);
  const limitParam = `$${values.length}`;
  values.push(offset);
  const offsetParam = `$${values.length}`;

  const whereClause = where.join(' AND ');

  const listQuery = `
    SELECT *
    FROM stickers
    WHERE ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ${limitParam} OFFSET ${offsetParam}
  `;

  const countQuery = `SELECT COUNT(*)::int AS total FROM stickers WHERE ${whereClause}`;
  const countValues = values.slice(0, values.length - 2);

  const [rowsResult, countResult] = await Promise.all([
    pool.query(listQuery, values),
    pool.query(countQuery, countValues),
  ]);

  return {
    items: rowsResult.rows.map(mapRow),
    total: countResult.rows[0].total,
    page,
    limit,
  };
};

const updateSticker = async (id, data) => {
  const updates = [];
  const values = [];

  if (Object.hasOwn(data, 'alias')) {
    values.push(data.alias || null);
    updates.push(`alias = $${values.length}`);
  }
  if (Object.hasOwn(data, 'description')) {
    values.push(data.description || null);
    updates.push(`description = $${values.length}`);
  }
  if (Object.hasOwn(data, 'tags')) {
    values.push(data.tags || []);
    updates.push(`tags = $${values.length}`);
  }
  if (Object.hasOwn(data, 'isFavorite')) {
    values.push(Boolean(data.isFavorite));
    updates.push(`is_favorite = $${values.length}`);
  }

  if (updates.length === 0) {
    return getStickerById(id);
  }

  updates.push('updated_at = NOW()');
  values.push(id);

  const { rows } = await pool.query(
    `
      UPDATE stickers
      SET ${updates.join(', ')}
      WHERE id = $${values.length} AND deleted_at IS NULL
      RETURNING *
    `,
    values
  );

  return rows[0] ? mapRow(rows[0]) : null;
};

const softDeleteSticker = async (id) => {
  const { rowCount } = await pool.query(
    `UPDATE stickers SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return rowCount > 0;
};

const insertSendLog = async ({ stickerId, toJid, waMessageId, status, error }) => {
  const id = randomUUID();
  await pool.query(
    `
      INSERT INTO sticker_send_log (id, sticker_id, to_jid, wa_message_id, status, error)
      VALUES ($1,$2,$3,$4,$5,$6)
    `,
    [id, stickerId, toJid, waMessageId || null, status, error || null]
  );
  return id;
};

module.exports = {
  createSticker,
  getStickerById,
  getStickerByAlias,
  getStickerByHash,
  searchStickers,
  updateSticker,
  softDeleteSticker,
  insertSendLog,
};
