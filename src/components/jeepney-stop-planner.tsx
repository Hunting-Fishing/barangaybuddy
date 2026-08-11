import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, MapPin, Search, Trash2, Waypoints } from "lucide-react";
import { searchPhilippinesPlaces, type GeoPlace } from "@/lib/jeepney-geo.functions";
import type { DraftStop } from "@/components/jeepney-route-editor";

type Props = {
  stops: DraftStop[];
  onChange: (stops: DraftStop[]) => void;
  onSnap: () => void;
  snapping: boolean;
};

export function JeepneyStopPlanner({ stops, onChange, onSnap, snapping }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 3) {
      setResults([]);
      return;
    }
    const mine = ++seq.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchPhilippinesPlaces({ data: { query: text } });
        if (mine !== seq.current) return;
        setResults(res.places);
        if (res.error) toast.error(res.error);
      } catch {
        if (mine === seq.current) setResults([]);
      } finally {
        if (mine === seq.current) setSearching(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  function addPlace(place: GeoPlace) {
    onChange([
      ...stops,
      { name: place.name.slice(0, 80), address: place.address, lat: place.lat, lng: place.lng },
    ]);
    setQuery("");
    setResults([]);
  }

  function update(index: number, patch: Partial<DraftStop>) {
    onChange(stops.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= stops.length) return;
    const next = stops.slice();
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row!);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="jr-stop-search">Type a street, landmark or address</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="jr-stop-search"
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Rizal Street, Iloilo City"
            autoComplete="off"
          />
        </div>
        {searching && <p className="text-xs text-muted-foreground">Searching…</p>}
        {results.length > 0 && (
          <div className="max-h-52 overflow-y-auto rounded-md border border-border">
            {results.map((place) => (
              <button
                key={place.id}
                type="button"
                onClick={() => addPlace(place)}
                className="flex w-full items-start gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  <span className="font-medium">{place.name}</span>
                  <span className="block text-xs text-muted-foreground">{place.address}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>Stops in order</Label>
          <Button type="button" size="sm" variant="outline" onClick={onSnap} disabled={snapping}>
            <Waypoints className="mr-1.5 h-4 w-4" />
            {snapping ? "Following roads…" : "Snap route to roads"}
          </Button>
        </div>

        {stops.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No stops yet. Search an address above, or tap the map in “Add stop” mode. Stops are
            numbered #1, #2, #3 in the order you add them.
          </p>
        ) : (
          <ol className="space-y-2">
            {stops.map((stop, i) => (
              <li
                key={`${stop.name}-${i}`}
                className="rounded-md border border-border p-2 sm:flex sm:items-center sm:gap-2"
              >
                <span className="mb-1 inline-flex h-6 w-8 shrink-0 items-center justify-center rounded bg-muted text-xs font-bold sm:mb-0">
                  #{i + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <Input
                    value={stop.name}
                    onChange={(e) => update(i, { name: e.target.value.slice(0, 80) })}
                    placeholder="Stop name (Palengke, Terminal…)"
                    className="h-8"
                  />
                  <Input
                    value={stop.address ?? ""}
                    onChange={(e) => update(i, { address: e.target.value.slice(0, 160) })}
                    placeholder="Street address (optional)"
                    className="h-8 text-xs"
                  />
                  <div className="flex flex-wrap gap-1">
                    {STOP_KINDS.map((k) => (
                      <Button
                        key={k.value}
                        type="button"
                        size="sm"
                        variant={(stop.kind ?? "stop") === k.value ? "default" : "outline"}
                        className="h-7 px-2 text-[11px]"
                        onClick={() => update(i, { kind: k.value })}
                      >
                        <span
                          className="mr-1 inline-block h-2 w-2 rounded-full"
                          style={{ background: k.colour }}
                        />
                        {k.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="mt-1 flex shrink-0 gap-1 sm:mt-0">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Move stop ${i + 1} up`}
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Move stop ${i + 1} down`}
                    onClick={() => move(i, 1)}
                    disabled={i === stops.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove stop ${i + 1}`}
                    onClick={() => onChange(stops.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
