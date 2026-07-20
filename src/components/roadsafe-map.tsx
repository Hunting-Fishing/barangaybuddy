import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  hazardLabel,
  passabilityLabel,
  type EvacuationCentre,
  type RoadHazard,
} from "@/lib/roadsafe";

const COLORS = { information: "#2563eb", caution: "#f59e0b", avoid: "#ea580c", closed: "#dc2626" };

function esc(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
}

export function RoadSafeMap({
  reports,
  centres = [],
}: {
  reports: RoadHazard[];
  centres?: EvacuationCentre[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { scrollWheelZoom: false, preferCanvas: true }).setView(
      [12.8797, 121.774],
      6,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const valid = reports.filter(
      (report) => Number.isFinite(report.latitude) && Number.isFinite(report.longitude),
    );
    for (const report of valid) {
      const confirmations = report.road_hazard_confirmations ?? [];
      const confirmed = confirmations.filter((item) => item.vote === "confirm").length;
      const disputed = confirmations.filter((item) => item.vote === "dispute").length;
      const ageMinutes = Math.max(
        0,
        Math.round((Date.now() - new Date(report.occurred_at).getTime()) / 60000),
      );
      const color = COLORS[report.severity] ?? COLORS.caution;
      L.circleMarker([report.latitude, report.longitude], {
        radius: 11,
        color: "#fff",
        weight: 3,
        fillColor: color,
        fillOpacity: 0.95,
      })
        .bindPopup(
          `<div style="font-family:inherit;min-width:210px"><strong>${esc(hazardLabel(report.hazard_type))}</strong><div style="margin-top:4px;color:${color};font-weight:700">${esc(passabilityLabel(report.passability))}</div>${report.water_depth_cm != null ? `<div>Estimated depth: ${Number(report.water_depth_cm)} cm</div>` : ""}${report.description ? `<p style="margin:8px 0">${esc(report.description)}</p>` : ""}<div style="font-size:12px;color:#64748b">${ageMinutes} min ago · ${confirmed} confirm · ${disputed} dispute${report.is_official ? " · Official source" : " · Community report"}</div></div>`,
        )
        .addTo(layer);
    }
    const validCentres = centres.filter(
      (centre) => Number.isFinite(centre.latitude) && Number.isFinite(centre.longitude),
    );
    for (const centre of validCentres) {
      L.circleMarker([Number(centre.latitude), Number(centre.longitude)], {
        radius: 9,
        color: "#fff",
        weight: 3,
        fillColor: "#16a34a",
        fillOpacity: 1,
      })
        .bindPopup(
          `<div style="font-family:inherit;min-width:190px"><strong>${esc(centre.name)}</strong><div style="color:#15803d;font-weight:700;text-transform:capitalize">Evacuation centre · ${esc(centre.status)}</div>${centre.address ? `<p>${esc(centre.address)}</p>` : ""}${centre.contact_number ? `<a href="tel:${esc(centre.contact_number)}">${esc(centre.contact_number)}</a>` : ""}</div>`,
        )
        .addTo(layer);
    }
    const allPoints = [
      ...valid.map((report) => [report.latitude, report.longitude] as [number, number]),
      ...validCentres.map(
        (centre) => [Number(centre.latitude), Number(centre.longitude)] as [number, number],
      ),
    ];
    if (allPoints.length === 1) map.setView(allPoints[0], 16);
    else if (allPoints.length > 1)
      map.fitBounds(L.latLngBounds(allPoints), { padding: [32, 32], maxZoom: 16 });
  }, [centres, reports]);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div ref={ref} className="h-[420px] w-full" />
      <div className="flex flex-wrap gap-4 border-t bg-card px-4 py-3 text-xs">
        <strong>Road status</strong>
        {Object.entries(COLORS).map(([label, color]) => (
          <span key={label} className="inline-flex items-center gap-1.5 capitalize">
            <i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-full bg-green-600" /> Evacuation centre
        </span>
      </div>
    </div>
  );
}
