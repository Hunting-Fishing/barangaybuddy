import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { InventoryItemAdditionalTab } from "@/components/inventory-item-additional-tab";
import { InventoryItemBasicTab } from "@/components/inventory-item-basic-tab";
import { InventoryItemDetailsTab } from "@/components/inventory-item-details-tab";
import { InventoryItemDialogHeader } from "@/components/inventory-item-dialog-header";
import { InventoryItemPricingTab } from "@/components/inventory-item-pricing-tab";
import { InventoryItemStockTab } from "@/components/inventory-item-stock-tab";
import { InventoryItemTabList } from "@/components/inventory-item-tab-list";
import { InventoryItemTaxTab } from "@/components/inventory-item-tax-tab";
import {
  useInventoryItemDialog,
  type InventoryDialogTab,
} from "@/hooks/use-inventory-item-dialog";
import type { InventoryItem } from "@/lib/inventory";

type Props = {
  businessId: string;
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function InventoryItemDialog({
  businessId,
  item,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const dialog = useInventoryItemDialog({
    businessId,
    item,
    open,
    onOpenChange,
    onSaved,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto p-0">
        <InventoryItemDialogHeader
          item={item}
          completedSections={dialog.completedSections}
        />

        <form onSubmit={dialog.save} className="p-5">
          <Tabs
            value={dialog.tab}
            onValueChange={(value) => dialog.setTab(value as InventoryDialogTab)}
          >
            <InventoryItemTabList />

            <TabsContent value="basic" className="mt-6">
              <InventoryItemBasicTab form={dialog.form} update={dialog.update} />
            </TabsContent>

            <TabsContent value="pricing" className="mt-6">
              <InventoryItemPricingTab
                form={dialog.form}
                update={dialog.update}
                costPerUnit={dialog.costPerUnit}
                totalRetailValue={dialog.totalRetailValue}
              />
            </TabsContent>

            <TabsContent value="inventory" className="mt-6">
              <InventoryItemStockTab form={dialog.form} update={dialog.update} />
            </TabsContent>

            <TabsContent value="details" className="mt-6">
              <InventoryItemDetailsTab form={dialog.form} update={dialog.update} />
            </TabsContent>

            <TabsContent value="tax" className="mt-6">
              <InventoryItemTaxTab form={dialog.form} update={dialog.update} />
            </TabsContent>

            <TabsContent value="additional" className="mt-6">
              <InventoryItemAdditionalTab form={dialog.form} update={dialog.update} />
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
                disabled={!dialog.canGoPrevious}
                onClick={dialog.goPrevious}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!dialog.canGoNext}
                onClick={dialog.goNext}
              >
                Next
              </Button>
              <Button type="submit" disabled={dialog.saving} className="gap-2">
                {dialog.saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {item ? "Save Item" : "Add Item"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}