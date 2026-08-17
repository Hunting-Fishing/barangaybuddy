import { useEffect, useState } from "react";
import { Bus, Clock3, Gauge, MapPin, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  distanceAlongPathKm,
  etaMinutesWithTraffic,
  etaRangeLabel,
  haversineKm,
  type JeepneyPosition,
  type JeepneyRoute,
  type JeepneyStop,
  type LatLng,
} from "@/lib/jeepney";
import {
  directionLabel,
  pathForPosition,
  stopsOrderedAlongPath,
  variantForPosition,
  type JeepneyRouteVariant,
} from "@/lib/jeepney-variants";

type RouteWithStops = JeepneyRoute & { stops: JeepneyStop[] };

type Props = {
  route: RouteWithStops;
  positions: JeepneyPosition[];
  variants: JeepneyRouteVariant[];
  userLocation: LatLng | null;
  speeds: Map<number, number>;
};

type VehicleRow = {
  position: JeepneyPosition;
  variant: JeepneyRouteVariant | null;
  targetStop: JeepneyStop | null;
  targetLabel: string;
  eta: number | null;
  passedTarget: boolean;
  usingNearestUserStop: boolean;
};

function unitLabel(position: JeepneyPosition, index: number, labels: Record<string, string>) {
  if (position.vehicle_id && labels[position.vehicle_id]) return labels[position.vehicle_id];
  return position.vehicle_id ? `Unit …${position.vehicle_id.slice(-6).toUpperCase()}` : `Live unit ${index + 1}`;
}

function updatedLabel(recordedAt: string) {
  const ageSeconds = Math.max(0, Math.round((Date.now() - new Date(recordedAt).getTime()) / 1000));
  if (ageSeconds < 60) return `${ageSeconds}s ago`;
  return `${Math.floor(ageSeconds / 60)}m ago`;
}

export function JeepneyLiveVehicleList({ route, positions, variants, userLocation, speeds }: Props) {
  const [vehicleLabels, setVehicleLabels] = useState<Record<string, string>>({});

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

  if (!positions.length) return null;

  const rows: VehicleRow[] = positions
    .map((position) => {
      const variant = variantForPosition(position, variants);
      const path = pathForPosition(position, variants, route.path);
      const orderedStops = stopsOrderedAlongPath(route.stops, path);
      const current = { lat: Number(position.latitude), lng: Number(position.longitude) };
      const currentDistance = distanceAlongPathKm(path, current);

      const nearestUserStop = userLocation && orderedStops.length
        ? orderedStops
            .map((stop) => ({
              stop,
              distance: haversineKm(userLocation, {
                lat: Number(stop.latitude),
                lng: Number(stop.longitude),
              }),
            }))
            .sort((a, b) => a.distance - b.distance)[0]?.stop ?? null
        : null;

      let targetStop = nearestUserStop;
      if (!targetStop) {
        targetStop =
          orderedStops.find((stop) => {
            const stopDistance = distanceAlongPathKm(path, {
              lat: Number(stop.latitude),
              lng: Number(stop.longitude),
            });
            return stopDistance > currentDistance + 0.05;
          }) ?? null;
      }

      if (!targetStop) {
        return {
          position,
          variant,
          targetStop: null,
          targetLabel: "End of mapped direction",
          eta: null,
          passedTarget: true,
          usingNearestUserStop: Boolean(nearestUserStop),
        };
      }

      const targetPoint = { lat: Number(targetStop.latitude), lng: Number(targetStop.longitude) };
      const targetDistance = distanceAlongPathKm(path, targetPoint);
      const passedTarget = targetDistance <= currentDistance + 0.05;

      // Existing congestion segment indexes are based on the canonical/default
      // route path. Do not apply them to a geometrically different inbound/custom
      // path until traffic analytics are variant-keyed.
      const variantSpeeds = variant?.is_default ? speeds : new Map<number, number>();
      const eta = passedTarget
        ? null
        : etaMinutesWithTraffic(path, current, targetPoint, position.speed_kph, variantSpeeds);

      return {
        position,
        variant,
        targetStop,
        targetLabel: nearestUserStop ? `Your nearest stop · ${targetStop.name}` : `Next · ${targetStop.name}`,
        eta,
        passedTarget,
        usingNearestUserStop: Boolean(nearestUserStop),
      };
    })
    .sort((a, b) => {
      if (a.eta !== null && b.eta !== null) return a.eta - b.eta;
      if (a.eta !== null) return -1;
      if (b.eta !== null) return 1;
      return new Date(b.position.recorded_at).getTime() - new Date(a.position.recorded_at).getTime();
    });

  const approaching = rows.filter((row) => row.eta !== null).length;

  return (
    <Card className="rounded-2xl border-blue-100 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-semibold text-slate-900">
            <Bus className="h-4 w-4 text-blue-600" /> Live jeepneys on this route
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {userLocation
              ? "Each unit is ranked using its own travel direction and the nearest mapped stop for that direction."
              : "Each unit uses its own outbound/inbound geometry to determine the next stop."}
          </p>
        </div>
        <Badge className="bg-emerald-600 text-white">
          <Radio className="mr-1 h-3 w-3" /> {positions.length} live
        </Badge>
      </div>

      <div className="mt-4 space-y-2">
        {rows.map((row, index) => (
          <div
            key={row.position.vehicle_id ?? row.position.id}
            className="grid gap-3 rounded-2xl border bg-white p-3 sm:grid-cols-[1fr_auto] sm:items-center"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-950">{unitLabel(row.position, index, vehicleLabels)}</p>
                {row.variant ? (
                  <Badge variant="outline" className="text-[10px]">
                    {directionLabel(row.variant.direction)}
                  </Badge>
                ) : null}
                {index === 0 && row.eta !== null ? <Badge variant="secondary" className="text-[10px]">Soonest</Badge> : null}
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {row.passedTarget && row.usingNearestUserStop
                  ? `Already passed ${row.targetStop?.name ?? "your stop"} on this direction`
                  : row.targetLabel}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> Updated {updatedLabel(row.position.recorded_at)}</span>
                {row.position.speed_kph !== null ? (
                  <span className="inline-flex items-center gap-1"><Gauge className="h-3 w-3" /> {Math.round(Number(row.position.speed_kph))} km/h</span>
                ) : null}
              </div>
            </div>

            <div className="sm:text-right">
              {row.eta !== null ? (
                <><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Live ETA</p><p className="mt-0.5 text-lg font-black text-blue-700">{etaRangeLabel(row.eta)}</p></>
              ) : (
                <p className="text-xs font-semibold text-muted-foreground">{row.passedTarget ? "Already passed" : "ETA unavailable"}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {userLocation ? (
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          {approaching > 0
            ? `${approaching} live ${approaching === 1 ? "jeepney is" : "jeepneys are"} still approaching a nearest mapped stop on their assigned direction.`
            : "No live jeepney is currently approaching the nearest mapped stop on its assigned direction."}
        </p>
      ) : null}
    </Card>
  );
}
