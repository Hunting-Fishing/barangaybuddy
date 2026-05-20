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
import { Plus, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { FeatureTagsPicker } from "@/components/feature-tags-picker";
import { sanitizeCustomLabel, dedupeCaseInsensitive } from "@/lib/business-tags";


export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Owner Dashboard — BarangayHub" }] }),
  component: Dashboard,
});

const TYPES = [
  "store", "sari_sari", "service", "restaurant", "food_vendor", "ambulant_vendor",
  "market_vendor", "wet_market", "dry_goods", "bakery", "farmer", "fisher",
  "livestock", "agri_supply", "fuel_station", "pharmacy", "hardware",
  "repair_shop", "salon", "laundry", "transport",
] as const;
type BizType = typeof TYPES[number];
const TYPE_LABEL: Record<BizType, string> = {
  store: "Store", sari_sari: "Sari-sari store", service: "Service",
  restaurant: "Restaurant", food_vendor: "Food vendor", ambulant_vendor: "Ambulant vendor",
  market_vendor: "Market vendor", wet_market: "Wet market", dry_goods: "Dry goods",
  bakery: "Bakery", farmer: "Farmer", fisher: "Fisher", livestock: "Livestock",
  agri_supply: "Agri supply", fuel_station: "Fuel station", pharmacy: "Pharmacy",
  hardware: "Hardware", repair_shop: "Repair shop", salon: "Salon",
  laundry: "Laundry", transport: "Transport",
};

function Dashboard() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ name: string; type: BizType; additional_types: BizType[]; custom_types: string[]; tags: string[]; description: string; barangay_search: string; barangay_code: string; barangay_label: string }>({ name: "", type: "store", additional_types: [], custom_types: [], tags: [], description: "", barangay_search: "", barangay_code: "", barangay_label: "" });
  const [customTypeInput, setCustomTypeInput] = useState("");
  const [brgyResults, setBrgyResults] = useState<any[]>([]);


  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("businesses").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
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
      custom_types: z.array(z.string().trim().min(2).max(30)).max(10),
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
    setCustomTypeInput("");
    load();
  }


  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-4xl font-bold">Your businesses</h1>
            <p className="mt-1 text-muted-foreground">Manage everything you've listed.</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2"><Plus className="h-4 w-4" /> New business</Button>
        </div>

        {showForm && (
          <Card className="mt-6 p-6">
            <form onSubmit={create} className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Business name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <Label>Primary type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as BizType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Additional categories <span className="text-xs text-muted-foreground">— pick all that apply (e.g. restaurant + store + gas station)</span></Label>
                {form.additional_types.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {form.additional_types.map((t) => (
                      <Badge key={t} variant="secondary" className="gap-1">
                        {TYPE_LABEL[t]}
                        <button type="button" onClick={() => setForm({ ...form, additional_types: form.additional_types.filter((x) => x !== t) })} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="mt-2 grid max-h-56 grid-cols-2 gap-1.5 overflow-auto rounded-md border border-border p-3 md:grid-cols-3">
                  {TYPES.filter((t) => t !== form.type).map((t) => {
                    const checked = form.additional_types.includes(t);
                    return (
                      <label key={t} className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => {
                            setForm({
                              ...form,
                              additional_types: c
                                ? [...form.additional_types, t]
                                : form.additional_types.filter((x) => x !== t),
                            });
                          }}
                        />
                        {TYPE_LABEL[t]}
                      </label>
                    );
                  })}
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
            <Link key={b.id} to="/dashboard/business/$id" params={{ id: b.id }}>
              <Card className="p-5 transition-all hover:-translate-y-1 hover:shadow-elegant">
                <div className="text-xs uppercase text-muted-foreground">{b.type.replace("_", " ")}</div>
                <h3 className="mt-1 font-display text-lg font-bold">{b.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{b.description}</p>
                <p className="mt-3 text-xs text-primary">Manage listings & images →</p>
              </Card>
            </Link>
          ))}
          {businesses.length === 0 && <p className="text-muted-foreground">No businesses yet. Create your first one above.</p>}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
