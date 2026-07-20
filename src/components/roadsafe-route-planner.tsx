import { useState } from "react";
import { LocateFixed, Route as RouteIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RoadSafeRoutePlanner() {
  const [origin, setOrigin] = useState({ lat: "", lng: "" });
  const [destination, setDestination] = useState({ lat: "", lng: "" });
  const [result, setResult] = useState<{
    distance_m: number;
    duration_s: number;
    avoided_hazards: number;
    advisory: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  function locate() {
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) =>
        setOrigin({ lat: coords.latitude.toFixed(6), lng: coords.longitude.toFixed(6) }),
      () => toast.error("Could not access your location."),
    );
  }
  async function checkRoute() {
    const values = [origin.lng, origin.lat, destination.lng, destination.lat].map(Number);
    if (values.some((value) => !Number.isFinite(value)))
      return toast.error("Enter valid origin and destination coordinates.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) return toast.error("Please sign in to check a route.");
    setLoading(true);
    const response = await fetch("/api/roadsafe/route", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        origin: values.slice(0, 2),
        destination: values.slice(2, 4),
        profile: "driving-car",
      }),
    });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) return toast.error(json.error || "Route check is unavailable.");
    setResult(json);
  }
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <RouteIcon className="h-5 w-5" />
        <h3 className="font-display text-xl font-bold">Hazard-aware route check</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Checks a possible route against active severe reports. It is not turn-by-turn navigation or
        a guarantee of safety.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <Label>Origin</Label>
            <Button size="sm" variant="ghost" onClick={locate}>
              <LocateFixed className="mr-1 h-4 w-4" /> Use my location
            </Button>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <Input
              aria-label="Origin latitude"
              placeholder="Latitude"
              value={origin.lat}
              onChange={(e) => setOrigin({ ...origin, lat: e.target.value })}
            />
            <Input
              aria-label="Origin longitude"
              placeholder="Longitude"
              value={origin.lng}
              onChange={(e) => setOrigin({ ...origin, lng: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label>Destination</Label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <Input
              aria-label="Destination latitude"
              placeholder="Latitude"
              value={destination.lat}
              onChange={(e) => setDestination({ ...destination, lat: e.target.value })}
            />
            <Input
              aria-label="Destination longitude"
              placeholder="Longitude"
              value={destination.lng}
              onChange={(e) => setDestination({ ...destination, lng: e.target.value })}
            />
          </div>
        </div>
      </div>
      <Button className="mt-4" onClick={checkRoute} disabled={loading}>
        {loading ? "Checking…" : "Check possible route"}
      </Button>
      {result && (
        <Alert className="mt-4">
          <RouteIcon className="h-4 w-4" />
          <AlertTitle>
            {(result.distance_m / 1000).toFixed(1)} km · {Math.round(result.duration_s / 60)}{" "}
            minutes
          </AlertTitle>
          <AlertDescription>
            {result.avoided_hazards} active severe hazard areas were supplied to the route provider
            for avoidance. {result.advisory}
          </AlertDescription>
        </Alert>
      )}
    </Card>
  );
}
