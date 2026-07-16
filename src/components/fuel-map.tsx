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

type StationSource = "barangayhub" | "osm";

type Station = {
  id: string;
  slug: string | null;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  source: StationSource;
  osmUrl?: string;
};

type LatestPrice = { fuel_type: string; price: number; reported_at: string };

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&", "<": "<", ">": ">", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

function buildOsmAddress(tags: Record<string, string>) {
  if (tags["addr:full"]) return tags["addr:full"];

  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:barangay"] || tags["addr:suburb"] || tags["addr:village"],
    tags["addr:city"] || tags["addr:town"] || tags["addr:municipality"],
  ].filter(Boolean);

  return parts.length ? parts.join(", ") : null;
}

function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function FuelMap() {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const meRef = useRef<L.CircleMarker | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [osmStations, setOsmStations] = useState<Station[]>([]);
  const [pricesByStation, setPricesByStation] = useState<Record<string, LatestPrice[]>>({});
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [loadingOsmNearby, setLoadingOsmNearby] = useState(false);

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
      const page = (data ?? []).map((station) => ({
        id: station.id,
        slug: station.slug,
        name: station.name,
        latitude: Number(station.latitude),
        longitude: Number(station.longitude),
        address: station.address,
        source: "barangayhub" as const,
      }));
      all.push(...page);
      if (page.length < pageSize) break;
    }
    return all;
  }

  async function loadNearbyOsmStations(latitude: number, longitude: number) {
    setLoadingOsmNearby(true);
    try {
      const query = `[out:json][timeout:25];
(
  node["amenity"="fuel"](around:15000,${latitude},${longitude});
  way["amenity"="fuel"](around:15000,${latitude},${longitude});
);
out center tags;`;

      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: "data=" + encodeURIComponent(query),
      });

      if (!res.ok) {
        throw new Error(`OpenStreetMap nearby search failed (${res.status})`);
      }

      const json = (await res.json()) as { elements?: OsmElement[] };
      const dbNames = new Set(stations.map((station) => normalizeName(station.name)));

      const nearby = (json.elements ?? [])
        .map((element): Station | null => {
          const lat = element.lat ?? element.center?.lat;
          const lon = element.lon ?? element.center?.lon;
          if (typeof lat !== "number" || typeof lon !== "number") return null;

          const tags = element.tags ?? {};
          const name =
            tags.name ||
            tags.brand ||
            tags.operator ||
            "Fuel station";

          return {
            id: `osm:${element.type}:${element.id}`,
            slug: null,
            name,
            latitude: lat,
            longitude: lon,
            address: buildOsmAddress(tags),
            source: "osm",
            osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
          };
        })
        .filter((station): station is Station => station !== null)
        .filter((station) => {
          const name = normalizeName(station.name);
          if (!dbNames.has(name)) return true;

          return !stations.some(
            (existing) =>
              normalizeName(existing.name) === name &&
              Math.abs(existing.latitude - station.latitude) < 0.0005 &&
              Math.abs(existing.longitude - station.longitude) < 0.0005,
          );
        })
        .slice(0, 100);

      setOsmStations(nearby);

      if (nearby.length > 0) {
        toast.success(`Loaded ${nearby.length} nearby OpenStreetMap fuel stations.`);
      } else {
        toast.info("No extra nearby OpenStreetMap fuel stations found.");
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoadingOsmNearby(false);
    }
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

  const allStations = useMemo(
    () => [...stations, ...osmStations],
    [stations, osmStations],
  );

  // Render markers
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    allStations.forEach((st) => {
      const latest = pricesByStation[st.id] ?? [];
      const isOsm = st.source === "osm";
      const priceHtml = isOsm
        ? `<div style="margin-top:6px;font-size:12px;color:#64748b">Nearby OpenStreetMap station. Register it in Fuel Buddy to report prices.</div>`
        : latest.length
          ? `<div style="margin-top:6px;display:grid;grid-template-columns:1fr auto;gap:2px 12px;font-size:12px">
            ${latest
              .map(
                (p) => `<span style="color:#64748b">${FUEL_LABELS[p.fuel_type] ?? p.fuel_type}</span><strong style="text-align:right">₱${p.price.toFixed(2)}</strong>`,
              )
              .join("")}
          </div>`
          : `<div style="margin-top:6px;font-size:12px;color:#94a3b8">No prices reported yet</div>`;

      const linkHtml = st.slug
        ? `<a style="display:inline-block;margin-top:8px" href="/business/${encodeURIComponent(st.slug)}">View / report price →</a>`
        : st.osmUrl
          ? `<a style="display:inline-block;margin-top:8px" href="${esc(st.osmUrl)}" target="_blank" rel="noreferrer">View on OpenStreetMap →</a>`
          : "";

      L.circleMarker([st.latitude, st.longitude], {
        radius: isOsm ? 8 : 9,
        color: "#ffffff",
        weight: 2,
        fillColor: isOsm ? "#f59e0b" : "#16a34a",
        fillOpacity: 1,
      })
        .bindPopup(
          `<div style="font-family:inherit;min-width:180px">
            <strong>${esc(st.name)}</strong>
            ${st.address ? `<div style="color:#64748b;font-size:12px;margin-top:2px">${esc(st.address)}</div>` : ""}
            <div style="margin-top:4px;font-size:11px;color:${isOsm ? "#b45309" : "#15803d"}">${isOsm ? "OpenStreetMap nearby result" : "BarangayHub station"}</div>
            ${priceHtml}
            ${linkHtml}
          </div>`,
        )
        .addTo(layer);
    });
  }, [allStations, pricesByStation]);

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

        void loadNearbyOsmStations(latitude, longitude);
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
      await loadNearbyOsmStations(Number(lat), Number(lon));
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
          <Button type="submit" size="sm" disabled={searching || loadingOsmNearby}>
            {searching || loadingOsmNearby ? "Searching…" : "Search"}
          </Button>
        </form>
        <Button type="button" size="sm" variant="outline" onClick={locateMe} disabled={loadingOsmNearby}>
          <Locate className="mr-1 h-4 w-4" /> {loadingOsmNearby ? "Loading nearby…" : "Use my location"}
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <div ref={ref} className="h-[460px] w-full" />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-4 py-2 text-xs text-muted-foreground">
          <span>
            {stations.length} BarangayHub stations · {osmStations.length} nearby OSM stations · {withPrice} with community prices
          </span>
          <span>Green = BarangayHub station · Orange = nearby OpenStreetMap station.</span>
        </div>
      </div>
    </div>
  );
}