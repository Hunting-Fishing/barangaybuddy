/* eslint-disable @typescript-eslint/no-explicit-any -- gateway tables are migration-backed ahead of generated Supabase types. */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Input = z.object({
  gateway_id: z.string().uuid(),
  external_vehicle_id: z.string().trim().min(1).max(180),
  vehicle_id: z.string().uuid(),
  note: z.string().trim().max(500).nullable().optional(),
});

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function requireAdmin(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return { error: jsonError("Unauthorized", 401) } as const;
  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(bearer);
  if (authError || !auth.user) return { error: jsonError("Unauthorized", 401) } as const;
  const { data: role, error: roleError } = await (supabaseAdmin as any)
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (roleError) return { error: jsonError("Authorization service unavailable", 503) } as const;
  if (!role) return { error: jsonError("Admin access required", 403) } as const;
  return { user: auth.user } as const;
}

export const Route = createFileRoute("/api/telematics/v1/gateways/map")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const access = await requireAdmin(request);
        if ("error" in access) return access.error;

        const parsed = Input.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid external vehicle mapping request", details: parsed.error.flatten() },
            { status: 400 },
          );
        }

        const [{ data: gateway, error: gatewayError }, { data: vehicle, error: vehicleError }] =
          await Promise.all([
            (supabaseAdmin as any)
              .from("jeepney_telematics_gateways")
              .select("id,operator_id,status,provider,name")
              .eq("id", parsed.data.gateway_id)
              .maybeSingle(),
            (supabaseAdmin as any)
              .from("jeepney_vehicles")
              .select("id,operator_id,label,active")
              .eq("id", parsed.data.vehicle_id)
              .maybeSingle(),
          ]);

        if (gatewayError || vehicleError) return jsonError("Could not verify gateway/vehicle", 503);
        if (!gateway) return jsonError("Gateway not found", 404);
        if (!vehicle) return jsonError("Vehicle not found", 404);
        if (gateway.status === "retired") return jsonError("Retired gateway cannot receive mappings", 409);
        if (vehicle.active === false) return jsonError("Inactive vehicle cannot receive a new mapping", 409);
        if (gateway.operator_id && gateway.operator_id !== vehicle.operator_id) {
          return jsonError("Gateway and vehicle belong to different operators", 409);
        }

        const { data: existingVehicleMapping } = await (supabaseAdmin as any)
          .from("jeepney_external_vehicle_mappings")
          .select("id,external_vehicle_id")
          .eq("gateway_id", gateway.id)
          .eq("vehicle_id", vehicle.id)
          .maybeSingle();
        if (
          existingVehicleMapping &&
          existingVehicleMapping.external_vehicle_id !== parsed.data.external_vehicle_id
        ) {
          return jsonError("This vehicle is already mapped to another external vehicle ID on the gateway", 409);
        }

        const { data: mapping, error: mappingError } = await (supabaseAdmin as any)
          .from("jeepney_external_vehicle_mappings")
          .upsert(
            {
              gateway_id: gateway.id,
              external_vehicle_id: parsed.data.external_vehicle_id,
              vehicle_id: vehicle.id,
              note: parsed.data.note ?? null,
              active: true,
            },
            { onConflict: "gateway_id,external_vehicle_id" },
          )
          .select("id,gateway_id,external_vehicle_id,vehicle_id,active,note,updated_at")
          .maybeSingle();

        if (mappingError || !mapping) {
          console.error("External vehicle mapping failed", mappingError);
          return jsonError("Could not save external vehicle mapping", 503);
        }

        return Response.json({
          ok: true,
          mapping,
          gateway: { provider: gateway.provider, name: gateway.name },
          vehicle: { label: vehicle.label },
        });
      },
    },
  },
});
