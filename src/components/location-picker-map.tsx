import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Props = {
  value: { lat: number; lng: number } | null;
  onChange: (coords: { lat: number; lng: number }) => void;
};

export default function LocationPickerMap({ value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const start: [number, number] = value ? [value.lat, value.lng] : [12.8797, 121.774];
    const map = L.map(ref.current, { scrollWheelZoom: true }).setView(start, value ? 17 : 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    if (!value) return;
    markerRef.current = L.circleMarker([value.lat, value.lng], {
      radius: 9,
      color: "#ffffff",
      weight: 2,
      fillColor: "#16a34a",
      fillOpacity: 1,
    }).addTo(map);
    map.setView([value.lat, value.lng], Math.max(map.getZoom(), 16));
  }, [value]);

  return <div ref={ref} className="h-56 w-full rounded-md border border-border" />;
}
