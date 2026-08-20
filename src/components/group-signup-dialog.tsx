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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import type { GroupRow, MembershipRow } from "@/lib/groups";
import { formatPhp } from "@/lib/groups";
import { CheckCircle2, CreditCard, Loader2, Wallet } from "lucide-react";
import { LeagueCheckoutDialog } from "@/components/league-checkout-dialog";
import { GroupPaymentCard } from "@/components/group-payment-card";
import { paymentsConfigured } from "@/lib/stripe";

const METHODS = [
  { id: "gcash", label: "GCash" },
  { id: "maya", label: "Maya" },
  { id: "bank", label: "Bank transfer" },
] as const;

export function GroupSignupDialog({
  group,
  existing,
  onJoined,
  triggerLabel,
  defaultTab = "supporter",
}: {
  group: GroupRow;
  existing: MembershipRow | null;
  onJoined: (membership: MembershipRow) => void;
  triggerLabel?: string;
  defaultTab?: "supporter" | "player";
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"supporter" | "player">(defaultTab);
  const [method, setMethod] = useState<string>("gcash");
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  async function upsertMembership(payload: Record<string, unknown>) {
    const { data, error } = await (supabase as any)
      .from("group_memberships")
      .upsert(payload, { onConflict: "group_id,user_id" })
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Could not save your signup.");
    return data as MembershipRow;
  }

  async function joinFree() {
    if (!user) return toast.error("Sign in first.");
    setSubmitting(true);
    try {
      const m = await upsertMembership({
        group_id: group.id,
        user_id: user.id,
        role: "member",
        tier: "supporter",
        status: "active",
        amount_paid_php: 0,
        started_at: new Date().toISOString(),
        expires_at: null,
      });
      onJoined(m);
      setOpen(false);
      toast.success("You're in as a free supporter. Upgrade any time to play.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPlayer() {
    if (!user) return toast.error("Sign in first.");
    if (!ref.trim()) return toast.error("Enter your payment reference number.");
    setSubmitting(true);
    try {
      const m = await upsertMembership({
        group_id: group.id,
        user_id: user.id,
        role: "member",
        tier: "player",
        status: "pending",
        payment_ref: `${method.toUpperCase()} ${ref.trim()}`,
        payment_note: note.trim() || null,
        amount_paid_php: group.membership_fee_php,
        started_at: null,
        expires_at: null,
      });
      onJoined(m);
      setOpen(false);
      toast.success("Payment submitted. A league admin will verify and activate your player slot.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const label =
    triggerLabel ??
    (existing?.tier === "supporter"
      ? `Upgrade to player — ${formatPhp(group.membership_fee_php)}/yr`
      : existing?.status === "pending"
        ? "Update payment reference"
        : "Sign up for the league");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full bg-gradient-sun text-sun-foreground hover:opacity-95">
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Join {group.name}</DialogTitle>
          <DialogDescription>
            Follow the league for free, or register as a player to compete.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "supporter" | "player")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="supporter">Free supporter</TabsTrigger>
            <TabsTrigger value="player">
              Player · {formatPhp(group.membership_fee_php)}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="supporter" className="mt-4 space-y-3">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <Perk yes>Follow schedules, results and league news</Perk>
              <Perk yes>See venues, teams and rosters</Perk>
              <Perk yes>Member venue promos when announced publicly</Perk>
              <Perk>Cannot play in tournaments or join a team roster</Perk>
            </ul>
            <Button className="w-full" onClick={joinFree} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Join free as supporter
            </Button>
          </TabsContent>

          <TabsContent value="player" className="mt-4 space-y-3">
            {paymentsConfigured() && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Pay online — instant activation
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Card, e-wallet and other methods enabled on our payment account. Your player slot
                  activates automatically once payment clears — no admin wait.
                </p>
                <Button
                  className="mt-2 w-full"
                  onClick={() => {
                    if (!user) return toast.error("Sign in first.");
                    setOpen(false);
                    setPayOpen(true);
                  }}
                >
                  Pay {formatPhp(group.membership_fee_php)} now
                </Button>
              </div>
            )}

            <div className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Or pay manually (GCash / Maya / bank)
            </div>

            <GroupPaymentCard group={group} amountPhp={group.membership_fee_php} />

            <div>
              <Label>Payment method</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      method === m.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="ref">Payment reference number</Label>
              <Input
                id="ref"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="e.g. 1234567890"
              />
            </div>
            <div>
              <Label htmlFor="note">Note to league admin (optional)</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Team name, barangay, anything the admin should know"
              />
            </div>
            <Badge variant="secondary" className="font-normal">
              Verified within 24 hours by a league admin
            </Badge>
            <Button className="w-full" onClick={submitPlayer} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit player registration
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
      <LeagueCheckoutDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        groupId={group.id}
        groupName={group.name}
        feePhp={group.membership_fee_php}
        seats={1}
      />
    </Dialog>
  );
}

function Perk({ children, yes }: { children: React.ReactNode; yes?: boolean }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2
        className={`mt-0.5 h-4 w-4 flex-shrink-0 ${yes ? "text-emerald-600" : "text-muted-foreground/40"}`}
      />
      {children}
    </li>
  );
}
