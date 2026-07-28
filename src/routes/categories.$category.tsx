import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BarChart3, Compass, ListChecks } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BusinessCategoryIcon } from "@/components/business-category-icon";
import { CategorySuggestionForm } from "@/components/category-suggestion-form";
import { CategoryTypeSection } from "@/components/category-type-section";
import {
  BUSINESS_CATEGORY_GROUPS,
  type BusinessCategoryItem,
} from "@/lib/business-category-taxonomy";
import type { BusinessType } from "@/lib/business-types";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/categories/$category")({
  head: () => ({
    meta: [
      { title: "Browse category — BarangayHub" },
      {
        name: "description",
        content:
          "Browse business types by category, search matching businesses, and suggest missing local business types.",
      },
    ],
  }),
  component: CategoryPage,
});

type InteractionRow = {
  item_id: string;
  count: number;
};

type SuggestionRow = {
  suggestion: string;
  suggestion_count: number;
};

type RpcError = { message: string };
type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: RpcError | null }>;
};

const rpcClient = supabase as unknown as RpcClient;

async function recordCategoryEvent(data: {
  groupId: string;
  itemId: string;
  label: string;
  action: "category_view" | "type_search";
}) {
  const { error } = await rpcClient.rpc("increment_business_category_interaction", {
    p_group_id: data.groupId,
    p_item_id: data.itemId,
    p_label: data.label,
    p_action: data.action,
  });

  if (error) console.error(error.message);
}

function CategoryPage() {
  const { category } = Route.useParams();
  const group = useMemo(
    () => BUSINESS_CATEGORY_GROUPS.find((item) => item.id === category),
    [category],
  );
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);

  const groupedSections = useMemo(() => {
    if (!group) return [];

    const map = new Map<string, BusinessCategoryItem[]>();
    for (const item of group.items) {
      const section = item.section ?? "Popular types";
      map.set(section, [...(map.get(section) ?? []), item]);
    }

    return Array.from(map.entries()).map(([title, items]) => ({ title, items }));
  }, [group]);

  const loadStats = useCallback(async () => {
    if (!group) return;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

    if (!supabaseUrl || !publishableKey) return;

    const headers = {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
    };

    const interactionRes = await fetch(
      `${supabaseUrl}/rest/v1/business_category_interactions?select=item_id,count&group_id=eq.${encodeURIComponent(
        group.id,
      )}&action=eq.type_search`,
      { headers },
    );
    const interactionRows = interactionRes.ok
      ? ((await interactionRes.json()) as InteractionRow[])
      : [];

    setCounts(Object.fromEntries(interactionRows.map((row) => [row.item_id, Number(row.count)])));

    const suggestionRes = await fetch(
      `${supabaseUrl}/rest/v1/business_category_suggestions?select=suggestion,suggestion_count&group_id=eq.${encodeURIComponent(
        group.id,
      )}&order=suggestion_count.desc&limit=5`,
      { headers },
    );
    const suggestionRows = suggestionRes.ok
      ? ((await suggestionRes.json()) as SuggestionRow[])
      : [];

    setSuggestions(suggestionRows);
  }, [group]);

  useEffect(() => {
    if (!group) return;

    void recordCategoryEvent({
      groupId: group.id,
      itemId: group.id,
      label: group.label,
      action: "category_view",
    });
    void loadStats();
  }, [group, loadStats]);

  function handleSelect(item: BusinessCategoryItem) {
    setCounts((current) => ({
      ...current,
      [item.id]: (current[item.id] ?? 0) + 1,
    }));

    void recordCategoryEvent({
      groupId: group!.id,
      itemId: item.id,
      label: item.label,
      action: "type_search",
    });
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto px-4 py-16">
          <Button variant="ghost" size="sm" asChild className="gap-2">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" /> Back home
            </Link>
          </Button>
          <Card className="mt-6 p-8 text-center">
            <h1 className="font-display text-2xl font-bold">Category not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This category may have moved or does not exist yet.
            </p>
          </Card>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const businessTypes = [
    ...new Set(
      group.items
        .map((item) => item.businessType)
        .filter((type): type is BusinessType => Boolean(type)),
    ),
  ];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-12">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="gap-2">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" /> Back home
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link
              to="/search"
              search={{ q: "", types: [], customTypes: [], tags: [], category: undefined, page: 1 }}
            >
              Search businesses
            </Link>
          </Button>
        </div>

        <section className="overflow-hidden rounded-3xl bg-gradient-hero p-6 text-primary-foreground shadow-elegant md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sun text-sun-foreground shadow-sun">
                <BusinessCategoryIcon icon={group.icon} className="h-7 w-7" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-primary-foreground/70">
                  Browse category
                </div>
                <h1 className="mt-1 font-display text-4xl font-bold md:text-5xl">{group.label}</h1>
                <p className="mt-3 max-w-2xl text-primary-foreground/80">{group.description}</p>
              </div>
            </div>

            <Button className="bg-sun text-sun-foreground hover:bg-sun/90" asChild>
              <Link
                to="/search"
                search={{
                  q: "",
                  types: businessTypes,
                  customTypes: [],
                  tags: [],
                  category: group.id,
                  page: 1,
                }}
              >
                View all in this group
              </Link>
            </Button>
          </div>
        </section>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <Card className="flex items-start gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Compass className="h-4 w-4" />
            </div>
            <div>
              <div className="font-medium">Step 1: Pick a section</div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Sections make big categories easier to browse.
              </p>
            </div>
          </Card>
          <Card className="flex items-start gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ListChecks className="h-4 w-4" />
            </div>
            <div>
              <div className="font-medium">Step 2: Choose a type</div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Select exact types like Empanada vendor or Buffet restaurant.
              </p>
            </div>
          </Card>
          <Card className="flex items-start gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <div className="font-medium">Step 3: We track interest</div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Searches and missing-type suggestions help improve the directory.
              </p>
            </div>
          </Card>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_340px]">
          <section className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-bold">Choose a business type</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tap the exact type users would search for. These choices route to Search with
                  filters already selected.
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
                <BarChart3 className="h-3.5 w-3.5" />
                Search counts are tracked
              </div>
            </div>

            {groupedSections.map((section) => (
              <CategoryTypeSection
                key={section.title}
                title={section.title}
                items={section.items}
                counts={counts}
                categoryId={group.id}
                onSelect={handleSelect}
              />
            ))}
          </section>

          <aside className="space-y-4">
            <CategorySuggestionForm
              groupId={group.id}
              groupLabel={group.label}
              onSubmitted={loadStats}
            />

            {suggestions.length > 0 && (
              <Card className="p-5">
                <h2 className="font-display text-lg font-bold">Top missing-type suggestions</h2>
                <div className="mt-3 space-y-2">
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion.suggestion}
                      className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-sm"
                    >
                      <span>{suggestion.suggestion}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {suggestion.suggestion_count.toLocaleString()} votes
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
