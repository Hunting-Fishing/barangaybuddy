/* eslint-disable @typescript-eslint/no-explicit-any -- Integration tables are added by this PR and enter generated types after migration deployment. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type QueueItem = {
  id: string;
  user_id: string;
  channel: "email" | "sms";
  official_safety_alerts: {
    headline: string;
    message: string;
    severity: string;
    source_name: string;
    source_url: string | null;
  };
};

async function sendEmail(item: QueueItem, email: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ROADSAFE_EMAIL_FROM;
  if (!key || !from) throw new Error("Resend is not configured");
  const alert = item.official_safety_alerts;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `roadsafe/${item.id}`,
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `[${alert.severity.toUpperCase()}] ${alert.headline}`,
      text: `${alert.message}\n\nSource: ${alert.source_name}${alert.source_url ? `\n${alert.source_url}` : ""}\n\nBarangay Buddy RoadSafe advisories do not guarantee safe passage.`,
    }),
  });
  const result = (await response.json()) as { id?: string; message?: string };
  if (!response.ok) throw new Error(result.message || `Resend HTTP ${response.status}`);
  return result.id ?? null;
}

async function sendSms(item: QueueItem, number: string) {
  const key = process.env.SEMAPHORE_API_KEY;
  if (!key) throw new Error("Semaphore is not configured");
  const alert = item.official_safety_alerts;
  const body = new URLSearchParams({
    apikey: key,
    number,
    message: `RoadSafe ${alert.severity.toUpperCase()}: ${alert.headline}. ${alert.message.slice(0, 320)} Verify with ${alert.source_name}.`,
    ...(process.env.SEMAPHORE_SENDER_NAME ? { sendername: process.env.SEMAPHORE_SENDER_NAME } : {}),
  });
  const response = await fetch("https://api.semaphore.co/api/v4/messages", {
    method: "POST",
    body,
  });
  const result = (await response.json()) as Array<{ message_id?: number; status?: string }>;
  if (!response.ok || !Array.isArray(result) || !result[0]?.message_id)
    throw new Error(`Semaphore HTTP ${response.status}`);
  return String(result[0].message_id);
}

export async function deliverRoadSafeNotifications(limit = 50) {
  const { data, error } = await (supabaseAdmin as any)
    .from("roadsafe_notifications")
    .select(
      "id,user_id,channel,attempts,official_safety_alerts(headline,message,severity,source_name,source_url)",
    )
    .in("channel", ["email", "sms"])
    .in("status", ["pending", "failed"])
    .lt("attempts", 5)
    .order("created_at")
    .limit(Math.min(limit, 100));
  if (error) throw error;
  let sent = 0;
  let failed = 0;
  for (const raw of data ?? []) {
    const item = raw as QueueItem;
    try {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(item.user_id);
      const { data: subscription } = await (supabaseAdmin as any)
        .from("roadsafe_subscriptions")
        .select("phone_number")
        .eq("user_id", item.user_id)
        .maybeSingle();
      const providerId =
        item.channel === "email"
          ? await sendEmail(item, userData.user?.email ?? "")
          : await sendSms(item, subscription?.phone_number ?? "");
      await (supabaseAdmin as any)
        .from("roadsafe_notifications")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_message_id: providerId,
          last_error: null,
          attempts: 1,
        })
        .eq("id", item.id);
      sent++;
    } catch (cause) {
      await (supabaseAdmin as any)
        .from("roadsafe_notifications")
        .update({
          status: "failed",
          last_error: (cause as Error).message.slice(0, 500),
          attempts: (raw.attempts ?? 0) + 1,
        })
        .eq("id", item.id);
      failed++;
    }
  }
  return { processed: (data ?? []).length, sent, failed };
}
