import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Route as RouteIcon, MapPin, Undo2, Trash2 } from "lucide-react";
import type { LatLng } from "@/lib/jeepney";

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
  const [mode, setMode] = useState<"path" | "stop">("path");
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
  }, [path, stops, colour]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "path" ? "default" : "outline"}
          onClick={() => setMode("path")}
        >
          <RouteIcon className="mr-1.5 h-4 w-4" /> Draw route
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "stop" ? "default" : "outline"}
          onClick={() => setMode("stop")}
        >
          <MapPin className="mr-1.5 h-4 w-4" /> Add stop
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onPathChange(path.slice(0, -1))}
          disabled={!path.length}
        >
          <Undo2 className="mr-1.5 h-4 w-4" /> Undo point
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onPathChange([])}
          disabled={!path.length}
        >
          <Trash2 className="mr-1.5 h-4 w-4" /> Clear
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {mode === "path"
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
