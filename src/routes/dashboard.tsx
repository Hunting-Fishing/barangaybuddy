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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { z } from "zod";
import { ExternalLink, Package, Plus, Settings } from "lucide-react";
import { FeatureTagsPicker } from "@/components/feature-tags-picker";
import { BusinessImportDialog } from "@/components/business-import-dialog";
import { BusinessCategoryPicker } from "@/components/business-category-picker";
import { EditBusinessDialog } from "@/components/edit-business-dialog";
import { dedupeCaseInsensitive, tagLabel } from "@/lib/business-tags";
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_LABEL,
  type BusinessType,
} from "@/lib/business-types";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Owner Dashboard — BarangayHub" }] }),
  component: Dashboard,
});

const TYPES = BUSINESS_TYPES;
type BizType = BusinessType;
const TYPE_LABEL = BUSINESS_TYPE_LABEL;

function Dashboard() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ name: string; type: BizType; additional_types: BizType[]; custom_types: string[]; tags: string[]; description: string; barangay_search: string; barangay_code: string; barangay_label: string }>({ name: "", type: "store", additional_types: [], custom_types: [], tags: [], description: "", barangay_search: "", barangay_code: "", barangay_label: "" });
  const [brgyResults, setBrgyResults] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [syncingOsm, setSyncingOsm] = useState(false);
  const [lastRun, setLastRun] = useState<{ status: string; businesses_upserted: number; started_at: string; error: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  async function loadLastRun() {
    const { data } = await supabase
      .from("business_import_runs")
      .select("status, businesses_upserted, started_at, error")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLastRun(data);
  }
  useEffect(() => { if (isAdmin) loadLastRun(); }, [isAdmin]);

  async function runOsmSync() {
    setSyncingOsm(true);
    try {
      const res = await fetch("/api/public/hooks/business-osm-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        },
        body: "{}",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
      toast.success(`Imported ${json.upserted ?? 0} businesses from OpenStreetMap`);
      await loadLastRun();
    } catch (e) {
      toast.error(`Sync failed: ${(e as Error).message}`);
    } finally {
      setSyncingOsm(false);
    }
  }

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("businesses")
      .select("*, barangays(name, cities_municipalities(name, provinces(name)))")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    setBusinesses(data ?? []);
  }
  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    if (form.barangay_search.length < 2) { setBrgyResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("barangays")
        .select("code, name, cities_municipalities(name, provinces(name))")
        .ilike("name", `%${form.barangay_search}%`)
        .limit(10);
      setBrgyResults(data ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [form.barangay_search]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const parsed = z.object({
      name: z.string().trim().min(2).max(120),
      type: z.enum(TYPES),
      additional_types: z.array(z.enum(TYPES)).max(10),
      custom_types: z.array(z.string().trim().min(2).max(40)).max(20),
      tags: z.array(z.string().trim().min(1).max(40)).max(50),
      description: z.string().max(2000).optional(),
      barangay_code: z.string().min(1, "Choose a barangay"),
    }).safeParse({ ...form, description: form.description || undefined });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const slug = `${parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Math.random().toString(36).slice(2, 7)}`;
    const additional_types = parsed.data.additional_types.filter((t) => t !== parsed.data.type);
    const custom_types = dedupeCaseInsensitive(parsed.data.custom_types);
    const tags = dedupeCaseInsensitive(parsed.data.tags);
    const { error } = await supabase.from("businesses").insert({ ...parsed.data, additional_types, custom_types, tags, owner_id: user.id, slug });
    if (error) return toast.error(error.message);
    toast.success("Business created!");
    setShowForm(false);
    setForm({ name: "", type: "store", additional_types: [], custom_types: [], tags: [], description: "", barangay_search: "", barangay_code: "", barangay_label: "" });
    load();
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-12">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-display text-4xl font-bold">Your businesses</h1>
            <p className="mt-1 text-muted-foreground">Manage everything you've listed.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <BusinessImportDialog />
            <Button onClick={() => setShowForm(!showForm)} className="gap-2"><Plus className="h-4 w-4" /> New business</Button>
          </div>
        </div>

        {isAdmin && (
          <Card className="mt-6 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold">Admin: Auto-import businesses (OSM)</h2>
                <p className="text-sm text-muted-foreground">
                  Pulls Philippine businesses from OpenStreetMap and adds them as <strong>unclaimed</strong> listings. Runs nightly; you can trigger it manually here.
                </p>
                {lastRun && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Last run: <span className="font-medium">{lastRun.status}</span>
                    {" · "}{lastRun.businesses_upserted.toLocaleString()} upserted
                    {" · "}{new Date(lastRun.started_at).toLocaleString()}
                    {lastRun.error && <span className="text-destructive"> · {lastRun.error.slice(0, 100)}</span>}
                  </p>
                )}
              </div>
              <Button onClick={runOsmSync} disabled={syncingOsm}>
                {syncingOsm ? "Importing…" : "Run sync now"}
              </Button>
            </div>
          </Card>
        )}

        {showForm && (
          <Card className="mt-6 p-6">
            <form onSubmit={create} className="grid gap-5 md:grid-cols-2">
              <div>
                <Label>Business name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <Label>Primary type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => {
                    const nextType = v as BizType;
                    setForm({
                      ...form,
                      type: nextType,
                      additional_types: form.additional_types.filter((type) => type !== nextType),
                    });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <BusinessCategoryPicker
                primaryType={form.type}
                additionalTypes={form.additional_types}
                customTypes={form.custom_types}
                onAdditionalTypesChange={(additional_types) =>
                  setForm((current) => ({ ...current, additional_types }))
                }
                onCustomTypesChange={(custom_types) =>
                  setForm((current) => ({ ...current, custom_types }))
                }
              />

              <div className="md:col-span-2">
                <Label>Features & amenities <span className="text-xs text-muted-foreground">— what does the place have? (billiards, videoke, WiFi, GCash…)</span></Label>
                <div className="mt-2">
                  <FeatureTagsPicker value={form.tags} onChange={(tags) => setForm({ ...form, tags })} />
                </div>
              </div>

              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
              </div>
              <div className="md:col-span-2">
                <Label>Barangay {form.barangay_label && <span className="text-xs text-muted-foreground">— Selected: {form.barangay_label}</span>}</Label>
                <Input value={form.barangay_search} onChange={(e) => setForm({ ...form, barangay_search: e.target.value })} placeholder="Type barangay name…" />
                {brgyResults.length > 0 && (
                  <div className="mt-2 max-h-60 overflow-auto rounded-md border border-border">
                    {brgyResults.map((b) => (
                      <button
                        key={b.code}
                        type="button"
                        onClick={() => setForm({ ...form, barangay_code: b.code, barangay_label: `${b.name}, ${b.cities_municipalities?.name}`, barangay_search: "", })}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-secondary"
                      >
                        {b.name} <span className="text-muted-foreground">— {b.cities_municipalities?.name}, {b.cities_municipalities?.provinces?.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit">Create business</Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </Card>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {businesses.map((b) => (
            <Card key={b.id} className="flex flex-col p-5 transition-all hover:-translate-y-1 hover:shadow-elegant">
              <div className="text-xs uppercase text-muted-foreground">
                {[TYPE_LABEL[b.type as BizType] ?? b.type, ...(b.additional_types ?? []).map((t: BizType) => TYPE_LABEL[t] ?? t), ...(b.custom_types ?? [])].join(" · ")}
              </div>
              <h3 className="mt-1 font-display text-lg font-bold">{b.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{b.description}</p>
              {Array.isArray(b.tags) && b.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {b.tags.slice(0, 6).map((t: string) => (
                    <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">{tagLabel(t)}</span>
                  ))}
                  {b.tags.length > 6 && <span className="text-[10px] text-muted-foreground">+{b.tags.length - 6} more</span>}
                </div>
              )}

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <Button variant="outline" size="sm" asChild className="gap-1">
                  <a href={`/${b.slug}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" /> View page
                  </a>
                </Button>
                <EditBusinessDialog business={b} onSaved={load} />
                <Button variant="outline" size="sm" asChild className="gap-1">
                  <Link to="/dashboard/business/$id" params={{ id: b.id }}>
                    <Settings className="h-3.5 w-3.5" /> Listings/images
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="gap-1">
                  <Link to="/inventory/$businessId" params={{ businessId: b.id }}>
                    <Package className="h-3.5 w-3.5" /> Inventory
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
          {businesses.length === 0 && <p className="text-muted-foreground">No businesses yet. Create your first one above.</p>}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}