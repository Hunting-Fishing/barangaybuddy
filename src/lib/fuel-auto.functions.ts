import { createServerFn } from "@tanstack/react-start";

export type FuelOutlookRow = {
  source: string;
  source_url: string;
  fuel_type: string;
  direction: string;
  amount_per_liter: number | null;
  note: string | null;
  fetched_at: string;
};

export type FuelAutoRefreshResult = {
  refreshed: boolean;
  lastSync: string | null;
  outlook: FuelOutlookRow[];
};

// Public: called on every /fuel page load. Internally throttled so we only hit
// upstream sources a few times a day — no manual admin action required.
const PRICE_STALE_MS = 3 * 60 * 60 * 1000; // 3 hours
const OUTLOOK_STALE_MS = 6 * 60 * 60 * 1000; // 6 hours

export const autoRefreshFuelData = createServerFn({ method: "POST" }).handler(
  async (): Promise<FuelAutoRefreshResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: lastRun } = await supabaseAdmin
      .from("fuel_import_runs")
      .select("finished_at, started_at, status")
      .eq("source", "doe")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastStarted = lastRun?.started_at ? new Date(lastRun.started_at).getTime() : 0;
    const priceStale = Date.now() - lastStarted > PRICE_STALE_MS;

    let refreshed = false;
    if (priceStale) {
      try {
        const { runFuelSync } = await import("@/lib/fuel-import.server");
        await runFuelSync();
        refreshed = true;
      } catch {
        // Non-fatal: page still renders the last known prices.
      }
    }

    const { data: newestOutlook } = await supabaseAdmin
      .from("fuel_price_outlooks")
      .select("fetched_at")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const outlookAge = newestOutlook?.fetched_at
      ? Date.now() - new Date(newestOutlook.fetched_at).getTime()
      : Number.POSITIVE_INFINITY;

    if (outlookAge > OUTLOOK_STALE_MS) {
      try {
        const { runFuelOutlookSync } = await import("@/lib/fuel-outlook.server");
        await runFuelOutlookSync();
      } catch {
        // Non-fatal.
      }
    }

    const { data: outlook } = await supabaseAdmin
      .from("fuel_price_outlooks")
      .select("source, source_url, fuel_type, direction, amount_per_liter, note, fetched_at")
      .gte("effective_date", new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .order("fetched_at", { ascending: false })
      .limit(12);


    const { data: completed } = await supabaseAdmin
      .from("fuel_import_runs")
      .select("finished_at")
      .eq("source", "doe")
      .eq("status", "completed")
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      refreshed,
      lastSync: completed?.finished_at ?? null,
      outlook: (outlook ?? []) as FuelOutlookRow[],
    };
  },
);
