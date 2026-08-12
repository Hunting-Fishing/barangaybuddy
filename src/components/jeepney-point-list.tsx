import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Loader2,
  MapPin,
  Search,
  Trash2,
  Waypoints,
} from "lucide-react";
import { searchPhilippinesPlaces, type GeoPlace } from "@/lib/jeepney-geo.functions";
import { STOP_KINDS, type RoutePoint, type StopKind } from "@/lib/jeepney";
import { uploadJeepneyPhoto } from "@/lib/jeepney-media";
import { JeepneyPhotoThumb } from "@/components/jeepney-photo-thumb";
import { useAuth } from "@/hooks/use-auth";

type Props = {
  points: RoutePoint[];
  onChange: (points: RoutePoint[]) => void;
  onSnap: () => void;
  snapping: boolean;
};

export function JeepneyPointList({ points, onChange, onSnap, snapping }: Props) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});
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
      ...points,
      {
        name: place.name.slice(0, 80),
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        kind: "stop",
      },
    ]);
    setQuery("");
    setResults([]);
  }

  function update(index: number, patch: Partial<RoutePoint>) {
    onChange(points.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= points.length) return;
    const next = points.slice();
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row!);
    onChange(next);
  }

  async function pickPhoto(index: number, file: File | undefined) {
    if (!file) return;
    if (!user) {
      toast.error("Sign in to add a photo.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.error("That photo is too large — please use one under 6 MB.");
      return;
    }
    setUploading(index);
    try {
      const path = await uploadJeepneyPhoto(file, user.id);
      update(index, { photo_url: path });
      toast.success("Photo added — riders will see it on this point.");
    } catch {
      toast.error("Could not upload that photo. Please try again.");
    } finally {
      setUploading(null);
    }
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
          <Label>Route points in order</Label>
          <Button type="button" size="sm" variant="outline" onClick={onSnap} disabled={snapping}>
            <Waypoints className="mr-1.5 h-4 w-4" />
            {snapping ? "Following roads…" : "Snap route to roads"}
          </Button>
        </div>

        {points.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No points yet. Search an address above, or tap the map — each point is numbered #1, #2,
            #3 in order. Name a point to turn it into a stop, waiting area, terminal or landmark.
          </p>
        ) : (
          <ol className="space-y-2">
            {points.map((point, i) => {
              const named = Boolean(point.name?.trim());
              return (
                <li key={`pt-${i}`} className="rounded-md border border-border p-2">
                  <div className="flex items-start gap-2">
                    <span className="inline-flex h-6 w-8 shrink-0 items-center justify-center rounded bg-muted text-xs font-bold">
                      #{i + 1}
                    </span>

                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap gap-1.5">
                        <Input
                          value={point.name ?? ""}
                          onChange={(e) => update(i, { name: e.target.value.slice(0, 80) })}
                          placeholder="Name it — Palengke, waiting shed, City Hall… (optional)"
                          className="h-8 min-w-[10rem] flex-1"
                        />
                        <Select
                          value={point.kind ?? "stop"}
                          onValueChange={(v) => update(i, { kind: v as StopKind, name: point.name ?? "" })}
                        >
                          <SelectTrigger className="h-8 w-[9.5rem] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="z-[2100]">
                            {STOP_KINDS.map((k) => (
                              <SelectItem key={k.value} value={k.value}>
                                <span className="flex items-center gap-2">
                                  <span
                                    className="inline-block h-2 w-2 rounded-full"
                                    style={{ background: k.colour }}
                                  />
                                  {k.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Input
                        value={point.address ?? ""}
                        onChange={(e) => update(i, { address: e.target.value.slice(0, 160) })}
                        placeholder="Street address (optional)"
                        className="h-8 text-xs"
                      />

                      <div className="flex flex-wrap items-center gap-2">
                        <JeepneyPhotoThumb path={point.photo_url} alt={point.name ?? "Route point"} />
                        <input
                          ref={(el) => {
                            fileRefs.current[i] = el;
                          }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            void pickPhoto(i, e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => fileRefs.current[i]?.click()}
                          disabled={uploading === i}
                        >
                          {uploading === i ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Camera className="mr-1 h-3.5 w-3.5" />
                          )}
                          {point.photo_url ? "Change photo" : "Add photo"}
                        </Button>
                        {point.photo_url && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => update(i, { photo_url: null })}
                          >
                            Remove photo
                          </Button>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                          {named ? "" : " · shaping point only"}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-0.5">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={`Move point ${i + 1} up`}
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={`Move point ${i + 1} down`}
                        onClick={() => move(i, 1)}
                        disabled={i === points.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={`Remove point ${i + 1}`}
                        onClick={() => onChange(points.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
