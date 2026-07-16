import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

type Props = {
  label: string;
  help?: string;
  children: ReactNode;
  className?: string;
};

export function InventoryDialogField({
  label,
  help,
  children,
  className,
}: Props) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <div className="mt-1.5">{children}</div>
      {help && <p className="mt-1 text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}