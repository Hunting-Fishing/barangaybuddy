import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Gauge, TrendingUp } from "lucide-react";
import {
  CONGESTION_COLOURS,
  CONGESTION_LABELS,
  DAYS,
  HOLIDAY_LABELS,
  busyLabel,
  congestionLevel,
  hourLabel,
  type RouteStat,
  type SegmentSpeed,
} from "@/lib/jeepney";

const HOURS = Array.from({ length: 18 }, (_, i) => i + 4); // 4am – 9pm

function manilaHour(): number {
  const now = new Date();
  return new Date(now.getTime() + (8 * 60 + now.getTimezoneOffset()) * 60000).getHours();
}

export function JeepneyInsightsCard({
  routeId,
  title = "Busy times & traffic",
}: {
  routeId: string;
  title?: string;
}) {
  const [stats, setStats] = useState<RouteStat[]>([]);
  const [segments, setSegments] = useState<SegmentSpeed[]>([]);
  const [loading, setLoading] = useState(true);
  const hour = manilaHour();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [{ data: statRows }, { data: segmentRows }] = await Promise.all([
        supabase
          .from("jeepney_route_stats")
          .select("bucket_type, bucket_key, ping_count, trip_count, avg_speed_kph, busy_score")
          .eq("route_id", routeId),
        supabase
          .from("jeepney_segment_stats")
          .select("segment_index, hour, avg_speed_kph")
          .eq("route_id", routeId)
          .eq("hour", hour),
      ]);
      if (cancelled) return;
      setStats((statRows ?? []) as RouteStat[]);
      setSegments((segmentRows ?? []) as SegmentSpeed[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [routeId, hour]);

  const hourDow = useMemo(() => {
    const map = new Map<string, RouteStat>();
    stats.filter((s) => s.bucket_type === "hour_dow").forEach((s) => map.set(s.bucket_key, s));
    return map;
  }, [stats]);

  const busiest = useMemo(() => {
    const rows = stats.filter((s) => s.bucket_type === "hour_dow");
    if (!rows.length) return null;
    const byDay = new Map<string, number>();
    rows.forEach((r) => {
      const day = r.bucket_key.split("-")[0]!;
      byDay.set(day, (byDay.get(day) ?? 0) + r.ping_count);
    });
    const topDay = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0]!;
    const topHour = rows.slice().sort((a, b) => b.ping_count - a.ping_count)[0]!;
    const quietHour = rows.slice().sort((a, b) => a.ping_count - b.ping_count)[0]!;
    return {
      day: topDay[0],
      hour: Number(topHour.bucket_key.split("-")[1]),
      quiet: Number(quietHour.bucket_key.split("-")[1]),
    };
  }, [stats]);

  const months = useMemo(
    () =>
      stats
        .filter((s) => s.bucket_type === "month")
        .sort((a, b) => a.bucket_key.localeCompare(b.bucket_key))
        .slice(-6),
    [stats],
  );

  const holidays = useMemo(
    () => stats.filter((s) => s.bucket_type === "holiday" && s.bucket_key !== "regular"),
    [stats],
  );

  const regular = useMemo(
    () => stats.find((s) => s.bucket_type === "holiday" && s.bucket_key === "regular") ?? null,
    [stats],
  );

  const traffic = useMemo(() => {
    const speeds = segments
      .map((s) => Number(s.avg_speed_kph))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!speeds.length) return null;
    const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const heavy = segments.filter((s) => congestionLevel(Number(s.avg_speed_kph)) === "heavy").length;
    return { avg, heavy, level: congestionLevel(avg) };
  }, [segments]);

  if (loading) {
    return (
      <Card className="p-4 text-xs text-muted-foreground">Loading route insights…</Card>
    );
  }

  if (!stats.length) {
    return (
      <Card className="space-y-1 p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Activity className="h-4 w-4" /> {title}
        </p>
        <p className="text-xs text-muted-foreground">
          We need about a week of tracked trips before busy times and traffic patterns appear here.
          Go live on each shift and the chart builds itself.
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-4">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Activity className="h-4 w-4" /> {title}
        </p>
        {busiest && (
          <p className="mt-1 text-xs text-muted-foreground">
            Busiest on <strong>{busiest.day}</strong> around{" "}
            <strong>{hourLabel(busiest.hour)}</strong> · quietest around {hourLabel(busiest.quiet)}.
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-[2px] text-[10px]">
          <thead>
            <tr>
              <th className="w-8" />
              {HOURS.map((h) => (
                <th key={h} className="font-normal text-muted-foreground">
                  {h % 3 === 0 ? hourLabel(h) : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day) => (
              <tr key={day}>
                <td className="pr-1 text-right text-muted-foreground">{day}</td>
                {HOURS.map((h) => {
                  const cell = hourDow.get(`${day}-${h}`);
                  const score = Number(cell?.busy_score ?? 0);
                  return (
                    <td key={h}>
                      <div
                        title={`${day} ${hourLabel(h)} — ${cell ? busyLabel(score) : "no data"}`}
                        className="h-4 w-full min-w-[10px] rounded-[3px]"
                        style={{
                          background: cell
                            ? `color-mix(in srgb, var(--color-primary, #f59e0b) ${Math.round(
                                15 + score * 85,
                              )}%, transparent)`
                            : "hsl(var(--muted))",
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-md border border-border p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Gauge className="h-4 w-4" /> Traffic right now ({hourLabel(hour)})
        </p>
        {traffic ? (
          <>
            <p className="mt-1 flex items-center gap-2 text-sm">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: CONGESTION_COLOURS[traffic.level] }}
              />
              {CONGESTION_LABELS[traffic.level]} · about {traffic.avg.toFixed(0)} km/h typical
            </p>
            {traffic.heavy > 0 && (
              <p className="text-xs text-muted-foreground">
                {traffic.heavy} slow stretch{traffic.heavy === 1 ? "" : "es"} along this route at
                this hour — allow extra time.
              </p>
            )}
          </>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            No speed readings for this hour yet.
          </p>
        )}
      </div>

      {months.length > 1 && (
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <TrendingUp className="h-4 w-4" /> Monthly trend
          </p>
          <div className="mt-2 flex items-end gap-1.5">
            {months.map((m) => {
              const max = Math.max(...months.map((x) => x.ping_count), 1);
              return (
                <div key={m.bucket_key} className="flex-1 text-center">
                  <div
                    className="mx-auto w-full rounded-t bg-primary/70"
                    style={{ height: `${Math.max(6, (m.ping_count / max) * 56)}px` }}
                    title={`${m.bucket_key}: ${m.ping_count} readings`}
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {m.bucket_key.slice(5)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {holidays.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-semibold">Holiday patterns</p>
          <div className="flex flex-wrap gap-1.5">
            {holidays.map((h) => {
              const base = Number(regular?.avg_speed_kph ?? 0);
              const speed = Number(h.avg_speed_kph ?? 0);
              const delta = base && speed ? Math.round(((speed - base) / base) * 100) : null;
              return (
                <Badge key={h.bucket_key} variant="secondary">
                  {HOLIDAY_LABELS[h.bucket_key] ?? h.bucket_key}
                  {delta !== null
                    ? delta < 0
                      ? ` · ${Math.abs(delta)}% slower`
                      : ` · ${delta}% faster`
                    : ""}
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
