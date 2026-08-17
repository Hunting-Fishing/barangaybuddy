import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { JeepneyPosition, JeepneyRoute, JeepneyStop, LatLng } from "@/lib/jeepney";
import type { JeepneyLivePositions } from "@/lib/jeepney-live";
import {
  CONGESTION_COLOURS,
  SEGMENT_KM,
  congestionLevel,
  haversineKm,
  isLive,
} from "@/lib/jeepney";

export type MapRoute = JeepneyRoute & { stops: JeepneyStop[] };

type Props = {
  routes: MapRoute[];
  live?: JeepneyLivePositions;
  userLocation?: LatLng | null;
  activeRouteId?: string | null;
  onSelectRoute?: (routeId: string) => void;
  height?: string;
  /** routeId -> (segment index -> typical km/h for the current hour) */
  congestion?: Record<string, Map<number, number>>;
};

function esc(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function jeepneyMarkerHtml(label: string) {
  const safeLabel = esc(label);
  return `
    <div style="display:flex;align-items:center;gap:6px;transform:translate(-19px,-17px);white-space:nowrap;filter:drop-shadow(0 4px 8px rgba(7,29,73,.28))">
      <div style="width:38px;height:34px;border-radius:11px;background:#071d49;border:3px solid #fff;position:relative;box-sizing:border-box;overflow:hidden">
        <div style="position:absolute;left:3px;right:3px;top:4px;height:7px;border-radius:4px;background:#f5b400"></div>
        <div style="position:absolute;left:6px;right:6px;top:13px;height:7px;border-radius:2px;background:#9ed7ff;border:1px solid rgba(255,255,255,.8)"></div>
        <div style="position:absolute;left:4px;right:4px;bottom:5px;height:5px;border-radius:3px;background:#1465ff"></div>
        <div style="position:absolute;left:6px;bottom:1px;width:6px;height:6px;border-radius:999px;background:#111827;border:2px solid #fff"></div>
        <div style="position:absolute;right:6px;bottom:1px;width:6px;height:6px;border-radius:999px;background:#111827;border:2px solid #fff"></div>
      </div>
      <div style="background:#071d49;color:#fff;border:2px solid #fff;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:800;letter-spacing:.01em;box-shadow:0 3px 8px rgba(7,29,73,.2)">${safeLabel}</div>
    </div>`;
}

function vehicleLabel(route: MapRoute, position: JeepneyPosition) {
  const routeLabel = route.code || route.name.slice(0, 12);
  if (!position.vehicle_id) return routeLabel;
  return `${routeLabel} · ${position.vehicle_id.slice(-4).toUpperCase()}`;
}

export default function JeepneyMap({
  routes,
  live = {},
  userLocation = null,
  activeRouteId = null,
  onSelectRoute,
  height = "70vh",
  congestion = {},
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const liveLayerRef = useRef<L.LayerGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const selectRef = useRef(onSelectRoute);
  selectRef.current = onSelectRoute;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView([12.8797, 121.774], 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    liveLayerRef.current = L.layerGroup().addTo(map);
    userLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 120);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const bounds: [number, number][] = [];

    routes.forEach((route) => {
      const path = route.path ?? [];
      if (path.length < 2) return;
      const latlngs = path.map((p) => [p.lat, p.lng] as [number, number]);
      bounds.push(...latlngs);

      const dimmed = activeRouteId ? route.id !== activeRouteId : false;
      const speeds = congestion[route.id];

      if (speeds && speeds.size && !dimmed) {
        let running = 0;
        for (let i = 1; i < path.length; i += 1) {
          const a = path[i - 1]!;
          const b = path[i]!;
          const speed = speeds.get(Math.floor(running / SEGMENT_KM));
          running += haversineKm(a, b);
          const segmentPoints: [number, number][] = [
            [a.lat, a.lng],
            [b.lat, b.lng],
          ];
          L.polyline(segmentPoints, {
            color: "#071d49",
            weight: 9,
            opacity: 0.14,
          }).addTo(layer);
          const seg = L.polyline(segmentPoints, {
            color:
              speed === undefined
                ? route.colour || "#1465ff"
                : CONGESTION_COLOURS[congestionLevel(speed)],
            weight: 6,
            opacity: 0.95,
          }).addTo(layer);
          seg.bindTooltip(
            speed === undefined
              ? esc(route.name)
              : `${esc(route.name)} — about ${Math.round(speed)} km/h here`,
            { sticky: true },
          );
          seg.on("click", () => selectRef.current?.(route.id));
        }
      } else {
        if (!dimmed) {
          L.polyline(latlngs, {
            color: "#071d49",
            weight: 9,
            opacity: 0.14,
          }).addTo(layer);
        }
        const line = L.polyline(latlngs, {
          color: route.colour || "#1465ff",
          weight: dimmed ? 3 : 6,
          opacity: dimmed ? 0.3 : 0.95,
        }).addTo(layer);
        line.bindTooltip(esc(route.name), { sticky: true });
        line.on("click", () => selectRef.current?.(route.id));
      }

      route.stops
        .slice()
        .sort((a, b) => a.position - b.position)
        .forEach((stop, index) => {
          const terminal = index === 0 || index === route.stops.length - 1;
          L.circleMarker([Number(stop.latitude), Number(stop.longitude)], {
            radius: dimmed ? 4 : terminal ? 8 : 6,
            color: "#ffffff",
            weight: terminal ? 3 : 2,
            fillColor: terminal ? "#f5b400" : route.colour || "#1465ff",
            fillOpacity: dimmed ? 0.45 : 1,
          })
            .addTo(layer)
            .bindPopup(
              `<strong>${esc(stop.name)}</strong><br/><span style="color:#666">${esc(route.name)}</span>`,
            );
        });
    });

    if (bounds.length) {
      map.fitBounds(L.latLngBounds(bounds).pad(0.15), { maxZoom: 15 });
    }
  }, [routes, activeRouteId, congestion]);

  useEffect(() => {
    const layer = liveLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    routes.forEach((route) => {
      const positions = Object.values(live).filter(
        (position) => position.route_id === route.id && isLive(position.recorded_at),
      );

      positions.forEach((position) => {
        const marker = L.marker([Number(position.latitude), Number(position.longitude)], {
          icon: L.divIcon({
            className: "",
            html: jeepneyMarkerHtml(vehicleLabel(route, position)),
            iconSize: [1, 1],
            iconAnchor: [0, 0],
          }),
        }).addTo(layer);
        marker.on("click", () => selectRef.current?.(route.id));
        marker.bindPopup(
          `<strong>${esc(route.name)}</strong><br/>${
            position.vehicle_id ? `Unit …${esc(position.vehicle_id.slice(-6).toUpperCase())}<br/>` : ""
          }Live now${
            position.speed_kph ? ` · ${Math.round(Number(position.speed_kph))} km/h` : ""
          }`,
        );
      });
    });
  }, [routes, live]);

  useEffect(() => {
    const layer = userLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!userLocation) return;
    L.circleMarker([userLocation.lat, userLocation.lng], {
      radius: 8,
      color: "#ffffff",
      weight: 3,
      fillColor: "#1465ff",
      fillOpacity: 1,
    })
      .addTo(layer)
      .bindTooltip("You are here");
  }, [userLocation]);

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="w-full overflow-hidden rounded-2xl border border-blue-100 bg-slate-100"
    />
  );
}
