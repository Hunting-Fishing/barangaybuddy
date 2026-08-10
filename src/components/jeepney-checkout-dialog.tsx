import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createJeepneyCheckout } from "@/lib/jeepney.functions";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";

export function JeepneyCheckoutDialog({
  open,
  onOpenChange,
  routeId,
  routeName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  routeId: string;
  routeName: string;
}) {
  const fetchClientSecret = async (): Promise<string> => {
    const returnUrl = `${window.location.origin}${window.location.pathname}?paid=1&session_id={CHECKOUT_SESSION_ID}`;
    const result = await createJeepneyCheckout({
      data: { routeId, returnUrl, environment: getStripeEnvironment() },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Payment could not be started. Please try again.");
    return result.clientSecret;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Jeepney route listing</DialogTitle>
          <DialogDescription>{routeName} — ₱100 per month, cancel anytime.</DialogDescription>
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
