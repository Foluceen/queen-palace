import test from 'node:test';
import assert from 'node:assert/strict';
import { commitPaystackOrderInventory, releasePaystackOrderInventory } from '../dist/inventory.js';

function fakePool({ inventoryStatus = 'reserved', paymentStatus = 'pending', variantStock = 7, productStock = 10 } = {}) {
  const state = {
    order: { id: 'order-1', payment_method: 'paystack', payment_reference: 'ref-1', total_kobo: '250000', payment_status: paymentStatus, inventory_status: inventoryStatus, status: 'pending' },
    lines: [
      { variant_id: 'variant-1', product_id: 'product-1', quantity: 3 },
      { variant_id: null, product_id: 'product-2', quantity: 2 },
    ],
    variants: { 'variant-1': variantStock },
    products: { 'product-2': productStock },
    restoreCalls: 0,
    decrementCalls: 0,
    savepoint: null,
  };
  const client = {
    async query(sql, params = []) {
      const q = sql.replace(/\s+/g, ' ').trim().toLowerCase();
      if (['begin', 'commit', 'rollback'].includes(q) || q.startsWith('savepoint ') || q.startsWith('rollback to savepoint')) {
        if (q.startsWith('savepoint ')) state.savepoint = { variants: { ...state.variants }, products: { ...state.products } };
        if (q.startsWith('rollback to savepoint') && state.savepoint) {
          state.variants = { ...state.savepoint.variants };
          state.products = { ...state.savepoint.products };
        }
        return { rowCount: 0, rows: [] };
      }
      if (q.startsWith('select') && q.includes('from orders')) return { rowCount: 1, rows: [{ ...state.order }] };
      if (q.startsWith('select') && q.includes('from order_lines')) return { rowCount: state.lines.length, rows: state.lines.map((line) => ({ ...line })) };
      if (q.startsWith('update product_variants v set stock=v.stock+')) {
        state.restoreCalls++;
        for (const line of state.lines.filter((x) => x.variant_id)) state.variants[line.variant_id] += line.quantity;
        return { rowCount: 1, rows: [] };
      }
      if (q.startsWith('update products p set stock=p.stock+')) {
        for (const line of state.lines.filter((x) => !x.variant_id)) state.products[line.product_id] += line.quantity;
        return { rowCount: 1, rows: [] };
      }
      if (q.startsWith('update product_variants set stock=stock-')) {
        state.decrementCalls++;
        const [quantity, id] = params;
        if ((state.variants[id] ?? 0) < quantity) return { rowCount: 0, rows: [] };
        state.variants[id] -= quantity;
        return { rowCount: 1, rows: [{ id }] };
      }
      if (q.startsWith('update products set stock=stock-')) {
        state.decrementCalls++;
        const [quantity, id] = params;
        if ((state.products[id] ?? 0) < quantity) return { rowCount: 0, rows: [] };
        state.products[id] -= quantity;
        return { rowCount: 1, rows: [{ id }] };
      }
      if (q.startsWith("update orders set payment_status='failed'")) {
        if (state.order.payment_status !== 'pending' || state.order.inventory_status !== 'reserved' || state.order.payment_reference !== params[1]) return { rowCount: 0, rows: [] };
        state.order.payment_status = 'failed';
        state.order.inventory_status = 'released';
        return { rowCount: 1, rows: [{ id: state.order.id }] };
      }
      if (q.startsWith("update orders set payment_status='paid'")) {
        if (state.order.payment_status !== params[4] || state.order.inventory_status !== params[5] || state.order.payment_reference !== params[1]) return { rowCount: 0, rows: [] };
        state.order.payment_status = 'paid';
        if (params[3] === 'shortfall') {
          state.order.inventory_status = 'shortfall';
        } else {
          state.order.inventory_status = 'committed';
        }
        return { rowCount: 1, rows: [{ id: state.order.id }] };
      }
      throw new Error(`Unexpected SQL in test fake: ${q}`);
    },
    release() {},
  };
  return { state, pool: { connect: async () => client } };
}

test('failed pending order releases variant and product stock exactly once', async () => {
  const { state, pool } = fakePool();
  assert.equal(await releasePaystackOrderInventory(pool, 'order-1', 'ref-1'), true);
  assert.equal(state.variants['variant-1'], 10);
  assert.equal(state.products['product-2'], 12);
  assert.equal(state.order.payment_status, 'failed');
  assert.equal(state.order.inventory_status, 'released');
  assert.equal(await releasePaystackOrderInventory(pool, 'order-1', 'ref-1'), false);
  assert.equal(state.variants['variant-1'], 10);
  assert.equal(state.products['product-2'], 12);
  assert.equal(state.restoreCalls, 1);
});

test('paid or already committed orders are never released', async () => {
  const { state, pool } = fakePool({ paymentStatus: 'paid', inventoryStatus: 'committed' });
  assert.equal(await releasePaystackOrderInventory(pool, 'order-1', 'ref-1'), false);
  assert.equal(state.variants['variant-1'], 7);
  assert.equal(state.restoreCalls, 0);
});

test('verified payment commits a reserved order without another stock decrement; retries are idempotent', async () => {
  const { state, pool } = fakePool();
  assert.equal(await commitPaystackOrderInventory(pool, 'order-1', 'ref-1', 250000), true);
  assert.equal(state.variants['variant-1'], 7);
  assert.equal(state.products['product-2'], 10);
  assert.equal(state.order.payment_status, 'paid');
  assert.equal(state.order.inventory_status, 'committed');
  assert.equal(await commitPaystackOrderInventory(pool, 'order-1', 'ref-1', 250000), true);
  assert.equal(state.variants['variant-1'], 7);
  assert.equal(state.products['product-2'], 10);
  assert.equal(state.decrementCalls, 0);
});

test('verified late payment reacquires released stock once when stock remains available', async () => {
  const { state, pool } = fakePool({ inventoryStatus: 'released', paymentStatus: 'failed', variantStock: 10, productStock: 12 });
  assert.equal(await commitPaystackOrderInventory(pool, 'order-1', 'ref-1', 250000), true);
  assert.equal(state.variants['variant-1'], 7);
  assert.equal(state.products['product-2'], 10);
  assert.equal(state.order.inventory_status, 'committed');
  assert.equal(await commitPaystackOrderInventory(pool, 'order-1', 'ref-1', 250000), true);
  assert.equal(state.variants['variant-1'], 7);
  assert.equal(state.decrementCalls, 2);
});

test('late verified payment with unavailable stock is recorded for manual review without making stock negative', async () => {
  const { state, pool } = fakePool({ inventoryStatus: 'released', paymentStatus: 'pending', variantStock: 1, productStock: 1 });
  assert.equal(await commitPaystackOrderInventory(pool, 'order-1', 'ref-1', 250000), true);
  assert.equal(state.variants['variant-1'], 1);
  assert.equal(state.products['product-2'], 1);
  assert.equal(state.order.payment_status, 'paid');
  assert.equal(state.order.inventory_status, 'shortfall');
  assert.equal(state.decrementCalls, 1);
});
