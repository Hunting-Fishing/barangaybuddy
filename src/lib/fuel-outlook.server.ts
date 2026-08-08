// Server-only: gathers *predicted* upcoming Philippine fuel price adjustments
// (the weekly oil price advisory published every Monday, effective Tuesday) from
// public news coverage, structures it with AI, and stores it for the /fuel page.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiExtractJson, firecrawlSearch, sourceName } from "@/lib/fuel-news.server";

type OutlookRow = {
  source: string;
  source_url: string;
  fuel_type: string;
  direction: "up" | "down" | "steady";
  amount_per_liter: number | null;
  effective_date: string | null;
  note: string | null;
};

type AiOutlook = {
  effective_date?: string | null;
  items?: Array<{
    fuel_type?: string;
    direction?: string;
    amount_per_liter?: number | null;
    note?: string | null;
  }>;
};

const SEARCH_QUERIES = [
  "oil price hike rollback Philippines gasoline diesel kerosene per liter effective Tuesday",
  "DOE oil price adjustment this week Philippines fuel price advisory",
];

const SYSTEM = `You read Philippine fuel-price news and return STRICT JSON only.
Schema: {"effective_date":"YYYY-MM-DD or null","items":[{"fuel_type":"gasoline|diesel|kerosene","direction":"up|down|steady","amount_per_liter":number|null,"note":"one short sentence"}]}
Rules: report only the UPCOMING/most recent weekly adjustment. amount_per_liter is the absolute peso change per liter (positive number). Never invent numbers. If nothing is stated, return {"items":[]}.`;

function normFuel(v: string | undefined): string | null {
  const l = (v ?? "").toLowerCase();
  if (l.includes("diesel")) return "diesel";
  if (l.includes("kerosene")) return "kerosene";
  if (l.includes("gasoline") || l.includes("unleaded")) return "gasoline";
  return null;
}

export async function runFuelOutlookSync(): Promise<{ rows: number; errors: string[] }> {
  const errors: string[] = [];
  const collected: OutlookRow[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set<string>();

  for (const query of SEARCH_QUERIES) {
    let hits: Awaited<ReturnType<typeof firecrawlSearch>> = [];
    try {
      hits = await firecrawlSearch(query, { limit: 4, tbs: "qdr:w" });
    } catch (e) {
      errors.push((e as Error).message);
      continue;
    }

    for (const hit of hits) {
      try {
        const parsed = await aiExtractJson<AiOutlook>(
          SYSTEM,
          `Article URL: ${hit.url}\nTitle: ${hit.title}\n\n${hit.text}`,
        );
        for (const item of parsed?.items ?? []) {
          const fuel = normFuel(item.fuel_type);
          if (!fuel) continue;
          const dir =
            item.direction === "down" || item.direction === "up" ? item.direction : "steady";
          const amount =
            typeof item.amount_per_liter === "number" && isFinite(item.amount_per_liter)
              ? Math.abs(item.amount_per_liter)
              : null;
          if (amount !== null && (amount <= 0 || amount > 20)) continue;

          const src = sourceName(hit.url);
          const effective = parsed?.effective_date ?? today;
          const key = `${src}:${fuel}:${effective}`;
          if (seen.has(key)) continue;
          seen.add(key);

          collected.push({
            source: src,
            source_url: hit.url,
            fuel_type: fuel,
            direction: dir,
            amount_per_liter: amount,
            effective_date: effective,
            note: (item.note ?? "").slice(0, 240) || null,
          });
        }
      } catch (e) {
        errors.push(`${hit.url}: ${(e as Error).message}`);
      }
    }

    if (collected.length >= 6) break;
  }

  if (collected.length) {
    const { error } = await supabaseAdmin
      .from("fuel_price_outlooks")
      .upsert(
        collected.map((r) => ({ ...r, fetched_at: new Date().toISOString() })),
        { onConflict: "source,fuel_type,effective_date" },
      );
    if (error) errors.push(error.message);
  }

  return { rows: collected.length, errors };
}
