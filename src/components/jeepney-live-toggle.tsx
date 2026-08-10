import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Radio, RadioTower } from "lucide-react";
import { haversineKm, type LatLng } from "@/lib/jeepney";

const PING_MS = 15000;

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
  const watchRef = useRef<number | null>(null);
  const lastPushRef = useRef(0);
  const tripIdRef = useRef<string | null>(null);
  const lastPointRef = useRef<LatLng | null>(null);
  const distanceRef = useRef(0);
  const pingsRef = useRef(0);
  const startedRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  async function closeTrip() {
    const tripId = tripIdRef.current;
    if (!tripId) return;
    tripIdRef.current = null;
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
    void closeTrip();
  }

  async function start() {
    if (!("geolocation" in navigator)) {
      toast.error("This phone does not support location sharing.");
      return;
    }
    distanceRef.current = 0;
    pingsRef.current = 0;
    lastPointRef.current = null;
    startedRef.current = Date.now();
    setDistanceKm(0);

    if (operatorId) {
      const { data } = await supabase
        .from("jeepney_trips")
        .insert({ route_id: routeId, operator_id: operatorId, vehicle_id: vehicleId ?? null })
        .select("id")
        .maybeSingle();
      tripIdRef.current = data?.id ?? null;
    }

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
        const { error } = await supabase.from("jeepney_positions").insert({
          route_id: routeId,
          vehicle_id: vehicleId ?? null,
          latitude: point.lat,
          longitude: point.lng,
          heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
          speed_kph: Number.isFinite(pos.coords.speed)
            ? Math.max(0, Number(pos.coords.speed) * 3.6)
            : null,
          source: "phone",
        });
        if (error) {
          toast.error("Could not send your location. Check your connection.");
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
    toast.success("You are live — riders can see this jeepney on the map.");
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
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
                ? `Last ping ${lastSent.toLocaleTimeString()} · ${distanceKm.toFixed(1)} km this shift`
                : "Waiting for your first GPS fix…"
              : "Turn on when you start your trip. Keep this tab open."}
          </p>
        </div>
        <Button size="sm" variant={live ? "destructive" : "default"} onClick={live ? stop : () => void start()}>
          {live ? "End shift" : "Go live"}
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Every shift feeds your route analytics — busy hours, trends and traffic congestion. Tracking
        stops if the browser is closed; a plug-in tracker device removes that limit.
      </p>
    </div>
  );
}
