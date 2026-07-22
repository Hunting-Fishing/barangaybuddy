import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface VenuePin {
  id: string;
  slug: string;
  name: string;
  latitude: number;
  longitude: number;
  approved: boolean;
}

export function GroupVenueMap({ venues }: { venues: VenuePin[] }) {
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
    const valid = venues.filter(
      (v) => Number.isFinite(v.latitude) && Number.isFinite(v.longitude),
    );
    valid.forEach((v) => {
      const marker = L.circleMarker([v.latitude, v.longitude], {
        radius: 11,
        color: "#f59e0b",
        weight: 3,
        fillColor: v.approved ? "#fbbf24" : "#ffffff",
        fillOpacity: v.approved ? 1 : 0.85,
      });
      marker
        .bindPopup(
          `<div style="font-family:inherit;min-width:160px">
            <strong>${escapeHtml(v.name)}</strong>
            <div style="margin-top:4px;font-size:11px;padding:1px 6px;border-radius:999px;display:inline-block;background:#fef3c7;color:#92400e">League location</div>
            <a style="display:block;margin-top:6px" href="/business/${encodeURIComponent(v.slug)}">View page →</a>
          </div>`,
        )
        .addTo(layer);
    });
    if (valid.length === 1) {
      map.setView([valid[0].latitude, valid[0].longitude], 15);
    } else if (valid.length > 1) {
      const bounds = L.latLngBounds(
        valid.map((v) => [v.latitude, v.longitude] as [number, number]),
      );
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
    }
    return () => {
      layer.remove();
    };
  }, [venues]);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div ref={ref} className="h-[360px] w-full" />
      <div className="flex flex-wrap items-center gap-4 border-t border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Legend</span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: "#fbbf24", border: "2px solid #f59e0b" }}
          />
          League location
        </span>
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}
