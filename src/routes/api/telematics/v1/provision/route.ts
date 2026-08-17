/* eslint-disable @typescript-eslint/no-explicit-any -- Jeepney hardware tables are introduced by the matching migration. */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ProvisionInput = z.object({
  operator_id: z.string().uuid(),
  vehicle_id: z.string().uuid().nullable().optional(),
  imei: z.string().trim().min(6).max(40).nullable().optional(),
  manufacturer: z.string().trim().min(1).max(80).nullable().optional(),
  model: z.string().trim().min(1).max(80).nullable().optional(),
  firmware_version: z.string().trim().min(1).max(80).nullable().optional(),
  sim_iccid: z.string().trim().min(6).max(40).nullable().optional(),
  installation_note: z.string().trim().max(500).nullable().optional(),
});

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(view)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  return toHex(await crypto.subtle.digest("SHA-256", bytes));
}

function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return Response.json({ error: message, ...(extra ?? {}) }, { status });
}

export const Route = createFileRoute("/api/telematics/v1/provision")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
        if (!bearer) return jsonError("Unauthorized", 401);

        const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(bearer);
        if (authError || !auth.user) return jsonError("Unauthorized", 401);

        const { data: adminRole, error: roleError } = await (supabaseAdmin as any)
          .from("user_roles")
          .select("role")
          .eq("user_id", auth.user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (roleError) return jsonError("Authorization service unavailable", 503);
        if (!adminRole) return jsonError("Admin access required", 403);

        const parsed = ProvisionInput.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ error: "Invalid provisioning request", details: parsed.error.flatten() }, { status: 400 });
        }

        const { data: operator, error: operatorError } = await (supabaseAdmin as any)
          .from("jeepney_operators")
          .select("id,display_name")
          .eq("id", parsed.data.operator_id)
          .maybeSingle();
        if (operatorError) return jsonError("Could not verify operator", 503);
        if (!operator) return jsonError("Operator not found", 404);

        if (parsed.data.vehicle_id) {
          const { data: vehicle, error: vehicleError } = await (supabaseAdmin as any)
            .from("jeepney_vehicles")
            .select("id,route_id,active")
            .eq("id", parsed.data.vehicle_id)
            .maybeSingle();
          if (vehicleError) return jsonError("Could not verify vehicle", 503);
          if (!vehicle) return jsonError("Vehicle not found", 404);

          const { data: route, error: routeError } = await (supabaseAdmin as any)
            .from("jeepney_routes")
            .select("id,operator_id")
            .eq("id", vehicle.route_id)
            .maybeSingle();
          if (routeError) return jsonError("Could not verify vehicle ownership", 503);
          if (!route || route.operator_id !== parsed.data.operator_id) {
            return jsonError("Vehicle does not belong to the selected operator", 409);
          }
        }

        const secret = generateSecret();
        const tokenHash = await sha256(secret);

        const { data: device, error: deviceError } = await (supabaseAdmin as any)
          .from("jeepney_gps_devices")
          .insert({
            operator_id: parsed.data.operator_id,
            imei: parsed.data.imei ?? null,
            manufacturer: parsed.data.manufacturer ?? null,
            model: parsed.data.model ?? null,
            firmware_version: parsed.data.firmware_version ?? null,
            sim_iccid: parsed.data.sim_iccid ?? null,
            token_hash: tokenHash,
            status: "provisioned",
          })
          .select("id,public_id,status,imei,manufacturer,model")
          .maybeSingle();

        if (deviceError || !device) {
          console.error("Jeepney GPS provisioning insert failed", deviceError);
          return jsonError(
            deviceError?.code === "23505" ? "IMEI or device identity already exists" : "Could not provision GPS device",
            deviceError?.code === "23505" ? 409 : 500,
          );
        }

        if (parsed.data.vehicle_id) {
          const { error: assignmentError } = await (supabaseAdmin as any)
            .from("jeepney_device_assignments")
            .insert({
              device_id: device.id,
              vehicle_id: parsed.data.vehicle_id,
              installation_note: parsed.data.installation_note ?? null,
              installation_reference: `admin:${auth.user.id}`,
            });

          if (assignmentError) {
            // Provisioning should be atomic from the caller's perspective. If the
            // requested installation cannot be created, remove the just-created
            // device so the admin can correct the vehicle/device assignment and retry.
            await (supabaseAdmin as any).from("jeepney_gps_devices").delete().eq("id", device.id);
            console.error("Jeepney GPS assignment failed", assignmentError);
            return jsonError(
              assignmentError.code === "23505"
                ? "That device or vehicle already has an active tracker installation"
                : "Could not assign GPS device to vehicle",
              assignmentError.code === "23505" ? 409 : 500,
            );
          }
        }

        return Response.json({
          device: {
            public_id: device.public_id,
            status: device.status,
            imei: device.imei,
            manufacturer: device.manufacturer,
            model: device.model,
            operator_id: parsed.data.operator_id,
            vehicle_id: parsed.data.vehicle_id ?? null,
          },
          secret,
          warning: "Store this device secret now. Barangay Buddy stores only its SHA-256 hash and cannot display the original secret again.",
          ingest: {
            path: "/api/telematics/v1/ingest",
            headers: ["x-bb-device-id", "x-bb-device-secret"],
          },
        });
      },
    },
  },
});
