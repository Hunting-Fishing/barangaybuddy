import type { Dispatch, SetStateAction } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { BusinessCategoryPicker } from "@/components/business-category-picker";
import { FeatureTagsPicker } from "@/components/feature-tags-picker";
import type { AddBusinessFormState } from "@/lib/add-business-form";

type Props = {
  form: AddBusinessFormState;
  setForm: Dispatch<SetStateAction<AddBusinessFormState>>;
};

export function AddBusinessCategoriesSection({ form, setForm }: Props) {
  return (
    <Card className="p-5 md:p-6">
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-primary">
          Step 2
        </div>
        <h2 className="font-display text-xl font-bold">Categories & features</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add extra categories and amenities so your business appears in better searches.
        </p>
      </div>

      <div className="mt-5">
        <BusinessCategoryPicker
          primaryType={form.type}
          additionalTypes={form.additional_types}
          customTypes={form.custom_types}
          onAdditionalTypesChange={(additional_types) =>
            setForm((current) => ({ ...current, additional_types }))
          }
          onCustomTypesChange={(custom_types) =>
            setForm((current) => ({ ...current, custom_types }))
          }
        />
      </div>

      <div className="mt-6">
        <Label>
          Features & amenities{" "}
          <span className="text-xs font-normal text-muted-foreground">
            — WiFi, GCash, delivery, billiards, parking, and more
          </span>
        </Label>
        <div className="mt-2">
          <FeatureTagsPicker
            value={form.tags}
            onChange={(tags) => setForm((current) => ({ ...current, tags }))}
          />
        </div>
      </div>
    </Card>
  );
}