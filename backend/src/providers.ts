import { createHmac, timingSafeEqual } from 'node:crypto';

/** Verify provider callbacks without accepting malformed or replay-prone signatures. */
export function verifyWebhookSignature(rawBody: string|Buffer, signature: string|undefined, secret: string|undefined): boolean {
  if (!signature || !secret) return false;
  const received=Buffer.from(signature.trim(),'hex');
  const expected=createHmac('sha256',secret).update(rawBody).digest();
  return received.length===expected.length && timingSafeEqual(received,expected);
}
