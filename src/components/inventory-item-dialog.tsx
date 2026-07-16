import { useEffect, useMemo, useState } from "react";
import { BarChart3, Box, Calculator, DollarSign, FileText, Info, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  INVENTORY_CATEGORIES,
  INVENTORY_STATUSES,
  INVENTORY_UNITS,
  calculateCostPerUnit,
  createInventoryForm,
  toNullableNumber,
  toNumber,
  type InventoryFormState,
  type InventoryItem,
} from "@/lib/inventory";

type Props = {
  businessId: string;
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

const db = supabase as any;

const TABS = [
  { value: "basic", label: "Basic Info", Icon: Box },
  { value: "pricing", label: "Pricing", Icon: DollarSign },
  { value: "inventory", label: "Inventory", Icon: BarChart3 },
  { value: "details", label: "Details", Icon: Info },
  { value: "tax", label: "Tax & Fees", Icon: Calculator },
  { value: "additional", label: "Additional", Icon: FileText },
] as const;

type TabValue = (typeof TABS)[number]["value"];

export function InventoryItemDialog({
  businessId,
  item,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const [tab, setTab] = useState<TabValue>("basic");
  const [form, setForm] = useState<InventoryFormState>(() => createInventoryForm(item));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(createInventoryForm(item));
      setTab("basic");
    }
  }, [open, item]);

  const quantity = toNumber(form.quantity);
  const totalCost = toNumber(form.total_cost);
  const sellPrice = toNumber(form.sell_price);
  const costPerUnit = calculateCostPerUnit(totalCost, quantity);
  const totalRetailValue = sellPrice * quantity;

  const completedSections = useMemo(() => {
    let count = 0;
    if (form.name.trim() && form.category.trim()) count += 1;
    if (sellPrice > 0 || totalCost > 0) count += 1;
    if (quantity >= 0 && form.unit) count += 1;
    if (form.weight || form.dimensions || form.color || form.material) count += 1;
    if (form.tax_rate || form.environmental_fee || form.core_charge || form.hazmat_fee) count += 1;
    if (form.notes || form.image_url || form.date_last_ordered || form.date_last_used) count += 1;
    return count;
  }, [form, quantity, sellPrice, totalCost]);

  function update<K extends keyof InventoryFormState>(
    key: K,
    value: InventoryFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function syncListing(savedItem: InventoryItem) {
    if (!form.publish_to_store) return null;

    const listingPayload = {
      business_id: businessId,
      name: form.name.trim(),
      normalized_name: form.name.trim().toLowerCase(),
      description: form.description.trim() || null,
      price: sellPrice > 0 ? sellPrice : null,
      unit: form.unit || null,
      category: form.category || null,
      image_url: form.image_url.trim() || null,
      in_stock: quantity > 0,
    };

    if (savedItem.listing_id) {
      const { error } = await db
        .from("listings")
        .update(listingPayload)
        .eq("id", savedItem.listing_id);

      if (error) {
        toast.error(error.message);
        return savedItem.listing_id;
      }

      return savedItem.listing_id;
    }

    const { data, error } = await db
      .from("listings")
      .insert(listingPayload)
      .select("id")
      .single();

    if (error || !data) {
      toast.error(error?.message ?? "Could not publish this item to the store.");
      return null;
    }

    await db
      .from("inventory_items")
      .update({ listing_id: data.id })
      .eq("id", savedItem.id);

    return data.id as string;
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();

    if (form.name.trim().length < 2) {
      toast.error("Enter an item name.");
      return;
    }

    if (!form.category.trim()) {
      toast.error("Choose a category.");
      return;
    }

    setSaving(true);

    const payload = {
      business_id: businessId,
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      manufacturer_part_number: form.manufacturer_part_number.trim() || null,
      category: form.category.trim(),
      status: form.status,
      manufacturer: form.manufacturer.trim() || null,
      supplier: form.supplier.trim() || null,
      description: form.description.trim() || null,
      total_cost: totalCost,
      cost_per_unit: costPerUnit,
      sell_price: sellPrice,
      markup_percent: toNumber(form.markup_percent),
      quantity,
      reorder_point: toNumber(form.reorder_point),
      reserved_quantity: toNumber(form.reserved_quantity),
      on_order_quantity: toNumber(form.on_order_quantity),
      minimum_stock: toNumber(form.minimum_stock),
      maximum_stock: toNumber(form.maximum_stock),
      unit: form.unit,
      location: form.location.trim() || null,
      weight: toNullableNumber(form.weight),
      dimensions: form.dimensions.trim() || null,
      color: form.color.trim() || null,
      material: form.material.trim() || null,
      model_year: form.model_year.trim() || null,
      warranty_period: form.warranty_period.trim() || null,
      tax_rate: toNumber(form.tax_rate),
      environmental_fee: toNumber(form.environmental_fee),
      core_charge: toNumber(form.core_charge),
      hazmat_fee: toNumber(form.hazmat_fee),
      tax_exempt: form.tax_exempt,
      date_purchased: form.date_purchased || null,
      date_last_ordered: form.date_last_ordered || null,
      date_last_used: form.date_last_used || null,
      notes: form.notes.trim() || null,
      publish_to_store: form.publish_to_store,
      image_url: form.image_url.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const result = item
      ? await db
          .from("inventory_items")
          .update(payload)
          .eq("id", item.id)
          .select("*")
          .single()
      : await db
          .from("inventory_items")
          .insert(payload)
          .select("*")
          .single();

    if (result.error || !result.data) {
      setSaving(false);
      toast.error(result.error?.message ?? "Could not save inventory item.");
      return;
    }

    const savedItem = result.data as InventoryItem;
    await syncListing(savedItem);

    if (!item && quantity !== 0) {
      await db.from("inventory_adjustments").insert({
        business_id: businessId,
        item_id: savedItem.id,
        change_qty: quantity,
        reason: "initial_stock",
        note: "Initial inventory quantity",
      });
    }

    setSaving(false);
    toast.success(item ? "Inventory item updated." : "Inventory item added.");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto p-0">
        <DialogHeader className="bg-primary px-6 py-6 text-primary-foreground">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <DialogTitle className="text-2xl">
                {item ? "Edit Inventory Item" : "Add New Inventory Item"}
              </DialogTitle>
              <DialogDescription className="text-primary-foreground/80">
                Complete sections for inventory control, pricing, and analytics.
              </DialogDescription>
            </div>
            <div className="rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-medium">
              {completedSections} of 6 sections completed
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-primary-foreground/20">
            <div
              className="h-full rounded-full bg-primary-foreground transition-all"
              style={{ width: `${(completedSections / 6) * 100}%` }}
            />
          </div>
        </DialogHeader>

        <form onSubmit={save} className="p-5">
          <Tabs value={tab} onValueChange={(value) => setTab(value as TabValue)}>
            <TabsList className="grid h-auto grid-cols-2 rounded-2xl p-1 md:grid-cols-6">
              {TABS.map(({ value, label, Icon }) => (
                <TabsTrigger key={value} value={value} className="flex flex-col gap-1 rounded-xl py-3 text-xs">
                  <Icon className="h-4 w-4" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="basic" className="mt-6 rounded-xl border border-border p-5">
              <h3 className="font-display text-xl font-bold">Basic Information</h3>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Item Name *">
                  <Input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Enter item name" />
                </Field>
                <Field label="SKU / Part Number">
                  <Input value={form.sku} onChange={(event) => update("sku", event.target.value)} placeholder="Enter SKU or part number" />
                </Field>
                <Field label="Barcode">
                  <Input value={form.barcode} onChange={(event) => update("barcode", event.target.value)} placeholder="Enter barcode" />
                </Field>
                <Field label="Manufacturer Part Number">
                  <Input value={form.manufacturer_part_number} onChange={(event) => update("manufacturer_part_number", event.target.value)} placeholder="Enter manufacturer part number" />
                </Field>
                <Field label="Main Category *">
                  <Select value={form.category || "none"} onValueChange={(value) => update("category", value === "none" ? "" : value)}>
                    <SelectTrigger><SelectValue placeholder="Select main category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select main category</SelectItem>
                      {INVENTORY_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Status">
                  <Select value={form.status} onValueChange={(value) => update("status", value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INVENTORY_STATUSES.map((status) => (
                        <SelectItem key={status} value={status} className="capitalize">{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Manufacturer">
                  <Input value={form.manufacturer} onChange={(event) => update("manufacturer", event.target.value)} placeholder="Enter manufacturer name" />
                </Field>
                <Field label="Supplier">
                  <Input value={form.supplier} onChange={(event) => update("supplier", event.target.value)} placeholder="Enter supplier name" />
                </Field>
                <Field label="Description" className="md:col-span-2">
                  <Textarea value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Enter item description" rows={4} />
                </Field>
              </div>
            </TabsContent>

            <TabsContent value="pricing" className="mt-6 rounded-xl border border-border p-5">
              <h3 className="font-display text-xl font-bold text-emerald-700">Pricing Information</h3>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Total Cost (All Units)" help="Total cost for all units in this inventory lot">
                  <Input type="number" step="0.01" value={form.total_cost} onChange={(event) => update("total_cost", event.target.value)} placeholder="500.00" />
                </Field>
                <Field label="Sell Price Per Unit" help="Price per unit, piece, pack, or kg">
                  <Input type="number" step="0.01" value={form.sell_price} onChange={(event) => update("sell_price", event.target.value)} placeholder="45.00" />
                </Field>
                <Field label="Markup Percentage" help="Markup percentage over cost">
                  <Input type="number" step="0.01" value={form.markup_percent} onChange={(event) => update("markup_percent", event.target.value)} placeholder="50.0" />
                </Field>
                <div className="grid gap-4 rounded-xl bg-muted/40 p-4 md:grid-cols-2">
                  <Field label="Cost Per Unit" help="Calculated: total cost ÷ quantity">
                    <Input value={costPerUnit.toFixed(2)} readOnly />
                  </Field>
                  <Field label="Total Inventory Value" help="Sell price × quantity">
                    <Input value={totalRetailValue.toFixed(2)} readOnly />
                  </Field>
                </div>
                <Field label="Date Purchased">
                  <Input type="date" value={form.date_purchased} onChange={(event) => update("date_purchased", event.target.value)} />
                </Field>
              </div>
            </TabsContent>

            <TabsContent value="inventory" className="mt-6 rounded-xl border border-border p-5">
              <h3 className="font-display text-xl font-bold">Inventory Management</h3>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <Field label="Current Quantity">
                  <Input type="number" step="0.01" value={form.quantity} onChange={(event) => update("quantity", event.target.value)} />
                </Field>
                <Field label="Reorder Point" help="Minimum quantity before reordering">
                  <Input type="number" step="0.01" value={form.reorder_point} onChange={(event) => update("reorder_point", event.target.value)} />
                </Field>
                <Field label="Measurement Unit">
                  <Select value={form.unit} onValueChange={(value) => update("unit", value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INVENTORY_UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Location">
                  <Input value={form.location} onChange={(event) => update("location", event.target.value)} placeholder="Shelf A1, Bin 5" />
                </Field>
                <Field label="On Hold" help="Quantity reserved or on hold">
                  <Input type="number" step="0.01" value={form.reserved_quantity} onChange={(event) => update("reserved_quantity", event.target.value)} />
                </Field>
                <Field label="On Order" help="Quantity currently on order">
                  <Input type="number" step="0.01" value={form.on_order_quantity} onChange={(event) => update("on_order_quantity", event.target.value)} />
                </Field>
                <Field label="Minimum Stock Level">
                  <Input type="number" step="0.01" value={form.minimum_stock} onChange={(event) => update("minimum_stock", event.target.value)} />
                </Field>
                <Field label="Maximum Stock Level">
                  <Input type="number" step="0.01" value={form.maximum_stock} onChange={(event) => update("maximum_stock", event.target.value)} />
                </Field>
              </div>
            </TabsContent>

            <TabsContent value="details" className="mt-6 rounded-xl border border-border p-5">
              <h3 className="font-display text-xl font-bold">Product Details</h3>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <Field label="Weight">
                  <Input type="number" step="0.01" value={form.weight} onChange={(event) => update("weight", event.target.value)} placeholder="30.0" />
                </Field>
                <Field label="Dimensions">
                  <Input value={form.dimensions} onChange={(event) => update("dimensions", event.target.value)} placeholder="12×8×6 inches" />
                </Field>
                <Field label="Color">
                  <Input value={form.color} onChange={(event) => update("color", event.target.value)} placeholder="Black" />
                </Field>
                <Field label="Material">
                  <Input value={form.material} onChange={(event) => update("material", event.target.value)} placeholder="Steel, aluminum, etc." />
                </Field>
                <Field label="Model Year">
                  <Input value={form.model_year} onChange={(event) => update("model_year", event.target.value)} placeholder="2026" />
                </Field>
                <Field label="Warranty Period">
                  <Input value={form.warranty_period} onChange={(event) => update("warranty_period", event.target.value)} placeholder="12 months" />
                </Field>
              </div>
            </TabsContent>

            <TabsContent value="tax" className="mt-6 rounded-xl border border-border p-5">
              <h3 className="font-display text-xl font-bold">Tax & Fees</h3>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <Field label="Tax Rate (%)" help="Sales tax rate percentage">
                  <Input type="number" step="0.01" value={form.tax_rate} onChange={(event) => update("tax_rate", event.target.value)} />
                </Field>
                <Field label="Environmental Fee" help="Environmental disposal fee">
                  <Input type="number" step="0.01" value={form.environmental_fee} onChange={(event) => update("environmental_fee", event.target.value)} />
                </Field>
                <Field label="Core Charge" help="Refundable core charge">
                  <Input type="number" step="0.01" value={form.core_charge} onChange={(event) => update("core_charge", event.target.value)} />
                </Field>
                <Field label="Hazmat Fee" help="Hazardous materials handling fee">
                  <Input type="number" step="0.01" value={form.hazmat_fee} onChange={(event) => update("hazmat_fee", event.target.value)} />
                </Field>
                <label className="flex items-center gap-2 self-end rounded-lg border border-border p-3 text-sm">
                  <Checkbox checked={form.tax_exempt} onCheckedChange={(value) => update("tax_exempt", value === true)} />
                  Tax Exempt Item
                </label>
              </div>
            </TabsContent>

            <TabsContent value="additional" className="mt-6 space-y-5">
              <div className="rounded-xl border border-border p-5">
                <h3 className="font-display text-xl font-bold">Additional Information</h3>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Field label="Date Last Ordered">
                    <Input type="date" value={form.date_last_ordered} onChange={(event) => update("date_last_ordered", event.target.value)} />
                  </Field>
                  <Field label="Date Last Used">
                    <Input type="date" value={form.date_last_used} onChange={(event) => update("date_last_used", event.target.value)} />
                  </Field>
                  <Field label="Image URL" className="md:col-span-2">
                    <Input value={form.image_url} onChange={(event) => update("image_url", event.target.value)} placeholder="https://..." />
                  </Field>
                  <Field label="Notes" className="md:col-span-2" help="Internal notes about this inventory item">
                    <Textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} rows={4} />
                  </Field>
                  <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm md:col-span-2">
                    <Checkbox checked={form.publish_to_store} onCheckedChange={(value) => update("publish_to_store", value === true)} />
                    Publish this item as a public store listing
                  </label>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="sticky bottom-0 -mx-5 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/95 px-5 py-4 backdrop-blur">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={tab === "basic"}
                onClick={() => setTab(TABS[Math.max(0, TABS.findIndex((item) => item.value === tab) - 1)].value)}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={tab === "additional"}
                onClick={() => setTab(TABS[Math.min(TABS.length - 1, TABS.findIndex((item) => item.value === tab) + 1)].value)}
              >
                Next
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {item ? "Save Item" : "Add Item"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  help,
  children,
  className,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <div className="mt-1.5">{children}</div>
      {help && <p className="mt-1 text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}