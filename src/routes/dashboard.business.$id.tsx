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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { z } from "zod";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Upload,
  Pencil,
  Fuel,
  ThumbsUp,
  ThumbsDown,
  X,
  ExternalLink,
  Package,
} from "lucide-react";
import {
  computeUnitPrice,
  formatPerEach,
  formatPerUnit,
  SIZE_UNITS,
  type SizeUnit,
} from "@/lib/unit-price";
import { FeatureTagsPicker } from "@/components/feature-tags-picker";
import { sanitizeCustomLabel, dedupeCaseInsensitive } from "@/lib/business-tags";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EditBusinessDialog } from "@/components/edit-business-dialog";

const TYPES = [
  "store",
  "sari_sari",
  "service",
  "restaurant",
  "food_vendor",
  "ambulant_vendor",
  "market_vendor",
  "wet_market",
  "dry_goods",
  "bakery",
  "farmer",
  "fisher",
  "livestock",
  "agri_supply",
  "fuel_station",
  "pharmacy",
  "hardware",
  "repair_shop",
  "salon",
  "laundry",
  "transport",
] as const;
type BizType = (typeof TYPES)[number];
const TYPE_LABEL: Record<BizType, string> = {
  store: "Store",
  sari_sari: "Sari-sari store",
  service: "Service",
  restaurant: "Restaurant",
  food_vendor: "Food vendor",
  ambulant_vendor: "Ambulant vendor",
  market_vendor: "Market vendor",
  wet_market: "Wet market",
  dry_goods: "Dry goods",
  bakery: "Bakery",
  farmer: "Farmer",
  fisher: "Fisher",
  livestock: "Livestock",
  agri_supply: "Agri supply",
  fuel_station: "Fuel station",
  pharmacy: "Pharmacy",
  hardware: "Hardware",
  repair_shop: "Repair shop",
  salon: "Salon",
  laundry: "Laundry",
  transport: "Transport",
};

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
  pack_qty: z.number().int().min(1).max(100000).default(1),
  size_value: z.number().positive().max(1000000).optional(),
  size_unit: z.enum(["g", "kg", "ml", "L", "pc"]).optional(),
});

const FUEL_LABELS: Record<string, string> = {
  gasoline_91: "Gas 91",
  gasoline_95: "Gas 95",
  gasoline_97: "Gas 97",
  diesel: "Diesel",
};
const FUEL_TYPES = Object.keys(FUEL_LABELS) as Array<keyof typeof FUEL_LABELS>;

function ManageBusiness() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [biz, setBiz] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    unit: "",
    category: "",
    image_url: "",
    pack_qty: "1",
    size_value: "",
    size_unit: "" as "" | SizeUnit,
  });
  const [busy, setBusy] = useState(false);

  // Categories & features state (non-fuel businesses)
  const [catForm, setCatForm] = useState<{
    additional_types: BizType[];
    custom_types: string[];
    tags: string[];
  }>({ additional_types: [], custom_types: [], tags: [] });
  const [customTypeInput, setCustomTypeInput] = useState("");

  // Fuel-station state
  const [fuelPrices, setFuelPrices] = useState<any[]>([]);
  const [fuelForm, setFuelForm] = useState({ fuel_type: "gasoline_95", price: "" });
  const [details, setDetails] = useState({ brand: "", address: "", hours: "", contact_phone: "" });

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  async function load() {
    const { data: b } = await supabase
      .from("businesses")
      .select("*, barangays(name, cities_municipalities(name, provinces(name)))")
      .eq("id", id)
      .maybeSingle();
    setBiz(b);
    if (b) {
      setDetails({
        brand: (b.tags?.[0] as string) ?? "",
        address: b.address ?? "",
        hours: b.hours ?? "",
        contact_phone: b.contact_phone ?? "",
      });
      setCatForm({
        additional_types: (b.additional_types ?? []) as BizType[],
        custom_types: (b.custom_types ?? []) as string[],
        tags: b.type === "fuel_station" ? [] : ((b.tags ?? []) as string[]),
      });
    }

    const { data: l } = await supabase
      .from("listings")
      .select("*")
      .eq("business_id", id)
      .order("created_at", { ascending: false });
    setListings(l ?? []);
    if (b?.type === "fuel_station") {
      const { data: fp } = await supabase
        .from("fuel_prices")
        .select("*")
        .eq("station_id", id)
        .order("reported_at", { ascending: false })
        .limit(50);
      setFuelPrices(fp ?? []);
    }
  }
  useEffect(() => {
    load();
  }, [id]);

  async function uploadImage(file: File, folder: string) {
    if (!user) return null;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("business-media")
      .upload(path, file, { upsert: false });
    if (error) {
      toast.error(error.message);
      return null;
    }
    const { data } = supabase.storage.from("business-media").getPublicUrl(path);
    return data.publicUrl;
  }

  async function onBizImage(field: "logo_url" | "cover_image_url", file: File) {
    setBusy(true);
    const url = await uploadImage(file, field);
    if (url) {
      const update: any = { [field]: url };
      const { error } = await supabase.from("businesses").update(update).eq("id", id);
      if (error) toast.error(error.message);
      else {
        toast.success("Updated!");
        load();
      }
    }
    setBusy(false);
  }

  function resetForm() {
    setEditing(null);
    setForm({
      name: "",
      description: "",
      price: "",
      unit: "",
      category: "",
      image_url: "",
      pack_qty: "1",
      size_value: "",
      size_unit: "",
    });
  }

  function startEdit(l: any) {
    setEditing(l);
    setForm({
      name: l.name,
      description: l.description ?? "",
      price: l.price?.toString() ?? "",
      unit: l.unit ?? "",
      category: l.category ?? "",
      image_url: l.image_url ?? "",
      pack_qty: (l.pack_qty ?? 1).toString(),
      size_value: l.size_value != null ? String(l.size_value) : "",
      size_unit: (l.size_unit ?? "") as "" | SizeUnit,
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
      pack_qty: form.pack_qty ? Number(form.pack_qty) : 1,
      size_value: form.size_value ? Number(form.size_value) : undefined,
      size_unit: form.size_unit || undefined,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const payload = {
      ...parsed.data,
      size_value: parsed.data.size_value ?? null,
      size_unit: parsed.data.size_unit ?? null,
      image_url: form.image_url || null,
      business_id: id,
    };
    const { error } = editing
      ? await supabase.from("listings").update(payload).eq("id", editing.id)
      : await supabase.from("listings").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Listing updated" : "Listing added");
    resetForm();
    load();
  }

  async function removeListing(lid: string) {
    if (!confirm("Delete this listing?")) return;
    const { error } = await supabase.from("listings").delete().eq("id", lid);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  }

  async function onListingImage(file: File) {
    const url = await uploadImage(file, "listings");
    if (url) setForm({ ...form, image_url: url });
  }

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    const tags = details.brand ? [details.brand.trim()] : [];
    const { error } = await supabase
      .from("businesses")
      .update({
        tags,
        address: details.address || null,
        hours: details.hours || null,
        contact_phone: details.contact_phone || null,
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Station details saved");
    load();
  }

  async function saveCategories(e: React.FormEvent) {
    e.preventDefault();
    const parsed = z
      .object({
        additional_types: z.array(z.enum(TYPES)).max(10),
        custom_types: z.array(z.string().trim().min(2).max(30)).max(10),
        tags: z.array(z.string().trim().min(1).max(40)).max(50),
      })
      .safeParse(catForm);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const additional_types = parsed.data.additional_types.filter((t) => t !== biz.type);
    const custom_types = dedupeCaseInsensitive(parsed.data.custom_types);
    const tags = dedupeCaseInsensitive(parsed.data.tags);
    const { error } = await supabase
      .from("businesses")
      .update({ additional_types, custom_types, tags })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Categories & features saved");
    load();
  }

  async function postFuelPrice(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const parsed = z
      .object({
        fuel_type: z.enum(["gasoline_91", "gasoline_95", "gasoline_97", "diesel"]),
        price: z.coerce.number().positive().max(999),
      })
      .safeParse(fuelForm);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const { error } = await supabase.from("fuel_prices").insert({
      station_id: id,
      reported_by: user.id,
      ...parsed.data,
    });
    if (error) return toast.error(error.message);
    toast.success("Price posted!");
    setFuelForm({ ...fuelForm, price: "" });
    load();
  }

  async function removeFuelPrice(fid: string) {
    if (!confirm("Delete this price report?")) return;
    const { error } = await supabase.from("fuel_prices").delete().eq("id", fid);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    load();
  }

  // Latest price per fuel type
  const latestByType = FUEL_TYPES.map((t) => ({
    type: t,
    row: fuelPrices.find((p) => p.fuel_type === t),
  }));

  if (!biz)
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="container mx-auto p-16">Loading…</main>
      </div>
    );

  const isFuel = biz.type === "fuel_station";

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-12">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-bold">{biz.name}</h1>
            <p className="mt-1 text-muted-foreground capitalize">{biz.type.replace("_", " ")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <EditBusinessDialog business={biz} onSaved={load} />
            <Button variant="outline" asChild>
              <a href={`/${biz.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> Open public mini-site
              </a>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/dashboard/business/$id/inventory" params={{ id }}>
                <Package className="mr-2 h-4 w-4" /> Inventory
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/dashboard/business/$id/restaurant" params={{ id }}>
                Restaurant Manager
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/business/$slug" params={{ slug: biz.slug }}>
                Classic page
              </Link>
            </Button>
          </div>
        </div>

        <Card className="mt-8 p-6">
          <h2 className="font-display text-xl font-bold">Branding</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload the images shown on your directory page and mini-site.
          </p>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <Label>Logo</Label>
              <div className="mt-2 flex items-center gap-3">
                {biz.logo_url ? (
                  <img src={biz.logo_url} alt="" className="h-16 w-16 rounded-md object-cover" />
                ) : (
                  <div className="h-16 w-16 rounded-md bg-secondary" />
                )}
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary">
                  <Upload className="h-4 w-4" /> Upload logo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={busy}
                    onChange={(e) =>
                      e.target.files?.[0] && onBizImage("logo_url", e.target.files[0])
                    }
                  />
                </label>
              </div>
            </div>
            <div>
              <Label>Cover image</Label>
              <div className="mt-2 flex items-center gap-3">
                {biz.cover_image_url ? (
                  <img
                    src={biz.cover_image_url}
                    alt=""
                    className="h-16 w-32 rounded-md object-cover"
                  />
                ) : (
                  <div className="h-16 w-32 rounded-md bg-secondary" />
                )}
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary">
                  <Upload className="h-4 w-4" /> Upload cover
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={busy}
                    onChange={(e) =>
                      e.target.files?.[0] && onBizImage("cover_image_url", e.target.files[0])
                    }
                  />
                </label>
              </div>
            </div>
          </div>
        </Card>

        {!isFuel && (
          <Card className="mt-8 p-6">
            <h2 className="font-display text-xl font-bold">Categories & features</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Primary type:{" "}
              <span className="font-medium text-foreground">
                {TYPE_LABEL[biz.type as BizType] ?? biz.type}
              </span>
              . Add what else this place is and what features it has.
            </p>
            <form onSubmit={saveCategories} className="mt-4 space-y-6">
              <div>
                <Label>Additional categories</Label>
                {catForm.additional_types.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {catForm.additional_types.map((t) => (
                      <Badge key={t} variant="secondary" className="gap-1">
                        {TYPE_LABEL[t] ?? t}
                        <button
                          type="button"
                          onClick={() =>
                            setCatForm({
                              ...catForm,
                              additional_types: catForm.additional_types.filter((x) => x !== t),
                            })
                          }
                          className="hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="mt-2 grid max-h-56 grid-cols-2 gap-1.5 overflow-auto rounded-md border border-border p-3 md:grid-cols-3">
                  {TYPES.filter((t) => t !== biz.type).map((t) => {
                    const checked = catForm.additional_types.includes(t);
                    return (
                      <label key={t} className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c: boolean | "indeterminate") =>
                            setCatForm({
                              ...catForm,
                              additional_types: c
                                ? [...catForm.additional_types, t]
                                : catForm.additional_types.filter((x) => x !== t),
                            })
                          }
                        />
                        {TYPE_LABEL[t]}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>
                  Other categories{" "}
                  <span className="text-xs text-muted-foreground">
                    — type your own (Bar, Pub, Billiards hall…)
                  </span>
                </Label>
                {catForm.custom_types.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {catForm.custom_types.map((c) => (
                      <Badge key={c} className="gap-1">
                        {c}
                        <button
                          type="button"
                          onClick={() =>
                            setCatForm({
                              ...catForm,
                              custom_types: catForm.custom_types.filter((x) => x !== c),
                            })
                          }
                          className="hover:text-destructive/80"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex gap-2">
                  <Input
                    value={customTypeInput}
                    onChange={(e) => setCustomTypeInput(e.target.value)}
                    placeholder="e.g. Bar, Pub, Pool hall…"
                    maxLength={30}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const clean = sanitizeCustomLabel(customTypeInput);
                        if (!clean) return toast.error("Use 2–30 letters/numbers.");
                        if (
                          catForm.custom_types.some((c) => c.toLowerCase() === clean.toLowerCase())
                        ) {
                          setCustomTypeInput("");
                          return;
                        }
                        if (catForm.custom_types.length >= 10)
                          return toast.error("Up to 10 custom categories.");
                        setCatForm({ ...catForm, custom_types: [...catForm.custom_types, clean] });
                        setCustomTypeInput("");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1"
                    onClick={() => {
                      const clean = sanitizeCustomLabel(customTypeInput);
                      if (!clean) return toast.error("Use 2–30 letters/numbers.");
                      if (
                        catForm.custom_types.some((c) => c.toLowerCase() === clean.toLowerCase())
                      ) {
                        setCustomTypeInput("");
                        return;
                      }
                      if (catForm.custom_types.length >= 10)
                        return toast.error("Up to 10 custom categories.");
                      setCatForm({ ...catForm, custom_types: [...catForm.custom_types, clean] });
                      setCustomTypeInput("");
                    }}
                  >
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
              </div>

              <div>
                <Label>Features & amenities</Label>
                <div className="mt-2">
                  <FeatureTagsPicker
                    value={catForm.tags}
                    onChange={(tags) => setCatForm({ ...catForm, tags })}
                  />
                </div>
              </div>

              <div>
                <Button type="submit">Save categories & features</Button>
              </div>
            </form>
          </Card>
        )}

        {isFuel && (
          <>
            <Card className="mt-8 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-sun shadow-sun">
                  <Fuel className="h-5 w-5 text-sun-foreground" />
                </div>
                <h2 className="font-display text-xl font-bold">Station details</h2>
              </div>
              <form onSubmit={saveDetails} className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Brand (e.g. Petron, Shell, Caltex)</Label>
                  <Input
                    value={details.brand}
                    onChange={(e) => setDetails({ ...details, brand: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Contact phone</Label>
                  <Input
                    value={details.contact_phone}
                    onChange={(e) => setDetails({ ...details, contact_phone: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Address</Label>
                  <Input
                    value={details.address}
                    onChange={(e) => setDetails({ ...details, address: e.target.value })}
                    placeholder="Street, landmark"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Hours</Label>
                  <Input
                    value={details.hours}
                    onChange={(e) => setDetails({ ...details, hours: e.target.value })}
                    placeholder="Mon–Sun 24/7"
                  />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit">Save station details</Button>
                </div>
              </form>
            </Card>

            <Card className="mt-8 p-6">
              <h2 className="font-display text-xl font-bold">Post current fuel price</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Update what your pump is charging right now. The community can upvote or downvote
                each report.
              </p>
              <form
                onSubmit={postFuelPrice}
                className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto]"
              >
                <div>
                  <Label>Fuel type</Label>
                  <Select
                    value={fuelForm.fuel_type}
                    onValueChange={(v) => setFuelForm({ ...fuelForm, fuel_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FUEL_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {FUEL_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Price (₱ / liter)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={fuelForm.price}
                    onChange={(e) => setFuelForm({ ...fuelForm, price: e.target.value })}
                    required
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="gap-2">
                    <Plus className="h-4 w-4" /> Post price
                  </Button>
                </div>
              </form>

              <div className="mt-6 grid gap-3 md:grid-cols-4">
                {latestByType.map(({ type, row }) => (
                  <div key={type} className="rounded-lg border border-border p-4">
                    <div className="text-xs uppercase text-muted-foreground">
                      {FUEL_LABELS[type]}
                    </div>
                    {row ? (
                      <>
                        <div className="font-display text-2xl font-bold text-sea">
                          ₱{Number(row.price).toFixed(2)}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <ThumbsUp className="h-3 w-3" /> {row.upvotes}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <ThumbsDown className="h-3 w-3" /> {row.downvotes}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="mt-1 text-sm text-muted-foreground">No data</div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="mt-8 p-6">
              <h2 className="font-display text-xl font-bold">Price history</h2>
              <div className="mt-4 space-y-2">
                {fuelPrices.length === 0 && (
                  <p className="text-sm text-muted-foreground">No prices posted yet.</p>
                )}
                {fuelPrices.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-md border border-border px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        {FUEL_LABELS[p.fuel_type]} · ₱{Number(p.price).toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(p.reported_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <ThumbsUp className="h-3 w-3" /> {p.upvotes}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <ThumbsDown className="h-3 w-3" /> {p.downvotes}
                      </span>
                      {p.reported_by === user?.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFuelPrice(p.id)}
                          className="gap-1 text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        <section className="mt-12">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold">Listings</h2>
          </div>

          <Card className="mt-4 p-6">
            <h3 className="font-medium">{editing ? "Edit listing" : "Add new listing"}</h3>
            <form onSubmit={saveListing} className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Category</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g. Drinks"
                />
              </div>
              <div>
                <Label>Price (₱)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div>
                <Label>Unit label (display only)</Label>
                <Input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="e.g. per kilo"
                />
              </div>
              <div>
                <Label>Pack quantity</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={form.pack_qty}
                  onChange={(e) => setForm({ ...form, pack_qty: e.target.value })}
                  placeholder="1"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  How many pieces are in this pack? e.g. 10 for a 10-pack.
                </p>
              </div>
              <div>
                <Label>Size per piece</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.size_value}
                    onChange={(e) => setForm({ ...form, size_value: e.target.value })}
                    placeholder="e.g. 35"
                  />
                  <Select
                    value={form.size_unit || "none"}
                    onValueChange={(v) =>
                      setForm({ ...form, size_unit: v === "none" ? "" : (v as SizeUnit) })
                    }
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue placeholder="unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {SIZE_UNITS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Optional. Lets shoppers compare by weight / volume.
                </p>
              </div>
              <div className="md:col-span-2 rounded-md border border-dashed border-border bg-secondary/40 p-3 text-sm">
                {(() => {
                  const up = computeUnitPrice(
                    form.price ? Number(form.price) : null,
                    form.pack_qty ? Number(form.pack_qty) : 1,
                    form.size_value ? Number(form.size_value) : null,
                    form.size_unit || null,
                  );
                  const pe = formatPerEach(up.perEach);
                  const pu = formatPerUnit(up.perUnit, up.baseUnit);
                  if (!pe && !pu)
                    return (
                      <span className="text-muted-foreground">
                        Live preview: enter a price and pack quantity to see per-each pricing.
                      </span>
                    );
                  return (
                    <span>
                      <span className="font-medium">Shoppers will see:</span>{" "}
                      {pe && <span className="font-display">{pe}</span>}
                      {pe && pu && <span> · </span>}
                      {pu && <span className="font-display">{pu}</span>}
                    </span>
                  );
                })()}
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Image</Label>
                <div className="mt-2 flex items-center gap-3">
                  {form.image_url && (
                    <img
                      src={form.image_url}
                      alt=""
                      className="h-16 w-16 rounded-md object-cover"
                    />
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary">
                    <Upload className="h-4 w-4" /> Upload image
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && onListingImage(e.target.files[0])}
                    />
                  </label>
                  {form.image_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm({ ...form, image_url: "" })}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" className="gap-2">
                  <Plus className="h-4 w-4" /> {editing ? "Save changes" : "Add listing"}
                </Button>
                {editing && (
                  <Button type="button" variant="ghost" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Card>

          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <Card key={l.id} className="overflow-hidden">
                {l.image_url && (
                  <img
                    src={l.image_url}
                    alt={l.name}
                    className="aspect-video w-full object-cover"
                  />
                )}
                <div className="p-4">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-medium">{l.name}</h3>
                    {l.price && (
                      <div className="font-display font-bold text-sea">
                        ₱{Number(l.price).toFixed(2)}
                      </div>
                    )}
                  </div>
                  {l.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {l.description}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(l)}
                      className="gap-1"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeListing(l.id)}
                      className="gap-1 text-destructive"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {listings.length === 0 && (
              <p className="text-muted-foreground">No listings yet — add one above.</p>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
