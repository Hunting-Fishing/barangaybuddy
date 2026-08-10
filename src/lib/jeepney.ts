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

/* ------------------------------------------------------------------ */
/* Route tracking, analytics and traffic congestion                     */
/* ------------------------------------------------------------------ */

/** Metres between recorded GPS points while "Track my route" is running. */
export const TRACK_MIN_METRES = 40;
/** Ignore GPS fixes worse than this accuracy (metres). */
export const TRACK_MAX_ACCURACY_M = 60;
/** Length of a congestion segment along the route. */
export const SEGMENT_KM = 0.25;

function perpendicularKm(point: LatLng, a: LatLng, b: LatLng): number {
  const x0 = point.lng * Math.cos((point.lat * Math.PI) / 180);
  const y0 = point.lat;
  const x1 = a.lng * Math.cos((a.lat * Math.PI) / 180);
  const y1 = a.lat;
  const x2 = b.lng * Math.cos((b.lat * Math.PI) / 180);
  const y2 = b.lat;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const denom = Math.hypot(dx, dy);
  const degKm = 111.32;
  if (denom === 0) return Math.hypot(x0 - x1, y0 - y1) * degKm;
  return (Math.abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / denom) * degKm;
}

/** Douglas–Peucker simplification. `toleranceM` in metres. */
export function simplifyPath(path: LatLng[], toleranceM = 25): LatLng[] {
  if (path.length < 3) return path.slice();
  const tolKm = toleranceM / 1000;
  const keep = new Array<boolean>(path.length).fill(false);
  keep[0] = true;
  keep[path.length - 1] = true;
  const stack: [number, number][] = [[0, path.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let maxDist = 0;
    let index = -1;
    for (let i = start + 1; i < end; i += 1) {
      const d = perpendicularKm(path[i]!, path[start]!, path[end]!);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index !== -1 && maxDist > tolKm) {
      keep[index] = true;
      stack.push([start, index], [index, end]);
    }
  }
  return path.filter((_, i) => keep[i]);
}

/** Which congestion segment a point falls into. */
export function segmentIndexForPoint(path: LatLng[], point: LatLng): number {
  if (path.length < 2) return 0;
  return Math.max(0, Math.floor(distanceAlongPathKm(path, point) / SEGMENT_KM));
}

export function segmentCount(path: LatLng[]): number {
  return Math.max(1, Math.ceil(pathLengthKm(path) / SEGMENT_KM));
}

export type SegmentSpeed = { segment_index: number; hour: number; avg_speed_kph: number | null };

export type CongestionLevel = "free" | "slow" | "heavy" | "unknown";

export const CONGESTION_COLOURS: Record<CongestionLevel, string> = {
  free: "#16a34a",
  slow: "#f59e0b",
  heavy: "#dc2626",
  unknown: "#94a3b8",
};

export const CONGESTION_LABELS: Record<CongestionLevel, string> = {
  free: "Free flowing",
  slow: "Slow moving",
  heavy: "Heavy traffic",
  unknown: "No data yet",
};

/** Grade a segment speed against free-flow jeepney speed. */
export function congestionLevel(speedKph: number | null | undefined): CongestionLevel {
  if (speedKph === null || speedKph === undefined || !Number.isFinite(speedKph)) return "unknown";
  if (speedKph >= 22) return "free";
  if (speedKph >= 12) return "slow";
  return "heavy";
}

/** Build a segment -> speed lookup for one hour of the day. */
export function segmentSpeedMap(rows: SegmentSpeed[], hour: number): Map<number, number> {
  const map = new Map<number, number>();
  rows.forEach((row) => {
    if (row.hour !== hour) return;
    const speed = Number(row.avg_speed_kph);
    if (Number.isFinite(speed) && speed > 0) map.set(row.segment_index, speed);
  });
  return map;
}

/**
 * ETA that walks the route segment by segment using measured speeds for the
 * current hour, falling back to the flat estimate when there is no data.
 */
export function etaMinutesWithTraffic(
  path: LatLng[],
  from: LatLng,
  to: LatLng,
  speedKph: number | null | undefined,
  speeds: Map<number, number>,
): number | null {
  if (!speeds.size) return etaMinutes(path, from, to, speedKph);
  if (path.length < 2) return null;
  const a = distanceAlongPathKm(path, from);
  const b = distanceAlongPathKm(path, to);
  if (b - a <= 0) return null;
  const fallback = Math.min(45, Math.max(10, speedKph && speedKph > 3 ? speedKph : 18));
  let minutes = 0;
  for (let km = a; km < b; km += SEGMENT_KM) {
    const chunk = Math.min(SEGMENT_KM, b - km);
    const speed = speeds.get(Math.floor(km / SEGMENT_KM)) ?? fallback;
    minutes += (chunk / Math.min(45, Math.max(5, speed))) * 60;
  }
  return Math.max(1, Math.round(minutes));
}

/* ---------------------------- Analytics --------------------------- */

export type StatBucketType = "hour_dow" | "month" | "holiday";

export type RouteStat = {
  bucket_type: StatBucketType;
  bucket_key: string;
  ping_count: number;
  trip_count: number;
  avg_speed_kph: number | null;
  busy_score: number | null;
};

export const HOLIDAY_LABELS: Record<string, string> = {
  new_year: "New Year",
  holy_week: "Holy Week",
  undas: "Undas (All Saints')",
  christmas: "Christmas season",
  fiesta: "Local fiesta",
  regular: "Regular days",
};

/** Philippine seasonal holiday bucket for a date (Manila time). */
export function phHolidayKey(date: Date): string {
  const manila = new Date(date.getTime() + (8 * 60 + date.getTimezoneOffset()) * 60000);
  const month = manila.getMonth() + 1;
  const day = manila.getDate();
  if (month === 12 && day >= 15) return "christmas";
  if (month === 1 && day <= 6) return "new_year";
  if (month === 11 && day <= 2) return "undas";
  if (month === 10 && day === 31) return "undas";
  if (month === 3 || month === 4) {
    // Holy Week floats; treat the late-March / mid-April window as the season.
    if ((month === 3 && day >= 20) || (month === 4 && day <= 20)) return "holy_week";
  }
  return "regular";
}

export function hourLabel(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}${suffix}`;
}

export function busyLabel(score: number): string {
  if (score >= 0.75) return "Very busy";
  if (score >= 0.5) return "Busy";
  if (score >= 0.25) return "Steady";
  return "Quiet";
}
