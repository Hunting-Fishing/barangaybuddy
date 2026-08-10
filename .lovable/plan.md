# Jeepney route form tabs, GPS route tracking, analytics and traffic

## 1. Route form moves into tabs

The "Add a jeepney route" dialog becomes tabbed so operators aren't faced with one long form:

- **Route** — name, code/body number, route colour, notes for riders
- **Map** — draw route, add stops, "Use my location", "Track my route", stop list
- **Schedule** — first run, last run, last pickup, trips per day, minutes per trip, operating days
- **Fares** — fare and fare note (optional; many operators skip it, so it lives on its own tab with a "leave blank if fares vary" hint)

Save button stays in the dialog footer and works from any tab. Validation errors switch to the tab that needs attention.

## 2. Use my location

On the map tab, a "Use my location" button asks for the phone's GPS and centres the editor map there at street zoom, dropping an optional first route point. Clear messages when permission is denied or GPS is unavailable.

## 3. Track my route (auto-draw by driving)

Instead of tapping the map point by point, the operator taps **Track my route**, drives the loop, and the app records the path:

- Watches GPS while the tab is open, adding a point every ~40 m (ignores jitter and bad-accuracy fixes)
- Live preview line on the editor map, running distance and point count
- **Pause**, **Resume**, **Finish** and **Discard**; finishing simplifies the trace (removes redundant points) and fills the route path
- Warning that the browser must stay open, matching the existing live-tracking note

## 4. Route analytics — busy times and trends

Every live shift is recorded as a trip so we can build patterns from real driving, not guesses:

- Each broadcast session becomes a **trip record** (route, start, end, distance, average speed)
- Nightly rollup aggregates GPS pings into **hour-of-day × day-of-week** buckets per route, plus month and Philippine-holiday buckets (New Year, Holy Week, Undas, Christmas season, local fiestas the operator flags)
- New **Insights** tab on the operator route card and a rider-facing "Busy times" panel on the route page:
  - Heat strip of busy hours for each day of the week
  - "Busiest day" / "Quietest hour" summary lines
  - Month-over-month trend of trips and average trip time
  - Holiday callout ("Holy Week runs are ~30% slower")
- Honest empty state until enough trips exist ("We need about a week of tracked trips to show patterns")

## 5. Traffic congestion

Congestion is derived from the same GPS pings, no paid traffic API:

- The route path is split into ~250 m segments; each ping is matched to a segment with its speed
- Per segment we store a typical speed by hour-of-day, and compare the current live speed to it
- Congestion levels: free flow / slow / heavy, coloured green–amber–red on the rider and operator maps
- ETAs use the segment speeds for the current hour instead of the flat 18 km/h assumption, so arrival estimates match rush hour reality
- Rider route page lists current slow spots by name (nearest stop)

## Technical notes

- New tables: `jeepney_trips`, `jeepney_route_stats` (hour/day/month/holiday buckets), `jeepney_segment_stats` (segment × hour speed), all with grants, RLS (public read for published routes, operator write on own routes) and service-role access for the rollup.
- Rollup runs as a `/api/public/hooks/jeepney-rollup` route called nightly by pg_cron, secured with the existing sync secret header.
- `jeepney-route-form.tsx` refactored to use the existing shadcn `Tabs`; heavy editor stays lazy-loaded inside `ClientOnly`.
- Tracking and location live in `jeepney-route-editor.tsx` with a small `useGpsTrace` hook; path simplification (Douglas–Peucker) added to `src/lib/jeepney.ts`.
- `jeepney-live-toggle.tsx` opens/closes a trip row alongside position pings.
- ETA helpers in `src/lib/jeepney.ts` gain an optional segment-speed lookup, falling back to today's behaviour when there's no data.
- New components: `jeepney-insights-card.tsx` (charts via existing recharts) and congestion colouring inside `jeepney-map.tsx`.
