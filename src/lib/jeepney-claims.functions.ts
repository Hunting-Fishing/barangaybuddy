import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UUID = /^[0-9a-fA-F-]{36}$/;

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Administrator access required.");
}

export type AdminClaim = {
  id: string;
  route_id: string;
  route_name: string;
  operator_name: string;
  contact_phone: string | null;
  body_number: string;
  franchise_number: string | null;
  status: string;
  created_at: string;
  photo_url: string | null;
  document_url: string | null;
};

/** Admin: pending claims with short-lived signed links to the evidence photos. */
export const listJeepneyClaims = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminClaim[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data } = await supabaseAdmin
      .from("jeepney_route_claims")
      .select(
        "id, route_id, operator_name, contact_phone, body_number, franchise_number, status, created_at, photo_path, document_path, jeepney_routes(name)",
      )
      .order("created_at", { ascending: false })
      .limit(50);

    const rows = (data ?? []) as any[];
    const signed = await Promise.all(
      rows.map(async (row) => {
        const sign = async (path: string | null) => {
          if (!path) return null;
          const { data: s } = await supabaseAdmin.storage
            .from("jeepney-claims")
            .createSignedUrl(path, 600);
          return s?.signedUrl ?? null;
        };
        return {
          id: row.id,
          route_id: row.route_id,
          route_name: row.jeepney_routes?.name ?? "Route",
          operator_name: row.operator_name,
          contact_phone: row.contact_phone,
          body_number: row.body_number,
          franchise_number: row.franchise_number,
          status: row.status,
          created_at: row.created_at,
          photo_url: await sign(row.photo_path),
          document_url: await sign(row.document_path),
        } satisfies AdminClaim;
      }),
    );
    return signed;
  });

/** Admin: approve a claim — hands the route to the claimant and registers their jeepney. */
export const reviewJeepneyClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { claimId: string; approve: boolean; note?: string }) => {
    if (!UUID.test(data.claimId)) throw new Error("Invalid claim");
    return { claimId: data.claimId, approve: !!data.approve, note: (data.note ?? "").slice(0, 500) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: claim } = await supabaseAdmin
      .from("jeepney_route_claims")
      .select("*")
      .eq("id", data.claimId)
      .maybeSingle();
    if (!claim) return { error: "Claim not found." };
    if (claim.status !== "pending") return { error: "This claim was already reviewed." };

    if (!data.approve) {
      await supabaseAdmin
        .from("jeepney_route_claims")
        .update({
          status: "rejected",
          review_note: data.note || null,
          reviewed_by: context.userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", data.claimId);
      return { ok: true };
    }

    // Find or create the claimant's operator profile.
    let operatorId: string | undefined;
    const { data: existing } = await supabaseAdmin
      .from("jeepney_operators")
      .select("id")
      .eq("user_id", claim.user_id)
      .maybeSingle();
    operatorId = existing?.id;
    if (!operatorId) {
      const { data: created, error } = await supabaseAdmin
        .from("jeepney_operators")
        .insert({ user_id: claim.user_id, display_name: claim.operator_name })
        .select("id")
        .single();
      if (error || !created) return { error: "Could not create the operator profile." };
      operatorId = created.id;
    }

    const { error: routeError } = await supabaseAdmin
      .from("jeepney_routes")
      .update({ operator_id: operatorId })
      .eq("id", claim.route_id)
      .is("operator_id", null);
    if (routeError) return { error: "Could not transfer the route." };

    await supabaseAdmin.from("jeepney_vehicles").insert({
      route_id: claim.route_id,
      label: `Jeepney ${claim.body_number}`,
      plate_number: claim.body_number,
      franchise_number: claim.franchise_number,
      photo_url: claim.photo_path,
      active: true,
    });

    await supabaseAdmin
      .from("jeepney_route_claims")
      .update({
        status: "approved",
        review_note: data.note || null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.claimId);

    return { ok: true };
  });
