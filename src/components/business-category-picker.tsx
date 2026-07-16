import { useMemo, useState } from "react";
import {
  Briefcase,
  Car,
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

const ICONS: Record<BusinessCategoryIcon, React.ComponentType<{ className?: string }>> = {
  food: UtensilsCrossed,
  retail: ShoppingBasket,
  vehicle: Car,
  construction: Hammer,
  health: HeartPulse,
  services: Briefcase,
  market: Store,
  agriculture: Sprout,
};

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
  const [activeGroupId, setActiveGroupId] = useState(BUSINESS_CATEGORY_GROUPS[0]?.id ?? "");

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
      onAdditionalTypesChange(additionalTypes.filter((type) => type !== item.businessType));
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
  };

  const selectedCountForGroup = (groupId: string) => {
    const group = BUSINESS_CATEGORY_GROUPS.find((item) => item.id === groupId);
    if (!group) return 0;
    return group.items.filter(isItemSelected).length;
  };

  const hasSelectedCategories = additionalTypes.length > 0 || customTypes.length > 0;

  return (
    <div className="md:col-span-2">
      <div>
        <h3 className="font-display text-lg font-bold">Additional categories</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a main category group first, then select only the related business types. You can also search for a type directly.
        </p>
      </div>

      {hasSelectedCategories && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {additionalTypes.map((type) => (
            <Badge key={type} variant="secondary" className="gap-1">
              {BUSINESS_TYPE_LABEL[type]}
              <button
                type="button"
                onClick={() =>
                  onAdditionalTypesChange(additionalTypes.filter((item) => item !== type))
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
                    customTypes.filter((item) => item.toLowerCase() !== type.toLowerCase()),
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
      )}

      <div className="mt-4">
        <label className="mb-1.5 block text-sm font-medium">
          Smart category search
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try vehicle, food, construction, delivery, convenience store…"
            className="pl-9"
          />
        </div>

        {query.trim().length >= 2 && (
          <div className="mt-2 overflow-hidden rounded-lg border border-border bg-card">
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
                    className="flex w-full items-start justify-between gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-muted/60"
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
                    <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
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

      <div className="mt-5 grid gap-4 lg:grid-cols-[280px_1fr]">
        <div>
          <div className="mb-2 text-sm font-medium">Category groups</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {BUSINESS_CATEGORY_GROUPS.map((group) => {
              const Icon = ICONS[group.icon];
              const selectedCount = selectedCountForGroup(group.id);
              const active = group.id === activeGroup?.id;

              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setActiveGroupId(group.id)}
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
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
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
          <Card className="overflow-hidden">
            <div className="border-b border-border bg-muted/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-display text-lg font-bold">{activeGroup.label}</h4>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {activeGroup.description}
                  </p>
                </div>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
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
                      "flex cursor-pointer items-start gap-2 rounded-lg border border-transparent px-3 py-2.5 text-sm transition-colors hover:border-border hover:bg-muted/60",
                      checked && "border-primary/30 bg-primary/5",
                      disabled && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={(value) => toggleItem(item, !!value)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium leading-tight">{item.label}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                        {item.description}
                      </span>
                      {disabled && (
                        <span className="mt-1 inline-block text-[10px] font-medium uppercase tracking-wide text-primary">
                          Primary type
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
    </div>
  );
}