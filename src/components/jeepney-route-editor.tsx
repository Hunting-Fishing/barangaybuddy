import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import {
  Route as RouteIcon,
  MapPin,
  Undo2,
  Trash2,
  Locate,
  Play,
  Pause,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  haversineKm,
  pathLengthKm,
  simplifyPath,
  TRACK_MAX_ACCURACY_M,
  TRACK_MIN_METRES,
  type LatLng,
} from "@/lib/jeepney";

export type DraftStop = { name: string; lat: number; lng: number };

type Props = {
  path: LatLng[];
  stops: DraftStop[];
  colour: string;
  onPathChange: (path: LatLng[]) => void;
  onAddStop: (point: LatLng) => void;
};

export default function JeepneyRouteEditor({
  path,
  stops,
  colour,
  onPathChange,
  onAddStop,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const meRef = useRef<L.CircleMarker | null>(null);
  const [mode, setMode] = useState<"path" | "stop">("path");
  const [tracking, setTracking] = useState<"off" | "recording" | "paused">("off");
  const [trace, setTrace] = useState<LatLng[]>([]);
  const watchRef = useRef<number | null>(null);
  const trackingRef = useRef(tracking);
  trackingRef.current = tracking;
  const traceRef = useRef(trace);
  traceRef.current = trace;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const pathRef = useRef(path);
  pathRef.current = path;
  const handlersRef = useRef({ onPathChange, onAddStop });
  handlersRef.current = { onPathChange, onAddStop };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const first = pathRef.current[0];
    const start: [number, number] = first ? [first.lat, first.lng] : [14.5995, 120.9842];
    const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView(
      start,
      first ? 14 : 11,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (trackingRef.current !== "off") return;
      const point = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (modeRef.current === "path") {
        handlersRef.current.onPathChange([...pathRef.current, point]);
      } else {
        handlersRef.current.onAddStop(point);
      }
    });
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 120);
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();

    if (path.length >= 2) {
      L.polyline(
        path.map((p) => [p.lat, p.lng] as [number, number]),
        { color: colour, weight: 5, opacity: 0.9 },
      ).addTo(layer);
    }
    path.forEach((p, i) => {
      L.circleMarker([p.lat, p.lng], {
        radius: 4,
        color: colour,
        weight: 2,
        fillColor: "#ffffff",
        fillOpacity: 1,
      })
        .addTo(layer)
        .bindTooltip(`Point ${i + 1}`);
    });
    if (trace.length >= 2) {
      L.polyline(
        trace.map((p) => [p.lat, p.lng] as [number, number]),
        { color: "#2563eb", weight: 5, opacity: 0.8, dashArray: "6 6" },
      ).addTo(layer);
    }
    stops.forEach((s) => {
      L.circleMarker([s.lat, s.lng], {
        radius: 7,
        color: "#ffffff",
        weight: 2,
        fillColor: "#0f766e",
        fillOpacity: 1,
      })
        .addTo(layer)
        .bindTooltip(s.name);
    });
  }, [path, stops, colour, trace]);

  function showMe(point: LatLng, zoom: number) {
    const map = mapRef.current;
    if (!map) return;
    map.setView([point.lat, point.lng], Math.max(map.getZoom(), zoom));
    if (meRef.current) meRef.current.remove();
    meRef.current = L.circleMarker([point.lat, point.lng], {
      radius: 8,
      color: "#ffffff",
      weight: 3,
      fillColor: "#2563eb",
      fillOpacity: 1,
    })
      .addTo(map)
      .bindTooltip("You are here");
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("This device cannot share its location.");
      return;
    }
    toast.info("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        showMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }, 17);
        toast.success("Map centred on where you are. Tap the map to start drawing.");
      },
      (err) => {
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — allow location to use this."
            : "Could not read your location. Try again outdoors.",
        );
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 },
    );
  }

  function startTracking() {
    if (!("geolocation" in navigator)) {
      toast.error("This device cannot share its location.");
      return;
    }
    if (tracking === "paused") {
      setTracking("recording");
      toast.success("Recording again.");
      return;
    }
    setTrace([]);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (trackingRef.current !== "recording") return;
        const accuracy = pos.coords.accuracy ?? 999;
        if (accuracy > TRACK_MAX_ACCURACY_M) return;
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        showMe(point, 16);
        const last = traceRef.current[traceRef.current.length - 1];
        if (last && haversineKm(last, point) * 1000 < TRACK_MIN_METRES) return;
        setTrace((prev) => [...prev, point]);
      },
      (err) => {
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — allow location to track your route."
            : "Lost your GPS signal. Keep this screen open and try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 3000 },
    );
    setTracking("recording");
    toast.success("Tracking started — drive your usual loop, keep this screen open.");
  }

  function stopWatch() {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }

  function finishTracking() {
    stopWatch();
    setTracking("off");
    if (trace.length < 2) {
      toast.error("Not enough of the route was recorded. Try again while moving.");
      setTrace([]);
      return;
    }
    const simplified = simplifyPath(trace, 25);
    onPathChange(simplified);
    setTrace([]);
    toast.success(`Route recorded — ${simplified.length} points, ${pathLengthKm(simplified).toFixed(1)} km.`);
  }

  function discardTracking() {
    stopWatch();
    setTracking("off");
    setTrace([]);
    toast.info("Tracking discarded.");
  }

  const traceKm = pathLengthKm(trace);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "path" ? "default" : "outline"}
          onClick={() => setMode("path")}
          disabled={tracking !== "off"}
        >
          <RouteIcon className="mr-1.5 h-4 w-4" /> Draw route
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "stop" ? "default" : "outline"}
          onClick={() => setMode("stop")}
          disabled={tracking !== "off"}
        >
          <MapPin className="mr-1.5 h-4 w-4" /> Add stop
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={useMyLocation}>
          <Locate className="mr-1.5 h-4 w-4" /> Use my location
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onPathChange(path.slice(0, -1))}
          disabled={!path.length || tracking !== "off"}
        >
          <Undo2 className="mr-1.5 h-4 w-4" /> Undo point
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onPathChange([])}
          disabled={!path.length || tracking !== "off"}
        >
          <Trash2 className="mr-1.5 h-4 w-4" /> Clear
        </Button>
      </div>

      <div className="rounded-md border border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Track my route</p>
            <p className="text-xs text-muted-foreground">
              {tracking === "off"
                ? "Drive your loop once and we draw the route for you — no tapping needed."
                : `${trace.length} point${trace.length === 1 ? "" : "s"} · ${traceKm.toFixed(1)} km recorded`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tracking !== "recording" && (
              <Button type="button" size="sm" onClick={startTracking}>
                <Play className="mr-1.5 h-4 w-4" />
                {tracking === "paused" ? "Resume" : "Start tracking"}
              </Button>
            )}
            {tracking === "recording" && (
              <Button type="button" size="sm" variant="outline" onClick={() => setTracking("paused")}>
                <Pause className="mr-1.5 h-4 w-4" /> Pause
              </Button>
            )}
            {tracking !== "off" && (
              <>
                <Button type="button" size="sm" onClick={finishTracking}>
                  <Check className="mr-1.5 h-4 w-4" /> Finish
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={discardTracking}>
                  <X className="mr-1.5 h-4 w-4" /> Discard
                </Button>
              </>
            )}
          </div>
        </div>
        {tracking !== "off" && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Keep this screen open while you drive. Finishing replaces the drawn route with your
            recorded path.
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {tracking !== "off"
          ? "Recording your path — the blue dashed line is what we have so far."
          : mode === "path"
            ? "Tap the map along the roads your jeepney travels — start at the terminal and follow the route."
            : "Tap where passengers wait to add a named stop."}
      </p>
      <div ref={containerRef} className="h-72 w-full rounded-md border border-border" />
      <p className="text-xs text-muted-foreground">
        {path.length} route point{path.length === 1 ? "" : "s"} · {stops.length} stop
        {stops.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}
