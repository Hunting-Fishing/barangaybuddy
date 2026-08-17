import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bus, Radio, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { JeepneyClaimDialog } from "@/components/jeepney-claim-dialog";
import { JeepneyFollowButton } from "@/components/jeepney-follow-button";
import { JeepneyInsightsCard } from "@/components/jeepney-insights-card";
import {
  JeepneyRouteLivePanel,
  type JeepneyRouteAlert,
} from "@/components/jeepney-route-live-panel";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { supabase } from "@/integrations/supabase/client";
import {
  CONGESTION_COLOURS,
  CONGESTION_LABELS,
  formatPhpAmount,
  headwayLabel,
  parsePath,
  segmentSpeedMap,
  type JeepneyPosition,
  type JeepneyRoute,
  type JeepneyStop,
  type LatLng,
  type SegmentSpeed,
} from "@/lib/jeepney";
import {
  buildLatestLivePositions,
  livePositionsForRoute,
  mergeLivePosition,
  pruneStaleLivePositions,
  type JeepneyLivePositions,
} from "@/lib/jeepney-live";

const JeepneyMap = lazy(() => import("@/components/jeepney-map"));

export const Route = createFileRoute("/jeepney/$slug")({
  head: ({ params }) => ({
    meta: [
      {
        title: `Jeepney route ${params.slug.replace(/-[a-z0-9]{5}$/, "").replace(/-/g, " ")} — live tracking & pickup times`,
      },
      {
        name: "description",
        content:
          "Track jeepneys on their route, see approximate pickup times, service hours, stop order and breakdown alerts on Barangay Buddy.",
      },
      { property: "og:title", content: "Jeepney route — live tracking & pickup times" },
      {
        property: "og:description",
        content: "See which live jeepneys are still coming, plus route times and service alerts.",
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

function JeepneyRoutePage() {
  const { slug } = Route.useParams();
  const [route, setRoute] = useState<RouteWithStops | null>(null);
  const [live, setLive] = useState<JeepneyLivePositions>({});
  const [me, setMe] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<JeepneyRouteAlert[]>([]);
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

  useEffect(() => {
    if (!route?.id) return;
    const routeId = route.id;
    const channel = supabase
      .channel(`public-jeepney-route-${routeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "jeepney_positions", filter: `route_id=eq.${routeId}` },
        (payload) => {
          const next = payload.new as JeepneyPosition;
          if (next?.route_id !== routeId) return;
          setLive((current) => pruneStaleLivePositions(mergeLivePosition(current, next)));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "jeepney_route_alerts", filter: `route_id=eq.${routeId}` },
        (payload) => {
          const next = payload.new as JeepneyRouteAlert;
          if (!next?.id) return;
          setAlerts((current) => [next, ...current.filter((item) => item.id !== next.id)].slice(0, 10));
          setRoute((current) =>
            current
              ? {
                  ...current,
                  status: next.kind === "breakdown" ? "suspended" : "published",
                }
              : current,
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [route?.id]);

  async function load() {
    const { data } = await supabase
      .from("jeepney_routes")
      .select("*, jeepney_stops(*), jeepney_operators(display_name)")
      .eq("slug", slug)
      .in("status", ["published", "suspended"])
      .maybeSingle();

    if (!data) {
      setRoute(null);
      setLive({});
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
      .limit(10);
    setAlerts((data ?? []) as JeepneyRouteAlert[]);
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
      .limit(500);
    setLive(buildLatestLivePositions((data ?? []) as JeepneyPosition[]));
  }

  function locate() {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

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

  const routePositions = livePositionsForRoute(live, route.id);
  const primaryPosition = routePositions[0] ?? null;
  const onRoad = routePositions.length > 0;
  const speeds = segmentSpeedMap(segmentRows, currentHour);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/70 via-background to-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-6 sm:py-8">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <Link to="/jeepney">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> All jeepney routes
          </Link>
        </Button>

        <section className="mb-5 rounded-3xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#071d49] text-[#f5b400]">
                  <Bus className="h-4 w-4" />
                </span>
                Barangay Buddy Jeepney Planner
              </div>
              <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                {route.name}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">
                Live vehicle positions, approximate pickup times, service hours and route alerts in one place.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {route.code ? <Badge className="bg-[#071d49] text-white">Route {route.code}</Badge> : null}
                <Badge variant="secondary">{formatPhpAmount(route.fare_php)} fare</Badge>
                {headwayLabel(route) ? <Badge variant="secondary">{headwayLabel(route)}</Badge> : null}
                <Badge
                  className={
                    route.status === "suspended"
                      ? "bg-red-600 text-white"
                      : onRoad
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 text-slate-700"
                  }
                >
                  {route.status === "suspended" ? (
                    <TriangleAlert className="mr-1 h-3.5 w-3.5" />
                  ) : (
                    <Radio className="mr-1 h-3.5 w-3.5" />
                  )}
                  {route.status === "suspended"
                    ? "Out of service"
                    : onRoad
                      ? `${routePositions.length} live ${routePositions.length === 1 ? "unit" : "units"}`
                      : "Schedule mode"}
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <JeepneyFollowButton routeId={route.id} routeName={route.name} />
              {!route.operator_id ? (
                <JeepneyClaimDialog routeId={route.id} routeName={route.name} onSubmitted={load} />
              ) : null}
            </div>
          </div>
        </section>

        {route.status === "suspended" ? (
          <Card className="mb-5 border-red-200 bg-red-50 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold text-red-900">
              <TriangleAlert className="h-4 w-4" /> This route has reported a breakdown.
            </p>
            <p className="mt-1 text-red-800/80">
              {alerts.find((alert) => alert.kind === "breakdown")?.message ??
                "The operator paused this route. Check the Alerts tab for the latest update."}
            </p>
          </Card>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
          <div className="space-y-4">
            <Card className="overflow-hidden rounded-3xl border-blue-100 p-0 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 bg-[#071d49] px-4 py-3 text-white">
                <div>
                  <p className="font-semibold">Live route map</p>
                  <p className="text-xs text-blue-100/80">
                    Each active jeepney gets its own blue/gold Barangay Buddy GPS marker.
                  </p>
                </div>
                <Badge className="bg-[#f5b400] text-slate-950 hover:bg-[#f5b400]">
                  {onRoad
                    ? `${routePositions.length} tracking ${routePositions.length === 1 ? "unit" : "units"}`
                    : "Waiting for GPS"}
                </Badge>
              </div>
              <ClientOnly fallback={<div className="h-[58vh] min-h-[440px] bg-slate-100" />}>
                <Suspense fallback={<div className="h-[58vh] min-h-[440px] bg-slate-100" />}>
                  <JeepneyMap
                    routes={[route]}
                    live={live}
                    userLocation={me}
                    height="58vh"
                    congestion={speeds.size ? { [route.id]: speeds } : {}}
                  />
                </Suspense>
              </ClientOnly>
            </Card>

            {routePositions.length > 0 ? (
              <Card className="rounded-2xl border-blue-100 p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">Active GPS units</p>
                    <p className="text-xs text-muted-foreground">Latest position retained independently for every vehicle.</p>
                  </div>
                  <Badge variant="secondary">{routePositions.length} online</Badge>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {routePositions.map((position, index) => (
                    <div key={position.vehicle_id ?? position.id} className="rounded-xl border bg-slate-50 px-3 py-2.5 text-sm">
                      <p className="font-semibold text-slate-900">
                        {position.vehicle_id
                          ? `Unit …${position.vehicle_id.slice(-6).toUpperCase()}`
                          : `Live unit ${index + 1}`}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Updated {new Date(position.recorded_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        {position.speed_kph ? ` · ${Math.round(Number(position.speed_kph))} km/h` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}

            {speeds.size > 0 ? (
              <Card className="flex flex-wrap items-center gap-4 rounded-2xl p-4 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Typical traffic at this hour</span>
                {(["free", "slow", "heavy"] as const).map((level) => (
                  <span key={level} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-5 rounded-full"
                      style={{ background: CONGESTION_COLOURS[level] }}
                    />
                    {CONGESTION_LABELS[level]}
                  </span>
                ))}
              </Card>
            ) : null}

            <JeepneyInsightsCard routeId={route.id} />

            {route.notes ? (
              <Card className="rounded-2xl p-4 text-sm">
                <p className="mb-1 font-semibold">Notes from the operator</p>
                <p className="text-muted-foreground">{route.notes}</p>
              </Card>
            ) : null}
          </div>

          <JeepneyRouteLivePanel
            route={route}
            position={primaryPosition}
            userLocation={me}
            speeds={speeds}
            alerts={alerts}
            onLocate={locate}
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
