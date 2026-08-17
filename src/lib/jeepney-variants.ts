import {
  distanceAlongPathKm,
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
      progress: distanceAlongPathKm(path, {
        lat: Number(stop.latitude),
        lng: Number(stop.longitude),
      }),
    }))
    .sort((a, b) => a.progress - b.progress || a.stop.position - b.stop.position)
    .map((entry) => entry.stop);
}
