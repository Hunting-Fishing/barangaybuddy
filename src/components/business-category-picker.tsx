import { useMemo, useState } from "react";
import { Plus, Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BusinessCategoryGroupCard } from "@/components/business-category-group-card";
import { BUSINESS_TYPE_LABEL, type BusinessType } from "@/lib/business-types";
import {
  BUSINESS_CATEGORY_GROUPS,
  getBusinessCategorySuggestions,
  type BusinessCategoryItem,
} from "@/lib/business-category-taxonomy";
import { dedupeCaseInsensitive, sanitizeCustomLabel } from "@/lib/business-tags";

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
  const customTypeKeys = useMemo(
    () => new Set(customTypes.map((type) => type.toLowerCase())),
    [customTypes],
  );
  const suggestions = useMemo(() => getBusinessCategorySuggestions(query), [query]);

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

  const hasSelectedCategories = additionalTypes.length > 0 || customTypes.length > 0;

  return (
    <div className="md:col-span-2">
      <div>
        <h3 className="font-display text-lg font-bold">Additional categories</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Search or browse by major Philippine business groups. Broad types are saved separately from specific custom categories.
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

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {BUSINESS_CATEGORY_GROUPS.map((group) => (
          <BusinessCategoryGroupCard
            key={group.id}
            group={group}
            isItemSelected={isItemSelected}
            isItemDisabled={isItemDisabled}
            onToggleItem={toggleItem}
          />
        ))}
      </div>
    </div>
  );
}