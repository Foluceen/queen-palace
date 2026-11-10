/** Straight-line distance in km. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Rough travel time by car: roads are ~1.35x the straight line; town traffic ~25 km/h close in,
 * highway ~60 km/h for longer trips. Shown as an estimate ("about").
 */
export function roughDriveMinutes(km: number): number {
  const road = km * 1.35;
  const speed = road < 15 ? 28 : road < 60 ? 60 : 70;
  return Math.max(3, Math.round((road / speed) * 60));
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = Math.round((min % 60) / 5) * 5;
  return m ? `${h} h ${m} min` : `${h} h`;
}
