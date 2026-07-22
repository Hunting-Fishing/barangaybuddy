## Goal
Build a Clubs & Groups system. Launch it with the first group: **Barangay Buddy Billiards League** — PHP 100 / year membership that grants event/tournament entry, member listing, and automatic league-promo discounts. Venues (businesses) can join the league as league locations and appear on the map.

## What exists / what's missing
- No groups, clubs, leagues, memberships, events, or promos anywhere in code or DB. Everything below is net-new.
- Reuses existing pieces: `businesses` (venue link), `profiles` (member link), Leaflet `BusinessMap` (map pins), `has_role` (admin), Paddle/Stripe payments flow (for the PHP 100 fee).

## Database (one migration)

New enums:
- `group_type`: `league`, `club`, `interest_group`
- `group_role`: `owner`, `admin`, `member`
- `membership_status`: `pending`, `active`, `expired`, `cancelled`
- `event_status`: `scheduled`, `cancelled`, `completed`

New tables (all with RLS + GRANTs to authenticated + service_role; anon SELECT only on public list columns of `groups`, `group_venues`, `group_events`, `group_promos`):

- `groups` — id, slug (unique), name, type, description, cover_image_url, logo_url, membership_fee_php (int, e.g. 100), membership_period_days (default 365), is_public, created_by, timestamps.
- `group_memberships` — id, group_id, user_id, role, status, started_at, expires_at, payment_ref (nullable), amount_paid_php, unique(group_id, user_id).
- `group_venues` — id, group_id, business_id, status (`pending`/`approved`/`rejected`), joined_at, unique(group_id, business_id). Approved venues render on the map and get the "League location" pill.
- `group_events` — id, group_id, title, description, venue_business_id (nullable), starts_at, ends_at, entry_fee_php, member_free (bool default true), status, cover_image_url.
- `group_event_rsvps` — id, event_id, user_id, created_at, unique(event_id, user_id).
- `group_promos` — id, group_id, title, description, discount_percent OR discount_amount_php, business_id (nullable — null = all league venues), valid_from, valid_until, code (nullable).

Indexes: `group_memberships(user_id, status)`, `group_venues(group_id, status)`, `group_events(group_id, starts_at)`, `group_promos(group_id, valid_until)`.

Security-definer helper `public.is_active_member(_group_id uuid, _user_id uuid) returns boolean` for use in RLS on events/promos (avoids recursive policy checks).

RLS highlights:
- `groups`: anyone (anon+authenticated) SELECT `is_public=true`; only creator or admin UPDATE/DELETE; authenticated INSERT.
- `group_memberships`: user SELECTs own rows; group admins SELECT all in their group; INSERT self only with `status='pending'`; UPDATE status only via server function (service role) after payment.
- `group_venues`: public SELECT approved rows; business owner INSERTs for their own business (status=pending); group admin UPDATEs status.
- `group_events`: public SELECT scheduled; group admins manage.
- `group_event_rsvps`: user SELECTs own + admins see all; active members INSERT; users DELETE own.
- `group_promos`: public SELECT while `valid_until >= now()`; group admins manage.

Seed row in the same migration: the Billiards League group (`slug='barangay-buddy-billiards-league'`, fee=100, period=365, `is_public=true`).

## Payments (PHP 100 / year)

Two paths, one flag decides which is wired live:
- **If Paddle/Stripe is already enabled on this project**: create a "Group Membership – Billiards League" product (PHP 100, one-time; renewed manually on expiry — keeps v1 simple, no subscription webhook needed). Checkout server fn creates `group_memberships` row with `status='pending'` and stores the checkout session id in `payment_ref`. Webhook (existing `/api/public/hooks/...` pattern) verifies and flips to `active`, sets `started_at=now()`, `expires_at=now()+interval '365 days'`.
- **Fallback (no payments provider yet)**: manual "Mark as paid" admin action + a "Pay via GCash/bank transfer" instructions modal that creates a pending membership. Admin approves.

I'll ask below which path you want.

## Server functions (`src/lib/groups.functions.ts` + `groups.server.ts`)
- `getGroup(slug)` — public detail.
- `listGroups()` — public list.
- `joinGroup({groupId})` — auth; creates pending membership + returns checkout URL (or pending-approval message for free/manual path).
- `leaveGroup({groupId})`.
- `linkVenue({groupId, businessId})` — business owner requests to become a league venue.
- `approveVenue`, `rejectVenue`, `approveMembership` — group-admin only (verified via `context.supabase` under RLS).
- `createEvent`, `updateEvent`, `cancelEvent`, `rsvpEvent`.
- `createPromo`, `updatePromo`, `deletePromo`, `getActivePromosForBusiness(businessId, userId?)` — returns promos plus a `discount_applies` flag when the user is an active member; product/business pages read this to show the badge and the discounted price.

Public server route: `/api/public/hooks/group-payment` — Paddle/Stripe webhook (signature-verified, `supabaseAdmin` load-in-handler pattern).

## Routes / UI

- `src/routes/groups.index.tsx` — list of public groups, featured Billiards League hero card, "Create a group" CTA.
- `src/routes/groups.$slug.tsx` — group landing: cover, description, stats (members / venues / next event), "Join for ₱100/yr" button (state-aware: Join → Pending → Active w/ expiry), tabs for **Members**, **Venues** (with mini Leaflet map reusing `BusinessMap` styling — league-location markers get a distinct gold ring), **Events**, **Promos**.
- `src/routes/groups.$slug.manage.tsx` — under `_authenticated/`; group-admin console (approve members, approve venues, CRUD events + promos).
- `src/routes/dashboard.tsx` — new "My groups" section (active memberships with expiry countdown, quick renew) + business-owner "Join a league" action on each owned business.
- `src/components/group-venue-map.tsx` — map of approved venues for a group.
- `src/components/group-member-badge.tsx` — chip on member profile cards.
- On existing business page (`business.$slug.tsx`): show "League location" badge when the business is an approved venue, and show any active league promos with "You save ₱X as a member" if the viewer is an active member.
- Header nav: add "Groups" link.

## SEO
Each route gets its own `head()` with unique title/description/og. Group detail sets og:image from `groups.cover_image_url`.

## Files

**New**
- migration (schema + seed)
- `src/lib/groups.server.ts`, `src/lib/groups.functions.ts`
- `src/routes/groups.index.tsx`, `src/routes/groups.$slug.tsx`, `src/routes/_authenticated/groups.$slug.manage.tsx`
- `src/routes/api/public/hooks/group-payment.ts`
- `src/components/group-venue-map.tsx`, `src/components/group-member-badge.tsx`, `src/components/group-join-button.tsx`, `src/components/group-promos-list.tsx`

**Edited**
- `src/routes/dashboard.tsx` — my-groups block + business "Join league" action
- `src/routes/business.$slug.tsx` — league badge + member discount display
- `src/components/site-header.tsx` — Groups nav link

## Out of scope for v1
- Auto-renewal / recurring subscription (renewal is a re-checkout — simple and reliable).
- Bracket generation / scorekeeping for tournaments (events only track schedule + RSVP for now).
- In-app messaging between members (existing `messages` table can be reused later).

## Questions before I build
1. **Payments provider** — Should I wire this through Paddle/Stripe (needs `enable_paddle_payments` or `enable_stripe_payments` first), or ship v1 with a manual "GCash / bank transfer + admin approves" flow and add automated checkout in a follow-up?
2. **Who can create new groups** — Only admins (you seed each new league), any signed-in user, or business owners only?
3. **Venue approval** — Does a business auto-join the Billiards League when the owner clicks "Join league" from their dashboard, or does a league admin approve each venue?

Answer these three and I'll implement in one go.
