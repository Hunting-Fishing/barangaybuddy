import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Fuel, ThumbsUp, ThumbsDown, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/fuel")({
  head: () => ({
    meta: [
      { title: "Fuel Buddy — Live fuel prices across the Philippines" },
      { name: "description", content: "Crowdsourced live fuel prices at every station, updated by the community." },
    ],
  }),
  component: FuelPage,
});

const FUEL_LABELS: Record<string, string> = {
  gasoline_91: "Gas 91",
  gasoline_95: "Gas 95",
  gasoline_97: "Gas 97",
  diesel: "Diesel",
};

const BRANDS = [
  "Petron", "Shell", "Caltex", "Phoenix", "Seaoil", "Cleanfuel",
  "Total", "Unioil", "Flying V", "PTT", "Jetti", "Insular Oil", "Independent / Other",
];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function FuelPage() {
  const { user } = useAuth();
  const [prices, setPrices] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [stationId, setStationId] = useState("");
  const [fuelType, setFuelType] = useState("gasoline_95");
  const [price, setPrice] = useState("");
  const [myVotes, setMyVotes] = useState<Record<string, 1 | -1>>({});
  const [doePrices, setDoePrices] = useState<any[]>([]);
  const [doeRegion, setDoeRegion] = useState<string>("NCR");
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Add-station dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [s_brand, setSBrand] = useState("Petron");
  const [s_branch, setSBranch] = useState("");
  const [s_address, setSAddress] = useState("");
  const [s_lat, setSLat] = useState("");
  const [s_lng, setSLng] = useState("");
  const [brgyQuery, setBrgyQuery] = useState("");
  const [brgyResults, setBrgyResults] = useState<any[]>([]);
  const [brgy, setBrgy] = useState<{ code: string; label: string } | null>(null);

  async function load() {
    const { data } = await supabase
      .from("fuel_prices")
      .select("*, businesses(name, slug, barangays(name))")
      .order("reported_at", { ascending: false })
      .limit(100);
    setPrices(data ?? []);
    if (user && data && data.length) {
      const ids = data.map((p) => p.id);
      const { data: votes } = await supabase
        .from("fuel_price_votes")
        .select("fuel_price_id, vote")
        .eq("user_id", user.id)
        .in("fuel_price_id", ids);
      const map: Record<string, 1 | -1> = {};
      (votes ?? []).forEach((v: any) => { map[v.fuel_price_id] = v.vote; });
      setMyVotes(map);
    } else {
      setMyVotes({});
    }
  }

  async function loadStations() {
    const { data } = await supabase
      .from("businesses")
      .select("id, name")
      .eq("type", "fuel_station")
      .eq("is_published", true)
      .order("name");
    setStations(data ?? []);
  }

  async function loadDoe(region: string) {
    const { data: snaps } = await supabase
      .from("fuel_price_snapshots")
      .select("brand, fuel_type, price, snapshot_date, fetched_at")
      .eq("region_code", region)
      .order("snapshot_date", { ascending: false })
      .limit(200);
    setDoePrices(snaps ?? []);
    const { data: run } = await supabase
      .from("fuel_import_runs")
      .select("finished_at")
      .eq("status", "completed")
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLastSync(run?.finished_at ?? null);
  }

  useEffect(() => {
    load();
    loadStations();
  }, [user?.id]);

  useEffect(() => { loadDoe(doeRegion); }, [doeRegion]);


  useEffect(() => {
    if (brgyQuery.length < 2) { setBrgyResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("barangays")
        .select("code, name, cities_municipalities(name, provinces(name))")
        .ilike("name", `%${brgyQuery}%`)
        .limit(8);
      setBrgyResults(data ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [brgyQuery]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return toast.error("Sign in to post fuel prices.");
    const parsed = z.object({
      station_id: z.string().uuid(),
      fuel_type: z.enum(["gasoline_91","gasoline_95","gasoline_97","diesel"]),
      price: z.coerce.number().positive().max(999),
    }).safeParse({ station_id: stationId, fuel_type: fuelType, price });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const { error } = await supabase.from("fuel_prices").insert({
      ...parsed.data,
      reported_by: user.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Price posted!"); setPrice(""); load(); }
  }

  async function vote(id: string, v: 1 | -1) {
    if (!user) return toast.error("Sign in to vote.");
    const current = myVotes[id];
    if (current === v) {
      const { error } = await supabase
        .from("fuel_price_votes")
        .delete()
        .eq("fuel_price_id", id)
        .eq("user_id", user.id);
      if (error) return toast.error(error.message);
      toast.success("Vote removed.");
    } else {
      const { error } = await supabase
        .from("fuel_price_votes")
        .upsert({ fuel_price_id: id, user_id: user.id, vote: v }, { onConflict: "fuel_price_id,user_id" });
      if (error) return toast.error(error.message);
      toast.success(current ? "Vote changed." : "Vote recorded.");
    }
    load();
  }

  async function addStation(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return toast.error("Sign in to add a station.");
    if (!brgy) return toast.error("Choose a barangay.");
    const branch = s_branch.trim();
    if (branch.length < 2) return toast.error("Add a branch name or location, e.g. \"Shell EDSA Cubao\".");
    const lat = s_lat ? Number(s_lat) : null;
    const lng = s_lng ? Number(s_lng) : null;
    if (s_lat && (Number.isNaN(lat!) || lat! < 4 || lat! > 22)) return toast.error("Latitude looks off for the Philippines.");
    if (s_lng && (Number.isNaN(lng!) || lng! < 115 || lng! > 128)) return toast.error("Longitude looks off for the Philippines.");

    const name = s_brand === "Independent / Other" ? branch : `${s_brand} — ${branch}`;
    const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`;
    setAdding(true);
    const { data, error } = await supabase
      .from("businesses")
      .insert({
        name,
        slug,
        type: "fuel_station",
        tags: [s_brand.toLowerCase().replace(/[^a-z0-9]+/g, "-"), "fuel-station"],
        custom_types: [],
        additional_types: [],
        description: `${s_brand} fuel station in ${brgy.label}.`,
        address: s_address || null,
        latitude: lat,
        longitude: lng,
        barangay_code: brgy.code,
        owner_id: user.id,
        is_claimed: false,
        is_published: true,
      })
      .select("id, name")
      .single();
    setAdding(false);
    if (error || !data) return toast.error(error?.message ?? "Could not add station.");
    toast.success("Station added — thanks for growing the map!");
    await loadStations();
    setStationId(data.id);
    setAddOpen(false);
    setSBranch(""); setSAddress(""); setSLat(""); setSLng("");
    setBrgy(null); setBrgyQuery("");
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-16">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-sun shadow-sun">
            <Fuel className="h-6 w-6 text-sun-foreground" />
          </div>
          <div>
            <h1 className="font-display text-4xl font-bold">Fuel Buddy</h1>
            <p className="text-muted-foreground">Live fuel prices, crowdsourced from the community.</p>
          </div>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold">Post a price</h2>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" type="button">
                    <Plus className="mr-1 h-4 w-4" /> Add station
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add a fuel station</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={addStation} className="space-y-3">
                    <div>
                      <Label>Brand</Label>
                      <Select value={s_brand} onValueChange={setSBrand}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BRANDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Branch / location name</Label>
                      <Input
                        value={s_branch}
                        onChange={(e) => setSBranch(e.target.value)}
                        placeholder='e.g. "EDSA Cubao" or "Brgy. Poblacion Hwy"'
                        required
                      />
                    </div>
                    <div>
                      <Label>Address (optional)</Label>
                      <Input value={s_address} onChange={(e) => setSAddress(e.target.value)} placeholder="Street, landmark" />
                    </div>
                    <div>
                      <Label>
                        Barangay {brgy && <span className="text-xs text-muted-foreground">— {brgy.label}</span>}
                      </Label>
                      <Input
                        value={brgyQuery}
                        onChange={(e) => { setBrgyQuery(e.target.value); setBrgy(null); }}
                        placeholder="Type barangay name…"
                      />
                      {brgyResults.length > 0 && !brgy && (
                        <div className="mt-1 max-h-44 overflow-auto rounded-md border bg-popover text-sm">
                          {brgyResults.map((b: any) => (
                            <button
                              key={b.code}
                              type="button"
                              className="block w-full px-3 py-2 text-left hover:bg-accent"
                              onClick={() => {
                                setBrgy({ code: b.code, label: `${b.name}, ${b.cities_municipalities?.name}` });
                                setBrgyQuery("");
                                setBrgyResults([]);
                              }}
                            >
                              {b.name} <span className="text-muted-foreground">— {b.cities_municipalities?.name}, {b.cities_municipalities?.provinces?.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Latitude (optional)</Label>
                        <Input value={s_lat} onChange={(e) => setSLat(e.target.value)} placeholder="14.6760" inputMode="decimal" />
                      </div>
                      <div>
                        <Label>Longitude (optional)</Label>
                        <Input value={s_lng} onChange={(e) => setSLng(e.target.value)} placeholder="121.0437" inputMode="decimal" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tip: open the station on Google Maps, long-press the pin, and copy the lat/long.
                    </p>
                    <DialogFooter>
                      <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={adding}>{adding ? "Adding…" : "Add station"}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            {stations.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">No fuel stations registered yet. Use “Add station” to start the map.</p>
            )}
            <form onSubmit={submit} className="mt-4 space-y-4">
              <div>
                <Label>Station</Label>
                <Select value={stationId} onValueChange={setStationId}>
                  <SelectTrigger><SelectValue placeholder="Choose station" /></SelectTrigger>
                  <SelectContent>
                    {stations.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fuel type</Label>
                <Select value={fuelType} onValueChange={setFuelType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FUEL_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Price (₱ per liter)</Label>
                <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full">Submit price</Button>
            </form>

            <div className="mt-6 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Bulk-import station data (legal sources)</p>
              <p className="mt-1">
                The Philippine Department of Energy publishes the official list of Liquid Fuel Retail Outlets (LFROs)
                with valid Certificates of Compliance, plus weekly retail pump prices — these are government
                publications and free to reuse with attribution.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>
                  <a className="underline" href="https://legacy.doe.gov.ph/downstream-oil/advisory" target="_blank" rel="noreferrer">
                    DOE — LFROs with valid COC
                  </a>
                </li>
                <li>
                  <a className="underline" href="https://legacy.doe.gov.ph/retail-pump-price-quality-service-dashboard" target="_blank" rel="noreferrer">
                    DOE — Retail Pump Prices dashboard
                  </a>
                </li>
                <li>
                  <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                    OpenStreetMap (ODbL — attribution required)
                  </a>
                </li>
              </ul>
            </div>
          </Card>

          <div className="lg:col-span-2">
            <h2 className="font-display text-xl font-bold">Latest reports</h2>
            <div className="mt-4 space-y-3">
              {prices.length === 0 && <p className="text-sm text-muted-foreground">No prices reported yet. Be the first!</p>}
              {prices.map((p) => (
                <Card key={p.id} className="flex items-center justify-between p-4">
                  <div>
                    <Link to="/business/$slug" params={{ slug: p.businesses?.slug }} className="font-medium hover:underline">{p.businesses?.name}</Link>
                    <div className="text-xs text-muted-foreground">{p.businesses?.barangays?.name} · {new Date(p.reported_at).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs uppercase text-muted-foreground">{FUEL_LABELS[p.fuel_type]}</div>
                      <div className="font-display text-2xl font-bold">₱{Number(p.price).toFixed(2)}</div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => vote(p.id, 1)}
                        aria-pressed={myVotes[p.id] === 1}
                        className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${myVotes[p.id] === 1 ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" /> {p.upvotes ?? 0}
                      </button>
                      <button
                        onClick={() => vote(p.id, -1)}
                        aria-pressed={myVotes[p.id] === -1}
                        className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${myVotes[p.id] === -1 ? "bg-destructive text-destructive-foreground" : "hover:bg-secondary"}`}
                      >
                        <ThumbsDown className="h-3.5 w-3.5" /> {p.downvotes ?? 0}
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
