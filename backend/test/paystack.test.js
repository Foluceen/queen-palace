import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

const paystack = await import('../dist/paystack.js');

test('payment options are available only when enabled and server key mode matches', () => {
  assert.equal(typeof paystack.isPaystackReady, 'function');
  const settings = { paystack: { enabled: true, mode: 'test', publicKey: 'pk_test_public' } };
  assert.equal(paystack.isPaystackReady(settings, 'sk_test_server'), true);
  assert.equal(paystack.isPaystackReady(settings, 'sk_live_server'), false);
  assert.equal(paystack.isPaystackReady({ paystack: { ...settings.paystack, enabled: false } }, 'sk_test_server'), false);
  assert.equal(paystack.isPaystackReady({ paystack: { ...settings.paystack, mode: 'live' } }, 'sk_test_server'), false);
});

test('Paystack initialization payload uses integer kobo, NGN, unique reference and callback metadata', () => {
  assert.equal(typeof paystack.createInitializePayload, 'function');
  const payload = paystack.createInitializePayload({
    email: 'buyer@example.test', totalKobo: 123456, reference: 'QLH-ORDER-a1b2',
    callbackUrl: 'https://www.queenluxuryhair.store/order/QLH-ORDER?token=access',
    orderId: 'order-id', orderNumber: 'QLH-ORDER'
  });
  assert.deepEqual(payload, {
    email: 'buyer@example.test', amount: 123456, currency: 'NGN', reference: 'QLH-ORDER-a1b2',
    callback_url: 'https://www.queenluxuryhair.store/order/QLH-ORDER?token=access',
    metadata: { orderId: 'order-id', orderNumber: 'QLH-ORDER' },
    channels: ['card', 'bank', 'ussd', 'bank_transfer']
  });
  assert.throws(() => paystack.createInitializePayload({ totalKobo: 12.3 }), /integer/i);
});

test('webhook signature verifies SHA-512 over exact raw bytes and rejects tampering', () => {
  assert.equal(typeof paystack.verifyPaystackWebhookSignature, 'function');
  const rawBody = Buffer.from('{"event":"charge.success","data":{"reference":"r1"}}');
  const signature = createHmac('sha512', 'server-test-secret').update(rawBody).digest('hex');
  assert.equal(paystack.verifyPaystackWebhookSignature(rawBody, signature, 'server-test-secret'), true);
  assert.equal(paystack.verifyPaystackWebhookSignature(Buffer.concat([rawBody, Buffer.from(' ')]), signature, 'server-test-secret'), false);
  assert.equal(paystack.verifyPaystackWebhookSignature(rawBody, undefined, 'server-test-secret'), false);
  assert.equal(paystack.verifyPaystackWebhookSignature(rawBody, signature, 'wrong-secret'), false);
});

test('transaction verification requires exact paid reference, amount and NGN currency', () => {
  assert.equal(typeof paystack.paystackTransactionMatches, 'function');
  const order = { payment_method: 'paystack', payment_reference: 'ref-1', total_kobo: '123456' };
  const valid = { status: 'success', reference: 'ref-1', amount: 123456, currency: 'NGN' };
  assert.equal(paystack.paystackTransactionMatches(order, valid), true);
  assert.equal(paystack.paystackTransactionMatches(order, { ...valid, amount: 123455 }), false);
  assert.equal(paystack.paystackTransactionMatches(order, { ...valid, currency: 'USD' }), false);
  assert.equal(paystack.paystackTransactionMatches(order, { ...valid, reference: 'other' }), false);
  assert.equal(paystack.paystackTransactionMatches(order, { ...valid, status: 'pending' }), false);
});

test('redirect URL is restricted to HTTPS Paystack hosts', () => {
  assert.equal(typeof paystack.isPaystackRedirectUrl, 'function');
  assert.equal(paystack.isPaystackRedirectUrl('https://checkout.paystack.com/abc'), true);
  assert.equal(paystack.isPaystackRedirectUrl('http://checkout.paystack.com/abc'), false);
  assert.equal(paystack.isPaystackRedirectUrl('https://paystack.com.evil.test/'), false);
  assert.equal(paystack.isPaystackRedirectUrl('https://evil.test/'), false);
});

test('Paystack API requests use server authorization and return only provider data', async () => {
  assert.equal(typeof paystack.requestPaystack, 'function');
  let sent;
  const result = await paystack.requestPaystack('/transaction/initialize', 'sk_test_server_only', { amount: 500 }, async (url, init) => {
    sent = { url, init };
    return { ok: true, status: 200, json: async () => ({ status: true, data: { authorization_url: 'https://checkout.paystack.com/x' } }) };
  });
  assert.equal(String(sent.url), 'https://api.paystack.co/transaction/initialize');
  assert.equal(sent.init.headers.Authorization, 'Bearer sk_test_server_only');
  assert.deepEqual(JSON.parse(sent.init.body), { amount: 500 });
  assert.deepEqual(result, { status: true, data: { authorization_url: 'https://checkout.paystack.com/x' } });
  await assert.rejects(() => paystack.requestPaystack('/transaction/initialize', 'sk_test_server_only', {}, async () => ({
    ok: false, status: 400, json: async () => ({ status: false, message: 'provider rejected' })
  })), /Paystack request failed/);
});

test('paid status is written only for an exactly matching verified Paystack transaction', async () => {
  assert.equal(typeof paystack.markOrderPaidIfVerified, 'function');
  const order = { id: 'order-id', payment_method: 'paystack', payment_reference: 'ref-1', total_kobo: '123456' };
  const valid = { status: 'success', reference: 'ref-1', amount: 123456, currency: 'NGN' };
  const state = { order: { ...order, payment_status: 'pending', inventory_status: 'reserved' } };
  const calls = [];
  const client = {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      if (/SELECT/i.test(sql)) return { rowCount: 1, rows: [{ ...state.order }] };
      if (/UPDATE orders SET payment_status='paid'/i.test(sql)) {
        state.order.payment_status = 'paid';
        state.order.inventory_status = params[3];
        return { rowCount: 1, rows: [{ id: state.order.id }] };
      }
      return { rowCount: 0, rows: [] };
    },
    release: () => {},
  };
  const db = { connect: async () => client };
  assert.equal(await paystack.markOrderPaidIfVerified(db, order, valid), true);
  const update = calls.find((call) => /UPDATE orders SET payment_status='paid'/i.test(call.sql));
  assert.ok(update);
  assert.match(update.sql, /inventory_status/i);
  assert.equal(update.params[3], 'committed');
  calls.length = 0;
  assert.equal(await paystack.markOrderPaidIfVerified(db, order, { ...valid, amount: 123455 }), false);
  assert.equal(calls.length, 0);
});

test('payment settings preserve public configuration, disable legacy methods and reject server secrets', () => {
  assert.equal(typeof paystack.normalizePaymentSettings, 'function');
  assert.equal(typeof paystack.sanitizePaymentSettings, 'function');
  const normalized = paystack.normalizePaymentSettings({
    paystack: { enabled: true, mode: 'test', publicKey: 'pk_test_public' },
    flutterwave: { enabled: true, publicKey: 'public' },
    bankTransfer: { enabled: true, bankName: 'Legacy bank' },
    payOnDelivery: { enabled: true }
  });
  assert.equal(normalized.paystack.enabled, true);
  assert.equal(normalized.flutterwave.enabled, false);
  assert.equal(normalized.bankTransfer.enabled, false);
  assert.equal(normalized.payOnDelivery.enabled, false);
  assert.throws(() => paystack.normalizePaymentSettings({
    paystack: { enabled: true, mode: 'test', publicKey: 'pk_test_public', secretKey: 'sk_test_not-allowed' }
  }), /secret/i);
  const stored = { paystack: { enabled: true, mode: 'test', publicKey: 'pk_test_public', secretKey: 'sk_test_not-allowed' }, extra: 'sk_live_not-allowed' };
  const safe = paystack.sanitizePaymentSettings(stored);
  assert.equal(safe.paystack.secretKey, undefined);
  assert.equal(safe.extra, undefined);
  assert.equal(safe.paystack.publicKey, 'pk_test_public');
});

test('webhook queue key is stable and duplicate events are persisted only once', async () => {
  assert.equal(typeof paystack.parseChargeSuccessEvent, 'function');
  assert.equal(typeof paystack.enqueuePaystackWebhook, 'function');
  const event = { event: 'charge.success', data: { id: 77, reference: 'ref-1', customer: { email: 'buyer@example.test' } } };
  assert.deepEqual(paystack.parseChargeSuccessEvent(event), { eventKey: 'charge.success:77', reference: 'ref-1' });
  assert.equal(paystack.parseChargeSuccessEvent({ event: 'transfer.success', data: { reference: 'ref-1' } }), null);
  const writes = [];
  const db = { query: async (sql, params) => { writes.push({ sql, params }); return { rowCount: 1, rows: [{ event_key: params[0] }] }; } };
  assert.equal(await paystack.enqueuePaystackWebhook(db, event), true);
  assert.match(writes[0].sql, /ON CONFLICT\s*\(event_key\)\s*DO NOTHING/i);
  assert.equal(writes[0].params[0], 'charge.success:77');
  assert.deepEqual(JSON.parse(writes[0].params[1]), { event: 'charge.success', data: { id: 77, reference: 'ref-1' } });
});

test('webhook processing verifies with Paystack before marking a referenced order paid', async () => {
  assert.equal(typeof paystack.processPaystackChargeSuccess, 'function');
  const order = { id: 'order-id', number: 'QLH-1', payment_method: 'paystack', payment_reference: 'ref-1', total_kobo: '123456' };
  const state = { order: { ...order, payment_status: 'pending', inventory_status: 'reserved' } };
  const calls = [];
  const client = {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      if (/SELECT/i.test(sql)) return { rowCount: 1, rows: [{ ...state.order }] };
      if (/UPDATE orders SET payment_status='paid'/i.test(sql)) {
        state.order.payment_status = 'paid';
        state.order.inventory_status = params[3];
        return { rowCount: 1, rows: [{ id: state.order.id }] };
      }
      return { rowCount: 0, rows: [] };
    },
    release: () => {},
  };
  const db = {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      return { rowCount: 1, rows: [{ ...state.order }] };
    },
    connect: async () => client,
  };
  const result = await paystack.processPaystackChargeSuccess(db, { event: 'charge.success', data: { id: 77, reference: 'ref-1' } }, async (ref) => {
    assert.equal(ref, 'ref-1');
    return { status: true, data: { status: 'success', reference: 'ref-1', amount: 123456, currency: 'NGN', metadata: { orderId: 'order-id', orderNumber: 'QLH-1' } } };
  });
  assert.deepEqual(result, { status: 'paid' });
  assert.match(calls[0].sql, /payment_reference\s*=\s*\$1/);
  const paidUpdate = calls.find((call) => /UPDATE orders SET payment_status='paid'/i.test(call.sql));
  assert.ok(paidUpdate);
  assert.match(paidUpdate.sql, /inventory_status/i);
  calls.length = 0;
  const mismatch = await paystack.processPaystackChargeSuccess(db, { event: 'charge.success', data: { id: 77, reference: 'ref-1' } }, async () => ({
    status: true, data: { status: 'success', reference: 'ref-1', amount: 1, currency: 'NGN' }
  }));
  assert.deepEqual(mismatch, { status: 'mismatch' });
  assert.equal(calls.length, 1);
  calls.length = 0;
  const retry = await paystack.processPaystackChargeSuccess(db, { event: 'charge.success', data: { id: 77, reference: 'ref-1' } }, async () => {
    throw new Error('network unavailable');
  });
  assert.deepEqual(retry, { status: 'retry' });
});
