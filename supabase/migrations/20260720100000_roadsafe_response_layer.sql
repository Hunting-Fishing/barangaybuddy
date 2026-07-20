-- Barangay Buddy RoadSafe response layer: verified alerts and evacuation centres.

create table if not exists public.official_safety_alerts (
  id uuid primary key default gen_random_uuid(),
  barangay_code text references public.barangays(code) on delete cascade,
  headline text not null check (char_length(headline) between 3 and 180),
  message text not null check (char_length(message) between 3 and 2000),
  severity text not null default 'information' check (severity in ('information','watch','warning','emergency')),
  source_name text not null,
  source_url text,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (expires_at > issued_at)
);

create table if not exists public.evacuation_centres (
  id uuid primary key default gen_random_uuid(),
  barangay_code text not null references public.barangays(code) on delete cascade,
  name text not null,
  address text,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  contact_number text,
  capacity integer check (capacity is null or capacity >= 0),
  status text not null default 'standby' check (status in ('standby','open','full','closed')),
  notes text,
  updated_at timestamptz not null default now()
);

create index if not exists official_safety_alerts_current_idx on public.official_safety_alerts (barangay_code, is_active, expires_at desc);
create index if not exists evacuation_centres_barangay_idx on public.evacuation_centres (barangay_code, status);

alter table public.official_safety_alerts enable row level security;
alter table public.evacuation_centres enable row level security;

create policy "Public can read current official alerts" on public.official_safety_alerts for select using (is_active and expires_at > now());
create policy "Public can read evacuation centres" on public.evacuation_centres for select using (true);

comment on table public.official_safety_alerts is 'Verified alerts published by trusted server-side integrations or authorized barangay/LGU operators.';
comment on table public.evacuation_centres is 'Barangay emergency centres and their current operating status.';
