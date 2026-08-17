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

/** Admin: approve a claim — hands the route to the claimant and registers their physical fleet unit. */
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

    // Find or create the claimant's cooperative/operator profile.
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

    // Only an unclaimed community route may be transferred. Return the row so a
    // concurrent approval cannot silently create a fleet vehicle under the wrong route owner.
    const { data: transferredRoute, error: routeError } = await supabaseAdmin
      .from("jeepney_routes")
      .update({ operator_id: operatorId })
      .eq("id", claim.route_id)
      .is("operator_id", null)
      .select("id")
      .maybeSingle();
    if (routeError) return { error: "Could not transfer the route." };
    if (!transferredRoute) return { error: "This route was already claimed by another operator." };

    // Phase 3 ownership: the physical jeepney belongs to the operator/cooperative.
    // route_id remains only a nullable legacy/home-route hint; dispatch trips decide
    // which route this unit is actually serving at any moment.
    const { data: createdVehicle, error: vehicleError } = await (supabaseAdmin as any)
      .from("jeepney_vehicles")
      .insert({
        operator_id: operatorId,
        route_id: claim.route_id,
        label: `Jeepney ${claim.body_number}`,
        plate_number: claim.body_number,
        franchise_number: claim.franchise_number,
        photo_url: claim.photo_path,
        active: true,
      })
      .select("id")
      .maybeSingle();

    if (vehicleError || !createdVehicle) {
      // Supabase JS does not wrap these app-level steps in a transaction. Compensate
      // the route transfer so the claim remains retryable instead of half-approved.
      await supabaseAdmin
        .from("jeepney_routes")
        .update({ operator_id: null })
        .eq("id", claim.route_id)
        .eq("operator_id", operatorId);
      console.error("Claim fleet vehicle creation failed; route transfer rolled back", vehicleError);
      return { error: "Could not create the physical fleet unit. The route transfer was rolled back." };
    }

    const { error: claimUpdateError } = await supabaseAdmin
      .from("jeepney_route_claims")
      .update({
        status: "approved",
        review_note: data.note || null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.claimId)
      .eq("status", "pending");

    if (claimUpdateError) {
      // Keep application state coherent if the final claim-state write fails.
      await (supabaseAdmin as any).from("jeepney_vehicles").delete().eq("id", createdVehicle.id);
      await supabaseAdmin
        .from("jeepney_routes")
        .update({ operator_id: null })
        .eq("id", claim.route_id)
        .eq("operator_id", operatorId);
      console.error("Claim status update failed; vehicle and route transfer rolled back", claimUpdateError);
      return { error: "Could not finalize the claim approval. No route ownership change was kept." };
    }

    return { ok: true };
  });
