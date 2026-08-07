-- Public DNI booking, tenant subscription state and Mercado Pago persistence.

alter table public.customers add column if not exists address text;
alter table public.customers add column if not exists city text;
alter table public.customers add column if not exists province text;
alter table public.customers add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='customers_document_number_format'
      and conrelid='public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_document_number_format
      check (document_number is null or document_number ~ '^[0-9]{6,9}$');
  end if;
end $$;

alter table public.organizations add column if not exists subscription_status text not null default 'trialing';
alter table public.organizations add column if not exists subscription_valid_until timestamptz default (now()+interval '14 days');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='organizations_subscription_status_check'
      and conrelid='public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_subscription_status_check
      check (subscription_status in ('trialing','active','past_due','paused','cancelled'));
  end if;
end $$;

-- Preserve uninterrupted service for organizations that existed before billing.
update public.organizations
set subscription_status='active', subscription_valid_until=null
where subscription_status='trialing';

create table if not exists public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations on delete cascade,
  provider text not null default 'mercadopago' check (provider='mercadopago'),
  provider_subscription_id text unique,
  status text not null default 'pending',
  payer_email text,
  amount_ars numeric(12,2) not null check (amount_ars > 0),
  checkout_url text,
  next_payment_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_webhook_events (
  id bigint generated always as identity primary key,
  provider text not null default 'mercadopago' check (provider='mercadopago'),
  provider_event_id text not null,
  request_id text,
  topic text not null,
  processed_at timestamptz not null default now(),
  unique(provider,provider_event_id,topic)
);

alter table public.organization_subscriptions enable row level security;
alter table public.payment_webhook_events enable row level security;
revoke all on table public.organization_subscriptions from public,anon,authenticated;
revoke all on table public.payment_webhook_events from public,anon,authenticated;
grant select on table public.organization_subscriptions to authenticated;

create policy subscription_admin_select on public.organization_subscriptions
for select to authenticated
using ((select private.is_org_admin(organization_id)));

create index if not exists customers_org_document_idx
  on public.customers(organization_id,document_number);
create index if not exists subscriptions_status_idx
  on public.organization_subscriptions(status,updated_at desc);
create index if not exists subscriptions_provider_id_idx
  on public.organization_subscriptions(provider_subscription_id);

-- The old browser RPCs are no longer part of the public/client booking boundary.
revoke execute on function public.list_booking_organizations() from authenticated;
revoke execute on function public.get_booking_catalog(text) from authenticated;
revoke execute on function public.available_slots(text,uuid,uuid,uuid,date) from authenticated;
revoke execute on function public.create_booking_secure(text,uuid,uuid,uuid,timestamptz,text,text,boolean) from authenticated;

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
      and s.id=p_service_id
      and s.active
  ), ranges as (
    select c.*,r.starts_at,r.ends_at
    from context c
    join public.availability_rules r on r.organization_id=c.org_id
    where r.professional_id=p_professional_id
      and r.active
      and r.weekday=extract(dow from p_date)::smallint
      and (r.location_id is null or r.location_id=p_location_id)
      and exists (
        select 1 from public.professional_services ps
        where ps.organization_id=c.org_id and ps.professional_id=p_professional_id and ps.service_id=p_service_id
      )
      and exists (
        select 1 from public.professional_locations pl
        where pl.organization_id=c.org_id and pl.professional_id=p_professional_id and pl.location_id=p_location_id
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
          or (
            a.status='pending'
            and exists(select 1 from public.booking_holds h where h.appointment_id=a.id and h.expires_at>now())
          )
        )
        and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(c.starts_at,c.ends_at,'[)')
    )
  order by c.starts_at
$$;
revoke all on function public.available_slots_public(text,uuid,uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.available_slots_public(text,uuid,uuid,uuid,date) to service_role;

create or replace function public.register_customer_dni_secure(
  p_slug text,
  p_document_number text,
  p_full_name text,
  p_email text,
  p_phone text,
  p_address text,
  p_city text,
  p_province text,
  p_whatsapp_opt_in boolean default false
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  org_id uuid;
  customer_uuid uuid;
  normalized_document text:=regexp_replace(coalesce(p_document_number,''),'[^0-9]','','g');
  normalized_phone text:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
begin
  if normalized_document !~ '^[0-9]{6,9}$' then raise exception 'DNI invalido'; end if;
  if length(trim(coalesce(p_full_name,''))) not between 2 and 120 then raise exception 'Nombre invalido'; end if;
  if trim(coalesce(p_email,'')) !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Correo invalido'; end if;
  if normalized_phone !~ '^[0-9]{10,13}$' then raise exception 'Celular invalido'; end if;
  if length(trim(coalesce(p_address,''))) not between 3 and 180 then raise exception 'Direccion invalida'; end if;
  if length(trim(coalesce(p_city,''))) not between 2 and 100 then raise exception 'Localidad invalida'; end if;
  if length(trim(coalesce(p_province,''))) not between 2 and 100 then raise exception 'Provincia invalida'; end if;

  select o.id into org_id
  from public.organizations o
  where o.slug=p_slug and o.booking_enabled
    and (o.subscription_status='active' or (o.subscription_status='trialing' and o.subscription_valid_until>now()));
  if org_id is null then raise exception 'Agenda no disponible'; end if;

  perform pg_advisory_xact_lock(hashtextextended(org_id::text||':'||normalized_document,0));
  select id into customer_uuid
  from public.customers
  where organization_id=org_id and document_number=normalized_document;

  if customer_uuid is null then
    insert into public.customers(
      organization_id,full_name,document_number,phone,email,address,city,province,whatsapp_opt_in,updated_at
    ) values (
      org_id,trim(p_full_name),normalized_document,normalized_phone,lower(trim(p_email)),trim(p_address),trim(p_city),trim(p_province),coalesce(p_whatsapp_opt_in,false),now()
    ) returning id into customer_uuid;
  end if;
  return customer_uuid;
end
$$;
revoke all on function public.register_customer_dni_secure(text,text,text,text,text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.register_customer_dni_secure(text,text,text,text,text,text,text,text,boolean) to service_role;

create or replace function public.create_booking_dni_secure(
  p_slug text,
  p_customer_id uuid,
  p_service_id uuid,
  p_professional_id uuid,
  p_location_id uuid,
  p_starts_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  org_id uuid;
  duration_mins integer;
  hold_mins integer;
  org_timezone text;
  appointment_uuid uuid;
  recent_count integer;
  active_holds integer;
begin
  if p_starts_at<now()+interval '2 minutes' or p_starts_at>now()+interval '365 days' then
    raise exception 'Fecha fuera del rango permitido';
  end if;

  perform private.expire_booking_holds();
  perform pg_advisory_xact_lock(hashtextextended(p_customer_id::text,0));

  select o.id,s.duration_minutes,o.hold_minutes,o.timezone
  into org_id,duration_mins,hold_mins,org_timezone
  from public.organizations o
  join public.services s on s.organization_id=o.id
  where o.slug=p_slug and o.booking_enabled
    and (o.subscription_status='active' or (o.subscription_status='trialing' and o.subscription_valid_until>now()))
    and s.id=p_service_id and s.active;
  if org_id is null then raise exception 'Servicio no disponible'; end if;
  if not exists(select 1 from public.customers c where c.id=p_customer_id and c.organization_id=org_id and c.document_number is not null) then raise exception 'Cliente invalido'; end if;
  if not exists(select 1 from public.profiles p where p.id=p_professional_id and p.organization_id=org_id and p.active and p.is_bookable) then raise exception 'Profesional no disponible'; end if;
  if not exists(select 1 from public.locations l where l.id=p_location_id and l.organization_id=org_id and l.active) then raise exception 'Sucursal no disponible'; end if;

  select count(*) into recent_count from public.appointments
  where customer_id=p_customer_id and created_at>=now()-interval '1 hour';
  if recent_count>=5 then raise exception 'Alcanzaste el limite temporal de reservas'; end if;

  select count(*) into active_holds
  from public.appointments a
  join public.booking_holds h on h.appointment_id=a.id
  where a.customer_id=p_customer_id and a.status='pending' and h.expires_at>now();
  if active_holds>=3 then raise exception 'Ya hay tres reservas pendientes para este DNI'; end if;

  if not exists (
    select 1 from public.available_slots_public(p_slug,p_service_id,p_professional_id,p_location_id,(p_starts_at at time zone org_timezone)::date) s
    where s.slot_start=p_starts_at
  ) then raise exception 'El horario ya no esta disponible'; end if;

  insert into public.appointments(organization_id,customer_id,professional_id,location_id,service_id,starts_at,ends_at,status)
  values(org_id,p_customer_id,p_professional_id,p_location_id,p_service_id,p_starts_at,p_starts_at+make_interval(mins=>duration_mins),'pending')
  returning id into appointment_uuid;
  insert into public.booking_holds(appointment_id,expires_at)
  values(appointment_uuid,now()+make_interval(mins=>hold_mins));
  return appointment_uuid;
end
$$;
revoke all on function public.create_booking_dni_secure(text,uuid,uuid,uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.create_booking_dni_secure(text,uuid,uuid,uuid,uuid,timestamptz) to service_role;

comment on function public.create_booking_dni_secure(text,uuid,uuid,uuid,uuid,timestamptz)
is 'Server-only public booking boundary with tenant validation, rate limits, live availability and expiring holds.';
