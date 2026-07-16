import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Boxes,
  Edit,
  PackagePlus,
  Search,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InventoryItemDialog } from "@/components/inventory-item-dialog";
import {
  calculateInventoryStats,
  formatPeso,
  type InventoryItem,
} from "@/lib/inventory";

type Props = {
  businessId: string;
};

const db = supabase as any;

export function InventoryManager({ businessId }: Props) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  async function loadItems() {
    setLoading(true);
    const { data, error } = await db
      .from("inventory_items")
      .select("*")
      .eq("business_id", businessId)
      .order("updated_at", { ascending: false });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setItems((data ?? []) as InventoryItem[]);
  }

  useEffect(() => {
    void loadItems();
  }, [businessId]);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;

    return items.filter((item) =>
      [
        item.name,
        item.sku,
        item.barcode,
        item.category,
        item.supplier,
        item.location,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [items, query]);

  const stats = useMemo(() => calculateInventoryStats(items), [items]);

  function openNewItem() {
    setEditingItem(null);
    setDialogOpen(true);
  }

  function openEditItem(item: InventoryItem) {
    setEditingItem(item);
    setDialogOpen(true);
  }

  async function adjustStock(item: InventoryItem, direction: "in" | "out") {
    const raw = window.prompt(
      direction === "in"
        ? `How many ${item.unit} should be added to ${item.name}?`
        : `How many ${item.unit} should be removed from ${item.name}?`,
      "1",
    );

    if (!raw) return;

    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid quantity.");
      return;
    }

    const change = direction === "in" ? amount : -amount;
    const nextQuantity = Number(item.quantity ?? 0) + change;

    if (nextQuantity < 0) {
      toast.error("Stock cannot go below zero.");
      return;
    }

    const { error } = await db
      .from("inventory_items")
      .update({
        quantity: nextQuantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    await db.from("inventory_adjustments").insert({
      business_id: businessId,
      item_id: item.id,
      change_qty: change,
      reason: direction === "in" ? "stock_in" : "stock_out",
      note: direction === "in" ? "Manual stock in" : "Manual stock out",
    });

    if (item.listing_id) {
      await db
        .from("listings")
        .update({ in_stock: nextQuantity > 0 })
        .eq("id", item.listing_id);
    }

    toast.success(direction === "in" ? "Stock added." : "Stock removed.");
    await loadItems();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard
          label="Items"
          value={stats.totalItems.toLocaleString()}
          icon={<Boxes className="h-5 w-5" />}
        />
        <StatCard
          label="Total stock"
          value={stats.totalQuantity.toLocaleString()}
          icon={<PackagePlus className="h-5 w-5" />}
        />
        <StatCard
          label="Cost value"
          value={formatPeso(stats.costValue)}
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <StatCard
          label="Retail value"
          value={formatPeso(stats.retailValue)}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          label="Low stock"
          value={stats.lowStock.toLocaleString()}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone={stats.lowStock > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Out of stock"
          value={stats.outOfStock.toLocaleString()}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone={stats.outOfStock > 0 ? "danger" : "default"}
        />
      </div>

      <Card className="p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold">Inventory control</h2>
            <p className="text-sm text-muted-foreground">
              Track stock, cost, retail value, reorder points, and public product listings.
            </p>
          </div>
          <Button onClick={openNewItem} className="gap-2">
            <PackagePlus className="h-4 w-4" /> Add item
          </Button>
        </div>

        <div className="relative mt-5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search inventory by item, SKU, supplier, location…"
            className="pl-9"
          />
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-border">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading inventory…</div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center">
              <PackagePlus className="mx-auto h-8 w-8 text-muted-foreground" />
              <h3 className="mt-3 font-display text-lg font-bold">
                {items.length === 0 ? "No inventory yet" : "No matching inventory"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {items.length === 0
                  ? "Add your first item to start tracking stock, pricing, and reorder points."
                  : "Try a different search term."}
              </p>
              {items.length === 0 && (
                <Button onClick={openNewItem} className="mt-4 gap-2">
                  <PackagePlus className="h-4 w-4" /> Add first item
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredItems.map((item) => {
                const quantity = Number(item.quantity ?? 0);
                const reorderPoint = Number(item.reorder_point ?? 0);
                const lowStock = quantity > 0 && reorderPoint > 0 && quantity <= reorderPoint;
                const outOfStock = quantity <= 0;

                return (
                  <div key={item.id} className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg font-bold">{item.name}</h3>
                        {outOfStock ? (
                          <Badge variant="destructive">Out of stock</Badge>
                        ) : lowStock ? (
                          <Badge className="bg-amber-500 text-white">Low stock</Badge>
                        ) : (
                          <Badge variant="secondary">In stock</Badge>
                        )}
                        {item.publish_to_store && <Badge variant="outline">Published</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {[item.category, item.sku ? `SKU ${item.sku}` : null, item.location].filter(Boolean).join(" · ")}
                      </p>
                      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
                        <Metric label="Qty" value={`${quantity.toLocaleString()} ${item.unit}`} />
                        <Metric label="Reorder at" value={String(item.reorder_point ?? 0)} />
                        <Metric label="Cost/unit" value={formatPeso(Number(item.cost_per_unit ?? 0))} />
                        <Metric label="Sell/unit" value={formatPeso(Number(item.sell_price ?? 0))} />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button size="sm" variant="outline" onClick={() => adjustStock(item, "in")} className="gap-1">
                        <ArrowUp className="h-3.5 w-3.5" /> Stock in
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => adjustStock(item, "out")} className="gap-1">
                        <ArrowDown className="h-3.5 w-3.5" /> Stock out
                      </Button>
                      <Button size="sm" onClick={() => openEditItem(item)} className="gap-1">
                        <Edit className="h-3.5 w-3.5" /> Edit
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <InventoryItemDialog
        businessId={businessId}
        item={editingItem}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={loadItems}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "default" | "warning" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "bg-destructive/10 text-destructive"
      : tone === "warning"
        ? "bg-amber-500/10 text-amber-700"
        : "bg-primary/10 text-primary";

  return (
    <Card className="p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneClass}`}>
        {icon}
      </div>
      <div className="mt-3 text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium tabular-nums">{value}</div>
    </div>
  );
}