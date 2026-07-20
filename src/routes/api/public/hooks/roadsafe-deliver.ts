import { createFileRoute } from "@tanstack/react-router";
import { deliverRoadSafeNotifications } from "@/lib/roadsafe-notifications.server";

export const Route = createFileRoute("/api/public/hooks/roadsafe-deliver")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!process.env.ROADSAFE_CRON_SECRET || provided !== process.env.ROADSAFE_CRON_SECRET)
          return new Response("Unauthorized", { status: 401 });
        try {
          return Response.json({ ok: true, ...(await deliverRoadSafeNotifications()) });
        } catch (cause) {
          return Response.json({ ok: false, error: (cause as Error).message }, { status: 500 });
        }
      },
    },
  },
});
