import { Input } from "@/components/ui/input";
import { InventoryDialogField } from "@/components/inventory-dialog-field";
import type { InventoryFormState } from "@/lib/inventory";
import type { InventoryFormUpdate } from "@/hooks/use-inventory-item-dialog";

type Props = {
  form: InventoryFormState;
  update: InventoryFormUpdate;
  costPerUnit: number;
  totalRetailValue: number;
};

export function InventoryItemPricingTab({ form, update, costPerUnit, totalRetailValue }: Props) {
  return (
    <div className="rounded-xl border border-border p-5">
      <h3 className="font-display text-xl font-bold text-emerald-700">Pricing Information</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <InventoryDialogField
          label="Total Cost (All Units)"
          help="Total cost for all units in this inventory lot"
        >
          <Input
            type="number"
            step="0.01"
            value={form.total_cost}
            onChange={(event) => update("total_cost", event.target.value)}
            placeholder="500.00"
          />
        </InventoryDialogField>
        <InventoryDialogField label="Sell Price Per Unit" help="Price per unit, piece, pack, or kg">
          <Input
            type="number"
            step="0.01"
            value={form.sell_price}
            onChange={(event) => update("sell_price", event.target.value)}
            placeholder="45.00"
          />
        </InventoryDialogField>
        <InventoryDialogField label="Markup Percentage" help="Markup percentage over cost">
          <Input
            type="number"
            step="0.01"
            value={form.markup_percent}
            onChange={(event) => update("markup_percent", event.target.value)}
            placeholder="50.0"
          />
        </InventoryDialogField>
        <div className="grid gap-4 rounded-xl bg-muted/40 p-4 md:grid-cols-2">
          <InventoryDialogField label="Cost Per Unit" help="Calculated: total cost ÷ quantity">
            <Input value={costPerUnit.toFixed(2)} readOnly />
          </InventoryDialogField>
          <InventoryDialogField label="Total Inventory Value" help="Sell price × quantity">
            <Input value={totalRetailValue.toFixed(2)} readOnly />
          </InventoryDialogField>
        </div>
        <InventoryDialogField label="Date Purchased">
          <Input
            type="date"
            value={form.date_purchased}
            onChange={(event) => update("date_purchased", event.target.value)}
          />
        </InventoryDialogField>
      </div>
    </div>
  );
}
