/* eslint-disable @typescript-eslint/no-explicit-any -- route variants are migration-backed ahead of regenerated Supabase types. */
import {
  SEGMENT_KM,
  haversineKm,
  parsePath,
  type JeepneyPosition,
  type JeepneyStop,
  type LatLng,
} from "@/lib/jeepney";

export type RouteDirection = "outbound" | "inbound" | "loop" | "custom";

export type JeepneyRouteVariant = {
  id: string;
  route_id: string;
  code: string;
  name: string;
  direction: RouteDirection;
  path: LatLng[];
  is_default: boolean;
  active: boolean;
};

export type VariantAwarePosition = JeepneyPosition & {
  trip_id?: string | null;
  route_variant_id?: string | null;
};

export type PathProjection = {
  alongKm: number;
  offRouteKm: number;
  segmentIndex: number;
  segmentFraction: number;
};

export function directionLabel(direction: RouteDirection) {
  if (direction === "outbound") return "Outbound";
  if (direction === "inbound") return "Inbound / return";
  if (direction === "loop") return "Loop";
  return "Custom direction";
}

export function parseRouteVariant(row: any): JeepneyRouteVariant {
  return {
    id: String(row.id),
    route_id: String(row.route_id),
    code: String(row.code ?? "variant"),
    name: String(row.name ?? "Route direction"),
    direction: (["outbound", "inbound", "loop", "custom"].includes(row.direction)
      ? row.direction
      : "custom") as RouteDirection,
    path: parsePath(row.path),
    is_default: Boolean(row.is_default),
    active: row.active !== false,
  };
}

export function variantForPosition(
  position: JeepneyPosition,
  variants: JeepneyRouteVariant[],
): JeepneyRouteVariant | null {
  const variantId = (position as VariantAwarePosition).route_variant_id ?? null;
  if (variantId) {
    const exact = variants.find((variant) => variant.id === variantId);
    if (exact) return exact;
  }
  return variants.find((variant) => variant.is_default) ?? variants[0] ?? null;
}

export function pathForPosition(
  position: JeepneyPosition,
  variants: JeepneyRouteVariant[],
  fallback: LatLng[],
): LatLng[] {
  const variant = variantForPosition(position, variants);
  return variant?.path?.length && variant.path.length >= 2 ? variant.path : fallback;
}

/**
 * Project a GPS point onto the nearest point of the route polyline and return its
 * cumulative distance along that polyline. The legacy helper snaps to the nearest
 * path NODE, which can shift ETA substantially when mapped segments are long.
 */
export function projectDistanceAlongPathKm(path: LatLng[], point: LatLng): PathProjection | null {
  if (path.length < 2) return null;

  let cumulativeKm = 0;
  let best: PathProjection | null = null;

  for (let index = 0; index < path.length - 1; index += 1) {
    const a = path[index]!;
    const b = path[index + 1]!;
    const segmentKm = haversineKm(a, b);
    if (segmentKm <= 0) continue;

    // Equirectangular projection is sufficiently accurate at individual road
    // segment scale and avoids treating latitude/longitude degrees as equal axes.
    const referenceLatRad = (((a.lat + b.lat + point.lat) / 3) * Math.PI) / 180;
    const kmPerDegreeLat = 111.32;
    const kmPerDegreeLng = Math.max(0.0001, 111.32 * Math.cos(referenceLatRad));

    const bx = (b.lng - a.lng) * kmPerDegreeLng;
    const by = (b.lat - a.lat) * kmPerDegreeLat;
    const px = (point.lng - a.lng) * kmPerDegreeLng;
    const py = (point.lat - a.lat) * kmPerDegreeLat;
    const lengthSquared = bx * bx + by * by;
    const fraction = lengthSquared > 0
      ? Math.max(0, Math.min(1, (px * bx + py * by) / lengthSquared))
      : 0;
    const projectedX = bx * fraction;
    const projectedY = by * fraction;
    const offRouteKm = Math.hypot(px - projectedX, py - projectedY);

    const candidate: PathProjection = {
      alongKm: cumulativeKm + segmentKm * fraction,
      offRouteKm,
      segmentIndex: index,
      segmentFraction: fraction,
    };

    if (!best || candidate.offRouteKm < best.offRouteKm) best = candidate;
    cumulativeKm += segmentKm;
  }

  return best;
}

/**
 * Direction-aware ETA using true segment projection. Congestion segment speeds are
 * optional; callers should only pass a speed map keyed to this exact geometry.
 */
export function etaMinutesProjected(
  path: LatLng[],
  from: LatLng,
  to: LatLng,
  speedKph: number | null | undefined,
  speeds: Map<number, number> = new Map<number, number>(),
): number | null {
  const fromProjection = projectDistanceAlongPathKm(path, from);
  const toProjection = projectDistanceAlongPathKm(path, to);
  if (!fromProjection || !toProjection) return null;

  const remainingKm = toProjection.alongKm - fromProjection.alongKm;
  if (remainingKm <= 0.02) return null;

  const fallback = Math.min(45, Math.max(10, speedKph && speedKph > 3 ? speedKph : 18));
  if (!speeds.size) return Math.max(1, Math.round((remainingKm / fallback) * 60));

  let minutes = 0;
  for (let km = fromProjection.alongKm; km < toProjection.alongKm; km += SEGMENT_KM) {
    const chunk = Math.min(SEGMENT_KM, toProjection.alongKm - km);
    const speed = speeds.get(Math.floor(km / SEGMENT_KM)) ?? fallback;
    minutes += (chunk / Math.min(45, Math.max(5, speed))) * 60;
  }
  return Math.max(1, Math.round(minutes));
}

/**
 * Sort shared route stops by their physical progress along one variant geometry.
 * This avoids assuming the outbound database `position` order is also correct for
 * an inbound/return path. Variant-specific stop membership can further refine this
 * list when the operator configures different pickup points per direction.
 */
export function stopsOrderedAlongPath(stops: JeepneyStop[], path: LatLng[]): JeepneyStop[] {
  if (path.length < 2) return stops.slice().sort((a, b) => a.position - b.position);
  return stops
    .map((stop) => ({
      stop,
      progress:
        projectDistanceAlongPathKm(path, {
          lat: Number(stop.latitude),
          lng: Number(stop.longitude),
        })?.alongKm ?? Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => a.progress - b.progress || a.stop.position - b.stop.position)
    .map((entry) => entry.stop);
}
