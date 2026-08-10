import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Radio, RadioTower } from "lucide-react";

const PING_MS = 15000;

export function JeepneyLiveToggle({
  routeId,
  vehicleId,
}: {
  routeId: string;
  vehicleId?: string | null;
}) {
  const [live, setLive] = useState(false);
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const watchRef = useRef<number | null>(null);
  const lastPushRef = useRef(0);

  useEffect(() => {
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  function stop() {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setLive(false);
  }

  function start() {
    if (!("geolocation" in navigator)) {
      toast.error("This phone does not support location sharing.");
      return;
    }
    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        if (now - lastPushRef.current < PING_MS) return;
        lastPushRef.current = now;
        const { error } = await supabase.from("jeepney_positions").insert({
          route_id: routeId,
          vehicle_id: vehicleId ?? null,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
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
                ? `Last ping ${lastSent.toLocaleTimeString()}`
                : "Waiting for your first GPS fix…"
              : "Turn on when you start your trip. Keep this tab open."}
          </p>
        </div>
        <Button size="sm" variant={live ? "destructive" : "default"} onClick={live ? stop : start}>
          {live ? "End shift" : "Go live"}
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Uses your phone GPS and a small amount of data. Tracking stops if the browser is closed —
        a plug-in tracker device removes that limit.
      </p>
    </div>
  );
}
