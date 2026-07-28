import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { reservationRequestSchema } from "@/lib/ecosystem";
export const Route = createFileRoute("/marketplace/business/$id")({ component: MerchantStore });
function MerchantStore() {
  const { id } = Route.useParams(),
    { user } = useAuth();
  const [business, setBusiness] = useState<any>(),
    [locations, setLocations] = useState<any[]>([]),
    [items, setItems] = useState<any[]>([]),
    [modifierGroups, setModifierGroups] = useState<any[]>([]),
    [qty, setQty] = useState<Record<string, number>>({}),
    [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({}),
    [busy, setBusy] = useState(false),
    [reservation, setReservation] = useState({
      partySize: 2,
      reservedFor: "",
      contactName: "",
      contactPhone: "",
    });
  useEffect(() => {
    Promise.all([
      (supabase as any).from("businesses").select("id,name,description").eq("id", id).single(),
      (supabase as any)
        .from("business_locations")
        .select("*")
        .eq("business_id", id)
        .eq("merchant_status", "verified"),
      (supabase as any)
        .from("catalog_items")
        .select("*,catalog_categories!inner(name,catalogs!inner(business_id,active))")
        .eq("catalog_categories.catalogs.business_id", id)
        .eq("active", true),
      (supabase as any)
        .from("modifier_groups")
        .select("*,modifier_options(*)")
        .eq("modifier_options.active", true),
    ]).then(([b, l, i, m]: any) => {
      setBusiness(b.data);
      setLocations(l.data ?? []);
      setItems(i.data ?? []);
      setModifierGroups(m.data ?? []);
    });
  }, [id]);
  const total = useMemo(
    () =>
      items.reduce((sum, item) => {
        const modifierTotal = modifierGroups
          .filter((group) => group.item_id === item.id)
          .flatMap((group) => group.modifier_options ?? [])
          .filter((option) => (selectedModifiers[item.id] ?? []).includes(option.id))
          .reduce((optionSum, option) => optionSum + Number(option.price_delta_php), 0);
        return sum + (qty[item.id] ?? 0) * (Number(item.price_php) + modifierTotal);
      }, 0),
    [items, qty, modifierGroups, selectedModifiers],
  );
  function selectModifier(itemId: string, group: any, optionId: string) {
    setSelectedModifiers((current) => {
      const groupOptionIds = (group.modifier_options ?? []).map((option: any) => option.id);
      const previous = current[itemId] ?? [];
      const withoutGroup = previous.filter((id) => !groupOptionIds.includes(id));
      return { ...current, [itemId]: [...withoutGroup, optionId] };
    });
  }
  async function order() {
    if (!user) return toast.error("Sign in to place an order.");
    const location = locations[0];
    if (!location) return toast.error("No verified location is available.");
    const lines = items.filter((i) => qty[i.id] > 0);
    if (!lines.length) return toast.error("Add an item first.");
    setBusy(true);
    const { error } = await (supabase as any).rpc("create_marketplace_order", {
      p_business: id,
      p_location: location.id,
      p_mode: "pickup",
      p_delivery_address: null,
      p_items: lines.map((i) => ({
        catalog_item_id: i.id,
        quantity: qty[i.id],
        modifier_option_ids: selectedModifiers[i.id] ?? [],
      })),
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      setQty({});
      setSelectedModifiers({});
      toast.success("Order submitted for merchant confirmation.");
    }
  }
  async function reserve(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return toast.error("Sign in to request a reservation.");
    const location = locations.find((l) => l.reservations_enabled);
    if (!location) return toast.error("Reservations are not enabled.");
    const parsed = reservationRequestSchema.safeParse({
      locationId: location.id,
      partySize: reservation.partySize,
      reservedFor: reservation.reservedFor ? new Date(reservation.reservedFor).toISOString() : "",
      contactName: reservation.contactName,
      contactPhone: reservation.contactPhone,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const { error } = await (supabase as any).from("restaurant_reservations").insert({
      location_id: parsed.data.locationId,
      requester_id: user.id,
      party_size: parsed.data.partySize,
      reserved_for: parsed.data.reservedFor,
      contact_name: parsed.data.contactName,
      contact_phone: parsed.data.contactPhone,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Reservation requested; the merchant will confirm it.");
      setReservation({ partySize: 2, reservedFor: "", contactName: "", contactPhone: "" });
    }
  }
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container mx-auto px-4 py-8">
        <Link to="/marketplace" className="text-sm text-primary">
          ← Marketplace
        </Link>
        <h1 className="mt-4 font-display text-3xl font-bold">{business?.name ?? "Merchant"}</h1>
        <p className="text-muted-foreground">{business?.description}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_280px]">
          <div className="grid gap-3 sm:grid-cols-2">
            {items.length ? (
              items.map((i) => (
                <Card key={i.id}>
                  <CardContent className="p-4">
                    <Badge variant="outline">{i.catalog_categories?.name}</Badge>
                    <h2 className="mt-2 font-semibold">{i.name}</h2>
                    <p className="text-sm text-muted-foreground">{i.description}</p>
                    <p className="my-3 font-bold">₱{Number(i.price_php).toFixed(2)}</p>
                    {modifierGroups
                      .filter((group) => group.item_id === i.id)
                      .map((group) => (
                        <fieldset className="mb-3" key={group.id}>
                          <legend className="mb-1 text-sm font-medium">
                            {group.name}
                            {(group.required || group.min_choices > 0) && " · required"}
                          </legend>
                          <div className="flex flex-wrap gap-2">
                            {(group.modifier_options ?? []).map((option: any) => (
                              <Button
                                key={option.id}
                                type="button"
                                size="sm"
                                variant={
                                  (selectedModifiers[i.id] ?? []).includes(option.id)
                                    ? "default"
                                    : "outline"
                                }
                                onClick={() => selectModifier(i.id, group, option.id)}
                              >
                                {option.name}
                                {Number(option.price_delta_php) !== 0 &&
                                  ` +₱${Number(option.price_delta_php).toFixed(2)}`}
                              </Button>
                            ))}
                          </div>
                        </fieldset>
                      ))}
                    <div className="flex items-center gap-3">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() =>
                          setQty((q) => ({ ...q, [i.id]: Math.max(0, (q[i.id] ?? 0) - 1) }))
                        }
                      >
                        <Minus />
                      </Button>
                      <span>{qty[i.id] ?? 0}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setQty((q) => ({ ...q, [i.id]: (q[i.id] ?? 0) + 1 }))}
                      >
                        <Plus />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No available menu items yet.
                </CardContent>
              </Card>
            )}
          </div>
          <Card className="h-fit md:sticky md:top-20">
            <CardContent className="p-5">
              <ShoppingCart />
              <h2 className="mt-2 font-bold">Your pickup order</h2>
              <p className="my-4 text-2xl font-bold">₱{total.toFixed(2)}</p>
              <Button className="w-full" disabled={busy || total === 0} onClick={order}>
                {busy ? "Submitting…" : "Submit order"}
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">
                The merchant confirms availability before fulfillment. Payment collection is manual
                during the pilot.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      {locations.some((l) => l.reservations_enabled) && (
        <section className="container mx-auto px-4 pb-10">
          <Card>
            <CardContent className="p-5">
              <h2 className="font-display text-xl font-bold">Request a table</h2>
              <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={reserve}>
                <input
                  className="h-10 rounded-md border bg-background px-3"
                  type="datetime-local"
                  value={reservation.reservedFor}
                  onChange={(e) => setReservation({ ...reservation, reservedFor: e.target.value })}
                />
                <input
                  className="h-10 rounded-md border bg-background px-3"
                  type="number"
                  min="1"
                  max="100"
                  value={reservation.partySize}
                  onChange={(e) =>
                    setReservation({ ...reservation, partySize: Number(e.target.value) })
                  }
                />
                <input
                  className="h-10 rounded-md border bg-background px-3"
                  placeholder="Contact name"
                  value={reservation.contactName}
                  onChange={(e) => setReservation({ ...reservation, contactName: e.target.value })}
                />
                <input
                  className="h-10 rounded-md border bg-background px-3"
                  placeholder="Contact phone"
                  value={reservation.contactPhone}
                  onChange={(e) => setReservation({ ...reservation, contactPhone: e.target.value })}
                />
                <Button className="sm:col-span-2">Request reservation</Button>
              </form>
            </CardContent>
          </Card>
        </section>
      )}
      <SiteFooter />
    </div>
  );
}
