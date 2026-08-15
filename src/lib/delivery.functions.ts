import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

const UUID = /^[0-9a-fA-F-]{36}$/;

export type DeliveryCheckoutResult = { clientSecret: string } | { error: string };

async function resolveCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  userId: string,
  email?: string,
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(userId)) throw new Error("Invalid user");
  const found = await stripe.customers.search({
    query: `metadata['userId']:'${userId}'`,
    limit: 1,
  });
  if (found.data.length) return found.data[0]!.id;
  const created = await stripe.customers.create({
    ...(email ? { email } : {}),
    metadata: { userId },
  });
  return created.id;
}

/** ₱80 / month rider membership. */
export const createRiderSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl: string; environment: StripeEnv }) => {
    if (!/^https?:\/\//.test(data.returnUrl)) throw new Error("Invalid return URL");
    return data;
  })
  .handler(async ({ data, context }): Promise<DeliveryCheckoutResult> => {
    const { supabase, userId } = context;

    const { data: rider } = await supabase
      .from("delivery_riders")
      .select("id, status, display_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (!rider) return { error: "Complete your rider application first." };
    if (rider.status !== "approved") {
      return { error: "Your rider application is still being reviewed." };
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: ["delivery_rider_monthly"] });
      if (!prices.data.length) return { error: "Rider membership price is not configured yet." };
      const price = prices.data[0]!;
      const customerId = await resolveCustomer(stripe, userId, user?.email ?? undefined);

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: price.id, quantity: 1 }],
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        metadata: { kind: "delivery_rider", userId, riderId: rider.id },
        subscription_data: {
          metadata: { kind: "delivery_rider", userId, riderId: rider.id },
        },
      });
      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/** Prepay a delivery job online instead of paying the rider in cash. */
export const createJobPrepayCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { jobId: string; returnUrl: string; environment: StripeEnv }) => {
    if (!UUID.test(data.jobId)) throw new Error("Invalid job");
    if (!/^https?:\/\//.test(data.returnUrl)) throw new Error("Invalid return URL");
    return data;
  })
  .handler(async ({ data, context }): Promise<DeliveryCheckoutResult> => {
    const { supabase, userId } = context;

    const { data: job } = await supabase
      .from("delivery_jobs")
      .select("id, customer_id, total_fare_php, is_prepaid, status, service_type")
      .eq("id", data.jobId)
      .maybeSingle();

    if (!job || job.customer_id !== userId) return { error: "Delivery not found." };
    if (job.is_prepaid) return { error: "This delivery is already paid." };
    if (job.status === "cancelled" || job.status === "delivered") {
      return { error: "This delivery can no longer be paid online." };
    }
    if (!job.total_fare_php || job.total_fare_php < 20) {
      return { error: "This delivery has no payable fare." };
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const stripe = createStripeClient(data.environment);
      const customerId = await resolveCustomer(stripe, userId, user?.email ?? undefined);

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "php",
              product_data: { name: "Barangay Buddy Delivery fare" },
              unit_amount: job.total_fare_php * 100,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        payment_intent_data: { description: "Barangay Buddy Delivery fare" },
        metadata: { kind: "delivery_job", userId, jobId: job.id },
      });
      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
