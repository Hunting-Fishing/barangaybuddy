import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { slugifyTeam } from "@/lib/groups";
import { Loader2, Plus } from "lucide-react";

type GroupType = "league" | "club" | "interest_group";

export function GroupCreateDialog({ onSubmitted }: { onSubmitted?: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<GroupType>("club");
  const [description, setDescription] = useState("");
  const [fee, setFee] = useState("0");
  const [period, setPeriod] = useState("365");
  const [payment, setPayment] = useState("");

  async function submit() {
    if (!user) {
      toast.error("Sign in to apply for a group listing.");
      return;
    }
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      toast.error("Please enter your group name.");
      return;
    }
    setSubmitting(true);
    const slug = `${slugifyTeam(trimmed)}-${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await (supabase as any).from("groups").insert({
      slug,
      name: trimmed,
      type,
      description: description.trim() || null,
      membership_fee_php: Math.max(0, Number(fee) || 0),
      membership_period_days: Math.max(1, Number(period) || 365),
      payment_instructions: payment.trim() || null,
      is_public: false,
      created_by: user.id,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? "Could not submit your group.");
      return;
    }
    setOpen(false);
    setName("");
    setDescription("");
    setPayment("");
    toast.success(
      "Application sent! Our team will review your group and publish it to the directory.",
    );
    onSubmitted?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Add a group
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add your club or league</DialogTitle>
          <DialogDescription>
            Tell us about your group. We review every application before it goes live on the
            directory.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="group-name">Group name</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cebu City Darts Club"
            />
          </div>

          <div>
            <Label htmlFor="group-type">Group type</Label>
            <Select value={type} onValueChange={(v) => setType(v as GroupType)}>
              <SelectTrigger id="group-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="league">League</SelectItem>
                <SelectItem value="club">Club</SelectItem>
                <SelectItem value="interest_group">Interest group</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="group-desc">Description</Label>
            <Textarea
              id="group-desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What your group does, where you play or meet, and who can join."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="group-fee">Membership fee (₱)</Label>
              <Input
                id="group-fee"
                type="number"
                min={0}
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="group-period">Membership length (days)</Label>
              <Input
                id="group-period"
                type="number"
                min={1}
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="group-pay">Payment instructions (optional)</Label>
            <Textarea
              id="group-pay"
              rows={3}
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
              placeholder="e.g. GCash 09XX XXX XXXX (Juan D.) — send the reference number after paying."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit for review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
