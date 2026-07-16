import { Plus, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BusinessCategoryItem } from "@/lib/business-category-taxonomy";
import type { BusinessCategoryPickerSuggestion } from "@/hooks/use-business-category-picker";
import { cn } from "@/lib/utils";

const QUICK_SEARCHES = [
  "food",
  "vehicle",
  "delivery",
  "construction",
  "convenience",
  "laundry",
];

type Props = {
  query: string;
  suggestions: BusinessCategoryPickerSuggestion[];
  isItemSelected: (item: BusinessCategoryItem) => boolean;
  onQueryChange: (query: string) => void;
  onSelectSuggestion: (suggestion: BusinessCategoryPickerSuggestion) => void;
  onAddTypedCustomCategory: () => void;
};

export function BusinessCategorySearch({
  query,
  suggestions,
  isItemSelected,
  onQueryChange,
  onSelectSuggestion,
  onAddTypedCustomCategory,
}: Props) {
  return (
    <div className="mt-5">
      <label className="mb-1.5 block text-sm font-medium">
        Search categories quickly
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
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
              onClick={() => onQueryChange(term)}
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
                  onClick={() => onSelectSuggestion(suggestion)}
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
              <Button type="button" size="sm" variant="outline" onClick={onAddTypedCustomCategory}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add custom
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}