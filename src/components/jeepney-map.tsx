import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { JeepneyPosition, JeepneyRoute, JeepneyStop, LatLng } from "@/lib/jeepney";
import { isLive } from "@/lib/jeepney";

export type MapRoute = JeepneyRoute & { stops: JeepneyStop[] };

type Props = {
  routes: MapRoute[];
  live?: Record<string, JeepneyPosition>;
  userLocation?: LatLng | null;
  activeRouteId?: string | null;
  onSelectRoute?: (routeId: string) => void;
  height?: string;
};

function esc(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export default function JeepneyMap({
  routes,
  live = {},
  userLocation = null,
  activeRouteId = null,
  onSelectRoute,
  height = "70vh",
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
    const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView(
      [12.8797, 121.774],
      6,
    );
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

  // Routes + stops
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
      const line = L.polyline(latlngs, {
        color: route.colour || "#f59e0b",
        weight: dimmed ? 3 : 5,
        opacity: dimmed ? 0.35 : 0.9,
      }).addTo(layer);
      line.bindTooltip(esc(route.name), { sticky: true });
      line.on("click", () => selectRef.current?.(route.id));

      route.stops
        .slice()
        .sort((a, b) => a.position - b.position)
        .forEach((stop) => {
          L.circleMarker([Number(stop.latitude), Number(stop.longitude)], {
            radius: dimmed ? 4 : 6,
            color: "#ffffff",
            weight: 2,
            fillColor: route.colour || "#f59e0b",
            fillOpacity: dimmed ? 0.5 : 1,
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
  }, [routes, activeRouteId]);

  // Live vehicles
  useEffect(() => {
    const layer = liveLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    routes.forEach((route) => {
      const position = live[route.id];
      if (!position || !isLive(position.recorded_at)) return;
      const marker = L.marker([Number(position.latitude), Number(position.longitude)], {
        icon: L.divIcon({
          className: "",
          html: `<div style="background:${route.colour || "#f59e0b"};color:#fff;border-radius:9999px;padding:2px 8px;font-size:12px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.35);white-space:nowrap">🚐 ${esc(
            route.code || route.name.slice(0, 12),
          )}</div>`,
          iconSize: [0, 0],
          iconAnchor: [20, 12],
        }),
      }).addTo(layer);
      marker.bindPopup(
        `<strong>${esc(route.name)}</strong><br/>Live now${
          position.speed_kph ? ` · ${Math.round(Number(position.speed_kph))} km/h` : ""
        }`,
      );
    });
  }, [routes, live]);

  // Rider location
  useEffect(() => {
    const layer = userLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!userLocation) return;
    L.circleMarker([userLocation.lat, userLocation.lng], {
      radius: 8,
      color: "#ffffff",
      weight: 3,
      fillColor: "#2563eb",
      fillOpacity: 1,
    })
      .addTo(layer)
      .bindTooltip("You are here");
  }, [userLocation]);

  return <div ref={containerRef} style={{ height }} className="w-full rounded-xl border border-border" />;
}
