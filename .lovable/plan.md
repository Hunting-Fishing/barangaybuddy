# BarangayHub — Implementation Plan

A nationwide Philippines networking platform organized by barangay. Business owners list stores, services, restaurants, and food vendors with tags & prices. Consumers browse, review, message, and crowdsource fuel prices (Gas Buddy style).

## Tech foundation

- TanStack Start (already scaffolded), Tailwind v4, shadcn/ui
- Lovable Cloud (Postgres + Auth + Storage) for backend
- Email/password + Google sign-in
- TanStack Query for data fetching, Zod for validation
- Distinctive Filipino-inspired design system (warm sun-gold + deep sea-blue, not generic SaaS)

## Phased build

Given the scope (42K barangays, 5+ feature areas), we'll build in phases. **Phase 1 ships an end-to-end usable MVP**; later phases add depth. I recommend approving Phase 1 first — it already covers every feature surface — then iterating.

---

### Phase 1 — Core platform (this build)

**1. Database schema (Lovable Cloud migrations)**
- `regions`, `provinces`, `cities_municipalities`, `barangays` (PSGC hierarchy)
- `profiles` (1:1 with auth.users — display name, avatar, phone)
- `user_roles` + `app_role` enum (`owner`, `consumer`, `admin`) with `has_role()` security-definer function
- `businesses` (owner_id, barangay_id, name, slug, type enum: `store|service|restaurant|food_vendor|fuel_station`, description, tags[], cover image, hours, contact)
- `listings` (business_id, name, description, price, unit, category, image, in_stock) — used for products, services, menu items
- `reviews` (business_id, user_id, rating 1-5, comment, created_at) — unique per (business, user)
- `fuel_prices` (station_id → businesses, fuel_type enum: `gasoline_91|95|97|diesel`, price, reported_by, reported_at, upvotes, downvotes)
- `conversations` + `messages` (user ↔ business owner in-app chat)
- RLS on every table; storage bucket `business-media` (public read, owner write)

**2. PSGC barangay seed**
- Fetch official PSGC dataset (~42K rows) and load via migration in chunked inserts
- If full dataset migration is too large for a single run, seed regions/provinces/cities first, then stream barangays in a follow-up migration

**3. Auth**
- `/login`, `/signup`, `/reset-password` with email/password + Google
- During signup, user picks role (Business Owner / Consumer); trigger creates `profiles` + `user_roles` rows
- `_authenticated/` route group for protected pages

**4. Public browsing (SSR-friendly)**
- `/` — hero, featured businesses, search bar, top barangays, latest fuel prices
- `/regions` → `/regions/$region` → `/provinces/$province` → `/cities/$city` → `/barangays/$barangay` drill-down
- `/barangays/$barangay` — tabs: Stores · Services · Restaurants · Food Vendors · Fuel Stations
- `/business/$slug` — full profile, listings grid, reviews, message owner button
- `/search` — global search with filters (barangay, type, tags, price range, rating)
- `/fuel` — Gas Buddy-style map/list of latest prices, filter by fuel type & area

**5. Business owner dashboard (`_authenticated/dashboard`)**
- Create/edit business (one owner can have multiple)
- Manage listings (CRUD with image upload, price, tags)
- View incoming messages
- View reviews

**6. Consumer features**
- Post review + rating on any business
- Submit fuel price update (verified by upvote/downvote from other users)
- Send message to business owner
- Saved/favorite businesses

**7. In-app messaging**
- Realtime via Lovable Cloud subscriptions
- `/messages` inbox, `/messages/$conversationId` thread

**8. Design system**
- Bold identity: deep navy (`oklch` sea-blue) + sun-gold accent + warm off-white
- Display font: a distinctive serif/grotesque (e.g. Fraunces or Bricolage); body: Inter
- Custom tokens in `src/styles.css` for gradients, shadow-elegant, gradient-primary
- Hero with subtle map-of-PI motif; cards with depth

**9. SEO**
- Per-route `head()` with unique title/description for each barangay, business, and section
- JSON-LD `LocalBusiness` schema on business pages
- Sitemap considerations (deferred to phase 2)

---

### Phase 2 (later, separate request)
- Admin moderation dashboard, reports/flags
- Map view (Leaflet) for fuel + businesses
- Push/email notifications, verified-owner badges, business hours real-time open/closed
- Sitemap generation for 42K barangays, structured data expansion
- Mobile PWA install, image optimization pipeline

---

## Technical notes

- **PSGC seed strategy**: download from `psa.gov.ph` PSGC publication or community-maintained JSON; chunk inserts (1000 rows per statement) inside one or two migrations. Indexed on `barangay.city_id`, `slug`, full-text search on name.
- **Server access**: business writes/reads via `createServerFn` with `requireSupabaseAuth`; public browsing uses the browser Supabase client with RLS allowing anonymous SELECT on public tables.
- **Roles**: stored in `user_roles` table only (never on profile), checked with `has_role(auth.uid(), 'owner')` inside RLS policies.
- **Validation**: Zod schemas shared between client form and server fn for every mutation.
- **Routing**: file-based under `src/routes/`, with `_authenticated/` group for owner/consumer-only pages and `barangays.$barangay.tsx` style dynamic routes.
- **Realtime messaging**: Supabase realtime channel keyed by `conversation_id`; RLS ensures only participants can read.

## What you'll get after Phase 1

A live, end-to-end working site where anyone in the Philippines can sign up, register a business in their exact barangay, list products/services with prices and tags, receive reviews and messages, and where any user can crowdsource and view fuel prices nationwide.

Approve to begin Phase 1.