import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  merchantLocationSchema,
  catalogItemSchema,
  orderTransitions,
  type MarketplaceOrderStatus,
  substitutionProposalSchema,
} from "@/lib/ecosystem";
export const Route = createFileRoute("/dashboard/business/$id/restaurant")({
  component: RestaurantManager,
});
function RestaurantManager() {
  const { id } = Route.useParams(),
    { user, loading } = useAuth(),
    nav = useNavigate();
  const [locations, setLocations] = useState<any[]>([]),
    [catalogs, setCatalogs] = useState<any[]>([]),
    [categories, setCategories] = useState<any[]>([]),
    [items, setItems] = useState<any[]>([]),
    [orders, setOrders] = useState<any[]>([]),
    [reservations, setReservations] = useState<any[]>([]),
    [substitutionDrafts, setSubstitutionDrafts] = useState<
      Record<string, { name: string; price: number }>
    >({}),
    [loc, setLoc] = useState({
      name: "Main branch",
      address: "",
      barangayCode: "",
      minimumOrderPhp: 0,
      prepMinutes: 30,
      pickupEnabled: true,
      deliveryEnabled: false,
      reservationsEnabled: false,
    }),
    [item, setItem] = useState({
      name: "",
      description: "",
      pricePhp: 0,
      stockQuantity: null as number | null,
      active: true,
    }),
    [modifier, setModifier] = useState({
      itemId: "",
      groupName: "Options",
      optionName: "",
      priceDeltaPhp: 0,
    }),
    [hours, setHours] = useState({ weekday: 1, opensAt: "09:00", closesAt: "18:00" }),
    [serviceArea, setServiceArea] = useState({ barangayCode: "", deliveryFeePhp: 0 });
  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);
  async function load() {
    const [l, c, cat, i, o, r] = await Promise.all([
      (supabase as any).from("business_locations").select("*").eq("business_id", id),
      (supabase as any).from("catalogs").select("*").eq("business_id", id),
      (supabase as any)
        .from("catalog_categories")
        .select("*,catalogs!inner(business_id)")
        .eq("catalogs.business_id", id),
      (supabase as any)
        .from("catalog_items")
        .select("*,catalog_categories!inner(name,catalogs!inner(business_id))")
        .eq("catalog_categories.catalogs.business_id", id),
      (supabase as any)
        .from("marketplace_orders")
        .select("*,marketplace_order_items(*,order_substitutions(*))")
        .eq("business_id", id)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("restaurant_reservations")
        .select("*,business_locations!inner(name,business_id)")
        .eq("business_locations.business_id", id)
        .order("reserved_for", { ascending: true }),
    ]);
    setLocations(l.data ?? []);
    setCatalogs(c.data ?? []);
    setCategories(cat.data ?? []);
    setItems(i.data ?? []);
    setOrders(o.data ?? []);
    setReservations(r.data ?? []);
  }
  useEffect(() => {
    if (user) load();
  }, [user, id]);
  async function addLocation(e: React.FormEvent) {
    e.preventDefault();
    const p = merchantLocationSchema.safeParse({ ...loc, businessId: id });
    if (!p.success) return toast.error(p.error.issues[0].message);
    const { error } = await (supabase as any).from("business_locations").insert({
      business_id: id,
      name: p.data.name,
      address: p.data.address,
      barangay_code: p.data.barangayCode,
      minimum_order_php: p.data.minimumOrderPhp,
      prep_minutes: p.data.prepMinutes,
      pickup_enabled: p.data.pickupEnabled,
      delivery_enabled: p.data.deliveryEnabled,
      reservations_enabled: p.data.reservationsEnabled,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Location added for admin verification.");
      load();
    }
  }
  async function bootstrapCatalog() {
    if (!locations[0]) return toast.error("Add a location first.");
    const { data: c, error } = await (supabase as any)
      .from("catalogs")
      .insert({
        business_id: id,
        location_id: locations[0].id,
        name: "Main menu",
        kind: "restaurant",
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    const { error: e } = await (supabase as any)
      .from("catalog_categories")
      .insert({ catalog_id: c.id, name: "Popular" });
    if (e) toast.error(e.message);
    else {
      toast.success("Menu created.");
      load();
    }
  }
  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!categories[0]) return toast.error("Create a menu first.");
    const p = catalogItemSchema.safeParse({ ...item, categoryId: categories[0].id });
    if (!p.success) return toast.error(p.error.issues[0].message);
    const { error } = await (supabase as any).from("catalog_items").insert({
      category_id: p.data.categoryId,
      name: p.data.name,
      description: p.data.description,
      price_php: p.data.pricePhp,
      stock_quantity: p.data.stockQuantity,
      active: p.data.active,
    });
    if (error) toast.error(error.message);
    else {
      setItem({ ...item, name: "", description: "", pricePhp: 0 });
      toast.success("Item added.");
      load();
    }
  }
  async function move(order: any, to: MarketplaceOrderStatus) {
    const { error } = await (supabase as any).rpc("transition_marketplace_order", {
      p_order: order.id,
      p_status: to,
      p_reason: "Merchant queue update",
    });
    if (error) toast.error(error.message);
    else load();
  }
  async function addModifier(e: React.FormEvent) {
    e.preventDefault();
    if (!modifier.itemId || !modifier.groupName || !modifier.optionName)
      return toast.error("Select an item and complete the modifier.");
    const { data: g, error } = await (supabase as any)
      .from("modifier_groups")
      .insert({ item_id: modifier.itemId, name: modifier.groupName, max_choices: 1 })
      .select()
      .single();
    if (error) return toast.error(error.message);
    const { error: o } = await (supabase as any).from("modifier_options").insert({
      group_id: g.id,
      name: modifier.optionName,
      price_delta_php: modifier.priceDeltaPhp,
    });
    if (o) toast.error(o.message);
    else {
      toast.success("Modifier option added.");
      setModifier({ ...modifier, optionName: "", priceDeltaPhp: 0 });
    }
  }
  async function proposeSubstitution(orderItemId: string) {
    const draft = substitutionDrafts[orderItemId];
    const parsed = substitutionProposalSchema.safeParse({
      orderItemId,
      replacementName: draft?.name,
      replacementPricePhp: draft?.price,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const { error } = await (supabase as any).rpc("propose_order_substitution", {
      p_order_item: parsed.data.orderItemId,
      p_replacement_name: parsed.data.replacementName,
      p_replacement_price_php: parsed.data.replacementPricePhp,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Substitution sent to the customer.");
      setSubstitutionDrafts((current) => ({ ...current, [orderItemId]: { name: "", price: 0 } }));
      load();
    }
  }
  async function moveReservation(reservationId: string, status: string) {
    const { error } = await (supabase as any).rpc("transition_restaurant_reservation", {
      p_reservation: reservationId,
      p_status: status,
    });
    if (error) toast.error(error.message);
    else load();
  }
  async function saveHours(e: React.FormEvent) {
    e.preventDefault();
    if (!locations[0]) return toast.error("Add a location first.");
    const { error } = await (supabase as any).from("business_hours").upsert(
      {
        location_id: locations[0].id,
        weekday: hours.weekday,
        opens_at: hours.opensAt,
        closes_at: hours.closesAt,
        is_closed: false,
      },
      { onConflict: "location_id,weekday" },
    );
    if (error) toast.error(error.message);
    else toast.success("Hours saved.");
  }
  async function addArea(e: React.FormEvent) {
    e.preventDefault();
    if (!locations[0] || !serviceArea.barangayCode)
      return toast.error("Add a location and barangay code.");
    const { error } = await (supabase as any).from("business_service_areas").upsert(
      {
        location_id: locations[0].id,
        barangay_code: serviceArea.barangayCode,
        delivery_fee_php: serviceArea.deliveryFeePhp,
      },
      { onConflict: "location_id,barangay_code" },
    );
    if (error) toast.error(error.message);
    else toast.success("Delivery service area saved.");
  }
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container mx-auto px-4 py-8">
        <Link to="/dashboard/business/$id" params={{ id }}>
          ← Business dashboard
        </Link>
        <h1 className="mt-3 font-display text-3xl font-bold">Restaurant Manager</h1>
        <p className="text-muted-foreground">
          Locations, menu availability, reservations, and manual fulfillment.
        </p>
        <Tabs defaultValue="orders" className="mt-6">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="orders">Order queue</TabsTrigger>
            <TabsTrigger value="reservations">Reservations</TabsTrigger>
            <TabsTrigger value="menu">Menu</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
          </TabsList>
          <TabsContent value="orders" className="space-y-3">
            {orders.length ? (
              orders.map((o) => (
                <Card key={o.id}>
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">Order #{o.order_number}</p>
                        <p className="text-sm">
                          ₱{Number(o.total_php).toFixed(2)} · {o.fulfillment_mode}
                        </p>
                      </div>
                      <Badge>{o.status}</Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {orderTransitions[o.status as MarketplaceOrderStatus]?.map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant={
                            s === "cancelled" || s === "rejected" ? "destructive" : "default"
                          }
                          onClick={() => move(o, s)}
                        >
                          {s.replaceAll("_", " ")}
                        </Button>
                      ))}
                    </div>
                    <div className="mt-4 space-y-3 border-t pt-4">
                      {(o.marketplace_order_items ?? []).map((line: any) => {
                        const pending = (line.order_substitutions ?? []).find(
                          (entry: any) => entry.status === "pending",
                        );
                        const draft = substitutionDrafts[line.id] ?? { name: "", price: 0 };
                        return (
                          <div key={line.id} className="rounded-md bg-muted/40 p-3">
                            <p className="text-sm font-medium">
                              {line.quantity}× {line.item_name} · ₱
                              {Number(line.unit_price_php).toFixed(2)} each
                            </p>
                            {pending ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Waiting on customer: {pending.replacement_name} at ₱
                                {Number(pending.replacement_price_php).toFixed(2)}
                              </p>
                            ) : (
                              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                                <Input
                                  placeholder="Replacement item"
                                  value={draft.name}
                                  onChange={(event) =>
                                    setSubstitutionDrafts((current) => ({
                                      ...current,
                                      [line.id]: { ...draft, name: event.target.value },
                                    }))
                                  }
                                />
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="Price"
                                  value={draft.price}
                                  onChange={(event) =>
                                    setSubstitutionDrafts((current) => ({
                                      ...current,
                                      [line.id]: { ...draft, price: Number(event.target.value) },
                                    }))
                                  }
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => proposeSubstitution(line.id)}
                                >
                                  Propose
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No orders in the queue.
                </CardContent>
              </Card>
            )}
          </TabsContent>
          <TabsContent value="reservations" className="space-y-3">
            {reservations.length ? (
              reservations.map((reservation) => (
                <Card key={reservation.id}>
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {reservation.contact_name} · party of {reservation.party_size}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(reservation.reserved_for).toLocaleString()} ·{" "}
                          {reservation.contact_phone}
                        </p>
                      </div>
                      <Badge>{reservation.status.replaceAll("_", " ")}</Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {reservation.status === "requested" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => moveReservation(reservation.id, "confirmed")}
                          >
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => moveReservation(reservation.id, "declined")}
                          >
                            Decline
                          </Button>
                        </>
                      )}
                      {reservation.status === "confirmed" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => moveReservation(reservation.id, "seated")}
                          >
                            Mark seated
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => moveReservation(reservation.id, "no_show")}
                          >
                            No show
                          </Button>
                        </>
                      )}
                      {reservation.status === "seated" && (
                        <Button
                          size="sm"
                          onClick={() => moveReservation(reservation.id, "completed")}
                        >
                          Complete
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No reservation requests.
                </CardContent>
              </Card>
            )}
          </TabsContent>
          <TabsContent value="menu">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Menu setup</CardTitle>
                </CardHeader>
                <CardContent>
                  {!catalogs.length ? (
                    <Button onClick={bootstrapCatalog}>Create starter menu</Button>
                  ) : (
                    <form className="space-y-3" onSubmit={addItem}>
                      <Label>Item name</Label>
                      <Input
                        value={item.name}
                        onChange={(e) => setItem({ ...item, name: e.target.value })}
                      />
                      <Label>Description</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => setItem({ ...item, description: e.target.value })}
                      />
                      <Label>Price (PHP)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={item.pricePhp}
                        onChange={(e) => setItem({ ...item, pricePhp: Number(e.target.value) })}
                      />
                      <Button>Add item</Button>
                    </form>
                  )}
                </CardContent>
              </Card>
              <div className="space-y-2">
                {items.map((i) => (
                  <Card key={i.id}>
                    <CardContent className="flex justify-between p-4">
                      <span>{i.name}</span>
                      <b>₱{Number(i.price_php).toFixed(2)}</b>
                    </CardContent>
                  </Card>
                ))}
                {!!items.length && (
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-bold">Add item modifier</h3>
                      <form className="mt-3 space-y-2" onSubmit={addModifier}>
                        <select
                          className="h-10 w-full rounded-md border bg-background px-3"
                          value={modifier.itemId}
                          onChange={(e) => setModifier({ ...modifier, itemId: e.target.value })}
                        >
                          <option value="">Select item</option>
                          {items.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </select>
                        <Input
                          placeholder="Group, e.g. Size"
                          value={modifier.groupName}
                          onChange={(e) => setModifier({ ...modifier, groupName: e.target.value })}
                        />
                        <Input
                          placeholder="Option, e.g. Large"
                          value={modifier.optionName}
                          onChange={(e) => setModifier({ ...modifier, optionName: e.target.value })}
                        />
                        <Input
                          type="number"
                          placeholder="Price adjustment"
                          value={modifier.priceDeltaPhp}
                          onChange={(e) =>
                            setModifier({ ...modifier, priceDeltaPhp: Number(e.target.value) })
                          }
                        />
                        <Button size="sm">Add modifier</Button>
                      </form>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="locations">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Add location</CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="space-y-3" onSubmit={addLocation}>
                    <Label>Name</Label>
                    <Input
                      value={loc.name}
                      onChange={(e) => setLoc({ ...loc, name: e.target.value })}
                    />
                    <Label>Address</Label>
                    <Input
                      value={loc.address}
                      onChange={(e) => setLoc({ ...loc, address: e.target.value })}
                    />
                    <Label>Barangay code</Label>
                    <Input
                      value={loc.barangayCode}
                      onChange={(e) => setLoc({ ...loc, barangayCode: e.target.value })}
                    />
                    <Button>Add for verification</Button>
                  </form>
                </CardContent>
              </Card>
              <div className="space-y-2">
                {locations.map((l) => (
                  <Card key={l.id}>
                    <CardContent className="p-4">
                      <b>{l.name}</b>
                      <p className="text-sm text-muted-foreground">{l.address}</p>
                      <Badge className="mt-2">{l.merchant_status}</Badge>
                    </CardContent>
                  </Card>
                ))}
                {!!locations.length && (
                  <Card>
                    <CardContent className="space-y-5 p-4">
                      <form className="grid gap-2 sm:grid-cols-4" onSubmit={saveHours}>
                        <select
                          className="h-10 rounded-md border bg-background px-2"
                          value={hours.weekday}
                          onChange={(e) => setHours({ ...hours, weekday: Number(e.target.value) })}
                        >
                          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                            <option key={d} value={i}>
                              {d}
                            </option>
                          ))}
                        </select>
                        <Input
                          type="time"
                          value={hours.opensAt}
                          onChange={(e) => setHours({ ...hours, opensAt: e.target.value })}
                        />
                        <Input
                          type="time"
                          value={hours.closesAt}
                          onChange={(e) => setHours({ ...hours, closesAt: e.target.value })}
                        />
                        <Button>Save hours</Button>
                      </form>
                      <form className="grid gap-2 sm:grid-cols-3" onSubmit={addArea}>
                        <Input
                          placeholder="Delivery barangay code"
                          value={serviceArea.barangayCode}
                          onChange={(e) =>
                            setServiceArea({ ...serviceArea, barangayCode: e.target.value })
                          }
                        />
                        <Input
                          type="number"
                          min="0"
                          placeholder="Delivery fee"
                          value={serviceArea.deliveryFeePhp}
                          onChange={(e) =>
                            setServiceArea({
                              ...serviceArea,
                              deliveryFeePhp: Number(e.target.value),
                            })
                          }
                        />
                        <Button>Add service area</Button>
                      </form>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
