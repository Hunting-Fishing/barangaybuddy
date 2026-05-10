import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Plus, Trash2, Upload, Pencil } from "lucide-react";

export const Route = createFileRoute("/dashboard/business/$id")({
  head: () => ({ meta: [{ title: "Manage business — BarangayHub" }] }),
  component: ManageBusiness,
});

const listingSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().max(2000).optional(),
  price: z.number().nonnegative().optional(),
  unit: z.string().max(40).optional(),
  category: z.string().max(60).optional(),
});

function ManageBusiness() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [biz, setBiz] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "", unit: "", category: "", image_url: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  async function load() {
    const { data: b } = await supabase.from("businesses").select("*").eq("id", id).maybeSingle();
    setBiz(b);
    const { data: l } = await supabase.from("listings").select("*").eq("business_id", id).order("created_at", { ascending: false });
    setListings(l ?? []);
  }
  useEffect(() => { load(); }, [id]);

  async function uploadImage(file: File, folder: string) {
    if (!user) return null;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("business-media").upload(path, file, { upsert: false });
    if (error) { toast.error(error.message); return null; }
    const { data } = supabase.storage.from("business-media").getPublicUrl(path);
    return data.publicUrl;
  }

  async function onBizImage(field: "logo_url" | "cover_image_url", file: File) {
    setBusy(true);
    const url = await uploadImage(file, field);
    if (url) {
      const { error } = await supabase.from("businesses").update({ [field]: url }).eq("id", id);
      if (error) toast.error(error.message); else { toast.success("Updated!"); load(); }
    }
    setBusy(false);
  }

  function resetForm() {
    setEditing(null);
    setForm({ name: "", description: "", price: "", unit: "", category: "", image_url: "" });
  }

  function startEdit(l: any) {
    setEditing(l);
    setForm({
      name: l.name, description: l.description ?? "", price: l.price?.toString() ?? "",
      unit: l.unit ?? "", category: l.category ?? "", image_url: l.image_url ?? "",
    });
  }

  async function saveListing(e: React.FormEvent) {
    e.preventDefault();
    const parsed = listingSchema.safeParse({
      name: form.name,
      description: form.description || undefined,
      price: form.price ? Number(form.price) : undefined,
      unit: form.unit || undefined,
      category: form.category || undefined,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const payload = { ...parsed.data, image_url: form.image_url || null, business_id: id };
    const { error } = editing
      ? await supabase.from("listings").update(payload).eq("id", editing.id)
      : await supabase.from("listings").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Listing updated" : "Listing added");
    resetForm(); load();
  }

  async function removeListing(lid: string) {
    if (!confirm("Delete this listing?")) return;
    const { error } = await supabase.from("listings").delete().eq("id", lid);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  }

  async function onListingImage(file: File) {
    const url = await uploadImage(file, "listings");
    if (url) setForm({ ...form, image_url: url });
  }

  if (!biz) return <div className="min-h-screen"><SiteHeader /><main className="container mx-auto p-16">Loading…</main></div>;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-12">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to dashboard</Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-bold">{biz.name}</h1>
            <p className="mt-1 text-muted-foreground capitalize">{biz.type.replace("_", " ")}</p>
          </div>
          <Link to="/business/$slug" params={{ slug: biz.slug }}><Button variant="outline">View public page</Button></Link>
        </div>

        <Card className="mt-8 p-6">
          <h2 className="font-display text-xl font-bold">Branding</h2>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <Label>Logo</Label>
              <div className="mt-2 flex items-center gap-3">
                {biz.logo_url ? <img src={biz.logo_url} alt="" className="h-16 w-16 rounded-md object-cover" /> : <div className="h-16 w-16 rounded-md bg-secondary" />}
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary">
                  <Upload className="h-4 w-4" /> Upload logo
                  <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => e.target.files?.[0] && onBizImage("logo_url", e.target.files[0])} />
                </label>
              </div>
            </div>
            <div>
              <Label>Cover image</Label>
              <div className="mt-2 flex items-center gap-3">
                {biz.cover_image_url ? <img src={biz.cover_image_url} alt="" className="h-16 w-32 rounded-md object-cover" /> : <div className="h-16 w-32 rounded-md bg-secondary" />}
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary">
                  <Upload className="h-4 w-4" /> Upload cover
                  <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => e.target.files?.[0] && onBizImage("cover_image_url", e.target.files[0])} />
                </label>
              </div>
            </div>
          </div>
        </Card>

        <section className="mt-12">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold">Listings</h2>
          </div>

          <Card className="mt-4 p-6">
            <h3 className="font-medium">{editing ? "Edit listing" : "Add new listing"}</h3>
            <form onSubmit={saveListing} className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <Label>Category</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Drinks" />
              </div>
              <div>
                <Label>Price (₱)</Label>
                <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div>
                <Label>Unit</Label>
                <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="e.g. per kilo" />
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
              </div>
              <div className="md:col-span-2">
                <Label>Image</Label>
                <div className="mt-2 flex items-center gap-3">
                  {form.image_url && <img src={form.image_url} alt="" className="h-16 w-16 rounded-md object-cover" />}
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary">
                    <Upload className="h-4 w-4" /> Upload image
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onListingImage(e.target.files[0])} />
                  </label>
                  {form.image_url && <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, image_url: "" })}>Remove</Button>}
                </div>
              </div>
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" className="gap-2"><Plus className="h-4 w-4" /> {editing ? "Save changes" : "Add listing"}</Button>
                {editing && <Button type="button" variant="ghost" onClick={resetForm}>Cancel</Button>}
              </div>
            </form>
          </Card>

          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <Card key={l.id} className="overflow-hidden">
                {l.image_url && <img src={l.image_url} alt={l.name} className="aspect-video w-full object-cover" />}
                <div className="p-4">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-medium">{l.name}</h3>
                    {l.price && <div className="font-display font-bold text-sea">₱{Number(l.price).toFixed(2)}</div>}
                  </div>
                  {l.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{l.description}</p>}
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(l)} className="gap-1"><Pencil className="h-3 w-3" /> Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => removeListing(l.id)} className="gap-1 text-destructive"><Trash2 className="h-3 w-3" /> Delete</Button>
                  </div>
                </div>
              </Card>
            ))}
            {listings.length === 0 && <p className="text-muted-foreground">No listings yet — add one above.</p>}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
