-- External delivery and verified-source integration support.

alter table public.roadsafe_subscriptions
  add column if not exists sms_enabled boolean not null default false,
  add column if not exists phone_number text;

alter table public.roadsafe_notifications
  add column if not exists attempts integer not null default 0,
  add column if not exists last_error text,
  add column if not exists provider_message_id text;

alter table public.official_safety_alerts
  add column if not exists external_id text,
  add column if not exists ingested_at timestamptz;

create unique index if not exists official_alert_source_external_uidx
  on public.official_safety_alerts(source_name, external_id)
  where external_id is not null;

create or replace function public.queue_roadsafe_alert_notifications()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.roadsafe_notifications(user_id, alert_id, channel)
  select s.user_id, NEW.id, channels.channel
  from public.roadsafe_subscriptions s
  cross join lateral (
    select 'in_app'::text as channel
    union all select 'email' where s.email_enabled
    union all select 'sms' where s.sms_enabled and s.phone_number is not null
  ) channels
  where s.barangay_code = NEW.barangay_code
    and case NEW.severity when 'emergency' then 4 when 'warning' then 3 when 'watch' then 2 else 1 end
      >= case s.minimum_severity when 'emergency' then 4 when 'warning' then 3 when 'watch' then 2 else 1 end
  on conflict (user_id, alert_id, channel) do nothing;
  return NEW;
end;
$$;

comment on column public.roadsafe_subscriptions.phone_number is 'Optional Philippines mobile number used only after explicit SMS opt-in.';
