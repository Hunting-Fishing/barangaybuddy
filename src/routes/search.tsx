import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { BUSINESS_TYPES, BUSINESS_TYPE_LABEL, type BusinessType } from "@/lib/business-types";
import { FEATURE_TAG_GROUPS, tagLabel } from "@/lib/business-tags";

const RESULTS_PER_PAGE = 12;

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Search businesses — BarangayHub" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s.q === "string" ? s.q : "",
    types: Array.isArray(s.types) ? (s.types as string[]).filter((x) => BUSINESS_TYPES.includes(x as BusinessType)) : [],
    tags: Array.isArray(s.tags) ? (s.tags as string[]).filter((x) => typeof x === "string") : [],
    page: typeof s.page === "number" && s.page > 0 ? s.page : 1,
  }),
  component: SearchPage,
});

function SearchPage() {
  const searchParams = Route.useSearch();
  const { q: urlQ, types: urlTypes, tags: urlTags, page } = searchParams;
  const navigate = useNavigate({ from: "/search" });

  const [q, setQ] = useState(urlQ);
  const [types, setTypes] = useState<BusinessType[]>(urlTypes as BusinessType[]);
  const [tags, setTags] = useState<string[]>(urlTags);
  const [tagQ, setTagQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Sync URL changes (back/forward) into local state
  useEffect(() => { setQ(urlQ); }, [urlQ]);
  useEffect(() => { setTypes(urlTypes as BusinessType[]); }, [urlTypes]);
  useEffect(() => { setTags(urlTags); }, [urlTags]);

  // Sync URL <- state (debounced); reset page to 1 on filter change
  useEffect(() => {
    const t = setTimeout(() => {
      navigate({ search: { ...searchParams, q, types, tags, page: 1 }, replace: true });
    }, 200);
    return () => clearTimeout(t);
  }, [q, types, tags, navigate]);

  // Fetch
  useEffect(() => {
    const hasFilter = q.trim().length > 1 || types.length > 0 || tags.length > 1;
    if (!hasFilter) { setResults([]); setTotalCount(0); return; }

    setLoading(true);
    const t = setTimeout(async () => {
      const offset = (page - 1) * RESULTS_PER_PAGE;
      let query = supabase
        .from("businesses")
        .select(
          "id, name, slug, type, additional_types, custom_types, tags, description, cover_image_url, barangays(name, cities_municipalities(name))",
          { count: "exact" }
        )
        .eq("is_published", true)
        .range(offset, offset + RESULTS_PER_PAGE - 1);

      if (q.trim()) {
        const safe = q.trim().replace(/[%,()]/g, " ");
        query = query.or(`name.ilike.%${safe}%,description.ilike.%${safe}%`);
      }
      if (types.length > 0) {
        const inList = types.join(",");
        const ovList = `{${types.join(",")}}`;
        query = query.or(`type.in.(${inList}),additional_types.ov.${ovList}`);
      }
      if (tags.length > 0) {
        query = query.overlaps("tags", tags);
      }

      const { data, count, error } = await query;
      if (error) console.error(error);
      setResults(data ?? []);
      setTotalCount(count ?? 0);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, types, tags, page]);

  const filteredTagGroups = useMemo(() => {
    const needle = tagQ.trim().toLowerCase();
    if (!needle) return FEATURE_TAG_GROUPS;
    return FEATURE_TAG_GROUPS.map((g) => ({
      ...g,
      tags: g.tags.filter((t) => t.label.toLowerCase().includes(needle)),
    })).filter((g) => g.tags.length > 0);
  }, [tagQ]);

  const activeCount = types.length + tags.length;
  const hasAnyFilter = q.trim().length > 0 || activeCount > 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / RESULTS_PER_PAGE));
  const startItem = totalCount === 0 ? 0 : (page - 1) * RESULTS_PER_PAGE + 1;
  const endItem = Math.min(page * RESULTS_PER_PAGE, totalCount);

  function clearAll() { setQ(""); setTypes([]); setTags([]); }

  function goToPage(n: number) {
    if (n < 1 || n > totalPages) return;
    navigate({ search: (prev) => ({ ...prev, page: n }) });
  }

  function renderPageNumbers() {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 3) {
        pages.push(1, 2, 3, "ellipsis", totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1, "ellipsis", totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "ellipsis", page, "ellipsis", totalPages);
      }
    }
    return pages.map((p, idx) =>
      p === "ellipsis" ? (
        <PaginationItem key={`el-${idx}`}>
          <PaginationEllipsis />
        </PaginationItem>
      ) : (
        <PaginationItem key={p}>
          <PaginationLink isActive={page === p} onClick={() => goToPage(p)}>
            {p}
          </PaginationLink>
        </PaginationItem>
      )
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-12">
        <h1 className="font-display text-4xl font-bold">Search businesses</h1>
        <p className="mt-1 text-muted-foreground">Find by name, category, or features.</p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search businesses…"
              className="h-12 pl-12 text-base"
            />
          </div>
          <Button variant="outline" onClick={() => setShowFilters((s) => !s)} className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeCount > 0 && <Badge variant="secondary">{activeCount}</Badge>}
          </Button>
          {hasAnyFilter && (
            <Button variant="ghost" onClick={clearAll} className="gap-1">
              <X className="h-4 w-4" /> Clear
            </Button>
          )}
        </div>

        {/* Active filter chips */}
        {(types.length > 0 || tags.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {types.map((t) => (
              <Badge key={`t-${t}`} variant="secondary" className="gap-1">
                {BUSINESS_TYPE_LABEL[t]}
                <button onClick={() => setTypes(types.filter((x) => x !== t))} aria-label={`Remove ${BUSINESS_TYPE_LABEL[t]}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {tags.map((s) => (
              <Badge key={`tag-${s}`} className="gap-1">
                {tagLabel(s)}
                <button onClick={() => setTags(tags.filter((x) => x !== s))} aria-label={`Remove ${tagLabel(s)}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          {showFilters && (
            <aside className="space-y-5">
              <Card className="p-4">
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">Categories</h3>
                <div className="mt-3 grid max-h-72 grid-cols-1 gap-1.5 overflow-auto sm:grid-cols-2 lg:grid-cols-1">
                  {BUSINESS_TYPES.map((t) => {
                    const checked = types.includes(t);
                    return (
                      <label key={t} className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => setTypes(c ? [...types, t] : types.filter((x) => x !== t))}
                        />
                        {BUSINESS_TYPE_LABEL[t]}
                      </label>
                    );
                  })}
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">Features</h3>
                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={tagQ} onChange={(e) => setTagQ(e.target.value)} placeholder="Search features…" className="pl-9" />
                </div>
                <div className="mt-3 max-h-96 space-y-3 overflow-auto">
                  {filteredTagGroups.length === 0 && <p className="text-sm text-muted-foreground">No matches.</p>}
                  {filteredTagGroups.map((g) => (
                    <div key={g.id}>
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</div>
                      <div className="mt-1.5 grid grid-cols-1 gap-1">
                        {g.tags.map((tag) => {
                          const checked = tags.includes(tag.slug);
                          return (
                            <label key={tag.slug} className="flex cursor-pointer items-center gap-2 text-sm">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(c) => setTags(c ? [...tags, tag.slug] : tags.filter((x) => x !== tag.slug))}
                              />
                              {tag.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </aside>
          )}

          <section className={showFilters ? "" : "lg:col-span-2"}>
            {loading && <p className="text-sm text-muted-foreground">Searching…</p>}
            {!loading && !hasAnyFilter && (
              <Card className="p-10 text-center text-muted-foreground">
                Start typing or pick a category / feature to see results.
              </Card>
            )}
            {!loading && hasAnyFilter && results.length === 0 && (
              <p className="text-muted-foreground">No matches. Try removing a filter.</p>
            )}

            {!loading && totalCount > 1 && (
              <p className="mb-3 text-sm text-muted-foreground">
                Showing {startItem}–{endItem} of {totalCount} results
              </p>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {results.map((b: any) => {
                const cats: string[] = [
                  BUSINESS_TYPE_LABEL[b.type as BusinessType] ?? b.type,
                  ...(b.additional_types ?? []).map((t: BusinessType) => BUSINESS_TYPE_LABEL[t] ?? t),
                  ...(b.custom_types ?? []),
                ];
                const place = b.barangays?.name
                  ? `${b.barangays.name}${b.barangays.cities_municipalities?.name ? ", " + b.barangays.cities_municipalities.name : ""}`
                  : null;
                return (
                  <Link key={b.id} to="/business/$slug" params={{ slug: b.slug }}>
                    <Card className="overflow-hidden p-5 transition-all hover:-translate-y-1 hover:shadow-elegant">
                      {b.cover_image_url && (
                        <div className="-mx-5 -mt-5 mb-4 h-32 overflow-hidden">
                          <img src={b.cover_image_url} alt="" className="h-full w-full object-cover" />
                        </div>
                      )}
                      <div className="text-xs uppercase text-muted-foreground line-clamp-1">{cats.join(" · ")}</div>
                      <h3 className="mt-1 font-display text-lg font-bold">{b.name}</h3>
                      {place && <p className="mt-0.5 text-xs text-muted-foreground">{place}</p>}
                      {b.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{b.description}</p>}
                      {Array.isArray(b.tags) && b.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {b.tags.slice(0, 5).map((t: string) => (
                            <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">{tagLabel(t)}</span>
                          ))}
                          {b.tags.length > 5 && <span className="text-[10px] text-muted-foreground">+{b.tags.length - 5}</span>}
                        </div>
                      )}
                    </Card>
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex flex-col items-center gap-3">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => goToPage(page - 1)}
                        className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    {renderPageNumbers()}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => goToPage(page + 1)}
                        className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
                <p className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
