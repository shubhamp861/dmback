import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export function verifyMetaSignature(rawBody: Buffer, signatureHeader: string | undefined, appSecret: string): boolean {
  if (!signatureHeader?.startsWith('sha256=')) {
    return false;
  }

  const received = signatureHeader.slice('sha256='.length);
  if (!/^[a-f0-9]{64}$/i.test(received)) {
    return false;
  }

  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(received, 'hex');
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function sha256Hex(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}
