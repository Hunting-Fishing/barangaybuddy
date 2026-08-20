import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PAYMENT_METHOD_LABEL, readPaymentMethods } from "@/lib/group-application";
import { formatPhp } from "@/lib/groups";

function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(`${label} copied`);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Could not copy — long-press to copy manually.");
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 font-mono text-sm hover:bg-muted"
      aria-label={`Copy ${label}`}
    >
      {value}
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </button>
  );
}

/**
 * Shows a group's manual payment options (GCash / Maya / bank / cash) as an
 * actionable card: tap-to-copy numbers, QR codes, and an open-app shortcut.
 */
export function GroupPaymentCard({
  group,
  amountPhp,
}: {
  group: { payment_methods?: unknown; payment_instructions?: string | null; name?: string };
  amountPhp?: number;
}) {
  const methods = readPaymentMethods(group);

  if (methods.length === 0) {
    if (!group.payment_instructions) return null;
    return (
      <div className="whitespace-pre-wrap rounded-lg border border-border bg-muted/50 p-3 text-sm">
        {group.payment_instructions}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {typeof amountPhp === "number" && amountPhp > 0 ? (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Amount to send</span>
          <CopyValue label="Amount" value={String(amountPhp)} />
        </div>
      ) : null}

      {methods.map((method, index) => {
        const wallet = method.kind === "gcash" || method.kind === "maya";
        const qr = "qr_url" in method ? method.qr_url : null;
        return (
          <div key={index} className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
            <div className="flex items-start gap-3">
              {qr ? (
                <a href={qr} target="_blank" rel="noreferrer" className="flex-shrink-0">
                  <img
                    src={qr}
                    alt={`${PAYMENT_METHOD_LABEL[method.kind]} QR code`}
                    className="h-20 w-20 rounded-md border border-border object-cover"
                  />
                </a>
              ) : null}
              <div className="min-w-0 space-y-1.5">
                <div className="font-semibold">{PAYMENT_METHOD_LABEL[method.kind]}</div>

                {wallet && (
                  <div className="space-y-1">
                    <CopyValue
                      label={`${PAYMENT_METHOD_LABEL[method.kind]} number`}
                      value={method.number}
                    />
                    {method.account_name ? (
                      <div className="text-xs text-muted-foreground">
                        Account name: {method.account_name}
                      </div>
                    ) : null}
                  </div>
                )}

                {method.kind === "bank" && (
                  <div className="space-y-1">
                    <div className="text-muted-foreground">{method.bank_name}</div>
                    <CopyValue label="Account number" value={method.account_number} />
                    {method.account_name ? (
                      <div className="text-xs text-muted-foreground">
                        Account name: {method.account_name}
                      </div>
                    ) : null}
                  </div>
                )}

                {method.kind === "cash" && (
                  <div className="text-muted-foreground">
                    {method.account_name || "Pay in person"}
                  </div>
                )}

                {method.kind === "other" && (
                  <div className="whitespace-pre-wrap text-muted-foreground">
                    {method.label ? `${method.label} — ` : ""}
                    {method.details}
                  </div>
                )}
              </div>
            </div>

            {wallet ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <a
                    href={method.kind === "gcash" ? "https://m.gcash.com" : "https://www.maya.ph"}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open {PAYMENT_METHOD_LABEL[method.kind]}
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </a>
                </Button>
                <span className="text-xs text-muted-foreground">
                  Send{" "}
                  {typeof amountPhp === "number" && amountPhp > 0
                    ? formatPhp(amountPhp)
                    : "the fee"}
                  , then paste the reference number below.
                </span>
              </div>
            ) : null}
          </div>
        );
      })}

      {group.payment_instructions ? (
        <p className="whitespace-pre-wrap text-xs text-muted-foreground">
          {group.payment_instructions}
        </p>
      ) : null}
    </div>
  );
}
