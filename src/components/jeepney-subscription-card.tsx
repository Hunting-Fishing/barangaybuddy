import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { JeepneyCheckoutDialog } from "@/components/jeepney-checkout-dialog";
import { recordJeepneyManualPayment } from "@/lib/jeepney.functions";
import { paymentsConfigured } from "@/lib/stripe";

export type SubscriptionRow = {
  id: string;
  route_id: string | null;
  status: "trialing" | "active" | "past_due" | "cancelled";
  current_period_end: string | null;
  payment_ref: string | null;
};

export function JeepneySubscriptionCard({
  routeId,
  routeName,
  routeStatus,
  subscription,
  onChanged,
}: {
  routeId: string;
  routeName: string;
  routeStatus: string;
  subscription: SubscriptionRow | null;
  onChanged: () => void;
}) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const active = subscription?.status === "active" || subscription?.status === "trialing";

  async function submitManual() {
    setSaving(true);
    const result = await recordJeepneyManualPayment({ data: { routeId, reference } });
    setSaving(false);
    if ((result as any)?.error) {
      toast.error((result as any).error);
      return;
    }
    toast.success("Reference received — we'll publish your route once payment clears.");
    setReference("");
    setShowManual(false);
    onChanged();
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Route listing — ₱100 / month</p>
          <p className="text-xs text-muted-foreground">
            Keeps {routeName} on the public map with schedule and live tracking.
          </p>
        </div>
        <Badge variant={active ? "default" : "secondary"}>
          {active ? "Active" : subscription?.status === "past_due" ? "Awaiting payment" : "Not listed"}
        </Badge>
      </div>

      {subscription?.current_period_end && active && (
        <p className="text-xs text-muted-foreground">
          Renews {new Date(subscription.current_period_end).toLocaleDateString()}
        </p>
      )}
      {!active && routeStatus === "pending" && (
        <p className="text-xs text-amber-600">
          Payment reference received — your route goes live once it is confirmed.
        </p>
      )}

      {!active && (
        <div className="flex flex-wrap gap-2">
          {paymentsConfigured() && (
            <Button size="sm" onClick={() => setCheckoutOpen(true)}>
              Pay ₱100 / month
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowManual((v) => !v)}>
            GCash / Maya / bank transfer
          </Button>
        </div>
      )}

      {showManual && !active && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <Label htmlFor={`ref-${routeId}`}>Payment reference number</Label>
          <Input
            id={`ref-${routeId}`}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. GCash ref 1234 5678 90"
          />
          <Button size="sm" onClick={submitManual} disabled={saving || reference.trim().length < 4}>
            {saving ? "Sending…" : "Submit reference"}
          </Button>
        </div>
      )}

      <JeepneyCheckoutDialog
        open={checkoutOpen}
        onOpenChange={(v) => {
          setCheckoutOpen(v);
          if (!v) onChanged();
        }}
        routeId={routeId}
        routeName={routeName}
      />
    </Card>
  );
}
