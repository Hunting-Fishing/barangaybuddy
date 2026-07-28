# Barangay Buddy Architecture Audit

Date: 2026-07-28
Scope: Phase 1 repository audit and architecture baseline only

## Executive summary

Barangay Buddy is a single mobile-first web application built with React 19, TanStack Start/Router, TypeScript, Tailwind CSS, shadcn/Radix UI, and Supabase. It is packaged for Cloudflare Workers through Vite and Nitro. The current repository already contains a local business directory, business ownership and inventory tools, groups and messaging, RoadSafe, family accounts, and the Barangay Buddy Spotlight Network MVP.

The safest next step is to keep the existing single-application structure and add new domains as bounded route, library, component, and migration modules. A monorepo split would add migration cost without solving a current constraint. Shared platform concepts—identity, geography, businesses, families, consent, roles, storage, and audit events—should remain reusable foundations rather than being duplicated inside Marketplace, Restaurant Manager, or Buddy Express.

The repository is not yet ready for the later ecosystem phases as a single uninterrupted build. The largest cross-cutting gaps are automated tests, a consistent server-side command boundary, general-purpose audit/event infrastructure, documented migration rollback procedures, and verified local database/RLS testing.

## Repository state

- Active branch: `main`
- Audited commit: `44857be`
- `main`, `origin/main`, and `origin/HEAD` point to the same audited commit.
- The `building_blocks/` directory is intentionally untracked at the time of this audit and was treated as product guidance, not application source.
- Application source lives under `src/`; database changes live under `supabase/migrations/`.
- No automated test files or test script were found.
- No repository README or consolidated local-development guide was found during the audit.

## Current runtime architecture

### Application and deployment

- TanStack Start supplies SSR, routing, server functions, and API routes.
- React Query is available for asynchronous state; route modules also query Supabase directly.
- Tailwind CSS v4 and shadcn/Radix components provide the UI foundation.
- Vite uses `@lovable.dev/vite-tanstack-config`; custom server entry is `src/server.ts`.
- Cloudflare Workers is the declared deployment target in `wrangler.jsonc`, with Node compatibility enabled.
- Supabase supplies Postgres, authentication, row-level security, RPC functions, and object storage.

### Trust boundaries

There are three effective data-access patterns:

1. Browser-side Supabase access using the publishable key and RLS.
2. Authenticated TanStack server functions using a bearer token and a user-scoped Supabase client.
3. Trusted server-only operations using `SUPABASE_SERVICE_ROLE_KEY`, which bypass RLS.

The service-role client is isolated in `src/integrations/supabase/client.server.ts`. Spotlight moderation correctly rechecks the authenticated user's admin role on the server before using it. This pattern should become the standard for privileged Marketplace and Buddy Express commands.

Client-visible configuration is limited to publishable Supabase values. Integration secrets for imports, notifications, maps, and RoadSafe are referenced from server-side code or deployment configuration and must remain there.

## Existing domain inventory

### Shared platform

- Authentication and user profiles
- Role records, including administrator checks
- Philippine geography: regions, provinces, cities/municipalities, and barangays
- Businesses, listings, claims, favorites, reviews, tags, category suggestions, and import runs
- Conversations and messages
- Groups, memberships, events, venues, promotions, and payment-reference review
- Shared inventory items and adjustments

### RoadSafe

RoadSafe already includes vehicle profiles, hazards and confirmations, safety alerts, emergency contacts, evacuation centres, subscriptions, notifications, operator assignments, audit logging, external ingestion, and delivery hooks. It is a separate safety domain and should not be reused as a delivery-driver model merely because both involve vehicles and location.

### Family accounts and minor safety

The platform-level foundation exists through:

- `family_groups`
- `family_members`
- `guardian_child_relationships`
- `minor_consents`
- `family_rate_offers`

It supports guardian-managed child profiles, up to two guardian relationships, verified/revoked relationship states, granular permissions, consent attestation and revocation metadata, primary-guardian checks, private family media, and first-party family offers restricted to eligible offers priced at PHP 500 or more.

This is the correct foundation for all later minor participation. Marketplace purchases, direct minor messaging, and unrestricted child account privileges must not be inferred from the presence of a child profile.

### Spotlight Network

The following focused routes exist, with no endless-feed route:

- `/spotlight`
- `/spotlight/star-of-the-month`
- `/spotlight/submit`
- `/spotlight/talent/$slug`
- `/spotlight/leaderboard`
- `/spotlight/sponsors`
- `/spotlight/book/$slug`
- `/spotlight/admin`

The schema includes campaigns, submissions, unique public votes, judge scores, sponsor inquiries, booking requests, and minor booking approvals. It also includes private submission media, public approved media, public profile and leaderboard views, campaign age ranges, granular minor-consent checks, and primary-guardian approval for minor booking progression.

The published leaderboard uses the intended normalized 70% public vote and 30% judge score model. Public reads use aggregate views rather than exposing individual voter or judge records.

## Data and authorization observations

### Strengths

- Most operational tables enable RLS and define owner, guardian, public, or admin policies.
- Family consent is auditable and revocable without deleting historical rows.
- Minor public visibility is derived from active consent rather than private guardian fields.
- Spotlight pending media is private; approved media is copied by a server-only moderation action.
- Vote uniqueness is enforced in the database.
- Campaign age rules are data-driven.
- Family discount eligibility is constrained in the database to first-party offers at PHP 500 or more.
- RoadSafe has a domain audit log and immutable-style operational records that can inform later event design.

### Risks and gaps

- Browser components still perform many writes directly through Supabase. RLS is necessary, but high-risk state changes should additionally pass through typed server commands with Zod validation.
- The repository has no automated unit, integration, RLS, or browser tests.
- Migration files do not provide a consistent rollback-note convention.
- The current TypeScript database declarations should not be described as freshly generated until regeneration is run against the intended Supabase project and the result is reviewed.
- Local migrations and RLS policies were inspected statically; they were not applied to or penetration-tested against a local Supabase instance during this audit.
- Audit infrastructure is domain-specific. There is no shared append-only event/audit model for consent-sensitive and commercial state transitions.
- Several workflows use small generic status enums. Marketplace orders, delivery jobs, and commercial bookings need explicit domain state machines and transition authorization.

## Spotlight completion gaps

The current Spotlight MVP is a sound baseline, but the expanded building-block specification adds requirements not yet fully represented:

- A distinct People's Choice outcome is not modeled or administered separately from featured talent.
- Suspicious-vote invalidation and its moderation audit trail are not implemented.
- Judge scoring is a single 0–100 value rather than rubric dimensions such as talent, presence, originality, and community representation.
- Booking coordination has a lean inquiry status, not a complete request, guardian approval, acceptance, event, cancellation, and completion history.
- Public-image consent withdrawal is enforced by query eligibility, but media removal/unpublication operations should be explicitly tested and documented.
- Sponsor placement inventory and reporting are not yet a reusable commercial module; the present implementation captures sponsor leads.

These are Spotlight hardening tasks, not reasons to duplicate family or talent schemas.

## Readiness for planned verticals

### Shared Merchant Directory and Restaurant Manager

Reusable foundations already exist for businesses, owners, listings, locations through geography, tags, categories, and generic inventory. Missing capabilities include merchant onboarding states, location-specific opening hours and service areas, menu/catalog categories, modifier groups, time-based availability, reservations, order queues, and order status events.

Restaurant Manager should extend the business identity instead of creating a second merchant table. Menu items are commercial catalog records and should not be forced into stock-adjustment tables when their pricing, modifiers, and availability semantics differ.

### Marketplace

There is no general Marketplace order domain. Implement manual fulfillment first with explicit states such as `submitted`, `confirmed`, `preparing`, `ready`, `assigned`, `picked_up`, `delivered`, `cancelled`, and `refunded` where applicable. Store immutable transition events alongside the current state. Do not add payments until ordering and fulfillment transitions are stable and tested.

### Buddy Express

No delivery-driver, dispatch, job-offer, proof-of-delivery, or driver-earnings domain exists. Buddy Express should consume Marketplace delivery requests through an explicit assignment boundary. Begin with admin/manual dispatch; real-time matching can remain an optimization. Minor profiles must never become drivers or transactional delivery accounts.

## Recommended module boundaries

Keep the current repository structure and introduce bounded modules incrementally:

- `src/lib/marketplace*` and Marketplace routes for catalogs, carts, orders, and merchant queues
- `src/lib/restaurant*` for menus, modifiers, hours, and reservations
- `src/lib/buddy-express*` for drivers, offers, assignments, proof, and earnings
- Server functions for privileged commands and state transitions
- Supabase public views for intentionally public projections
- Append-only event tables for order, booking, consent-sensitive, and delivery transitions

Database relationships should use the existing `profiles`, `businesses`, geographic tables, family/guardian entities, and roles. Avoid polymorphic owner columns where explicit foreign keys or join tables provide clearer authorization.

## Cross-cutting implementation rules

1. Treat Postgres constraints and RLS as the final authorization boundary, with matching Zod validation in server commands.
2. Recheck roles and ownership server-side for privileged actions; never rely only on route guards.
3. Keep service-role, notification, import, and provider secrets out of client bundles.
4. Expose purpose-built public views; never make operational tables broadly readable for convenience.
5. Record actor, timestamp, previous state, next state, and relevant reason for sensitive transitions.
6. Make minor permissions feature-specific, revocable, and checked at publication and action time.
7. Use mobile-first, low-bandwidth pages with pagination and explicit empty/loading/error states; do not introduce endless feeds.
8. Keep Metro Manila and launch-city configuration in seed/config data while retaining multi-city keys in the schema.
9. Add migrations, constraints, indexes, RLS, seed fixtures, generated types, tests, rollback notes, and local test instructions together for each domain slice.
10. Prefer manual operational workflows before automation, matching, payments, or complex integrations.

## Required foundation work before Phase 2+

1. Add a test runner and establish unit, database/RLS, and route-level test conventions.
2. Add documented Supabase local setup, reset, seed, type-generation, and policy-test commands.
3. Establish a migration template with forward behavior, data impact, verification query, and rollback notes.
4. Define a shared append-only audit/event convention and actor model.
5. Define server-command conventions for authentication, Zod input validation, role checks, errors, and idempotency.
6. Harden the remaining Spotlight gaps before treating the feature as a reusable commercial booking foundation.
7. Design the merchant/catalog/order state model before implementing Restaurant Manager UI.

## Definition of done for subsequent phases

Each phase should stop at a vertical slice that includes:

- Schema migration, constraints, indexes, RLS, seed data, and rollback notes
- Generated Supabase TypeScript types
- Typed query and server-command layer with Zod validation
- Mobile, tablet, and desktop UI with loading, empty, error, and permission-denied states
- Automated unit and integration coverage, including direct database authorization attempts
- Local setup and manual verification steps
- Confirmation that no private minor, guardian, applicant, merchant, driver, or requester data appears in public projections

## Phase 1 conclusion

The current application should evolve as a modular monolith. Family accounts and Spotlight are already incorporated and should be hardened, not rebuilt. The business directory is a viable merchant identity foundation, while Marketplace, Restaurant Manager, and Buddy Express remain new bounded domains. Before those domains begin, the repository needs test infrastructure, database verification practices, server-command conventions, and shared audit/event standards.

No later-phase feature implementation is included in this audit.
