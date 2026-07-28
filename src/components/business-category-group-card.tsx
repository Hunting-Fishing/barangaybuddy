import {
  Briefcase,
  Car,
  Hammer,
  HeartPulse,
  ShoppingBasket,
  Sprout,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  BusinessCategoryGroup,
  BusinessCategoryIcon,
  BusinessCategoryItem,
} from "@/lib/business-category-taxonomy";

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
  group: BusinessCategoryGroup;
  isItemSelected: (item: BusinessCategoryItem) => boolean;
  isItemDisabled: (item: BusinessCategoryItem) => boolean;
  onToggleItem: (item: BusinessCategoryItem, checked: boolean) => void;
};

export function BusinessCategoryGroupCard({
  group,
  isItemSelected,
  isItemDisabled,
  onToggleItem,
}: Props) {
  const Icon = ICONS[group.icon];

  return (
    <Card className="overflow-hidden">
      <div className="flex gap-3 border-b border-border bg-muted/40 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h4 className="font-display font-bold">{group.label}</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">{group.description}</p>
        </div>
      </div>

      <div className="grid gap-1.5 p-3 sm:grid-cols-2">
        {group.items.map((item) => {
          const checked = isItemSelected(item);
          const disabled = isItemDisabled(item);

          return (
            <label
              key={item.id}
              className={`flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted/70 ${
                disabled ? "cursor-not-allowed opacity-60" : ""
              }`}
            >
              <Checkbox
                checked={checked}
                disabled={disabled}
                onCheckedChange={(value) => onToggleItem(item, !!value)}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="block font-medium leading-tight">{item.label}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  {item.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </Card>
  );
}
