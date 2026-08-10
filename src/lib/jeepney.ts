// Shared client-safe helpers for the Jeepney Planner.

export type LatLng = { lat: number; lng: number };

export type JeepneyRouteStatus = "draft" | "pending" | "published" | "suspended";

export type JeepneyRoute = {
  id: string;
  operator_id: string;
  name: string;
  code: string | null;
  slug: string;
  city_code: string | null;
  barangay_code: string | null;
  fare_php: number | null;
  fare_note: string | null;
  path: LatLng[];
  colour: string;
  status: JeepneyRouteStatus;
  first_run: string | null;
  last_run: string | null;
  last_pickup: string | null;
  trips_per_day: number | null;
  operating_days: string[];
  avg_trip_minutes: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type JeepneyStop = {
  id: string;
  route_id: string;
  name: string;
  position: number;
  latitude: number;
  longitude: number;
  offset_minutes: number | null;
};

export type JeepneyPosition = {
  id: string;
  route_id: string;
  vehicle_id: string | null;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed_kph: number | null;
  recorded_at: string;
};

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const ROUTE_COLOURS = [
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#0ea5e9",
  "#84cc16",
];

export const LIVE_WINDOW_MS = 5 * 60 * 1000;

export function isLive(recordedAt: string | null | undefined): boolean {
  if (!recordedAt) return false;
  return Date.now() - new Date(recordedAt).getTime() < LIVE_WINDOW_MS;
}

export function parsePath(value: unknown): LatLng[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((p: any) => ({ lat: Number(p?.lat), lng: Number(p?.lng) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pathLengthKm(path: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) total += haversineKm(path[i - 1]!, path[i]!);
  return total;
}

/** Distance (km) travelled along the path up to the point nearest `point`. */
export function distanceAlongPathKm(path: LatLng[], point: LatLng): number {
  if (path.length < 2) return 0;
  let best = Infinity;
  let bestDistance = 0;
  let running = 0;
  for (let i = 0; i < path.length; i += 1) {
    const node = path[i]!;
    const d = haversineKm(node, point);
    if (d < best) {
      best = d;
      bestDistance = running;
    }
    if (i + 1 < path.length) running += haversineKm(node, path[i + 1]!);
  }
  return bestDistance;
}

export function nearestPointIndex(path: LatLng[], point: LatLng): number {
  let best = Infinity;
  let index = 0;
  path.forEach((node, i) => {
    const d = haversineKm(node, point);
    if (d < best) {
      best = d;
      index = i;
    }
  });
  return index;
}

/** Rough ETA in minutes for a jeepney at `from` to reach `to` along the route. */
export function etaMinutes(
  path: LatLng[],
  from: LatLng,
  to: LatLng,
  speedKph: number | null | undefined,
): number | null {
  if (path.length < 2) return null;
  const a = distanceAlongPathKm(path, from);
  const b = distanceAlongPathKm(path, to);
  const km = b - a;
  if (km <= 0) return null;
  const speed = Math.min(45, Math.max(10, speedKph && speedKph > 3 ? speedKph : 18));
  return Math.max(1, Math.round((km / speed) * 60));
}

export function etaRangeLabel(minutes: number): string {
  const low = Math.max(1, minutes - Math.max(1, Math.round(minutes * 0.25)));
  const high = minutes + Math.max(2, Math.round(minutes * 0.25));
  return `${low}–${high} min`;
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const [h, m] = value.split(":");
  const hour = Number(h);
  if (!Number.isFinite(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${(m ?? "00").padStart(2, "0")} ${suffix}`;
}

export function headwayLabel(route: {
  trips_per_day: number | null;
  first_run: string | null;
  last_run: string | null;
}): string | null {
  if (!route.trips_per_day || !route.first_run || !route.last_run) return null;
  const toMinutes = (v: string) => {
    const [h, m] = v.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  let span = toMinutes(route.last_run) - toMinutes(route.first_run);
  if (span <= 0) span += 24 * 60;
  const gap = Math.round(span / Math.max(1, route.trips_per_day));
  if (!Number.isFinite(gap) || gap <= 0) return null;
  return `every ~${gap} min`;
}

export function formatPhpAmount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `₱${Number(value).toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
}

export function jeepneySlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${base || "route"}-${Math.random().toString(36).slice(2, 7)}`;
}

export const JEEPNEY_MONTHLY_PHP = 100;
export const JEEPNEY_PRICE_ID = "jeepney_route_monthly";
