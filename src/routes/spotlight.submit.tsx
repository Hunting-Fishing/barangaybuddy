import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { SpotlightLayout } from "@/components/spotlight-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseClient as any;
import { loadFamily, type ChildProfile } from "@/lib/family";
import { activeCampaign, ageOn, makeSlug, TALENT_CATEGORIES } from "@/lib/spotlight";
type Barangay = { code: string; name: string; cities_municipalities: { name: string } | null };
const blank = {
  actor: "self",
  stage_name: "",
  category: "Singing",
  biography: "",
  birth_date: "",
  contact_email: "",
  contact_phone: "",
  availability: "",
  audition_video_url: "",
  barangay_code: "",
  barangay_label: "",
  terms_accepted: false,
  free_entry_acknowledged: false,
};
export const Route = createFileRoute("/spotlight/submit")({ component: Page });
function Page() {
  const { user, loading } = useAuth(),
    nav = useNavigate();
  const [form, setForm] = useState(blank),
    [children, setChildren] = useState<ChildProfile[]>([]),
    [photo, setPhoto] = useState<File>(),
    [search, setSearch] = useState(""),
    [results, setResults] = useState<Barangay[]>([]),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
    if (user) loadFamily(user.id).then((d) => setChildren(d.children));
  }, [loading, user, nav]);
  const selectedChild = children.find((c) => c.id === form.actor);
  useEffect(() => {
    if (!selectedChild) return;
    setForm((f) => ({
      ...f,
      stage_name: selectedChild.display_name,
      birth_date: selectedChild.birth_date,
      barangay_code: selectedChild.barangay_code,
      barangay_label: "From family profile",
    }));
  }, [selectedChild]);
  useEffect(() => {
    if (search.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(
      () =>
        supabase
          .from("barangays")
          .select("code,name,cities_municipalities(name)")
          .ilike("name", `%${search}%`)
          .limit(8)
          .then(({ data }) => setResults((data ?? []) as Barangay[])),
      250,
    );
    return () => clearTimeout(timer);
  }, [search]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const campaign = await activeCampaign().catch(() => null);
    if (!campaign) return toast.error("No active campaign is accepting auditions.");
    const age = ageOn(form.birth_date);
    if (age < (campaign.min_age ?? 16) || (campaign.max_age !== null && age > campaign.max_age))
      return toast.error(
        `This campaign accepts ages ${campaign.min_age}${campaign.max_age ? `–${campaign.max_age}` : " and older"}.`,
      );
    if (age < 18 && !selectedChild)
      return toast.error("Applicants under 18 must use a linked Barangay Buddy child profile.");
    if (age >= 18 && selectedChild)
      return toast.error("Adult applicants manage their own audition.");
    const parsed = z
      .object({
        stage_name: z.string().trim().min(2).max(80),
        category: z.string().min(2).max(50),
        biography: z.string().trim().min(40).max(2000),
        birth_date: z.string().date(),
        contact_email: z.string().email(),
        contact_phone: z.string().min(7).max(30),
        availability: z.string().min(2).max(500),
        audition_video_url: z
          .string()
          .url()
          .refine(
            (v) => /youtube|youtu\.be|tiktok|facebook|fb\.watch/i.test(v),
            "Use a YouTube, TikTok, or Facebook link.",
          ),
        barangay_code: z.string().min(1),
        terms_accepted: z.literal(true),
        free_entry_acknowledged: z.literal(true),
      })
      .safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSaving(true);
    let media: Blob | File | undefined = photo;
    if (selectedChild?.private_photo_path) {
      const { data, error } = await supabase.storage
        .from("family-private")
        .download(selectedChild.private_photo_path);
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
      media = data;
    }
    if (!media) {
      setSaving(false);
      return toast.error("Add a profile photo.");
    }
    if (media.size > 5242880) {
      setSaving(false);
      return toast.error("Use an image up to 5 MB.");
    }
    const ext =
        selectedChild?.private_photo_path?.split(".").pop() ??
        photo?.name.split(".").pop() ??
        "jpg",
      path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const upload = await supabase.storage
      .from("spotlight-submissions")
      .upload(path, media, { contentType: media.type });
    if (upload.error) {
      setSaving(false);
      return toast.error(upload.error.message);
    }
    const { error } = await supabase.from("spotlight_submissions").insert({
      ...parsed.data,
      campaign_id: campaign.id,
      user_id: selectedChild ? null : user.id,
      child_profile_id: selectedChild?.id ?? null,
      slug: makeSlug(parsed.data.stage_name),
      private_photo_path: path,
      guardian_name: null,
      guardian_relationship: null,
      guardian_email: null,
      guardian_phone: null,
      guardian_consent: false,
    });
    setSaving(false);
    if (error) {
      await supabase.storage.from("spotlight-submissions").remove([path]);
      return toast.error(error.message);
    }
    toast.success("Audition submitted for review!");
    nav({ to: "/spotlight" });
  }
  if (loading || !user)
    return (
      <SpotlightLayout>
        <p className="container mx-auto px-4 py-16">Checking your account…</p>
      </SpotlightLayout>
    );
  return (
    <SpotlightLayout>
      <section className="container mx-auto max-w-3xl px-4 py-12">
        <p className="text-sm font-bold uppercase tracking-wider text-primary">Free audition</p>
        <h1 className="mt-2 font-display text-4xl font-bold">
          Show your barangay what you can do.
        </h1>
        <p className="mt-3 text-muted-foreground">
          Adults submit directly. Applicants under 18 must use a guardian-managed family profile
          with Spotlight permission.
        </p>
        <form
          onSubmit={submit}
          className="mt-8 grid gap-5 rounded-2xl border bg-card p-5 md:grid-cols-2"
        >
          <div className="md:col-span-2">
            <Label>Who is auditioning?</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              value={form.actor}
              onChange={(e) =>
                setForm({
                  ...blank,
                  actor: e.target.value,
                  contact_email: form.contact_email,
                  contact_phone: form.contact_phone,
                })
              }
            >
              <option value="self">Myself (18+)</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name} — managed child profile
                </option>
              ))}
            </select>
            {!children.length && (
              <p className="mt-2 text-xs text-muted-foreground">
                Submitting for a minor?{" "}
                <Link to="/family" className="font-semibold text-primary">
                  Create a family child profile first.
                </Link>
              </p>
            )}
          </div>
          <div>
            <Label>Stage or talent name</Label>
            <Input
              value={form.stage_name}
              disabled={!!selectedChild}
              onChange={(e) => setForm({ ...form, stage_name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>Birth date</Label>
            <Input
              type="date"
              value={form.birth_date}
              disabled={!!selectedChild}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>{selectedChild ? "Guardian contact email" : "Contact email"}</Label>
            <Input
              type="email"
              value={form.contact_email}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>{selectedChild ? "Guardian contact phone" : "Contact phone"}</Label>
            <Input
              value={form.contact_phone}
              onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>Talent category</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {TALENT_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Profile photo</Label>
            {selectedChild ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Using the private family profile photo.
              </p>
            ) : (
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setPhoto(e.target.files?.[0])}
                required
              />
            )}
          </div>
          <div className="md:col-span-2">
            <Label>Barangay {form.barangay_label && `— ${form.barangay_label}`}</Label>
            <Input
              disabled={!!selectedChild}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search barangay…"
            />
            {results.length > 0 && (
              <Card className="mt-2">
                {results.map((b) => (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-secondary"
                    key={b.code}
                    onClick={() => {
                      setForm({
                        ...form,
                        barangay_code: b.code,
                        barangay_label: `${b.name}, ${b.cities_municipalities?.name ?? ""}`,
                      });
                      setSearch("");
                      setResults([]);
                    }}
                  >
                    {b.name} — {b.cities_municipalities?.name}
                  </button>
                ))}
              </Card>
            )}
          </div>
          <div className="md:col-span-2">
            <Label>Biography</Label>
            <Textarea
              rows={5}
              value={form.biography}
              onChange={(e) => setForm({ ...form, biography: e.target.value })}
              required
            />
          </div>
          <div className="md:col-span-2">
            <Label>Availability</Label>
            <Input
              value={form.availability}
              onChange={(e) => setForm({ ...form, availability: e.target.value })}
              required
            />
          </div>
          <div className="md:col-span-2">
            <Label>Audition video link</Label>
            <Input
              type="url"
              value={form.audition_video_url}
              onChange={(e) => setForm({ ...form, audition_video_url: e.target.value })}
              required
            />
          </div>
          <div className="space-y-3 md:col-span-2">
            <Check
              checked={form.free_entry_acknowledged}
              onChange={(v) => setForm({ ...form, free_entry_acknowledged: v })}
              text="I understand this audition is free."
            />
            <Check
              checked={form.terms_accepted}
              onChange={(v) => setForm({ ...form, terms_accepted: v })}
              text="I confirm the information is accurate and consent to review."
            />
          </div>
          <Button disabled={saving} className="md:col-span-2">
            <Upload className="mr-2 h-4 w-4" />
            {saving ? "Submitting…" : "Submit free audition"}
          </Button>
          <p className="flex gap-2 text-xs text-muted-foreground md:col-span-2">
            <ShieldCheck className="h-4 w-4" />
            Minor communication routes only through linked guardians and Barangay Buddy
            administrators.
          </p>
        </form>
      </section>
    </SpotlightLayout>
  );
}
function Check({
  checked,
  onChange,
  text,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  text: string;
}) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <span>{text}</span>
    </label>
  );
}
