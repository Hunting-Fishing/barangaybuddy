import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { InventoryDialogField } from "@/components/inventory-dialog-field";
import type { InventoryFormState } from "@/lib/inventory";
import type { InventoryFormUpdate } from "@/hooks/use-inventory-item-dialog";

type Props = {
  form: InventoryFormState;
  update: InventoryFormUpdate;
};

export function InventoryItemAdditionalTab({ form, update }: Props) {
  const updateLink = (index: number, key: "type" | "label" | "url", value: string) => {
    const next = [...form.links];
    next[index] = { ...next[index], [key]: value };
    update("links", next);
  };

  const addLink = () => {
    update("links", [...form.links, { type: "supplier", label: "", url: "" }]);
  };

  const removeLink = (index: number) => {
    update(
      "links",
      form.links.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  return (
    <div className="rounded-xl border border-border p-5">
      <h3 className="font-display text-xl font-bold">Additional Information</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <InventoryDialogField label="Date Last Ordered">
          <Input
            type="date"
            value={form.date_last_ordered}
            onChange={(event) => update("date_last_ordered", event.target.value)}
          />
        </InventoryDialogField>
        <InventoryDialogField label="Date Last Used">
          <Input
            type="date"
            value={form.date_last_used}
            onChange={(event) => update("date_last_used", event.target.value)}
          />
        </InventoryDialogField>
        <InventoryDialogField label="Image URL" className="md:col-span-2">
          <Input
            value={form.image_url}
            onChange={(event) => update("image_url", event.target.value)}
            placeholder="https://..."
          />
        </InventoryDialogField>

        <div className="md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium">Related links</div>
              <p className="text-xs text-muted-foreground">
                Save supplier pages, manuals, warranty pages, reorder links, or product references.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addLink}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add link
            </Button>
          </div>

          {form.links.length === 0 ? (
            <div className="mt-2 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
              No related links added.
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              {form.links.map((link, index) => (
                <div
                  key={index}
                  className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-[140px_1fr_1.5fr_auto]"
                >
                  <Input
                    value={link.type}
                    onChange={(event) => updateLink(index, "type", event.target.value)}
                    placeholder="supplier"
                  />
                  <Input
                    value={link.label}
                    onChange={(event) => updateLink(index, "label", event.target.value)}
                    placeholder="Link label"
                  />
                  <Input
                    value={link.url}
                    onChange={(event) => updateLink(index, "url", event.target.value)}
                    placeholder="https://..."
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLink(index)}
                    className="text-destructive"
                    aria-label="Remove link"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <InventoryDialogField
          label="Notes"
          help="Internal notes about this inventory item"
          className="md:col-span-2"
        >
          <Textarea
            value={form.notes}
            onChange={(event) => update("notes", event.target.value)}
            rows={4}
          />
        </InventoryDialogField>
        <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm md:col-span-2">
          <Checkbox
            checked={form.publish_to_store}
            onCheckedChange={(value) => update("publish_to_store", value === true)}
          />
          Publish this item as a public store listing
        </label>
      </div>
    </div>
  );
}
