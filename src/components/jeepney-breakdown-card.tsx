import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TriangleAlert, Wrench, CheckCircle2 } from "lucide-react";
import type { JeepneyRouteStatus } from "@/lib/jeepney";

const MARKER = "[BREAKDOWN]";

export function stripBreakdownNote(notes: string | null | undefined): string {
  if (!notes) return "";
  return notes
    .split("\n")
    .filter((line) => !line.trim().startsWith(MARKER))
    .join("\n")
    .trim();
}

export function JeepneyBreakdownCard({
  routeId,
  status,
  notes,
  onChanged,
}: {
  routeId: string;
  status: JeepneyRouteStatus;
  notes: string | null;
  onChanged: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const isDown = status === "suspended";
  const activeNote = (notes ?? "")
    .split("\n")
    .find((line) => line.trim().startsWith(MARKER))
    ?.replace(MARKER, "")
    .trim();

  async function reportBreakdown() {
    setSaving(true);
    const clean = stripBreakdownNote(notes);
    const line = `${MARKER} ${reason.trim() || "Jeepney under repair — route paused."}`;
    const { error } = await supabase
      .from("jeepney_routes")
      .update({ status: "suspended", notes: [clean, line].filter(Boolean).join("\n") })
      .eq("id", routeId);
    setSaving(false);
    if (error) {
      toast.error("Could not report the breakdown. Please try again.");
      return;
    }
    setOpen(false);
    setReason("");
    toast.success("Route paused — riders will not see this jeepney until you mark it active.");
    void onChanged();
  }

  async function markActive(replacement: boolean) {
    setSaving(true);
    const { error } = await supabase
      .from("jeepney_routes")
      .update({ status: "published", notes: stripBreakdownNote(notes) || null })
      .eq("id", routeId);
    setSaving(false);
    if (error) {
      toast.error("Could not put the route back in service. Please try again.");
      return;
    }
    toast.success(
      replacement
        ? "Replacement jeepney is now serving this route."
        : "Route is active again — riders can see it on the map.",
    );
    void onChanged();
  }

  if (status !== "published" && status !== "suspended") return null;

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            {isDown ? (
              <Wrench className="h-4 w-4 text-amber-600" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            )}
            {isDown ? "Out of service" : "In service"}
            {isDown && <Badge variant="secondary">paused</Badge>}
          </p>
          <p className="text-xs text-muted-foreground">
            {isDown
              ? activeNote || "Riders are not seeing this route right now."
              : "Report a breakdown to pause this route for riders."}
          </p>
        </div>

        {isDown ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={saving} onClick={() => markActive(false)}>
              Repaired — set active
            </Button>
            <Button size="sm" variant="outline" disabled={saving} onClick={() => markActive(true)}>
              New jeepney taking over
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
            <TriangleAlert className="mr-1.5 h-4 w-4" /> Report breakdown
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="z-[2000]">
          <DialogHeader>
            <DialogTitle>Report a breakdown</DialogTitle>
            <DialogDescription>
              This pauses the route on the rider map. Turn it back on once repaired or when another
              jeepney takes over.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What happened? e.g. Engine trouble, back by tomorrow morning."
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={reportBreakdown} disabled={saving}>
              {saving ? "Saving…" : "Pause route"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
