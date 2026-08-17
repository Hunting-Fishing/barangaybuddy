/* eslint-disable @typescript-eslint/no-explicit-any, prettier/prettier -- route-variant columns are migration-backed ahead of regenerated Supabase types. */
import { useEffect, useMemo, useState } from "react";
import { Locate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  etaRangeLabel,
  haversineKm,
  type JeepneyPosition,
  type JeepneyRoute,
  type JeepneyStop,
  type LatLng,
} from "@/lib/jeepney";
import {
  directionLabel,
  etaMinutesProjected,
  parseRouteVariant,
  parseRouteVariantStop,
  pathForPosition,
  projectDistanceAlongPathKm,
  stopsForVariant,
  variantForPosition,
  type JeepneyRouteVariant,
  type JeepneyRouteVariantStop,
} from "@/lib/jeepney-variants";

type RouteWithStops = JeepneyRoute & { stops: JeepneyStop[] };

type ArrivalCandidate = {
  position: JeepneyPosition;
  variant: JeepneyRouteVariant | null;
  stop: JeepneyStop;
  distanceFromUserKm: number;
  eta: number;
};

function manilaHour() {
  const now = new Date();
  return new Date(now.getTime() + (8 * 60 + now.getTimezoneOffset()) * 60000).getHours();
}

export function JeepneyArrivalSummary({
  route,
  positions,
  userLocation,
  speeds,
  onLocate,
}: {
  route: RouteWithStops;
  positions: JeepneyPosition[];
  userLocation: LatLng | null;
  speeds: Map<number, number>;
  onLocate: () => void;
}) {
  const [variants, setVariants] = useState<JeepneyRouteVariant[]>([]);
  const [variantStops, setVariantStops] = useState<JeepneyRouteVariantStop[]>([]);
  const [variantSpeedMaps, setVariantSpeedMaps] = useState<Record<string, Map<number, number>>>({});
  const [vehicleLabels, setVehicleLabels] = useState<Record<string, string>>({});
  const currentHour = useMemo(manilaHour, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await (supabase as any)
        .from("jeepney_route_variants")
        .select("id,route_id,code,name,direction,path,is_default,active")
        .eq("route_id", route.id)
        .eq("active", true)
        .order("created_at", { ascending: true });
      if (cancelled) return;

      const nextVariants = (data ?? []).map(parseRouteVariant);
      setVariants(nextVariants);
      const variantIds = nextVariants.map((variant) => variant.id);
      if (!variantIds.length) {
        setVariantStops([]);
        setVariantSpeedMaps({});
        return;
      }

      const [membershipResult, speedResult] = await Promise.all([
        (supabase as any)
          .from("jeepney_route_variant_stops")
          .select("variant_id,stop_id,position")
          .in("variant_id", variantIds)
          .order("position", { ascending: true }),
        (supabase as any)
          .from("jeepney_variant_segment_stats")
          .select("route_variant_id,segment_index,hour,avg_speed_kph")
          .eq("route_id", route.id)
          .eq("hour", currentHour)
          .in("route_variant_id", variantIds),
      ]);
      if (cancelled) return;

      setVariantStops((membershipResult.data ?? []).map(parseRouteVariantStop));
      if (speedResult.error) {
        // Until the direction-aware analytics migration is deployed, canonical
        // ETA still uses the existing route-level speed map and other directions
        // safely fall back to live/default vehicle speed.
        setVariantSpeedMaps({});
        return;
      }

      const nextSpeedMaps: Record<string, Map<number, number>> = {};
      for (const row of speedResult.data ?? []) {
        if (!row.route_variant_id) continue;
        const speed = Number(row.avg_speed_kph);
        const index = Number(row.segment_index);
        if (!Number.isFinite(speed) || speed <= 0 || !Number.isInteger(index) || index < 0) continue;
        const map = nextSpeedMaps[String(row.route_variant_id)] ?? new Map<number, number>();
        map.set(index, speed);
        nextSpeedMaps[String(row.route_variant_id)] = map;
      }
      setVariantSpeedMaps(nextSpeedMaps);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentHour, route.id]);

  useEffect(() => {
    const ids = Array.from(
      new Set(positions.map((position) => position.vehicle_id).filter((value): value is string => Boolean(value))),
    );
    if (!ids.length) {
      setVehicleLabels({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from("jeepney_vehicles").select("id,label").in("id", ids);
      if (cancelled) return;
      setVehicleLabels(Object.fromEntries((data ?? []).map((vehicle) => [vehicle.id, vehicle.label])));
    })();
    return () => {
      cancelled = true;
    };
  }, [positions]);

  const nearestRouteStop = useMemo(() => {
    if (!userLocation || !route.stops.length) return null;
    return route.stops
      .map((stop) => ({
        stop,
        km: haversineKm(userLocation, {
          lat: Number(stop.latitude),
          lng: Number(stop.longitude),
        }),
      }))
      .sort((a, b) => a.km - b.km)[0] ?? null;
  }, [route.stops, userLocation]);

  const candidates = useMemo(() => {
    if (!userLocation) return [] as ArrivalCandidate[];

    return positions
      .map((position): ArrivalCandidate | null => {
        const variant = variantForPosition(position, variants);
        const path = pathForPosition(position, variants, route.path);
        if (path.length < 2) return null;

        const eligibleStops = stopsForVariant(route.stops, variant, variantStops, path);
        if (!eligibleStops.length) return null;

        const current = { lat: Number(position.latitude), lng: Number(position.longitude) };
        const currentProjection = projectDistanceAlongPathKm(path, current);
        if (!currentProjection) return null;

        const aheadStops = eligibleStops
          .map((stop) => {
            const point = { lat: Number(stop.latitude), lng: Number(stop.longitude) };
            const projection = projectDistanceAlongPathKm(path, point);
            return {
              stop,
              point,
              projection,
              distanceFromUserKm: haversineKm(userLocation, point),
            };
          })
          .filter(
            (entry) =>
              entry.projection && entry.projection.alongKm > currentProjection.alongKm + 0.02,
          )
          .sort((a, b) => a.distanceFromUserKm - b.distanceFromUserKm);

        const target = aheadStops[0];
        if (!target) return null;

        const historicalVariantSpeeds = variant ? variantSpeedMaps[variant.id] : undefined;
        const etaSpeeds = historicalVariantSpeeds ?? (variant?.is_default ? speeds : new Map<number, number>());
        const eta = etaMinutesProjected(path, current, target.point, position.speed_kph, etaSpeeds);
        if (eta === null) return null;

        return {
          position,
          variant,
          stop: target.stop,
          distanceFromUserKm: target.distanceFromUserKm,
          eta,
        };
      })
      .filter((candidate): candidate is ArrivalCandidate => Boolean(candidate))
      .sort((a, b) => a.eta - b.eta || a.distanceFromUserKm - b.distanceFromUserKm);
  }, [positions, route.path, route.stops, speeds, userLocation, variantSpeedMaps, variantStops, variants]);

  const best = candidates[0] ?? null;
  const bestUnit = best?.position.vehicle_id
    ? vehicleLabels[best.position.vehicle_id] || `Unit …${best.position.vehicle_id.slice(-6).toUpperCase()}`
    : "Live jeepney";

  return (
    <Card className="space-y-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Arrival</p>
        <Button size="sm" variant="outline" onClick={onLocate}>
          <Locate className="mr-1.5 h-4 w-4" /> Use my location
        </Button>
      </div>

      {!userLocation ? (
        <p className="text-xs text-muted-foreground">
          Share your location to rank live jeepneys by an eligible approaching stop on each unit's assigned direction.
        </p>
      ) : null}

      {userLocation && nearestRouteStop ? (
        <p className="text-sm">
          Nearest mapped stop: <strong>{nearestRouteStop.stop.name}</strong>{" "}
          <span className="text-muted-foreground">
            ({nearestRouteStop.km < 1
              ? `${Math.round(nearestRouteStop.km * 1000)} m`
              : `${nearestRouteStop.km.toFixed(1)} km`}{" "}
            away)
          </span>
        </p>
      ) : null}

      {userLocation && best ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-semibold text-emerald-950">
            {bestUnit} arriving in about {etaRangeLabel(best.eta)}
          </p>
          <p className="mt-0.5 text-xs text-emerald-800">
            {best.variant ? `${directionLabel(best.variant.direction)} · ` : ""}
            approaching {best.stop.name}
            {best.distanceFromUserKm < 1
              ? ` · stop ${Math.round(best.distanceFromUserKm * 1000)} m from you`
              : ` · stop ${best.distanceFromUserKm.toFixed(1)} km from you`}
          </p>
        </div>
      ) : null}

      {userLocation && positions.length > 0 && !best ? (
        <p className="text-xs text-muted-foreground">
          Live units are on this route, but none is currently approaching an eligible mapped stop near you on its assigned direction.
        </p>
      ) : null}

      {userLocation && positions.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No live jeepney on this route right now — use the schedule above.
        </p>
      ) : null}
    </Card>
  );
}
