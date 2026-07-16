import { Input } from "@/components/ui/input";
import { InventoryDialogField } from "@/components/inventory-dialog-field";
import type { InventoryFormState } from "@/lib/inventory";
import type { InventoryFormUpdate } from "@/hooks/use-inventory-item-dialog";

type Props = {
  form: InventoryFormState;
  update: InventoryFormUpdate;
};

export function InventoryItemDetailsTab({ form, update }: Props) {
  return (
    <div className="rounded-xl border border-border p-5">
      <h3 className="font-display text-xl font-bold">Product Details</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <InventoryDialogField label="Weight">
          <Input
            type="number"
            step="0.01"
            value={form.weight}
            onChange={(event) => update("weight", event.target.value)}
            placeholder="30.0"
          />
        </InventoryDialogField>
        <InventoryDialogField label="Dimensions">
          <Input
            value={form.dimensions}
            onChange={(event) => update("dimensions", event.target.value)}
            placeholder="12×8×6 inches"
          />
        </InventoryDialogField>
        <InventoryDialogField label="Color">
          <Input
            value={form.color}
            onChange={(event) => update("color", event.target.value)}
            placeholder="Black"
          />
        </InventoryDialogField>
        <InventoryDialogField label="Material">
          <Input
            value={form.material}
            onChange={(event) => update("material", event.target.value)}
            placeholder="Steel, aluminum, etc."
          />
        </InventoryDialogField>
        <InventoryDialogField label="Model Year">
          <Input
            value={form.model_year}
            onChange={(event) => update("model_year", event.target.value)}
            placeholder="2026"
          />
        </InventoryDialogField>
        <InventoryDialogField label="Warranty Period">
          <Input
            value={form.warranty_period}
            onChange={(event) => update("warranty_period", event.target.value)}
            placeholder="12 months"
          />
        </InventoryDialogField>
      </div>
    </div>
  );
}