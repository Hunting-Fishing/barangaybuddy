import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapBusiness {
  id: string;
  slug: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
}

const TYPE_COLORS: Record<string, string> = {
  store: "#2563eb",
  service: "#7c3aed",
  restaurant: "#dc2626",
  food_vendor: "#ea580c",
  fuel_station: "#16a34a",
};

export function BusinessMap({ businesses }: { businesses: MapBusiness[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { scrollWheelZoom: false }).setView(
      [12.8797, 121.774],
      5,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = L.layerGroup().addTo(map);
    const valid = businesses.filter(
      (b) => Number.isFinite(b.latitude) && Number.isFinite(b.longitude),
    );
    valid.forEach((b) => {
      const color = TYPE_COLORS[b.type] ?? "#64748b";
      L.circleMarker([b.latitude, b.longitude], {
        radius: 9,
        color: "#fff",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.95,
      })
        .bindPopup(
          `<div style="font-family:inherit"><strong>${escapeHtml(
            b.name,
          )}</strong><br/><span style="text-transform:capitalize;color:#64748b">${b.type.replace(
            "_",
            " ",
          )}</span><br/><a href="/business/${encodeURIComponent(
            b.slug,
          )}">View page →</a></div>`,
        )
        .addTo(layer);
    });
    if (valid.length === 1) {
      map.setView([valid[0].latitude, valid[0].longitude], 16);
    } else if (valid.length > 1) {
      const bounds = L.latLngBounds(
        valid.map((b) => [b.latitude, b.longitude] as [number, number]),
      );
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 17 });
    }
    return () => {
      layer.remove();
    };
  }, [businesses]);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div ref={ref} className="h-[360px] w-full" />
      <div className="flex flex-wrap gap-3 border-t border-border bg-card px-4 py-2 text-xs text-muted-foreground">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <span key={type} className="inline-flex items-center gap-1.5 capitalize">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            {type.replace("_", " ")}
          </span>
        ))}
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}
