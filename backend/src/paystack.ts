import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { commitPaystackOrderInventory, type InventoryDbPool } from './inventory.js';

const PAYSTACK_ORIGIN = 'https://api.paystack.co';
const NGN_CHANNELS = ['card', 'bank', 'ussd', 'bank_transfer'];

export type PaystackMode = 'test' | 'live';
export interface PaystackSettings {
  paystack?: { enabled?: boolean; mode?: PaystackMode; publicKey?: string };
}
export interface PaystackOrder {
  id?: string;
  number?: string;
  payment_method?: string;
  payment_reference?: string | null;
  total_kobo: string | number | bigint;
}
export interface PaystackTransaction {
  status?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  metadata?: { orderId?: string; orderNumber?: string };
}

export function isPaystackReady(settings: PaystackSettings | null | undefined, secretKey: string | undefined): boolean {
  const payment = settings?.paystack;
  if (payment?.enabled !== true || (payment.mode !== 'test' && payment.mode !== 'live')) return false;
  const secret = typeof secretKey === 'string' ? secretKey.trim() : '';
  const publicKey = typeof payment.publicKey === 'string' ? payment.publicKey.trim() : '';
  const mode = payment.mode;
  return secret.startsWith(`sk_${mode}_`) && publicKey.startsWith(`pk_${mode}_`);
}

export function createPaystackReference(orderNumber: string): string {
  if (!/^[A-Za-z0-9-]{4,100}$/.test(orderNumber)) throw new Error('Invalid order number');
  return `${orderNumber}-${randomBytes(12).toString('hex')}`;
}

export function createInitializePayload(input: {
  email: string;
  totalKobo: number;
  reference: string;
  callbackUrl: string;
  orderId: string;
  orderNumber: string;
}) {
  if (!Number.isSafeInteger(input?.totalKobo) || input.totalKobo < 1) throw new Error('Amount must be a positive integer in kobo');
  if (typeof input.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error('Invalid email');
  if (typeof input.reference !== 'string' || !/^[A-Za-z0-9-]{4,140}$/.test(input.reference)) throw new Error('Invalid reference');
  const callback = new URL(input.callbackUrl);
  if (callback.protocol !== 'https:' || callback.hostname !== 'www.queenluxuryhair.store' || !callback.pathname.startsWith('/order/')) {
    throw new Error('Invalid payment callback URL');
  }
  if (!input.orderId || !input.orderNumber) throw new Error('Order metadata is required');
  return {
    email: input.email,
    amount: input.totalKobo,
    currency: 'NGN',
    reference: input.reference,
    callback_url: callback.toString(),
    metadata: { orderId: input.orderId, orderNumber: input.orderNumber },
    channels: [...NGN_CHANNELS]
  };
}

export function verifyPaystackWebhookSignature(rawBody: Buffer | Uint8Array, signature: unknown, secretKey: string | undefined): boolean {
  if (!(Buffer.isBuffer(rawBody) || rawBody instanceof Uint8Array) || typeof signature !== 'string' || !secretKey) return false;
  if (!/^[a-f0-9]{128}$/i.test(signature)) return false;
  const supplied = Buffer.from(signature, 'hex');
  const expected = createHmac('sha512', secretKey).update(rawBody).digest();
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function paystackTransactionMatches(order: PaystackOrder, transaction: PaystackTransaction): boolean {
  if (!order || !transaction || order.payment_method !== 'paystack' || transaction.status !== 'success') return false;
  const expectedAmount = Number(order.total_kobo);
  if (!Number.isSafeInteger(expectedAmount) || expectedAmount < 1) return false;
  if (typeof order.payment_reference !== 'string' || !order.payment_reference || transaction.reference !== order.payment_reference) return false;
  if (!Number.isSafeInteger(transaction.amount) || transaction.amount !== expectedAmount || transaction.currency !== 'NGN') return false;
  if (transaction.metadata?.orderId && order.id && transaction.metadata.orderId !== order.id) return false;
  if (transaction.metadata?.orderNumber && order.number && transaction.metadata.orderNumber !== order.number) return false;
  return true;
}

export function isPaystackRedirectUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'paystack.com' || url.hostname.endsWith('.paystack.com')) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export async function requestPaystack<T = any>(path: string, secretKey: string, body?: unknown, fetchImpl: typeof fetch = fetch): Promise<T> {
  if (!secretKey || !secretKey.startsWith('sk_')) throw new Error('Paystack secret key is not configured');
  const url = new URL(path, PAYSTACK_ORIGIN);
  if (url.origin !== PAYSTACK_ORIGIN || !path.startsWith('/')) throw new Error('Invalid Paystack API path');
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000)
    });
  } catch {
    throw new Error('Paystack request failed');
  }
  let result: any;
  try {
    result = await response.json();
  } catch {
    throw new Error('Paystack returned an invalid response');
  }
  if (!response.ok || result?.status !== true) throw new Error('Paystack request failed');
  return result as T;
}

export async function markOrderPaidIfVerified(
  db: Pick<InventoryDbPool, 'connect'>,
  order: PaystackOrder,
  transaction: PaystackTransaction
): Promise<boolean> {
  if (!paystackTransactionMatches(order, transaction) || !order.id || !order.payment_reference) return false;
  const amount = Number(order.total_kobo);
  return commitPaystackOrderInventory(db, order.id, order.payment_reference, amount);
}

function containsPaystackSecret(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsPaystackSecret);
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([key, child]) => /secret|private.?key/i.test(key) || containsPaystackSecret(child));
  }
  return typeof value === 'string' && /^sk_(test|live)_/i.test(value.trim());
}

function safeSettingsValue(value: any): any {
  if (Array.isArray(value)) return value.map(safeSettingsValue).filter((child) => child !== undefined);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !/secret|private.?key/i.test(key))
      .map(([key, child]) => [key, safeSettingsValue(child)])
      .filter(([, child]) => child !== undefined));
  }
  if (typeof value === 'string' && /^sk_(test|live)_/i.test(value.trim())) return undefined;
  return value;
}

export function normalizePaymentSettings(input: unknown): Record<string, any> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid payment settings');
  if (containsPaystackSecret(input)) throw new Error('Server secret keys must be configured in the server environment');
  const body = input as Record<string, any>;
  const paystack = body.paystack;
  if (!paystack || typeof paystack !== 'object' || Array.isArray(paystack)) throw new Error('Paystack settings are required');
  if (typeof paystack.enabled !== 'boolean' || (paystack.mode !== 'test' && paystack.mode !== 'live')) throw new Error('Invalid Paystack mode or enabled setting');
  if (typeof paystack.publicKey !== 'string' || paystack.publicKey.length > 200) throw new Error('Invalid Paystack public key');
  if (paystack.enabled && !new RegExp(`^pk_${paystack.mode}_`).test(paystack.publicKey.trim())) throw new Error('Public key does not match Paystack mode');

  const safe = safeSettingsValue(body);
  return {
    ...safe,
    paystack: { enabled: paystack.enabled, mode: paystack.mode, publicKey: paystack.publicKey.trim() },
    flutterwave: { ...(safe.flutterwave || {}), enabled: false },
    bankTransfer: { ...(safe.bankTransfer || {}), enabled: false },
    payOnDelivery: { ...(safe.payOnDelivery || {}), enabled: false }
  };
}

export function parseChargeSuccessEvent(value: unknown): { eventKey: string; reference: string } | null {
  if (!value || typeof value !== 'object') return null;
  const event = value as any;
  if (event.event !== 'charge.success' || !event.data || typeof event.data !== 'object') return null;
  const reference = typeof event.data.reference === 'string' ? event.data.reference : '';
  if (!reference || reference.length > 140) return null;
  const identifier = event.data.id === undefined || event.data.id === null ? reference : String(event.data.id);
  const normalized = /^[A-Za-z0-9:_-]{1,150}$/.test(identifier) ? identifier : createHash('sha256').update(identifier).digest('hex');
  return { eventKey: `charge.success:${normalized}`, reference };
}

export async function enqueuePaystackWebhook(
  db: { query: (sql: string, params: unknown[]) => Promise<{ rowCount?: number | null; rows?: unknown[] }> },
  event: unknown
): Promise<boolean> {
  const parsed = parseChargeSuccessEvent(event);
  if (!parsed) return false;
  const rawId = (event as any)?.data?.id;
  const safeId = typeof rawId === 'number' || (typeof rawId === 'string' && rawId.length <= 150) ? rawId : undefined;
  const minimalEvent = { event: 'charge.success', data: { ...(safeId === undefined ? {} : { id: safeId }), reference: parsed.reference } };
  const result = await db.query(
    "INSERT INTO paystack_webhook_events(event_key,payload,status) VALUES($1,$2::jsonb,'pending') ON CONFLICT(event_key) DO NOTHING RETURNING event_key",
    [parsed.eventKey, JSON.stringify(minimalEvent)]
  );
  return (result.rowCount || 0) > 0;
}

export async function processPaystackChargeSuccess(
  db: InventoryDbPool,
  event: unknown,
  verifyTransaction: (reference: string) => Promise<{ status?: boolean; data?: PaystackTransaction }>
): Promise<{ status: 'ignored' | 'unmatched' | 'mismatch' | 'retry' | 'paid' | 'paid_shortfall' }> {
  const parsed = parseChargeSuccessEvent(event);
  if (!parsed) return { status: 'ignored' };
  const found = await db.query(
    "SELECT id,number,payment_method,payment_reference,total_kobo,payment_status FROM orders WHERE payment_reference=$1 AND payment_method='paystack' LIMIT 1",
    [parsed.reference]
  );
  if (!found.rowCount || !found.rows?.[0]) return { status: 'unmatched' };
  let result: { status?: boolean; data?: PaystackTransaction };
  try {
    result = await verifyTransaction(parsed.reference);
  } catch {
    return { status: 'retry' };
  }
  if (result?.status !== true || !result.data) return { status: 'retry' };
  if (!paystackTransactionMatches(found.rows[0], result.data)) return { status: 'mismatch' };
  const marked = await markOrderPaidIfVerified(db, found.rows[0], result.data);
  if (!marked) return { status: 'mismatch' };
  const inventory = await db.query('SELECT inventory_status FROM orders WHERE id=$1',[found.rows[0].id]);
  return inventory.rows?.[0]?.inventory_status === 'shortfall' ? { status: 'paid_shortfall' } : { status: 'paid' };
}

export function sanitizePaymentSettings(value: unknown): Record<string, any> {
  const safe = safeSettingsValue(value) || {};
  const paystack = safe.paystack && typeof safe.paystack === 'object' ? safe.paystack : {};
  const mode = paystack.mode === 'live' ? 'live' : 'test';
  return {
    ...safe,
    paystack: {
      enabled: paystack.enabled === true,
      mode,
      publicKey: typeof paystack.publicKey === 'string' ? paystack.publicKey : ''
    },
    flutterwave: { ...(safe.flutterwave || {}), enabled: false },
    bankTransfer: { ...(safe.bankTransfer || {}), enabled: false },
    payOnDelivery: { ...(safe.payOnDelivery || {}), enabled: false }
  };
}
