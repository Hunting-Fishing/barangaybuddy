import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
async function requireAdmin(context: any) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Administrator access required.");
}
export const reviewMerchantLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z.object({ locationId: z.string().uuid(), status: z.enum(["verified", "suspended"]) }).parse(v),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await (supabaseAdmin as any)
      .from("business_locations")
      .update({ merchant_status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.locationId);
    if (error) throw error;
    return { ok: true };
  });
export const reviewDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z
      .object({
        driverId: z.string().uuid(),
        status: z.enum(["approved", "suspended", "rejected"]),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await (supabaseAdmin as any)
      .from("driver_profiles")
      .update({
        status: data.status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      })
      .eq("id", data.driverId);
    if (error) throw error;
    return { ok: true };
  });
export const dispatchDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z
      .object({
        orderId: z.string().uuid(),
        driverId: z.string().uuid(),
        pickupAddress: z.string().min(5).max(500),
        destinationAddress: z.string().min(5).max(500),
        driverPayPhp: z.number().min(0).max(100000),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: driver } = await (supabaseAdmin as any)
      .from("driver_profiles")
      .select("id,status")
      .eq("id", data.driverId)
      .single();
    if (driver?.status !== "approved") throw new Error("Only approved drivers may be dispatched.");
    const { error } = await (supabaseAdmin as any).from("delivery_jobs").insert({
      order_id: data.orderId,
      driver_id: data.driverId,
      pickup_address: data.pickupAddress,
      destination_address: data.destinationAddress,
      estimated_driver_pay_php: data.driverPayPhp,
      created_by: context.userId,
    });
    if (error) throw error;
    return { ok: true };
  });
