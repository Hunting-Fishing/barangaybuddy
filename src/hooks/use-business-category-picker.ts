import { useMemo, useState } from "react";
import { toast } from "sonner";
import { type BusinessType } from "@/lib/business-types";
import {
  BUSINESS_CATEGORY_GROUPS,
  type BusinessCategoryItem,
} from "@/lib/business-category-taxonomy";
import { dedupeCaseInsensitive, sanitizeCustomLabel } from "@/lib/business-tags";

export type BusinessCategoryPickerSuggestion = BusinessCategoryItem & {
  groupId: string;
  groupLabel: string;
  score: number;
};

type Args = {
  primaryType: BusinessType;
  additionalTypes: BusinessType[];
  customTypes: string[];
  onAdditionalTypesChange: (types: BusinessType[]) => void;
  onCustomTypesChange: (types: string[]) => void;
};

export function useBusinessCategoryPicker({
  primaryType,
  additionalTypes,
  customTypes,
  onAdditionalTypesChange,
  onCustomTypesChange,
}: Args) {
  const [query, setQuery] = useState("");
  const [activeGroupId, setActiveGroupId] = useState(
    BUSINESS_CATEGORY_GROUPS[0]?.id ?? "",
  );

  const customTypeKeys = useMemo(
    () => new Set(customTypes.map((type) => type.toLowerCase())),
    [customTypes],
  );

  const activeGroup =
    BUSINESS_CATEGORY_GROUPS.find((group) => group.id === activeGroupId) ??
    BUSINESS_CATEGORY_GROUPS[0];

  const suggestions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];

    return BUSINESS_CATEGORY_GROUPS.flatMap((group) =>
      group.items.map((categoryItem) => {
        const fields = [
          categoryItem.label,
          categoryItem.description,
          categoryItem.businessType ?? "",
          categoryItem.customType ?? "",
          ...categoryItem.keywords,
        ].map((value) => value.toLowerCase());

        const label = categoryItem.label.toLowerCase();
        const startsWith = label.startsWith(needle);
        const includesLabel = label.includes(needle);
        const includesAny = fields.some((field) => field.includes(needle));

        if (!includesAny) return null;

        return {
          ...categoryItem,
          groupId: group.id,
          groupLabel: group.label,
          score: startsWith ? 0 : includesLabel ? 1 : 2,
        };
      }),
    )
      .filter(
        (
          result,
        ): result is BusinessCategoryPickerSuggestion => result !== null,
      )
      .sort((a, b) => a.score - b.score || a.label.localeCompare(b.label))
      .slice(0, 8);
  }, [query]);

  const addItem = (item: BusinessCategoryItem) => {
    if (item.businessType && item.businessType !== primaryType) {
      onAdditionalTypesChange([...new Set([...additionalTypes, item.businessType])]);
    }

    if (item.customType && !customTypeKeys.has(item.customType.toLowerCase())) {
      onCustomTypesChange(dedupeCaseInsensitive([...customTypes, item.customType]));
    }
  };

  const removeItem = (item: BusinessCategoryItem) => {
    if (item.businessType && item.businessType !== primaryType) {
      onAdditionalTypesChange(
        additionalTypes.filter((type) => type !== item.businessType),
      );
    }

    if (item.customType) {
      onCustomTypesChange(
        customTypes.filter(
          (type) => type.toLowerCase() !== item.customType!.toLowerCase(),
        ),
      );
    }
  };

  const isItemSelected = (item: BusinessCategoryItem) => {
    if (item.customType) return customTypeKeys.has(item.customType.toLowerCase());
    if (item.businessType) {
      return item.businessType === primaryType || additionalTypes.includes(item.businessType);
    }
    return false;
  };

  const isItemDisabled = (item: BusinessCategoryItem) =>
    !item.customType && item.businessType === primaryType;

  const toggleItem = (item: BusinessCategoryItem, checked: boolean) => {
    if (checked) addItem(item);
    else removeItem(item);
  };

  const addTypedCustomCategory = () => {
    const clean = sanitizeCustomLabel(query);
    if (!clean) {
      toast.error("Use 2–40 letters/numbers for a custom category.");
      return;
    }

    if (customTypes.some((type) => type.toLowerCase() === clean.toLowerCase())) {
      toast.error("That category is already added.");
      return;
    }

    onCustomTypesChange(dedupeCaseInsensitive([...customTypes, clean]));
    setQuery("");
    toast.success("Custom category added.");
  };

  const selectSuggestion = (suggestion: BusinessCategoryPickerSuggestion) => {
    setActiveGroupId(suggestion.groupId);
    if (!isItemSelected(suggestion)) addItem(suggestion);
  };

  const selectedCountForGroup = (groupId: string) => {
    const group = BUSINESS_CATEGORY_GROUPS.find((item) => item.id === groupId);
    if (!group) return 0;
    return group.items.filter(isItemSelected).length;
  };

  return {
    query,
    setQuery,
    activeGroup,
    activeGroupId,
    setActiveGroupId,
    suggestions,
    hasSelectedCategories: additionalTypes.length > 0 || customTypes.length > 0,
    isItemSelected,
    isItemDisabled,
    toggleItem,
    addTypedCustomCategory,
    selectSuggestion,
    selectedCountForGroup,
  };
}