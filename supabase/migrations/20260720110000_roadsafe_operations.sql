-- Barangay-scoped RoadSafe operators, emergency contacts and immutable audit history.

create table if not exists public.roadsafe_operator_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  barangay_code text not null references public.barangays(code) on delete cascade,
  role text not null check (role in ('barangay_operator','lgu_officer','moderator')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, barangay_code)
);

create or replace function public.is_roadsafe_operator(_barangay_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin') or exists (
    select 1 from public.roadsafe_operator_assignments
    where user_id = auth.uid() and barangay_code = _barangay_code
  )
$$;

revoke execute on function public.is_roadsafe_operator(text) from public, anon;
grant execute on function public.is_roadsafe_operator(text) to authenticated;

create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  barangay_code text not null references public.barangays(code) on delete cascade,
  service_type text not null check (service_type in ('barangay','police','fire','ambulance','rescue','mdrrmo','cdrrmo','hospital','other')),
  name text not null,
  phone_number text not null,
  secondary_phone text,
  availability text,
  is_verified boolean not null default false,
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.roadsafe_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  barangay_code text,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  previous_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.audit_roadsafe_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  old_row jsonb := case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end;
  new_row jsonb := case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end;
begin
  insert into public.roadsafe_audit_log(actor_id, barangay_code, entity_type, entity_id, action, previous_data, new_data)
  values (
    auth.uid(),
    coalesce(new_row->>'barangay_code', old_row->>'barangay_code'),
    TG_TABLE_NAME,
    coalesce(new_row->>'id', old_row->>'id'),
    lower(TG_OP), old_row, new_row
  );
  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

do $$ begin
  create trigger audit_road_hazard_reports after insert or update or delete on public.road_hazard_reports for each row execute function public.audit_roadsafe_change();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger audit_official_safety_alerts after insert or update or delete on public.official_safety_alerts for each row execute function public.audit_roadsafe_change();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger audit_evacuation_centres after insert or update or delete on public.evacuation_centres for each row execute function public.audit_roadsafe_change();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger audit_emergency_contacts after insert or update or delete on public.emergency_contacts for each row execute function public.audit_roadsafe_change();
exception when duplicate_object then null; end $$;

create index if not exists roadsafe_operator_user_idx on public.roadsafe_operator_assignments(user_id, barangay_code);
create index if not exists emergency_contacts_barangay_idx on public.emergency_contacts(barangay_code, service_type);
create index if not exists roadsafe_audit_barangay_idx on public.roadsafe_audit_log(barangay_code, created_at desc);

alter table public.roadsafe_operator_assignments enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.roadsafe_audit_log enable row level security;

create policy "Operators can view their assignments" on public.roadsafe_operator_assignments for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Admins manage operator assignments" on public.roadsafe_operator_assignments for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Public can read emergency contacts" on public.emergency_contacts for select using (true);
create policy "Operators manage emergency contacts" on public.emergency_contacts for all to authenticated using (public.is_roadsafe_operator(barangay_code)) with check (public.is_roadsafe_operator(barangay_code));
create policy "Operators can read scoped audit history" on public.roadsafe_audit_log for select to authenticated using (public.is_roadsafe_operator(barangay_code));

create policy "Operators moderate road hazards" on public.road_hazard_reports for update to authenticated using (public.is_roadsafe_operator(barangay_code)) with check (public.is_roadsafe_operator(barangay_code));
create policy "Operators publish official alerts" on public.official_safety_alerts for insert to authenticated with check (public.is_roadsafe_operator(barangay_code));
create policy "Operators update official alerts" on public.official_safety_alerts for update to authenticated using (public.is_roadsafe_operator(barangay_code)) with check (public.is_roadsafe_operator(barangay_code));
create policy "Operators remove official alerts" on public.official_safety_alerts for delete to authenticated using (public.is_roadsafe_operator(barangay_code));
create policy "Operators create evacuation centres" on public.evacuation_centres for insert to authenticated with check (public.is_roadsafe_operator(barangay_code));
create policy "Operators update evacuation centres" on public.evacuation_centres for update to authenticated using (public.is_roadsafe_operator(barangay_code)) with check (public.is_roadsafe_operator(barangay_code));
create policy "Operators remove evacuation centres" on public.evacuation_centres for delete to authenticated using (public.is_roadsafe_operator(barangay_code));

comment on table public.roadsafe_audit_log is 'Append-only audit trail populated by database triggers; clients have no insert, update or delete policy.';
