import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Administrator access required.");
}

export const runFuelPriceSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { runFuelSync } = await import("@/lib/fuel-import.server");
    return await runFuelSync();
  });

export const runFuelStationSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { runStationSync } = await import("@/lib/fuel-import.server");
    return await runStationSync();
  });

export const runBusinessImportSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { runBusinessOsmSync } = await import("@/lib/business-osm-import.server");
    return await runBusinessOsmSync();
  });

export const runJeepneyRouteImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { runJeepneyRouteSync } = await import("@/lib/jeepney-osm-import.server");
    return await runJeepneyRouteSync();
  });
