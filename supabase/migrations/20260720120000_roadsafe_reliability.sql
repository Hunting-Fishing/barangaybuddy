-- Resident subscriptions, notification inbox, controlled report media and stock freshness.

create table if not exists public.roadsafe_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  barangay_code text not null references public.barangays(code) on delete cascade,
  minimum_severity text not null default 'warning' check (minimum_severity in ('information','watch','warning','emergency')),
  email_enabled boolean not null default true,
  push_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, barangay_code)
);

create table if not exists public.roadsafe_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_id uuid not null references public.official_safety_alerts(id) on delete cascade,
  channel text not null check (channel in ('in_app','email','push','sms')),
  status text not null default 'pending' check (status in ('pending','sent','failed','read')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (user_id, alert_id, channel)
);

create or replace function public.queue_roadsafe_alert_notifications()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.roadsafe_notifications(user_id, alert_id, channel)
  select s.user_id, NEW.id, 'in_app'
  from public.roadsafe_subscriptions s
  where s.barangay_code = NEW.barangay_code
    and case NEW.severity
      when 'emergency' then 4 when 'warning' then 3 when 'watch' then 2 else 1 end
      >= case s.minimum_severity
      when 'emergency' then 4 when 'warning' then 3 when 'watch' then 2 else 1 end;
  return NEW;
end;
$$;

do $$ begin
  create trigger queue_roadsafe_alert after insert on public.official_safety_alerts for each row execute function public.queue_roadsafe_alert_notifications();
exception when duplicate_object then null; end $$;

alter table public.listings add column if not exists stock_checked_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('roadsafe-reports', 'roadsafe-reports', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table public.roadsafe_subscriptions enable row level security;
alter table public.roadsafe_notifications enable row level security;

create policy "Users manage their RoadSafe subscriptions" on public.roadsafe_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users read their RoadSafe notifications" on public.roadsafe_notifications for select to authenticated using (user_id = auth.uid());
create policy "Users mark their notifications read" on public.roadsafe_notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and status = 'read');

create policy "Authenticated users upload RoadSafe photos" on storage.objects for insert to authenticated with check (bucket_id = 'roadsafe-reports' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Public can view RoadSafe photos" on storage.objects for select using (bucket_id = 'roadsafe-reports');
create policy "Users remove their RoadSafe photos" on storage.objects for delete to authenticated using (bucket_id = 'roadsafe-reports' and (storage.foldername(name))[1] = auth.uid()::text);

comment on column public.listings.stock_checked_at is 'Last explicit business-owner confirmation that the displayed stock state is current.';
