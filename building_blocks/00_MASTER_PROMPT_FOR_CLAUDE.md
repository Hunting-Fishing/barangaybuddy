# Claude Build Instruction: Barangay Buddy Ecosystem

You are working in the Barangay Buddy repository. Inspect the repository first and follow its existing architecture, conventions, authentication model, database tooling, styling, tests, and deployment setup.

## Product Direction

Barangay Buddy is a mobile-first local operating system for Philippine barangays. The umbrella platform includes:

1. Family Accounts and guardian-controlled child profiles
2. Barangay Buddy Spotlight Network
   - First vertical: Barangay Talent Network
   - First campaign: Star of the Month
3. Barangay Buddy Marketplace
   - Restaurants, grocery, pharmacy, hardware, and local services
4. Buddy Express
   - Local driver and delivery network
5. Merchant pages, sponsor leads, advertisements, bookings, subscriptions, and analytics

## Locked Decisions

- Spotlight auditions are free.
- Accounts are required for submissions, voting, and bookings.
- Minors participate through guardian-controlled child profiles.
- MVP audition media is a profile photo plus an external video link; do not upload video directly.
- Leaderboard formula is 70% normalized public vote and 30% judge score.
- No paid voting.
- Sponsor page displays packages and captures sponsor leads; no package payment or reservation in MVP.
- Talent booking commission target is 10-15% on completed bookings.
- Barangay Buddy is the umbrella brand; Buddy Express is the logistics service.
- Build multi-city-ready schemas but launch operations one locality at a time.

## Required Work Sequence

1. Audit the repository and write an architecture note.
2. Implement family accounts, guardian links, child profiles, permissions, consent audit records, and RLS/authorization tests.
3. Implement Spotlight MVP:
   - landing page
   - campaign page
   - audition submission
   - guardian approval
   - admin moderation
   - public talent profile
   - authenticated voting
   - judge scoring
   - leaderboard
   - People's Choice
   - booking requests
   - sponsor packages and sponsor lead form
4. Implement shared merchant/business directory.
5. Implement restaurant manager:
   - locations and hours
   - menus, categories, items, modifiers, availability
   - merchant order queue
   - pickup, delivery, and optional reservations
6. Implement Marketplace order workflow with manual fulfillment first.
7. Implement Buddy Express:
   - driver onboarding
   - vehicles
   - availability
   - dispatch
   - delivery status events
   - proof of pickup/delivery
   - earnings ledger
8. Add payments, commissions, subscriptions, settlements, and reporting only after operational state machines are stable.

## Engineering Requirements

- Keep secrets and privileged actions server-side.
- Use explicit state machines and immutable audit events.
- Add migrations and rollback notes.
- Add authorization policies and tests.
- Add responsive loading, empty, error, and success states.
- Do not introduce a full social-media feed.
- Do not implement direct video uploads, self-service sponsor payments, or advanced automatic dispatch in the first MVP.
- Stop after each phase and report:
  - files changed
  - migrations
  - routes
  - tests
  - environment variables
  - how to run locally
  - known limitations

Begin with repository inspection and Phase 1 only. Do not implement all phases in one change.
