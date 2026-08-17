/* eslint-disable @typescript-eslint/no-explicit-any -- gateway tables are migration-backed ahead of generated Supabase types. */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Input = z.object({
  name: z.string().trim().min(2).max(160),
  provider: z.string().trim().min(2).max(120),
  operator_id: z.string().uuid().nullable().optional(),
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

export const Route = createFileRoute("/api/telematics/v1/gateways/provision")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const access = await requireAdmin(request);
        if ("error" in access) return access.error;

        const parsed = Input.safeParse(await request.json().catch(() => null));
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
            path: "/api/telematics/v1/gateway-ingest",
            headers: ["x-bb-gateway-id", "x-bb-gateway-secret"],
            identity_field: "external_vehicle_id",
          },
        });
      },
    },
  },
});
