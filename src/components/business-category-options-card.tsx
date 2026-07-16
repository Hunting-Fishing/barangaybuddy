import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { BusinessCategoryIcon } from "@/components/business-category-icon";
import type {
  BusinessCategoryGroup,
  BusinessCategoryItem,
} from "@/lib/business-category-taxonomy";
import { cn } from "@/lib/utils";

type Props = {
  activeGroup?: BusinessCategoryGroup;
  isItemSelected: (item: BusinessCategoryItem) => boolean;
  isItemDisabled: (item: BusinessCategoryItem) => boolean;
  onToggleItem: (item: BusinessCategoryItem, checked: boolean) => void;
};

export function BusinessCategoryOptionsCard({
  activeGroup,
  isItemSelected,
  isItemDisabled,
  onToggleItem,
}: Props) {
  if (!activeGroup) return null;

  return (
    <Card className="mt-4 overflow-hidden">
      <div className="border-b border-border bg-muted/40 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BusinessCategoryIcon icon={activeGroup.icon} className="h-5 w-5" />
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
                onCheckedChange={(value) => onToggleItem(item, value === true)}
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
  );
}