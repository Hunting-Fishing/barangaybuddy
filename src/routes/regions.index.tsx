import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { z } from "zod";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon, X } from "lucide-react";
import { LocalityFlag } from "@/components/locality-flag";
import { PhRegionMap } from "@/components/ph-region-map";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  region: z.string().optional(),
  q: z.string().optional(),
});

type RegionRow = { code: string; slug: string; name: string; flag_url: string | null };

const regionsQueryOptions = () =>
  queryOptions({
    queryKey: ["regions"],
    queryFn: async (): Promise<RegionRow[]> => {
      const { data, error } = await supabase.from("regions").select("*").order("name");
      if (error) throw new Error(error.message);
      return (data ?? []) as RegionRow[];
    },
    // Region list is essentially static — keep it fresh for the session so
    // back/forward navigation reads instantly from cache.
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });

export const Route = createFileRoute("/regions/")({
  validateSearch: (s) => searchSchema.parse(s),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(regionsQueryOptions());
  },
  head: () => ({
    meta: [
      { title: "Browse all regions — BarangayHub" },
      { name: "description", content: "Browse businesses across all 17 regions of the Philippines." },
    ],
  }),
  component: Regions,
});

function Regions() {
  const { region: selected, q } = Route.useSearch();
  const navigate = useNavigate({ from: "/regions" });
  const location = useLocation();
  const { data: regions } = useSuspenseQuery(regionsQueryOptions());
  const refs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const mapRef = useRef<HTMLDivElement | null>(null);

  const query = (q ?? "").trim().toLowerCase();
  const filtered = useMemo(
    () => (query ? regions.filter((r) => r.name.toLowerCase().includes(query)) : regions),
    [regions, query]
  );

  // Keep URL highlight in sync with search results: if the currently selected
  // region falls out of the filter, snap to the first match (or clear).
  useEffect(() => {
    if (regions.length === 0 || !query) return;
    const stillVisible = selected && filtered.some((r) => r.slug === selected);
    if (stillVisible) return;
    const next = filtered[0]?.slug;
    navigate({
      search: (prev: { region?: string; q?: string }) => ({ ...prev, region: next }),
      replace: true,
    });
  }, [query, filtered, regions.length, selected, navigate]);

  // Re-run on every history entry (incl. back/forward) so highlight + scroll
  // stay in sync with the URL even when navigating to a previously visited state.
  useEffect(() => {
    if (regions.length === 0) return;
    const id = window.setTimeout(() => {
      if (selected) {
        const el = refs.current[selected];
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus({ preventScroll: true });
        }
      } else {
        mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 60);
    return () => window.clearTimeout(id);
  }, [selected, regions, location.href]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-12">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink asChild><Link to="/">Home</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>Regions</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="mt-6 font-display text-4xl font-bold md:text-5xl">All regions</h1>
        <p className="mt-2 text-muted-foreground">17 regions · 86 provinces · 1,647 cities & municipalities · 42,042 barangays</p>
        <div className="mt-10" ref={mapRef}>
          <PhRegionMap selected={selected} />
        </div>
        <h2 className="mt-16 font-display text-2xl font-bold">All regions</h2>
        <div className="mt-4 relative max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Filter regions by name…"
            value={q ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              navigate({
                search: (prev: { region?: string; q?: string }) => ({
                  ...prev,
                  q: value || undefined,
                }),
                replace: true,
              });
            }}
            className="pl-9 pr-9"
            aria-label="Filter regions by name"
          />
          {q ? (
            <button
              type="button"
              onClick={() =>
                navigate({
                  search: (prev: { region?: string; q?: string }) => ({ ...prev, q: undefined }),
                  replace: true,
                })
              }
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        {regions.length > 0 && filtered.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No regions match "{q}".</p>
        ) : null}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => {
            const isActive = selected === r.slug;
            return (
              <Link
                key={r.code}
                to="/regions/$region"
                params={{ region: r.slug }}
                ref={(el) => { refs.current[r.slug] = el; }}
                id={r.slug}
              >
                <Card
                  className={cn(
                    "flex items-center gap-4 p-5 transition-all hover:-translate-y-1 hover:shadow-elegant",
                    isActive && "ring-2 ring-primary shadow-elegant -translate-y-1"
                  )}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-sun shadow-sun">
                    <MapPin className="h-6 w-6 text-sun-foreground" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold">{r.name}</h3>
                    <p className="text-xs text-muted-foreground">View provinces →</p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
