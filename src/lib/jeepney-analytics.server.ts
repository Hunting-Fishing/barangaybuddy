import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  DAYS,
  SEGMENT_KM,
  distanceAlongPathKm,
  parsePath,
  pathLengthKm,
  phHolidayKey,
  type LatLng,
} from "@/lib/jeepney";

type Position = {
  route_id: string;
  latitude: number;
  longitude: number;
  speed_kph: number | null;
  recorded_at: string;
};

function admin() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Manila-time parts for a UTC timestamp. */
function manilaParts(iso: string) {
  const d = new Date(iso);
  const manila = new Date(d.getTime() + 8 * 3600 * 1000);
  return {
    hour: manila.getUTCHours(),
    dow: DAYS[(manila.getUTCDay() + 6) % 7]!,
    month: `${manila.getUTCFullYear()}-${String(manila.getUTCMonth() + 1).padStart(2, "0")}`,
    holiday: phHolidayKey(d),
    day: manila.toISOString().slice(0, 10),
  };
}

type Bucket = { pings: number; speed: number; speedSamples: number; days: Set<string> };

function bucket(map: Map<string, Bucket>, key: string): Bucket {
  let b = map.get(key);
  if (!b) {
    b = { pings: 0, speed: 0, speedSamples: 0, days: new Set() };
    map.set(key, b);
  }
  return b;
}

/**
 * Rebuilds busy-time buckets and per-segment speeds for every live route from
 * the last 90 days of GPS pings.
 */
export async function runJeepneyRollup(): Promise<{
  routes: number;
  statRows: number;
  segmentRows: number;
  errors: string[];
}> {
  const supabase = admin();
  const errors: string[] = [];
  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();

  const { data: routes, error: routeError } = await supabase
    .from("jeepney_routes")
    .select("id, path")
    .in("status", ["published", "suspended"]);
  if (routeError) return { routes: 0, statRows: 0, segmentRows: 0, errors: [routeError.message] };

  let statRows = 0;
  let segmentRows = 0;

  for (const route of routes ?? []) {
    try {
      const path: LatLng[] = parsePath((route as { path: unknown }).path);
      const { data: pings } = await supabase
        .from("jeepney_positions")
        .select("route_id, latitude, longitude, speed_kph, recorded_at")
        .eq("route_id", route.id)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: false })
        .limit(20000);

      const rows = (pings ?? []) as Position[];
      if (!rows.length) continue;

      const { count: tripCount } = await supabase
        .from("jeepney_trips")
        .select("id", { count: "exact", head: true })
        .eq("route_id", route.id)
        .gte("started_at", since);

      const hourDow = new Map<string, Bucket>();
      const months = new Map<string, Bucket>();
      const holidays = new Map<string, Bucket>();
      const segments = new Map<string, { speed: number; samples: number }>();

      for (const ping of rows) {
        const parts = manilaParts(ping.recorded_at);
        const speed = Number(ping.speed_kph);
        const hasSpeed = Number.isFinite(speed) && speed >= 0 && speed < 90;

        for (const [map, key] of [
          [hourDow, `${parts.dow}-${parts.hour}`],
          [months, parts.month],
          [holidays, parts.holiday],
        ] as [Map<string, Bucket>, string][]) {
          const b = bucket(map, key);
          b.pings += 1;
          b.days.add(parts.day);
          if (hasSpeed) {
            b.speed += speed;
            b.speedSamples += 1;
          }
        }

        if (path.length >= 2 && hasSpeed) {
          const index = Math.max(
            0,
            Math.floor(
              distanceAlongPathKm(path, {
                lat: Number(ping.latitude),
                lng: Number(ping.longitude),
              }) / SEGMENT_KM,
            ),
          );
          const key = `${index}-${parts.hour}`;
          const s = segments.get(key) ?? { speed: 0, samples: 0 };
          s.speed += speed;
          s.samples += 1;
          segments.set(key, s);
        }
      }

      const maxPings = Math.max(...[...hourDow.values()].map((b) => b.pings), 1);
      const statPayload = [
        ...[...hourDow.entries()].map(([key, b]) => ({ type: "hour_dow", key, b })),
        ...[...months.entries()].map(([key, b]) => ({ type: "month", key, b })),
        ...[...holidays.entries()].map(([key, b]) => ({ type: "holiday", key, b })),
      ].map(({ type, key, b }) => ({
        route_id: route.id,
        bucket_type: type,
        bucket_key: key,
        ping_count: b.pings,
        trip_count: type === "hour_dow" ? b.days.size : (tripCount ?? 0),
        avg_speed_kph: b.speedSamples ? Number((b.speed / b.speedSamples).toFixed(1)) : null,
        busy_score: type === "hour_dow" ? Number((b.pings / maxPings).toFixed(3)) : null,
        updated_at: new Date().toISOString(),
      }));

      if (statPayload.length) {
        const { error } = await supabase
          .from("jeepney_route_stats")
          .upsert(statPayload, { onConflict: "route_id,bucket_type,bucket_key" });
        if (error) errors.push(`stats ${route.id}: ${error.message}`);
        else statRows += statPayload.length;
      }

      const segmentPayload = [...segments.entries()].map(([key, s]) => {
        const [index, hour] = key.split("-").map(Number);
        return {
          route_id: route.id,
          segment_index: index!,
          hour: hour!,
          avg_speed_kph: Number((s.speed / s.samples).toFixed(1)),
          sample_count: s.samples,
          updated_at: new Date().toISOString(),
        };
      });

      if (segmentPayload.length) {
        const { error } = await supabase
          .from("jeepney_segment_stats")
          .upsert(segmentPayload, { onConflict: "route_id,segment_index,hour" });
        if (error) errors.push(`segments ${route.id}: ${error.message}`);
        else segmentRows += segmentPayload.length;
      }

      void pathLengthKm(path);
    } catch (e) {
      errors.push(`${route.id}: ${(e as Error).message}`);
    }
  }

  return { routes: routes?.length ?? 0, statRows, segmentRows, errors };
}
