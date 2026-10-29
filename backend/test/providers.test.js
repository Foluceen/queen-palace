import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyWebhookSignature } from '../dist/providers.js';

test('provider webhook signatures require exact HMAC and reject tampering', () => {
  const body='{"event":"payment.success","id":"test-1"}';
  const sig=createHmac('sha256','local-test-secret').update(body).digest('hex');
  assert.equal(verifyWebhookSignature(body,sig,'local-test-secret'),true);
  assert.equal(verifyWebhookSignature(body+'x',sig,'local-test-secret'),false);
  assert.equal(verifyWebhookSignature(body,undefined,'local-test-secret'),false);
  assert.equal(verifyWebhookSignature(body,sig,'wrong-secret'),false);
});
