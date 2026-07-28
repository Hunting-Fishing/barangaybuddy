import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BUSINESS_TYPES, BUSINESS_TYPE_LABEL, type BusinessType } from "@/lib/business-types";
import type { AddBusinessFormState } from "@/lib/add-business-form";

type Props = {
  form: AddBusinessFormState;
  update: <K extends keyof AddBusinessFormState>(key: K, value: AddBusinessFormState[K]) => void;
};

export function AddBusinessBasicSection({ form, update }: Props) {
  return (
    <Card className="p-5 md:p-6">
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-primary">Step 1</div>
        <h2 className="font-display text-xl font-bold">Business basics</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Start with the public name and the main kind of business customers should find.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="business-name">Business name</Label>
          <Input
            id="business-name"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="e.g. Aling Nena's Carinderia"
            required
          />
        </div>

        <div>
          <Label>Primary type</Label>
          <Select
            value={form.type}
            onValueChange={(value) => {
              const nextType = value as BusinessType;
              update("type", nextType);
              update(
                "additional_types",
                form.additional_types.filter((type) => type !== nextType),
              );
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {BUSINESS_TYPE_LABEL[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="business-description">Short description</Label>
          <Textarea
            id="business-description"
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="Tell customers what you sell, serve, or offer."
            rows={4}
            maxLength={2000}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Keep it clear and local — products, services, specialties, or landmarks help customers
            decide.
          </p>
        </div>
      </div>
    </Card>
  );
}
