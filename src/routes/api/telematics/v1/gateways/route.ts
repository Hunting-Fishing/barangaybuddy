/* eslint-disable @typescript-eslint/no-explicit-any, prettier/prettier -- gateway tables are migration-backed ahead of generated Supabase types. */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CreateInput = z.object({
  name: z.string().trim().min(2).max(160),
  provider: z.string().trim().min(2).max(120),
  operator_id: z.string().uuid().nullable().optional(),
});

const ActionInput = z.object({
  gateway_id: z.string().uuid(),
  action: z.enum(["suspend", "activate", "retire", "rotate_secret"]),
});

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(view).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function randomHex(bytesLength: number) {
  const bytes = new Uint8Array(bytesLength);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
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

export const Route = createFileRoute("/api/telematics/v1/gateways")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const access = await requireAdmin(request);
        if ("error" in access) return access.error;

        const [gatewayResult, mappingResult, operatorResult, vehicleResult] = await Promise.all([
          (supabaseAdmin as any)
            .from("jeepney_telematics_gateways")
            .select("id,public_id,name,provider,operator_id,status,last_seen_at,created_at,updated_at")
            .order("created_at", { ascending: false }),
          (supabaseAdmin as any)
            .from("jeepney_external_vehicle_mappings")
            .select("id,gateway_id,external_vehicle_id,vehicle_id,active,note,created_at,updated_at")
            .order("created_at", { ascending: false }),
          (supabaseAdmin as any)
            .from("jeepney_operators")
            .select("id,display_name")
            .order("display_name", { ascending: true }),
          (supabaseAdmin as any)
            .from("jeepney_vehicles")
            .select("id,operator_id,label,plate_number,active")
            .order("label", { ascending: true }),
        ]);

        const failure = [gatewayResult.error, mappingResult.error, operatorResult.error, vehicleResult.error].find(Boolean);
        if (failure) {
          console.error("Telematics gateway admin load failed", failure);
          return jsonError("Could not load telematics gateways", 503);
        }

        return Response.json({
          gateways: gatewayResult.data ?? [],
          mappings: mappingResult.data ?? [],
          operators: operatorResult.data ?? [],
          vehicles: vehicleResult.data ?? [],
          recommended_ingest_path: "/api/telematics/v1/gateway-ingest-v2",
          server_time: new Date().toISOString(),
        });
      },

      POST: async ({ request }) => {
        const access = await requireAdmin(request);
        if ("error" in access) return access.error;

        const parsed = CreateInput.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid gateway provisioning request", details: parsed.error.flatten() },
            { status: 400 },
          );
        }

        if (parsed.data.operator_id) {
          const { data: operator, error } = await (supabaseAdmin as any)
            .from("jeepney_operators")
            .select("id")
            .eq("id", parsed.data.operator_id)
            .maybeSingle();
          if (error) return jsonError("Could not verify operator", 503);
          if (!operator) return jsonError("Operator not found", 404);
        }

        const publicId = `bbgw_${randomHex(12)}`;
        const secret = randomHex(32);
        const tokenHash = await sha256(secret);

        const { data: gateway, error } = await (supabaseAdmin as any)
          .from("jeepney_telematics_gateways")
          .insert({
            public_id: publicId,
            name: parsed.data.name,
            provider: parsed.data.provider,
            operator_id: parsed.data.operator_id ?? null,
            token_hash: tokenHash,
            status: "active",
          })
          .select("id,public_id,name,provider,operator_id,status,created_at")
          .maybeSingle();

        if (error || !gateway) {
          console.error("Telematics gateway provisioning failed", error);
          return jsonError("Could not provision telematics gateway", 503);
        }

        return Response.json({
          gateway,
          secret,
          warning:
            "This gateway secret is shown once. Store it in the vendor decoder/cooperative integration secret store before leaving this screen.",
          ingest: {
            path: "/api/telematics/v1/gateway-ingest-v2",
            headers: ["x-bb-gateway-id", "x-bb-gateway-secret"],
            identity_field: "external_vehicle_id",
            sequence_required: true,
          },
        });
      },

      PATCH: async ({ request }) => {
        const access = await requireAdmin(request);
        if ("error" in access) return access.error;

        const parsed = ActionInput.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid gateway action", details: parsed.error.flatten() },
            { status: 400 },
          );
        }

        const { data: gateway, error: gatewayError } = await (supabaseAdmin as any)
          .from("jeepney_telematics_gateways")
          .select("id,public_id,status")
          .eq("id", parsed.data.gateway_id)
          .maybeSingle();
        if (gatewayError) return jsonError("Could not load gateway", 503);
        if (!gateway) return jsonError("Gateway not found", 404);

        if (parsed.data.action === "rotate_secret") {
          if (gateway.status === "retired") return jsonError("Retired gateways cannot rotate credentials", 409);
          const secret = randomHex(32);
          const tokenHash = await sha256(secret);
          const { error } = await (supabaseAdmin as any)
            .from("jeepney_telematics_gateways")
            .update({ token_hash: tokenHash })
            .eq("id", gateway.id);
          if (error) return jsonError("Could not rotate gateway credential", 503);
          return Response.json({
            ok: true,
            public_id: gateway.public_id,
            secret,
            warning:
              "This replacement gateway secret is shown once. Update the upstream vendor/decoder before closing this screen.",
            ingest_path: "/api/telematics/v1/gateway-ingest-v2",
          });
        }

        const status =
          parsed.data.action === "suspend"
            ? "suspended"
            : parsed.data.action === "activate"
              ? "active"
              : "retired";

        if (gateway.status === "retired" && status !== "retired") {
          return jsonError("Retired gateways cannot be reactivated", 409);
        }

        const { error } = await (supabaseAdmin as any)
          .from("jeepney_telematics_gateways")
          .update({ status })
          .eq("id", gateway.id);
        if (error) return jsonError("Could not update gateway status", 503);

        if (status === "retired") {
          await (supabaseAdmin as any)
            .from("jeepney_external_vehicle_mappings")
            .update({ active: false })
            .eq("gateway_id", gateway.id);
        }

        return Response.json({ ok: true, public_id: gateway.public_id, status });
      },
    },
  },
});
