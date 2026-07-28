import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { BrgyQueryResult, BrgyResult } from "@/lib/barangay-directory";

type Props = {
  filtersReady: boolean;
  isFetching: boolean;
  results?: BrgyQueryResult;
  rows: BrgyResult[];
  total: number;
  letter?: string;
  canLoadMore: boolean;
  onLoadMore: () => void;
};

export function BarangayDirectoryResults({
  filtersReady,
  isFetching,
  results,
  rows,
  total,
  letter,
  canLoadMore,
  onLoadMore,
}: Props) {
  if (!filtersReady || (isFetching && !results)) {
    return (
      <div className="mt-8">
        <p className="text-sm text-muted-foreground">Loading barangays…</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="mt-8">
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No barangays match your filters.
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Showing {rows.length.toLocaleString()} of {total.toLocaleString()} barangays
          {letter ? ` starting with “${letter}”` : ""}.
        </p>
        {isFetching && <p className="text-xs text-muted-foreground">Updating…</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((barangay) => (
          <Link
            key={barangay.code}
            to="/barangays/$city/$barangay"
            params={{ city: barangay.city_slug, barangay: barangay.slug }}
          >
            <Card className="flex h-full items-start gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-elegant">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate font-display font-bold leading-tight">{barangay.name}</h3>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {barangay.city_name}
                  {barangay.province_name ? `, ${barangay.province_name}` : ""}
                </p>
                {barangay.region_name && (
                  <p className="mt-0.5 truncate text-[11px] uppercase tracking-wider text-muted-foreground/70">
                    {barangay.region_name}
                  </p>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        {canLoadMore ? (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isFetching}
            className="rounded-md border border-border px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isFetching ? "Loading…" : "Load more"}
          </button>
        ) : (
          <p className="text-xs text-muted-foreground">You’ve reached the end of this list.</p>
        )}
      </div>
    </div>
  );
}
