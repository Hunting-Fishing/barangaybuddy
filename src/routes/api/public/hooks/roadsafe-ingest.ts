/* eslint-disable @typescript-eslint/no-explicit-any -- Integration tables are added by this PR and enter generated types after migration deployment. */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const AlertPayload = z.object({
  external_id: z.string().min(1).max(200),
  barangay_code: z.string().min(1).max(20),
  headline: z.string().min(3).max(180),
  message: z.string().min(3).max(2000),
  severity: z.enum(["information", "watch", "warning", "emergency"]),
  source_name: z.enum(["PAGASA", "NDRRMC", "DPWH", "LGU", "Barangay Office"]),
  source_url: z.string().url().nullable().optional(),
  issued_at: z.string().datetime(),
  expires_at: z.string().datetime(),
});

export const Route = createFileRoute("/api/public/hooks/roadsafe-ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!process.env.ROADSAFE_INGEST_SECRET || provided !== process.env.ROADSAFE_INGEST_SECRET)
          return new Response("Unauthorized", { status: 401 });
        const parsed = AlertPayload.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
        if (new Date(parsed.data.expires_at) <= new Date(parsed.data.issued_at))
          return Response.json(
            { ok: false, error: "expires_at must follow issued_at" },
            { status: 400 },
          );
        const { data, error } = await (supabaseAdmin as any)
          .from("official_safety_alerts")
          .upsert(
            { ...parsed.data, is_active: true, ingested_at: new Date().toISOString() },
            { onConflict: "source_name,external_id" },
          )
          .select("id")
          .single();
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        return Response.json({ ok: true, id: data.id });
      },
    },
  },
});
