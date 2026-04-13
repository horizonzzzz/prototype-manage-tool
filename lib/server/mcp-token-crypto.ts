import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { appConfig } from '@/lib/config';

const TOKEN_PREFIX_LENGTH = 12;
const TOKEN_SUFFIX_LENGTH = 4;

function getEncryptionKey() {
  const secret = appConfig.mcpTokenEncryptionKey.trim();
  if (!secret) {
    throw new Error('MCP token encryption key is not configured');
  }

  return createHash('sha256').update(secret).digest();
}

export function generateMcpApiToken() {
  return `mcp_${randomBytes(24).toString('base64url')}`;
}

export function hashMcpApiToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function encryptMcpApiToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64url')}.${encrypted.toString('base64url')}.${tag.toString('base64url')}`;
}

export function decryptMcpApiToken(ciphertext: string) {
  const [ivPart, encryptedPart, tagPart] = ciphertext.split('.');
  if (!ivPart || !encryptedPart || !tagPart) {
    throw new Error('Invalid MCP token ciphertext');
  }

  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));

  return Buffer.concat([decipher.update(Buffer.from(encryptedPart, 'base64url')), decipher.final()]).toString('utf8');
}

export function buildMcpTokenPreview(token: string) {
  if (token.length <= TOKEN_PREFIX_LENGTH + TOKEN_SUFFIX_LENGTH) {
    return token;
  }

  return `${token.slice(0, TOKEN_PREFIX_LENGTH)}...${token.slice(-TOKEN_SUFFIX_LENGTH)}`;
}

export function getMcpTokenPrefix(token: string) {
  return token.slice(0, TOKEN_PREFIX_LENGTH);
}

export function getMcpTokenSuffix(token: string) {
  return token.slice(-TOKEN_SUFFIX_LENGTH);
}
