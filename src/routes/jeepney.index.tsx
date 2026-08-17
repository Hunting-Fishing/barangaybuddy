import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bus,
  Clock3,
  Locate,
  MapPin,
  Navigation,
  Radio,
  Search,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { JeepneyFollowButton } from "@/components/jeepney-follow-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { supabase } from "@/integrations/supabase/client";
import {
  formatPhpAmount,
  formatTime,
  headwayLabel,
  haversineKm,
  isLive,
  parsePath,
  type JeepneyPosition,
  type JeepneyRoute,
  type JeepneyStop,
  type LatLng,
} from "@/lib/jeepney";
import {
  buildLatestLivePositions,
  livePositionsForRoute,
  mergeLivePosition,
  pruneStaleLivePositions,
  type JeepneyLivePositions,
} from "@/lib/jeepney-live";

const JeepneyMap = lazy(() => import("@/components/jeepney-map"));

export const Route = createFileRoute("/jeepney/")({
  head: () => ({
    meta: [
      { title: "Jeepney Planner — Live routes, pickup times and service alerts" },
      {
        name: "description",
        content:
          "Plan jeepney trips with route maps, approximate pickup times, daily service hours, live vehicle positions and breakdown alerts.",
      },
      { property: "og:title", content: "Barangay Buddy Jeepney Planner" },
      {
        property: "og:description",
        content: "Know the route. Know the pickup time. Know whether it already passed or is still coming.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JeepneyIndexPage,
});

type RouteWithStops = JeepneyRoute & { stops: JeepneyStop[] };

function JeepneyIndexPage() {
  const [routes, setRoutes] = useState<RouteWithStops[]>([]);
  const [live, setLive] = useState<JeepneyLivePositions>({});
  const [query, setQuery] = useState("");
  const [me, setMe] = useState<LatLng | null>(null);
  const [nearOnly, setNearOnly] = useState(false);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void loadLive(), 20000);
    const channel = supabase
      .channel("public-jeepney-position-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "jeepney_positions" },
        (payload) => {
          const next = payload.new as JeepneyPosition;
          if (!next?.route_id || !isLive(next.recorded_at)) return;
          setLive((current) => pruneStaleLivePositions(mergeLivePosition(current, next)));
        },
      )
      .subscribe();

    return () => {
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, []);

  async function load() {
    const { data } = await supabase
      .from("jeepney_routes")
      .select("*, jeepney_stops(*)")
      .eq("status", "published")
      .order("name");

    setRoutes(
      (data ?? []).map((r: any) => ({
        ...r,
        path: parsePath(r.path),
        stops: ((r.jeepney_stops ?? []) as JeepneyStop[]).sort((a, b) => a.position - b.position),
      })),
    );
    setLoading(false);
    void loadLive();
  }

  async function loadLive() {
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("jeepney_positions")
      .select("*")
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: false })
      .limit(1000);

    setLive(buildLatestLivePositions((data ?? []) as JeepneyPosition[]));
  }

  function locate() {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setNearOnly(true);
      },
      () => setNearOnly(false),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return routes.filter((route) => {
      if (q) {
        const haystack = `${route.name} ${route.code ?? ""} ${route.stops
          .map((s) => s.name)
          .join(" ")}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (nearOnly && me) {
        const near = route.path.some((p) => haversineKm(p, me) <= 3);
        if (!near) return false;
      }
      return true;
    });
  }, [routes, query, nearOnly, me]);

  const liveCount = Object.values(live).filter((p) => isLive(p.recorded_at)).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/80 via-background to-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-6 sm:py-8">
        <section className="relative overflow-hidden rounded-[2rem] bg-[#071d49] px-5 py-8 text-white shadow-xl sm:px-8 sm:py-10 lg:px-10">
          <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-blue-500/25 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-1/4 h-40 w-40 rounded-full bg-[#f5b400]/20 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-blue-100">
                <Bus className="h-4 w-4 text-[#f5b400]" /> Barangay Buddy Transit
              </div>
              <h1 className="mt-5 max-w-3xl font-display text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                Jeepney <span className="text-[#4d8cff]">Planner</span>
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-blue-100/85 sm:text-lg">
                Know where the jeepney is, when it should reach your stop, whether it already passed,
                and when the route starts or ends for the day.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/10">
                  <Navigation className="mr-1 h-3.5 w-3.5" /> Live vehicle positions
                </Badge>
                <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/10">
                  <Clock3 className="mr-1 h-3.5 w-3.5" /> Approx. pickup times
                </Badge>
                <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/10">
                  <Radio className="mr-1 h-3.5 w-3.5" /> Breakdown status
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-2xl font-black text-[#f5b400]">{routes.length}</p>
                <p className="mt-1 text-xs text-blue-100/80">Published routes</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-2xl font-black text-emerald-300">{liveCount}</p>
                <p className="mt-1 text-xs text-blue-100/80">Live vehicles</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-2xl font-black text-blue-200">24/7</p>
                <p className="mt-1 text-xs text-blue-100/80">Route lookup</p>
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-10 -mt-4 mx-2 rounded-3xl border border-blue-100 bg-white p-4 shadow-lg sm:mx-6 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search route, route code, terminal or stop"
                className="h-11 rounded-xl pl-9"
              />
            </div>
            <Button
              variant={nearOnly ? "default" : "outline"}
              onClick={locate}
              className={nearOnly ? "bg-[#1465ff] hover:bg-[#0f56dc]" : ""}
            >
              <Locate className="mr-1.5 h-4 w-4" /> Passes near me
            </Button>
            <Button variant="outline" asChild>
              <Link to="/jeepney/operator">List a jeepney route</Link>
            </Button>
          </div>
          {nearOnly ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> Showing routes that pass within about 3 km of you.
              <button type="button" className="font-semibold text-blue-700 underline" onClick={() => setNearOnly(false)}>
                Show all
              </button>
            </div>
          ) : null}
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[1.45fr_1fr]">
          <Card className="overflow-hidden rounded-3xl border-blue-100 p-0 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 bg-white px-4 py-3">
              <div>
                <h2 className="font-display text-lg font-bold">Route map</h2>
                <p className="text-xs text-muted-foreground">Select a route line or card to focus it.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#071d49] text-[#f5b400]">
                  <Bus className="h-4 w-4" />
                </span>
                One marker per active jeepney
              </div>
            </div>
            <ClientOnly fallback={<div className="h-[72vh] min-h-[520px] bg-slate-100" />}>
              <Suspense fallback={<div className="h-[72vh] min-h-[520px] bg-slate-100" />}>
                <JeepneyMap
                  routes={filtered}
                  live={live}
                  userLocation={me}
                  activeRouteId={activeRouteId}
                  onSelectRoute={setActiveRouteId}
                  height="72vh"
                />
              </Suspense>
            </ClientOnly>
          </Card>

          <div className="space-y-3 xl:max-h-[calc(72vh+72px)] xl:overflow-y-auto xl:pr-1">
            {loading ? (
              <Card className="rounded-2xl p-5 text-sm text-muted-foreground">Loading jeepney routes…</Card>
            ) : null}

            {!loading && filtered.length === 0 ? (
              <Card className="rounded-2xl p-6 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">No matching jeepney route yet.</p>
                <p className="mt-1">
                  Operators can add actual route paths, stops, service hours and live GPS broadcasting.
                </p>
                <Button size="sm" className="mt-4" asChild>
                  <Link to="/jeepney/operator">Add a route</Link>
                </Button>
              </Card>
            ) : null}

            {filtered.map((route) => {
              const routePositions = livePositionsForRoute(live, route.id);
              const onRoad = routePositions.length > 0;
              const active = activeRouteId === route.id;
              return (
                <Card
                  key={route.id}
                  className={`cursor-pointer overflow-hidden rounded-2xl border p-0 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                    active ? "border-blue-300 ring-2 ring-blue-500/20" : "border-border"
                  }`}
                  onMouseEnter={() => setActiveRouteId(route.id)}
                  onClick={() => setActiveRouteId(route.id)}
                >
                  <div className="h-1.5" style={{ background: route.colour || "#1465ff" }} />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#071d49] text-[#f5b400]">
                            <Bus className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <h3 className="truncate font-display text-lg font-bold">{route.name}</h3>
                            <p className="text-xs text-muted-foreground">
                              {route.code ? `Route ${route.code}` : "Community route"}
                            </p>
                          </div>
                        </div>
                      </div>
                      <Badge className={onRoad ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"}>
                        <Radio className="mr-1 h-3 w-3" />
                        {onRoad
                          ? `${routePositions.length} live ${routePositions.length === 1 ? "unit" : "units"}`
                          : "Scheduled"}
                      </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-slate-50 px-2 py-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fare</p>
                        <p className="mt-0.5 text-sm font-bold">{formatPhpAmount(route.fare_php)}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-2 py-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">First</p>
                        <p className="mt-0.5 text-sm font-bold">{formatTime(route.first_run)}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-2 py-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Last</p>
                        <p className="mt-0.5 text-sm font-bold">{formatTime(route.last_run)}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {headwayLabel(route) ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" /> {headwayLabel(route)}
                        </span>
                      ) : null}
                      <span>·</span>
                      <span>{route.stops.length} mapped stops</span>
                      {onRoad ? (
                        <>
                          <span>·</span>
                          <span className="font-semibold text-emerald-700">
                            {routePositions.length} GPS {routePositions.length === 1 ? "vehicle" : "vehicles"}
                          </span>
                        </>
                      ) : null}
                    </div>

                    {route.stops.length ? (
                      <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
                        {route.stops.slice(0, 4).map((stop) => stop.name).join(" → ")}
                        {route.stops.length > 4 ? " → …" : ""}
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                      <div onClick={(event) => event.stopPropagation()}>
                        <JeepneyFollowButton routeId={route.id} routeName={route.name} />
                      </div>
                      <Button size="sm" className="bg-[#1465ff] hover:bg-[#0f56dc]" asChild>
                        <Link to="/jeepney/$slug" params={{ slug: route.slug }} onClick={(event) => event.stopPropagation()}>
                          Track route <ArrowRight className="ml-1.5 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}

            <Card className="rounded-2xl border-amber-200 bg-amber-50 p-4">
              <p className="flex items-center gap-2 font-semibold text-slate-900">
                <Sparkles className="h-4 w-4 text-amber-600" /> How live tracking works
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Each active vehicle keeps its own live GPS marker. If a vehicle stops updating for five minutes, that unit is removed from the live map while route schedules remain available.
              </p>
            </Card>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
