import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function JeepneyDeviceRequestDialog({ operatorId }: { operatorId: string }) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    const { error } = await supabase.from("jeepney_device_requests").insert({
      operator_id: operatorId,
      quantity: Math.max(1, Math.min(50, Number(quantity) || 1)),
      note: note.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Could not send your request. Please try again.");
      return;
    }
    toast.success("Request received — we'll contact you when trackers are available.");
    setOpen(false);
    setNote("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Request a tracker device
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Always-on GPS tracker</DialogTitle>
          <DialogDescription>
            A small plug-in tracker keeps your jeepney live without leaving your phone open. Join
            the waiting list and we'll confirm price and delivery.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="device-qty">How many jeepneys?</Label>
            <Input
              id="device-qty"
              type="number"
              min={1}
              max={50}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="device-note">Anything we should know?</Label>
            <Textarea
              id="device-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Routes, city, best contact time…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Sending…" : "Join the waiting list"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
