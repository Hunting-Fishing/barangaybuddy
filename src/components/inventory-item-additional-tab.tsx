import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { InventoryDialogField } from "@/components/inventory-dialog-field";
import type { InventoryFormState } from "@/lib/inventory";
import type { InventoryFormUpdate } from "@/hooks/use-inventory-item-dialog";

type Props = {
  form: InventoryFormState;
  update: InventoryFormUpdate;
};

export function InventoryItemAdditionalTab({ form, update }: Props) {
  return (
    <div className="rounded-xl border border-border p-5">
      <h3 className="font-display text-xl font-bold">Additional Information</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <InventoryDialogField label="Date Last Ordered">
          <Input
            type="date"
            value={form.date_last_ordered}
            onChange={(event) => update("date_last_ordered", event.target.value)}
          />
        </InventoryDialogField>
        <InventoryDialogField label="Date Last Used">
          <Input
            type="date"
            value={form.date_last_used}
            onChange={(event) => update("date_last_used", event.target.value)}
          />
        </InventoryDialogField>
        <InventoryDialogField label="Image URL" className="md:col-span-2">
          <Input
            value={form.image_url}
            onChange={(event) => update("image_url", event.target.value)}
            placeholder="https://..."
          />
        </InventoryDialogField>
        <InventoryDialogField
          label="Notes"
          help="Internal notes about this inventory item"
          className="md:col-span-2"
        >
          <Textarea
            value={form.notes}
            onChange={(event) => update("notes", event.target.value)}
            rows={4}
          />
        </InventoryDialogField>
        <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm md:col-span-2">
          <Checkbox
            checked={form.publish_to_store}
            onCheckedChange={(value) => update("publish_to_store", value === true)}
          />
          Publish this item as a public store listing
        </label>
      </div>
    </div>
  );
}