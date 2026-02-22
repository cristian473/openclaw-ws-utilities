const express = require('express');
const waService = require('../services/waService');

const router = express.Router();

router.get('/wa/status', async (_req, res) => {
  const status = await waService.getStatus();
  res.json(status);
});

router.get('/wa/qr', async (_req, res) => {
  const qr = await waService.getQrText();
  res.json(qr);
});

router.get('/wa/qr.png', async (_req, res) => {
  const png = await waService.getQrPng();
  res.setHeader('Content-Type', 'image/png');
  res.send(png);
});

router.post('/wa/connect', async (_req, res) => {
  const status = await waService.connect();
  res.status(202).json(status);
});

router.post('/wa/disconnect', async (_req, res) => {
  const status = await waService.disconnect();
  res.json(status);
});

module.exports = router;
