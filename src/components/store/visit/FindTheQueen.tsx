"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/store/cart/CartProvider";
import { STORE_LOCATION } from "@/lib/brand";
import { telHref, whatsappNumber } from "@/lib/contact";
import { prefersReducedMotion } from "@/lib/motion/anime";
import { formatDuration, haversineKm, roughDriveMinutes } from "@/lib/distance";
import type { StoreSettings } from "@/lib/types";

export { formatDuration, haversineKm, roughDriveMinutes };

type Leaflet = typeof import("leaflet");
type Distance = { km: number; minutes: number } | null;

/** Message the shop: WhatsApp when the store has a WhatsApp number, otherwise a text message. */
function messageShopHref(settings: StoreSettings, text: string): string | null {
  const wa = whatsappNumber(settings);
  if (wa) return `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;
  const tel = telHref(settings.phone);
  return tel ? `sms:${tel.slice(4)}?&body=${encodeURIComponent(text)}` : null;
}

const CROWN = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M3 8.5l4.2 3.3L12 5l4.8 6.8L21 8.5l-1.8 9.5H4.8L3 8.5zm2.2 11h13.6v1.5H5.2z"/></svg>`;

/**
 * "Find the Queen": a dark map that flies from Nigeria down to the shop when it comes into view,
 * a one-tap "how far am I?", a WhatsApp message to send the location to a driver, and an
 * "I'm coming to try these on" message that lists what's in the visitor's bag so the shop can
 * have it ready. The visitor's location never leaves their phone.
 */
export function FindTheQueen({ settings, compact = false }: { settings: StoreSettings; compact?: boolean }) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ L: Leaflet; map: import("leaflet").Map } | null>(null);
  const routeRef = useRef<import("leaflet").Layer[]>([]);
  const [mapState, setMapState] = useState<"idle" | "ready" | "failed">("idle");
  const [distance, setDistance] = useState<Distance>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const { cart } = useCart();
  const shop = { lat: STORE_LOCATION.lat, lng: STORE_LOCATION.lng };

  // Load the map library only when the section is close to the screen, then fly in.
  useEffect(() => {
    const el = mapEl.current;
    if (!el) return;
    let cancelled = false;
    let flown = false;
    const start = async () => {
      try {
        const L = await import("leaflet");
        if (cancelled || mapRef.current) return;
        const calm = prefersReducedMotion();
        const map = L.map(el, {
          center: calm ? [shop.lat, shop.lng] : [9.08, 8.68],
          zoom: calm ? 16 : 6,
          zoomControl: true,
          scrollWheelZoom: false,
          attributionControl: true,
        });
        map.attributionControl.setPrefix(false);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
          className: "ftq__tiles",
        }).addTo(map);
        const icon = L.divIcon({ className: "ftq__pin", html: `<span class="ftq__pulse"></span><span class="ftq__crown">${CROWN}</span>`, iconSize: [44, 44], iconAnchor: [22, 22] });
        L.marker([shop.lat, shop.lng], { icon, title: settings.name, keyboard: false }).addTo(map);
        mapRef.current = { L, map };
        setMapState("ready");
        const fly = () => {
          if (flown || calm) return;
          flown = true;
          map.flyTo([shop.lat, shop.lng], 16, { duration: 3.4, easeLinearity: 0.15 });
        };
        const io = new IntersectionObserver(([e]) => e?.isIntersecting && (fly(), io.disconnect()), { threshold: 0.45 });
        io.observe(el);
      } catch {
        if (!cancelled) setMapState("failed");
      }
    };
    const near = new IntersectionObserver(([e]) => e?.isIntersecting && (near.disconnect(), void start()), { rootMargin: "600px 0px" });
    near.observe(el);
    return () => {
      cancelled = true;
      near.disconnect();
      mapRef.current?.map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const howFar = () => {
    setLocError(null);
    if (!("geolocation" in navigator)) return setLocError("Your browser can't share your location. Use Get directions instead.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const km = haversineKm(me, shop);
        setDistance({ km, minutes: roughDriveMinutes(km) });
        const m = mapRef.current;
        if (m && km < 300) {
          routeRef.current.forEach((l) => l.remove());
          const you = m.L.circleMarker([me.lat, me.lng], { radius: 7, color: "#fff", weight: 2, fillColor: "#ff3dbb", fillOpacity: 1 }).addTo(m.map).bindTooltip("You", { permanent: true, direction: "top", className: "ftq__you" });
          const line = m.L.polyline([[me.lat, me.lng], [shop.lat, shop.lng]], { color: "#ff3dbb", weight: 3, dashArray: "6 8", opacity: 0.9 }).addTo(m.map);
          routeRef.current = [you, line];
          m.map.flyToBounds(line.getBounds(), { padding: [48, 48], duration: prefersReducedMotion() ? 0 : 1.6 });
        }
      },
      (err) => {
        setLocating(false);
        setLocError(err.code === err.PERMISSION_DENIED ? "Location is off for this site. Use Get directions instead, or allow location and try again." : "We couldn't find your location just now. Try again, or use Get directions.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const items = (cart?.lines ?? []).map((l) => `• ${l.productTitle}${l.quantity > 1 ? ` x${l.quantity}` : ""}`);
  const comingText = items.length
    ? `Hi ${settings.name}, I'm coming to the store to try these on. Please have them ready:\n${items.join("\n")}${distance ? `\nI'm about ${formatDuration(distance.minutes)} away.` : ""}`
    : `Hi ${settings.name}, I'm coming to the store${distance ? ` (about ${formatDuration(distance.minutes)} away)` : ""}. Please be expecting me.`;
  const comingHref = messageShopHref(settings, comingText);
  const address = settings.address ?? "Ijoka, Ilesha, Osun State";
  const where = address.includes(STORE_LOCATION.landmark) ? address : `${address} (beside ${STORE_LOCATION.landmark})`;
  const driverText = `Please take me to ${settings.name}: ${where}.\nMap: ${STORE_LOCATION.mapsUrl}${settings.phone ? `\nShop phone: ${settings.phone}` : ""}`;
  const driverHref = `https://wa.me/?text=${encodeURIComponent(driverText)}`;
  const far = distance && distance.km >= 150;

  return (
    <div className={`ftq${compact ? " ftq--compact" : ""}`}>
      {/* The map element's own className must never change: Leaflet adds its classes to it. */}
      <div className={`ftq__map-wrap${mapState === "ready" ? " is-ready" : ""}`}>
        <div ref={mapEl} className="ftq__map" role="region" aria-label={`Map showing ${settings.name} in Ilesa`} />
        {mapState !== "ready" ? (
          <div className="ftq__map-fallback" aria-hidden={mapState !== "failed"}>
            {mapState === "failed" ? "The map couldn't load. Use Get directions below." : "Loading map…"}
          </div>
        ) : null}
        <a className="ftq__open" href={STORE_LOCATION.mapsUrl} target="_blank" rel="noopener noreferrer">
          Open in Google Maps
        </a>
      </div>

      <div className="ftq__panel">
        {!compact ? (
          <>
            <p className="lux-kicker">Visit the store</p>
            <h2 id="visit-title" className="ftq__title">
              Find the <span className="script">Queen</span>
            </h2>
          </>
        ) : null}
        <address className="ftq__address">{settings.address}</address>
        <p className="ftq__landmark">
          <span aria-hidden>📍</span> Look for <strong>{STORE_LOCATION.landmark}</strong>. We&apos;re right beside it.
        </p>

        <div className="ftq__distance" aria-live="polite">
          {distance ? (
            far ? (
              <p>
                You&apos;re about <strong>{Math.round(distance.km)} km</strong> away. That&apos;s a trip: we can <Link href="/shipping">send your order to you</Link> instead.
              </p>
            ) : (
              <p>
                You&apos;re about <strong>{distance.km < 1 ? `${Math.round(distance.km * 1000)} m` : `${distance.km.toFixed(1)} km`}</strong> away, around <strong>{formatDuration(distance.minutes)}</strong> by car.
              </p>
            )
          ) : (
            <button type="button" className="ftq__howfar" onClick={howFar} disabled={locating}>
              {locating ? <span className="spinner" aria-hidden /> : <span aria-hidden>➤</span>} {locating ? "Finding you…" : "How far am I?"}
            </button>
          )}
          {locError ? <p className="small ftq__error">{locError}</p> : null}
          {!distance && !locError ? <p className="small muted">Your location stays on your phone.</p> : null}
        </div>

        <div className="ftq__actions">
          <a href={STORE_LOCATION.mapsUrl} className="btn btn--blush" target="_blank" rel="noopener noreferrer">
            Get directions
          </a>
          <a href={driverHref} className="btn btn--ghost lux-btn-ghost" target="_blank" rel="noopener noreferrer">
            Send to my driver
          </a>
        </div>

        {comingHref ? (
          <a href={comingHref} className="ftq__coming" target="_blank" rel="noopener noreferrer">
            <span className="ftq__coming-title">{items.length ? `I'm coming to try ${items.length === 1 ? "this" : `these ${items.length}`} on` : "Tell us you're coming"}</span>
            <span className="small">{items.length ? "We'll have the wigs in your bag ready when you arrive." : "Add wigs to your bag first and we'll have them ready for you."}</span>
          </a>
        ) : null}
      </div>
    </div>
  );
}
