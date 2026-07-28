-- Reusable Barangay Buddy family accounts and feature-specific minor consent.
create type public.family_member_kind as enum ('adult','child');
create type public.guardian_relationship_status as enum ('pending','verified','revoked');
create type public.minor_permission_type as enum (
  'public_profile','spotlight_participation','public_media','leaderboard',
  'booking_inquiries','transportation','live_events'
);
create type public.family_discount_kind as enum ('percent','fixed_php','bonus');

create table public.family_groups (
  id uuid primary key default gen_random_uuid(), name text not null check(char_length(name) between 2 and 100),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.family_members (
  id uuid primary key default gen_random_uuid(), family_group_id uuid not null references public.family_groups(id) on delete cascade,
  kind public.family_member_kind not null, user_id uuid references auth.users(id) on delete set null,
  legal_name text not null check(char_length(legal_name) between 2 and 150), display_name text not null check(char_length(display_name) between 2 and 100),
  birth_date date not null, barangay_code text not null references public.barangays(code), private_photo_path text, public_photo_url text,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check((kind='adult' and user_id is not null) or (kind='child' and user_id is null))
);
create table public.guardian_child_relationships (
  id uuid primary key default gen_random_uuid(), child_member_id uuid not null references public.family_members(id) on delete cascade,
  guardian_account_id uuid not null references auth.users(id) on delete cascade,
  relationship text not null check(char_length(relationship) between 2 and 60), is_primary boolean not null default false,
  status public.guardian_relationship_status not null default 'verified', verified_at timestamptz,
  created_at timestamptz not null default now(), revoked_at timestamptz, unique(child_member_id,guardian_account_id)
);
create unique index one_primary_guardian_per_child on public.guardian_child_relationships(child_member_id) where is_primary and status='verified';

create table public.minor_consents (
  id uuid primary key default gen_random_uuid(), relationship_id uuid not null references public.guardian_child_relationships(id),
  child_profile_id uuid not null references public.family_members(id), guardian_account_id uuid not null references auth.users(id),
  permission_type public.minor_permission_type not null, consent_version text not null, consent_text text not null,
  checkbox_confirmed boolean not null, typed_guardian_name text not null,
  granted_at timestamptz not null default now(), revoked_at timestamptz, audit_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index one_active_minor_consent on public.minor_consents(child_profile_id,permission_type) where revoked_at is null;
create index minor_consents_child_idx on public.minor_consents(child_profile_id,permission_type,revoked_at);

create table public.family_rate_offers (
  id uuid primary key default gen_random_uuid(), product_code text not null unique, name text not null, description text not null,
  category text not null, base_price_php numeric(12,2) not null check(base_price_php >= 500),
  discount_kind public.family_discount_kind not null, discount_value numeric(12,2) not null check(discount_value > 0),
  owned_by_barangay_buddy boolean not null default true, active boolean not null default true,
  starts_at timestamptz, ends_at timestamptz, created_at timestamptz not null default now()
);

create function public.is_guardian_of(p_guardian uuid,p_child uuid,p_primary_only boolean default false)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.guardian_child_relationships r where r.child_member_id=p_child and r.guardian_account_id=p_guardian and r.status='verified' and (not p_primary_only or r.is_primary));
$$;
create function public.has_minor_permission(p_child uuid,p_permission public.minor_permission_type,p_primary_only boolean default false)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.minor_consents c join public.guardian_child_relationships r on r.id=c.relationship_id
    where c.child_profile_id=p_child and c.permission_type=p_permission and c.revoked_at is null and c.checkbox_confirmed
      and r.status='verified' and (not p_primary_only or r.is_primary));
$$;
grant execute on function public.is_guardian_of(uuid,uuid,boolean) to authenticated;
grant execute on function public.has_minor_permission(uuid,public.minor_permission_type,boolean) to anon,authenticated;

create function public.create_guardian_managed_child(p_family_name text,p_legal_name text,p_display_name text,p_birth_date date,p_barangay_code text,p_photo_path text,p_relationship text)
returns uuid language plpgsql security definer set search_path=public as $$ declare v_group uuid; v_child uuid; begin
 if auth.uid() is null or extract(year from age(current_date,p_birth_date))>=18 then raise exception 'A child profile requires an authenticated adult guardian and an age under 18'; end if;
 select id into v_group from public.family_groups where created_by=auth.uid() order by created_at limit 1;
 if v_group is null then insert into public.family_groups(name,created_by) values(p_family_name,auth.uid()) returning id into v_group; end if;
 insert into public.family_members(family_group_id,kind,legal_name,display_name,birth_date,barangay_code,private_photo_path,created_by) values(v_group,'child',p_legal_name,p_display_name,p_birth_date,p_barangay_code,p_photo_path,auth.uid()) returning id into v_child;
 insert into public.guardian_child_relationships(child_member_id,guardian_account_id,relationship,is_primary,status,verified_at) values(v_child,auth.uid(),p_relationship,true,'verified',now());
 return v_child;
end $$;
grant execute on function public.create_guardian_managed_child(text,text,text,date,text,text,text) to authenticated;
create function public.invite_second_guardian(p_child uuid,p_guardian_account uuid,p_relationship text)
returns uuid language plpgsql security definer set search_path=public as $$ declare v_id uuid; begin
 if not public.is_guardian_of(auth.uid(),p_child,true) then raise exception 'Only the primary guardian may invite another guardian'; end if;
 if p_guardian_account=auth.uid() then raise exception 'Guardian is already linked'; end if;
 insert into public.guardian_child_relationships(child_member_id,guardian_account_id,relationship,status) values(p_child,p_guardian_account,p_relationship,'pending') returning id into v_id; return v_id;
end $$;
create function public.accept_guardian_link(p_relationship_id uuid)
returns void language plpgsql security definer set search_path=public as $$ begin
 update public.guardian_child_relationships set status='verified',verified_at=now() where id=p_relationship_id and guardian_account_id=auth.uid() and status='pending';
 if not found then raise exception 'Pending guardian invitation not found'; end if;
end $$;
grant execute on function public.invite_second_guardian(uuid,uuid,text) to authenticated;
grant execute on function public.accept_guardian_link(uuid) to authenticated;

create function public.enforce_two_guardians() returns trigger language plpgsql as $$ begin
  if new.status='verified' and (select count(*) from public.guardian_child_relationships where child_member_id=new.child_member_id and status='verified' and id<>new.id)>=2 then raise exception 'A child may have at most two verified guardians'; end if; return new; end $$;
create trigger enforce_two_guardians_trigger before insert or update on public.guardian_child_relationships for each row execute function public.enforce_two_guardians();
create function public.protect_family_member_identity() returns trigger language plpgsql as $$ begin
 if new.id<>old.id or new.family_group_id<>old.family_group_id or new.kind<>old.kind or new.created_by<>old.created_by or new.user_id is distinct from old.user_id then raise exception 'Family member ownership fields cannot be changed'; end if; return new; end $$;
create trigger protect_family_member_identity_trigger before update on public.family_members for each row execute function public.protect_family_member_identity();
create function public.protect_consent_audit() returns trigger language plpgsql as $$ begin
 if (to_jsonb(new)-'revoked_at')<>(to_jsonb(old)-'revoked_at') then raise exception 'Consent history is immutable; only revocation is allowed'; end if; return new; end $$;
create trigger protect_consent_audit_trigger before update on public.minor_consents for each row execute function public.protect_consent_audit();
create function public.capture_consent_request_metadata() returns trigger language plpgsql as $$ declare v_headers jsonb; begin
 v_headers:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb);
 new.audit_metadata:=coalesce(new.audit_metadata,'{}'::jsonb)||jsonb_build_object('ip',coalesce(v_headers->>'cf-connecting-ip',v_headers->>'x-forwarded-for'),'recorded_by','database'); return new; end $$;
create trigger capture_consent_request_metadata_trigger before insert on public.minor_consents for each row execute function public.capture_consent_request_metadata();

alter table public.family_groups enable row level security; alter table public.family_members enable row level security;
alter table public.guardian_child_relationships enable row level security; alter table public.minor_consents enable row level security;
alter table public.family_rate_offers enable row level security;
create policy "Guardians view their family groups" on public.family_groups for select to authenticated using(created_by=auth.uid() or exists(select 1 from public.family_members m where m.family_group_id=family_groups.id and public.is_guardian_of(auth.uid(),m.id)));
create policy "Adults create family groups" on public.family_groups for insert to authenticated with check(created_by=auth.uid());
create policy "Creators update family groups" on public.family_groups for update to authenticated using(created_by=auth.uid()) with check(created_by=auth.uid());
create policy "Guardians view family members" on public.family_members for select to authenticated using(created_by=auth.uid() or public.is_guardian_of(auth.uid(),id) or user_id=auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "Guardians create children" on public.family_members for insert to authenticated with check(created_by=auth.uid() and kind='child' and exists(select 1 from public.family_groups g where g.id=family_group_id and g.created_by=auth.uid()));
create policy "Active guardians maintain children" on public.family_members for update to authenticated using(kind='child' and public.is_guardian_of(auth.uid(),id)) with check(kind='child');
create policy "Guardians view relationships" on public.guardian_child_relationships for select to authenticated using(guardian_account_id=auth.uid() or public.is_guardian_of(auth.uid(),child_member_id) or public.has_role(auth.uid(),'admin'));
create policy "Family creators link themselves" on public.guardian_child_relationships for insert to authenticated with check(guardian_account_id=auth.uid() and exists(select 1 from public.family_members m join public.family_groups g on g.id=m.family_group_id where m.id=child_member_id and g.created_by=auth.uid()));
create policy "Guardians view child consents" on public.minor_consents for select to authenticated using(public.is_guardian_of(auth.uid(),child_profile_id) or public.has_role(auth.uid(),'admin'));
create policy "Verified guardians attest consent" on public.minor_consents for insert to authenticated with check(guardian_account_id=auth.uid() and checkbox_confirmed and public.is_guardian_of(auth.uid(),child_profile_id) and exists(select 1 from public.guardian_child_relationships r where r.id=relationship_id and r.child_member_id=child_profile_id and r.guardian_account_id=auth.uid() and r.status='verified'));
create policy "Granting guardian revokes consent" on public.minor_consents for update to authenticated using(guardian_account_id=auth.uid() and revoked_at is null) with check(guardian_account_id=auth.uid() and revoked_at is not null);
create policy "Verified families view family rate offers" on public.family_rate_offers for select to authenticated using(active and owned_by_barangay_buddy and base_price_php>=500 and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()) and exists(select 1 from public.guardian_child_relationships r where r.guardian_account_id=auth.uid() and r.status='verified'));
create policy "Admins manage family rate offers" on public.family_rate_offers for all to authenticated using(public.has_role(auth.uid(),'admin')) with check(public.has_role(auth.uid(),'admin'));
insert into public.family_rate_offers(product_code,name,description,category,base_price_php,discount_kind,discount_value)
values('family-community-ad-boost','Family Community Ad Boost','A Barangay Buddy-hosted community advertising boost for verified family accounts.','advertising',500,'percent',10);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('family-private','family-private',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy "Guardians upload family photos" on storage.objects for insert to authenticated with check(bucket_id='family-private' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Guardians read family photos" on storage.objects for select to authenticated using(bucket_id='family-private' and ((storage.foldername(name))[1]=auth.uid()::text or public.has_role(auth.uid(),'admin')));

-- Spotlight now references the reusable child profile and campaign age band.
alter table public.spotlight_campaigns add column min_age integer not null default 16 check(min_age between 0 and 120), add column max_age integer check(max_age is null or max_age>=min_age);
create policy "Admins update spotlight campaign age rules" on public.spotlight_campaigns for update to authenticated using(public.has_role(auth.uid(),'admin')) with check(public.has_role(auth.uid(),'admin'));
alter table public.spotlight_submissions add column child_profile_id uuid references public.family_members(id), alter column user_id drop not null;
alter table public.spotlight_submissions drop constraint if exists spotlight_submissions_campaign_id_user_id_key;
create unique index one_adult_submission_per_campaign on public.spotlight_submissions(campaign_id,user_id) where child_profile_id is null;
create unique index one_child_submission_per_campaign on public.spotlight_submissions(campaign_id,child_profile_id) where child_profile_id is not null;
alter table public.spotlight_submissions drop constraint if exists spotlight_submissions_birth_date_check;
alter table public.spotlight_submissions drop constraint if exists spotlight_submissions_check;
alter table public.spotlight_submissions add constraint spotlight_submission_actor_check check((child_profile_id is null and user_id is not null) or child_profile_id is not null);

alter table public.spotlight_booking_requests add column minor_child_profile_id uuid references public.family_members(id), add column guardian_approved_by uuid references auth.users(id), add column guardian_approved_at timestamptz;
create table public.spotlight_minor_booking_approvals (
 id uuid primary key default gen_random_uuid(), booking_request_id uuid not null unique references public.spotlight_booking_requests(id) on delete cascade,
 child_profile_id uuid not null references public.family_members(id), guardian_account_id uuid not null references auth.users(id),
 booking_approved boolean not null, live_event_approved boolean not null default false, transportation_approved boolean not null default false,
 consent_version text not null, typed_guardian_name text not null, approved_at timestamptz not null default now(), revoked_at timestamptz, audit_metadata jsonb not null default '{}'::jsonb
);
alter table public.spotlight_minor_booking_approvals enable row level security;
create policy "Primary guardian views booking approvals" on public.spotlight_minor_booking_approvals for select to authenticated using(public.is_guardian_of(auth.uid(),child_profile_id,true) or public.has_role(auth.uid(),'admin'));
create policy "Primary guardian approves minor booking" on public.spotlight_minor_booking_approvals for insert to authenticated with check(guardian_account_id=auth.uid() and public.is_guardian_of(auth.uid(),child_profile_id,true) and public.has_minor_permission(child_profile_id,'booking_inquiries',true) and (not transportation_approved or public.has_minor_permission(child_profile_id,'transportation',true)) and (not live_event_approved or public.has_minor_permission(child_profile_id,'live_events',true)));
create policy "Guardians view minor booking requests" on public.spotlight_booking_requests for select to authenticated using(minor_child_profile_id is not null and public.is_guardian_of(auth.uid(),minor_child_profile_id));

create function public.prepare_minor_booking() returns trigger language plpgsql security definer set search_path=public as $$ declare v_child uuid; begin
 select child_profile_id into v_child from public.spotlight_submissions where id=new.submission_id and status in ('approved','featured');
 new.minor_child_profile_id:=v_child;
 if v_child is not null and not public.has_minor_permission(v_child,'booking_inquiries') then raise exception 'Guardian booking permission is not active'; end if;
 return new; end $$;
create trigger prepare_minor_booking_trigger before insert on public.spotlight_booking_requests for each row execute function public.prepare_minor_booking();
drop policy "Users request eligible talent" on public.spotlight_booking_requests;
create policy "Users request eligible talent" on public.spotlight_booking_requests for insert to authenticated with check(requester_id=auth.uid() and exists(select 1 from public.spotlight_submissions s where s.id=submission_id and s.status in ('approved','featured') and (s.child_profile_id is null or (minor_child_profile_id=s.child_profile_id and public.has_minor_permission(s.child_profile_id,'booking_inquiries')))));

create function public.apply_minor_booking_approval() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if new.booking_approved then update public.spotlight_booking_requests set guardian_approved_by=new.guardian_account_id,guardian_approved_at=new.approved_at where id=new.booking_request_id and minor_child_profile_id=new.child_profile_id; end if; return new; end $$;
create trigger apply_minor_booking_approval_trigger after insert on public.spotlight_minor_booking_approvals for each row execute function public.apply_minor_booking_approval();
create function public.block_unapproved_minor_booking_progress() returns trigger language plpgsql as $$ begin
 if new.minor_child_profile_id is not null and new.status<>'new' and new.guardian_approved_at is null then raise exception 'Primary guardian approval is required before progressing this minor booking'; end if; return new; end $$;
create trigger block_unapproved_minor_booking_progress_trigger before update on public.spotlight_booking_requests for each row execute function public.block_unapproved_minor_booking_progress();

drop policy "Users submit own auditions" on public.spotlight_submissions;
drop policy "Approved talent or own submissions are readable" on public.spotlight_submissions;
create policy "Approved talent applicants guardians or admins read submissions" on public.spotlight_submissions for select using(status in ('approved','featured') or user_id=auth.uid() or (child_profile_id is not null and public.is_guardian_of(auth.uid(),child_profile_id)) or public.has_role(auth.uid(),'admin'));
create policy "Adults or guardians submit auditions" on public.spotlight_submissions for insert to authenticated with check(status='pending' and terms_accepted and free_entry_acknowledged and ((child_profile_id is null and user_id=auth.uid() and birth_date<=current_date-interval '18 years') or (child_profile_id is not null and public.is_guardian_of(auth.uid(),child_profile_id) and public.has_minor_permission(child_profile_id,'spotlight_participation') and birth_date=(select birth_date from public.family_members where id=child_profile_id) and extract(year from age(birth_date)) between (select min_age from public.spotlight_campaigns where id=campaign_id) and coalesce((select max_age from public.spotlight_campaigns where id=campaign_id),120))));
drop policy "Users update own unreviewed auditions" on public.spotlight_submissions;
create policy "Adults or guardians update auditions" on public.spotlight_submissions for update to authenticated using(status in ('pending','needs_changes') and ((child_profile_id is null and user_id=auth.uid()) or public.is_guardian_of(auth.uid(),child_profile_id))) with check((child_profile_id is null and user_id=auth.uid()) or public.is_guardian_of(auth.uid(),child_profile_id));

create or replace view public.spotlight_public_profiles with (security_invoker=true) as
select s.id,s.campaign_id,s.slug,s.stage_name,s.category,s.biography,s.availability,s.audition_video_url,s.public_photo_url,s.status,s.barangay_code,b.name barangay_name,c.name city_name,p.name province_name,s.featured_at
from public.spotlight_submissions s join public.barangays b on b.code=s.barangay_code join public.cities_municipalities c on c.code=b.city_code join public.provinces p on p.code=c.province_code
where s.status in ('approved','featured') and (s.child_profile_id is null or (public.has_minor_permission(s.child_profile_id,'public_profile') and public.has_minor_permission(s.child_profile_id,'public_media') and public.has_minor_permission(s.child_profile_id,'spotlight_participation')));

drop view public.spotlight_leaderboard;
create view public.spotlight_leaderboard as
with eligible as (select s.id,s.campaign_id,s.slug,s.stage_name,s.category,s.biography,s.availability,s.audition_video_url,s.public_photo_url,s.status,s.barangay_code,b.name barangay_name,c.name city_name,p.name province_name,s.featured_at,count(distinct v.id)::integer votes,coalesce(avg(j.score),0)::numeric(5,2) judge_score
from public.spotlight_submissions s join public.barangays b on b.code=s.barangay_code join public.cities_municipalities c on c.code=b.city_code join public.provinces p on p.code=c.province_code left join public.spotlight_votes v on v.submission_id=s.id and v.campaign_id=s.campaign_id left join public.spotlight_judge_scores j on j.submission_id=s.id
where s.status in ('approved','featured') and (s.child_profile_id is null or (public.has_minor_permission(s.child_profile_id,'public_profile') and public.has_minor_permission(s.child_profile_id,'public_media') and public.has_minor_permission(s.child_profile_id,'spotlight_participation') and public.has_minor_permission(s.child_profile_id,'leaderboard'))) group by s.id,b.name,c.name,p.name), scored as(select *,max(votes) over(partition by campaign_id) max_votes from eligible)
select id,campaign_id,slug,stage_name,category,biography,availability,audition_video_url,public_photo_url,status,barangay_code,barangay_name,city_name,province_name,featured_at,votes,judge_score,round((case when max_votes>0 then votes::numeric/max_votes*70 else 0 end)+(judge_score*.30),2) combined_score from scored;
revoke all on public.spotlight_leaderboard from public; grant select on public.spotlight_leaderboard to anon,authenticated;

-- Consent withdrawal immediately de-publishes affected minors without erasing history.
create function public.sync_minor_spotlight_visibility() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if new.revoked_at is not null and old.revoked_at is null and new.permission_type in ('public_profile','spotlight_participation','public_media','leaderboard') then
   delete from storage.objects o where o.bucket_id='spotlight-media' and exists(select 1 from public.spotlight_submissions s where s.child_profile_id=new.child_profile_id and o.name like 'talent/'||s.id::text||'.%');
   update public.spotlight_submissions set status='needs_changes',updated_at=now() where child_profile_id=new.child_profile_id and status in ('approved','featured');
 end if; return new; end $$;
create trigger sync_minor_visibility_on_revoke after update of revoked_at on public.minor_consents for each row execute function public.sync_minor_spotlight_visibility();
