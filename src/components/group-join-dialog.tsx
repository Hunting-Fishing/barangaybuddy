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
import { useAuth } from "@/hooks/use-auth";
import { GroupPaymentCard } from "@/components/group-payment-card";
import type { GroupRow, MembershipRow } from "@/lib/groups";
import { formatPhp } from "@/lib/groups";
import { Loader2 } from "lucide-react";

export function GroupJoinDialog({
  group,
  existing,
  onJoined,
  triggerLabel,
}: {
  group: GroupRow;
  existing: MembershipRow | null;
  onJoined: (membership: MembershipRow) => void;
  triggerLabel?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!user) {
      toast.error("Sign in to join.");
      return;
    }
    setSubmitting(true);
    const paymentRef = ref.trim();
    const payload = {
      group_id: group.id,
      user_id: user.id,
      role: "member",
      status: "pending",
      payment_ref: paymentRef || null,
      payment_note: note.trim() || null,
      amount_paid_php: group.membership_fee_php,
      started_at: null,
      expires_at: null,
    };
    const { data, error } = await (supabase as any)
      .from("group_memberships")
      .upsert(payload, { onConflict: "group_id,user_id" })
      .select("*")
      .single();
    setSubmitting(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not submit membership request.");
      return;
    }
    onJoined(data as MembershipRow);
    setOpen(false);
    toast.success(
      "Request sent. A league admin will activate your membership once your payment is confirmed.",
    );
  }


  const label =
    triggerLabel ??
    (existing?.status === "pending"
      ? "Update payment reference"
      : `Join for ${formatPhp(group.membership_fee_php)}/yr`);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="bg-gradient-sun text-sun-foreground hover:opacity-95">
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Join {group.name}</DialogTitle>
          <DialogDescription>
            {formatPhp(group.membership_fee_php)} for {group.membership_period_days} days of
            member perks.
          </DialogDescription>
        </DialogHeader>

        <GroupPaymentCard group={group} />

        <div className="space-y-3">
          <div>
            <Label htmlFor="ref">Payment reference number</Label>
            <Input
              id="ref"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="e.g. GCash ref 1234567890"
            />
          </div>
          <div>
            <Label htmlFor="note">Note to league admin (optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything the admin should know?"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
