import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import type { LatLng } from "@/lib/jeepney";

type Props = {
  anchors: LatLng[];
  onChange: (anchors: LatLng[]) => void;
};

export function JeepneyPointList({ anchors, onChange }: Props) {
  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= anchors.length) return;
    const next = anchors.slice();
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row!);
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <Label>Route points in order</Label>
      {anchors.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No route points yet. Tap the map in “Draw route” mode — each tap becomes a numbered point
          and the line follows the roads between them.
        </p>
      ) : (
        <ol className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
          {anchors.map((p, i) => (
            <li key={`${p.lat}-${p.lng}-${i}`} className="flex items-center gap-2 text-sm">
              <span className="inline-flex h-6 w-8 shrink-0 items-center justify-center rounded bg-muted text-xs font-bold">
                #{i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Move point ${i + 1} up`}
                onClick={() => move(i, -1)}
                disabled={i === 0}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Move point ${i + 1} down`}
                onClick={() => move(i, 1)}
                disabled={i === anchors.length - 1}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Remove point ${i + 1}`}
                onClick={() => onChange(anchors.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
