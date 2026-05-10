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
import { Fuel, ThumbsUp, ThumbsDown } from "lucide-react";
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

function FuelPage() {
  const { user } = useAuth();
  const [prices, setPrices] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [stationId, setStationId] = useState("");
  const [fuelType, setFuelType] = useState("gasoline_95");
  const [price, setPrice] = useState("");

  async function load() {
    const { data } = await supabase
      .from("fuel_prices")
      .select("*, businesses(name, slug, barangays(name))")
      .order("reported_at", { ascending: false })
      .limit(100);
    setPrices(data ?? []);
  }

  useEffect(() => {
    load();
    supabase.from("businesses").select("id, name").eq("type", "fuel_station").eq("is_published", true).then(({ data }) => setStations(data ?? []));
  }, []);

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
    await supabase.from("fuel_price_votes").upsert({ fuel_price_id: id, user_id: user.id, vote: v }, { onConflict: "fuel_price_id,user_id" });
    toast.success("Vote recorded.");
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
            <h2 className="font-display text-xl font-bold">Post a price</h2>
            {stations.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">No fuel stations registered yet. Owners can list one in the dashboard.</p>
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
                    <div className="flex flex-col gap-1">
                      <button onClick={() => vote(p.id, 1)} className="rounded-md p-1 hover:bg-secondary"><ThumbsUp className="h-4 w-4" /></button>
                      <button onClick={() => vote(p.id, -1)} className="rounded-md p-1 hover:bg-secondary"><ThumbsDown className="h-4 w-4" /></button>
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
