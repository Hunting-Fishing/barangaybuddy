import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: any = null;
function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

const ZERO_DECIMAL = new Set(["jpy", "krw", "vnd"]);

function majorUnit(amount: number, currency: string) {
  return ZERO_DECIMAL.has((currency ?? "").toLowerCase()) ? amount : Math.round(amount / 100);
}

async function activateMemberships(session: any, env: StripeEnv) {
  const meta = session.metadata ?? {};
  const groupId: string | undefined = meta.groupId;
  const payerId: string | undefined = meta.userId;
  const teamId: string | undefined = meta.teamId;
  const seats = Math.max(1, Number(meta.seats ?? 1));
  if (!groupId || !payerId) return;

  const db = getSupabase();

  const { data: group } = await db
    .from("groups")
    .select("membership_period_days, membership_fee_php")
    .eq("id", groupId)
    .maybeSingle();

  const periodDays = Number((group as any)?.membership_period_days ?? 365);
  const feePhp = Number((group as any)?.membership_fee_php ?? 100);
  const now = new Date();
  const expires = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

  // Who gets activated: the payer, plus confirmed team-mates when paying for a team.
  const userIds = new Set<string>([payerId]);
  if (teamId) {
    const { data: roster } = await db
      .from("group_team_members")
      .select("user_id, is_captain")
      .eq("team_id", teamId)
      .eq("status", "confirmed");
    const ordered = (roster ?? [])
      .slice()
      .sort((a: any, b: any) => Number(b.is_captain) - Number(a.is_captain));
    for (const row of ordered as any[]) {
      if (userIds.size >= seats) break;
      userIds.add(row.user_id);
    }
  }

  for (const uid of userIds) {
    await db.from("group_memberships").upsert(
      {
        group_id: groupId,
        user_id: uid,
        role: "member",
        tier: "player",
        status: "active",
        started_at: now.toISOString(),
        expires_at: expires.toISOString(),
        payment_ref: session.id,
        payment_note: teamId ? "Paid online (team)" : "Paid online",
        amount_paid_php: feePhp,
        updated_at: now.toISOString(),
      },
      { onConflict: "group_id,user_id" },
    );
  }

  await db.from("group_payments").upsert(
    {
      group_id: groupId,
      user_id: payerId,
      amount_php: majorUnit(Number(session.amount_total ?? 0), session.currency ?? "php"),
      provider: "stripe",
      method: session.payment_method_types?.[0] ?? null,
      status: "paid",
      external_id: session.id,
      raw: { environment: env, teamId: teamId ?? null, seats },
      updated_at: now.toISOString(),
    },
    { onConflict: "external_id" },
  );
}

async function activateJeepneyListing(session: any, env: StripeEnv) {
  const meta = session.metadata ?? {};
  const operatorId: string | undefined = meta.operatorId;
  const routeId: string | undefined = meta.routeId;
  if (!operatorId || !routeId) return;

  const db = getSupabase();
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);

  await db.from("jeepney_subscriptions").insert({
    operator_id: operatorId,
    route_id: routeId,
    status: "active",
    amount_php: majorUnit(Number(session.amount_total ?? 10000), session.currency ?? "php"),
    current_period_end: periodEnd.toISOString(),
    stripe_customer_id: session.customer ?? null,
    stripe_subscription_id: session.subscription ?? null,
    payment_ref: session.id,
    payment_note: "Paid online",
    environment: env,
  });

  await db.from("jeepney_routes").update({ status: "published" }).eq("id", routeId);
}

async function syncJeepneySubscription(subscription: any, env: StripeEnv) {
  const meta = subscription.metadata ?? {};
  if (meta.kind !== "jeepney" || !meta.routeId) return;

  const db = getSupabase();
  const item = subscription.items?.data?.[0];
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const active = subscription.status === "active" || subscription.status === "trialing";

  await db
    .from("jeepney_subscriptions")
    .update({
      status: active ? "active" : subscription.status === "canceled" ? "cancelled" : "past_due",
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);

  await db
    .from("jeepney_routes")
    .update({ status: active ? "published" : "suspended" })
    .eq("id", meta.routeId);
}

async function activateDeliveryRider(session: any, env: StripeEnv) {
  const meta = session.metadata ?? {};
  const riderId: string | undefined = meta.riderId;
  if (!riderId) return;

  const db = getSupabase();
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000);

  await db.from("delivery_rider_subscriptions").insert({
    rider_id: riderId,
    status: "active",
    amount_php: majorUnit(Number(session.amount_total ?? 8000), session.currency ?? "php"),
    current_period_end: periodEnd.toISOString(),
    stripe_customer_id: session.customer ?? null,
    stripe_subscription_id: session.subscription ?? null,
    payment_ref: session.id,
    payment_note: "Paid online",
    environment: env,
  });
}

async function markDeliveryJobPaid(session: any) {
  const meta = session.metadata ?? {};
  const jobId: string | undefined = meta.jobId;
  if (!jobId) return;

  await getSupabase()
    .from("delivery_jobs")
    .update({
      is_prepaid: true,
      payment_method: "online",
      payment_ref: session.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

async function syncDeliverySubscription(subscription: any, env: StripeEnv) {
  const meta = subscription.metadata ?? {};
  if (meta.kind !== "delivery_rider") return;

  const db = getSupabase();
  const item = subscription.items?.data?.[0];
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const active = subscription.status === "active" || subscription.status === "trialing";

  await db
    .from("delivery_rider_subscriptions")
    .update({
      status: active ? "active" : subscription.status === "canceled" ? "cancelled" : "past_due",
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);

  if (!active) {
    await db
      .from("delivery_riders")
      .update({ is_online: false })
      .eq("id", meta.riderId ?? "");
  }
}

async function routeCheckoutSession(session: any, env: StripeEnv) {
  const kind = (session.metadata ?? {}).kind;
  if (kind === "jeepney") return activateJeepneyListing(session, env);
  if (kind === "delivery_rider") return activateDeliveryRider(session, env);
  if (kind === "delivery_job") return markDeliveryJobPaid(session);
  return activateMemberships(session, env);
}


async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.payment_status !== "unpaid") {
        await routeCheckoutSession(session, env);
      }
      break;
    }
    case "checkout.session.async_payment_succeeded": {
      await routeCheckoutSession(event.data.object, env);
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncJeepneySubscription(event.data.object, env);
      await syncDeliverySubscription(event.data.object, env);
      break;
    default:
      console.log("Unhandled payment event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook received with invalid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv as StripeEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
