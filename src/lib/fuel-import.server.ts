// Server-only DOE fuel import logic. Imported by /api/public/hooks/fuel-sync.ts only.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ScrapeFormat = "markdown" | "html";

async function firecrawlScrape(url: string, formats: ScrapeFormat[] = ["markdown", "html"]) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY is not configured");
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats, onlyMainContent: true }),
  });
  if (!res.ok) throw new Error(`Firecrawl ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data?: { markdown?: string; html?: string } };
  return { markdown: json.data?.markdown ?? "", html: json.data?.html ?? "" };
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const FUEL_TYPE_MAP: Record<string, string> = {
  "diesel": "diesel",
  "diesel plus": "diesel",
  "gasoline (ron 91)": "gasoline_91",
  "ron 91": "gasoline_91",
  "gasoline (ron 95)": "gasoline_95",
  "ron 95": "gasoline_95",
  "gasoline (ron 97)": "gasoline_97",
  "ron 97": "gasoline_97",
  "gasoline (ron 100)": "gasoline_97",
};

function normFuel(raw: string): string | null {
  const k = raw.trim().toLowerCase().replace(/\s+/g, " ");
  for (const [needle, val] of Object.entries(FUEL_TYPE_MAP)) {
    if (k.includes(needle)) return val;
  }
  return null;
}

// Parse markdown table from DOE Metro Manila / Regional common posted prices page.
// Expected shape (rough): rows like "| Brand | Diesel | Gas 91 | Gas 95 | Gas 97 |"
function parsePriceTable(markdown: string, regionName: string): Array<{
  brand: string; fuel_type: string; price: number; region_name: string;
}> {
  const lines = markdown.split("\n");
  const out: Array<{ brand: string; fuel_type: string; price: number; region_name: string }> = [];
  let headers: string[] | null = null;

  for (const line of lines) {
    if (!line.trim().startsWith("|")) { headers = null; continue; }
    const cells = line.split("|").map((c) => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1);
    if (cells.length < 2) continue;
    if (cells.every((c) => /^[-:\s]+$/.test(c))) continue; // separator row
    if (!headers) { headers = cells; continue; }
    const brand = cells[0];
    if (!brand || /brand|company|oil firm/i.test(brand)) continue;
    for (let i = 1; i < cells.length && i < headers.length; i++) {
      const ft = normFuel(headers[i]);
      const num = parseFloat(cells[i].replace(/[^\d.]/g, ""));
      if (!ft || !isFinite(num) || num <= 0 || num > 500) continue;
      out.push({ brand: brand.replace(/\*/g, "").trim(), fuel_type: ft, price: num, region_name: regionName });
    }
  }
  return out;
}

const DOE_PRICE_SOURCES: Array<{ url: string; region_code: string; region_name: string }> = [
  { url: "https://www.doe.gov.ph/retail-pump-prices-metro-manila", region_code: "NCR", region_name: "Metro Manila" },
  { url: "https://www.doe.gov.ph/retail-pump-prices-north-luzon", region_code: "LUZ-N", region_name: "North Luzon" },
  { url: "https://www.doe.gov.ph/retail-pump-prices-south-luzon", region_code: "LUZ-S", region_name: "South Luzon" },
  { url: "https://www.doe.gov.ph/retail-pump-prices-visayas", region_code: "VIS", region_name: "Visayas" },
  { url: "https://www.doe.gov.ph/retail-pump-prices-mindanao", region_code: "MIN", region_name: "Mindanao" },
];

export async function runFuelSync(): Promise<{ stations: number; prices: number; errors: string[] }> {
  const { data: runRow } = await supabaseAdmin
    .from("fuel_import_runs")
    .insert({ source: "doe", status: "running" })
    .select("id")
    .single();
  const runId = runRow?.id;
  const errors: string[] = [];
  let pricesUpserted = 0;
  const stationsUpserted = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const src of DOE_PRICE_SOURCES) {
    try {
      const { markdown } = await firecrawlScrape(src.url, ["markdown"]);
      const rows = parsePriceTable(markdown, src.region_name);
      if (!rows.length) {
        errors.push(`No rows parsed from ${src.region_code}`);
        continue;
      }
      const payload = rows.map((r) => ({
        source: "doe",
        brand: r.brand,
        fuel_type: r.fuel_type,
        region_code: src.region_code,
        region_name: r.region_name,
        price: r.price,
        snapshot_date: today,
      }));
      const { error, count } = await supabaseAdmin
        .from("fuel_price_snapshots")
        .upsert(payload, { onConflict: "source,brand,fuel_type,region_code,snapshot_date", count: "exact" });
      if (error) errors.push(`${src.region_code}: ${error.message}`);
      else pricesUpserted += count ?? payload.length;
    } catch (e) {
      errors.push(`${src.region_code}: ${(e as Error).message}`);
    }
  }

  // Station list (LFRO) is large and not always table-formatted; left as a future expansion —
  // for now stations grow via user contributions + claim flow. The price snapshots are the daily signal.

  if (runId) {
    await supabaseAdmin
      .from("fuel_import_runs")
      .update({
        status: errors.length && pricesUpserted === 0 ? "failed" : "completed",
        stations_upserted: stationsUpserted,
        prices_upserted: pricesUpserted,
        error: errors.length ? errors.join("; ").slice(0, 2000) : null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
  }

  return { stations: stationsUpserted, prices: pricesUpserted, errors };
}

// Slug helper kept exported so tests can re-use (unused at runtime here).
export const _internals = { slugify };

// ---------------- OSM station import ----------------

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];

const OVERPASS_QUERY = `[out:json][timeout:180];
area["ISO3166-1"="PH"][admin_level=2]->.ph;
(
  node["amenity"="fuel"](area.ph);
  way["amenity"="fuel"](area.ph);
);
out center tags;`;

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function titleCase(s: string) {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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

async function fetchOverpass(): Promise<OsmElement[]> {
  let lastErr: Error | null = null;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(OVERPASS_QUERY),
      });
      if (!res.ok) {
        lastErr = new Error(`Overpass ${url} ${res.status}`);
        continue;
      }
      const json = (await res.json()) as { elements?: OsmElement[] };
      return json.elements ?? [];
    } catch (e) {
      lastErr = e as Error;
    }
  }
  throw lastErr ?? new Error("All Overpass endpoints failed");
}

// barangay_code is NOT NULL on businesses; use a sentinel for OSM-imported rows.
// There's no FK constraint, so this is safe. Local owners can refine on claim.
const OSM_BARANGAY_SENTINEL = "OSM-UNRESOLVED";

export async function runStationSync(): Promise<{ upserted: number; total: number; errors: string[] }> {
  const { data: runRow } = await supabaseAdmin
    .from("fuel_import_runs")
    .insert({ source: "osm", status: "running" })
    .select("id")
    .single();
  const runId = runRow?.id;
  const errors: string[] = [];
  let upserted = 0;

  try {
    const elements = await fetchOverpass();
    const seen = new Set<string>();
    const rows = elements
      .map((el) => {
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        const tags = el.tags ?? {};
        if (typeof lat !== "number" || typeof lon !== "number") return null;
        const brandRaw = tags.brand || tags.operator || "";
        const brand = brandRaw ? titleCase(brandRaw) : "";
        const name = tags.name || (brand ? `${brand} Station` : "Fuel station");
        const importId = `osm:${el.type}:${el.id}`;
        let slug = slugify(`${name}-${el.type}-${el.id}`);
        if (seen.has(slug)) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
        seen.add(slug);
        return {
          name,
          slug,
          type: "fuel_station" as const,
          barangay_code: OSM_BARANGAY_SENTINEL,
          latitude: lat,
          longitude: lon,
          address: buildAddress(tags),
          description: brand ? `Brand: ${brand}` : null,
          is_published: true,
          is_claimed: false,
          owner_id: null,
          imported_from: "osm",
          import_source_id: importId,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error, count } = await supabaseAdmin
        .from("businesses")
        .upsert(chunk, { onConflict: "imported_from,import_source_id", count: "exact", ignoreDuplicates: false });
      if (error) errors.push(`chunk ${i}: ${error.message}`);
      else upserted += count ?? chunk.length;
    }

    if (runId) {
      await supabaseAdmin
        .from("fuel_import_runs")
        .update({
          status: errors.length && upserted === 0 ? "failed" : "completed",
          stations_upserted: upserted,
          error: errors.length ? errors.join("; ").slice(0, 2000) : null,
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }
    return { upserted, total: rows.length, errors };
  } catch (e) {
    const msg = (e as Error).message;
    if (runId) {
      await supabaseAdmin
        .from("fuel_import_runs")
        .update({ status: "failed", error: msg, finished_at: new Date().toISOString() })
        .eq("id", runId);
    }
    throw e;
  }
}
