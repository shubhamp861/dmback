import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { decodeTokenEncryptionKey } from '../token-encryption-key.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const FORMAT_VERSION = 1;

export function encryptAccessToken(token: string, encodedKey: string): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, decodeTokenEncryptionKey(encodedKey), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([FORMAT_VERSION]), iv, authTag, ciphertext]);
}

export function decryptAccessToken(ciphertext: Buffer, encodedKey: string): string {
  if (ciphertext.length <= 1 + IV_LENGTH + TAG_LENGTH || ciphertext[0] !== FORMAT_VERSION) {
    throw new Error('Unsupported encrypted token format');
  }
  const ivStart = 1;
  const tagStart = ivStart + IV_LENGTH;
  const dataStart = tagStart + TAG_LENGTH;
  const iv = ciphertext.subarray(ivStart, tagStart);
  const authTag = ciphertext.subarray(tagStart, dataStart);
  const encrypted = ciphertext.subarray(dataStart);
  const decipher = createDecipheriv(ALGORITHM, decodeTokenEncryptionKey(encodedKey), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
