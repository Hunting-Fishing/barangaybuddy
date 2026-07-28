-- Spotlight completion: rubric judging, People's Choice, vote moderation and booking states.
-- Rollback notes: docs/migrations/20260728110000_spotlight_hardening.rollback.md

alter table public.spotlight_votes add column invalidated_at timestamptz, add column invalidated_by uuid references auth.users(id), add column invalidation_reason text;
alter table public.spotlight_votes add constraint spotlight_vote_invalidation_audit check(invalidated_at is null or (invalidated_by is not null and length(trim(invalidation_reason))>=5));
create policy "Admins invalidate votes" on public.spotlight_votes for update to authenticated using(public.has_role(auth.uid(),'admin')) with check(public.has_role(auth.uid(),'admin'));
create function public.rate_limit_spotlight_votes() returns trigger language plpgsql as $$ begin
 if (select count(*) from public.spotlight_votes where user_id=new.user_id and created_at>now()-interval '1 minute')>=5 then raise exception 'Vote rate limit reached; please wait before voting again'; end if;
 return new;
end $$;
create trigger rate_limit_spotlight_votes_trigger before insert on public.spotlight_votes for each row execute function public.rate_limit_spotlight_votes();

alter table public.spotlight_judge_scores
  add column talent smallint check(talent between 0 and 100),
  add column originality smallint check(originality between 0 and 100),
  add column presentation smallint check(presentation between 0 and 100),
  add column barangay_appeal smallint check(barangay_appeal between 0 and 100),
  add column booking_potential smallint check(booking_potential between 0 and 100);

create function public.compute_spotlight_rubric_score() returns trigger language plpgsql as $$ begin
  if new.talent is not null and new.originality is not null and new.presentation is not null and new.barangay_appeal is not null and new.booking_potential is not null then
    new.score:=round((new.talent+new.originality+new.presentation+new.barangay_appeal+new.booking_potential)::numeric/5,2);
  end if;
  return new;
end $$;
create trigger compute_spotlight_rubric_score_trigger before insert or update on public.spotlight_judge_scores for each row execute function public.compute_spotlight_rubric_score();

drop view public.spotlight_leaderboard;
create view public.spotlight_leaderboard as
with eligible as (
 select s.id,s.campaign_id,s.slug,s.stage_name,s.category,s.biography,s.availability,s.audition_video_url,s.public_photo_url,s.status,s.barangay_code,b.name barangay_name,c.name city_name,p.name province_name,s.featured_at,
 count(distinct v.id) filter(where v.invalidated_at is null)::integer votes,coalesce(avg(j.score),0)::numeric(5,2) judge_score
 from public.spotlight_submissions s join public.barangays b on b.code=s.barangay_code join public.cities_municipalities c on c.code=b.city_code join public.provinces p on p.code=c.province_code
 left join public.spotlight_votes v on v.submission_id=s.id and v.campaign_id=s.campaign_id left join public.spotlight_judge_scores j on j.submission_id=s.id
 where s.status in ('approved','featured') and (s.child_profile_id is null or (public.has_minor_permission(s.child_profile_id,'public_profile') and public.has_minor_permission(s.child_profile_id,'public_media') and public.has_minor_permission(s.child_profile_id,'spotlight_participation') and public.has_minor_permission(s.child_profile_id,'leaderboard')))
 group by s.id,b.name,c.name,p.name
), scored as(select *,max(votes) over(partition by campaign_id) max_votes from eligible)
select id,campaign_id,slug,stage_name,category,biography,availability,audition_video_url,public_photo_url,status,barangay_code,barangay_name,city_name,province_name,featured_at,votes,judge_score,
 round((case when max_votes>0 then votes::numeric/max_votes*70 else 0 end)+(judge_score*.30),2) combined_score from scored;
revoke all on public.spotlight_leaderboard from public; grant select on public.spotlight_leaderboard to anon,authenticated;

create view public.spotlight_peoples_choice as
select distinct on(campaign_id) campaign_id,id submission_id,slug,stage_name,public_photo_url,barangay_name,city_name,votes
from public.spotlight_leaderboard order by campaign_id,votes desc,stage_name,id;
revoke all on public.spotlight_peoples_choice from public; grant select on public.spotlight_peoples_choice to anon,authenticated;

create function public.invalidate_spotlight_vote(p_vote uuid,p_reason text) returns void language plpgsql security definer set search_path=public as $$
declare v_vote public.spotlight_votes;
begin
 if not public.has_role(auth.uid(),'admin') then raise exception 'Administrator access required'; end if;
 if length(trim(p_reason))<5 then raise exception 'An audit reason is required'; end if;
 update public.spotlight_votes set invalidated_at=now(),invalidated_by=auth.uid(),invalidation_reason=trim(p_reason) where id=p_vote and invalidated_at is null returning * into v_vote;
 if v_vote.id is null then raise exception 'Active vote not found'; end if;
 insert into public.audit_events(domain,entity_type,entity_id,actor_id,action,reason,metadata) values('spotlight','vote',v_vote.id::text,auth.uid(),'invalidated',trim(p_reason),jsonb_build_object('campaign_id',v_vote.campaign_id,'submission_id',v_vote.submission_id));
end $$;
grant execute on function public.invalidate_spotlight_vote(uuid,text) to authenticated;

create function public.transition_spotlight_booking(p_booking uuid,p_status public.spotlight_inquiry_status,p_reason text default null)
returns public.spotlight_booking_requests language plpgsql security definer set search_path=public as $$
declare v_booking public.spotlight_booking_requests; v_old public.spotlight_inquiry_status; v_allowed boolean;
begin
 select * into v_booking from public.spotlight_booking_requests where id=p_booking for update;
 if v_booking.id is null or not (v_booking.requester_id=auth.uid() or public.has_role(auth.uid(),'admin')) then raise exception 'Booking not found or unauthorized'; end if;
 v_old:=v_booking.status;
 v_allowed:=case
  when v_old='new' then p_status in ('contacted','talent_review','cancelled')
  when v_old='contacted' then p_status in ('talent_review','declined','cancelled')
  when v_old='talent_review' then p_status in ('accepted','declined','cancelled')
  when v_old='accepted' then p_status in ('confirmed','cancelled')
  when v_old='confirmed' then p_status in ('completed','cancelled','disputed')
  when v_old='disputed' then p_status in ('completed','cancelled')
  else false end;
 if not v_allowed then raise exception 'Invalid booking transition: % to %',v_old,p_status; end if;
 update public.spotlight_booking_requests set status=p_status,updated_at=now() where id=p_booking returning * into v_booking;
 if p_status='completed' then insert into public.platform_commissions(spotlight_booking_id,rate_percent,base_amount_php) values(p_booking,12.5,coalesce(v_booking.budget_php,0)) on conflict do nothing; end if;
 insert into public.audit_events(domain,entity_type,entity_id,actor_id,action,reason,metadata) values('spotlight','booking',p_booking::text,auth.uid(),'status_changed',p_reason,jsonb_build_object('from',v_old,'to',p_status));
 return v_booking;
end $$;
grant execute on function public.transition_spotlight_booking(uuid,public.spotlight_inquiry_status,text) to authenticated;
