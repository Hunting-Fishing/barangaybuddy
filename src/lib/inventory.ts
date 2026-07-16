export type InventoryItem = {
  id: string;
  business_id: string;
  listing_id: string | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  manufacturer_part_number: string | null;
  category: string | null;
  sub_category: string | null;
  status: string;
  manufacturer: string | null;
  supplier: string | null;
  description: string | null;
  total_cost: number;
  cost_per_unit: number;
  sell_price: number;
  markup_percent: number;
  quantity: number;
  reorder_point: number;
  reserved_quantity: number;
  on_order_quantity: number;
  minimum_stock: number;
  maximum_stock: number;
  unit: string;
  location: string | null;
  weight: number | null;
  dimensions: string | null;
  color: string | null;
  material: string | null;
  model_year: string | null;
  warranty_period: string | null;
  tax_rate: number;
  environmental_fee: number;
  core_charge: number;
  hazmat_fee: number;
  tax_exempt: boolean;
  date_purchased: string | null;
  date_last_ordered: string | null;
  date_last_used: string | null;
  notes: string | null;
  links: InventoryLink[];
  publish_to_store: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type InventoryLink = {
  type: string;
  label: string;
  url: string;
};

export type InventoryFormState = {
  name: string;
  sku: string;
  barcode: string;
  manufacturer_part_number: string;
  category: string;
  sub_category: string;
  status: string;
  manufacturer: string;
  supplier: string;
  description: string;
  total_cost: string;
  sell_price: string;
  markup_percent: string;
  quantity: string;
  reorder_point: string;
  reserved_quantity: string;
  on_order_quantity: string;
  minimum_stock: string;
  maximum_stock: string;
  unit: string;
  location: string;
  weight: string;
  dimensions: string;
  color: string;
  material: string;
  model_year: string;
  warranty_period: string;
  tax_rate: string;
  environmental_fee: string;
  core_charge: string;
  hazmat_fee: string;
  tax_exempt: boolean;
  date_purchased: string;
  date_last_ordered: string;
  date_last_used: string;
  notes: string;
  links: InventoryLink[];
  publish_to_store: boolean;
  image_url: string;
};

export const INVENTORY_STATUSES = ["active", "draft", "discontinued"] as const;

export const INVENTORY_UNITS = [
  "each",
  "piece",
  "pack",
  "box",
  "case",
  "kg",
  "g",
  "L",
  "ml",
  "meter",
  "set",
] as const;

export const INVENTORY_CATEGORIES = [
  "Food & drinks",
  "Retail goods",
  "Dry goods",
  "Hardware",
  "Parts & accessories",
  "Services supplies",
  "Fuel & automotive",
  "Health & beauty",
  "Agriculture",
  "Other",
];

export const INVENTORY_SUBCATEGORIES: Record<string, string[]> = {
  "Food & drinks": [
    "Ingredients",
    "Prepared food",
    "Drinks",
    "Frozen goods",
    "Snacks",
    "Condiments",
    "Packaging",
  ],
  "Retail goods": [
    "Grocery",
    "Household essentials",
    "Mobile load/accessories",
    "Water/LPG",
    "General merchandise",
  ],
  "Dry goods": [
    "Clothing",
    "Footwear",
    "Bags",
    "School supplies",
    "Textiles",
    "Ukay-ukay",
  ],
  Hardware: [
    "Tools",
    "Paint",
    "Electrical",
    "Plumbing",
    "Cement/aggregates",
    "Lumber",
    "Fasteners",
  ],
  "Parts & accessories": [
    "Motorcycle parts",
    "Auto parts",
    "Bicycle parts",
    "Tires",
    "Oil/lubricants",
    "Electronics",
  ],
  "Services supplies": [
    "Cleaning supplies",
    "Printing supplies",
    "Laundry supplies",
    "Salon supplies",
    "Office supplies",
  ],
  "Fuel & automotive": [
    "Gasoline",
    "Diesel",
    "Motor oil",
    "Filters",
    "Car wash supplies",
    "Vulcanizing supplies",
  ],
  "Health & beauty": [
    "Medicine",
    "Supplements",
    "Personal care",
    "Hair care",
    "Nail/lash supplies",
    "Clinic supplies",
  ],
  Agriculture: [
    "Seeds",
    "Fertilizer",
    "Feeds",
    "Pesticides",
    "Farm tools",
    "Seedlings",
    "Livestock supplies",
  ],
  Other: ["General", "Consumables", "Equipment", "Materials", "Supplies"],
};

export function getInventorySubcategories(category: string) {
  return INVENTORY_SUBCATEGORIES[category] ?? INVENTORY_SUBCATEGORIES.Other;
}

function normalizeLinks(value: unknown): InventoryLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((link) => {
      if (!link || typeof link !== "object") return null;
      const row = link as Partial<InventoryLink>;
      return {
        type: String(row.type ?? "").trim(),
        label: String(row.label ?? "").trim(),
        url: String(row.url ?? "").trim(),
      };
    })
    .filter(
      (link): link is InventoryLink =>
        link !== null && link.label.length > 0 && link.url.length > 0,
    );
}

export function createInventoryForm(item?: InventoryItem | null): InventoryFormState {
  return {
    name: item?.name ?? "",
    sku: item?.sku ?? "",
    barcode: item?.barcode ?? "",
    manufacturer_part_number: item?.manufacturer_part_number ?? "",
    category: item?.category ?? "",
    sub_category: item?.sub_category ?? "",
    status: item?.status ?? "active",
    manufacturer: item?.manufacturer ?? "",
    supplier: item?.supplier ?? "",
    description: item?.description ?? "",
    total_cost: item?.total_cost != null ? String(item.total_cost) : "",
    sell_price: item?.sell_price != null ? String(item.sell_price) : "",
    markup_percent: item?.markup_percent != null ? String(item.markup_percent) : "",
    quantity: item?.quantity != null ? String(item.quantity) : "0",
    reorder_point: item?.reorder_point != null ? String(item.reorder_point) : "0",
    reserved_quantity: item?.reserved_quantity != null ? String(item.reserved_quantity) : "0",
    on_order_quantity: item?.on_order_quantity != null ? String(item.on_order_quantity) : "0",
    minimum_stock: item?.minimum_stock != null ? String(item.minimum_stock) : "0",
    maximum_stock: item?.maximum_stock != null ? String(item.maximum_stock) : "0",
    unit: item?.unit ?? "each",
    location: item?.location ?? "",
    weight: item?.weight != null ? String(item.weight) : "",
    dimensions: item?.dimensions ?? "",
    color: item?.color ?? "",
    material: item?.material ?? "",
    model_year: item?.model_year ?? "",
    warranty_period: item?.warranty_period ?? "",
    tax_rate: item?.tax_rate != null ? String(item.tax_rate) : "0",
    environmental_fee: item?.environmental_fee != null ? String(item.environmental_fee) : "0",
    core_charge: item?.core_charge != null ? String(item.core_charge) : "0",
    hazmat_fee: item?.hazmat_fee != null ? String(item.hazmat_fee) : "0",
    tax_exempt: item?.tax_exempt ?? false,
    date_purchased: item?.date_purchased ?? "",
    date_last_ordered: item?.date_last_ordered ?? "",
    date_last_used: item?.date_last_used ?? "",
    notes: item?.notes ?? "",
    links: normalizeLinks(item?.links),
    publish_to_store: item?.publish_to_store ?? true,
    image_url: item?.image_url ?? "",
  };
}

export function toNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toNullableNumber(value: string) {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) ? parsed : null;
}

export function calculateCostPerUnit(totalCost: number, quantity: number) {
  return quantity > 0 ? totalCost / quantity : 0;
}

export function calculateInventoryStats(items: InventoryItem[]) {
  const totalItems = items.length;
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
  const costValue = items.reduce(
    (sum, item) => sum + Number(item.quantity ?? 0) * Number(item.cost_per_unit ?? 0),
    0,
  );
  const retailValue = items.reduce(
    (sum, item) => sum + Number(item.quantity ?? 0) * Number(item.sell_price ?? 0),
    0,
  );
  const outOfStock = items.filter((item) => Number(item.quantity ?? 0) <= 0).length;
  const lowStock = items.filter((item) => {
    const quantity = Number(item.quantity ?? 0);
    const reorderPoint = Number(item.reorder_point ?? 0);
    return quantity > 0 && reorderPoint > 0 && quantity <= reorderPoint;
  }).length;

  return {
    totalItems,
    totalQuantity,
    costValue,
    retailValue,
    potentialProfit: retailValue - costValue,
    outOfStock,
    lowStock,
  };
}

export function formatPeso(value: number) {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}