import { ImageIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AddBusinessFormState } from "@/lib/add-business-form";

type Props = {
  form: AddBusinessFormState;
  update: <K extends keyof AddBusinessFormState>(key: K, value: AddBusinessFormState[K]) => void;
};

export function AddBusinessMediaSection({ form, update }: Props) {
  return (
    <Card className="p-5 md:p-6">
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-primary">Step 5</div>
        <h2 className="font-display text-xl font-bold">Photos optional</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste public image links now, or upload better photos later from the business dashboard.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="business-logo">Logo image URL</Label>
          <div className="relative">
            <ImageIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="business-logo"
              value={form.logo_url}
              onChange={(event) => update("logo_url", event.target.value)}
              placeholder="https://..."
              className="pl-9"
              maxLength={500}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="business-cover">Cover photo URL</Label>
          <div className="relative">
            <ImageIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="business-cover"
              value={form.cover_image_url}
              onChange={(event) => update("cover_image_url", event.target.value)}
              placeholder="https://..."
              className="pl-9"
              maxLength={500}
            />
          </div>
        </div>
      </div>

      {(form.logo_url || form.cover_image_url) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {form.logo_url && (
            <div className="overflow-hidden rounded-xl border border-border bg-muted">
              <img
                src={form.logo_url}
                alt="Logo preview"
                className="h-28 w-full object-contain p-3"
              />
            </div>
          )}
          {form.cover_image_url && (
            <div className="overflow-hidden rounded-xl border border-border bg-muted">
              <img
                src={form.cover_image_url}
                alt="Cover preview"
                className="h-28 w-full object-cover"
              />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
