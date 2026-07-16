import { BusinessCategoryGroupSelector } from "@/components/business-category-group-selector";
import { BusinessCategoryOptionsPanel } from "@/components/business-category-options-panel";
import { BusinessCategorySearch } from "@/components/business-category-search";
import { BusinessCategorySelectedSummary } from "@/components/business-category-selected-summary";
import { useBusinessCategoryPicker } from "@/hooks/use-business-category-picker";
import { type BusinessType } from "@/lib/business-types";

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
  const picker = useBusinessCategoryPicker({
    primaryType,
    additionalTypes,
    customTypes,
    onAdditionalTypesChange,
    onCustomTypesChange,
  });

  return (
    <div className="md:col-span-2">
      <BusinessCategorySelectedSummary
        primaryType={primaryType}
        additionalTypes={additionalTypes}
        customTypes={customTypes}
        onAdditionalTypesChange={onAdditionalTypesChange}
        onCustomTypesChange={onCustomTypesChange}
      />

      <BusinessCategorySearch
        query={picker.query}
        suggestions={picker.suggestions}
        onQueryChange={picker.setQuery}
        onSuggestionSelect={picker.selectSuggestion}
        onAddCustom={picker.addTypedCustomCategory}
        isItemSelected={picker.isItemSelected}
      />

      <BusinessCategoryGroupSelector
        activeGroupId={picker.activeGroupId}
        onActiveGroupChange={picker.setActiveGroupId}
        selectedCountForGroup={picker.selectedCountForGroup}
      />

      <BusinessCategoryOptionsPanel
        activeGroup={picker.activeGroup}
        isItemSelected={picker.isItemSelected}
        isItemDisabled={picker.isItemDisabled}
        onToggleItem={picker.toggleItem}
      />
    </div>
  );
}