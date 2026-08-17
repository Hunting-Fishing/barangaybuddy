# Barangay Buddy Delivery — Phase 1

A Grab-style delivery network built into the app: customers post delivery jobs, verified branded riders claim them, and both sides track the job live on a map. Riders pay ₱80/month to stay active on the network.

## Structure (modelled on Grab / Lalamove / Toktok PH)

```text
Customer  ->  posts job (pickup + dropoff, service type, fare quote)
Rider     ->  browses open jobs near them, claims one
Job flow  ->  open -> accepted -> picked_up -> delivered  (or cancelled)
Rider fee ->  ₱80/month subscription, must stay active to claim jobs
Branding  ->  vehicle decal + uniform photos, admin-approved before going live
```

Service types at launch: parcel / errand, food order pickup, grocery shopping, laundry, medication, auto parts, agriculture goods, airport shuttle. Each has an icon, a short description and its own base fare multiplier so pricing can be tuned per service later.

## Pages

1. `/delivery` — public landing. What the service is, service-type grid, "Request a delivery" and "Become a rider" calls to action, live count of active riders.
2. `/delivery/request` — customer job form: service type, pickup and dropoff (address search plus map pin drop, reusing the existing location picker), item description, size, recipient name/phone, scheduled or ASAP, and a live fare estimate (base fare + per-km, computed from road distance). Choose Cash on delivery or Pay now.
3. `/delivery/orders` — customer's job list with status timeline, rider name/photo/plate, live rider position on the map while the job is in progress, cancel button while still open, and rating on completion.
4. `/delivery/rider` — rider portal: onboarding (vehicle type, plate, licence, service areas), branding photo uploads, subscription status and ₱80/month checkout, an online/offline toggle that broadcasts GPS, the nearby open-jobs board, and their active job with the status buttons (arrived, picked up, delivered) plus earnings summary.
5. `/delivery/admin` — admin review queue for rider applications and branding photos (approve / reject with a note), plus a job overview.

The header and homepage carousel get a Delivery entry so QR-code visitors land on it fast.

## Payments

- Rider subscription: ₱80/month Stripe product `delivery_rider_monthly`, same checkout + webhook pattern already used for jeepney route subscriptions. Manual GCash/Maya reference fallback stays available, pending admin confirmation.
- Delivery fare: customer chooses Cash on delivery (rider collects, job records cash owed) or Pay now via Stripe checkout (cards + GCash/Maya where the account supports them). Paid jobs are marked prepaid so the rider knows not to collect. A payouts ledger row is recorded per completed job so rider earnings and platform commission are tracked from day one.

## Live tracking

Reuses the jeepney GPS approach: while online, the rider's browser posts positions on an interval; the customer's order page subscribes in realtime and renders the rider marker moving toward pickup then dropoff, with a simple ETA from road distance.

## Data model (technical)

New tables, all with row-level security, grants and updated-at triggers:

- `delivery_riders` — user, display name, vehicle type/plate, service city, status (`pending`, `approved`, `rejected`, `suspended`), online flag, branding photo paths, rating aggregate.
- `delivery_rider_subscriptions` — ₱80/month status, period end, Stripe ids, environment (mirrors `jeepney_subscriptions`).
- `delivery_jobs` — customer, service type, pickup/dropoff coords + address, item details, recipient, distance/fare breakdown, payment method and paid flag, status, assigned rider, timestamps per stage.
- `delivery_job_events` — status change audit trail.
- `delivery_positions` — rider live pings (route-free version of `jeepney_positions`).
- `delivery_ratings` — customer rating and comment per completed job.

Access rules: customers see and manage only their own jobs; approved, subscribed riders can see open jobs and claim them; only the assigned rider can advance a job's status; riders' phone numbers and customer contact details are exposed only to the counterparty on an active job (contact detail kept in a separate restricted table, following the pattern already used for team and operator contacts); admins see everything. A trigger enforces that a rider cannot self-approve their application or self-activate a paid subscription, and that a job can only be claimed while it is still open — so two riders cannot grab the same job.

New storage bucket `delivery-media` (private, signed URLs) for branding and proof-of-delivery photos.

Server functions in `src/lib/delivery.functions.ts` handle claim, status advance, fare quote and subscription checkout; the Stripe webhook route is extended to activate rider subscriptions and mark prepaid jobs.

## Out of scope for now

Automatic nearest-rider dispatch, in-app chat (existing messaging can be linked later), multi-stop routes, and rider payout transfers — the ledger records what is owed, settlement stays manual.
