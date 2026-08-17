import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { FARE_PRESETS, type FareLine } from "@/lib/jeepney";

type Props = {
  fares: FareLine[];
  onChange: (fares: FareLine[]) => void;
};

/** Zone / rate table — one labelled line per fare (Zone 1, Zone 2, Day rental…). */
export function JeepneyFareTable({ fares, onChange }: Props) {
  function update(index: number, patch: Partial<FareLine>) {
    onChange(fares.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function add(label = "") {
    onChange([...fares, { label, amount_php: "", note: "" }]);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {fares.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No fares yet. Add a line for each zone or service — label it however you charge.
          </p>
        )}
        {fares.map((fare, i) => (
          <div key={fare.id ?? `fare-${i}`} className="rounded-md border border-border p-2">
            <div className="grid gap-2 sm:grid-cols-[1fr_7rem_auto]">
              <div className="space-y-1">
                <Label className="text-[11px]" htmlFor={`fare-label-${i}`}>
                  Fare label
                </Label>
                <Input
                  id={`fare-label-${i}`}
                  className="h-8"
                  value={fare.label}
                  onChange={(e) => update(i, { label: e.target.value.slice(0, 60) })}
                  placeholder="Zone 1 (first 4 km)"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]" htmlFor={`fare-amount-${i}`}>
                  Amount (₱)
                </Label>
                <Input
                  id={`fare-amount-${i}`}
                  className="h-8"
                  type="number"
                  min="0"
                  step="0.5"
                  value={fare.amount_php}
                  onChange={(e) => update(i, { amount_php: e.target.value })}
                  placeholder="13"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  aria-label={`Remove fare ${i + 1}`}
                  onClick={() => onChange(fares.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Input
              className="mt-2 h-8 text-xs"
              value={fare.note ?? ""}
              onChange={(e) => update(i, { note: e.target.value.slice(0, 120) })}
              placeholder="Note for riders — students 20% off, minimum 4 hours, etc."
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button type="button" size="sm" variant="outline" onClick={() => add()}>
          <Plus className="mr-1.5 h-4 w-4" /> Add fare line
        </Button>
        {FARE_PRESETS.filter((p) => !fares.some((f) => f.label === p)).map((preset) => (
          <Button
            key={preset}
            type="button"
            size="sm"
            variant="ghost"
            className="text-xs"
            onClick={() => add(preset)}
          >
            + {preset}
          </Button>
        ))}
      </div>
    </div>
  );
}
