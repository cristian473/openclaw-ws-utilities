const fs = require('fs/promises');
const path = require('path');
const baileys = require('@whiskeysockets/baileys');
const makeWASocket = baileys.default;
const {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  getContentType,
} = baileys;
const Pino = require('pino');
const QRCode = require('qrcode');
const config = require('../config');
const { AppError } = require('../errors');
const { setWaState, getWaSession, upsertMessageIndex } = require('../db/waRepo');

const logger = Pino({ level: process.env.LOG_LEVEL || 'info' });
let makeInMemoryStore = baileys.makeInMemoryStore;
if (typeof makeInMemoryStore !== 'function') {
  try {
    ({ makeInMemoryStore } = require('@whiskeysockets/baileys/lib/Store'));
  } catch {
    makeInMemoryStore = null;
  }
}
const store = typeof makeInMemoryStore === 'function'
  ? makeInMemoryStore({ logger: Pino({ level: 'silent' }) })
  : null;

let sock = null;
let isConnecting = false;
const messageMap = new Map();
const MAX_MESSAGE_CACHE = 5000;

const messageKey = (chatId, messageId) => `${chatId}:${messageId}`;
const cacheMessage = (chatId, messageId, msg) => {
  messageMap.set(messageKey(chatId, messageId), msg);
  if (messageMap.size > MAX_MESSAGE_CACHE) {
    const firstKey = messageMap.keys().next().value;
    if (firstKey) {
      messageMap.delete(firstKey);
    }
  }
};

const extractRealMessage = (msg) => {
  if (!msg) return null;
  const base = msg.message || msg;

  return (
    base.ephemeralMessage?.message ||
    base.viewOnceMessage?.message ||
    base.viewOnceMessageV2?.message ||
    base.documentWithCaptionMessage?.message ||
    base
  );
};

const getMessageType = (msg) => {
  const real = extractRealMessage(msg);
  return getContentType(real) || 'unknown';
};

const hasStickerMessage = (msg) => {
  const real = extractRealMessage(msg);
  const type = getContentType(real);
  return type === 'stickerMessage';
};

const ensureAuthDir = async () => {
  await fs.mkdir(path.resolve(config.baileysAuthDir), { recursive: true });
};

const bindMessageEvents = () => {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages || []) {
      const chatId = msg?.key?.remoteJid;
      const messageId = msg?.key?.id;
      if (!chatId || !messageId) continue;

      cacheMessage(chatId, messageId, msg);

      await upsertMessageIndex({
        chatId,
        messageId,
        messageType: getMessageType(msg),
        hasSticker: hasStickerMessage(msg),
      });
    }
  });

  sock.ev.on('creds.update', async () => {
    // creds persistence is handled by Baileys auth state
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr } = update;

    if (qr) {
      const expiresAt = new Date(Date.now() + 60_000);
      await setWaState({
        state: 'connecting',
        qrText: qr,
        qrExpiresAt: expiresAt,
      });
    }

    if (connection === 'open') {
      const me = sock?.user?.id || null;
      await setWaState({
        state: 'connected',
        phone: me,
        qrText: null,
        qrExpiresAt: null,
        lastConnectionAt: new Date(),
      });
      isConnecting = false;
    }

    if (connection === 'close') {
      sock = null;
      await setWaState({
        state: 'disconnected',
        qrText: null,
        qrExpiresAt: null,
      });
      isConnecting = false;
    }
  });
};

const connect = async () => {
  if (sock || isConnecting) {
    return getWaSession();
  }

  isConnecting = true;
  await ensureAuthDir();

  const { state, saveCreds } = await useMultiFileAuthState(config.baileysAuthDir);
  let version;
  try {
    ({ version } = await fetchLatestBaileysVersion());
  } catch {
    version = undefined;
  }

  const socketConfig = {
    auth: state,
    logger,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    browser: ['Sticker API', 'Chrome', '1.0.0'],
  };
  if (version) {
    socketConfig.version = version;
  }

  sock = makeWASocket(socketConfig);

  sock.ev.on('creds.update', saveCreds);
  if (store && typeof store.bind === 'function') {
    store.bind(sock.ev);
  }
  bindMessageEvents();

  await setWaState({ state: 'connecting' });
  return getWaSession();
};

const disconnect = async () => {
  if (sock) {
    try {
      if (sock.ws && typeof sock.ws.close === 'function') {
        sock.ws.close();
      }
    } catch {
      // noop
    }
    sock = null;
  }

  isConnecting = false;
  await setWaState({ state: 'disconnected', qrText: null, qrExpiresAt: null });
  return getWaSession();
};

const getStatus = async () => getWaSession();

const getQrText = async () => {
  const session = await getWaSession();
  return {
    qrText: session.qrText,
    expiresAt: session.qrExpiresAt,
  };
};

const getQrPng = async () => {
  const { qrText } = await getQrText();
  if (!qrText) {
    throw new AppError('QR_NOT_AVAILABLE', 'No active QR available', 404);
  }

  return QRCode.toBuffer(qrText, { type: 'png', margin: 1, width: 320 });
};

const getMessage = async ({ chatId, messageId }) => {
  const key = messageKey(chatId, messageId);
  const cached = messageMap.get(key);
  if (cached) return cached;

  try {
    if (!store || typeof store.loadMessage !== 'function') {
      return null;
    }

    const fromStore = await store.loadMessage(chatId, messageId);
    if (fromStore) {
      cacheMessage(chatId, messageId, fromStore);
      return fromStore;
    }
  } catch {
    // fallback to not found
  }

  return null;
};

const downloadStickerFromMessage = async (msg) => {
  if (!sock) {
    throw new AppError('WA_NOT_CONNECTED', 'WhatsApp is not connected', 409);
  }

  if (!hasStickerMessage(msg)) {
    throw new AppError('NOT_A_STICKER', 'Message does not contain a sticker', 400);
  }

  const buffer = await downloadMediaMessage(
    msg,
    'buffer',
    {},
    {
      logger,
      reuploadRequest: sock.updateMediaMessage,
    }
  );

  return buffer;
};

const sendSticker = async ({ toJid, stickerBuffer, quotedMessage = null }) => {
  if (!sock) {
    throw new AppError('WA_NOT_CONNECTED', 'WhatsApp is not connected', 409);
  }

  const result = await sock.sendMessage(
    toJid,
    { sticker: stickerBuffer },
    quotedMessage ? { quoted: quotedMessage } : undefined
  );

  return {
    messageId: result?.key?.id || null,
  };
};

const getQuotedMessageById = async ({ chatId, messageId }) => getMessage({ chatId, messageId });

module.exports = {
  connect,
  disconnect,
  getStatus,
  getQrText,
  getQrPng,
  getMessage,
  downloadStickerFromMessage,
  sendSticker,
  getQuotedMessageById,
};
