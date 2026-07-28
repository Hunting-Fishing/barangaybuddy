import { BusinessCategorySelectedSummary } from "@/components/business-category-selected-summary";
import { BUSINESS_TYPE_LABEL, type BusinessType } from "@/lib/business-types";

type Props = {
  primaryType: BusinessType;
  additionalTypes: BusinessType[];
  customTypes: string[];
  onAdditionalTypesChange: (types: BusinessType[]) => void;
  onCustomTypesChange: (types: string[]) => void;
};

export function BusinessCategoryPickerIntro({
  primaryType,
  additionalTypes,
  customTypes,
  onAdditionalTypesChange,
  onCustomTypesChange,
}: Props) {
  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-4 md:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-primary">
            Business category helper
          </div>
          <h3 className="mt-1 font-display text-xl font-bold">Choose what this business does</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Start with a major category, then pick the related business type. This keeps the form
            fast on mobile and keeps your directory organized.
          </p>
        </div>
        <div className="rounded-full bg-background px-3 py-1 text-xs text-muted-foreground ring-1 ring-border">
          Primary:{" "}
          <span className="font-medium text-foreground">{BUSINESS_TYPE_LABEL[primaryType]}</span>
        </div>
      </div>

      <BusinessCategorySelectedSummary
        additionalTypes={additionalTypes}
        customTypes={customTypes}
        onAdditionalTypesChange={onAdditionalTypesChange}
        onCustomTypesChange={onCustomTypesChange}
      />
    </div>
  );
}
