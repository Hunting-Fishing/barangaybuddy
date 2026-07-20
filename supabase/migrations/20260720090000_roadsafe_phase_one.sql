-- Barangay Buddy RoadSafe: community road hazards, confirmations and vehicle profiles.
-- Public information is advisory only and automatically expires unless reconfirmed.

create table if not exists public.road_hazard_reports (
  id uuid primary key default gen_random_uuid(),
  barangay_code text references public.barangays(code) on delete set null,
  reported_by uuid not null references auth.users(id) on delete cascade,
  hazard_type text not null check (hazard_type in (
    'flood','road_closure','landslide','fallen_tree','pothole','debris','accident','other'
  )),
  severity text not null default 'caution' check (severity in ('information','caution','avoid','closed')),
  passability text not null default 'unknown' check (passability in ('unknown','motorcycle_only','high_clearance_only','passable','impassable')),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  water_depth_cm numeric(7,2) check (water_depth_cm is null or water_depth_cm between 0 and 1000),
  description text check (description is null or char_length(description) <= 1000),
  photo_url text,
  source text not null default 'community' check (source in ('community','barangay','lgu','pagasa','dpwh','ndrrmc','other_official')),
  is_official boolean not null default false,
  status text not null default 'active' check (status in ('active','resolved','expired','rejected')),
  occurred_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > occurred_at)
);

create table if not exists public.road_hazard_confirmations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.road_hazard_reports(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote text not null check (vote in ('confirm','dispute','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id, user_id)
);

create table if not exists public.vehicle_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 80),
  vehicle_type text not null check (vehicle_type in ('motorcycle','tricycle','sedan','hatchback','suv','pickup','jeepney','van','truck','other')),
  make text,
  model text,
  year integer check (year is null or year between 1950 and 2100),
  ground_clearance_mm integer check (ground_clearance_mm is null or ground_clearance_mm between 50 and 1000),
  manufacturer_wading_depth_mm integer check (manufacturer_wading_depth_mm is null or manufacturer_wading_depth_mm between 0 and 2000),
  is_modified boolean not null default false,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists road_hazard_reports_barangay_active_idx
  on public.road_hazard_reports (barangay_code, status, expires_at desc);
create index if not exists road_hazard_reports_location_idx
  on public.road_hazard_reports (latitude, longitude);
create index if not exists road_hazard_confirmations_report_idx
  on public.road_hazard_confirmations (report_id, vote);
create index if not exists vehicle_profiles_user_idx
  on public.vehicle_profiles (user_id, is_default desc);

alter table public.road_hazard_reports enable row level security;
alter table public.road_hazard_confirmations enable row level security;
alter table public.vehicle_profiles enable row level security;

create policy "Public can read current road hazards"
  on public.road_hazard_reports for select
  using (status in ('active','resolved') and expires_at > now());

create policy "Authenticated users can report community hazards"
  on public.road_hazard_reports for insert to authenticated
  with check (auth.uid() = reported_by and source = 'community' and is_official = false);

create policy "Reporters can update their community hazards"
  on public.road_hazard_reports for update to authenticated
  using (auth.uid() = reported_by and source = 'community' and is_official = false)
  with check (auth.uid() = reported_by and source = 'community' and is_official = false);

create policy "Reporters can delete their community hazards"
  on public.road_hazard_reports for delete to authenticated
  using (auth.uid() = reported_by and source = 'community' and is_official = false);

create policy "Public can read hazard confirmations"
  on public.road_hazard_confirmations for select using (true);

create policy "Users manage their own hazard confirmations"
  on public.road_hazard_confirmations for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own vehicle profiles"
  on public.vehicle_profiles for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.road_hazard_reports is
  'Time-limited community and official road-condition reports. Information is advisory and must never be represented as a safety guarantee.';
