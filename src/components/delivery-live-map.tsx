import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Point = { lat: number; lng: number };

type Props = {
  pickup: Point;
  dropoff: Point;
  rider?: Point | null;
  className?: string;
};

function dot(color: string) {
  return {
    radius: 9,
    color: "#ffffff",
    weight: 2,
    fillColor: color,
    fillOpacity: 1,
  };
}

export default function DeliveryLiveMap({ pickup, dropoff, rider, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const riderRef = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    L.circleMarker([pickup.lat, pickup.lng], dot("#f59e0b")).addTo(map).bindPopup("Pickup");
    L.circleMarker([dropoff.lat, dropoff.lng], dot("#16a34a")).addTo(map).bindPopup("Drop-off");
    L.polyline(
      [
        [pickup.lat, pickup.lng],
        [dropoff.lat, dropoff.lng],
      ],
      { color: "#0ea5e9", weight: 3, dashArray: "6 8" },
    ).addTo(map);

    map.fitBounds(
      L.latLngBounds([
        [pickup.lat, pickup.lng],
        [dropoff.lat, dropoff.lng],
      ]).pad(0.35),
    );
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);
    return () => {
      map.remove();
      mapRef.current = null;
      riderRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!rider) {
      riderRef.current?.remove();
      riderRef.current = null;
      return;
    }
    if (!riderRef.current) {
      riderRef.current = L.circleMarker([rider.lat, rider.lng], dot("#dc2626"))
        .addTo(map)
        .bindPopup("Your rider");
    } else {
      riderRef.current.setLatLng([rider.lat, rider.lng]);
    }
  }, [rider]);

  return <div ref={ref} className={className ?? "h-72 w-full rounded-lg border border-border"} />;
}
