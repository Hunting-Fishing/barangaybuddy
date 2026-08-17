/* eslint-disable @typescript-eslint/no-explicit-any -- fleet ownership columns are migration-backed ahead of regenerated Supabase types. */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Radio, RadioTower } from "lucide-react";
import { haversineKm, type LatLng } from "@/lib/jeepney";

const PING_MS = 15000;

type FleetVehicle = {
  id: string;
  label: string;
  plate_number: string | null;
  seats: number | null;
  active: boolean;
};

type ActiveTrip = {
  id: string;
  route_id: string;
  started_at: string;
  createdByPhone: boolean;
};

export function JeepneyLiveToggle({
  routeId,
  operatorId,
  vehicleId,
}: {
  routeId: string;
  operatorId?: string | null;
  vehicleId?: string | null;
}) {
  const [live, setLive] = useState(false);
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const [distanceKm, setDistanceKm] = useState(0);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicleId ?? "");
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [newUnitLabel, setNewUnitLabel] = useState("");
  const [newPlate, setNewPlate] = useState("");
  const [addingVehicle, setAddingVehicle] = useState(false);
  const watchRef = useRef<number | null>(null);
  const lastPushRef = useRef(0);
  const tripIdRef = useRef<string | null>(null);
  const tripCreatedByPhoneRef = useRef(false);
  const lastPointRef = useRef<LatLng | null>(null);
  const distanceRef = useRef(0);
  const pingsRef = useRef(0);
  const startedRef = useRef<number>(0);
  const activeVehicleIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (vehicleId) setSelectedVehicleId(vehicleId);
  }, [vehicleId]);

  useEffect(() => {
    if (vehicleId) {
      setLoadingVehicles(false);
      return;
    }

    if (!operatorId) {
      setLoadingVehicles(false);
      setVehicles([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      setLoadingVehicles(true);
      const { data, error } = await (supabase as any)
        .from("jeepney_vehicles")
        .select("id,label,plate_number,seats,active")
        .eq("operator_id", operatorId)
        .eq("active", true)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      setLoadingVehicles(false);
      if (error) {
        toast.error("Could not load this operator's jeepney fleet.");
        return;
      }

      const rows = (data ?? []) as FleetVehicle[];
      setVehicles(rows);
      setSelectedVehicleId((current) => current || rows[0]?.id || "");
    })();

    return () => {
      cancelled = true;
    };
  }, [operatorId, vehicleId]);

  useEffect(() => {
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  async function closeTrip() {
    const tripId = tripIdRef.current;
    const shouldEndTrip = tripCreatedByPhoneRef.current;
    tripIdRef.current = null;
    tripCreatedByPhoneRef.current = false;
    if (!tripId || !shouldEndTrip) return;

    const minutes = (Date.now() - startedRef.current) / 60000;
    await supabase
      .from("jeepney_trips")
      .update({
        ended_at: new Date().toISOString(),
        distance_km: Number(distanceRef.current.toFixed(3)),
        avg_speed_kph: minutes > 1 ? Number((distanceRef.current / (minutes / 60)).toFixed(1)) : null,
        ping_count: pingsRef.current,
      })
      .eq("id", tripId);
  }

  function stop() {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setLive(false);
    activeVehicleIdRef.current = null;
    void closeTrip();
  }

  async function addVehicle() {
    const label = newUnitLabel.trim();
    if (label.length < 1) {
      toast.error("Enter the jeepney body/unit number or label first.");
      return;
    }
    if (!operatorId) {
      toast.error("Operator identity is required before adding a fleet vehicle.");
      return;
    }

    setAddingVehicle(true);
    const { data, error } = await (supabase as any)
      .from("jeepney_vehicles")
      .insert({
        operator_id: operatorId,
        route_id: null,
        label,
        plate_number: newPlate.trim() || null,
        active: true,
      })
      .select("id,label,plate_number,seats,active")
      .maybeSingle();
    setAddingVehicle(false);

    if (error || !data) {
      toast.error("Could not add this jeepney unit. Check the unit details and try again.");
      return;
    }

    const row = data as FleetVehicle;
    setVehicles((current) => [...current, row]);
    setSelectedVehicleId(row.id);
    setNewUnitLabel("");
    setNewPlate("");
    toast.success(`${row.label} was added to the cooperative fleet.`);
  }

  async function resolveOrStartTrip(unitId: string): Promise<ActiveTrip | null> {
    if (!operatorId) {
      toast.error("Operator identity is required to start an operational trip.");
      return null;
    }

    const { data: existing, error: existingError } = await (supabase as any)
      .from("jeepney_trips")
      .select("id,route_id,started_at")
      .eq("vehicle_id", unitId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      toast.error("Could not check this jeepney's active trip.");
      return null;
    }

    if (existing) {
      const trip = existing as Omit<ActiveTrip, "createdByPhone">;
      if (trip.route_id !== routeId) {
        toast.error(
          "This jeepney is already active on another route. End that trip before assigning it here.",
        );
        return null;
      }
      return { ...trip, createdByPhone: false };
    }

    const { data, error } = await (supabase as any)
      .from("jeepney_trips")
      .insert({ route_id: routeId, operator_id: operatorId, vehicle_id: unitId })
      .select("id,route_id,started_at")
      .maybeSingle();

    if (error || !data) {
      toast.error("Could not start the trip assignment. The unit may already be active elsewhere.");
      return null;
    }

    return { ...(data as Omit<ActiveTrip, "createdByPhone">), createdByPhone: true };
  }

  async function start() {
    if (!("geolocation" in navigator)) {
      toast.error("This phone does not support location sharing.");
      return;
    }

    const unitId = vehicleId ?? selectedVehicleId;
    if (!unitId) {
      toast.error("Select or add the jeepney unit this phone is tracking.");
      return;
    }

    const trip = await resolveOrStartTrip(unitId);
    if (!trip) return;

    tripIdRef.current = trip.id;
    tripCreatedByPhoneRef.current = trip.createdByPhone;
    activeVehicleIdRef.current = unitId;
    distanceRef.current = 0;
    pingsRef.current = 0;
    lastPointRef.current = null;
    lastPushRef.current = 0;
    startedRef.current = new Date(trip.started_at).getTime() || Date.now();
    setDistanceKm(0);

    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        if (now - lastPushRef.current < PING_MS) return;
        lastPushRef.current = now;
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (lastPointRef.current) {
          const step = haversineKm(lastPointRef.current, point);
          if (step < 2) {
            distanceRef.current += step;
            setDistanceKm(distanceRef.current);
          }
        }
        lastPointRef.current = point;
        const activeUnitId = activeVehicleIdRef.current;
        if (!activeUnitId) return;
        const { error } = await supabase.from("jeepney_positions").insert({
          route_id: routeId,
          vehicle_id: activeUnitId,
          latitude: point.lat,
          longitude: point.lng,
          heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
          speed_kph: Number.isFinite(pos.coords.speed)
            ? Math.max(0, Number(pos.coords.speed) * 3.6)
            : null,
          source: "phone",
        });
        if (error) {
          toast.error("Could not send your location. Check your connection or active trip.");
          return;
        }
        pingsRef.current += 1;
        setLastSent(new Date());
      },
      (err) => {
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — allow location to go live."
            : "Could not read your location.",
        );
        stop();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    setLive(true);
    const label = vehicles.find((unit) => unit.id === unitId)?.label;
    toast.success(
      label
        ? `${label} is serving this route — riders can track it independently.`
        : "This jeepney is live on the assigned route.",
    );
  }

  const selectedVehicle = vehicles.find((unit) => unit.id === selectedVehicleId) ?? null;

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            {live ? (
              <RadioTower className="h-4 w-4 text-emerald-600" />
            ) : (
              <Radio className="h-4 w-4 text-muted-foreground" />
            )}
            {live ? "Broadcasting live" : "Live tracking off"}
          </p>
          <p className="text-xs text-muted-foreground">
            {live
              ? lastSent
                ? `Last ping ${lastSent.toLocaleTimeString()} · ${distanceKm.toFixed(1)} km this phone session`
                : "Waiting for your first GPS fix…"
              : "Choose a fleet jeepney, then start this route assignment and phone GPS."}
          </p>
        </div>
        <Button
          size="sm"
          variant={live ? "destructive" : "default"}
          onClick={live ? stop : () => void start()}
          disabled={!live && (loadingVehicles || !(vehicleId ?? selectedVehicleId))}
        >
          {live ? (tripCreatedByPhoneRef.current ? "End shift" : "Stop phone GPS") : "Go live"}
        </Button>
      </div>

      {!vehicleId ? (
        <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-2.5">
          <label className="block text-xs font-semibold text-slate-700" htmlFor={`jeepney-unit-${routeId}`}>
            Jeepney unit/body number
          </label>
          {vehicles.length > 0 ? (
            <select
              id={`jeepney-unit-${routeId}`}
              value={selectedVehicleId}
              disabled={live || loadingVehicles}
              onChange={(event) => setSelectedVehicleId(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select a fleet unit</option>
              {vehicles.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.label}{unit.plate_number ? ` · ${unit.plate_number}` : ""}
                </option>
              ))}
            </select>
          ) : loadingVehicles ? (
            <p className="text-xs text-muted-foreground">Loading cooperative fleet…</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Add the first physical jeepney to this operator's fleet. It can later serve any approved route.
            </p>
          )}

          {!live ? (
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                value={newUnitLabel}
                onChange={(event) => setNewUnitLabel(event.target.value)}
                placeholder="Body/unit no. e.g. BB-104"
                className="h-9"
              />
              <Input
                value={newPlate}
                onChange={(event) => setNewPlate(event.target.value)}
                placeholder="Plate (optional)"
                className="h-9"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void addVehicle()}
                disabled={addingVehicle || !newUnitLabel.trim()}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> {addingVehicle ? "Adding…" : "Add unit"}
              </Button>
            </div>
          ) : null}

          {selectedVehicle && !live ? (
            <p className="text-[11px] text-emerald-700">
              {selectedVehicle.label} will use this route through an active trip, not a permanent route attachment.
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="mt-2 text-[11px] text-muted-foreground">
        The active trip is the authoritative route assignment. If dispatch already started the trip,
        stopping phone GPS leaves the hardwired tracker assignment running. A trip created by this phone
        is ended when the driver ends the shift.
      </p>
    </div>
  );
}
