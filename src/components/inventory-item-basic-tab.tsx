import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { InventoryDialogField } from "@/components/inventory-dialog-field";
import {
  INVENTORY_CATEGORIES,
  INVENTORY_STATUSES,
  getInventorySubcategories,
  type InventoryFormState,
} from "@/lib/inventory";
import type { InventoryFormUpdate } from "@/hooks/use-inventory-item-dialog";

type Props = {
  form: InventoryFormState;
  update: InventoryFormUpdate;
};

export function InventoryItemBasicTab({ form, update }: Props) {
  const subcategories = getInventorySubcategories(form.category || "Other");

  return (
    <div className="rounded-xl border border-border p-5">
      <h3 className="font-display text-xl font-bold">Basic Information</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <InventoryDialogField label="Item Name *">
          <Input
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Enter item name"
          />
        </InventoryDialogField>
        <InventoryDialogField label="SKU / Part Number">
          <Input
            value={form.sku}
            onChange={(event) => update("sku", event.target.value)}
            placeholder="Enter SKU or part number"
          />
        </InventoryDialogField>
        <InventoryDialogField label="Barcode">
          <Input
            value={form.barcode}
            onChange={(event) => update("barcode", event.target.value)}
            placeholder="Enter barcode"
          />
        </InventoryDialogField>
        <InventoryDialogField label="Manufacturer Part Number">
          <Input
            value={form.manufacturer_part_number}
            onChange={(event) => update("manufacturer_part_number", event.target.value)}
            placeholder="Enter manufacturer part number"
          />
        </InventoryDialogField>
        <InventoryDialogField label="Main Category *">
          <Select
            value={form.category || "none"}
            onValueChange={(value) => {
              update("category", value === "none" ? "" : value);
              update("sub_category", "");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select main category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Select main category</SelectItem>
              {INVENTORY_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </InventoryDialogField>
        <InventoryDialogField
          label="Sub-category"
          help="Use this to organize items inside the main category."
        >
          <Select
            value={form.sub_category || "none"}
            onValueChange={(value) => update("sub_category", value === "none" ? "" : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select sub-category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No sub-category</SelectItem>
              {subcategories.map((subcategory) => (
                <SelectItem key={subcategory} value={subcategory}>
                  {subcategory}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </InventoryDialogField>
        <InventoryDialogField label="Status">
          <Select value={form.status} onValueChange={(value) => update("status", value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVENTORY_STATUSES.map((status) => (
                <SelectItem key={status} value={status} className="capitalize">
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </InventoryDialogField>
        <InventoryDialogField label="Manufacturer">
          <Input
            value={form.manufacturer}
            onChange={(event) => update("manufacturer", event.target.value)}
            placeholder="Enter manufacturer name"
          />
        </InventoryDialogField>
        <InventoryDialogField label="Supplier">
          <Input
            value={form.supplier}
            onChange={(event) => update("supplier", event.target.value)}
            placeholder="Enter supplier name"
          />
        </InventoryDialogField>
        <InventoryDialogField label="Description" className="md:col-span-2">
          <Textarea
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="Enter item description"
            rows={4}
          />
        </InventoryDialogField>
      </div>
    </div>
  );
}
