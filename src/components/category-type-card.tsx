import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { BUSINESS_TYPE_LABEL } from "@/lib/business-types";
import type { BusinessCategoryItem } from "@/lib/business-category-taxonomy";

type Props = {
  item: BusinessCategoryItem;
  searchCount: number;
  onSelect: (item: BusinessCategoryItem) => void;
};

export function CategoryTypeCard({ item, searchCount, onSelect }: Props) {
  return (
    <Link
      to="/search"
      search={{
        types: item.businessType ? [item.businessType] : [],
        customTypes: item.customType ? [item.customType] : [],
        tags: [],
        page: 1,
      }}
      onClick={() => onSelect(item)}
      className="block h-full"
    >
      <Card className="group flex h-full flex-col justify-between p-5 transition-all hover:-translate-y-1 hover:shadow-elegant">
        <div>
          <div className="flex flex-wrap gap-1.5">
            {item.businessType && (
              <Badge variant="secondary">
                {BUSINESS_TYPE_LABEL[item.businessType]}
              </Badge>
            )}
            {item.customType && <Badge>{item.customType}</Badge>}
          </div>
          <h3 className="mt-4 font-display text-lg font-bold">{item.label}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {searchCount > 0
              ? `${searchCount.toLocaleString()} searches`
              : "Start this search"}
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-primary">
            Search <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Card>
    </Link>
  );
}