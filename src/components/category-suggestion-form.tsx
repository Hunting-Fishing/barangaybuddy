import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Lightbulb, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitCategorySuggestion } from "@/lib/category-analytics.functions";

type Props = {
  groupId: string;
  groupLabel: string;
  onSubmitted: () => void;
};

export function CategorySuggestionForm({
  groupId,
  groupLabel,
  onSubmitted,
}: Props) {
  const submitSuggestion = useServerFn(submitCategorySuggestion);
  const [suggestion, setSuggestion] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (suggestion.trim().length < 2) {
      toast.error("Add at least 2 characters.");
      return;
    }

    setSubmitting(true);
    const result = await submitSuggestion({
      data: {
        groupId,
        groupLabel,
        suggestion: suggestion.trim(),
        note: note.trim() || undefined,
      },
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Suggestion saved — thank you!");
    setSuggestion("");
    setNote("");
    onSubmitted();
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Lightbulb className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold">Missing a type?</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Suggest a business type that belongs under {groupLabel}. Repeated suggestions are counted so we know what to add next.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <Label htmlFor="category-suggestion">Suggested type</Label>
          <Input
            id="category-suggestion"
            value={suggestion}
            onChange={(event) => setSuggestion(event.target.value)}
            placeholder="e.g. Pet groomer, rice mill, event stylist…"
            maxLength={80}
          />
        </div>
        <div>
          <Label htmlFor="category-suggestion-note">Extra note optional</Label>
          <Textarea
            id="category-suggestion-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Tell us where this should appear or what customers would search for."
            rows={3}
            maxLength={500}
          />
        </div>
        <Button type="submit" disabled={submitting} className="w-full gap-2">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Save suggestion
        </Button>
      </form>
    </Card>
  );
}