import { isLive, type JeepneyPosition } from "@/lib/jeepney";

/**
 * Live positions are keyed by a stable broadcasting identity, not by route.
 * This is what allows several vehicles on the same route to coexist in memory.
 *
 * Legacy phone broadcasts may not yet have a vehicle_id. Those continue to use
 * one fallback stream per route until the operator flow assigns a vehicle/trip.
 */
export type JeepneyLivePositions = Record<string, JeepneyPosition>;

export function livePositionKey(position: JeepneyPosition): string {
  return position.vehicle_id
    ? `vehicle:${position.vehicle_id}`
    : `route:${position.route_id}:unassigned`;
}

export function mergeLivePosition(
  current: JeepneyLivePositions,
  position: JeepneyPosition,
): JeepneyLivePositions {
  if (!position?.route_id || !isLive(position.recorded_at)) return current;

  const key = livePositionKey(position);
  const existing = current[key];
  if (
    existing &&
    new Date(existing.recorded_at).getTime() >= new Date(position.recorded_at).getTime()
  ) {
    return current;
  }

  return { ...current, [key]: position };
}

export function buildLatestLivePositions(rows: JeepneyPosition[]): JeepneyLivePositions {
  const latest: JeepneyLivePositions = {};

  for (const position of rows) {
    if (!position?.route_id || !isLive(position.recorded_at)) continue;
    const key = livePositionKey(position);
    const existing = latest[key];
    if (
      !existing ||
      new Date(position.recorded_at).getTime() > new Date(existing.recorded_at).getTime()
    ) {
      latest[key] = position;
    }
  }

  return latest;
}

export function livePositionsForRoute(
  live: JeepneyLivePositions,
  routeId: string,
): JeepneyPosition[] {
  return Object.values(live)
    .filter((position) => position.route_id === routeId && isLive(position.recorded_at))
    .sort(
      (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
    );
}

export function pruneStaleLivePositions(
  live: JeepneyLivePositions,
): JeepneyLivePositions {
  return Object.fromEntries(
    Object.entries(live).filter(([, position]) => isLive(position.recorded_at)),
  );
}
