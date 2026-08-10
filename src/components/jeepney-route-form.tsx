import { lazy, Suspense, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { ClientOnly } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DAYS, ROUTE_COLOURS, jeepneySlug, type LatLng } from "@/lib/jeepney";
import type { DraftStop } from "@/components/jeepney-route-editor";
import { Trash2 } from "lucide-react";

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
  } | null;
};

export function JeepneyRouteForm({ open, onOpenChange, operatorId, onSaved, existing }: Props) {
  const [tab, setTab] = useState("route");
  const [name, setName] = useState(existing?.name ?? "");
  const [code, setCode] = useState(existing?.code ?? "");
  const [fare, setFare] = useState(existing?.fare_php ? String(existing.fare_php) : "");
  const [fareNote, setFareNote] = useState(existing?.fare_note ?? "");
  const [firstRun, setFirstRun] = useState(existing?.first_run ?? "05:00");
  const [lastRun, setLastRun] = useState(existing?.last_run ?? "21:00");
  const [lastPickup, setLastPickup] = useState(existing?.last_pickup ?? "21:30");
  const [trips, setTrips] = useState(existing?.trips_per_day ? String(existing.trips_per_day) : "");
  const [avgMinutes, setAvgMinutes] = useState(
    existing?.avg_trip_minutes ? String(existing.avg_trip_minutes) : "",
  );
  const [days, setDays] = useState<string[]>(existing?.operating_days ?? [...DAYS]);
  const [colour, setColour] = useState(existing?.colour ?? ROUTE_COLOURS[0]!);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [path, setPath] = useState<LatLng[]>(existing?.path ?? []);
  const [stops, setStops] = useState<DraftStop[]>(existing?.stops ?? []);
  const [saving, setSaving] = useState(false);

  function toggleDay(day: string) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function addStop(point: LatLng) {
    const stopName = window.prompt("Stop name (e.g. Palengke, Terminal, City Hall)");
    if (!stopName) return;
    setStops((prev) => [...prev, { name: stopName.trim().slice(0, 80), lat: point.lat, lng: point.lng }]);
  }

  async function save() {
    if (name.trim().length < 3) {
      setTab("route");
      toast.error("Give your route a clear name, e.g. “Terminal – Palengke – Poblacion”.");
      return;
    }
    if (path.length < 2) {
      setTab("map");
      toast.error("Draw or track at least two points so the route shows as a line on the map.");
      return;
    }
    setSaving(true);

    const payload = {
      operator_id: operatorId,
      name: name.trim(),
      code: code.trim() || null,
      fare_php: fare ? Number(fare) : null,
      fare_note: fareNote.trim() || null,
      first_run: firstRun || null,
      last_run: lastRun || null,
      last_pickup: lastPickup || null,
      trips_per_day: trips ? Number(trips) : null,
      avg_trip_minutes: avgMinutes ? Number(avgMinutes) : null,
      operating_days: days,
      colour,
      notes: notes.trim() || null,
      path: path as unknown as never,
    };

    let routeId = existing?.id;
    if (routeId) {
      const { error } = await supabase.from("jeepney_routes").update(payload).eq("id", routeId);
      if (error) {
        setSaving(false);
        toast.error("Could not save the route. Please try again.");
        return;
      }
      await supabase.from("jeepney_stops").delete().eq("route_id", routeId);
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
      routeId = data.id;
    }

    if (stops.length) {
      await supabase.from("jeepney_stops").insert(
        stops.map((s, i) => ({
          route_id: routeId!,
          name: s.name,
          position: i,
          latitude: s.lat,
          longitude: s.lng,
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
            Draw the roads you drive, add your stops, then set your daily times.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="route">Route</TabsTrigger>
            <TabsTrigger value="map">Map</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="fares">Fares</TabsTrigger>
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
                  stops={stops}
                  colour={colour}
                  onPathChange={setPath}
                  onAddStop={addStop}
                />
              </Suspense>
            </ClientOnly>

            {stops.length > 0 && (
              <div className="space-y-1.5">
                <Label>Stops in order</Label>
                <div className="flex flex-wrap gap-1.5">
                  {stops.map((s, i) => (
                    <Badge key={`${s.name}-${i}`} variant="secondary" className="gap-1">
                      {i + 1}. {s.name}
                      <button
                        type="button"
                        aria-label={`Remove ${s.name}`}
                        onClick={() => setStops((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4 pt-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="jr-first">First run</Label>
                <Input id="jr-first" type="time" value={firstRun} onChange={(e) => setFirstRun(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jr-last">Last run</Label>
                <Input id="jr-last" type="time" value={lastRun} onChange={(e) => setLastRun(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jr-pickup">Last pickup</Label>
                <Input
                  id="jr-pickup"
                  type="time"
                  value={lastPickup}
                  onChange={(e) => setLastPickup(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jr-trips">Trips per day</Label>
                <Input id="jr-trips" type="number" value={trips} onChange={(e) => setTrips(e.target.value)} />
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

            <div className="space-y-1.5">
              <Label>Operating days</Label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d) => (
                  <Button
                    key={d}
                    type="button"
                    size="sm"
                    variant={days.includes(d) ? "default" : "outline"}
                    onClick={() => toggleDay(d)}
                  >
                    {d}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="fares" className="space-y-4 pt-3">
            <p className="text-xs text-muted-foreground">
              Optional — leave blank if your fares vary or you follow the LTFRB matrix.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="jr-fare">Fare (₱)</Label>
                <Input
                  id="jr-fare"
                  type="number"
                  value={fare}
                  onChange={(e) => setFare(e.target.value)}
                  placeholder="13"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jr-farenote">Fare note</Label>
                <Input
                  id="jr-farenote"
                  value={fareNote}
                  onChange={(e) => setFareNote(e.target.value)}
                  placeholder="₱1.80 per km after 4 km"
                />
              </div>
            </div>
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
