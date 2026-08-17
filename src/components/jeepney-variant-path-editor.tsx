import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/jeepney";

type StopPreview = {
  name: string;
  lat: number;
  lng: number;
};

type Props = {
  canonicalPath: LatLng[];
  path: LatLng[];
  stops?: StopPreview[];
  colour?: string;
  onPathChange: (path: LatLng[]) => void;
  height?: string;
};

export default function JeepneyVariantPathEditor({
  canonicalPath,
  path,
  stops = [],
  colour = "#1465ff",
  onPathChange,
  height = "320px",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const pathRef = useRef(path);
  const changeRef = useRef(onPathChange);
  pathRef.current = path;
  changeRef.current = onPathChange;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const first = pathRef.current[0] ?? canonicalPath[0];
    const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView(
      first ? [first.lat, first.lng] : [12.8797, 121.774],
      first ? 14 : 6,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    map.on("click", (event: L.LeafletMouseEvent) => {
      changeRef.current([...pathRef.current, { lat: event.latlng.lat, lng: event.latlng.lng }]);
    });
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 120);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [canonicalPath]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const bounds: [number, number][] = [];
    if (canonicalPath.length >= 2) {
      const points = canonicalPath.map((point) => [point.lat, point.lng] as [number, number]);
      bounds.push(...points);
      L.polyline(points, {
        color: "#64748b",
        weight: 4,
        opacity: 0.45,
        dashArray: "6 8",
      })
        .addTo(layer)
        .bindTooltip("Primary / outbound reference");
    }

    if (path.length >= 2) {
      const points = path.map((point) => [point.lat, point.lng] as [number, number]);
      bounds.push(...points);
      L.polyline(points, { color: colour, weight: 6, opacity: 0.9 })
        .addTo(layer)
        .bindTooltip("Direction being edited");
    }

    path.forEach((point, index) => {
      bounds.push([point.lat, point.lng]);
      L.marker([point.lat, point.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:22px;height:22px;border-radius:999px;background:${colour};color:#fff;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;box-shadow:0 1px 5px rgba(0,0,0,.35)">${index + 1}</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
      }).addTo(layer);
    });

    stops.forEach((stop) => {
      bounds.push([stop.lat, stop.lng]);
      L.circleMarker([stop.lat, stop.lng], {
        radius: 5,
        color: "#ffffff",
        weight: 2,
        fillColor: "#f5b400",
        fillOpacity: 1,
      })
        .addTo(layer)
        .bindTooltip(stop.name);
    });

    if (bounds.length) map.fitBounds(L.latLngBounds(bounds).pad(0.15), { maxZoom: 16 });
  }, [canonicalPath, path, stops, colour]);

  return (
    <div>
      <div
        ref={containerRef}
        style={{ height }}
        className="w-full overflow-hidden rounded-xl border border-blue-100 bg-slate-100"
      />
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Dashed line = primary/outbound reference. Solid line = this direction. Click the map to append correction points.
      </p>
    </div>
  );
}
