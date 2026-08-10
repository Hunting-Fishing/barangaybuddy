import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bus, Locate, Radio, Search } from "lucide-react";
import { JeepneyFollowButton } from "@/components/jeepney-follow-button";

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

const JeepneyMap = lazy(() => import("@/components/jeepney-map"));

export const Route = createFileRoute("/jeepney/")({
  head: () => ({
    meta: [
      { title: "Jeepney Planner — Routes, times and live jeepneys in the Philippines" },
      {
        name: "description",
        content:
          "See jeepney routes on a map with first run, last run and last pickup times, plus live jeepneys sharing their location right now.",
      },
      { property: "og:title", content: "Jeepney Planner — routes, times and live jeepneys" },
      {
        property: "og:description",
        content: "Find the jeepney that passes near you, see its schedule and track it live.",
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
  const [live, setLive] = useState<Record<string, JeepneyPosition>>({});
  const [query, setQuery] = useState("");
  const [me, setMe] = useState<LatLng | null>(null);
  const [nearOnly, setNearOnly] = useState(false);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void loadLive(), 20000);
    return () => clearInterval(timer);
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
        stops: (r.jeepney_stops ?? []) as JeepneyStop[],
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
      .limit(500);
    const latest: Record<string, JeepneyPosition> = {};
    (data ?? []).forEach((p: any) => {
      if (!latest[p.route_id]) latest[p.route_id] = p as JeepneyPosition;
    });
    setLive(latest);
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
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-6">
        <header className="mb-5">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Jeepney Planner</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Jeepney routes drawn by the operators themselves — with times, fares and live jeepneys
            on the road right now.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Bus className="h-3.5 w-3.5" /> {routes.length} routes
            </Badge>
            <Badge variant={liveCount ? "default" : "secondary"} className="gap-1">
              <Radio className="h-3.5 w-3.5" /> {liveCount} live now
            </Badge>
            <Button size="sm" variant="outline" asChild>
              <Link to="/jeepney/operator">I drive a jeepney — list my route</Link>
            </Button>
          </div>
        </header>

        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search route, code or stop"
              className="pl-9"
            />
          </div>
          <Button variant={nearOnly ? "default" : "outline"} onClick={locate}>
            <Locate className="mr-1.5 h-4 w-4" /> Passes near me
          </Button>
          {nearOnly && (
            <Button variant="ghost" onClick={() => setNearOnly(false)}>
              Show all
            </Button>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <ClientOnly fallback={<div className="h-[70vh] rounded-xl border border-border" />}>
            <Suspense fallback={<div className="h-[70vh] rounded-xl border border-border" />}>
              <JeepneyMap
                routes={filtered}
                live={live}
                userLocation={me}
                activeRouteId={activeRouteId}
                onSelectRoute={setActiveRouteId}
              />
            </Suspense>
          </ClientOnly>

          <div className="space-y-3">
            {loading && <p className="text-sm text-muted-foreground">Loading routes…</p>}
            {!loading && filtered.length === 0 && (
              <Card className="p-4 text-sm text-muted-foreground">
                No routes here yet. If you drive a jeepney,{" "}
                <Link to="/jeepney/operator" className="font-medium text-foreground underline">
                  add your route
                </Link>{" "}
                for ₱100 a month.
              </Card>
            )}
            {filtered.map((route) => {
              const position = live[route.id];
              const onRoad = position && isLive(position.recorded_at);
              return (
                <Card
                  key={route.id}
                  className={`cursor-pointer p-4 transition ${
                    activeRouteId === route.id ? "ring-2 ring-primary" : ""
                  }`}
                  onMouseEnter={() => setActiveRouteId(route.id)}
                  onClick={() => setActiveRouteId(route.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-semibold">
                        <span
                          className="inline-block h-3 w-3 shrink-0 rounded-full"
                          style={{ background: route.colour }}
                        />
                        <span className="truncate">{route.name}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {route.code ? `${route.code} · ` : ""}
                        {formatPhpAmount(route.fare_php)} fare
                        {headwayLabel(route) ? ` · ${headwayLabel(route)}` : ""}
                      </p>
                    </div>
                    {onRoad && (
                      <Badge className="shrink-0 gap-1">
                        <Radio className="h-3 w-3" /> Live
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    First {formatTime(route.first_run)} · Last {formatTime(route.last_run)} · Last
                    pickup {formatTime(route.last_pickup)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="link" className="h-auto p-0" asChild>
                      <Link to="/jeepney/$slug" params={{ slug: route.slug }}>
                        View route & stops
                      </Link>
                    </Button>
                    <JeepneyFollowButton routeId={route.id} routeName={route.name} />
                  </div>

                </Card>
              );
            })}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
