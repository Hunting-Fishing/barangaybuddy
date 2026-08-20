import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

export type CheckoutResult = { clientSecret: string } | { error: string };

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

/**
 * League player membership checkout.
 * seats = number of players being paid for (1 for self, up to 8 for a team).
 */
export const createLeagueCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      groupId: string;
      seats: number;
      teamId?: string | null;
      returnUrl: string;
      environment: StripeEnv;
    }) => {
      if (!/^[0-9a-fA-F-]{36}$/.test(data.groupId)) throw new Error("Invalid group");
      if (data.teamId && !/^[0-9a-fA-F-]{36}$/.test(data.teamId)) throw new Error("Invalid team");
      if (!Number.isInteger(data.seats) || data.seats < 1 || data.seats > 8) {
        throw new Error("Seats must be between 1 and 8");
      }
      return data;
    },
  )
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { supabase, userId } = context;

    const { data: group, error: groupError } = await supabase
      .from("groups")
      .select("id, name, membership_fee_php")
      .eq("id", data.groupId)
      .maybeSingle();
    if (groupError || !group) return { error: "League not found." };

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const stripe = createStripeClient(data.environment);

      const prices = await stripe.prices.list({ lookup_keys: ["league_player_yearly"] });
      if (!prices.data.length) return { error: "Membership price is not configured yet." };
      const price = prices.data[0];

      const customerId = await resolveOrCreateCustomer(stripe, {
        email: user?.email ?? undefined,
        userId,
      });

      const baseParams = {
        line_items: [{ price: price.id, quantity: data.seats }],
        mode: "payment" as const,
        ui_mode: "embedded_page" as const,
        return_url: data.returnUrl,
        customer: customerId,
        payment_intent_data: {
          description: `${group.name} — player membership (${data.seats} player${
            data.seats > 1 ? "s" : ""
          })`,
        },
        metadata: {
          userId,
          groupId: data.groupId,
          seats: String(data.seats),
          ...(data.teamId ? { teamId: data.teamId } : {}),
        },
      };

      // Prefer GCash + Maya (PH wallets) when the Stripe account supports them;
      // fall back to whatever the account has enabled otherwise.
      let session;
      try {
        session = await stripe.checkout.sessions.create({
          ...baseParams,
          payment_method_types: ["gcash", "paymaya", "card"] as never,
        });
      } catch {
        session = await stripe.checkout.sessions.create(baseParams);
      }

      return { clientSecret: session.client_secret ?? "" };

    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
