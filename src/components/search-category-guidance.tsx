import { Link } from "@tanstack/react-router";
import { ArrowRight, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { BUSINESS_TYPE_LABEL } from "@/lib/business-types";
import type {
  BusinessCategoryGroup,
  BusinessCategoryItem,
} from "@/lib/business-category-taxonomy";

type Props = {
  group: BusinessCategoryGroup;
  items: BusinessCategoryItem[];
  onSelect: (item: BusinessCategoryItem) => void;
};

export function SearchCategoryGuidance({ group, items, onSelect }: Props) {
  if (items.length === 0) return null;

  return (
    <Card className="mt-6 overflow-hidden border-primary/20">
      <div className="border-b border-border bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold">
              Try a more specific {group.label.toLowerCase()} type
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              If the broad category has no businesses yet, users can still choose exact types like Empanada vendor, Sisig vendor, or Buffet restaurant.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.id}
            to="/search"
            search={{
              q: "",
              types: item.businessType ? [item.businessType] : [],
              customTypes: item.customType ? [item.customType] : [],
              tags: [],
              category: group.id,
              page: 1,
            }}
            onClick={() => onSelect(item)}
            className="group rounded-xl border border-border bg-background p-4 transition-all hover:-translate-y-0.5 hover:shadow-soft"
          >
            <div className="flex flex-wrap gap-1.5">
              {item.businessType && (
                <Badge variant="secondary" className="text-[10px]">
                  {BUSINESS_TYPE_LABEL[item.businessType]}
                </Badge>
              )}
              {item.customType && <Badge className="text-[10px]">{item.customType}</Badge>}
            </div>
            <h3 className="mt-3 font-display font-bold">{item.label}</h3>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {item.description}
            </p>
            <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Search this type
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}