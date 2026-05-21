import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FeatureTagsPicker } from "@/components/feature-tags-picker";
import { BUSINESS_TYPES, BUSINESS_TYPE_LABEL, type BusinessType } from "@/lib/business-types";
import { toast } from "sonner";
import {
  Sparkles, Loader2, MapPin,
  MapPin as GoogleIcon, Facebook, Instagram, Twitter, Music2, Linkedin, Youtube, Star, Globe,
} from "lucide-react";

type PlatformKey = "google" | "facebook" | "instagram" | "twitter" | "tiktok" | "linkedin" | "youtube" | "yelp" | "website";
const PLATFORMS: { key: PlatformKey; label: string; icon: React.ComponentType<{ className?: string }>; placeholder: string; color: string }[] = [
  { key: "google",    label: "Google Maps", icon: GoogleIcon, placeholder: "https://maps.app.goo.gl/…",     color: "text-[#4285F4]" },
  { key: "facebook",  label: "Facebook",    icon: Facebook,   placeholder: "https://facebook.com/your-page", color: "text-[#1877F2]" },
  { key: "instagram", label: "Instagram",   icon: Instagram,  placeholder: "https://instagram.com/handle",   color: "text-[#E4405F]" },
  { key: "twitter",   label: "X / Twitter", icon: Twitter,    placeholder: "https://x.com/handle",           color: "text-foreground" },
  { key: "tiktok",    label: "TikTok",      icon: Music2,     placeholder: "https://tiktok.com/@handle",     color: "text-foreground" },
  { key: "linkedin",  label: "LinkedIn",    icon: Linkedin,   placeholder: "https://linkedin.com/company/…", color: "text-[#0A66C2]" },
  { key: "youtube",   label: "YouTube",     icon: Youtube,    placeholder: "https://youtube.com/@channel",   color: "text-[#FF0000]" },
  { key: "yelp",      label: "Yelp",        icon: Star,       placeholder: "https://yelp.com/biz/your-business", color: "text-[#D32323]" },
  { key: "website",   label: "Website",     icon: Globe,      placeholder: "https://your-business.com",      color: "text-muted-foreground" },
];
import { previewImport, commitImport, commitImportAsMine } from "@/lib/imports.functions";

type Extracted = {
  name: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  hours: string | null;
  type: BusinessType;
  additional_types: BusinessType[];
  custom_types: string[];
  tags: { slug: string; label: string }[];
  barangay_code: string | null;
  cover_image_url: string | null;
};

export function BusinessImportDialog({ trigger }: { trigger?: React.ReactNode }) {
  const { user } = useAuth();
  const preview = useServerFn(previewImport);
  const commit = useServerFn(commitImport);
  const commitMine = useServerFn(commitImportAsMine);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"input" | "loading" | "review">("input");
  const [urls, setUrls] = useState("");
  const [hint, setHint] = useState("");
  const [importId, setImportId] = useState<string | null>(null);
  const [data, setData] = useState<Extracted | null>(null);
  const [brgySearch, setBrgySearch] = useState("");
  const [brgyResults, setBrgyResults] = useState<{ code: string; name: string; cities_municipalities: { name: string } | null }[]>([]);
  const [brgyLabel, setBrgyLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setStep("input");
  const [links, setLinks] = useState<Record<PlatformKey, string>>(
    () => Object.fromEntries(PLATFORMS.map((p) => [p.key, ""])) as Record<PlatformKey, string>,
  );

  function reset() {
    setStep("input");
    setLinks(Object.fromEntries(PLATFORMS.map((p) => [p.key, ""])) as Record<PlatformKey, string>);
    setHint("");
    setImportId(null);
    setData(null);
    setBrgySearch("");
    setBrgyResults([]);
    setBrgyLabel("");
  }
    setBrgyResults([]);
    setBrgyLabel("");
  }

  async function onPreview(e: React.FormEvent) {
    e.preventDefault();
    const urlList = urls
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (urlList.length === 0) {
      toast.error("Paste at least one link.");
      return;
    }
    if (urlList.length > 6) {
      toast.error("Up to 6 links at a time, please.");
      return;
    }
    setStep("loading");
    try {
      const res = await preview({ data: { urls: urlList, hint: hint.trim() || undefined } });
      if (!res.ok) {
        toast.error(res.error);
        if ("duplicateSlug" in res && res.duplicateSlug) {
          toast.info("Already on BarangayHub — opening it now.");
        }
        setStep("input");
        return;
      }
      setImportId(res.importId);
      const e = res.extracted;
      setData({
        name: e.name,
        description: e.description,
        address: e.address,
        latitude: e.latitude,
        longitude: e.longitude,
        phone: e.phone,
        email: e.email,
        website: e.website,
        hours: e.hours,
        type: (BUSINESS_TYPES as readonly string[]).includes(e.type) ? (e.type as BusinessType) : "store",
        additional_types: e.additional_types.filter((t): t is BusinessType => (BUSINESS_TYPES as readonly string[]).includes(t)),
        custom_types: e.custom_types,
        tags: e.tags,
        barangay_code: e.barangay_code,
        cover_image_url: e.cover_image_url,
      });
      // If barangay was auto-resolved, look up the label
      if (e.barangay_code) {
        const { data: b } = await supabase
          .from("barangays")
          .select("name, cities_municipalities(name)")
          .eq("code", e.barangay_code)
          .maybeSingle();
        if (b) setBrgyLabel(`${b.name}, ${(b as { cities_municipalities?: { name?: string } | null }).cities_municipalities?.name ?? ""}`);
      }
      setStep("review");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
      setStep("input");
    }
  }

  // barangay search
  useEffect(() => {
    if (brgySearch.length < 2) {
      setBrgyResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("barangays")
        .select("code, name, cities_municipalities(name)")
        .ilike("name", `%${brgySearch}%`)
        .limit(10);
      setBrgyResults((data ?? []) as never);
    }, 200);
    return () => clearTimeout(t);
  }, [brgySearch]);

  async function publish(mode: "unclaimed" | "mine") {
    if (!data || !importId) return;
    if (!data.barangay_code) {
      toast.error("Pick a barangay first.");
      return;
    }
    setSubmitting(true);
    try {
      const overrides = {
        name: data.name,
        description: data.description,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        contact_phone: data.phone,
        contact_email: data.email,
        website: data.website,
        hours: data.hours,
        type: data.type,
        additional_types: data.additional_types,
        custom_types: data.custom_types,
        tags: data.tags.map((t) => t.slug),
        barangay_code: data.barangay_code,
        cover_image_url: data.cover_image_url,
      };
      const res =
        mode === "mine"
          ? await commitMine({ data: { importId, overrides } })
          : await commit({ data: { importId, publish: "unclaimed", overrides } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(mode === "mine" ? "Business published — it's yours!" : "Listing published as unclaimed.");
      setOpen(false);
      reset();
      window.location.href = `/business/${res.slug}`;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2">
            <Sparkles className="h-4 w-4" /> Import from Google or Facebook
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Smart business import</DialogTitle>
          <DialogDescription>
            Paste a Google Maps or Facebook Page link. AI fills in the details — you review and publish.
          </DialogDescription>
        </DialogHeader>

        {step === "input" && (
          <form onSubmit={onPreview} className="grid gap-3">
            <div>
              <Label className="flex items-center gap-1.5">
                <LinkIcon className="h-3.5 w-3.5" /> Links <span className="text-xs font-normal text-muted-foreground">— paste one per line, up to 6</span>
              </Label>
              <Textarea
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                placeholder={"https://maps.app.goo.gl/...\nhttps://facebook.com/your-page\nhttps://instagram.com/your-handle\nhttps://x.com/your-handle\nhttps://tiktok.com/@your-handle"}
                rows={5}
                required
                autoFocus
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Supports Google Maps, Facebook, Instagram, X/Twitter, TikTok, LinkedIn, YouTube, and most websites. AI merges everything into one listing.
              </p>
            </div>
            <div>
              <Label>Hint (optional)</Label>
              <Textarea
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder="e.g. They sell halo-halo and lechon, also a sari-sari store at the same location"
                rows={2}
              />
            </div>
            <Button type="submit" className="gap-2">
              <Sparkles className="h-4 w-4" /> Read with AI
            </Button>
            <p className="text-xs text-muted-foreground">
              Anyone can submit. Logged-out submissions become <strong>unclaimed listings</strong> the real owner can claim later.
            </p>
          </form>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Fetching → reading → matching to a barangay…</p>
          </div>
        )}

        {step === "review" && data && (
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Name</Label>
                <Input value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} />
              </div>
              <div>
                <Label>Primary type</Label>
                <Select value={data.type} onValueChange={(v) => setData({ ...data, type: v as BusinessType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{BUSINESS_TYPE_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={data.phone ?? ""} onChange={(e) => setData({ ...data, phone: e.target.value || null })} />
              </div>
              <div className="md:col-span-2">
                <Label>Address</Label>
                <Input value={data.address ?? ""} onChange={(e) => setData({ ...data, address: e.target.value || null })} />
              </div>

              <div className="md:col-span-2">
                <Label>Additional categories</Label>
                <div className="mt-2 grid max-h-40 grid-cols-2 gap-1.5 overflow-auto rounded-md border border-border p-3 md:grid-cols-3">
                  {BUSINESS_TYPES.filter((t) => t !== data.type).map((t) => {
                    const checked = data.additional_types.includes(t);
                    return (
                      <label key={t} className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) =>
                            setData({
                              ...data,
                              additional_types: c
                                ? [...data.additional_types, t]
                                : data.additional_types.filter((x) => x !== t),
                            })
                          }
                        />
                        {BUSINESS_TYPE_LABEL[t]}
                      </label>
                    );
                  })}
                </div>
              </div>

              {data.custom_types.length > 0 && (
                <div className="md:col-span-2">
                  <Label>AI-detected custom categories</Label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {data.custom_types.map((c) => (
                      <Badge key={c} variant="secondary">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="md:col-span-2">
                <Label>Features & amenities <span className="text-xs text-muted-foreground">— AI pre-selected what it found</span></Label>
                <div className="mt-2">
                  <FeatureTagsPicker
                    value={data.tags.map((t) => t.slug)}
                    onChange={(slugs) =>
                      setData({ ...data, tags: slugs.map((s) => ({ slug: s, label: s })) })
                    }
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={data.description ?? ""}
                  onChange={(e) => setData({ ...data, description: e.target.value || null })}
                  rows={3}
                />
              </div>

              <div className="md:col-span-2">
                <Label className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Barangay {brgyLabel && <span className="text-xs text-muted-foreground">— Selected: {brgyLabel}</span>}
                </Label>
                <Input
                  value={brgySearch}
                  onChange={(e) => setBrgySearch(e.target.value)}
                  placeholder={data.barangay_code ? "Change barangay…" : "Type barangay name…"}
                />
                {brgyResults.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-auto rounded-md border border-border">
                    {brgyResults.map((b) => (
                      <button
                        key={b.code}
                        type="button"
                        onClick={() => {
                          setData({ ...data, barangay_code: b.code });
                          setBrgyLabel(`${b.name}, ${b.cities_municipalities?.name ?? ""}`);
                          setBrgySearch("");
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-secondary"
                      >
                        {b.name} <span className="text-muted-foreground">— {b.cities_municipalities?.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
              <Button variant="ghost" onClick={() => setStep("input")}>Back</Button>
              <Button variant="outline" disabled={submitting} onClick={() => publish("unclaimed")}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish as unclaimed"}
              </Button>
              {user && (
                <Button disabled={submitting} onClick={() => publish("mine")} className="gap-2">
                  <Sparkles className="h-4 w-4" /> Publish as mine
                </Button>
              )}
              {!user && (
                <Link to="/login" className="text-xs text-muted-foreground underline">
                  Sign in to claim it as yours
                </Link>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
