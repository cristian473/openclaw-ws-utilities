const express = require('express');
const multer = require('multer');
const config = require('../config');
const { AppError } = require('../errors');
const stickerService = require('../services/stickerService');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxUploadMb * 1024 * 1024,
  },
});

router.post('/stickers/import/message', async (req, res) => {
  const payload = req.body || {};
  const sticker = await stickerService.importFromMessage({
    chatId: payload.chatId,
    messageId: payload.messageId,
    alias: payload.alias,
    description: payload.description,
    tags: payload.tags,
  });

  res.status(201).json(sticker);
});

router.post('/stickers/import/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    throw new AppError('VALIDATION_ERROR', 'file is required', 400);
  }

  const sticker = await stickerService.importFromUpload({
    buffer: req.file.buffer,
    mimeType: req.file.mimetype,
    alias: req.body?.alias,
    description: req.body?.description,
    tags: req.body?.tags,
  });

  res.status(201).json(sticker);
});

router.get('/stickers', async (req, res) => {
  const result = await stickerService.list(req.query || {});
  res.json(result);
});

router.get('/stickers/:id', async (req, res) => {
  const sticker = await stickerService.getById(req.params.id);
  res.json(sticker);
});

router.patch('/stickers/:id', async (req, res) => {
  const sticker = await stickerService.update(req.params.id, req.body || {});
  res.json(sticker);
});

router.delete('/stickers/:id', async (req, res) => {
  await stickerService.remove(req.params.id);
  res.status(204).send();
});

router.post('/stickers/send', async (req, res) => {
  const payload = req.body || {};
  const result = await stickerService.send({
    toJid: payload.toJid,
    selector: {
      stickerId: payload.stickerId,
      alias: payload.alias,
      query: payload.query,
    },
    quotedMessageId: payload.quotedMessageId,
  });

  res.status(202).json(result);
});

module.exports = router;
