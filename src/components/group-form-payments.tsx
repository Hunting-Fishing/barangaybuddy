import { useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import {
  PAYMENT_METHOD_LABEL,
  uploadGroupImage,
  type GroupApplicationForm,
  type GroupPaymentMethod,
} from "@/lib/group-application";
import { Loader2, Plus, QrCode, Trash2 } from "lucide-react";

type Props = {
  form: GroupApplicationForm;
  update: <K extends keyof GroupApplicationForm>(key: K, value: GroupApplicationForm[K]) => void;
};

function emptyMethod(kind: GroupPaymentMethod["kind"]): GroupPaymentMethod {
  if (kind === "gcash" || kind === "maya")
    return { kind, number: "", account_name: "", qr_url: null };
  if (kind === "bank")
    return { kind, bank_name: "", account_name: "", account_number: "", qr_url: null };
  if (kind === "cash") return { kind, account_name: "" };
  return { kind: "other", label: "", details: "" };
}

export function GroupFormPayments({ form, update }: Props) {
  const { user } = useAuth();
  const [adding, setAdding] = useState<GroupPaymentMethod["kind"]>("gcash");
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const qrInput = useRef<HTMLInputElement>(null);
  const qrTarget = useRef<number | null>(null);

  function setMethod(index: number, patch: Partial<GroupPaymentMethod>) {
    update(
      "payment_methods",
      form.payment_methods.map((m, i) =>
        i === index ? ({ ...m, ...patch } as GroupPaymentMethod) : m,
      ),
    );
  }

  async function uploadQr(file?: File | null) {
    const index = qrTarget.current;
    if (!file || index === null) return;
    if (!user) return toast.error("Sign in to upload a QR code.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be smaller than 5 MB.");
    setUploadingIndex(index);
    try {
      const url = await uploadGroupImage(file, user.id, "qr");
      setMethod(index, { qr_url: url } as Partial<GroupPaymentMethod>);
    } catch (error) {
      toast.error((error as Error).message ?? "Upload failed.");
    } finally {
      setUploadingIndex(null);
      qrTarget.current = null;
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="contact-name">Contact person *</Label>
          <Input
            id="contact-name"
            value={form.contact_name}
            onChange={(e) => update("contact_name", e.target.value)}
            placeholder="e.g. Juan Dela Cruz"
          />
        </div>
        <div>
          <Label htmlFor="contact-phone">Mobile number</Label>
          <Input
            id="contact-phone"
            inputMode="tel"
            value={form.contact_phone}
            onChange={(e) => update("contact_phone", e.target.value)}
            placeholder="09XX XXX XXXX"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Only visible to you and the review team.
          </p>
        </div>
        <div>
          <Label htmlFor="contact-email">Email</Label>
          <Input
            id="contact-email"
            type="email"
            value={form.contact_email}
            onChange={(e) => update("contact_email", e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <Label htmlFor="contact-url">Website or Facebook page</Label>
          <Input
            id="contact-url"
            value={form.contact_url}
            onChange={(e) => update("contact_url", e.target.value)}
            placeholder="https://facebook.com/yourgroup"
          />
        </div>
      </div>

      {form.paid ? (
        <div className="space-y-3">
          <div>
            <Label>How members pay you *</Label>
            <p className="text-xs text-muted-foreground">
              Add the exact GCash, Maya, or bank details members should send payment to. Members
              submit their reference number and you confirm it in your group console.
            </p>
          </div>

          {form.payment_methods.map((method, index) => (
            <Card key={index} className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{PAYMENT_METHOD_LABEL[method.kind]}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    update(
                      "payment_methods",
                      form.payment_methods.filter((_, i) => i !== index),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {(method.kind === "gcash" || method.kind === "maya") && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    inputMode="tel"
                    value={method.number}
                    onChange={(e) => setMethod(index, { number: e.target.value } as never)}
                    placeholder="09XX XXX XXXX"
                  />
                  <Input
                    value={method.account_name}
                    onChange={(e) => setMethod(index, { account_name: e.target.value } as never)}
                    placeholder="Account name (e.g. Juan D.)"
                  />
                </div>
              )}

              {method.kind === "bank" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    value={method.bank_name}
                    onChange={(e) => setMethod(index, { bank_name: e.target.value } as never)}
                    placeholder="Bank (e.g. BPI)"
                  />
                  <Input
                    value={method.account_number}
                    onChange={(e) => setMethod(index, { account_number: e.target.value } as never)}
                    placeholder="Account number"
                  />
                  <Input
                    className="sm:col-span-2"
                    value={method.account_name}
                    onChange={(e) => setMethod(index, { account_name: e.target.value } as never)}
                    placeholder="Account name"
                  />
                </div>
              )}

              {method.kind === "cash" && (
                <Input
                  value={method.account_name}
                  onChange={(e) => setMethod(index, { account_name: e.target.value } as never)}
                  placeholder="Who collects the cash? (e.g. ask for Coach Nel at the venue)"
                />
              )}

              {method.kind === "other" && (
                <div className="grid gap-3">
                  <Input
                    value={method.label}
                    onChange={(e) => setMethod(index, { label: e.target.value } as never)}
                    placeholder="Method name (e.g. Palawan Express)"
                  />
                  <Textarea
                    rows={2}
                    value={method.details}
                    onChange={(e) => setMethod(index, { details: e.target.value } as never)}
                    placeholder="Where and how to send the payment."
                  />
                </div>
              )}

              {method.kind !== "cash" && method.kind !== "other" && (
                <div className="flex items-center gap-3">
                  {method.qr_url ? (
                    <img
                      src={method.qr_url}
                      alt="Payment QR code"
                      className="h-16 w-16 rounded-md border border-border object-cover"
                    />
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      qrTarget.current = index;
                      qrInput.current?.click();
                    }}
                  >
                    {uploadingIndex === index ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <QrCode className="h-4 w-4" />
                    )}
                    {method.qr_url ? "Replace QR code" : "Upload QR code"}
                  </Button>
                </div>
              )}
            </Card>
          ))}

          <input
            ref={qrInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => uploadQr(e.target.files?.[0])}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={adding}
              onValueChange={(v) => setAdding(v as GroupPaymentMethod["kind"])}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PAYMENT_METHOD_LABEL) as GroupPaymentMethod["kind"][]).map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {PAYMENT_METHOD_LABEL[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              onClick={() =>
                update("payment_methods", [...form.payment_methods, emptyMethod(adding)])
              }
            >
              <Plus className="h-4 w-4" /> Add payment method
            </Button>
          </div>

          <div>
            <Label htmlFor="pay-notes">Payment notes (optional)</Label>
            <Textarea
              id="pay-notes"
              rows={3}
              value={form.payment_notes}
              onChange={(e) => update("payment_notes", e.target.value)}
              placeholder="e.g. Send the reference number in the join form. Payments are non-refundable."
            />
          </div>

          <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            Want card, GCash and Maya collected automatically by Barangay Buddy with instant
            member activation? Mention it in your notes — our team can switch your group to
            online checkout after the review.
          </p>
        </div>
      ) : (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Your group is free to join, so no payment details are needed. You can add a fee later
          from your group console.
        </p>
      )}
    </div>
  );
}
