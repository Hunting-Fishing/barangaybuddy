/* eslint-disable @typescript-eslint/no-explicit-any, prettier/prettier -- fleet/variant columns are migration-backed ahead of regenerated Supabase types. */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bus,
  CircleOff,
  Clock3,
  Gauge,
  MapPinned,
  RadioTower,
  RefreshCw,
  Route as RouteIcon,
  Rows3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { parsePath, type JeepneyPosition, type LatLng } from "@/lib/jeepney";
import {
  directionLabel,
  parseRouteVariant,
  projectDistanceAlongPathKm,
  type JeepneyRouteVariant,
} from "@/lib/jeepney-variants";

const LIVE_MS = 2 * 60 * 1000;
const STALE_MS = 5 * 60 * 1000;
const OFF_ROUTE_KM = 0.3;
const BUNCHING_KM = 0.4;

type FleetVehicle = {
  id: string;
  label: string;
  plate_number: string | null;
  active: boolean;
};

type ActiveTrip = {
  id: string;
  vehicle_id: string;
  route_id: string;
  route_variant_id: string;
  assignment_source: string;
  started_at: string;
};

type RouteRow = {
  id: string;
  name: string;
  code: string | null;
  colour: string;
  path: LatLng[];
  status: string;
};

type DeviceRow = {
  id: string;
  status: string;
  last_seen_at: string | null;
};

type DeviceAssignment = {
  device_id: string;
  vehicle_id: string;
};

type FleetUnitRow = {
  vehicle: FleetVehicle;
  trip: ActiveTrip | null;
  route: RouteRow | null;
  variant: JeepneyRouteVariant | null;
  position: JeepneyPosition | null;
  device: DeviceRow | null;
  state: "live" | "delayed" | "offline" | "idle";
  ageMs: number | null;
  offRouteKm: number | null;
  alongKm: number | null;
  bunchingGapKm: number | null;
};

function ageLabel(ageMs: number | null) {
  if (ageMs === null) return "No GPS";
  const seconds = Math.max(0, Math.floor(ageMs / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function stateBadge(state: FleetUnitRow["state"]) {
  if (state === "live") return "bg-emerald-600 text-white";
  if (state === "delayed") return "bg-amber-500 text-slate-950";
  if (state === "offline") return "bg-red-600 text-white";
  return "bg-slate-200 text-slate-700";
}

function tripAge(startedAt: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function JeepneyFleetOperations({ operatorId }: { operatorId: string }) {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [trips, setTrips] = useState<ActiveTrip[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [variants, setVariants] = useState<JeepneyRouteVariant[]>([]);
  const [positions, setPositions] = useState<JeepneyPosition[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [assignments, setAssignments] = useState<DeviceAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [vehicleResult, tripResult, routeResult, variantResult, deviceResult, assignmentResult] = await Promise.all([
        (supabase as any)
          .from("jeepney_vehicles")
          .select("id,label,plate_number,active")
          .eq("operator_id", operatorId)
          .order("label", { ascending: true }),
        (supabase as any)
          .from("jeepney_trips")
          .select("id,vehicle_id,route_id,route_variant_id,assignment_source,started_at")
          .eq("operator_id", operatorId)
          .is("ended_at", null)
          .order("started_at", { ascending: true }),
        (supabase as any)
          .from("jeepney_routes")
          .select("id,name,code,colour,path,status")
          .eq("operator_id", operatorId),
        (supabase as any)
          .from("jeepney_route_variants")
          .select("id,route_id,code,name,direction,path,is_default,active")
          .in(
            "route_id",
            [],
          ),
        (supabase as any)
          .from("jeepney_gps_devices")
          .select("id,status,last_seen_at")
          .eq("operator_id", operatorId)
          .neq("status", "retired"),
        (supabase as any)
          .from("jeepney_device_assignments")
          .select("device_id,vehicle_id")
          .is("removed_at", null),
      ]);

      if (vehicleResult.error) throw vehicleResult.error;
      if (tripResult.error) throw tripResult.error;
      if (routeResult.error) throw routeResult.error;

      const routeRows = (routeResult.data ?? []).map((route: any) => ({
        ...route,
        path: parsePath(route.path),
      })) as RouteRow[];
      const routeIds = routeRows.map((route) => route.id);

      let variantRows: JeepneyRouteVariant[] = [];
      if (routeIds.length) {
        const { data, error: variantError } = await (supabase as any)
          .from("jeepney_route_variants")
          .select("id,route_id,code,name,direction,path,is_default,active")
          .in("route_id", routeIds)
          .eq("active", true);
        if (variantError) throw variantError;
        variantRows = (data ?? []).map(parseRouteVariant);
      }

      const vehicleRows = (vehicleResult.data ?? []) as FleetVehicle[];
      const vehicleIds = vehicleRows.map((vehicle) => vehicle.id);
      let latestPositions: JeepneyPosition[] = [];
      if (vehicleIds.length) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data, error: positionError } = await (supabase as any)
          .from("jeepney_positions")
          .select("*")
          .in("vehicle_id", vehicleIds)
          .gte("recorded_at", since)
          .order("recorded_at", { ascending: false })
          .limit(Math.min(5000, Math.max(1000, vehicleIds.length * 10)));
        if (positionError) throw positionError;
        const seen = new Set<string>();
        latestPositions = ((data ?? []) as JeepneyPosition[]).filter((position) => {
          if (!position.vehicle_id || seen.has(position.vehicle_id)) return false;
          seen.add(position.vehicle_id);
          return true;
        });
      }

      setVehicles(vehicleRows);
      setTrips((tripResult.data ?? []) as ActiveTrip[]);
      setRoutes(routeRows);
      setVariants(variantRows);
      setPositions(latestPositions);
      setDevices(deviceResult.error ? [] : ((deviceResult.data ?? []) as DeviceRow[]));

      if (!deviceResult.error && !assignmentResult.error) {
        const ownDeviceIds = new Set((deviceResult.data ?? []).map((device: DeviceRow) => device.id));
        setAssignments(
          ((assignmentResult.data ?? []) as DeviceAssignment[]).filter((assignment) => ownDeviceIds.has(assignment.device_id)),
        );
      } else {
        setAssignments([]);
      }
    } catch (loadError) {
      console.error("Jeepney fleet operations load failed", loadError);
      setError("Fleet operations are unavailable until the fleet + route-direction migrations are deployed.");
    } finally {
      setLoading(false);
    }
  }, [operatorId]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 20000);
    const channel = supabase
      .channel(`jeepney-operator-fleet-${operatorId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "jeepney_positions" },
        () => void load(),
      )
      .subscribe();
    return () => {
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [load, operatorId]);

  const rows = useMemo(() => {
    const tripByVehicle = new Map(trips.map((trip) => [trip.vehicle_id, trip]));
    const routeById = new Map(routes.map((route) => [route.id, route]));
    const variantById = new Map(variants.map((variant) => [variant.id, variant]));
    const positionByVehicle = new Map(
      positions.filter((position) => position.vehicle_id).map((position) => [position.vehicle_id!, position]),
    );
    const assignmentByVehicle = new Map(assignments.map((assignment) => [assignment.vehicle_id, assignment]));
    const deviceById = new Map(devices.map((device) => [device.id, device]));

    const baseRows: FleetUnitRow[] = vehicles.map((vehicle) => {
      const trip = tripByVehicle.get(vehicle.id) ?? null;
      const route = trip ? routeById.get(trip.route_id) ?? null : null;
      const variant = trip ? variantById.get(trip.route_variant_id) ?? null : null;
      const position = positionByVehicle.get(vehicle.id) ?? null;
      const assignment = assignmentByVehicle.get(vehicle.id);
      const device = assignment ? deviceById.get(assignment.device_id) ?? null : null;
      const ageMs = position ? Math.max(0, Date.now() - new Date(position.recorded_at).getTime()) : null;
      const state: FleetUnitRow["state"] = !trip
        ? "idle"
        : ageMs === null || ageMs > STALE_MS
          ? "offline"
          : ageMs > LIVE_MS
            ? "delayed"
            : "live";
      const path = variant?.path?.length && variant.path.length >= 2 ? variant.path : route?.path ?? [];
      const projection = position && path.length >= 2
        ? projectDistanceAlongPathKm(path, {
            lat: Number(position.latitude),
            lng: Number(position.longitude),
          })
        : null;

      return {
        vehicle,
        trip,
        route,
        variant,
        position,
        device,
        state,
        ageMs,
        offRouteKm: projection?.offRouteKm ?? null,
        alongKm: projection?.alongKm ?? null,
        bunchingGapKm: null,
      };
    });

    const byVariant = new Map<string, FleetUnitRow[]>();
    for (const row of baseRows) {
      if (!row.trip || row.alongKm === null || row.state === "offline") continue;
      const group = byVariant.get(row.trip.route_variant_id) ?? [];
      group.push(row);
      byVariant.set(row.trip.route_variant_id, group);
    }

    for (const group of byVariant.values()) {
      group.sort((a, b) => (b.alongKm ?? 0) - (a.alongKm ?? 0));
      for (let index = 1; index < group.length; index += 1) {
        const ahead = group[index - 1]!;
        const current = group[index]!;
        current.bunchingGapKm = Math.max(0, (ahead.alongKm ?? 0) - (current.alongKm ?? 0));
      }
    }

    return baseRows.sort((a, b) => {
      const rank = { offline: 0, delayed: 1, live: 2, idle: 3 } as const;
      return rank[a.state] - rank[b.state] || a.vehicle.label.localeCompare(b.vehicle.label);
    });
  }, [assignments, devices, positions, routes, trips, variants, vehicles]);

  const metrics = useMemo(() => ({
    fleet: rows.length,
    activeTrips: rows.filter((row) => row.trip).length,
    live: rows.filter((row) => row.state === "live").length,
    stale: rows.filter((row) => row.state === "delayed" || row.state === "offline").length,
    offRoute: rows.filter((row) => row.trip && row.offRouteKm !== null && row.offRouteKm > OFF_ROUTE_KM).length,
    bunched: rows.filter((row) => row.bunchingGapKm !== null && row.bunchingGapKm < BUNCHING_KM).length,
  }), [rows]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Live fleet operations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Operational view of active trips, GPS freshness, off-route distance and spacing on each exact travel direction.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {error ? <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</Card> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Fleet", metrics.fleet, Bus],
          ["Trips", metrics.activeTrips, RouteIcon],
          ["Live", metrics.live, RadioTower],
          ["Stale/offline", metrics.stale, CircleOff],
          ["Off route", metrics.offRoute, MapPinned],
          ["Bunched", metrics.bunched, Rows3],
        ].map(([label, value, Icon]) => (
          <Card key={String(label)} className="p-3">
            <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              <Icon className="h-3.5 w-3.5" /> {label}
            </p>
            <p className="mt-1 text-2xl font-black">{value}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b bg-slate-50 px-4 py-3 text-xs text-muted-foreground">
          Off-route alert: &gt; {Math.round(OFF_ROUTE_KM * 1000)} m from assigned variant · bunching alert: &lt; {Math.round(BUNCHING_KM * 1000)} m behind the unit ahead. These are operational defaults and should become cooperative-configurable after pilot data.
        </div>
        <div className="divide-y">
          {!loading && rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No fleet vehicles yet.</div>
          ) : null}

          {rows.map((row) => {
            const offRoute = row.trip && row.offRouteKm !== null && row.offRouteKm > OFF_ROUTE_KM;
            const bunched = row.bunchingGapKm !== null && row.bunchingGapKm < BUNCHING_KM;
            return (
              <div key={row.vehicle.id} className="grid gap-3 p-4 lg:grid-cols-[1.1fr_1.2fr_.8fr] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{row.vehicle.label}</p>
                    {row.vehicle.plate_number ? <span className="text-xs text-muted-foreground">{row.vehicle.plate_number}</span> : null}
                    <Badge className={stateBadge(row.state)}>{row.state}</Badge>
                    {row.device ? <Badge variant="outline"><RadioTower className="mr-1 h-3 w-3" /> tracker</Badge> : null}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {row.position ? `GPS ${ageLabel(row.ageMs)}` : row.trip ? "No GPS position received" : "Idle fleet unit"}
                    {row.device?.last_seen_at ? ` · tracker ${ageLabel(Date.now() - new Date(row.device.last_seen_at).getTime())}` : ""}
                  </p>
                </div>

                <div>
                  {row.trip ? (
                    <>
                      <p className="flex items-center gap-1.5 text-sm font-semibold">
                        <RouteIcon className="h-3.5 w-3.5" /> {row.route?.name ?? "Assigned route"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {row.variant ? `${directionLabel(row.variant.direction)} · ${row.variant.name}` : "Direction unavailable"}
                        {` · trip ${tripAge(row.trip.started_at)} · ${row.trip.assignment_source}`}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No active trip — available for dispatch.</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {row.position?.speed_kph !== null && row.position?.speed_kph !== undefined ? (
                    <Badge variant="secondary"><Gauge className="mr-1 h-3 w-3" /> {Math.round(Number(row.position.speed_kph))} km/h</Badge>
                  ) : null}
                  {offRoute ? (
                    <Badge className="bg-red-600 text-white"><AlertTriangle className="mr-1 h-3 w-3" /> {Math.round((row.offRouteKm ?? 0) * 1000)} m off route</Badge>
                  ) : row.trip && row.offRouteKm !== null ? (
                    <Badge variant="outline"><MapPinned className="mr-1 h-3 w-3" /> on route</Badge>
                  ) : null}
                  {bunched ? (
                    <Badge className="bg-amber-500 text-slate-950"><Rows3 className="mr-1 h-3 w-3" /> {Math.round((row.bunchingGapKm ?? 0) * 1000)} m gap</Badge>
                  ) : row.bunchingGapKm !== null ? (
                    <Badge variant="outline"><Rows3 className="mr-1 h-3 w-3" /> {(row.bunchingGapKm ?? 0).toFixed(1)} km gap</Badge>
                  ) : null}
                  {row.trip ? <Badge variant="outline"><Clock3 className="mr-1 h-3 w-3" /> {ageLabel(row.ageMs)}</Badge> : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
