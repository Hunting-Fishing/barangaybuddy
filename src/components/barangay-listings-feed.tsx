import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  computeUnitPrice,
  formatPerEach,
  formatPerUnit,
  formatPrice,
} from "@/lib/unit-price";
import { Search, Sparkles } from "lucide-react";

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
  business: { id: string; name: string; slug: string; type: string };
}

interface Row extends FeedListing {
  perEach: number | null;
  perUnit: number | null;
  baseUnit: "kg" | "L" | "pc" | null;
}

export function BarangayListingsFeed({ listings }: { listings: FeedListing[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);

  const rows: Row[] = useMemo(
    () =>
      listings.map((l) => {
        const up = computeUnitPrice(l.price, l.pack_qty, l.size_value, l.size_unit);
        return { ...l, ...up };
      }),
    [listings],
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.category && set.add(r.category));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (cat && r.category !== cat) return false;
      if (!needle) return true;
      return (
        r.name.toLowerCase().includes(needle) ||
        (r.normalized_name ?? "").includes(needle) ||
        r.business.name.toLowerCase().includes(needle)
      );
    });
  }, [rows, q, cat]);

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; items: Row[] }>();
    for (const r of filtered) {
      const key = r.normalized_name || r.name.toLowerCase();
      if (!map.has(key)) map.set(key, { key, label: r.name, items: [] });
      map.get(key)!.items.push(r);
    }
    // sort each group's items: cheapest per-each first, nulls last
    for (const g of map.values()) {
      g.items.sort((a, b) => {
        const av = a.perEach ?? Number.POSITIVE_INFINITY;
        const bv = b.perEach ?? Number.POSITIVE_INFINITY;
        return av - bv;
      });
    }
    // sort groups: most listings first, then alphabetical
    return Array.from(map.values()).sort(
      (a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label),
    );
  }, [filtered]);

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
      </div>

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
                <ListingRow key={r.id} row={r} isBest={idx === 0 && g.items.length > 1 && r.perEach != null} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ListingRow({ row, isBest }: { row: Row; isBest: boolean }) {
  const sizeLabel =
    row.size_value && row.size_unit
      ? `${row.size_value}${row.size_unit} each`
      : null;
  const packLabel = row.pack_qty && row.pack_qty > 1 ? `${row.pack_qty}-pack` : null;
  const subtitle = [packLabel, sizeLabel].filter(Boolean).join(" · ");

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
