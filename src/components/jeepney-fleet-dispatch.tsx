/* eslint-disable @typescript-eslint/no-explicit-any -- fleet ownership is introduced by the Phase 3 migration ahead of generated types. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bus, CircleStop, Plus, RadioTower, RefreshCw, Route as RouteIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type DispatchRoute = {
  id: string;
  name: string;
  code?: string | null;
  status: string;
};

type FleetVehicle = {
  id: string;
  operator_id: string;
  label: string;
  plate_number: string | null;
  active: boolean;
};

type ActiveTrip = {
  id: string;
  route_id: string;
  vehicle_id: string;
  started_at: string;
};

type DeviceAssignment = {
  device_id: string;
  vehicle_id: string;
};

function elapsedLabel(startedAt: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function JeepneyFleetDispatch({
  operatorId,
  routes,
}: {
  operatorId: string;
  routes: DispatchRoute[];
}) {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [trips, setTrips] = useState<ActiveTrip[]>([]);
  const [assignments, setAssignments] = useState<DeviceAssignment[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Record<string, string>>({});
  const [newLabel, setNewLabel] = useState("");
  const [newPlate, setNewPlate] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const publishedRoutes = useMemo(
    () => routes.filter((route) => route.status === "published"),
    [routes],
  );

  const routeById = useMemo(
    () => new Map(routes.map((route) => [route.id, route])),
    [routes],
  );
  const tripByVehicle = useMemo(
    () => new Map(trips.map((trip) => [trip.vehicle_id, trip])),
    [trips],
  );
  const trackedVehicles = useMemo(
    () => new Set(assignments.map((assignment) => assignment.vehicle_id)),
    [assignments],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [vehicleResult, tripResult, deviceResult, assignmentResult] = await Promise.all([
        (supabase as any)
          .from("jeepney_vehicles")
          .select("id,operator_id,label,plate_number,active")
          .eq("operator_id", operatorId)
          .order("label", { ascending: true }),
        (supabase as any)
          .from("jeepney_trips")
          .select("id,route_id,vehicle_id,started_at")
          .eq("operator_id", operatorId)
          .is("ended_at", null)
          .order("started_at", { ascending: true }),
        (supabase as any)
          .from("jeepney_gps_devices")
          .select("id")
          .eq("operator_id", operatorId)
          .neq("status", "retired"),
        (supabase as any)
          .from("jeepney_device_assignments")
          .select("device_id,vehicle_id")
          .is("removed_at", null),
      ]);

      if (vehicleResult.error) throw vehicleResult.error;
      if (tripResult.error) throw tripResult.error;

      setVehicles((vehicleResult.data ?? []) as FleetVehicle[]);
      setTrips((tripResult.data ?? []).filter((trip: ActiveTrip) => Boolean(trip.vehicle_id)) as ActiveTrip[]);

      if (!deviceResult.error && !assignmentResult.error) {
        const ownDeviceIds = new Set((deviceResult.data ?? []).map((device: { id: string }) => device.id));
        setAssignments(
          ((assignmentResult.data ?? []) as DeviceAssignment[]).filter((assignment) =>
            ownDeviceIds.has(assignment.device_id),
          ),
        );
      } else {
        setAssignments([]);
      }
    } catch (error) {
      console.error("Jeepney fleet dispatch load failed", error);
      setLoadError(
        "Fleet dispatch is not available yet. Verify the Phase 3 fleet/trip migration is applied to Supabase.",
      );
    } finally {
      setLoading(false);
    }
  }, [operatorId]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => clearInterval(timer);
  }, [load]);

  async function addVehicle() {
    const label = newLabel.trim();
    if (!label) {
      toast.error("Enter a body/unit number first.");
      return;
    }

    setBusy("add");
    const { error } = await (supabase as any).from("jeepney_vehicles").insert({
      operator_id: operatorId,
      route_id: null,
      label,
      plate_number: newPlate.trim() || null,
      active: true,
    });
    setBusy(null);

    if (error) {
      toast.error("Could not add this fleet unit.");
      return;
    }

    setNewLabel("");
    setNewPlate("");
    toast.success(`${label} added to the cooperative fleet.`);
    await load();
  }

  async function startTrip(vehicle: FleetVehicle) {
    const routeId = selectedRoute[vehicle.id] || publishedRoutes[0]?.id || "";
    if (!routeId) {
      toast.error("No published route is available for dispatch.");
      return;
    }

    setBusy(vehicle.id);
    const { error } = await (supabase as any).from("jeepney_trips").insert({
      operator_id: operatorId,
      vehicle_id: vehicle.id,
      route_id: routeId,
    });
    setBusy(null);

    if (error) {
      toast.error(
        error.code === "23505"
          ? "This jeepney already has an active trip. Refresh the fleet panel."
          : "Could not start this route assignment.",
      );
      return;
    }

    toast.success(`${vehicle.label} dispatched to ${routeById.get(routeId)?.name ?? "the selected route"}.`);
    await load();
  }

  async function endTrip(vehicle: FleetVehicle, trip: ActiveTrip) {
    setBusy(vehicle.id);
    const { error } = await (supabase as any)
      .from("jeepney_trips")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", trip.id)
      .is("ended_at", null);
    setBusy(null);

    if (error) {
      toast.error("Could not end this trip assignment.");
      return;
    }

    toast.success(`${vehicle.label} is now idle and can be assigned to another route.`);
    await load();
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-slate-50 px-4 py-3">
        <div>
          <p className="flex items-center gap-2 font-semibold">
            <RadioTower className="h-4 w-4 text-blue-600" /> Fleet dispatch
          </p>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Assign a physical jeepney to a route for this trip. Hardwired GPS uses this active trip as
            its route authority; the unit is free to serve another route after the trip ends.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {loadError ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {loadError}
        </div>
      ) : null}

      <div className="grid gap-2 border-b p-4 sm:grid-cols-[1fr_1fr_auto]">
        <Input
          value={newLabel}
          onChange={(event) => setNewLabel(event.target.value)}
          placeholder="Body/unit no. e.g. BB-104"
        />
        <Input
          value={newPlate}
          onChange={(event) => setNewPlate(event.target.value)}
          placeholder="Plate number (optional)"
        />
        <Button onClick={() => void addVehicle()} disabled={busy === "add" || !newLabel.trim()}>
          <Plus className="mr-1.5 h-4 w-4" /> {busy === "add" ? "Adding…" : "Add fleet unit"}
        </Button>
      </div>

      <div className="divide-y">
        {!loading && vehicles.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <Bus className="mx-auto mb-2 h-5 w-5" />
            No fleet vehicles yet. Add the first physical jeepney above.
          </div>
        ) : null}

        {vehicles.map((vehicle) => {
          const trip = tripByVehicle.get(vehicle.id) ?? null;
          const route = trip ? routeById.get(trip.route_id) ?? null : null;
          const hasTracker = trackedVehicles.has(vehicle.id);
          const selected = selectedRoute[vehicle.id] || publishedRoutes[0]?.id || "";

          return (
            <div key={vehicle.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_1.25fr_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{vehicle.label}</p>
                  {vehicle.plate_number ? <span className="text-xs text-muted-foreground">{vehicle.plate_number}</span> : null}
                  <Badge variant={vehicle.active ? "secondary" : "outline"} className="text-[10px]">
                    {vehicle.active ? "fleet active" : "vehicle disabled"}
                  </Badge>
                  {hasTracker ? (
                    <Badge className="bg-blue-600 text-[10px] text-white">
                      <RadioTower className="mr-1 h-3 w-3" /> GPS installed
                    </Badge>
                  ) : null}
                </div>
              </div>

              {trip ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-950">
                    <RouteIcon className="h-3.5 w-3.5" /> {route?.name ?? "Assigned route"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-emerald-800">
                    Active for {elapsedLabel(trip.started_at)} · this trip controls phone and hardwired GPS routing
                  </p>
                </div>
              ) : (
                <select
                  value={selected}
                  disabled={!vehicle.active || publishedRoutes.length === 0 || busy === vehicle.id}
                  onChange={(event) =>
                    setSelectedRoute((current) => ({ ...current, [vehicle.id]: event.target.value }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {publishedRoutes.length === 0 ? <option value="">No published route available</option> : null}
                  {publishedRoutes.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.code ? `${candidate.code} · ` : ""}{candidate.name}
                    </option>
                  ))}
                </select>
              )}

              {trip ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === vehicle.id}
                  onClick={() => void endTrip(vehicle, trip)}
                >
                  <CircleStop className="mr-1.5 h-4 w-4" /> {busy === vehicle.id ? "Ending…" : "End trip"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={!vehicle.active || !selected || busy === vehicle.id}
                  onClick={() => void startTrip(vehicle)}
                >
                  <RouteIcon className="mr-1.5 h-4 w-4" /> {busy === vehicle.id ? "Starting…" : "Dispatch"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
