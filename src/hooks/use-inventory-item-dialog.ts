import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  calculateCostPerUnit,
  createInventoryForm,
  toNullableNumber,
  toNumber,
  type InventoryFormState,
  type InventoryItem,
  type InventoryLink,
} from "@/lib/inventory";

export const INVENTORY_ITEM_DIALOG_TAB_VALUES = [
  "basic",
  "pricing",
  "inventory",
  "details",
  "tax",
  "additional",
] as const;

export type InventoryDialogTab = (typeof INVENTORY_ITEM_DIALOG_TAB_VALUES)[number];

export type InventoryFormUpdate = <K extends keyof InventoryFormState>(
  key: K,
  value: InventoryFormState[K],
) => void;

type Args = {
  businessId: string;
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

const db = supabase as any;

function cleanLinks(links: InventoryLink[]) {
  return links
    .map((link) => ({
      type: link.type.trim() || "related",
      label: link.label.trim(),
      url: link.url.trim(),
    }))
    .filter((link) => link.label.length > 0 && link.url.length > 0)
    .slice(0, 12);
}

export function useInventoryItemDialog({ businessId, item, open, onOpenChange, onSaved }: Args) {
  const [tab, setTab] = useState<InventoryDialogTab>("basic");
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
    if (form.tax_rate || form.environmental_fee || form.core_charge || form.hazmat_fee) {
      count += 1;
    }
    if (
      form.notes ||
      form.image_url ||
      form.date_last_ordered ||
      form.date_last_used ||
      form.links.length > 0
    ) {
      count += 1;
    }
    return count;
  }, [form, quantity, sellPrice, totalCost]);

  const tabIndex = INVENTORY_ITEM_DIALOG_TAB_VALUES.indexOf(tab);
  const canGoPrevious = tabIndex > 0;
  const canGoNext = tabIndex < INVENTORY_ITEM_DIALOG_TAB_VALUES.length - 1;

  function update<K extends keyof InventoryFormState>(key: K, value: InventoryFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function goPrevious() {
    if (!canGoPrevious) return;
    setTab(INVENTORY_ITEM_DIALOG_TAB_VALUES[tabIndex - 1]);
  }

  function goNext() {
    if (!canGoNext) return;
    setTab(INVENTORY_ITEM_DIALOG_TAB_VALUES[tabIndex + 1]);
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
      category: form.sub_category || form.category || null,
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

    const { data, error } = await db.from("listings").insert(listingPayload).select("id").single();

    if (error || !data) {
      toast.error(error?.message ?? "Could not publish this item to the store.");
      return null;
    }

    await db.from("inventory_items").update({ listing_id: data.id }).eq("id", savedItem.id);

    return data.id as string;
  }

  async function save(event: FormEvent) {
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
      sub_category: form.sub_category.trim() || null,
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
      links: cleanLinks(form.links),
      publish_to_store: form.publish_to_store,
      image_url: form.image_url.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const result = item
      ? await db.from("inventory_items").update(payload).eq("id", item.id).select("*").single()
      : await db.from("inventory_items").insert(payload).select("*").single();

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

  return {
    tab,
    setTab,
    form,
    update,
    saving,
    save,
    costPerUnit,
    totalRetailValue,
    completedSections,
    canGoPrevious,
    canGoNext,
    goPrevious,
    goNext,
  };
}
