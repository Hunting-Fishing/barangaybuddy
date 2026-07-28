import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Plus, Search } from "lucide-react";
import {
  FEATURE_TAG_GROUPS,
  tagLabel,
  isPresetTag,
  sanitizeCustomLabel,
  dedupeCaseInsensitive,
} from "@/lib/business-tags";
import { toast } from "sonner";

const MAX_TAGS = 50;

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
};

export function FeatureTagsPicker({ value, onChange }: Props) {
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState("");

  const selected = new Set(value);

  const filteredGroups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return FEATURE_TAG_GROUPS;
    return FEATURE_TAG_GROUPS.map((g) => ({
      ...g,
      tags: g.tags.filter((t) => t.label.toLowerCase().includes(needle)),
    })).filter((g) => g.tags.length > 0);
  }, [q]);

  function toggle(slug: string, on: boolean) {
    if (on) {
      if (value.length >= MAX_TAGS) {
        toast.error(`You can pick up to ${MAX_TAGS} tags.`);
        return;
      }
      onChange(dedupeCaseInsensitive([...value, slug]));
    } else {
      onChange(value.filter((s) => s !== slug));
    }
  }

  function addCustom() {
    const clean = sanitizeCustomLabel(custom);
    if (!clean) {
      toast.error("Use 2–40 letters/numbers (spaces, &, -, ', /, +, . allowed).");
      return;
    }
    if (value.some((v) => v.toLowerCase() === clean.toLowerCase())) {
      toast.error("Already added.");
      setCustom("");
      return;
    }
    if (value.length >= MAX_TAGS) {
      toast.error(`You can pick up to ${MAX_TAGS} tags.`);
      return;
    }
    onChange([...value, clean]);
    setCustom("");
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((slug) => (
            <Badge
              key={slug}
              variant={isPresetTag(slug) ? "secondary" : "default"}
              className="gap-1"
            >
              {tagLabel(slug)}
              {!isPresetTag(slug) && (
                <span className="text-[10px] uppercase opacity-70">custom</span>
              )}
              <button
                type="button"
                onClick={() => onChange(value.filter((s) => s !== slug))}
                className="ml-0.5 hover:text-destructive"
                aria-label={`Remove ${tagLabel(slug)}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search features (billiards, wifi, halal…)"
            className="pl-9"
          />
        </div>
        <div className="text-xs text-muted-foreground self-center">
          {value.length}/{MAX_TAGS} selected
        </div>
      </div>

      <div className="max-h-96 overflow-auto rounded-md border border-border">
        {filteredGroups.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            No matches. Add it as a custom tag below.
          </p>
        )}
        {filteredGroups.map((g) => (
          <div key={g.id} className="border-b border-border last:border-b-0">
            <div className="bg-muted/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {g.label}
            </div>
            <div className="grid grid-cols-2 gap-1.5 p-3 md:grid-cols-3">
              {g.tags.map((tag) => {
                const checked = selected.has(tag.slug);
                return (
                  <label key={tag.slug} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox checked={checked} onCheckedChange={(c) => toggle(tag.slug, !!c)} />
                    <span>{tag.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div>
        <Label className="text-xs">Add a custom feature</Label>
        <div className="mt-1 flex gap-2">
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="e.g. Lechon Friday, Bantay-aso, Solar-powered…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            maxLength={40}
          />
          <Button type="button" variant="outline" onClick={addCustom} className="gap-1">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>
    </div>
  );
}
