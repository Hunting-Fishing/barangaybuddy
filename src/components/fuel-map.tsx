import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Locate, Search } from "lucide-react";
import { toast } from "sonner";

const FUEL_LABELS: Record<string, string> = {
  gasoline_91: "Gas 91",
  gasoline_95: "Gas 95",
  gasoline_97: "Gas 97",
  diesel: "Diesel",
};

type Station = {
  id: string;
  slug: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
};

type LatestPrice = { fuel_type: string; price: number; reported_at: string };

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

export function FuelMap() {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const meRef = useRef<L.CircleMarker | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [pricesByStation, setPricesByStation] = useState<Record<string, LatestPrice[]>>({});
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);

  async function loadAllStations() {
    const pageSize = 1000;
    const all: Station[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("businesses")
        .select("id, slug, name, latitude, longitude, address")
        .eq("type", "fuel_station")
        .eq("is_published", true)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const page = (data ?? []) as Station[];
      all.push(...page);
      if (page.length < pageSize) break;
    }
    return all;
  }

  // Init map
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { scrollWheelZoom: true, preferCanvas: true }).setView([12.8797, 121.774], 6);
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

  // Load stations + latest prices
  useEffect(() => {
    (async () => {
      const list = await loadAllStations();
      setStations(list);
      if (list.length) {
        const stationIds = new Set(list.map((x) => x.id));
        const { data: prices } = await supabase
          .from("fuel_prices")
          .select("station_id, fuel_type, price, reported_at")
          .order("reported_at", { ascending: false })
          .limit(5000);
        const map: Record<string, LatestPrice[]> = {};
        (prices ?? []).forEach((p: any) => {
          if (!stationIds.has(p.station_id)) return;
          map[p.station_id] ??= [];
          // keep only latest per fuel_type
          if (!map[p.station_id].some((e) => e.fuel_type === p.fuel_type)) {
            map[p.station_id].push({ fuel_type: p.fuel_type, price: Number(p.price), reported_at: p.reported_at });
          }
        });
        setPricesByStation(map);
      }
    })();
  }, []);

  // Render markers
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    stations.forEach((st) => {
      const latest = pricesByStation[st.id] ?? [];
      const priceHtml = latest.length
        ? `<div style="margin-top:6px;display:grid;grid-template-columns:1fr auto;gap:2px 12px;font-size:12px">
            ${latest
              .map(
                (p) => `<span style="color:#64748b">${FUEL_LABELS[p.fuel_type] ?? p.fuel_type}</span><strong style="text-align:right">₱${p.price.toFixed(2)}</strong>`,
              )
              .join("")}
          </div>`
        : `<div style="margin-top:6px;font-size:12px;color:#94a3b8">No prices reported yet</div>`;
      L.circleMarker([st.latitude, st.longitude], {
        radius: 9,
        color: "#ffffff",
        weight: 2,
        fillColor: "#16a34a",
        fillOpacity: 1,
      })
        .bindPopup(
          `<div style="font-family:inherit;min-width:180px">
            <strong>${esc(st.name)}</strong>
            ${st.address ? `<div style="color:#64748b;font-size:12px;margin-top:2px">${esc(st.address)}</div>` : ""}
            ${priceHtml}
            <a style="display:inline-block;margin-top:8px" href="/business/${encodeURIComponent(st.slug)}">View / report price →</a>
          </div>`,
        )
        .addTo(layer);
    });
  }, [stations, pricesByStation]);

  function locateMe() {
    if (!navigator.geolocation) return toast.error("Geolocation not supported.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const map = mapRef.current;
        if (!map) return;
        map.setView([latitude, longitude], 14);
        if (meRef.current) meRef.current.remove();
        meRef.current = L.circleMarker([latitude, longitude], {
          radius: 8,
          color: "#2563eb",
          weight: 3,
          fillColor: "#3b82f6",
          fillOpacity: 0.6,
        })
          .bindPopup("You are here")
          .addTo(map);
      },
      (err) => toast.error(err.message || "Could not get your location."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function searchTown(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (query.length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&countrycodes=ph&limit=1&q=${encodeURIComponent(query)}`,
        { headers: { "Accept-Language": "en" } },
      );
      const json = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
      if (!json.length) return toast.error("No place found in the Philippines.");
      const { lat, lon } = json[0];
      mapRef.current?.setView([Number(lat), Number(lon)], 13);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSearching(false);
    }
  }

  const withPrice = useMemo(
    () => stations.filter((s) => (pricesByStation[s.id]?.length ?? 0) > 0).length,
    [stations, pricesByStation],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={searchTown} className="flex flex-1 items-center gap-2 min-w-[220px]">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search town or city (e.g. Laoag, Piddig)"
              className="pl-8"
            />
          </div>
          <Button type="submit" size="sm" disabled={searching}>
            {searching ? "Searching…" : "Search"}
          </Button>
        </form>
        <Button type="button" size="sm" variant="outline" onClick={locateMe}>
          <Locate className="mr-1 h-4 w-4" /> Use my location
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <div ref={ref} className="h-[460px] w-full" />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-4 py-2 text-xs text-muted-foreground">
          <span>
            {stations.length} stations on the map · {withPrice} with community prices
          </span>
          <span>Tap a pin to see the latest reported prices.</span>
        </div>
      </div>
    </div>
  );
}
