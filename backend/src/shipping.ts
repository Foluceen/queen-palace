export interface ShippingRateSetting {
  id: string;
  label: string;
  description: string;
  amount: number;
  etaDays: [number, number];
  freeOver: number | null;
}

export interface ShippingZoneSetting {
  id: string;
  name: string;
  states: string[];
  cities: string[];
  rates: ShippingRateSetting[];
}

export interface ShippingSettings {
  zones: ShippingZoneSetting[];
  processingDays: [number, number];
}

export const EMPTY_SHIPPING_SETTINGS: ShippingSettings = { zones: [], processingDays: [1, 3] };

export function normalizeShippingSettingsOrEmpty(value: unknown): ShippingSettings {
  return value === null || value === undefined ? EMPTY_SHIPPING_SETTINGS : normalizeShippingSettings(value);
}

export interface ShippingTotals {
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
}

export function shippingTotals(subtotalKobo: number, shippingKobo: number): ShippingTotals {
  if (!Number.isSafeInteger(subtotalKobo) || subtotalKobo < 0 || !Number.isSafeInteger(shippingKobo) || shippingKobo < 0) {
    throw new Error('Invalid amount in kobo');
  }
  const total = subtotalKobo + shippingKobo;
  if (!Number.isSafeInteger(total)) throw new Error('Total exceeds the safe integer range');
  return { subtotal: subtotalKobo, discountTotal: 0, shippingTotal: shippingKobo, taxTotal: 0, total };
}

export interface ShippingQuoteRate {
  id: string;
  label: string;
  description: string;
  amount: number;
  currency: 'NGN';
  etaDays: [number, number];
  estimatedDays: string;
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, field: string, maxLength = 160): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new Error(`Invalid ${field}`);
  }
  return value.trim();
}

function stringList(value: unknown, field: string, allowEmptyItem = false): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim().length > 120 || (!allowEmptyItem && !item.trim()))) {
    throw new Error(`Invalid ${field}`);
  }
  return value.map((item) => item.trim());
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(`Invalid ${field}`);
  return Number(value);
}

function dayRange(value: unknown, field: string): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) throw new Error(`Invalid ${field}`);
  const min = nonNegativeInteger(value[0], `${field} minimum`);
  const max = nonNegativeInteger(value[1], `${field} maximum`);
  if (min > max || max > 365) throw new Error(`Invalid ${field}`);
  return [min, max];
}

export function normalizeShippingSettings(value: unknown): ShippingSettings {
  if (!object(value) || !Array.isArray(value.zones)) throw new Error('Invalid shipping settings');
  const processingDays = dayRange(value.processingDays, 'processingDays');
  const zoneIds = new Set<string>();
  const rateIds = new Set<string>();
  const zones = value.zones.map((rawZone, zoneIndex): ShippingZoneSetting => {
    if (!object(rawZone) || !Array.isArray(rawZone.rates)) throw new Error(`Invalid shipping zone ${zoneIndex + 1}`);
    const id = text(rawZone.id, 'zone id');
    if (zoneIds.has(id)) throw new Error('Duplicate shipping zone id');
    zoneIds.add(id);
    const rates = rawZone.rates.map((rawRate, rateIndex): ShippingRateSetting => {
      if (!object(rawRate)) throw new Error(`Invalid shipping rate ${rateIndex + 1}`);
      const rateId = text(rawRate.id, 'rate id');
      if (rateIds.has(rateId)) throw new Error('Duplicate shipping rate id');
      rateIds.add(rateId);
      const amount = nonNegativeInteger(rawRate.amount, 'rate amount in kobo');
      const freeOver = rawRate.freeOver === null ? null : nonNegativeInteger(rawRate.freeOver, 'free-shipping threshold in kobo');
      return {
        id: rateId,
        label: text(rawRate.label, 'rate label'),
        description: typeof rawRate.description === 'string' ? rawRate.description.trim().slice(0, 1000) : '',
        amount,
        etaDays: dayRange(rawRate.etaDays, 'rate etaDays'),
        freeOver,
      };
    });
    return {
      id,
      name: text(rawZone.name, 'zone name'),
      states: stringList(rawZone.states, 'zone states'),
      cities: stringList(rawZone.cities, 'zone cities'),
      rates,
    };
  });
  return { zones, processingDays };
}

function formatEta([min, max]: [number, number]): string {
  if (min === max) return `${min} business ${min === 1 ? 'day' : 'days'}`;
  return `${min}-${max} business days`;
}

export function quoteShippingRates(
  input: unknown,
  address: { state?: unknown; city?: unknown },
  subtotalKobo: number,
): ShippingQuoteRate[] {
  const settings = normalizeShippingSettings(input);
  if (!Number.isSafeInteger(subtotalKobo) || subtotalKobo < 0) throw new Error('Invalid cart subtotal');
  const state = typeof address?.state === 'string' ? address.state.trim().toLocaleLowerCase() : '';
  const city = typeof address?.city === 'string' ? address.city.trim().toLocaleLowerCase() : '';
  if (!state) return [];

  const stateZones = settings.zones.filter((zone) => zone.states.some((candidate) => candidate.toLocaleLowerCase() === state));
  const cityZone = stateZones.find((zone) => zone.cities.length > 0 && city !== '' && zone.cities.some((candidate) => city.includes(candidate.toLocaleLowerCase())));
  const stateZone = stateZones.find((zone) => zone.cities.length === 0);
  let zone = cityZone ?? stateZone;

  // A city-restricted zone covers the state for delivery purposes. Do not let a
  // catch-all zone accidentally offer delivery to an unsupported city there.
  if (!zone && stateZones.length === 0) zone = settings.zones.find((candidate) => candidate.states.length === 0);
  if (!zone) return [];

  return zone.rates.map((rate) => {
    const amount = rate.freeOver !== null && subtotalKobo >= rate.freeOver ? 0 : rate.amount;
    return {
      id: rate.id,
      label: rate.label,
      description: rate.description,
      amount,
      currency: 'NGN',
      etaDays: [...rate.etaDays] as [number, number],
      estimatedDays: formatEta(rate.etaDays),
    };
  });
}

export function selectShippingRate(
  settings: unknown,
  address: { state?: unknown; city?: unknown },
  subtotalKobo: number,
  rateId: string,
): ShippingQuoteRate | null {
  return quoteShippingRates(settings, address, subtotalKobo).find((rate) => rate.id === rateId) ?? null;
}
