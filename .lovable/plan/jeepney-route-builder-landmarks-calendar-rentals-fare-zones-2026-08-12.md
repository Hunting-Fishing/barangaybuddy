# Jeepney route builder: landmarks, calendar, rentals, fare zones

Four upgrades to the operator route dialog and the rider route page.

## 1. Route points → landmarks with photos

Today the "Route points in order" list only shows raw lat/long numbers, and the
Stop / Waiting area / Terminal / Landmark buttons live further down in a
separate "Stops in order" section — so it isn't obvious how to set them.

Changes:
- Merge the two lists into one "Route points in order" list. Each numbered row
  shows: the point type as a compact dropdown (Stop, Waiting area, Terminal,
  Landmark), a name field, an address field, a small photo thumbnail with an
  "Add photo" button, and the lat/long shown small underneath as a hint.
- Photos upload to a new public jeepney media bucket; each point stores one
  image URL.
- Rider route page: point list and map popups show the photo and label so
  riders can recognise the waiting shed / terminal / landmark.
- Points with no name still work — they stay plain route shaping points.

## 2. Operating days as a grid, with times per day

Replace the row of day chips with a 7-row grid: one row per day, with an
on/off switch and a First run / Last run / Last pickup time beside it, plus a
"Copy Monday to all" shortcut. Times left blank fall back to the route-level
default times.

## 3. Service calendar (maintenance, breakdowns, notices)

New "Calendar" tab in the route dialog with a month calendar. Operators add
dated entries with a type:
- Maintenance / not running
- Breakdown (record what happened)
- Holiday or special schedule
- Notice

Rider route page gets an "Upcoming service notices" panel plus a badge on
today's date when the route is not running, so riders know ahead of time.
Existing breakdown reporting continues to work and also writes a calendar
entry automatically.

## 4. Jeepney rental / charter requests

- Operator: a "Rentals" section to switch charter hire on or off, set a day
  rate and a note on what is included.
- Rider: a "Book this jeepney" button on routes that allow it, opening a form
  for event type (wedding, fiesta, school trip, other), date, pickup and
  drop-off, passenger count, and contact details.
- Requests land in the operator portal with accept / decline and appear in the
  operator's calendar once accepted.

## 5. Fares by zone

Replace the single fare + free-text note with a fare table. Each line has a
label and an amount, e.g.:

```text
Zone 1 (first 4 km)      ₱13.00
Zone 2                   ₱15.00
Student / senior         ₱10.40
Day rental               ₱4,500.00
```

- Add / remove / reorder lines; labels are free text so operators can name
  them (zones, discounts, day rental, aircon, etc.).
- The "₱1.80 per km after 4 km" placeholder is removed; the note field becomes
  a general fare note under the table.
- Rider route page shows the fare table instead of one number.

## Technical notes

- Migration: `photo_url` on `jeepney_stops`; new tables
  `jeepney_route_calendar` (route_id, date, kind, title, note),
  `jeepney_route_fares` (route_id, position, label, amount_php),
  `jeepney_rental_requests` (route_id, requester, event details, status), and
  `jeepney_day_schedule` (route_id, day, active, first/last/last_pickup).
  Rentals config columns added to `jeepney_routes`. Every table gets GRANTs,
  RLS with public read of published-route data, operator-owner writes, and
  rider-owned reads on their own rental requests.
- New public storage bucket `jeepney-media` for landmark photos, with
  owner-scoped write policies.
- New components: `jeepney-point-list.tsx` rewritten as a combined point/stop
  editor, `jeepney-service-calendar.tsx`, `jeepney-fare-table.tsx`,
  `jeepney-rental-dialog.tsx`, `jeepney-day-schedule-grid.tsx`.
- `jeepney-route-form.tsx` gains Calendar and Rentals tabs and saves the new
  child rows; `jeepney.$slug.tsx` renders fares, notices and the booking CTA.
