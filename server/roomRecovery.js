const crypto = require('crypto');

const TOKEN_VERSION = 1;
const MAX_TOKEN_LENGTH = 128 * 1024;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_CONTEXT = 'meukingdom-room-recovery-v1';

function getRecoverySecret(env = process.env) {
  if (env.ROOM_RECOVERY_SECRET) return env.ROOM_RECOVERY_SECRET;
  if (env.RENDER_SERVICE_ID) return `${KEY_CONTEXT}:render:${env.RENDER_SERVICE_ID}`;
  return `${KEY_CONTEXT}:local:${env.RENDER_EXTERNAL_HOSTNAME || 'localhost'}`;
}

function deriveKey(secret) {
  return crypto.createHash('sha256').update(String(secret)).digest();
}

function createRoomRecoveryToken(codigo, roomSnapshot, options = {}) {
  const now = options.now ?? Date.now();
  const ttlMs = options.ttlMs ?? 12 * 60 * 60 * 1000;
  const secret = options.secret ?? getRecoverySecret();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const payload = JSON.stringify({
    version: TOKEN_VERSION,
    codigo,
    issuedAt: now,
    expiresAt: now + ttlMs,
    room: roomSnapshot,
  });
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

function recoverRoomFromToken(codigo, token, options = {}) {
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [ivPart, authTagPart, encryptedPart] = parts;
    const iv = Buffer.from(ivPart, 'base64url');
    const authTag = Buffer.from(authTagPart, 'base64url');
    const encrypted = Buffer.from(encryptedPart, 'base64url');
    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH || encrypted.length === 0) return null;

    const secret = options.secret ?? getRecoverySecret();
    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(secret), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    const payload = JSON.parse(decrypted);
    const now = options.now ?? Date.now();

    if (payload.version !== TOKEN_VERSION || payload.codigo !== codigo) return null;
    if (!Number.isFinite(payload.expiresAt) || payload.expiresAt < now) return null;
    if (!payload.room || !Array.isArray(payload.room.jogadores)) return null;

    return payload.room;
  } catch {
    return null;
  }
}

module.exports = {
  createRoomRecoveryToken,
  getRecoverySecret,
  recoverRoomFromToken,
};
