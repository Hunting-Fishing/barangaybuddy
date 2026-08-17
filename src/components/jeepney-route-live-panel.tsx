import { useMemo } from "react";
import {
  Bell,
  Bus,
  CheckCircle2,
  Clock3,
  Gauge,
  Locate,
  MapPin,
  Navigation,
  Radio,
  Route as RouteIcon,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  distanceAlongPathKm,
  etaMinutesWithTraffic,
  etaRangeLabel,
  formatTime,
  haversineKm,
  isLive,
  pathLengthKm,
  type JeepneyPosition,
  type JeepneyRoute,
  type JeepneyStop,
  type LatLng,
} from "@/lib/jeepney";

type RouteWithStops = JeepneyRoute & { stops: JeepneyStop[]; operator: string | null };

export type JeepneyRouteAlert = {
  id: string;
  kind: "breakdown" | "repaired";
  headline: string;
  message: string | null;
  created_at: string;
};

type Props = {
  route: RouteWithStops;
  position: JeepneyPosition | null;
  userLocation: LatLng | null;
  speeds: Map<number, number>;
  alerts: JeepneyRouteAlert[];
  onLocate: () => void;
};

type StopRow = {
  stop: JeepneyStop;
  index: number;
  offset: number;
  distanceAlong: number;
  passed: boolean;
  eta: number | null;
  scheduled: string;
};

const BRAND = {
  navy: "#071d49",
  blue: "#1465ff",
  gold: "#f5b400",
};

function timeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h! * 60 + m!;
}

function manilaMinutesNow(): number {
  const now = new Date();
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return (utcMinutes + 8 * 60) % (24 * 60);
}

function formatMinuteClock(totalMinutes: number): string {
  const minuteOfDay = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(minuteOfDay / 60);
  const m = minuteOfDay % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

function estimatedStopOffset(route: RouteWithStops, stop: JeepneyStop, index: number): number {
  if (stop.offset_minutes !== null && Number.isFinite(Number(stop.offset_minutes))) {
    return Math.max(0, Number(stop.offset_minutes));
  }
  if (!route.stops.length || !route.avg_trip_minutes) return index * 3;
  if (route.stops.length === 1) return 0;
  return Math.round((index / (route.stops.length - 1)) * route.avg_trip_minutes);
}

function serviceHeadway(route: RouteWithStops): number | null {
  const first = timeToMinutes(route.first_run);
  const last = timeToMinutes(route.last_run);
  if (first === null || last === null || !route.trips_per_day || route.trips_per_day < 2) return null;
  let span = last - first;
  if (span <= 0) span += 1440;
  return Math.max(1, Math.round(span / Math.max(1, route.trips_per_day - 1)));
}

function nextScheduledArrival(route: RouteWithStops, offset: number, nowMinute: number): string {
  const first = timeToMinutes(route.first_run);
  const last = timeToMinutes(route.last_run);
  if (first === null) return "Schedule pending";

  let end = last ?? first;
  if (end < first) end += 1440;
  let now = nowMinute;
  if (end > 1440 && now < first) now += 1440;

  const headway = serviceHeadway(route);
  const firstAtStop = first + offset;
  const lastAtStop = end + offset;

  if (headway === null) {
    if (now <= firstAtStop) return formatMinuteClock(firstAtStop);
    return `Next service ${formatMinuteClock(firstAtStop)}`;
  }

  if (now <= firstAtStop) return formatMinuteClock(firstAtStop);
  if (now > lastAtStop) return `Next service ${formatMinuteClock(firstAtStop)}`;

  const tripsAfterFirst = Math.ceil((now - firstAtStop) / headway);
  const next = firstAtStop + Math.max(0, tripsAfterFirst) * headway;
  return next <= lastAtStop ? formatMinuteClock(next) : `Next service ${formatMinuteClock(firstAtStop)}`;
}

function distanceLabel(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export function JeepneyRouteLivePanel({ route, position, userLocation, speeds, alerts, onLocate }: Props) {
  const onRoad = Boolean(position && isLive(position.recorded_at));
  const currentPosition = position
    ? { lat: Number(position.latitude), lng: Number(position.longitude) }
    : null;
  const totalDistance = useMemo(() => pathLengthKm(route.path), [route.path]);
  const vehicleDistance = useMemo(
    () => (onRoad && currentPosition ? distanceAlongPathKm(route.path, currentPosition) : null),
    [onRoad, currentPosition, route.path],
  );

  const stopRows = useMemo<StopRow[]>(() => {
    const nowMinute = manilaMinutesNow();
    return route.stops.map((stop, index) => {
      const stopPoint = { lat: Number(stop.latitude), lng: Number(stop.longitude) };
      const stopDistance = distanceAlongPathKm(route.path, stopPoint);
      const passed = vehicleDistance !== null && stopDistance < vehicleDistance - 0.05;
      const eta =
        onRoad && currentPosition && !passed
          ? etaMinutesWithTraffic(route.path, currentPosition, stopPoint, position?.speed_kph, speeds)
          : null;
      const offset = estimatedStopOffset(route, stop, index);
      return {
        stop,
        index,
        offset,
        distanceAlong: stopDistance,
        passed,
        eta,
        scheduled: nextScheduledArrival(route, offset, nowMinute),
      };
    });
  }, [route, vehicleDistance, onRoad, currentPosition, position?.speed_kph, speeds]);

  const nextStop = useMemo(() => stopRows.find((row) => !row.passed) ?? null, [stopRows]);
  const previousStop = useMemo(() => [...stopRows].reverse().find((row) => row.passed) ?? null, [stopRows]);

  const nearestUserStop = useMemo(() => {
    if (!userLocation || !route.stops.length) return null;
    return route.stops
      .map((stop) => ({
        stop,
        km: haversineKm(userLocation, {
          lat: Number(stop.latitude),
          lng: Number(stop.longitude),
        }),
      }))
      .sort((a, b) => a.km - b.km)[0]!;
  }, [route.stops, userLocation]);

  const nearestUserRow = nearestUserStop
    ? stopRows.find((row) => row.stop.id === nearestUserStop.stop.id) ?? null
    : null;

  const progress =
    vehicleDistance !== null && totalDistance > 0
      ? Math.min(100, Math.max(0, (vehicleDistance / totalDistance) * 100))
      : 0;

  const breakdown = route.status === "suspended" || alerts[0]?.kind === "breakdown";

  return (
    <div className="space-y-4">
      <section
        className="overflow-hidden rounded-3xl border border-blue-950/10 text-white shadow-xl"
        style={{ background: `linear-gradient(145deg, ${BRAND.navy}, #0b3887 55%, ${BRAND.blue})` }}
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-100">
                Barangay Buddy · Jeepney Planner
              </p>
              <h2 className="mt-2 truncate font-display text-2xl font-extrabold">{route.name}</h2>
              <p className="mt-1 text-sm text-blue-100/85">
                {route.code ? `Route ${route.code}` : "Community route"}
                {route.operator ? ` · ${route.operator}` : ""}
              </p>
            </div>
            <div
              className="flex h-14 min-w-14 items-center justify-center rounded-2xl px-3 text-center font-black text-slate-950 shadow-lg"
              style={{ background: BRAND.gold }}
            >
              {route.code ?? "JP"}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/10">
              <Clock3 className="mr-1 h-3.5 w-3.5" /> {formatTime(route.first_run)}–{formatTime(route.last_run)}
            </Badge>
            <Badge
              className={
                breakdown
                  ? "border-red-300/40 bg-red-500/90 text-white"
                  : onRoad
                    ? "border-emerald-300/40 bg-emerald-500/90 text-white"
                    : "border-white/15 bg-white/10 text-white"
              }
            >
              {breakdown ? (
                <TriangleAlert className="mr-1 h-3.5 w-3.5" />
              ) : (
                <Radio className="mr-1 h-3.5 w-3.5" />
              )}
              {breakdown ? "Out of service" : onRoad ? "Live now" : "Using schedule"}
            </Badge>
          </div>

          <div className="mt-5 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-100">Next pickup</p>
                <p className="mt-1 text-lg font-bold">{nextStop?.stop.name ?? "End of route"}</p>
                <p className="mt-0.5 text-xs text-blue-100/80">
                  {nextStop?.eta
                    ? `Estimated in ${etaRangeLabel(nextStop.eta)}`
                    : nextStop
                      ? `Approx. ${nextStop.scheduled}`
                      : "This jeepney has completed the mapped route."}
                </p>
              </div>
              {onRoad && position?.speed_kph ? (
                <div className="rounded-xl bg-black/15 px-3 py-2 text-right">
                  <p className="text-[10px] uppercase text-blue-100">Speed</p>
                  <p className="font-bold">{Math.round(Number(position.speed_kph))} km/h</p>
                </div>
              ) : null}
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: BRAND.gold }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-blue-100/80">
              <span>{previousStop?.stop.name ?? route.stops[0]?.name ?? "Start"}</span>
              <span>{Math.round(progress)}% of route</span>
              <span>{route.stops.at(-1)?.name ?? "End"}</span>
            </div>
          </div>
        </div>
      </section>

      <Tabs defaultValue="live" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-4 rounded-2xl bg-slate-100 p-1">
          <TabsTrigger value="live" className="rounded-xl px-2 py-2 text-xs sm:text-sm">Live</TabsTrigger>
          <TabsTrigger value="pickups" className="rounded-xl px-2 py-2 text-xs sm:text-sm">Pickups</TabsTrigger>
          <TabsTrigger value="schedule" className="rounded-xl px-2 py-2 text-xs sm:text-sm">Route</TabsTrigger>
          <TabsTrigger value="alerts" className="rounded-xl px-2 py-2 text-xs sm:text-sm">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-4 space-y-3">
          <Card className="overflow-hidden border-blue-100 p-0 shadow-sm">
            <div className="border-b border-blue-100 bg-blue-50/70 px-4 py-3">
              <p className="flex items-center gap-2 font-semibold text-slate-900">
                <Navigation className="h-4 w-4 text-blue-600" /> Live route tracking
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                See whether the jeepney has passed your stop or is still coming.
              </p>
            </div>
            <div className="space-y-4 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current position</p>
                  <p className="mt-1 font-bold">
                    {onRoad
                      ? previousStop
                        ? `Passed ${previousStop.stop.name}`
                        : "Approaching first stop"
                      : breakdown
                        ? "Service paused"
                        : "No live GPS right now"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {onRoad && position
                      ? `Updated ${new Date(position.recorded_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                      : "Scheduled pickup estimates remain available below."}
                  </p>
                </div>
                <div className="rounded-2xl border bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next stop</p>
                  <p className="mt-1 font-bold">{nextStop?.stop.name ?? "Route complete"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {nextStop?.eta ? `Live ETA ${etaRangeLabel(nextStop.eta)}` : nextStop?.scheduled ?? "—"}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-slate-900">
                      <MapPin className="h-4 w-4 text-amber-600" /> Your pickup stop
                    </p>
                    {nearestUserStop ? (
                      <p className="mt-1 text-sm">
                        <strong>{nearestUserStop.stop.name}</strong> · {distanceLabel(nearestUserStop.km)} from you
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Use your location to find the closest stop on this route.
                      </p>
                    )}
                    {nearestUserRow ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {nearestUserRow.passed
                          ? "The live jeepney has already passed this stop on its current trip."
                          : nearestUserRow.eta
                            ? `Live arrival estimate: ${etaRangeLabel(nearestUserRow.eta)}.`
                            : `Next scheduled pickup: ${nearestUserRow.scheduled}.`}
                      </p>
                    ) : null}
                  </div>
                  <Button size="sm" variant="outline" onClick={onLocate}>
                    <Locate className="mr-1.5 h-4 w-4" /> Use my location
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="pickups" className="mt-4">
          <Card className="overflow-hidden p-0 shadow-sm">
            <div className="border-b bg-slate-50 px-4 py-3">
              <p className="flex items-center gap-2 font-semibold">
                <Clock3 className="h-4 w-4 text-blue-600" /> Pickup predictions
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Live ETAs when GPS is available; otherwise approximate times from the route schedule.
              </p>
            </div>
            <ol className="divide-y">
              {stopRows.map((row) => (
                <li key={row.stop.id} className="flex items-center gap-3 px-4 py-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                      row.passed
                        ? "border-slate-200 bg-slate-100 text-slate-500"
                        : row.eta
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {row.passed ? <CheckCircle2 className="h-4 w-4" /> : row.index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{row.stop.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.passed
                        ? "Passed on current trip"
                        : row.eta
                          ? `Live ETA ${etaRangeLabel(row.eta)}`
                          : `Approx. ${row.scheduled}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">
                      {row.passed ? "Passed" : row.eta ? etaRangeLabel(row.eta) : row.scheduled}
                    </p>
                    {row.offset > 0 ? (
                      <p className="text-[11px] text-muted-foreground">+{row.offset} min from route start</p>
                    ) : null}
                  </div>
                </li>
              ))}
              {stopRows.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-muted-foreground">No stops mapped yet.</li>
              ) : null}
            </ol>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="mt-4 space-y-3">
          <Card className="p-4 shadow-sm">
            <p className="flex items-center gap-2 font-semibold">
              <RouteIcon className="h-4 w-4 text-blue-600" /> Route details
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">First trip</p>
                <p className="mt-1 font-bold">{formatTime(route.first_run)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Last trip</p>
                <p className="mt-1 font-bold">{formatTime(route.last_run)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Last pickup</p>
                <p className="mt-1 font-bold">{formatTime(route.last_pickup)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Trips/day</p>
                <p className="mt-1 font-bold">{route.trips_per_day ?? "—"}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {route.operating_days.map((day) => (
                <Badge key={day} variant="secondary">{day}</Badge>
              ))}
            </div>
          </Card>

          <Card className="p-4 shadow-sm">
            <p className="mb-4 flex items-center gap-2 font-semibold">
              <Bus className="h-4 w-4 text-blue-600" /> Stops in order
            </p>
            <div className="relative ml-3 border-l-2 border-blue-100 pl-5">
              {stopRows.map((row) => (
                <div key={row.stop.id} className="relative pb-5 last:pb-0">
                  <span
                    className="absolute -left-[29px] top-0.5 h-4 w-4 rounded-full border-4 border-white shadow"
                    style={{ background: row.passed ? "#94a3b8" : BRAND.blue }}
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{row.stop.name}</p>
                      {row.stop.address ? (
                        <p className="text-xs text-muted-foreground">{row.stop.address}</p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-xs font-semibold text-muted-foreground">
                      {row.offset === 0 ? "Start" : `+${row.offset} min`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="mt-4 space-y-3">
          <Card className="p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  breakdown ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {breakdown ? <TriangleAlert className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
              </div>
              <div>
                <p className="font-semibold">{breakdown ? "Service interruption" : "Route status normal"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {breakdown
                    ? alerts.find((alert) => alert.kind === "breakdown")?.message ??
                      "The operator has reported this route out of service."
                    : onRoad
                      ? "A jeepney is currently broadcasting live on this route."
                      : "No breakdown is reported. Follow the schedule and check again for live GPS."}
                </p>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden p-0 shadow-sm">
            <div className="border-b bg-slate-50 px-4 py-3">
              <p className="flex items-center gap-2 font-semibold">
                <Bell className="h-4 w-4 text-blue-600" /> Service alerts
              </p>
            </div>
            {alerts.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No service alerts reported.</div>
            ) : (
              <ul className="divide-y">
                {alerts.map((alert) => (
                  <li key={alert.id} className="flex gap-3 p-4">
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        alert.kind === "breakdown"
                          ? "bg-red-100 text-red-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {alert.kind === "breakdown" ? <Wrench className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium">{alert.headline}</p>
                      {alert.message ? <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p> : null}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(alert.created_at).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="border-blue-100 bg-blue-50/60 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold text-slate-900">
              <Gauge className="h-4 w-4 text-blue-600" /> What the status means
            </p>
            <p className="mt-1 text-muted-foreground">
              Operators can report a breakdown and restore service when repaired. Live GPS is treated as offline after five minutes without a new position.
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
