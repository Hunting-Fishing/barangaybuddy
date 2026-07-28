import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { InventoryDialogField } from "@/components/inventory-dialog-field";
import type { InventoryFormState } from "@/lib/inventory";
import type { InventoryFormUpdate } from "@/hooks/use-inventory-item-dialog";

type Props = {
  form: InventoryFormState;
  update: InventoryFormUpdate;
};

export function InventoryItemTaxTab({ form, update }: Props) {
  return (
    <div className="rounded-xl border border-border p-5">
      <h3 className="font-display text-xl font-bold">Tax & Fees</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <InventoryDialogField label="Tax Rate (%)" help="Sales tax rate percentage">
          <Input
            type="number"
            step="0.01"
            value={form.tax_rate}
            onChange={(event) => update("tax_rate", event.target.value)}
          />
        </InventoryDialogField>
        <InventoryDialogField label="Environmental Fee" help="Environmental disposal fee">
          <Input
            type="number"
            step="0.01"
            value={form.environmental_fee}
            onChange={(event) => update("environmental_fee", event.target.value)}
          />
        </InventoryDialogField>
        <InventoryDialogField label="Core Charge" help="Refundable core charge">
          <Input
            type="number"
            step="0.01"
            value={form.core_charge}
            onChange={(event) => update("core_charge", event.target.value)}
          />
        </InventoryDialogField>
        <InventoryDialogField label="Hazmat Fee" help="Hazardous materials handling fee">
          <Input
            type="number"
            step="0.01"
            value={form.hazmat_fee}
            onChange={(event) => update("hazmat_fee", event.target.value)}
          />
        </InventoryDialogField>
        <label className="flex items-center gap-2 self-end rounded-lg border border-border p-3 text-sm">
          <Checkbox
            checked={form.tax_exempt}
            onCheckedChange={(value) => update("tax_exempt", value === true)}
          />
          Tax Exempt Item
        </label>
      </div>
    </div>
  );
}
