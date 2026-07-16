import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InventoryDialogField } from "@/components/inventory-dialog-field";
import {
  INVENTORY_UNITS,
  type InventoryFormState,
} from "@/lib/inventory";
import type { InventoryFormUpdate } from "@/hooks/use-inventory-item-dialog";

type Props = {
  form: InventoryFormState;
  update: InventoryFormUpdate;
};

export function InventoryItemStockTab({ form, update }: Props) {
  return (
    <div className="rounded-xl border border-border p-5">
      <h3 className="font-display text-xl font-bold">Inventory Management</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <InventoryDialogField label="Current Quantity">
          <Input
            type="number"
            step="0.01"
            value={form.quantity}
            onChange={(event) => update("quantity", event.target.value)}
          />
        </InventoryDialogField>
        <InventoryDialogField
          label="Reorder Point"
          help="Minimum quantity before reordering"
        >
          <Input
            type="number"
            step="0.01"
            value={form.reorder_point}
            onChange={(event) => update("reorder_point", event.target.value)}
          />
        </InventoryDialogField>
        <InventoryDialogField label="Measurement Unit">
          <Select value={form.unit} onValueChange={(value) => update("unit", value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVENTORY_UNITS.map((unit) => (
                <SelectItem key={unit} value={unit}>
                  {unit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </InventoryDialogField>
        <InventoryDialogField label="Location">
          <Input
            value={form.location}
            onChange={(event) => update("location", event.target.value)}
            placeholder="Shelf A1, Bin 5"
          />
        </InventoryDialogField>
        <InventoryDialogField label="On Hold" help="Quantity reserved or on hold">
          <Input
            type="number"
            step="0.01"
            value={form.reserved_quantity}
            onChange={(event) => update("reserved_quantity", event.target.value)}
          />
        </InventoryDialogField>
        <InventoryDialogField label="On Order" help="Quantity currently on order">
          <Input
            type="number"
            step="0.01"
            value={form.on_order_quantity}
            onChange={(event) => update("on_order_quantity", event.target.value)}
          />
        </InventoryDialogField>
        <InventoryDialogField label="Minimum Stock Level">
          <Input
            type="number"
            step="0.01"
            value={form.minimum_stock}
            onChange={(event) => update("minimum_stock", event.target.value)}
          />
        </InventoryDialogField>
        <InventoryDialogField label="Maximum Stock Level">
          <Input
            type="number"
            step="0.01"
            value={form.maximum_stock}
            onChange={(event) => update("maximum_stock", event.target.value)}
          />
        </InventoryDialogField>
      </div>
    </div>
  );
}