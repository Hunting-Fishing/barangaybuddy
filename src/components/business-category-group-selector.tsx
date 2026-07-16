import { ChevronRight, Search, X } from "lucide-react";
import { BusinessCategoryIcon } from "@/components/business-category-icon";
import { Input } from "@/components/ui/input";
import type { BusinessCategoryGroup } from "@/lib/business-category-taxonomy";
import { cn } from "@/lib/utils";

type Props = {
  activeGroupId: string;
  groupQuery: string;
  groups: BusinessCategoryGroup[];
  onActiveGroupChange: (groupId: string) => void;
  onGroupQueryChange: (query: string) => void;
  selectedCountForGroup: (groupId: string) => number;
};

export function BusinessCategoryGroupSelector({
  activeGroupId,
  groupQuery,
  groups,
  onActiveGroupChange,
  onGroupQueryChange,
  selectedCountForGroup,
}: Props) {
  return (
    <div className="mt-6">
      <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-primary">
            Step 1
          </div>
          <h4 className="font-display text-lg font-bold">Pick a category group</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Search broad groups like food, billiards, transport, repairs, resort, or market.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={groupQuery}
            onChange={(event) => onGroupQueryChange(event.target.value)}
            placeholder="Search groups…"
            className="h-10 pl-9 pr-9"
          />
          {groupQuery && (
            <button
              type="button"
              onClick={() => onGroupQueryChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Clear group search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          No category groups match “{groupQuery.trim()}”.
        </div>
      ) : (
        <>
          <div className="lg:hidden">
            <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {groups.map((group) => {
                const selectedCount = selectedCountForGroup(group.id);
                const active = group.id === activeGroupId;

                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => onActiveGroupChange(group.id)}
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
                        <BusinessCategoryIcon icon={group.icon} className="h-5 w-5" />
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
            {groups.map((group) => {
              const selectedCount = selectedCountForGroup(group.id);
              const active = group.id === activeGroupId;

              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => onActiveGroupChange(group.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-soft",
                    active && "border-primary bg-primary/5 ring-1 ring-primary",
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <BusinessCategoryIcon icon={group.icon} className="h-5 w-5" />
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
        </>
      )}
    </div>
  );
}