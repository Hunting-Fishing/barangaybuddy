// Server-only importer for community jeepney routes from OpenStreetMap (ODbL).
// PH jeepney lines are mapped as public-transport route relations tagged
// route=share_taxi / minibus / bus with jeepney hints. We import them as
// unclaimed "community routes" that real operators can later claim.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];

const QUERY = `[out:json][timeout:300];
area["ISO3166-1"="PH"][admin_level=2]->.ph;
(
  relation(area.ph)["type"="route"]["route"~"^(share_taxi|minibus)$"];
  relation(area.ph)["type"="route"]["route"="bus"]["name"~"[Jj]eep"];
);
out geom;`;

type Geom = { lat: number; lon: number };
type Member = {
  type: string;
  ref: number;
  role: string;
  lat?: number;
  lon?: number;
  geometry?: Geom[];
};
type Relation = { id: number; tags?: Record<string, string>; members?: Member[] };

const COLOURS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
}

/** Keep the polyline light enough for the map: cap total points. */
function thin<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  const step = points.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.floor(i * step)]!);
  return out;
}

async function fetchOverpass(query: string): Promise<Relation[]> {
  let lastErr: Error | null = null;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "BarangayBuddyPH/1.0 (Lovable; +https://barangaybuddy.com) jeepney-importer",
          Accept: "application/json",
        },
        body: "data=" + encodeURIComponent(query),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        lastErr = new Error(`Overpass ${url} ${res.status} ${body.slice(0, 120)}`);
        continue;
      }
      const json = (await res.json()) as { elements?: Relation[] };
      return json.elements ?? [];
    } catch (e) {
      lastErr = e as Error;
    }
  }
  throw lastErr ?? new Error("All Overpass endpoints failed");
}

export async function runJeepneyRouteSync(): Promise<{
  routes: number;
  stops: number;
  total: number;
  errors: string[];
}> {
  const { data: runRow } = await supabaseAdmin
    .from("jeepney_import_runs")
    .insert({ source: "osm", status: "running" })
    .select("id")
    .single();
  const runId = runRow?.id;

  const errors: string[] = [];
  let routesUpserted = 0;
  let stopsUpserted = 0;
  let total = 0;

  try {
    const relations = await fetchOverpass(QUERY);
    total = relations.length;

    const seenSlug = new Set<string>();
    const rows: Array<Record<string, unknown>> = [];
    const stopsByImportId = new Map<
      string,
      Array<{ name: string; lat: number; lng: number; position: number }>
    >();

    relations.forEach((rel, index) => {
      const tags = rel.tags ?? {};
      const name = (tags.name || tags.ref || "").trim();
      if (!name) return;

      const path: Array<{ lat: number; lng: number }> = [];
      const stops: Array<{ name: string; lat: number; lng: number; position: number }> = [];

      for (const member of rel.members ?? []) {
        if (member.type === "way" && member.geometry?.length) {
          for (const g of member.geometry) path.push({ lat: g.lat, lng: g.lon });
        } else if (
          member.type === "node" &&
          typeof member.lat === "number" &&
          typeof member.lon === "number" &&
          /stop|platform/.test(member.role || "")
        ) {
          stops.push({
            name: `Stop ${stops.length + 1}`,
            lat: member.lat,
            lng: member.lon,
            position: stops.length,
          });
        }
      }
      if (path.length < 2) return;

      const importId = `osm:relation:${rel.id}`;
      let slug = slugify(`${name}-${rel.id}`);
      if (!slug) slug = `jeepney-${rel.id}`;
      if (seenSlug.has(slug)) slug = `${slug}-${rel.id}`;
      seenSlug.add(slug);

      rows.push({
        operator_id: null,
        name: name.slice(0, 120),
        code: (tags.ref || "").slice(0, 24) || null,
        slug,
        colour: COLOURS[index % COLOURS.length],
        status: "published",
        path: thin(path, 600),
        operating_days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        fare_php: null,
        notes:
          "Community route imported from OpenStreetMap. Times and fares are not confirmed yet — an operator can claim this route to keep it accurate.",
        imported_from: "osm",
        import_source_id: importId,
        source_url: `https://www.openstreetmap.org/relation/${rel.id}`,
      });
      if (stops.length) stopsByImportId.set(importId, thin(stops, 60));
    });

    const chunkSize = 200;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error, data } = await supabaseAdmin
        .from("jeepney_routes")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert(chunk as any, { onConflict: "imported_from,import_source_id" })
        .select("id, import_source_id");
      if (error) {
        errors.push(`routes ${i}: ${error.message}`);
        continue;
      }
      routesUpserted += data?.length ?? 0;

      for (const route of data ?? []) {
        const stops = stopsByImportId.get(route.import_source_id as string);
        if (!stops?.length) continue;
        await supabaseAdmin.from("jeepney_stops").delete().eq("route_id", route.id);
        const { error: stopError } = await supabaseAdmin.from("jeepney_stops").insert(
          stops.map((s) => ({
            route_id: route.id,
            name: s.name,
            position: s.position,
            latitude: s.lat,
            longitude: s.lng,
          })),
        );
        if (stopError) errors.push(`stops ${route.id}: ${stopError.message}`);
        else stopsUpserted += stops.length;
      }
    }

    if (runId) {
      await supabaseAdmin
        .from("jeepney_import_runs")
        .update({
          status: errors.length && routesUpserted === 0 ? "failed" : "completed",
          routes_upserted: routesUpserted,
          stops_upserted: stopsUpserted,
          total_fetched: total,
          error: errors.length ? errors.join("; ").slice(0, 2000) : null,
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }

    return { routes: routesUpserted, stops: stopsUpserted, total, errors };
  } catch (e) {
    const msg = (e as Error).message;
    if (runId) {
      await supabaseAdmin
        .from("jeepney_import_runs")
        .update({ status: "failed", error: msg, finished_at: new Date().toISOString() })
        .eq("id", runId);
    }
    throw e;
  }
}
