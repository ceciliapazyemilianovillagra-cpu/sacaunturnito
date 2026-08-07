-- Cross-instance throttling for the unauthenticated booking API.

create table if not exists public.public_api_rate_limits (
  key_hash text not null,
  scope text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key(key_hash,scope,window_started_at)
);
alter table public.public_api_rate_limits enable row level security;
revoke all on table public.public_api_rate_limits from public,anon,authenticated;

create index if not exists public_api_rate_limits_window_idx
  on public.public_api_rate_limits(window_started_at);

create or replace function public.consume_public_rate_limit(
  p_key_hash text,
  p_scope text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  bucket timestamptz;
  current_count integer;
begin
  if length(p_key_hash)<32 or length(p_scope) not between 2 and 40 then return false; end if;
  if p_limit not between 1 and 1000 or p_window_seconds not between 10 and 86400 then return false; end if;
  bucket:=to_timestamp(floor(extract(epoch from now())/p_window_seconds)*p_window_seconds);
  insert into public.public_api_rate_limits(key_hash,scope,window_started_at,request_count)
  values(p_key_hash,p_scope,bucket,1)
  on conflict(key_hash,scope,window_started_at)
  do update set request_count=public.public_api_rate_limits.request_count+1
  returning request_count into current_count;
  delete from public.public_api_rate_limits
  where key_hash=p_key_hash and window_started_at<now()-interval '2 days';
  return current_count<=p_limit;
end
$$;
revoke all on function public.consume_public_rate_limit(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_public_rate_limit(text,text,integer,integer) to service_role;

-- Existing organizations without explicit professional mappings remain operable.
create or replace function public.available_slots_public(
  p_slug text,
  p_service_id uuid,
  p_professional_id uuid,
  p_location_id uuid,
  p_date date
)
returns table(slot_start timestamptz)
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  with context as (
    select o.id org_id,o.timezone,s.duration_minutes
    from public.organizations o
    join public.services s on s.organization_id=o.id
    where o.slug=p_slug
      and o.booking_enabled
      and (o.subscription_status='active' or (o.subscription_status='trialing' and o.subscription_valid_until>now()))
      and s.id=p_service_id and s.active
  ), ranges as (
    select c.*,r.starts_at,r.ends_at
    from context c
    join public.availability_rules r on r.organization_id=c.org_id
    where r.professional_id=p_professional_id
      and r.active
      and r.weekday=extract(dow from p_date)::smallint
      and (r.location_id is null or r.location_id=p_location_id)
      and (
        not exists(select 1 from public.professional_services any_ps where any_ps.organization_id=c.org_id)
        or exists(select 1 from public.professional_services ps where ps.organization_id=c.org_id and ps.professional_id=p_professional_id and ps.service_id=p_service_id)
      )
      and (
        not exists(select 1 from public.professional_locations any_pl where any_pl.organization_id=c.org_id)
        or exists(select 1 from public.professional_locations pl where pl.organization_id=c.org_id and pl.professional_id=p_professional_id and pl.location_id=p_location_id)
      )
  ), candidates as (
    select gs as starts_at,gs+make_interval(mins=>r.duration_minutes) as ends_at
    from ranges r
    cross join lateral generate_series(
      (p_date+r.starts_at) at time zone r.timezone,
      ((p_date+r.ends_at) at time zone r.timezone)-make_interval(mins=>r.duration_minutes),
      interval '15 minutes'
    ) gs
  )
  select c.starts_at
  from candidates c
  where c.starts_at>now()+interval '2 minutes'
    and c.starts_at<now()+interval '365 days'
    and not exists (
      select 1 from public.appointments a
      where a.professional_id=p_professional_id
        and (
          a.status='confirmed'
          or (a.status='pending' and exists(select 1 from public.booking_holds h where h.appointment_id=a.id and h.expires_at>now()))
        )
        and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(c.starts_at,c.ends_at,'[)')
    )
  order by c.starts_at
$$;
revoke all on function public.available_slots_public(text,uuid,uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.available_slots_public(text,uuid,uuid,uuid,date) to service_role;
