const crypto = require('crypto');

const ENCRYPTION_VERSION = 'v1';
const IV_LENGTH = 12;

function getMasterKey() {
  const secret = process.env.AI_SECRETS_MASTER_KEY || process.env.COOKIE_SECRET || '';
  if (!secret) {
    throw new Error('AI secrets storage is not configured');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptSecret(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Secret value is required');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', getMasterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
}

function decryptSecret(serialized) {
  if (typeof serialized !== 'string' || !serialized.trim()) {
    throw new Error('Encrypted secret is missing');
  }

  const [version, ivBase64, authTagBase64, encryptedBase64] = serialized.split('.');
  if (version !== ENCRYPTION_VERSION || !ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error('Encrypted secret format is invalid');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getMasterKey(),
    Buffer.from(ivBase64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(authTagBase64, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

function maskApiKey(apiKey) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) return null;
  const trimmed = apiKey.trim();
  return trimmed.length <= 8
    ? trimmed
    : `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

function getApiKeyLast4(apiKey) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) return null;
  return apiKey.trim().slice(-4);
}

module.exports = {
  decryptSecret,
  encryptSecret,
  getApiKeyLast4,
  maskApiKey,
};
