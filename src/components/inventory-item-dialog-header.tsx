import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { InventoryItem } from "@/lib/inventory";

type Props = {
  item: InventoryItem | null;
  completedSections: number;
};

export function InventoryItemDialogHeader({ item, completedSections }: Props) {
  return (
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
  );
}
