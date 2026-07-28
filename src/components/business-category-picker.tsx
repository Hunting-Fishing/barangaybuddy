import { BusinessCategoryGroupSelector } from "@/components/business-category-group-selector";
import { BusinessCategoryOptionsCard } from "@/components/business-category-options-card";
import { BusinessCategoryPickerIntro } from "@/components/business-category-picker-intro";
import { BusinessCategorySearch } from "@/components/business-category-search";
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
      <BusinessCategoryPickerIntro
        primaryType={primaryType}
        additionalTypes={additionalTypes}
        customTypes={customTypes}
        onAdditionalTypesChange={onAdditionalTypesChange}
        onCustomTypesChange={onCustomTypesChange}
      />

      <BusinessCategorySearch
        query={picker.query}
        suggestions={picker.suggestions}
        isItemSelected={picker.isItemSelected}
        onQueryChange={picker.setQuery}
        onSelectSuggestion={picker.selectSuggestion}
        onAddTypedCustomCategory={picker.addTypedCustomCategory}
      />

      <BusinessCategoryGroupSelector
        activeGroupId={picker.activeGroupId}
        groupQuery={picker.groupQuery}
        groups={picker.filteredGroups}
        onActiveGroupChange={picker.setActiveGroupId}
        onGroupQueryChange={picker.setGroupQuery}
        selectedCountForGroup={picker.selectedCountForGroup}
      />

      <BusinessCategoryOptionsCard
        activeGroup={picker.activeGroup}
        isItemSelected={picker.isItemSelected}
        isItemDisabled={picker.isItemDisabled}
        onToggleItem={picker.toggleItem}
      />
    </div>
  );
}
