-- Complete RoadSafe administration with safe email-based operator assignment.

create or replace function public.assign_roadsafe_operator_by_email(
  _email text,
  _barangay_code text,
  _role text default 'barangay_operator'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_user uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Administrator access required';
  end if;
  if _role not in ('barangay_operator','lgu_officer','moderator') then
    raise exception 'Invalid RoadSafe operator role';
  end if;
  select id into target_user from auth.users where lower(email) = lower(trim(_email)) limit 1;
  if target_user is null then
    raise exception 'No Barangay Buddy account exists for that email';
  end if;
  insert into public.roadsafe_operator_assignments(user_id, barangay_code, role, granted_by)
  values (target_user, _barangay_code, _role, auth.uid())
  on conflict (user_id, barangay_code) do update set role = excluded.role, granted_by = auth.uid();
  return target_user;
end;
$$;

revoke execute on function public.assign_roadsafe_operator_by_email(text,text,text) from public, anon;
grant execute on function public.assign_roadsafe_operator_by_email(text,text,text) to authenticated;

create or replace function public.remove_roadsafe_operator(_assignment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Administrator access required'; end if;
  delete from public.roadsafe_operator_assignments where id = _assignment_id;
end;
$$;

revoke execute on function public.remove_roadsafe_operator(uuid) from public, anon;
grant execute on function public.remove_roadsafe_operator(uuid) to authenticated;
