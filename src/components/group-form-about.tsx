import { useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { uploadGroupImage, type GroupApplicationForm } from "@/lib/group-application";
import { ImagePlus, Loader2, Trophy } from "lucide-react";

type Props = {
  form: GroupApplicationForm;
  update: <K extends keyof GroupApplicationForm>(key: K, value: GroupApplicationForm[K]) => void;
};

export function GroupFormAbout({ form, update }: Props) {
  const { user } = useAuth();
  const logoInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);

  async function pick(kind: "logo" | "cover", file?: File | null) {
    if (!file) return;
    if (!user) return toast.error("Sign in to upload images.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be smaller than 5 MB.");
    setUploading(kind);
    try {
      const url = await uploadGroupImage(file, user.id, kind);
      update(kind === "logo" ? "logo_url" : "cover_image_url", url);
    } catch (error) {
      toast.error((error as Error).message ?? "Upload failed.");
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
        <div className="space-y-2">
          <Label>Logo</Label>
          <button
            type="button"
            onClick={() => logoInput.current?.click()}
            className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/40 transition-colors hover:border-primary"
          >
            {uploading === "logo" ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : form.logo_url ? (
              <img src={form.logo_url} alt="Group logo" className="h-full w-full object-cover" />
            ) : (
              <Trophy className="h-6 w-6 text-muted-foreground" />
            )}
          </button>
          <input
            ref={logoInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pick("logo", e.target.files?.[0])}
          />
        </div>

        <div className="space-y-2">
          <Label>Cover photo</Label>
          <button
            type="button"
            onClick={() => coverInput.current?.click()}
            className="flex h-24 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/40 text-sm text-muted-foreground transition-colors hover:border-primary"
          >
            {uploading === "cover" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : form.cover_image_url ? (
              <img
                src={form.cover_image_url}
                alt="Group cover"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex items-center gap-2">
                <ImagePlus className="h-4 w-4" /> Add a cover photo
              </span>
            )}
          </button>
          <input
            ref={coverInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pick("cover", e.target.files?.[0])}
          />
          {(form.logo_url || form.cover_image_url) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                update("logo_url", null);
                update("cover_image_url", null);
              }}
            >
              Clear images
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="group-name">Group name *</Label>
          <Input
            id="group-name"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="e.g. Cebu City Darts Club"
            maxLength={80}
          />
        </div>
        <div>
          <Label htmlFor="group-type">Group type *</Label>
          <Select value={form.type} onValueChange={(v) => update("type", v as typeof form.type)}>
            <SelectTrigger id="group-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="league">League — competitive, with fixtures</SelectItem>
              <SelectItem value="club">Club — regular meet-ups</SelectItem>
              <SelectItem value="interest_group">Interest group — casual community</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="group-tagline">Tagline</Label>
        <Input
          id="group-tagline"
          value={form.tagline}
          onChange={(e) => update("tagline", e.target.value)}
          placeholder="One line members will see on the directory card"
          maxLength={120}
        />
      </div>

      <div>
        <Label htmlFor="group-desc">Description *</Label>
        <Textarea
          id="group-desc"
          rows={5}
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="What your group does, where you play or meet, who can join, and what a new member can expect."
          maxLength={2000}
        />
        <p className="mt-1 text-right text-xs text-muted-foreground">
          {form.description.length}/2000
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="group-city">City / municipality *</Label>
          <Input
            id="group-city"
            value={form.city}
            onChange={(e) => update("city", e.target.value)}
            placeholder="e.g. Dumaguete City"
          />
        </div>
        <div>
          <Label htmlFor="group-brgy">Barangay</Label>
          <Input
            id="group-brgy"
            value={form.barangay}
            onChange={(e) => update("barangay", e.target.value)}
            placeholder="e.g. Barangay Daro"
          />
        </div>
      </div>
    </div>
  );
}
