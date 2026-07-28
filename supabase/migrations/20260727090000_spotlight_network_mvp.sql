-- Barangay Buddy Spotlight Network MVP
create type public.spotlight_submission_status as enum ('pending','needs_changes','approved','rejected','featured');
create type public.spotlight_inquiry_status as enum ('new','contacted','closed');

create table public.spotlight_campaigns (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
  description text not null, starts_at timestamptz not null, submissions_close_at timestamptz not null,
  voting_starts_at timestamptz not null, voting_ends_at timestamptz not null,
  is_active boolean not null default false, commission_percent numeric(4,2) not null default 12.50 check (commission_percent between 10 and 15),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.spotlight_submissions (
  id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.spotlight_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, barangay_code text not null references public.barangays(code),
  slug text unique, stage_name text not null check (char_length(stage_name) between 2 and 80),
  category text not null check (char_length(category) between 2 and 50), biography text not null check (char_length(biography) between 40 and 2000),
  birth_date date not null, contact_email text not null, contact_phone text not null, availability text not null,
  audition_video_url text not null, private_photo_path text not null, public_photo_url text,
  guardian_name text, guardian_relationship text, guardian_email text, guardian_phone text,
  guardian_consent boolean not null default false, terms_accepted boolean not null default false,
  free_entry_acknowledged boolean not null default false, status public.spotlight_submission_status not null default 'pending',
  moderation_notes text, featured_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(campaign_id, user_id),
  check (birth_date <= current_date - interval '16 years'),
  check (birth_date <= current_date - interval '18 years' or (guardian_consent and guardian_name is not null and guardian_relationship is not null and (guardian_email is not null or guardian_phone is not null)))
);
create index spotlight_submissions_campaign_status_idx on public.spotlight_submissions(campaign_id,status);
create index spotlight_submissions_barangay_idx on public.spotlight_submissions(barangay_code);

create table public.spotlight_votes (
  id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.spotlight_campaigns(id) on delete cascade,
  submission_id uuid not null references public.spotlight_submissions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(),
  unique(campaign_id,submission_id,user_id)
);
create index spotlight_votes_submission_idx on public.spotlight_votes(submission_id);

create table public.spotlight_judge_scores (
  id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.spotlight_submissions(id) on delete cascade,
  judge_id uuid not null references auth.users(id) on delete cascade, score numeric(5,2) not null check(score between 0 and 100),
  notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(submission_id,judge_id)
);

create table public.spotlight_sponsor_inquiries (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
  company_name text not null, contact_name text not null, email text not null, phone text,
  package_tier text not null check(package_tier in ('community','spotlight','title')), budget_range text, message text,
  status public.spotlight_inquiry_status not null default 'new', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.spotlight_booking_requests (
  id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.spotlight_submissions(id),
  requester_id uuid not null references auth.users(id) on delete cascade, event_type text not null, event_date date not null,
  event_location text not null, audience_size integer check(audience_size > 0), budget_php numeric(12,2) check(budget_php > 0),
  transport_needed boolean not null default false, message text not null, commission_percent numeric(4,2) not null default 12.50 check(commission_percent between 10 and 15),
  status public.spotlight_inquiry_status not null default 'new', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create or replace view public.spotlight_public_profiles with (security_invoker=true) as
select s.id,s.campaign_id,s.slug,s.stage_name,s.category,s.biography,s.availability,s.audition_video_url,s.public_photo_url,s.status,
       s.barangay_code,b.name as barangay_name,c.name as city_name,p.name as province_name,s.featured_at
from public.spotlight_submissions s join public.barangays b on b.code=s.barangay_code
join public.cities_municipalities c on c.code=b.city_code join public.provinces p on p.code=c.province_code
where s.status in ('approved','featured');

alter table public.spotlight_campaigns enable row level security;
alter table public.spotlight_submissions enable row level security;
alter table public.spotlight_votes enable row level security;
alter table public.spotlight_judge_scores enable row level security;
alter table public.spotlight_sponsor_inquiries enable row level security;
alter table public.spotlight_booking_requests enable row level security;
create policy "Campaigns are public" on public.spotlight_campaigns for select using(true);
create policy "Approved talent or own submissions are readable" on public.spotlight_submissions for select using(status in ('approved','featured') or user_id=auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "Users submit own auditions" on public.spotlight_submissions for insert to authenticated with check(user_id=auth.uid() and status='pending' and terms_accepted and free_entry_acknowledged);
create policy "Users update own unreviewed auditions" on public.spotlight_submissions for update to authenticated using(user_id=auth.uid() and status in ('pending','needs_changes')) with check(user_id=auth.uid());
create policy "Admins moderate auditions" on public.spotlight_submissions for update to authenticated using(public.has_role(auth.uid(),'admin')) with check(public.has_role(auth.uid(),'admin'));
create policy "Users read own votes or admins read all" on public.spotlight_votes for select to authenticated using(user_id=auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "Users vote in open campaigns" on public.spotlight_votes for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.spotlight_submissions s join public.spotlight_campaigns c on c.id=s.campaign_id where s.id=submission_id and s.campaign_id=campaign_id and s.status in ('approved','featured') and now() between c.voting_starts_at and c.voting_ends_at));
create policy "Judges and admins read scores" on public.spotlight_judge_scores for select to authenticated using(judge_id=auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "Admins manage scores" on public.spotlight_judge_scores for all to authenticated using(public.has_role(auth.uid(),'admin')) with check(public.has_role(auth.uid(),'admin') and judge_id=auth.uid());
create policy "Anyone sends sponsor inquiry" on public.spotlight_sponsor_inquiries for insert with check(status='new');
create policy "Admins manage sponsor inquiries" on public.spotlight_sponsor_inquiries for all to authenticated using(public.has_role(auth.uid(),'admin')) with check(public.has_role(auth.uid(),'admin'));
create policy "Users read own bookings" on public.spotlight_booking_requests for select to authenticated using(requester_id=auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "Users request eligible talent" on public.spotlight_booking_requests for insert to authenticated with check(requester_id=auth.uid() and exists(select 1 from public.spotlight_submissions s where s.id=submission_id and s.status in ('approved','featured') and s.birth_date <= current_date-interval '16 years'));
create policy "Admins manage bookings" on public.spotlight_booking_requests for update to authenticated using(public.has_role(auth.uid(),'admin')) with check(public.has_role(auth.uid(),'admin'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('spotlight-submissions','spotlight-submissions',false,5242880,array['image/jpeg','image/png','image/webp']),
('spotlight-media','spotlight-media',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy "Applicants upload private spotlight photos" on storage.objects for insert to authenticated with check(bucket_id='spotlight-submissions' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Applicants read own private spotlight photos" on storage.objects for select to authenticated using(bucket_id='spotlight-submissions' and ((storage.foldername(name))[1]=auth.uid()::text or public.has_role(auth.uid(),'admin')));
create policy "Public reads published spotlight media" on storage.objects for select using(bucket_id='spotlight-media');

create view public.spotlight_leaderboard as
with eligible as (
  select s.id,s.campaign_id,s.slug,s.stage_name,s.category,s.biography,s.availability,
         s.audition_video_url,s.public_photo_url,s.status,s.barangay_code,b.name barangay_name,
         c.name city_name,p.name province_name,s.featured_at,
         count(distinct v.id)::integer votes,coalesce(avg(j.score),0)::numeric(5,2) judge_score
  from public.spotlight_submissions s
  join public.barangays b on b.code=s.barangay_code
  join public.cities_municipalities c on c.code=b.city_code
  join public.provinces p on p.code=c.province_code
  left join public.spotlight_votes v on v.submission_id=s.id and v.campaign_id=s.campaign_id
  left join public.spotlight_judge_scores j on j.submission_id=s.id
  where s.status in ('approved','featured')
  group by s.id,b.name,c.name,p.name
), scored as (select *,max(votes) over(partition by campaign_id) max_votes from eligible)
select id,campaign_id,slug,stage_name,category,biography,availability,audition_video_url,
       public_photo_url,status,barangay_code,barangay_name,city_name,province_name,featured_at,
       votes,judge_score,round((case when max_votes>0 then votes::numeric/max_votes*70 else 0 end)+(judge_score*.30),2) combined_score
from scored;
revoke all on public.spotlight_leaderboard from public;
grant select on public.spotlight_leaderboard to anon,authenticated;

insert into public.spotlight_campaigns(slug,name,description,starts_at,submissions_close_at,voting_starts_at,voting_ends_at,is_active)
values('star-of-the-month','Star of the Month','Free local talent auditions. Every barangay deserves a spotlight.',now(),now()+interval '21 days',now(),now()+interval '30 days',true);
