# RoadSafe deployment and integrations

Apply all RoadSafe migrations through `20260720140000_roadsafe_integrations.sql`, then regenerate Supabase TypeScript types.

## Required server secrets

Configure these only in the deployment environment. Never prefix them with `VITE_` and never expose them to browser code.

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ROADSAFE_CRON_SECRET` — long random bearer secret for the delivery worker
- `ROADSAFE_INGEST_SECRET` — different long random bearer secret for verified-source ingestion
- `RESEND_API_KEY`
- `ROADSAFE_EMAIL_FROM` — sender on a Resend-verified domain
- `SEMAPHORE_API_KEY`
- `SEMAPHORE_SENDER_NAME` — approved Philippine sender name
- `OPENROUTESERVICE_API_KEY`

## Notification delivery

Schedule an authenticated POST to `/api/public/hooks/roadsafe-deliver` every minute using `Authorization: Bearer <ROADSAFE_CRON_SECRET>`.

The worker processes at most 50 pending or failed messages, uses provider idempotency for email, stores provider IDs, and stops retrying after five attempts. In-app messages do not require this worker.

## Verified official-alert ingestion

Approved integrations POST JSON to `/api/public/hooks/roadsafe-ingest` with `Authorization: Bearer <ROADSAFE_INGEST_SECRET>`. Required fields are `external_id`, `barangay_code`, `headline`, `message`, `severity`, `source_name`, `issued_at`, and `expires_at`; `source_url` is optional.

Allowed source names are PAGASA, NDRRMC, DPWH, LGU, and Barangay Office. The endpoint validates and upserts source IDs. Do not label scraped or unverified material as official. Government sources can be integrated when they provide a dependable licensed feed or direct partnership endpoint.

## Routing limitations

RoadSafe uses OpenRouteService avoidance polygons around active `avoid` and `closed` reports. Checks require a signed-in user and are limited to 145 km. Results are advisory: a route response does not prove roads are passable, and operators must keep closures current.

## Consent and privacy

- SMS remains off until a resident explicitly enables it and supplies a Philippine mobile number.
- Removing a subscription stops new messages; production retention jobs should purge old delivery records according to the published privacy policy.
- Provider credentials and the Supabase service-role key must never be committed or sent to the browser.
