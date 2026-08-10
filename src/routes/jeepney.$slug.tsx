import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bell, Bus, Locate, Radio, TriangleAlert, Wrench } from "lucide-react";
import { JeepneyFollowButton } from "@/components/jeepney-follow-button";
import { JeepneyClaimDialog } from "@/components/jeepney-claim-dialog";
import { JeepneyInsightsCard } from "@/components/jeepney-insights-card";

import {
  CONGESTION_COLOURS,
  CONGESTION_LABELS,
  etaMinutesWithTraffic,
  etaRangeLabel,
  formatPhpAmount,
  formatTime,
  haversineKm,
  headwayLabel,
  isLive,
  parsePath,
  segmentSpeedMap,
  type JeepneyPosition,
  type JeepneyRoute,
  type JeepneyStop,
  type LatLng,
  type SegmentSpeed,
} from "@/lib/jeepney";


const JeepneyMap = lazy(() => import("@/components/jeepney-map"));

export const Route = createFileRoute("/jeepney/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Jeepney route ${params.slug.replace(/-[a-z0-9]{5}$/, "").replace(/-/g, " ")} — schedule & live map` },
      {
        name: "description",
        content:
          "Jeepney route map with stops, fare, first run, last run and last pickup times, plus live tracking when the jeepney is on the road.",
      },
      { property: "og:title", content: "Jeepney route — schedule & live map" },
      {
        property: "og:description",
        content: "Stops, fares and live jeepney tracking on Barangay Buddy.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JeepneyRoutePage,
  errorComponent: () => (
    <div className="container mx-auto px-4 py-16 text-center text-sm text-muted-foreground">
      This route could not be loaded.
    </div>
  ),
  notFoundComponent: () => (
    <div className="container mx-auto px-4 py-16 text-center text-sm text-muted-foreground">
      Route not found.
    </div>
  ),
});

type RouteWithStops = JeepneyRoute & { stops: JeepneyStop[]; operator: string | null };

type RouteAlert = {
  id: string;
  kind: "breakdown" | "repaired";
  headline: string;
  message: string | null;
  created_at: string;
};


function JeepneyRoutePage() {
  const { slug } = Route.useParams();
  const [route, setRoute] = useState<RouteWithStops | null>(null);
  const [position, setPosition] = useState<JeepneyPosition | null>(null);
  const [me, setMe] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<RouteAlert[]>([]);
  const [segmentRows, setSegmentRows] = useState<SegmentSpeed[]>([]);
  const currentHour = useMemo(() => {
    const now = new Date();
    return new Date(now.getTime() + (8 * 60 + now.getTimezoneOffset()) * 60000).getHours();
  }, []);


  useEffect(() => {
    void load();
    const timer = setInterval(() => void loadLive(), 15000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function load() {
    const { data } = await supabase
      .from("jeepney_routes")
      .select("*, jeepney_stops(*), jeepney_operators(display_name)")
      .eq("slug", slug)
      .in("status", ["published", "suspended"])
      .maybeSingle();
    if (!data) {
      setRoute(null);
      setLoading(false);
      return;
    }
    const parsed: RouteWithStops = {
      ...(data as any),
      path: parsePath((data as any).path),
      stops: ((data as any).jeepney_stops ?? []).sort(
        (a: JeepneyStop, b: JeepneyStop) => a.position - b.position,
      ),
      operator: (data as any).jeepney_operators?.display_name ?? null,
    };
    setRoute(parsed);
    setLoading(false);
    void loadLive(parsed.id);
    void loadAlerts(parsed.id);
    void loadSegments(parsed.id);
  }

  async function loadSegments(routeId: string) {
    const { data } = await supabase
      .from("jeepney_segment_stats")
      .select("segment_index, hour, avg_speed_kph")
      .eq("route_id", routeId)
      .eq("hour", currentHour);
    setSegmentRows((data ?? []) as SegmentSpeed[]);
  }


  async function loadAlerts(routeId: string) {
    const { data } = await supabase
      .from("jeepney_route_alerts")
      .select("id, kind, headline, message, created_at")
      .eq("route_id", routeId)
      .order("created_at", { ascending: false })
      .limit(5);
    setAlerts((data ?? []) as RouteAlert[]);
  }


  async function loadLive(routeId?: string) {
    const id = routeId ?? route?.id;
    if (!id) return;
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("jeepney_positions")
      .select("*")
      .eq("route_id", id)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: false })
      .limit(1);
    setPosition((data?.[0] as JeepneyPosition) ?? null);
  }

  function locate() {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  const nearestStop = useMemo(() => {
    if (!route || !me || !route.stops.length) return null;
    return route.stops
      .map((s) => ({
        stop: s,
        km: haversineKm({ lat: Number(s.latitude), lng: Number(s.longitude) }, me),
      }))
      .sort((a, b) => a.km - b.km)[0]!;
  }, [route, me]);

  const speeds = useMemo(() => segmentSpeedMap(segmentRows, currentHour), [segmentRows, currentHour]);

  const eta = useMemo(() => {
    if (!route || !position || !nearestStop || !isLive(position.recorded_at)) return null;
    return etaMinutesWithTraffic(
      route.path,
      { lat: Number(position.latitude), lng: Number(position.longitude) },
      { lat: Number(nearestStop.stop.latitude), lng: Number(nearestStop.stop.longitude) },
      position.speed_kph,
      speeds,
    );
  }, [route, position, nearestStop, speeds]);


  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto px-4 py-16 text-sm text-muted-foreground">Loading…</main>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto px-4 py-16">
          <p className="text-sm text-muted-foreground">This jeepney route is not published.</p>
          <Button variant="link" asChild className="px-0">
            <Link to="/jeepney">Back to the Jeepney Planner</Link>
          </Button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const onRoad = position && isLive(position.recorded_at);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-6">
        <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2">
          <Link to="/jeepney">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> All jeepney routes
          </Link>
        </Button>

        <header className="mb-4">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{route.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {route.code ? `Route ${route.code} · ` : ""}
            {route.operator
              ? `Operated by ${route.operator}`
              : "Community route — not claimed by an operator yet"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{formatPhpAmount(route.fare_php)} fare</Badge>
            {route.fare_note && <Badge variant="secondary">{route.fare_note}</Badge>}
            {headwayLabel(route) && <Badge variant="secondary">{headwayLabel(route)}</Badge>}
            <Badge variant={onRoad ? "default" : "secondary"} className="gap-1">
              <Radio className="h-3 w-3" /> {onRoad ? "Live now" : "Not broadcasting"}
            </Badge>
            {route.status === "suspended" && (
              <Badge variant="destructive" className="gap-1">
                <TriangleAlert className="h-3 w-3" /> Out of service
              </Badge>
            )}
            <JeepneyFollowButton routeId={route.id} routeName={route.name} />
            {!route.operator_id && (
              <JeepneyClaimDialog routeId={route.id} routeName={route.name} onSubmitted={load} />
            )}
          </div>

        </header>

        {route.status === "suspended" && (
          <Card className="mb-4 border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p className="font-semibold">This jeepney has reported a breakdown.</p>
            <p className="text-muted-foreground">
              {alerts.find((a) => a.kind === "breakdown")?.message ??
                "The operator paused this route. Monitor it to be alerted the moment it's back."}
            </p>
          </Card>
        )}


        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-2">
            <ClientOnly fallback={<div className="h-[60vh] rounded-xl border border-border" />}>
              <Suspense fallback={<div className="h-[60vh] rounded-xl border border-border" />}>
                <JeepneyMap
                  routes={[route]}
                  live={position ? { [route.id]: position } : {}}
                  userLocation={me}
                  height="60vh"
                  congestion={speeds.size ? { [route.id]: speeds } : {}}
                />
              </Suspense>
            </ClientOnly>
            {speeds.size > 0 && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>Typical traffic at this hour:</span>
                {(["free", "slow", "heavy"] as const).map((level) => (
                  <span key={level} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-4 rounded-full"
                      style={{ background: CONGESTION_COLOURS[level] }}
                    />
                    {CONGESTION_LABELS[level]}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">

            <Card className="space-y-2 p-4">
              <p className="text-sm font-semibold">Daily schedule</p>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">First run</dt>
                  <dd className="font-medium">{formatTime(route.first_run)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Last run</dt>
                  <dd className="font-medium">{formatTime(route.last_run)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Last pickup</dt>
                  <dd className="font-medium">{formatTime(route.last_pickup)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Trips per day</dt>
                  <dd className="font-medium">{route.trips_per_day ?? "—"}</dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">
                Runs on {route.operating_days.join(", ")}
                {route.avg_trip_minutes ? ` · about ${route.avg_trip_minutes} min per trip` : ""}
              </p>
            </Card>

            <Card className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Arrival</p>
                <Button size="sm" variant="outline" onClick={locate}>
                  <Locate className="mr-1.5 h-4 w-4" /> Use my location
                </Button>
              </div>
              {!me && (
                <p className="text-xs text-muted-foreground">
                  Share your location to see the nearest stop and how soon the jeepney reaches it.
                </p>
              )}
              {me && nearestStop && (
                <p className="text-sm">
                  Nearest stop: <strong>{nearestStop.stop.name}</strong>{" "}
                  <span className="text-muted-foreground">
                    ({nearestStop.km < 1
                      ? `${Math.round(nearestStop.km * 1000)} m`
                      : `${nearestStop.km.toFixed(1)} km`}{" "}
                    away)
                  </span>
                </p>
              )}
              {me && onRoad && eta && (
                <p className="text-sm text-emerald-600">
                  Jeepney arriving in about {etaRangeLabel(eta)}.
                </p>
              )}
              {me && onRoad && !eta && (
                <p className="text-xs text-muted-foreground">
                  The jeepney has already passed this stop on its current trip.
                </p>
              )}
              {me && !onRoad && (
                <p className="text-xs text-muted-foreground">
                  No live jeepney on this route right now — use the schedule above.
                </p>
              )}
            </Card>

            <Card className="p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Bus className="h-4 w-4" /> Stops
              </p>
              {route.stops.length === 0 && (
                <p className="text-xs text-muted-foreground">No stops listed yet.</p>
              )}
              <ol className="space-y-1.5">
                {route.stops.map((stop, i) => (
                  <li key={stop.id} className="flex items-baseline gap-2 text-sm">
                    <span className="text-xs text-muted-foreground">{i + 1}.</span>
                    <span className="flex-1">{stop.name}</span>
                    {stop.offset_minutes !== null && (
                      <span className="text-xs text-muted-foreground">
                        +{stop.offset_minutes} min
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </Card>

            <JeepneyInsightsCard routeId={route.id} />



            <Card className="p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Bell className="h-4 w-4" /> Service alerts
              </p>
              {alerts.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No breakdowns reported. Monitor this route to get an alert if the jeepney breaks
                  down or comes back into service.
                </p>
              ) : (
                <ul className="space-y-2">
                  {alerts.map((alert) => (
                    <li key={alert.id} className="flex gap-2 text-sm">
                      {alert.kind === "breakdown" ? (
                        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      ) : (
                        <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium">{alert.headline}</p>
                        {alert.message && (
                          <p className="text-xs text-muted-foreground">{alert.message}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(alert.created_at).toLocaleString()}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>


            {route.notes && (
              <Card className="p-4 text-sm">
                <p className="mb-1 font-semibold">Notes from the operator</p>
                <p className="text-muted-foreground">{route.notes}</p>
              </Card>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
