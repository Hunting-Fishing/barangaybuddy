import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createLeagueCheckout } from "@/lib/payments.functions";
import { formatPhp } from "@/lib/groups";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";

export function LeagueCheckoutDialog({
  open,
  onOpenChange,
  groupId,
  groupName,
  feePhp,
  seats,
  teamId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: string;
  groupName: string;
  feePhp: number;
  seats: number;
  teamId?: string | null;
}) {
  const fetchClientSecret = async (): Promise<string> => {
    const returnUrl = `${window.location.origin}${window.location.pathname}?paid=1&session_id={CHECKOUT_SESSION_ID}`;
    const result = await createLeagueCheckout({
      data: {
        groupId,
        seats,
        teamId: teamId ?? null,
        returnUrl,
        environment: getStripeEnvironment(),
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Payment could not be started. Please try again.");
    return result.clientSecret;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pay league membership</DialogTitle>
          <DialogDescription>
            {groupName} — {seats} player{seats > 1 ? "s" : ""} ·{" "}
            {formatPhp(feePhp * seats)} for one year
          </DialogDescription>
        </DialogHeader>
        <PaymentTestModeBanner />
        {open && (
          <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        )}
      </DialogContent>
    </Dialog>
  );
}
