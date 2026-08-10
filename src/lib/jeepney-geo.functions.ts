import { createServerFn } from "@tanstack/react-start";

const UA = "BarangayBuddyPH/1.0 (Lovable; +https://barangaybuddy.com) jeepney-planner";

export type GeoPlace = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

/** Free-text address / street lookup, biased to the Philippines (OpenStreetMap Nominatim). */
export const searchPhilippinesPlaces = createServerFn({ method: "GET" })
  .inputValidator((data: { query: string }) => {
    const query = (data?.query ?? "").trim();
    if (query.length < 3) throw new Error("Type at least 3 characters.");
    return { query: query.slice(0, 120) };
  })
  .handler(async ({ data }): Promise<{ places: GeoPlace[]; error?: string }> => {
    const url =
      "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8" +
      "&countrycodes=ph&q=" +
      encodeURIComponent(data.query);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
      });
      if (!res.ok) return { places: [], error: "Address lookup is busy right now. Try again." };
      const json = (await res.json()) as Array<{
        place_id: number;
        display_name: string;
        name?: string;
        lat: string;
        lon: string;
      }>;
      return {
        places: json.map((p) => {
          const parts = p.display_name.split(",").map((s) => s.trim());
          return {
            id: String(p.place_id),
            name: (p.name && p.name.trim()) || parts[0] || p.display_name,
            address: parts.slice(0, 4).join(", "),
            lat: Number(p.lat),
            lng: Number(p.lon),
          };
        }),
      };
    } catch {
      return { places: [], error: "Could not reach the address lookup service." };
    }
  });

/** Snap an ordered list of stops to the road network (public OSRM). Falls back to straight lines. */
export const snapStopsToRoads = createServerFn({ method: "POST" })
  .inputValidator((data: { points: Array<{ lat: number; lng: number }> }) => {
    const points = (data?.points ?? []).filter(
      (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng),
    );
    if (points.length < 2) throw new Error("Add at least two stops first.");
    return { points: points.slice(0, 60) };
  })
  .handler(
    async ({
      data,
    }): Promise<{ path: Array<{ lat: number; lng: number }>; snapped: boolean; error?: string }> => {
      const coords = data.points.map((p) => `${p.lng},${p.lat}`).join(";");
      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
          { headers: { "User-Agent": UA, Accept: "application/json" } },
        );
        if (!res.ok) return { path: data.points, snapped: false, error: "Road routing unavailable." };
        const json = (await res.json()) as {
          routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
        };
        const line = json.routes?.[0]?.geometry?.coordinates;
        if (!line?.length) return { path: data.points, snapped: false, error: "No road route found." };
        return {
          path: line.map(([lng, lat]) => ({ lat, lng })),
          snapped: true,
        };
      } catch {
        return { path: data.points, snapped: false, error: "Could not reach the road router." };
      }
    },
  );
