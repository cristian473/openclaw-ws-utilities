const fs = require('fs/promises');
const config = require('../config');
const { AppError } = require('../errors');
const { parseTags } = require('../utils/tags');
const { normalizeSelector } = require('../utils/selector');
const {
  createSticker,
  getStickerById,
  getStickerByAlias,
  getStickerByHash,
  searchStickers,
  updateSticker,
  softDeleteSticker,
  insertSendLog,
} = require('../db/stickerRepo');
const { saveStickerBuffer } = require('./storageService');
const waService = require('./waService');

const ensureUniqueAlias = async (alias, ignoreId = null) => {
  if (!alias) return;
  const existing = await getStickerByAlias(alias);
  if (existing && existing.id !== ignoreId) {
    throw new AppError('ALIAS_TAKEN', 'Alias is already in use', 409, { alias });
  }
};

const importFromUpload = async ({ buffer, mimeType, alias, description, tags }) => {
  if (!buffer?.length) {
    throw new AppError('VALIDATION_ERROR', 'Sticker file is required', 400);
  }

  if (mimeType !== 'image/webp') {
    throw new AppError('VALIDATION_ERROR', 'Only .webp stickers are supported', 400, { mimeType });
  }

  const normalizedAlias = alias ? String(alias).trim() : null;
  const normalizedDescription = description ? String(description).trim() : null;
  const normalizedTags = parseTags(tags);

  await ensureUniqueAlias(normalizedAlias);

  const { hash, filePath } = await saveStickerBuffer({
    baseDir: config.stickersDir,
    buffer,
  });

  const existing = await getStickerByHash(hash);
  if (existing) {
    return existing;
  }

  return createSticker({
    alias: normalizedAlias,
    description: normalizedDescription,
    tags: normalizedTags,
    filePath,
    mimeType,
    sha256: hash,
    sourceType: 'upload',
  });
};

const importFromMessage = async ({ chatId, messageId, alias, description, tags }) => {
  if (!chatId || !messageId) {
    throw new AppError('VALIDATION_ERROR', 'chatId and messageId are required', 400);
  }

  const msg = await waService.getMessage({ chatId, messageId });
  if (!msg) {
    throw new AppError('MESSAGE_NOT_FOUND', 'Message not found in WhatsApp store', 404, {
      chatId,
      messageId,
      hint: 'Try importing via upload endpoint if the message is no longer available',
    });
  }

  const buffer = await waService.downloadStickerFromMessage(msg);
  const normalizedAlias = alias ? String(alias).trim() : null;
  const normalizedDescription = description ? String(description).trim() : null;
  const normalizedTags = parseTags(tags);

  await ensureUniqueAlias(normalizedAlias);

  const { hash, filePath } = await saveStickerBuffer({
    baseDir: config.stickersDir,
    buffer,
  });

  const existing = await getStickerByHash(hash);
  if (existing) {
    return existing;
  }

  return createSticker({
    alias: normalizedAlias,
    description: normalizedDescription,
    tags: normalizedTags,
    filePath,
    mimeType: 'image/webp',
    sha256: hash,
    sourceType: 'message',
    sourceChatId: chatId,
    sourceMessageId: messageId,
  });
};

const list = async ({ q, alias, tag, sha256, page, limit, sort }) => {
  const pageNumber = Math.max(Number.parseInt(page || '1', 10), 1);
  const limitNumber = Math.min(Math.max(Number.parseInt(limit || '20', 10), 1), 100);
  const hash = sha256 ? String(sha256).trim() : undefined;
  return searchStickers({ q, alias, tag, sha256: hash, page: pageNumber, limit: limitNumber, sort });
};

const getById = async (id) => {
  const sticker = await getStickerById(id);
  if (!sticker) {
    throw new AppError('STICKER_NOT_FOUND', 'Sticker not found', 404);
  }
  return sticker;
};

const update = async (id, payload) => {
  const patch = {};

  if (Object.hasOwn(payload, 'alias')) {
    patch.alias = payload.alias ? String(payload.alias).trim() : null;
    await ensureUniqueAlias(patch.alias, id);
  }

  if (Object.hasOwn(payload, 'description')) {
    patch.description = payload.description ? String(payload.description).trim() : null;
  }

  if (Object.hasOwn(payload, 'tags')) {
    patch.tags = parseTags(payload.tags);
  }

  if (Object.hasOwn(payload, 'isFavorite')) {
    patch.isFavorite = Boolean(payload.isFavorite);
  }

  const updated = await updateSticker(id, patch);
  if (!updated) {
    throw new AppError('STICKER_NOT_FOUND', 'Sticker not found', 404);
  }

  return updated;
};

const remove = async (id) => {
  const deleted = await softDeleteSticker(id);
  if (!deleted) {
    throw new AppError('STICKER_NOT_FOUND', 'Sticker not found', 404);
  }
};

const resolveSticker = async (selectorInput) => {
  const selector = normalizeSelector(selectorInput);

  if (selector.type === 'stickerId') {
    const sticker = await getStickerById(selector.value);
    if (!sticker) {
      throw new AppError('STICKER_NOT_FOUND', 'Sticker not found', 404);
    }
    return sticker;
  }

  if (selector.type === 'alias') {
    const sticker = await getStickerByAlias(selector.value);
    if (!sticker) {
      throw new AppError('STICKER_NOT_FOUND', 'Sticker alias not found', 404);
    }
    return sticker;
  }

  const search = await searchStickers({ q: selector.value, page: 1, limit: 5 });
  if (search.total === 0) {
    throw new AppError('STICKER_NOT_FOUND', 'No sticker matched query', 404);
  }

  if (search.total > 1) {
    throw new AppError('STICKER_QUERY_AMBIGUOUS', 'Query matched multiple stickers', 409, {
      candidates: search.items.map((item) => ({
        id: item.id,
        alias: item.alias,
        description: item.description,
      })),
    });
  }

  return search.items[0];
};

const send = async ({ toJid, selector, quotedMessageId }) => {
  if (!toJid) {
    throw new AppError('VALIDATION_ERROR', 'toJid is required', 400);
  }

  const sticker = await resolveSticker(selector);
  const stickerBuffer = await fs.readFile(sticker.filePath);

  let quotedMessage = null;
  if (quotedMessageId) {
    quotedMessage = await waService.getQuotedMessageById({
      chatId: toJid,
      messageId: quotedMessageId,
    });
  }

  try {
    const result = await waService.sendSticker({
      toJid,
      stickerBuffer,
      quotedMessage,
    });

    await insertSendLog({
      stickerId: sticker.id,
      toJid,
      waMessageId: result.messageId,
      status: 'sent',
      error: null,
    });

    return {
      sticker,
      waMessageId: result.messageId,
    };
  } catch (err) {
    await insertSendLog({
      stickerId: sticker.id,
      toJid,
      waMessageId: null,
      status: 'failed',
      error: err.message,
    });
    throw err;
  }
};

module.exports = {
  importFromUpload,
  importFromMessage,
  list,
  getById,
  update,
  remove,
  send,
  resolveSticker,
};
