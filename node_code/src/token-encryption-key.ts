/** Node's base64 decoder is permissive; configuration must use canonical encoding. */
export function isValidTokenEncryptionKey(encodedKey: string): boolean {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(encodedKey)) return false;
  const key = Buffer.from(encodedKey, 'base64');
  return key.length === 32 && key.toString('base64') === encodedKey;
}

export function decodeTokenEncryptionKey(encodedKey: string): Buffer {
  if (!isValidTokenEncryptionKey(encodedKey)) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be canonical base64-encoded 32-byte key material');
  }
  return Buffer.from(encodedKey, 'base64');
}
