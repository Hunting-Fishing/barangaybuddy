import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import {
  createJobPrepayCheckout,
  createRiderSubscriptionCheckout,
} from "@/lib/delivery.functions";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
} & ({ mode: "rider" } | { mode: "job"; jobId: string; amountLabel: string });

export function DeliveryCheckoutDialog(props: Props) {
  const { open, onOpenChange } = props;

  const fetchClientSecret = async (): Promise<string> => {
    const returnUrl = `${window.location.origin}${window.location.pathname}?paid=1&session_id={CHECKOUT_SESSION_ID}`;
    const environment = getStripeEnvironment();
    const result =
      props.mode === "rider"
        ? await createRiderSubscriptionCheckout({ data: { returnUrl, environment } })
        : await createJobPrepayCheckout({ data: { jobId: props.jobId, returnUrl, environment } });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Payment could not be started. Please try again.");
    return result.clientSecret;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[2100] max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {props.mode === "rider" ? "Rider membership" : "Pay for this delivery"}
          </DialogTitle>
          <DialogDescription>
            {props.mode === "rider"
              ? "₱80 per month — cancel anytime."
              : `${props.amountLabel} — pay now so your rider does not collect cash.`}
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
