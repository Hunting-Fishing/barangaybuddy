import { useMemo, useState, type ComponentType } from "react";
import {
  Briefcase,
  Car,
  Check,
  ChevronRight,
  Hammer,
  HeartPulse,
  Plus,
  Search,
  ShoppingBasket,
  Sparkles,
  Sprout,
  Store,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { BUSINESS_TYPE_LABEL, type BusinessType } from "@/lib/business-types";
import {
  BUSINESS_CATEGORY_GROUPS,
  type BusinessCategoryIcon,
  type BusinessCategoryItem,
} from "@/lib/business-category-taxonomy";
import { dedupeCaseInsensitive, sanitizeCustomLabel } from "@/lib/business-tags";
import { cn } from "@/lib/utils";

const ICONS: Record<BusinessCategoryIcon, ComponentType<{ className?: string }>> = {
  food: UtensilsCrossed,
  retail: ShoppingBasket,
  vehicle: Car,
  construction: Hammer,
  health: HeartPulse,
  services: Briefcase,
  market: Store,
  agriculture: Sprout,
};

const QUICK_SEARCHES = [
  "food",
  "vehicle",
  "delivery",
  "construction",
  "convenience",
  "laundry",
];

type Props = {
  primaryType: BusinessType;
  additionalTypes: BusinessType[];
  customTypes: string[];
  onAdditionalTypesChange: (types: BusinessType[]) => void;
  onCustomTypesChange: (types: string[]) => void;
};

export function BusinessCategoryPicker({
  primaryType,
  additionalTypes,
  customTypes,
  onAdditionalTypesChange,
  onCustomTypesChange,
}: Props) {
  const [query, setQuery] = useState("");
  const [activeGroupId, setActiveGroupId] = useState(
    BUSINESS_CATEGORY_GROUPS[0]?.id ?? "",
  );

  const customTypeKeys = useMemo(
    () => new Set(customTypes.map((type) => type.toLowerCase())),
    [customTypes],
  );

  const activeGroup =
    BUSINESS_CATEGORY_GROUPS.find((group) => group.id === activeGroupId) ??
    BUSINESS_CATEGORY_GROUPS[0];

  const suggestions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];

    return BUSINESS_CATEGORY_GROUPS.flatMap((group) =>
      group.items.map((categoryItem) => {
        const fields = [
          categoryItem.label,
          categoryItem.description,
          categoryItem.businessType ?? "",
          categoryItem.customType ?? "",
          ...categoryItem.keywords,
        ].map((value) => value.toLowerCase());

        const label = categoryItem.label.toLowerCase();
        const startsWith = label.startsWith(needle);
        const includesLabel = label.includes(needle);
        const includesAny = fields.some((field) => field.includes(needle));

        if (!includesAny) return null;

        return {
          ...categoryItem,
          groupId: group.id,
          groupLabel: group.label,
          score: startsWith ? 0 : includesLabel ? 1 : 2,
        };
      }),
    )
      .filter(
        (
          result,
        ): result is BusinessCategoryItem & {
          groupId: string;
          groupLabel: string;
          score: number;
        } => result !== null,
      )
      .sort((a, b) => a.score - b.score || a.label.localeCompare(b.label))
      .slice(0, 8);
  }, [query]);

  const addItem = (item: BusinessCategoryItem) => {
    if (item.businessType && item.businessType !== primaryType) {
      onAdditionalTypesChange([...new Set([...additionalTypes, item.businessType])]);
    }

    if (item.customType && !customTypeKeys.has(item.customType.toLowerCase())) {
      onCustomTypesChange(dedupeCaseInsensitive([...customTypes, item.customType]));
    }
  };

  const removeItem = (item: BusinessCategoryItem) => {
    if (item.businessType && item.businessType !== primaryType) {
      onAdditionalTypesChange(
        additionalTypes.filter((type) => type !== item.businessType),
      );
    }

    if (item.customType) {
      onCustomTypesChange(
        customTypes.filter(
          (type) => type.toLowerCase() !== item.customType!.toLowerCase(),
        ),
      );
    }
  };

  const isItemSelected = (item: BusinessCategoryItem) => {
    if (item.customType) return customTypeKeys.has(item.customType.toLowerCase());
    if (item.businessType) {
      return item.businessType === primaryType || additionalTypes.includes(item.businessType);
    }
    return false;
  };

  const isItemDisabled = (item: BusinessCategoryItem) =>
    !item.customType && item.businessType === primaryType;

  const toggleItem = (item: BusinessCategoryItem, checked: boolean) => {
    if (checked) addItem(item);
    else removeItem(item);
  };

  const addTypedCustomCategory = () => {
    const clean = sanitizeCustomLabel(query);
    if (!clean) {
      toast.error("Use 2–40 letters/numbers for a custom category.");
      return;
    }

    if (customTypes.some((type) => type.toLowerCase() === clean.toLowerCase())) {
      toast.error("That category is already added.");
      return;
    }

    onCustomTypesChange(dedupeCaseInsensitive([...customTypes, clean]));
    setQuery("");
    toast.success("Custom category added.");
  };

  const selectedCountForGroup = (groupId: string) => {
    const group = BUSINESS_CATEGORY_GROUPS.find((item) => item.id === groupId);
    if (!group) return 0;
    return group.items.filter(isItemSelected).length;
  };

  const hasSelectedCategories = additionalTypes.length > 0 || customTypes.length > 0;
  const ActiveIcon = activeGroup ? ICONS[activeGroup.icon] : Sparkles;

  return (
    <div className="md:col-span-2">
      <div className="rounded-2xl border border-border bg-muted/20 p-4 md:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-primary">
              Business category helper
            </div>
            <h3 className="mt-1 font-display text-xl font-bold">
              Choose what this business does
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Start with a major category, then pick the related business type. This keeps the form fast on mobile and keeps your directory organized.
            </p>
          </div>
          <div className="rounded-full bg-background px-3 py-1 text-xs text-muted-foreground ring-1 ring-border">
            Primary:{" "}
            <span className="font-medium text-foreground">
              {BUSINESS_TYPE_LABEL[primaryType]}
            </span>
          </div>
        </div>

        <div
          className={cn(
            "mt-4 rounded-xl border p-3",
            hasSelectedCategories
              ? "border-primary/30 bg-primary/5"
              : "border-dashed border-border bg-background/60",
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-sm font-medium">Selected extra categories</div>
            <div className="text-xs text-muted-foreground">
              {additionalTypes.length + customTypes.length} selected
            </div>
          </div>

          {hasSelectedCategories ? (
            <div className="flex flex-wrap gap-1.5">
              {additionalTypes.map((type) => (
                <Badge key={type} variant="secondary" className="gap-1">
                  {BUSINESS_TYPE_LABEL[type]}
                  <button
                    type="button"
                    onClick={() =>
                      onAdditionalTypesChange(
                        additionalTypes.filter((item) => item !== type),
                      )
                    }
                    className="hover:text-destructive"
                    aria-label={`Remove ${BUSINESS_TYPE_LABEL[type]}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {customTypes.map((type) => (
                <Badge key={type} className="gap-1">
                  {type}
                  <span className="text-[10px] uppercase opacity-70">specific</span>
                  <button
                    type="button"
                    onClick={() =>
                      onCustomTypesChange(
                        customTypes.filter(
                          (item) => item.toLowerCase() !== type.toLowerCase(),
                        ),
                      )
                    }
                    className="hover:text-destructive/80"
                    aria-label={`Remove ${type}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Optional — add extra categories only if the business does more than its primary type.
            </p>
          )}
        </div>
      </div>

      <div className="mt-5">
        <label className="mb-1.5 block text-sm font-medium">
          Search categories quickly
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try delivery, car wash, sari-sari, plumber…"
            className="h-11 pl-9"
          />
        </div>

        {query.trim().length < 2 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_SEARCHES.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => setQuery(term)}
                className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
              >
                {term}
              </button>
            ))}
          </div>
        )}

        {query.trim().length >= 2 && (
          <div className="mt-2 overflow-hidden rounded-xl border border-border bg-card shadow-soft">
            {suggestions.length > 0 ? (
              suggestions.map((suggestion) => {
                const selected = isItemSelected(suggestion);
                return (
                  <button
                    key={`${suggestion.groupLabel}-${suggestion.id}`}
                    type="button"
                    onClick={() => {
                      setActiveGroupId(suggestion.groupId);
                      if (!selected) addItem(suggestion);
                    }}
                    className="flex min-h-16 w-full items-start justify-between gap-3 border-b border-border px-3 py-3 text-left last:border-b-0 hover:bg-muted/60"
                  >
                    <span>
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        {suggestion.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {suggestion.groupLabel} · {suggestion.description}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {selected ? "Added" : "Add"}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                <p className="text-sm text-muted-foreground">
                  No preset match. Add “{query.trim()}” as a specific category.
                </p>
                <Button type="button" size="sm" variant="outline" onClick={addTypedCustomCategory}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add custom
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-primary">
              Step 1
            </div>
            <h4 className="font-display text-lg font-bold">Pick a category group</h4>
          </div>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Swipe on mobile
          </p>
        </div>

        <div className="lg:hidden">
          <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {BUSINESS_CATEGORY_GROUPS.map((group) => {
              const Icon = ICONS[group.icon];
              const selectedCount = selectedCountForGroup(group.id);
              const active = group.id === activeGroup?.id;

              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setActiveGroupId(group.id)}
                  aria-pressed={active}
                  className={cn(
                    "min-w-[13rem] snap-start rounded-2xl border bg-card p-3 text-left transition-all",
                    active
                      ? "border-primary bg-primary/5 shadow-soft ring-1 ring-primary"
                      : "border-border",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    {selectedCount > 0 && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                        {selectedCount}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 font-medium leading-tight">{group.label}</div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {group.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="hidden lg:grid lg:grid-cols-4 lg:gap-3">
          {BUSINESS_CATEGORY_GROUPS.map((group) => {
            const Icon = ICONS[group.icon];
            const selectedCount = selectedCountForGroup(group.id);
            const active = group.id === activeGroup?.id;

            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setActiveGroupId(group.id)}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-soft",
                  active && "border-primary bg-primary/5 ring-1 ring-primary",
                )}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{group.label}</span>
                    {selectedCount > 0 && (
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                        {selectedCount}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {group.description}
                  </p>
                </div>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    active && "translate-x-0.5 text-primary",
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      {activeGroup && (
        <Card className="mt-4 overflow-hidden">
          <div className="border-b border-border bg-muted/40 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ActiveIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold uppercase tracking-wide text-primary">
                  Step 2
                </div>
                <h4 className="font-display text-lg font-bold">{activeGroup.label}</h4>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {activeGroup.description}
                </p>
              </div>
              <span className="hidden rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground sm:inline-flex">
                {activeGroup.items.length} options
              </span>
            </div>
          </div>

          <div className="grid gap-2 p-3 sm:grid-cols-2">
            {activeGroup.items.map((item) => {
              const checked = isItemSelected(item);
              const disabled = isItemDisabled(item);

              return (
                <label
                  key={item.id}
                  className={cn(
                    "flex min-h-[4.75rem] cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm transition-colors",
                    checked
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-card hover:bg-muted/50",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(value) => toggleItem(item, value === true)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-medium leading-tight">
                      {checked && <Check className="h-3.5 w-3.5 text-primary" />}
                      {item.label}
                    </span>
                    <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                      {item.description}
                    </span>
                    {disabled && (
                      <span className="mt-1 inline-block text-[10px] font-medium uppercase tracking-wide text-primary">
                        Already selected as primary
                      </span>
                    )}
                    {item.customType && !disabled && (
                      <span className="mt-1 inline-block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Specific category
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}