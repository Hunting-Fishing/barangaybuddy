/* eslint-disable @typescript-eslint/no-explicit-any -- RPC is migration-backed ahead of regenerated Supabase types. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type TelematicsRateResult = {
  allowed: boolean;
  requestCount: number;
  requestLimit: number;
  retryAfterSeconds: number;
};

/**
 * Consume one authenticated telemetry request slot for a physical source.
 *
 * The database owns the fixed-minute counter so the limit is shared across app
 * instances/processes instead of relying on an in-memory server counter.
 */
export async function takeTelematicsRateSlot(
  sourceKey: string,
  limit = 300,
): Promise<TelematicsRateResult> {
  const { data, error } = await (supabaseAdmin as any).rpc(
    "jeepney_take_telematics_rate_slot",
    {
      p_source_key: sourceKey,
      p_limit: limit,
    },
  );

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.allowed !== "boolean") {
    throw new Error("Telemetry rate limiter returned no result");
  }

  return {
    allowed: Boolean(row.allowed),
    requestCount: Number(row.request_count ?? 0),
    requestLimit: Number(row.request_limit ?? limit),
    retryAfterSeconds: Math.max(1, Number(row.retry_after_seconds ?? 60)),
  };
}

export function telemetryRateLimitResponse(result: TelematicsRateResult): Response {
  return Response.json(
    {
      error: "Telemetry rate limit exceeded",
      retry_after_seconds: result.retryAfterSeconds,
      request_count: result.requestCount,
      request_limit: result.requestLimit,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "Cache-Control": "no-store",
      },
    },
  );
}
