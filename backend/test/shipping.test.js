import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeShippingSettings, normalizeShippingSettingsOrEmpty, quoteShippingRates, selectShippingRate, shippingTotals } from '../dist/shipping.js';

const settings = {
  processingDays: [0, 1],
  zones: [
    { id: 'ilesha', name: 'Ilesha', states: ['Osun'], cities: ['Ilesha', 'Ijoka'], rates: [
      { id: 'rider', label: 'Rider', description: 'Local rider', amount: 150000, etaDays: [0, 1], freeOver: null },
      { id: 'pickup', label: 'Pickup', description: 'Collect in store', amount: 0, etaDays: [0, 1], freeOver: null },
    ] },
    { id: 'osun', name: 'Rest of Osun', states: ['Osun'], cities: [], rates: [
      { id: 'osun-courier', label: 'Osun courier', description: 'Courier', amount: 300000, etaDays: [1, 2], freeOver: 2000000 },
    ] },
    { id: 'national', name: 'Rest of Nigeria', states: [], cities: [], rates: [
      { id: 'national-courier', label: 'National courier', description: '', amount: 800000, etaDays: [3, 6], freeOver: null },
    ] },
  ],
};

test('shipping quotes choose city-specific zone, preserve kobo amounts, and apply free-over threshold', () => {
  const rates = quoteShippingRates(settings, { state: 'osun', city: 'Ilesha East' }, 2500000);
  assert.deepEqual(rates.map(({ id, amount }) => ({ id, amount })), [
    { id: 'rider', amount: 150000 },
    { id: 'pickup', amount: 0 },
  ]);
  const nationwide = quoteShippingRates(settings, { state: 'Osun', city: 'Ede' }, 2500000);
  assert.equal(nationwide[0].amount, 0);
  assert.deepEqual(nationwide[0].etaDays, [1, 2]);
  assert.equal(nationwide[0].currency, 'NGN');
});

test('frontend ShippingSettings payload is accepted and round-trips with kobo rates', () => {
  assert.deepEqual(normalizeShippingSettings(settings), settings);
  assert.equal(quoteShippingRates(normalizeShippingSettings(settings), { state: 'Osun', city: 'Ilesha' }, 1000)[0].amount, 150000);
});

test('missing settings fail closed to no delivery rates', () => {
  const empty = normalizeShippingSettingsOrEmpty(null);
  assert.deepEqual(empty, { zones: [], processingDays: [1, 3] });
  assert.deepEqual(quoteShippingRates(empty, { state: 'Lagos', city: 'Ikeja' }, 1000), []);
});

test('shipping quotes use catch-all only when no state-specific zone covers the state', () => {
  assert.deepEqual(quoteShippingRates(settings, { state: 'Lagos', city: 'Ikeja' }, 0).map((r) => r.id), ['national-courier']);
  const cityOnlyNoMatch = { ...settings, zones: [settings.zones[0], settings.zones[2]] };
  assert.deepEqual(quoteShippingRates(cityOnlyNoMatch, { state: 'Osun', city: 'Ede' }, 0), []);
  assert.deepEqual(quoteShippingRates(settings, { state: 'Atlantis', city: 'Nowhere' }, 0).map((r) => r.id), ['national-courier']);
  assert.deepEqual(quoteShippingRates({ ...settings, zones: settings.zones.slice(0, 2) }, { state: 'Lagos' }, 0), []);
});

test('checkout selects only a rate currently applicable to the supplied address', () => {
  const selected = selectShippingRate(settings, { state: 'Osun', city: 'Ilesha' }, 1000, 'rider');
  assert.equal(selected.amount, 150000);
  assert.equal(selectShippingRate(settings, { state: 'Lagos', city: 'Ikeja' }, 1000, 'rider'), null);
  assert.equal(selectShippingRate(settings, { state: 'Osun', city: 'Ilesha' }, 1000, 'unknown'), null);
});

test('shipping settings reject invalid amounts, ETA ranges, and duplicate rate identifiers', () => {
  assert.throws(() => normalizeShippingSettings({ ...settings, zones: [{ ...settings.zones[0], rates: [{ ...settings.zones[0].rates[0], amount: 1.5 }] }] }));
  assert.throws(() => normalizeShippingSettings({ ...settings, zones: [{ ...settings.zones[0], rates: [{ ...settings.zones[0].rates[0], etaDays: [4, 2] }] }] }));
  assert.throws(() => normalizeShippingSettings({ ...settings, zones: [settings.zones[0], { ...settings.zones[1], rates: [{ ...settings.zones[1].rates[0], id: 'rider' }] }] }));
});

test('shipping totals use integer kobo and exactly add delivery to the Paystack order total', () => {
  assert.deepEqual(shippingTotals(1250000, 150000), {
    subtotal: 1250000,
    discountTotal: 0,
    shippingTotal: 150000,
    taxTotal: 0,
    total: 1400000,
  });
  assert.throws(() => shippingTotals(Number.MAX_SAFE_INTEGER, 1), /safe integer/);
});
