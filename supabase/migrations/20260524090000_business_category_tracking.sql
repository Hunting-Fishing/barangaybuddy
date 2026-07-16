create table if not exists public.business_category_interactions (
  id uuid primary key default gen_random_uuid(),
  group_id text not null,
  item_id text not null,
  label text not null,
  action text not null check (action in ('category_view', 'type_search')),
  count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, item_id, action)
);

create table if not exists public.business_category_suggestions (
  id uuid primary key default gen_random_uuid(),
  group_id text not null,
  group_label text not null,
  suggestion text not null,
  normalized_suggestion text not null,
  note text null,
  suggestion_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, normalized_suggestion)
);

alter table public.business_category_interactions enable row level security;
alter table public.business_category_suggestions enable row level security;

drop policy if exists "Public can read category interactions" on public.business_category_interactions;
create policy "Public can read category interactions"
on public.business_category_interactions
for select
using (true);

drop policy if exists "Public can read category suggestions" on public.business_category_suggestions;
create policy "Public can read category suggestions"
on public.business_category_suggestions
for select
using (true);

create or replace function public.increment_business_category_interaction(
  p_group_id text,
  p_item_id text,
  p_label text,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.business_category_interactions (
    group_id,
    item_id,
    label,
    action,
    count
  )
  values (
    p_group_id,
    p_item_id,
    p_label,
    p_action,
    1
  )
  on conflict (group_id, item_id, action)
  do update set
    label = excluded.label,
    count = public.business_category_interactions.count + 1,
    updated_at = now();
end;
$$;

create or replace function public.upsert_business_category_suggestion(
  p_group_id text,
  p_group_label text,
  p_suggestion text,
  p_normalized_suggestion text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.business_category_suggestions (
    group_id,
    group_label,
    suggestion,
    normalized_suggestion,
    note,
    suggestion_count
  )
  values (
    p_group_id,
    p_group_label,
    p_suggestion,
    p_normalized_suggestion,
    nullif(p_note, ''),
    1
  )
  on conflict (group_id, normalized_suggestion)
  do update set
    suggestion = excluded.suggestion,
    group_label = excluded.group_label,
    note = coalesce(excluded.note, public.business_category_suggestions.note),
    suggestion_count = public.business_category_suggestions.suggestion_count + 1,
    last_seen_at = now(),
    updated_at = now();
end;
$$;

grant select on public.business_category_interactions to anon, authenticated;
grant select on public.business_category_suggestions to anon, authenticated;
grant execute on function public.increment_business_category_interaction(text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.upsert_business_category_suggestion(text, text, text, text, text) to anon, authenticated, service_role;