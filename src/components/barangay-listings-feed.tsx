import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  computeUnitPrice,
  formatPerEach,
  formatPerUnit,
  formatPrice,
} from "@/lib/unit-price";
import { Search, Sparkles, Navigation } from "lucide-react";

export interface FeedListing {
  id: string;
  name: string;
  normalized_name: string | null;
  description: string | null;
  price: number | null;
  pack_qty: number | null;
  size_value: number | null;
  size_unit: string | null;
  image_url: string | null;
  in_stock: boolean;
  category: string | null;
  business: {
    id: string;
    name: string;
    slug: string;
    type: string;
    latitude?: number | null;
    longitude?: number | null;
  };
}

type SortMode = "best" | "per-each" | "per-kg" | "per-l" | "per-pc" | "distance";

interface Row extends FeedListing {
  perEach: number | null;
  perUnit: number | null;
  baseUnit: "kg" | "L" | "pc" | null;
  distanceKm: number | null;
}

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "best", label: "Best deal" },
  { value: "per-each", label: "Lowest per each" },
  { value: "per-kg", label: "Lowest per kg" },
  { value: "per-l", label: "Lowest per L" },
  { value: "per-pc", label: "Lowest per piece" },
  { value: "distance", label: "Nearest to me" },
];

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function BarangayListingsFeed({ listings }: { listings: FeedListing[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("best");
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number>(10);

  const requestLocation = () => {
    if (!("geolocation" in navigator)) {
      setGeoErr("Location not supported by this browser.");
      return;
    }
    setGeoLoading(true);
    setGeoErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoLoading(false);
      },
      (err) => {
        setGeoErr(err.message || "Could not get location.");
        setGeoLoading(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  };

  useEffect(() => {
    if (sort === "distance" && !geo && !geoLoading && !geoErr) {
      requestLocation();
    }
  }, [sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows: Row[] = useMemo(
    () =>
      listings.map((l) => {
        const up = computeUnitPrice(l.price, l.pack_qty, l.size_value, l.size_unit);
        const lat = l.business.latitude;
        const lng = l.business.longitude;
        const distanceKm =
          geo && lat != null && lng != null
            ? haversineKm(geo, { lat: Number(lat), lng: Number(lng) })
            : null;
        return { ...l, ...up, distanceKm };
      }),
    [listings, geo],
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.category && set.add(r.category));
    return Array.from(set).sort();
  }, [rows]);

  const radiusActive = sort === "distance" && geo != null;
  const hiddenByRadius = useMemo(
    () =>
      radiusActive
        ? rows.filter((r) => r.distanceKm == null || r.distanceKm > radiusKm).length
        : 0,
    [rows, radiusActive, radiusKm],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (cat && r.category !== cat) return false;
      if (radiusActive) {
        if (r.distanceKm == null || r.distanceKm > radiusKm) return false;
      }
      if (!needle) return true;
      return (
        r.name.toLowerCase().includes(needle) ||
        (r.normalized_name ?? "").includes(needle) ||
        r.business.name.toLowerCase().includes(needle)
      );
    });
  }, [rows, q, cat, radiusActive, radiusKm]);

  const itemScore = (r: Row): number => {
    const inf = Number.POSITIVE_INFINITY;
    switch (sort) {
      case "per-each":
        return r.perEach ?? inf;
      case "per-kg":
        return r.baseUnit === "kg" && r.perUnit != null ? r.perUnit : inf;
      case "per-l":
        return r.baseUnit === "L" && r.perUnit != null ? r.perUnit : inf;
      case "per-pc":
        return r.baseUnit === "pc" && r.perUnit != null ? r.perUnit : inf;
      case "distance":
        return r.distanceKm ?? inf;
      case "best":
      default:
        return r.perEach ?? inf;
    }
  };

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; items: Row[] }>();
    for (const r of filtered) {
      const key = r.normalized_name || r.name.toLowerCase();
      if (!map.has(key)) map.set(key, { key, label: r.name, items: [] });
      map.get(key)!.items.push(r);
    }
    for (const g of map.values()) {
      g.items.sort((a, b) => itemScore(a) - itemScore(b));
    }
    const list = Array.from(map.values());
    if (sort === "best") {
      list.sort(
        (a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label),
      );
    } else {
      list.sort((a, b) => {
        const av = a.items.length ? itemScore(a.items[0]) : Number.POSITIVE_INFINITY;
        const bv = b.items.length ? itemScore(b.items[0]) : Number.POSITIVE_INFINITY;
        return av - bv || a.label.localeCompare(b.label);
      });
    }
    return list;
  }, [filtered, sort, geo]);

  if (listings.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="font-display text-lg font-bold">No products listed in this barangay yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Business owners can post products with pack size and weight so neighbours can compare prices.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products or sellers…"
            className="pl-9"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
          <SelectTrigger className="md:w-56">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {sort === "distance" && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Navigation className="h-3.5 w-3.5" />
            {geo ? (
              <span className="text-muted-foreground">
                Sorted from your location. Sellers without a map pin are excluded.
              </span>
            ) : geoLoading ? (
              <span className="text-muted-foreground">Getting your location…</span>
            ) : (
              <>
                <span className="text-muted-foreground">
                  {geoErr ? `Location blocked: ${geoErr}` : "Allow location to sort by distance."}
                </span>
                <Button size="sm" variant="outline" onClick={requestLocation}>
                  Use my location
                </Button>
              </>
            )}
          </div>
          {geo && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:min-w-[16rem]">
                <span className="text-muted-foreground">Within</span>
                <span className="font-medium tabular-nums">
                  {radiusKm < 1 ? `${Math.round(radiusKm * 1000)} m` : `${radiusKm} km`}
                </span>
              </div>
              <Slider
                className="flex-1"
                min={0.5}
                max={50}
                step={0.5}
                value={[radiusKm]}
                onValueChange={(v) => setRadiusKm(v[0] ?? radiusKm)}
              />
              {hiddenByRadius > 0 && (
                <span className="text-muted-foreground">
                  {hiddenByRadius} hidden
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCat(null)}
            className={`rounded-full px-3 py-1 text-xs ${
              cat === null
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c === cat ? null : c)}
              className={`rounded-full px-3 py-1 text-xs ${
                cat === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground">No matches.</p>
      )}

      <div className="space-y-8">
        {groups.map((g) => (
          <section key={g.key}>
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="font-display text-xl font-bold capitalize">{g.label}</h3>
              <span className="text-xs text-muted-foreground">
                {g.items.length} {g.items.length === 1 ? "listing" : "listings"}
              </span>
            </div>
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {g.items.map((r, idx) => (
                <ListingRow
                  key={r.id}
                  row={r}
                  showDistance={sort === "distance" && geo != null}
                  isBest={idx === 0 && g.items.length > 1 && r.perEach != null}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ListingRow({
  row,
  isBest,
  showDistance,
}: {
  row: Row;
  isBest: boolean;
  showDistance: boolean;
}) {
  const sizeLabel =
    row.size_value && row.size_unit
      ? `${row.size_value}${row.size_unit} each`
      : null;
  const packLabel = row.pack_qty && row.pack_qty > 1 ? `${row.pack_qty}-pack` : null;
  const subtitle = [packLabel, sizeLabel].filter(Boolean).join(" · ");

  const distLabel =
    showDistance && row.distanceKm != null
      ? row.distanceKm < 1
        ? `${Math.round(row.distanceKm * 1000)} m away`
        : `${row.distanceKm.toFixed(1)} km away`
      : null;

  return (
    <div className="flex gap-4 p-4">
      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-secondary">
        {row.image_url ? (
          <img src={row.image_url} alt={row.name} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="font-medium">{row.name}</div>
            {subtitle && (
              <div className="text-xs text-muted-foreground">{subtitle}</div>
            )}
            <Link
              to="/business/$slug"
              params={{ slug: row.business.slug }}
              className="mt-0.5 inline-block text-xs text-primary hover:underline"
            >
              {row.business.name}
            </Link>
            {distLabel && (
              <div className="mt-0.5 text-xs text-muted-foreground">{distLabel}</div>
            )}
          </div>
          <div className="text-right">
            <div className="font-display text-lg font-bold">{formatPrice(row.price)}</div>
            <div className="space-x-2 text-xs text-muted-foreground">
              {formatPerEach(row.perEach) && <span>{formatPerEach(row.perEach)}</span>}
              {formatPerUnit(row.perUnit, row.baseUnit) && (
                <span>· {formatPerUnit(row.perUnit, row.baseUnit)}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isBest && (
            <Badge className="gap-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white">
              <Sparkles className="h-3 w-3" /> Best deal
            </Badge>
          )}
          {!row.in_stock && <Badge variant="outline">Out of stock</Badge>}
          {row.category && <Badge variant="secondary">{row.category}</Badge>}
        </div>
      </div>
    </div>
  );
}
