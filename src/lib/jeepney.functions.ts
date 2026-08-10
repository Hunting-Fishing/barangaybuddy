import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

const UUID = /^[0-9a-fA-F-]{36}$/;

export type JeepneyCheckoutResult = { clientSecret: string } | { error: string };

/** Monthly ₱100 listing subscription for one jeepney route. */
export const createJeepneyCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { routeId: string; returnUrl: string; environment: StripeEnv }) => {
    if (!UUID.test(data.routeId)) throw new Error("Invalid route");
    if (!/^https?:\/\//.test(data.returnUrl)) throw new Error("Invalid return URL");
    return data;
  })
  .handler(async ({ data, context }): Promise<JeepneyCheckoutResult> => {
    const { supabase, userId } = context;

    const { data: route } = await supabase
      .from("jeepney_routes")
      .select("id, name, operator_id, jeepney_operators!inner(id, user_id, display_name)")
      .eq("id", data.routeId)
      .maybeSingle();

    const operator = (route as any)?.jeepney_operators;
    if (!route || !operator || operator.user_id !== userId) {
      return { error: "Route not found." };
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: ["jeepney_route_monthly"] });
      if (!prices.data.length) return { error: "Listing price is not configured yet." };
      const price = prices.data[0]!;

      let customerId: string | undefined;
      const found = await stripe.customers.search({
        query: `metadata['userId']:'${userId}'`,
        limit: 1,
      });
      if (found.data.length) customerId = found.data[0]!.id;
      if (!customerId) {
        const created = await stripe.customers.create({
          ...(user?.email ? { email: user.email } : {}),
          metadata: { userId },
        });
        customerId = created.id;
      }

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: price.id, quantity: 1 }],
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        subscription_data: {
          description: `Jeepney route listing — ${(route as any).name}`,
          metadata: {
            kind: "jeepney",
            userId,
            operatorId: operator.id,
            routeId: data.routeId,
          },
        },
        metadata: {
          kind: "jeepney",
          userId,
          operatorId: operator.id,
          routeId: data.routeId,
        },
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/** Manual GCash / Maya / bank transfer reference — stays pending until reviewed. */
export const recordJeepneyManualPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { routeId: string; reference: string; note?: string }) => {
    if (!UUID.test(data.routeId)) throw new Error("Invalid route");
    const reference = data.reference.trim();
    if (reference.length < 4 || reference.length > 120) {
      throw new Error("Enter the payment reference number.");
    }
    return { routeId: data.routeId, reference, note: (data.note ?? "").slice(0, 500) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: route } = await supabase
      .from("jeepney_routes")
      .select("id, operator_id, jeepney_operators!inner(id, user_id)")
      .eq("id", data.routeId)
      .maybeSingle();

    const operator = (route as any)?.jeepney_operators;
    if (!route || !operator || operator.user_id !== userId) {
      return { error: "Route not found." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.from("jeepney_subscriptions").insert({
      operator_id: operator.id,
      route_id: data.routeId,
      status: "past_due",
      amount_php: 100,
      payment_ref: data.reference,
      payment_note: data.note || "Manual GCash / Maya / bank transfer",
    });
    if (error) return { error: "Could not record the payment. Please try again." };

    await supabaseAdmin
      .from("jeepney_routes")
      .update({ status: "pending" })
      .eq("id", data.routeId);

    return { ok: true };
  });
