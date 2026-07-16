import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BUSINESS_TYPE_LABEL, type BusinessType } from "@/lib/business-types";
import { cn } from "@/lib/utils";

type Props = {
  additionalTypes: BusinessType[];
  customTypes: string[];
  onAdditionalTypesChange: (types: BusinessType[]) => void;
  onCustomTypesChange: (types: string[]) => void;
};

export function BusinessCategorySelectedSummary({
  additionalTypes,
  customTypes,
  onAdditionalTypesChange,
  onCustomTypesChange,
}: Props) {
  const hasSelectedCategories = additionalTypes.length > 0 || customTypes.length > 0;

  return (
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
  );
}