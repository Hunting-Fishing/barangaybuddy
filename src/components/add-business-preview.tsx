import { CheckCircle2, MapPin, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { BUSINESS_TYPE_LABEL } from "@/lib/business-types";
import { tagLabel } from "@/lib/business-tags";
import type { AddBusinessFormState } from "@/lib/add-business-form";

type Props = {
  form: AddBusinessFormState;
};

export function AddBusinessPreview({ form }: Props) {
  const categories = [
    BUSINESS_TYPE_LABEL[form.type],
    ...form.additional_types.map((type) => BUSINESS_TYPE_LABEL[type]),
    ...form.custom_types,
  ];

  return (
    <aside className="lg:sticky lg:top-24">
      <Card className="overflow-hidden">
        <div className="aspect-video bg-gradient-to-br from-secondary to-muted">
          {form.cover_image_url ? (
            <img src={form.cover_image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Sparkles className="h-8 w-8" />
            </div>
          )}
        </div>

        <div className="p-5">
          <div className="flex flex-wrap gap-1.5">
            {categories.slice(0, 4).map((category) => (
              <Badge key={category} variant="secondary">
                {category}
              </Badge>
            ))}
            {categories.length > 4 && <Badge variant="outline">+{categories.length - 4}</Badge>}
          </div>

          <h2 className="mt-3 font-display text-2xl font-bold">
            {form.name || "Your business name"}
          </h2>

          {form.barangay_label ? (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              {form.barangay_label}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Choose a barangay to place this business in the directory.
            </p>
          )}

          {form.description && (
            <p className="mt-3 line-clamp-4 text-sm text-muted-foreground">{form.description}</p>
          )}

          {form.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1">
              {form.tags.slice(0, 8).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground"
                >
                  {tagLabel(tag)}
                </span>
              ))}
              {form.tags.length > 8 && (
                <span className="text-[10px] text-muted-foreground">
                  +{form.tags.length - 8} more
                </span>
              )}
            </div>
          )}

          <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-primary">
              <CheckCircle2 className="h-4 w-4" />
              Published as claimed
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              After saving, this business is yours and you can add listings, prices, services, and
              images.
            </p>
          </div>
        </div>
      </Card>
    </aside>
  );
}
