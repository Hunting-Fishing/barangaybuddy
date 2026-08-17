import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClientOnly } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DAYS,
  ROUTE_COLOURS,
  emptyDaySchedule,
  haversineKm,
  isNamedPoint,
  jeepneySlug,
  type DaySchedule,
  type FareLine,
  type LatLng,
  type RoutePoint,
} from "@/lib/jeepney";
import type { DraftStop } from "@/components/jeepney-route-editor";
import { JeepneyPointList } from "@/components/jeepney-point-list";
import { JeepneyScheduleGrid } from "@/components/jeepney-schedule-grid";
import { JeepneyFareTable } from "@/components/jeepney-fare-table";
import { JeepneyServiceCalendar } from "@/components/jeepney-service-calendar";
import { JeepneyRentalPanel } from "@/components/jeepney-rental-panel";
import { snapStopsToRoads } from "@/lib/jeepney-geo.functions";

const JeepneyRouteEditor = lazy(() => import("@/components/jeepney-route-editor"));

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  operatorId: string;
  onSaved: () => void;
  existing?: {
    id: string;
    name: string;
    code: string | null;
    fare_php: number | null;
    fare_note: string | null;
    first_run: string | null;
    last_run: string | null;
    last_pickup: string | null;
    trips_per_day: number | null;
    avg_trip_minutes: number | null;
    operating_days: string[];
    colour: string;
    notes: string | null;
    path: LatLng[];
    stops: DraftStop[];
    rental_available?: boolean;
    rental_day_rate_php?: number | null;
    rental_note?: string | null;
  } | null;
};

/** Merge the saved line and the saved stops into one ordered list of points. */
function mergePoints(path: LatLng[], stops: DraftStop[]): RoutePoint[] {
  const points: RoutePoint[] = path.map((p) => ({ lat: p.lat, lng: p.lng }));
  stops.forEach((stop) => {
    const index = points.findIndex((p) => haversineKm(p, stop) * 1000 < 20);
    const meta = {
      name: stop.name,
      address: stop.address ?? null,
      kind: stop.kind ?? ("stop" as const),
      photo_url: (stop as DraftStop & { photo_url?: string | null }).photo_url ?? null,
    };
    if (index >= 0) points[index] = { ...points[index]!, ...meta };
    else points.push({ lat: stop.lat, lng: stop.lng, ...meta });
  });
  return points;
}

export function JeepneyRouteForm({ open, onOpenChange, operatorId, onSaved, existing }: Props) {
  const [tab, setTab] = useState("route");
  const [name, setName] = useState(existing?.name ?? "");
  const [code, setCode] = useState(existing?.code ?? "");
  const [firstRun, setFirstRun] = useState(existing?.first_run ?? "05:00");
  const [lastRun, setLastRun] = useState(existing?.last_run ?? "21:00");
  const [lastPickup, setLastPickup] = useState(existing?.last_pickup ?? "21:30");
  const [trips, setTrips] = useState(existing?.trips_per_day ? String(existing.trips_per_day) : "");
  const [avgMinutes, setAvgMinutes] = useState(
    existing?.avg_trip_minutes ? String(existing.avg_trip_minutes) : "",
  );
  const [colour, setColour] = useState(existing?.colour ?? ROUTE_COLOURS[0]!);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [points, setPoints] = useState<RoutePoint[]>(
    existing ? mergePoints(existing.path, existing.stops) : [],
  );
  const [path, setPath] = useState<LatLng[]>(existing?.path ?? []);
  const [followRoads, setFollowRoads] = useState((existing?.path?.length ?? 0) <= 40);
  const [schedule, setSchedule] = useState<DaySchedule[]>(() =>
    emptyDaySchedule().map((row) => ({
      ...row,
      active: existing ? (existing.operating_days ?? [...DAYS]).includes(row.day) : true,
    })),
  );
  const [fares, setFares] = useState<FareLine[]>(
    existing?.fare_php
      ? [{ label: "Base fare", amount_php: existing.fare_php, note: existing.fare_note ?? "" }]
      : [],
  );
  const [rentalAvailable, setRentalAvailable] = useState(existing?.rental_available ?? false);
  const [dayRate, setDayRate] = useState(
    existing?.rental_day_rate_php ? String(existing.rental_day_rate_php) : "",
  );
  const [rentalNote, setRentalNote] = useState(existing?.rental_note ?? "");
  const [saving, setSaving] = useState(false);
  const [snapping, setSnapping] = useState(false);

  const routeId = existing?.id ?? null;

  // Load the per-day times and fare lines saved for an existing route.
  useEffect(() => {
    if (!routeId || !open) return;
    void (async () => {
      const [{ data: dayRows }, { data: fareRows }] = await Promise.all([
        supabase
          .from("jeepney_day_schedule")
          .select("day, active, first_run, last_run, last_pickup")
          .eq("route_id", routeId),
        supabase
          .from("jeepney_route_fares")
          .select("id, label, amount_php, note, position")
          .eq("route_id", routeId)
          .order("position", { ascending: true }),
      ]);
      if (dayRows?.length) {
        setSchedule(
          emptyDaySchedule().map((row) => {
            const found = dayRows.find((d) => d.day === row.day);
            return found ? { ...row, ...found } : row;
          }),
        );
      }
      if (fareRows?.length) {
        setFares(
          fareRows.map((f) => ({
            id: f.id,
            label: f.label,
            amount_php: f.amount_php,
            note: f.note ?? "",
          })),
        );
      }
    })();
  }, [routeId, open]);

  function addStop(point: LatLng) {
    setPoints((prev) => [...prev, { ...point, name: "", kind: "stop" as const }]);
    toast.info("Point added — name it in the list below to show it to riders.");
  }

  const snapSeq = useRef(0);
  const anchors: LatLng[] = points.map((p) => ({ lat: p.lat, lng: p.lng }));
  const anchorKey = anchors.map((a) => `${a.lat.toFixed(5)},${a.lng.toFixed(5)}`).join("|");
  const namedStops: DraftStop[] = points.filter(isNamedPoint).map((p) => ({
    name: p.name!.trim(),
    address: p.address ?? null,
    lat: p.lat,
    lng: p.lng,
    kind: p.kind ?? "stop",
  }));

  // Keep the drawn line following the actual roads between the numbered points.
  useEffect(() => {
    const line = anchors;
    if (line.length < 2 || !followRoads) {
      setPath(line);
      return;
    }
    const mine = ++snapSeq.current;
    setSnapping(true);
    const timer = setTimeout(async () => {
      try {
        const res = await snapStopsToRoads({ data: { points: line } });
        if (mine !== snapSeq.current) return;
        setPath(res.snapped ? res.path : line);
      } catch {
        if (mine === snapSeq.current) setPath(line);
      } finally {
        if (mine === snapSeq.current) setSnapping(false);
      }
    }, 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorKey, followRoads]);

  async function snapToRoads() {
    if (anchors.length < 2) {
      toast.error("Add at least two points first — the route follows them in order.");
      return;
    }
    setSnapping(true);
    try {
      const res = await snapStopsToRoads({ data: { points: anchors } });
      setPath(res.path);
      if (res.snapped) toast.success("Route now follows the roads between your points.");
      else toast.error(res.error ?? "Drew straight lines between your points instead.");
    } catch {
      toast.error("Could not build the road route. Please try again.");
    } finally {
      setSnapping(false);
    }
  }

  async function save() {
    if (name.trim().length < 3) {
      setTab("route");
      toast.error("Give your route a clear name, e.g. “Terminal – Palengke – Poblacion”.");
      return;
    }
    const linePath = path.length >= 2 ? path : anchors;
    if (linePath.length < 2) {
      setTab("map");
      toast.error("Add at least two points — type the addresses or tap the map.");
      return;
    }
    setSaving(true);

    const activeDays = schedule.filter((d) => d.active).map((d) => d.day);
    const baseFare = fares.find((f) => Number(f.amount_php) > 0);

    const payload = {
      operator_id: operatorId,
      name: name.trim(),
      code: code.trim() || null,
      fare_php: baseFare ? Number(baseFare.amount_php) : null,
      fare_note: baseFare?.note?.trim() || null,
      first_run: firstRun || null,
      last_run: lastRun || null,
      last_pickup: lastPickup || null,
      trips_per_day: trips ? Number(trips) : null,
      avg_trip_minutes: avgMinutes ? Number(avgMinutes) : null,
      operating_days: activeDays,
      colour,
      notes: notes.trim() || null,
      rental_available: rentalAvailable,
      rental_day_rate_php: rentalAvailable && dayRate ? Number(dayRate) : null,
      rental_note: rentalAvailable ? rentalNote.trim() || null : null,
      path: linePath as unknown as never,
    };

    let savedId = existing?.id;
    if (savedId) {
      const { error } = await supabase.from("jeepney_routes").update(payload).eq("id", savedId);
      if (error) {
        setSaving(false);
        toast.error("Could not save the route. Please try again.");
        return;
      }
      await Promise.all([
        supabase.from("jeepney_stops").delete().eq("route_id", savedId),
        supabase.from("jeepney_day_schedule").delete().eq("route_id", savedId),
        supabase.from("jeepney_route_fares").delete().eq("route_id", savedId),
      ]);
    } else {
      const { data, error } = await supabase
        .from("jeepney_routes")
        .insert({ ...payload, slug: jeepneySlug(name) })
        .select("id")
        .single();
      if (error || !data) {
        setSaving(false);
        toast.error("Could not create the route. Please try again.");
        return;
      }
      savedId = data.id;
    }

    const named = points.filter(isNamedPoint);
    if (named.length) {
      await supabase.from("jeepney_stops").insert(
        named.map((p, i) => ({
          route_id: savedId!,
          name: p.name!.trim(),
          address: p.address ?? null,
          kind: p.kind ?? "stop",
          photo_url: p.photo_url ?? null,
          position: i,
          latitude: p.lat,
          longitude: p.lng,
        })),
      );
    }

    await supabase.from("jeepney_day_schedule").insert(
      schedule.map((row) => ({
        route_id: savedId!,
        day: row.day,
        active: row.active,
        first_run: row.first_run,
        last_run: row.last_run,
        last_pickup: row.last_pickup,
      })),
    );

    const fareRows = fares.filter((f) => f.label.trim() && Number(f.amount_php) >= 0);
    if (fareRows.length) {
      await supabase.from("jeepney_route_fares").insert(
        fareRows.map((f, i) => ({
          route_id: savedId!,
          label: f.label.trim(),
          amount_php: Number(f.amount_php) || 0,
          note: f.note?.trim() || null,
          position: i,
        })),
      );
    }

    setSaving(false);
    toast.success(existing ? "Route updated." : "Route saved as a draft.");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit route" : "Add a jeepney route"}</DialogTitle>
          <DialogDescription>
            Draw the roads you drive, name your stops and landmarks, then set your times, fares and
            rentals.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
            <TabsTrigger value="route">Route</TabsTrigger>
            <TabsTrigger value="map">Map</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="fares">Fares</TabsTrigger>
            <TabsTrigger value="rentals">Rentals</TabsTrigger>
          </TabsList>

          <TabsContent value="route" className="space-y-4 pt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="jr-name">Route name</Label>
                <Input
                  id="jr-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Terminal – Palengke – Poblacion"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jr-code">Route code / body number</Label>
                <Input
                  id="jr-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. 04K"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Route colour</Label>
              <div className="flex flex-wrap gap-1.5">
                {ROUTE_COLOURS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Colour ${c}`}
                    onClick={() => setColour(c)}
                    className={`h-7 w-7 rounded-full border-2 ${colour === c ? "border-foreground" : "border-transparent"}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="jr-notes">Notes for riders</Label>
              <Textarea
                id="jr-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Extra trips on market days, no trips during heavy rain, etc."
              />
            </div>
          </TabsContent>

          <TabsContent value="map" className="space-y-4 pt-3">
            <ClientOnly fallback={<div className="h-72 rounded-md border border-border" />}>
              <Suspense fallback={<div className="h-72 rounded-md border border-border" />}>
                <JeepneyRouteEditor
                  path={path}
                  anchors={anchors}
                  stops={namedStops}
                  colour={colour}
                  followRoads={followRoads}
                  snapping={snapping}
                  onFollowRoadsChange={setFollowRoads}
                  onAnchorsChange={(next) =>
                    setPoints((prev) =>
                      next.map(
                        (a, i) =>
                          ({
                            ...(prev[i] && haversineKm(prev[i]!, a) * 1000 < 5 ? prev[i]! : {}),
                            lat: a.lat,
                            lng: a.lng,
                          }) as RoutePoint,
                      ),
                    )
                  }
                  onAddStop={addStop}
                />
              </Suspense>
            </ClientOnly>

            <JeepneyPointList
              points={points}
              onChange={setPoints}
              onSnap={snapToRoads}
              snapping={snapping}
            />
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4 pt-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="jr-first">Default first run</Label>
                <Input
                  id="jr-first"
                  type="time"
                  value={firstRun}
                  onChange={(e) => setFirstRun(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jr-last">Default last run</Label>
                <Input
                  id="jr-last"
                  type="time"
                  value={lastRun}
                  onChange={(e) => setLastRun(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jr-pickup">Default last pickup</Label>
                <Input
                  id="jr-pickup"
                  type="time"
                  value={lastPickup}
                  onChange={(e) => setLastPickup(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jr-trips">Trips per day</Label>
                <Input
                  id="jr-trips"
                  type="number"
                  value={trips}
                  onChange={(e) => setTrips(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jr-avg">Minutes per trip</Label>
                <Input
                  id="jr-avg"
                  type="number"
                  value={avgMinutes}
                  onChange={(e) => setAvgMinutes(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Operating days and times</Label>
              <JeepneyScheduleGrid
                schedule={schedule}
                defaults={{ first_run: firstRun, last_run: lastRun, last_pickup: lastPickup }}
                onChange={setSchedule}
              />
            </div>
          </TabsContent>

          <TabsContent value="calendar" className="space-y-3 pt-3">
            <p className="text-xs text-muted-foreground">
              Mark maintenance days, record breakdowns and add holiday notices so riders know when
              you are not running.
            </p>
            <JeepneyServiceCalendar routeId={routeId} canEdit />
          </TabsContent>

          <TabsContent value="fares" className="space-y-4 pt-3">
            <p className="text-xs text-muted-foreground">
              Add a line for each zone or service you charge — label them however you like.
            </p>
            <JeepneyFareTable fares={fares} onChange={setFares} />
          </TabsContent>

          <TabsContent value="rentals" className="space-y-3 pt-3">
            <JeepneyRentalPanel
              routeId={routeId}
              rentalAvailable={rentalAvailable}
              dayRate={dayRate}
              rentalNote={rentalNote}
              onAvailableChange={setRentalAvailable}
              onDayRateChange={setDayRate}
              onNoteChange={setRentalNote}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : existing ? "Save changes" : "Save route"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
