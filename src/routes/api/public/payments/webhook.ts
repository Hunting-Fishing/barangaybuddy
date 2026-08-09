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

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.payment_status !== "unpaid") {
        await activateMemberships(session, env);
      }
      break;
    }
    case "checkout.session.async_payment_succeeded":
      await activateMemberships(event.data.object, env);
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
