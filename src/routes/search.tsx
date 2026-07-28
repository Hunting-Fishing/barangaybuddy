import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, X, SlidersHorizontal, Loader2, ArrowLeft, Plus, Sparkles } from "lucide-react";
import { BUSINESS_TYPES, BUSINESS_TYPE_LABEL, type BusinessType } from "@/lib/business-types";
import { FEATURE_TAG_GROUPS, tagLabel } from "@/lib/business-tags";
import { SearchCategoryGuidance } from "@/components/search-category-guidance";
import {
  getBusinessCategoryGroup,
  getBusinessCategoryGroupForFilters,
  type BusinessCategoryItem,
} from "@/lib/business-category-taxonomy";

const RESULTS_PER_PAGE = 12;

function parseStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value !== "string" || value.length === 0) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    // Fall back to comma-separated or single value parsing below.
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Search businesses — BarangayHub" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s.q === "string" ? s.q : "",
    types: parseStringArray(s.types).filter((x) => BUSINESS_TYPES.includes(x as BusinessType)),
    customTypes: parseStringArray(s.customTypes).filter((x) => x.length > 0),
    tags: parseStringArray(s.tags),
    category: typeof s.category === "string" ? s.category : undefined,
    page: Number(s.page) > 0 ? Number(s.page) : 1,
  }),
  component: SearchPage,
});

type RpcError = { message: string };
type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: RpcError | null }>;
};

const rpcClient = supabase as unknown as RpcClient;

async function recordCategoryEvent(data: { groupId: string; itemId: string; label: string }) {
  const { error } = await rpcClient.rpc("increment_business_category_interaction", {
    p_group_id: data.groupId,
    p_item_id: data.itemId,
    p_label: data.label,
    p_action: "type_search",
  });

  if (error) console.error(error.message);
}

function SearchPage() {
  const searchParams = Route.useSearch();
  const {
    q: urlQ,
    types: urlTypes,
    customTypes: urlCustomTypes,
    tags: urlTags,
    category,
    page: urlPage,
  } = searchParams;
  const navigate = useNavigate({ from: "/search" });

  const [q, setQ] = useState(urlQ);
  const [types, setTypes] = useState<BusinessType[]>(urlTypes as BusinessType[]);
  const [customTypes, setCustomTypes] = useState<string[]>(urlCustomTypes);
  const [tags, setTags] = useState<string[]>(urlTags);
  const [tagQ, setTagQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Sync URL changes (back/forward) into local state
  useEffect(() => {
    setQ(urlQ);
  }, [urlQ]);
  useEffect(() => {
    setTypes(urlTypes as BusinessType[]);
  }, [urlTypes]);
  useEffect(() => {
    setCustomTypes(urlCustomTypes);
  }, [urlCustomTypes]);
  useEffect(() => {
    setTags(urlTags);
  }, [urlTags]);

  // Sync URL <- filter state (debounced); reset page to 1 on filter change
  useEffect(() => {
    const t = setTimeout(() => {
      navigate({
        search: {
          ...searchParams,
          q,
          types,
          customTypes,
          tags,
          page: 1,
        },
        replace: true,
      });
    }, 200);
    return () => clearTimeout(t);
  }, [q, types, customTypes, tags]);

  const hasFilter =
    q.trim().length > 0 || types.length > 0 || customTypes.length > 0 || tags.length > 0;

  const selectedCategoryGroup = useMemo(
    () =>
      getBusinessCategoryGroup(category) ??
      getBusinessCategoryGroupForFilters({
        types,
        customTypes,
      }),
    [category, types, customTypes],
  );

  const relatedCategoryItems = useMemo(() => {
    if (!selectedCategoryGroup) return [];

    const selectedCustomKeys = new Set(customTypes.map((customType) => customType.toLowerCase()));

    if (types.length > 0) {
      return selectedCategoryGroup.items
        .filter((item) => {
          if (!item.businessType || !types.includes(item.businessType)) return false;
          if (item.customType && selectedCustomKeys.has(item.customType.toLowerCase()))
            return false;

          // When the user searched a broad type like "Food vendor", show the
          // specific subtypes under that broad type: Empanada, Sisig, Turon, etc.
          return Boolean(item.customType);
        })
        .slice(0, 12);
    }

    if (customTypes.length > 0) {
      const selectedItems = selectedCategoryGroup.items.filter(
        (item) => item.customType && selectedCustomKeys.has(item.customType.toLowerCase()),
      );
      const siblingTypes = new Set(selectedItems.map((item) => item.businessType).filter(Boolean));

      return selectedCategoryGroup.items
        .filter((item) => {
          if (!item.businessType || !siblingTypes.has(item.businessType)) return false;
          if (item.customType && selectedCustomKeys.has(item.customType.toLowerCase()))
            return false;
          return true;
        })
        .slice(0, 12);
    }

    return selectedCategoryGroup.items.slice(0, 12);
  }, [selectedCategoryGroup, types, customTypes]);

  // Build a stable filter signature so the fetch effect knows when filters truly changed
  const filterKey = useMemo(
    () =>
      JSON.stringify({
        q: q.trim(),
        types: [...types].sort(),
        customTypes: [...customTypes].sort(),
        tags: [...tags].sort(),
      }),
    [q, types, customTypes, tags],
  );

  const buildQuery = useCallback(
    (from: number, to: number) => {
      let query = supabase
        .from("businesses")
        .select(
          "id, name, slug, type, additional_types, custom_types, tags, description, cover_image_url, barangays(name, cities_municipalities(name))",
          { count: "exact" },
        )
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (q.trim()) {
        const safe = q.trim().replace(/[%,()]/g, " ");
        query = query.or(`name.ilike.%${safe}%,description.ilike.%${safe}%`);
      }
      if (types.length > 0) {
        const inList = types.join(",");
        const ovList = `{${types.join(",")}}`;
        query = query.or(`type.in.(${inList}),additional_types.ov.${ovList}`);
      }
      if (customTypes.length > 0) {
        query = query.overlaps("custom_types", customTypes);
      }
      if (tags.length > 0) {
        query = query.overlaps("tags", tags);
      }
      return query;
    },
    [q, types, customTypes, tags],
  );

  // Initial / filter-change fetch: load pages 1..urlPage (supports refresh restoring scroll position of loaded items)
  useEffect(() => {
    if (!hasFilter) {
      setResults([]);
      setTotalCount(0);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      const to = urlPage * RESULTS_PER_PAGE - 1;
      const { data, count, error } = await buildQuery(0, to);
      if (error) console.error(error);
      setResults(data ?? []);
      setTotalCount(count ?? 0);
      setLoading(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [filterKey]);

  const canLoadMore = !loading && !loadingMore && results.length < totalCount;

  const loadMore = useCallback(async () => {
    if (!canLoadMore) return;
    setLoadingMore(true);
    const nextPage = Math.floor(results.length / RESULTS_PER_PAGE) + 1;
    const from = (nextPage - 1) * RESULTS_PER_PAGE;
    const to = from + RESULTS_PER_PAGE - 1;
    const { data, count, error } = await buildQuery(from, to);
    if (error) console.error(error);
    setResults((prev) => [...prev, ...(data ?? [])]);
    if (typeof count === "number") setTotalCount(count);
    setLoadingMore(false);
    navigate({
      search: {
        ...searchParams,
        q,
        types,
        customTypes,
        tags,
        page: nextPage,
      },
      replace: true,
    });
  }, [
    canLoadMore,
    results.length,
    buildQuery,
    navigate,
    searchParams,
    q,
    types,
    customTypes,
    tags,
  ]);

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  const filteredTagGroups = useMemo(() => {
    const needle = tagQ.trim().toLowerCase();
    if (!needle) return FEATURE_TAG_GROUPS;
    return FEATURE_TAG_GROUPS.map((g) => ({
      ...g,
      tags: g.tags.filter((t) => t.label.toLowerCase().includes(needle)),
    })).filter((g) => g.tags.length > 0);
  }, [tagQ]);

  const activeCount = types.length + customTypes.length + tags.length;
  const hasAnyFilter = hasFilter;

  function clearAll() {
    setQ("");
    setTypes([]);
    setCustomTypes([]);
    setTags([]);
    navigate({
      search: {
        q: "",
        types: [],
        customTypes: [],
        tags: [],
        category: undefined,
        page: 1,
      },
      replace: true,
    });
  }

  function handleRelatedSelect(item: BusinessCategoryItem) {
    if (!selectedCategoryGroup) return;

    void recordCategoryEvent({
      groupId: selectedCategoryGroup.id,
      itemId: item.id,
      label: item.label,
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-12">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {selectedCategoryGroup ? (
            <Button variant="ghost" size="sm" asChild className="gap-2">
              <Link to="/categories/$category" params={{ category: selectedCategoryGroup.id }}>
                <ArrowLeft className="h-4 w-4" /> Back to {selectedCategoryGroup.label}
              </Link>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" asChild className="gap-2">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" /> Back home
              </Link>
            </Button>
          )}
        </div>

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

        {(types.length > 0 || customTypes.length > 0 || tags.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {types.map((t) => (
              <Badge key={`t-${t}`} variant="secondary" className="gap-1">
                {BUSINESS_TYPE_LABEL[t]}
                <button
                  onClick={() => setTypes(types.filter((x) => x !== t))}
                  aria-label={`Remove ${BUSINESS_TYPE_LABEL[t]}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {customTypes.map((type) => (
              <Badge key={`custom-${type}`} className="gap-1">
                {type}
                <span className="text-[10px] uppercase opacity-70">specific</span>
                <button
                  onClick={() => setCustomTypes(customTypes.filter((x) => x !== type))}
                  aria-label={`Remove ${type}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {tags.map((s) => (
              <Badge key={`tag-${s}`} className="gap-1">
                {tagLabel(s)}
                <button
                  onClick={() => setTags(tags.filter((x) => x !== s))}
                  aria-label={`Remove ${tagLabel(s)}`}
                >
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
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  Categories
                </h3>
                <div className="mt-3 grid max-h-72 grid-cols-1 gap-1.5 overflow-auto sm:grid-cols-2 lg:grid-cols-1">
                  {BUSINESS_TYPES.map((t) => {
                    const checked = types.includes(t);
                    return (
                      <label key={t} className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) =>
                            setTypes(c ? [...types, t] : types.filter((x) => x !== t))
                          }
                        />
                        {BUSINESS_TYPE_LABEL[t]}
                      </label>
                    );
                  })}
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  Features
                </h3>
                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={tagQ}
                    onChange={(e) => setTagQ(e.target.value)}
                    placeholder="Search features…"
                    className="pl-9"
                  />
                </div>
                <div className="mt-3 max-h-96 space-y-3 overflow-auto">
                  {filteredTagGroups.length === 0 && (
                    <p className="text-sm text-muted-foreground">No matches.</p>
                  )}
                  {filteredTagGroups.map((g) => (
                    <div key={g.id}>
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {g.label}
                      </div>
                      <div className="mt-1.5 grid grid-cols-1 gap-1">
                        {g.tags.map((tag) => {
                          const checked = tags.includes(tag.slug);
                          return (
                            <label
                              key={tag.slug}
                              className="flex cursor-pointer items-center gap-2 text-sm"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(c) =>
                                  setTags(
                                    c ? [...tags, tag.slug] : tags.filter((x) => x !== tag.slug),
                                  )
                                }
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
              <>
                <Card className="p-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h2 className="mt-4 font-display text-xl font-bold">
                    No businesses listed for this exact search yet
                  </h2>
                  <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                    This does not mean the category is missing. It means no one has listed a
                    matching business yet. You can try a more specific type or add/import a business
                    for this category.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {selectedCategoryGroup && (
                      <Button variant="outline" asChild>
                        <Link
                          to="/categories/$category"
                          params={{ category: selectedCategoryGroup.id }}
                        >
                          Browse all {selectedCategoryGroup.label} types
                        </Link>
                      </Button>
                    )}
                    <Button asChild className="gap-2">
                      <Link to="/import">
                        <Plus className="h-4 w-4" /> Add/import a business
                      </Link>
                    </Button>
                  </div>
                </Card>

                {selectedCategoryGroup && (
                  <SearchCategoryGuidance
                    group={selectedCategoryGroup}
                    items={relatedCategoryItems}
                    onSelect={handleRelatedSelect}
                  />
                )}
              </>
            )}

            {!loading && totalCount > 0 && (
              <p className="mb-3 text-sm text-muted-foreground">
                Showing {results.length} of {totalCount} results
              </p>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {results.map((b: any) => {
                const cats: string[] = [
                  BUSINESS_TYPE_LABEL[b.type as BusinessType] ?? b.type,
                  ...(b.additional_types ?? []).map(
                    (t: BusinessType) => BUSINESS_TYPE_LABEL[t] ?? t,
                  ),
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
                          <img
                            src={b.cover_image_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                      <div className="text-xs uppercase text-muted-foreground line-clamp-1">
                        {cats.join(" · ")}
                      </div>
                      <h3 className="mt-1 font-display text-lg font-bold">{b.name}</h3>
                      {place && <p className="mt-0.5 text-xs text-muted-foreground">{place}</p>}
                      {b.description && (
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                          {b.description}
                        </p>
                      )}
                      {Array.isArray(b.tags) && b.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {b.tags.slice(0, 5).map((t: string) => (
                            <span
                              key={t}
                              className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground"
                            >
                              {tagLabel(t)}
                            </span>
                          ))}
                          {b.tags.length > 5 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{b.tags.length - 5}
                            </span>
                          )}
                        </div>
                      )}
                    </Card>
                  </Link>
                );
              })}
            </div>

            {/* Infinite scroll sentinel + status */}
            {hasAnyFilter && results.length > 0 && (
              <div ref={sentinelRef} className="mt-8 flex justify-center py-6">
                {loadingMore ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading more…
                  </div>
                ) : results.length >= totalCount ? (
                  <p className="text-xs text-muted-foreground">You’ve reached the end.</p>
                ) : (
                  <Button variant="outline" size="sm" onClick={loadMore}>
                    Load more
                  </Button>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
