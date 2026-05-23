// Server-only OSM business importer. Fetches PH businesses from Overpass and
// upserts them into `businesses` as unclaimed rows. Mirrors fuel-import.server.ts.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];

const OSM_BARANGAY_SENTINEL = "OSM-UNRESOLVED";

// Split into category-buckets so each Overpass query stays under the 180s timeout.
const QUERIES: Array<{ label: string; query: string }> = [
  {
    label: "shops",
    query: `[out:json][timeout:180];
area["ISO3166-1"="PH"][admin_level=2]->.ph;
(
  node["shop"](area.ph);
  way["shop"](area.ph);
);
out center tags;`,
  },
  {
    label: "food",
    query: `[out:json][timeout:180];
area["ISO3166-1"="PH"][admin_level=2]->.ph;
(
  node["amenity"~"^(restaurant|fast_food|cafe|bar|pub|bakery|food_court|ice_cream)$"](area.ph);
  way["amenity"~"^(restaurant|fast_food|cafe|bar|pub|bakery|food_court|ice_cream)$"](area.ph);
);
out center tags;`,
  },
  {
    label: "services",
    query: `[out:json][timeout:180];
area["ISO3166-1"="PH"][admin_level=2]->.ph;
(
  node["amenity"~"^(pharmacy|clinic|hospital|dentist|doctors|veterinary|bank|atm|post_office|laundry|car_repair|car_wash)$"](area.ph);
  way["amenity"~"^(pharmacy|clinic|hospital|dentist|doctors|veterinary|bank|atm|post_office|laundry|car_repair|car_wash)$"](area.ph);
);
out center tags;`,
  },
  {
    label: "offices_lodging",
    query: `[out:json][timeout:180];
area["ISO3166-1"="PH"][admin_level=2]->.ph;
(
  node["office"](area.ph);
  way["office"](area.ph);
  node["tourism"~"^(hotel|guest_house|hostel|motel|apartment)$"](area.ph);
  way["tourism"~"^(hotel|guest_house|hostel|motel|apartment)$"](area.ph);
);
out center tags;`,
  },
];

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function buildAddress(t: Record<string, string>): string | null {
  if (t["addr:full"]) return t["addr:full"];
  const parts = [
    [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" "),
    t["addr:city"] || t["addr:town"] || t["addr:village"] || t["addr:municipality"],
    t["addr:province"] || t["addr:state"],
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

// Map OSM tags → business_type enum value. Returns null to skip.
function mapType(t: Record<string, string>): string | null {
  const shop = t.shop;
  const amenity = t.amenity;
  const office = t.office;
  const tourism = t.tourism;

  // Skip fuel — handled by fuel-station importer
  if (amenity === "fuel") return null;

  if (amenity === "pharmacy" || shop === "chemist") return "pharmacy";
  if (shop === "bakery" || amenity === "bakery") return "bakery";
  if (shop === "hardware" || shop === "doityourself") return "hardware";
  if (shop === "laundry" || amenity === "laundry") return "laundry";
  if (shop === "hairdresser" || shop === "beauty" || shop === "barber") return "salon";
  if (shop === "car_repair" || amenity === "car_repair" || shop === "motorcycle_repair") return "repair_shop";
  if (shop === "convenience" || shop === "supermarket" || shop === "grocery") return "store";
  if (shop === "agrarian" || shop === "farm") return "agri_supply";

  if (amenity && /^(restaurant|fast_food|cafe|bar|pub|food_court|ice_cream)$/.test(amenity)) {
    return "restaurant";
  }
  if (amenity && /^(clinic|hospital|dentist|doctors|veterinary|bank|atm|post_office|car_wash)$/.test(amenity)) {
    return "service";
  }
  if (office) return "service";
  if (tourism) return "service";
  if (shop) return "store"; // generic shop fallback

  return null;
}

async function fetchOverpass(query: string, label: string): Promise<OsmElement[]> {
  let lastErr: Error | null = null;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "BarangayHubPH/1.0 (Lovable; +https://lovable.app) business-importer",
          Accept: "application/json",
        },
        body: "data=" + encodeURIComponent(query),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        lastErr = new Error(`Overpass ${label} ${url} ${res.status} ${body.slice(0, 120)}`);
        continue;
      }
      const json = (await res.json()) as { elements?: OsmElement[] };
      return json.elements ?? [];
    } catch (e) {
      lastErr = e as Error;
    }
  }
  throw lastErr ?? new Error(`All Overpass endpoints failed for ${label}`);
}

export async function runBusinessOsmSync(): Promise<{
  upserted: number;
  total: number;
  errors: string[];
}> {
  const { data: runRow } = await supabaseAdmin
    .from("business_import_runs")
    .insert({ source: "osm", status: "running" })
    .select("id")
    .single();
  const runId = runRow?.id;

  const errors: string[] = [];
  let upserted = 0;
  let totalFetched = 0;

  try {
    const seenSlug = new Set<string>();
    const seenImportId = new Set<string>();
    const allRows: Array<Record<string, unknown>> = [];

    for (const q of QUERIES) {
      try {
        const elements = await fetchOverpass(q.query, q.label);
        totalFetched += elements.length;

        for (const el of elements) {
          const lat = el.lat ?? el.center?.lat;
          const lon = el.lon ?? el.center?.lon;
          const tags = el.tags ?? {};
          if (typeof lat !== "number" || typeof lon !== "number") continue;
          const name = (tags.name || "").trim();
          if (!name) continue; // skip unnamed places — useless for a directory
          const type = mapType(tags);
          if (!type) continue;

          const importId = `osm:${el.type}:${el.id}`;
          if (seenImportId.has(importId)) continue;
          seenImportId.add(importId);

          let slug = slugify(`${name}-${el.type}-${el.id}`);
          if (seenSlug.has(slug)) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
          seenSlug.add(slug);

          const extraTags: string[] = [];
          if (tags.cuisine) extraTags.push(...tags.cuisine.split(";").map((s) => s.trim()).filter(Boolean));
          if (tags.brand) extraTags.push(tags.brand);

          allRows.push({
            name,
            slug,
            type,
            barangay_code: OSM_BARANGAY_SENTINEL,
            latitude: lat,
            longitude: lon,
            address: buildAddress(tags),
            description: tags.brand ? `Brand: ${tags.brand}` : null,
            contact_phone: tags.phone || tags["contact:phone"] || null,
            website: tags.website || tags["contact:website"] || null,
            hours: tags.opening_hours || null,
            tags: extraTags.slice(0, 8),
            is_published: true,
            is_claimed: false,
            owner_id: null,
            imported_from: "osm",
            import_source_id: importId,
          });
        }

        // Gentle delay between Overpass calls
        await new Promise((r) => setTimeout(r, 2000));
      } catch (e) {
        errors.push(`${q.label}: ${(e as Error).message}`);
      }
    }

    const chunkSize = 500;
    for (let i = 0; i < allRows.length; i += chunkSize) {
      const chunk = allRows.slice(i, i + chunkSize);
      const { error, count } = await supabaseAdmin
        .from("businesses")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert(chunk as any, {
          onConflict: "imported_from,import_source_id",
          count: "exact",
          ignoreDuplicates: false,
        });
      if (error) errors.push(`chunk ${i}: ${error.message}`);
      else upserted += count ?? chunk.length;
    }

    if (runId) {
      await supabaseAdmin
        .from("business_import_runs")
        .update({
          status: errors.length && upserted === 0 ? "failed" : "completed",
          businesses_upserted: upserted,
          total_fetched: totalFetched,
          error: errors.length ? errors.join("; ").slice(0, 2000) : null,
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }

    return { upserted, total: totalFetched, errors };
  } catch (e) {
    const msg = (e as Error).message;
    if (runId) {
      await supabaseAdmin
        .from("business_import_runs")
        .update({ status: "failed", error: msg, finished_at: new Date().toISOString() })
        .eq("id", runId);
    }
    throw e;
  }
}
