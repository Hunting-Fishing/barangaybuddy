import { createFileRoute } from "@tanstack/react-router";
import { runStationSync } from "@/lib/fuel-import.server";

export const Route = createFileRoute("/api/public/hooks/fuel-stations-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.DATA_SYNC_SECRET;
        const provided =
          request.headers.get("x-sync-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!expected || !provided || provided.length !== expected.length || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const result = await runStationSync();
          return Response.json({ ok: true, ...result });
        } catch (e) {
          return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
