import {
  BarChart3,
  Box,
  Calculator,
  DollarSign,
  FileText,
  Info,
} from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { InventoryDialogTab } from "@/hooks/use-inventory-item-dialog";

const TABS: Array<{
  value: InventoryDialogTab;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "basic", label: "Basic Info", Icon: Box },
  { value: "pricing", label: "Pricing", Icon: DollarSign },
  { value: "inventory", label: "Inventory", Icon: BarChart3 },
  { value: "details", label: "Details", Icon: Info },
  { value: "tax", label: "Tax & Fees", Icon: Calculator },
  { value: "additional", label: "Additional", Icon: FileText },
];

export function InventoryItemTabList() {
  return (
    <TabsList className="grid h-auto grid-cols-2 rounded-2xl p-1 md:grid-cols-6">
      {TABS.map(({ value, label, Icon }) => (
        <TabsTrigger
          key={value}
          value={value}
          className="flex flex-col gap-1 rounded-xl py-3 text-xs"
        >
          <Icon className="h-4 w-4" />
          {label}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}