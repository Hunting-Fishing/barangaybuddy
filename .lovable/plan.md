# Professional "Add your club or league" form + real payment setup

## What's happening today (verified)

- `group-create-dialog.tsx` is one flat column of inputs: name, type, description, fee, period, and a free-text "Payment instructions" box.
- That payment box is **just text**. It is stored on the `groups` row and later shown as a grey note inside the join dialog (`group-signup-dialog.tsx`, `group-join-dialog.tsx`). Nothing validates it, nothing collects money.
- Online card/wallet checkout exists only for the official Barangay Buddy league: `createLeagueCheckout` is hardcoded to the Stripe price `league_player_yearly` and to the app's own Stripe account. A club created through this form has **no** online payment path — members type a GCash reference and an admin approves it manually.

So your read is right: GCash is not integrated for new groups.

## What we'll build

### 1. Redesigned application form (multi-step, styled)

Replace the single scroll with a 3-step dialog with a progress header, section cards, inline validation, and a live preview of how the group card will look in the directory.

- **Step 1 — About your group**: logo upload, cover image upload, group name, type (league / club / interest group), short tagline, full description, city + barangay (reuse existing locality pickers), primary sport/activity tags.
- **Step 2 — Membership**: free vs paid toggle, fee amount, membership length (presets: 30 / 90 / 365 days + custom), member benefits list, max members, whether the group is open or approval-only.
- **Step 3 — Payments & contact**: contact name, email, mobile, optional Facebook/website link, plus the payment section below. Submit shows a summary and a clear "we review every application" note.

Validation with zod: name 3–80 chars, description ≤ 2000, fee 0–100000, at least contact email or mobile.

### 2. Payments that actually work

Two clearly-labelled options in step 3:

- **Collect manually (available now)** — structured fields instead of a free-text blob:
  - GCash number + registered name
  - Maya number + registered name
  - Bank name / account name / account number
  - Optional QR code image upload (GCash/Maya QR), stored in the media bucket
  - Extra notes field
  The join dialog then renders these as a proper payment card: tap-to-copy numbers, the QR image, and a reference-number field. Admin verifies and activates — same as today, but no longer a formatting free-for-all.
- **Online card & wallet checkout (Barangay Buddy handled)** — for groups that want automatic activation, we create a Stripe price per group and route their checkout through the app's existing embedded-checkout flow, with GCash/Maya enabled as Stripe payment methods where available on the account. Because money would land in Barangay Buddy's account, this stays **off by default** and is only switchable by an admin during review, with a payout arrangement noted on the application.

If you'd rather each club receive money directly into their own wallet, that needs a marketplace-style split (Stripe Connect or a PH aggregator like Xendit/PayMongo) — that's a separate, larger piece of work and is not in this plan.

## Technical notes

- Migration on `public.groups`: add `logo_url`, `cover_image_url` (already present), `tagline`, `city_code`, `barangay_code`, `contact_email`, `contact_url`, `max_members`, `join_policy`, `payment_methods jsonb`, `online_payment_enabled boolean default false`. Contact phone goes into a restricted `group_contacts` table (matching the existing `group_team_contacts` pattern) so it isn't publicly readable; keep `payment_instructions` for backwards compatibility.
- Grants + RLS: public read on the group row, insert by the authenticated creator, `is_public` and `online_payment_enabled` stay false on insert (enforced by trigger, mirroring the existing membership-activation trigger).
- Split the dialog into `group-create-dialog.tsx` (shell + steps) plus `group-form-about.tsx`, `group-form-membership.tsx`, `group-form-payments.tsx`, and a `use-group-create-form.ts` hook — matching the add-business form structure already in the codebase.
- Payment display extracted into a shared `GroupPaymentCard` used by both `group-signup-dialog.tsx` and `group-join-dialog.tsx`.
- Logo/QR uploads reuse the existing media upload helper and bucket prefix pattern.
