import { PAYMENT_METHOD_LABEL, readPaymentMethods } from "@/lib/group-application";

/** Shows a group's manual payment options (GCash / Maya / bank / cash). */
export function GroupPaymentCard({
  group,
}: {
  group: { payment_methods?: unknown; payment_instructions?: string | null };
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
      {methods.map((method, index) => (
        <div
          key={index}
          className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-3 text-sm"
        >
          {"qr_url" in method && method.qr_url ? (
            <img
              src={method.qr_url}
              alt={`${PAYMENT_METHOD_LABEL[method.kind]} QR code`}
              className="h-16 w-16 rounded-md border border-border object-cover"
            />
          ) : null}
          <div className="min-w-0">
            <div className="font-semibold">{PAYMENT_METHOD_LABEL[method.kind]}</div>
            {(method.kind === "gcash" || method.kind === "maya") && (
              <div className="text-muted-foreground">
                {method.number}
                {method.account_name ? ` · ${method.account_name}` : ""}
              </div>
            )}
            {method.kind === "bank" && (
              <div className="text-muted-foreground">
                {method.bank_name} · {method.account_number}
                {method.account_name ? ` · ${method.account_name}` : ""}
              </div>
            )}
            {method.kind === "cash" && (
              <div className="text-muted-foreground">{method.account_name || "Pay in person"}</div>
            )}
            {method.kind === "other" && (
              <div className="whitespace-pre-wrap text-muted-foreground">
                {method.label ? `${method.label} — ` : ""}
                {method.details}
              </div>
            )}
          </div>
        </div>
      ))}
      {group.payment_instructions ? (
        <p className="whitespace-pre-wrap text-xs text-muted-foreground">
          {group.payment_instructions}
        </p>
      ) : null}
    </div>
  );
}
