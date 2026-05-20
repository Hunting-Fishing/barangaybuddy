import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Search as SearchIcon, X, MapPin } from "lucide-react";

const searchSchema = z.object({
  q: z.string().optional(),
  region: z.string().optional(),
  province: z.string().optional(),
});

type Region = { code: string; slug: string; name: string };
type Province = { code: string; slug: string; name: string; region_code: string };

export const Route = createFileRoute("/barangays/")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Barangay directory — BarangayHub" },
      {
        name: "description",
        content:
          "Search 42,000+ Philippine barangays by name and filter by region or province. Find your barangay's businesses, stores, and services.",
      },
      { property: "og:title", content: "Barangay directory — BarangayHub" },
      {
        property: "og:description",
        content:
          "Search 42,000+ Philippine barangays by name and filter by region or province.",
      },
    ],
  }),
  component: BarangaysIndex,
});

type BrgyResult = {
  code: string;
  slug: string;
  name: string;
  city_code: string;
  city_name: string;
  city_slug: string;
  province_name: string;
  province_slug: string;
  region_name: string;
};

const PAGE_SIZE = 60;

function BarangaysIndex() {
  const { q, region, province } = Route.useSearch();
  const navigate = useNavigate({ from: "/barangays" });

  // Local debounced query so URL doesn't update on every keystroke
  const [draft, setDraft] = useState(q ?? "");
  useEffect(() => setDraft(q ?? ""), [q]);
  useEffect(() => {
    const id = window.setTimeout(() => {
      if ((draft || undefined) === q) return;
      navigate({
        search: (prev) => ({ ...prev, q: draft || undefined }),
        replace: true,
      });
    }, 250);
    return () => window.clearTimeout(id);
  }, [draft, q, navigate]);

  // Regions + provinces (static-ish data, cache long)
  const { data: regions = [] } = useQuery({
    queryKey: ["regions-list"],
    queryFn: async (): Promise<Region[]> => {
      const { data, error } = await supabase
        .from("regions")
        .select("code,slug,name")
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 60 * 60 * 1000,
  });

  const { data: provinces = [] } = useQuery({
    queryKey: ["provinces-list"],
    queryFn: async (): Promise<Province[]> => {
      const { data, error } = await supabase
        .from("provinces")
        .select("code,slug,name,region_code")
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 60 * 60 * 1000,
  });

  const selectedRegion = useMemo(
    () => regions.find((r) => r.slug === region),
    [regions, region],
  );
  const selectedProvince = useMemo(
    () => provinces.find((p) => p.slug === province),
    [provinces, province],
  );

  const filteredProvinces = useMemo(
    () =>
      selectedRegion
        ? provinces.filter((p) => p.region_code === selectedRegion.code)
        : provinces,
    [provinces, selectedRegion],
  );

  // Results query — runs whenever filters change.
  const queryStr = (q ?? "").trim();
  const enabled = queryStr.length >= 2 || !!province || !!region;

  const { data: results, isFetching } = useQuery({
    queryKey: ["barangay-search", queryStr, region ?? null, province ?? null],
    enabled,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<BrgyResult[]> => {
      // Narrow the city_code universe by region/province filters first.
      let cityCodes: string[] | null = null;
      if (selectedProvince) {
        const { data: cs, error: e1 } = await supabase
          .from("cities_municipalities")
          .select("code")
          .eq("province_code", selectedProvince.code);
        if (e1) throw new Error(e1.message);
        cityCodes = (cs ?? []).map((c) => c.code);
        if (cityCodes.length === 0) return [];
      } else if (selectedRegion) {
        const provCodes = provinces
          .filter((p) => p.region_code === selectedRegion.code)
          .map((p) => p.code);
        if (provCodes.length === 0) return [];
        const { data: cs, error: e1 } = await supabase
          .from("cities_municipalities")
          .select("code")
          .in("province_code", provCodes);
        if (e1) throw new Error(e1.message);
        cityCodes = (cs ?? []).map((c) => c.code);
        if (cityCodes.length === 0) return [];
      }

      let bq = supabase
        .from("barangays")
        .select("code,slug,name,city_code")
        .order("name")
        .limit(PAGE_SIZE);
      if (queryStr.length >= 2) bq = bq.ilike("name", `%${queryStr}%`);
      if (cityCodes) bq = bq.in("city_code", cityCodes);

      const { data: brgys, error } = await bq;
      if (error) throw new Error(error.message);
      if (!brgys || brgys.length === 0) return [];

      // Hydrate city + province + region names client-side.
      const cityCodesNeeded = [...new Set(brgys.map((b) => b.city_code))];
      const { data: cities } = await supabase
        .from("cities_municipalities")
        .select("code,slug,name,province_code")
        .in("code", cityCodesNeeded);
      const cityMap = new Map((cities ?? []).map((c) => [c.code, c]));

      const provCodesNeeded = [
        ...new Set((cities ?? []).map((c) => c.province_code)),
      ];
      const provMap = new Map(
        provinces.filter((p) => provCodesNeeded.includes(p.code)).map((p) => [p.code, p]),
      );
      const regionMap = new Map(regions.map((r) => [r.code, r]));

      return brgys.map((b) => {
        const city = cityMap.get(b.city_code);
        const prov = city ? provMap.get(city.province_code) : undefined;
        const reg = prov ? regionMap.get(prov.region_code) : undefined;
        return {
          code: b.code,
          slug: b.slug,
          name: b.name,
          city_code: b.city_code,
          city_name: city?.name ?? "",
          city_slug: city?.slug ?? "",
          province_name: prov?.name ?? "",
          province_slug: prov?.slug ?? "",
          region_name: reg?.name ?? "",
        };
      });
    },
  });

  const setSearch = (next: Partial<{ q?: string; region?: string; province?: string }>) =>
    navigate({
      search: (prev) => ({ ...prev, ...next }),
      replace: true,
    });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-12">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Barangays</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <h1 className="mt-6 font-display text-4xl font-bold md:text-5xl">
          Barangay directory
        </h1>
        <p className="mt-2 text-muted-foreground">
          Search 42,042 barangays across the Philippines. Filter by region or province to narrow down.
        </p>

        {/* Filters */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_220px_220px_auto]">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search barangay name (min 2 chars)…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="pl-9 pr-9"
              aria-label="Search barangays"
            />
            {draft ? (
              <button
                type="button"
                onClick={() => setDraft("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <Select
            value={region ?? "all"}
            onValueChange={(v) =>
              setSearch({
                region: v === "all" ? undefined : v,
                // clear province when region changes
                province: undefined,
              })
            }
          >
            <SelectTrigger aria-label="Filter by region">
              <SelectValue placeholder="All regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All regions</SelectItem>
              {regions.map((r) => (
                <SelectItem key={r.code} value={r.slug}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={province ?? "all"}
            onValueChange={(v) => setSearch({ province: v === "all" ? undefined : v })}
          >
            <SelectTrigger aria-label="Filter by province">
              <SelectValue placeholder="All provinces" />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="all">All provinces</SelectItem>
              {filteredProvinces.map((p) => (
                <SelectItem key={p.code} value={p.slug}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(q || region || province) && (
            <button
              type="button"
              onClick={() => {
                setDraft("");
                navigate({ search: {}, replace: true });
              }}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Reset filters
            </button>
          )}
        </div>

        {/* Results */}
        <div className="mt-8">
          {!enabled ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Type at least 2 characters or pick a region/province to start browsing barangays.
            </Card>
          ) : isFetching && !results ? (
            <p className="text-sm text-muted-foreground">Searching…</p>
          ) : results && results.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              No barangays match your filters.
            </Card>
          ) : results ? (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                Showing {results.length} {results.length === PAGE_SIZE ? "of many " : ""}barangays
                {results.length === PAGE_SIZE ? " — refine your search to see more." : "."}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((b) => (
                  <Link
                    key={b.code}
                    to="/barangays/$city/$barangay"
                    params={{ city: b.city_slug, barangay: b.slug }}
                  >
                    <Card className="flex h-full items-start gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-elegant">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-display font-bold leading-tight">
                          {b.name}
                        </h3>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {b.city_name}
                          {b.province_name ? `, ${b.province_name}` : ""}
                        </p>
                        {b.region_name && (
                          <p className="mt-0.5 truncate text-[11px] uppercase tracking-wider text-muted-foreground/70">
                            {b.region_name}
                          </p>
                        )}
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
