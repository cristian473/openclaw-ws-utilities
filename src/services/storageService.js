const fs = require('fs/promises');
const path = require('path');
const { createHash } = require('crypto');

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

const saveStickerBuffer = async ({ baseDir, buffer }) => {
  await ensureDir(baseDir);
  const hash = sha256(buffer);
  const fileName = `${hash}.webp`;
  const absPath = path.resolve(baseDir, fileName);

  try {
    await fs.access(absPath);
  } catch {
    await fs.writeFile(absPath, buffer);
  }

  return {
    hash,
    filePath: absPath,
  };
};

module.exports = {
  ensureDir,
  saveStickerBuffer,
};
