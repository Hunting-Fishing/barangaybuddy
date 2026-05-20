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
  verified?: boolean;
  hasFullAddress?: boolean;
  hasCoverImage?: boolean;
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
      const verified =
        b.verified ?? (Boolean(b.hasFullAddress) && Boolean(b.hasCoverImage));
      // Verified: solid filled circle with white ring.
      // Pin-only: hollow ring with dashed border in the type color.
      const marker = verified
        ? L.circleMarker([b.latitude, b.longitude], {
            radius: 10,
            color: "#ffffff",
            weight: 2.5,
            fillColor: color,
            fillOpacity: 1,
          })
        : L.circleMarker([b.latitude, b.longitude], {
            radius: 9,
            color: color,
            weight: 2.5,
            dashArray: "3 3",
            fillColor: "#ffffff",
            fillOpacity: 0.9,
          });
      marker
        .bindPopup(
          `<div style="font-family:inherit;min-width:160px">
            <strong>${escapeHtml(b.name)}</strong>
            <div style="margin-top:2px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <span style="text-transform:capitalize;color:#64748b;font-size:12px">${b.type.replace("_", " ")}</span>
              <span style="font-size:11px;padding:1px 6px;border-radius:999px;${
                verified
                  ? "background:#dcfce7;color:#15803d"
                  : "background:#fef3c7;color:#92400e"
              }">${verified ? "Verified" : "Pin only"}</span>
            </div>
            <a style="display:inline-block;margin-top:6px" href="/business/${encodeURIComponent(b.slug)}">View page →</a>
          </div>`,
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
      <div className="space-y-2 border-t border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium text-foreground">Type</span>
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
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-medium text-foreground">Status</span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-full border-2 border-white"
              style={{ backgroundColor: "#64748b", boxShadow: "0 0 0 1px #cbd5e1" }}
            />
            Verified (full address + photo)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-full bg-background"
              style={{
                border: "2px dashed #64748b",
              }}
            />
            Pin only
          </span>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}
