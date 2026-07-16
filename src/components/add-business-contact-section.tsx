import { Clock, Globe, Mail, Phone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AddBusinessFormState } from "@/lib/add-business-form";

type Props = {
  form: AddBusinessFormState;
  update: <K extends keyof AddBusinessFormState>(
    key: K,
    value: AddBusinessFormState[K],
  ) => void;
};

export function AddBusinessContactSection({ form, update }: Props) {
  return (
    <Card className="p-5 md:p-6">
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-primary">
          Step 4
        </div>
        <h2 className="font-display text-xl font-bold">Contact & hours</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add ways for customers to call, message, visit, or check if you are open.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="business-phone">Phone / mobile</Label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="business-phone"
              value={form.contact_phone}
              onChange={(event) => update("contact_phone", event.target.value)}
              placeholder="09xx xxx xxxx"
              className="pl-9"
              maxLength={40}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="business-email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="business-email"
              type="email"
              value={form.contact_email}
              onChange={(event) => update("contact_email", event.target.value)}
              placeholder="business@email.com"
              className="pl-9"
              maxLength={120}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="business-website">Website / social link</Label>
          <div className="relative">
            <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="business-website"
              value={form.website}
              onChange={(event) => update("website", event.target.value)}
              placeholder="facebook.com/your-page or yoursite.com"
              className="pl-9"
              maxLength={500}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="business-hours">Opening hours</Label>
          <div className="relative">
            <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="business-hours"
              value={form.hours}
              onChange={(event) => update("hours", event.target.value)}
              placeholder="Mon–Sat 8AM–6PM"
              className="pl-9"
              maxLength={500}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}