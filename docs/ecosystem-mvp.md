# Barangay Buddy Ecosystem MVP

This implementation extends the existing Family Account and Spotlight foundation with the shared merchant directory, Restaurant Manager, Marketplace manual fulfillment, Buddy Express manual dispatch, and financial/reporting ledgers.

## Local setup

1. Install Node dependencies with `npm install`.
2. Install Docker Desktop and the Supabase CLI.
3. Start the local stack with `npx supabase start`.
4. Apply all migrations and the local seed with `npx supabase db reset`.
5. Generate database types with `npx supabase gen types typescript --local > src/integrations/supabase/types.ts` and review the generated diff.
6. Copy the local API URL and publishable key into `.env` as `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY`. Set `SUPABASE_SERVICE_ROLE_KEY` only in the server environment.
7. Run `npm run dev`.

Do not expose the service-role key, notification provider keys, map keys, cron secrets, or ingestion secrets through `VITE_` variables.

## Routes

- `/family` - guardian-managed family accounts and consent
- `/spotlight/*` - campaigns, submissions, public profiles, leaderboard, bookings, sponsors, and moderation
- `/marketplace` - verified merchant directory
- `/marketplace/business/$id` - catalog, validated modifiers, ordering, and reservation requests
- `/marketplace/orders` - order/reservation history, substitution decisions, and support
- `/dashboard/business/$id/restaurant` - locations, menus, reservations, substitutions, and order queue
- `/buddy-express` - driver application
- `/buddy-express/dashboard` - availability, assigned jobs, transitions, and earnings
- `/ecosystem-admin` - merchant/driver review, orders, support, manual dispatch, and finance records

## Operational state machines

Order transitions are enforced by `transition_marketplace_order`; delivery transitions are enforced by `transition_delivery`; Spotlight booking transitions are enforced by `transition_spotlight_booking`. Each accepted transition appends an event or audit record. UI buttons are conveniences, not the authorization boundary.

The pilot uses manual payment records and manual settlement. There is no payment gateway, automatic dispatch, direct video upload, self-service sponsor checkout, or retailer API integration.

## Tests

- `npm run test` runs TypeScript domain tests.
- `npx supabase test db` runs pgTAP schema/policy assertions after the local stack is reset.
- `npm run build` validates the production bundle.
- `npm run lint` checks the repository; targeted changed-file lint can be used while pre-existing repository warnings are being reduced.

### Manual acceptance path

1. Create adult, merchant, admin, guardian, and driver test users in local Supabase Studio.
2. Verify family guardian linkage, granular consent grant/revocation, minor Spotlight publication removal, and primary-guardian booking approval.
3. Submit and moderate a Spotlight audition; score all five rubric dimensions; vote once; invalidate a test vote with a reason; confirm People's Choice uses valid raw votes.
4. Add a merchant location and have an admin verify it. Create a starter menu and item.
5. Submit a pickup order with required modifiers, then advance it through merchant fulfillment. Propose and approve a substitution; confirm the server recalculates totals and invalid transitions fail through direct RPC calls.
6. Approve a driver, set availability, and manually dispatch a delivery order. Advance every handoff and confirm delivery/earning events.
7. Complete eligible orders/bookings and confirm commission ledger entries. Review KPI output as an admin.
8. Attempt direct anonymous and cross-account reads/writes against family, order, driver, delivery, payment, settlement, and audit tables.
9. Request and manage a reservation, upload private delivery proof, and open/resolve an order support case.

## Migrations

- `20260728100000_ecosystem_operations.sql` - merchant/catalog, order, delivery, finance, audit, RLS, state commands, proof storage, and KPI foundation
- `20260728105000_spotlight_booking_states.sql` - committed Spotlight booking enum expansion
- `20260728110000_spotlight_hardening.sql` - rubric scoring, valid-vote leaderboard, People's Choice, vote invalidation, and booking transition audit
- `20260728120000_marketplace_customer_workflows.sql` - authoritative modifier pricing, substitutions, reservation transitions, support hardening, and participant proof access

Rollback guidance is under `docs/migrations/`. Rollback requires an explicit retention/export review once operational records exist.

## Environment variables

No new environment variables are required. Existing server-only Supabase service-role configuration is used for privileged admin commands.

## Known limitations

- Payments, payouts, refunds, and settlements are ledger records with manual operations; no provider is connected.
- Dispatch is manual and supports one driver per order.
- Reservation requests and merchant status management are included; real-time table inventory and automated reminders are not.
- Modifier selection supports the current single-choice merchant UI while database rules enforce all configured group limits.
- Proof storage supports private photo/code records; signature capture is not a dedicated canvas UI.
- No identity-document upload or automated driver verification is included.
- Local migrations, schema lint, generated types, and pgTAP policy assertions were verified against a clean Supabase reset on 2026-07-28. Production deployment remains a separate reviewed operation.
