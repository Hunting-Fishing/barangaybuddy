/* eslint-disable @typescript-eslint/no-explicit-any -- hardware tables are migration-backed and may precede generated Supabase types. */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function requireAdmin(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return { error: jsonError("Unauthorized", 401) } as const;

  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(bearer);
  if (authError || !auth.user) return { error: jsonError("Unauthorized", 401) } as const;

  const { data: adminRole, error: roleError } = await (supabaseAdmin as any)
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (roleError) return { error: jsonError("Authorization service unavailable", 503) } as const;
  if (!adminRole) return { error: jsonError("Admin access required", 403) } as const;

  return { user: auth.user } as const;
}

export const Route = createFileRoute("/api/telematics/v1/devices")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const access = await requireAdmin(request);
        if ("error" in access) return access.error;

        const [devicesResult, assignmentsResult, operatorsResult, vehiclesResult, routesResult] =
          await Promise.all([
            (supabaseAdmin as any)
              .from("jeepney_gps_devices")
              .select(
                "id,operator_id,public_id,imei,manufacturer,model,firmware_version,sim_iccid,status,last_seen_at,last_latitude,last_longitude,last_speed_kph,last_heading,last_accuracy_m,ignition_on,external_voltage_v,backup_battery_pct,signal_dbm,last_event_type,created_at,updated_at",
              )
              .order("created_at", { ascending: false }),
            (supabaseAdmin as any)
              .from("jeepney_device_assignments")
              .select("id,device_id,vehicle_id,installed_at,installation_note")
              .is("removed_at", null),
            (supabaseAdmin as any)
              .from("jeepney_operators")
              .select("id,display_name")
              .order("display_name", { ascending: true }),
            (supabaseAdmin as any)
              .from("jeepney_vehicles")
              .select("id,route_id,label,plate_number,active")
              .order("label", { ascending: true }),
            (supabaseAdmin as any)
              .from("jeepney_routes")
              .select("id,operator_id,name,code,status")
              .order("name", { ascending: true }),
          ]);

        const failure = [
          devicesResult.error,
          assignmentsResult.error,
          operatorsResult.error,
          vehiclesResult.error,
          routesResult.error,
        ].find(Boolean);

        if (failure) {
          console.error("Jeepney GPS admin fleet lookup failed", failure);
          return jsonError("Could not load GPS fleet", 503);
        }

        return Response.json({
          devices: devicesResult.data ?? [],
          assignments: assignmentsResult.data ?? [],
          operators: operatorsResult.data ?? [],
          vehicles: vehiclesResult.data ?? [],
          routes: routesResult.data ?? [],
          server_time: new Date().toISOString(),
        });
      },
    },
  },
});
