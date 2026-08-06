-- Defense-in-depth hardening for tenant isolation, least privilege and auditing.

create or replace function private.is_org_admin(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select exists(
    select 1
    from public.profiles p
    where p.id=(select auth.uid())
      and p.organization_id=target_org
      and p.active
      and p.role='admin'
  )
$$;
revoke all on function private.is_org_admin(uuid) from public;

create or replace function private.can_update_profile(target_org uuid,target_role public.member_role)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select exists(
    select 1
    from public.profiles actor
    where actor.id=(select auth.uid())
      and actor.organization_id=target_org
      and actor.active
      and (
        actor.role='admin'
        or (actor.role='reception' and target_role='professional')
      )
  )
$$;
revoke all on function private.can_update_profile(uuid,public.member_role) from public;

create or replace function private.can_view_customer(target_customer uuid,target_org uuid,owner_user uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select owner_user=(select auth.uid())
    or (select private.can_manage_org(target_org))
    or exists(
      select 1 from public.appointments a
      where a.customer_id=target_customer and a.professional_id=(select auth.uid())
    )
$$;
revoke all on function private.can_view_customer(uuid,uuid,uuid) from public;

create or replace function private.can_view_appointment(target_org uuid,target_professional uuid,target_customer uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select (select private.can_manage_org(target_org))
    or target_professional=(select auth.uid())
    or exists(
      select 1 from public.customers c
      where c.id=target_customer and c.user_id=(select auth.uid())
    )
$$;
revoke all on function private.can_view_appointment(uuid,uuid,uuid) from public;

-- A receptionist may manage professionals, but cannot promote anyone or edit admins.
drop policy if exists profile_managers_update on public.profiles;
create policy profile_managers_update on public.profiles
for update to authenticated
using ((select private.can_update_profile(organization_id,role)))
with check ((select private.can_update_profile(organization_id,role)));

-- Customers only see themselves. Professionals only see customers assigned to them.
drop policy if exists customer_visible on public.customers;
create policy customer_visible on public.customers
for select to authenticated
using (
  (select private.can_view_customer(id,organization_id,user_id))
);

-- Managers see the company agenda, professionals their own agenda, clients their own bookings.
drop policy if exists appointment_visible on public.appointments;
create policy appointment_visible on public.appointments
for select to authenticated
using (
  (select private.can_view_appointment(organization_id,professional_id,customer_id))
);

drop policy if exists holds_members on public.booking_holds;
create policy holds_visible on public.booking_holds
for select to authenticated
using (
  exists(
    select 1
    from public.appointments a
    join public.customers c on c.id=a.customer_id
    where a.id=appointment_id
      and (
        (select private.can_manage_org(a.organization_id))
        or a.professional_id=(select auth.uid())
        or c.user_id=(select auth.uid())
      )
  )
);

drop policy if exists notification_members on public.notification_log;
create policy notification_managers on public.notification_log
for select to authenticated
using (
  exists(
    select 1 from public.appointments a
    where a.id=appointment_id
      and (select private.can_manage_org(a.organization_id))
  )
);

-- Prevent cross-company references even if an application or policy is misconfigured.
create unique index if not exists profiles_id_org_uidx on public.profiles(id,organization_id);
create unique index if not exists customers_id_org_uidx on public.customers(id,organization_id);
create unique index if not exists locations_id_org_uidx on public.locations(id,organization_id);
create unique index if not exists services_id_org_uidx on public.services(id,organization_id);

alter table public.professional_locations
  add constraint professional_locations_professional_org_fkey
  foreign key(professional_id,organization_id)
  references public.profiles(id,organization_id) not valid;
alter table public.professional_locations validate constraint professional_locations_professional_org_fkey;
alter table public.professional_locations
  add constraint professional_locations_location_org_fkey
  foreign key(location_id,organization_id)
  references public.locations(id,organization_id) not valid;
alter table public.professional_locations validate constraint professional_locations_location_org_fkey;

alter table public.professional_services
  add constraint professional_services_professional_org_fkey
  foreign key(professional_id,organization_id)
  references public.profiles(id,organization_id) not valid;
alter table public.professional_services validate constraint professional_services_professional_org_fkey;
alter table public.professional_services
  add constraint professional_services_service_org_fkey
  foreign key(service_id,organization_id)
  references public.services(id,organization_id) not valid;
alter table public.professional_services validate constraint professional_services_service_org_fkey;

alter table public.availability_rules
  add constraint availability_professional_org_fkey
  foreign key(professional_id,organization_id)
  references public.profiles(id,organization_id) not valid;
alter table public.availability_rules validate constraint availability_professional_org_fkey;
alter table public.availability_rules
  add constraint availability_location_org_fkey
  foreign key(location_id,organization_id)
  references public.locations(id,organization_id) not valid;
alter table public.availability_rules validate constraint availability_location_org_fkey;

alter table public.appointments
  add constraint appointments_customer_org_fkey
  foreign key(customer_id,organization_id)
  references public.customers(id,organization_id) not valid;
alter table public.appointments validate constraint appointments_customer_org_fkey;
alter table public.appointments
  add constraint appointments_professional_org_fkey
  foreign key(professional_id,organization_id)
  references public.profiles(id,organization_id) not valid;
alter table public.appointments validate constraint appointments_professional_org_fkey;
alter table public.appointments
  add constraint appointments_location_org_fkey
  foreign key(location_id,organization_id)
  references public.locations(id,organization_id) not valid;
alter table public.appointments validate constraint appointments_location_org_fkey;
alter table public.appointments
  add constraint appointments_service_org_fkey
  foreign key(service_id,organization_id)
  references public.services(id,organization_id) not valid;
alter table public.appointments validate constraint appointments_service_org_fkey;

create index if not exists availability_location_idx on public.availability_rules(location_id);
create index if not exists professional_locations_location_idx on public.professional_locations(location_id);
create index if not exists professional_services_service_idx on public.professional_services(service_id);
create index if not exists appointments_created_customer_idx on public.appointments(created_at,customer_id);

-- Guard the last active administrator from accidental lockout.
create or replace function private.guard_last_admin()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if old.role='admin' and old.active and (
    tg_op='DELETE'
    or new.role<>'admin'
    or not new.active
    or new.organization_id<>old.organization_id
  ) then
    if not exists(
      select 1 from public.profiles p
      where p.organization_id=old.organization_id
        and p.id<>old.id
        and p.role='admin'
        and p.active
    ) then
      raise exception 'La empresa debe conservar al menos un administrador activo';
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end
$$;
revoke all on function private.guard_last_admin() from public;
drop trigger if exists guard_last_admin on public.profiles;
create trigger guard_last_admin
before update or delete on public.profiles
for each row execute function private.guard_last_admin();

-- Immutable audit trail for sensitive management changes.
create table if not exists public.security_audit_log(
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations on delete set null,
  actor_user_id uuid references auth.users on delete set null,
  action text not null check(length(action) between 3 and 80),
  entity text not null check(length(entity) between 1 and 80),
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.security_audit_log enable row level security;
revoke all on table public.security_audit_log from public,anon,authenticated;
grant select on table public.security_audit_log to authenticated;
create policy audit_admin_select on public.security_audit_log
for select to authenticated
using ((select private.is_org_admin(organization_id)));
create index if not exists security_audit_org_created_idx on public.security_audit_log(organization_id,created_at desc);
create index if not exists security_audit_actor_created_idx on public.security_audit_log(actor_user_id,created_at desc);

create or replace function private.audit_sensitive_change()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare row_data jsonb; org_id uuid; safe_data jsonb; record_id text;
begin
  row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  org_id:=case
    when tg_table_name='organizations' and tg_op='DELETE' then null
    when tg_table_name='organizations' then nullif(row_data->>'id','')::uuid
    else nullif(row_data->>'organization_id','')::uuid
  end;
  record_id:=row_data->>'id';
  safe_data:=row_data-'phone'-'email'-'document_number'-'notes'-'payload';
  insert into public.security_audit_log(organization_id,actor_user_id,action,entity,entity_id,details)
  values(org_id,auth.uid(),lower(tg_op),tg_table_name,record_id,jsonb_build_object('record',safe_data));
  return case when tg_op='DELETE' then old else new end;
end
$$;
revoke all on function private.audit_sensitive_change() from public;

drop trigger if exists audit_organizations on public.organizations;
create trigger audit_organizations after insert or update or delete on public.organizations for each row execute function private.audit_sensitive_change();
drop trigger if exists audit_locations on public.locations;
create trigger audit_locations after insert or update or delete on public.locations for each row execute function private.audit_sensitive_change();
drop trigger if exists audit_services on public.services;
create trigger audit_services after insert or update or delete on public.services for each row execute function private.audit_sensitive_change();
drop trigger if exists audit_profiles on public.profiles;
create trigger audit_profiles after insert or update or delete on public.profiles for each row execute function private.audit_sensitive_change();
drop trigger if exists audit_availability on public.availability_rules;
create trigger audit_availability after insert or update or delete on public.availability_rules for each row execute function private.audit_sensitive_change();
drop trigger if exists audit_appointments on public.appointments;
create trigger audit_appointments after insert or update or delete on public.appointments for each row execute function private.audit_sensitive_change();

-- Strict, abuse-resistant booking endpoint with explicit WhatsApp consent.
create or replace function public.create_booking_secure(
  p_slug text,
  p_service_id uuid,
  p_professional_id uuid,
  p_location_id uuid,
  p_starts_at timestamptz,
  p_customer_name text,
  p_phone text,
  p_whatsapp_opt_in boolean default false
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  current_user uuid:=auth.uid();
  org_id uuid;
  duration_mins integer;
  customer_uuid uuid;
  appointment_uuid uuid;
  hold_mins integer;
  customer_email text;
  confirmed_at timestamptz;
  org_timezone text;
  recent_count integer;
  active_holds integer;
begin
  if current_user is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
    raise exception 'Debes iniciar sesion con una cuenta verificada';
  end if;
  select email,email_confirmed_at into customer_email,confirmed_at from auth.users where id=current_user;
  if confirmed_at is null then raise exception 'Confirma tu correo antes de reservar'; end if;
  if length(trim(p_customer_name)) not between 2 and 120 then raise exception 'Nombre invalido'; end if;
  if length(trim(p_phone)) not between 8 and 30 or trim(p_phone) !~ '^[+0-9() .-]+$' then raise exception 'Telefono invalido'; end if;
  if p_starts_at<now()+interval '2 minutes' or p_starts_at>now()+interval '365 days' then raise exception 'Fecha fuera del rango permitido'; end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user::text,0));
  select count(*) into recent_count
  from public.appointments a join public.customers c on c.id=a.customer_id
  where c.user_id=current_user and a.created_at>=now()-interval '1 hour';
  if recent_count>=5 then raise exception 'Alcanzaste el limite temporal de reservas. Intenta mas tarde'; end if;

  select count(*) into active_holds
  from public.appointments a
  join public.customers c on c.id=a.customer_id
  join public.booking_holds h on h.appointment_id=a.id
  where c.user_id=current_user and a.status='pending' and h.expires_at>now();
  if active_holds>=3 then raise exception 'Ya tenes tres reservas pendientes de confirmacion'; end if;

  select o.id,s.duration_minutes,o.hold_minutes,o.timezone
  into org_id,duration_mins,hold_mins,org_timezone
  from public.organizations o
  join public.services s on s.organization_id=o.id
  where o.slug=p_slug and o.booking_enabled and s.id=p_service_id and s.active;
  if org_id is null then raise exception 'Servicio no disponible'; end if;
  if not exists(select 1 from public.profiles p where p.id=p_professional_id and p.organization_id=org_id and p.active and p.is_bookable) then raise exception 'Profesional no disponible'; end if;
  if not exists(select 1 from public.locations l where l.id=p_location_id and l.organization_id=org_id and l.active) then raise exception 'Sucursal no disponible'; end if;
  if not exists(
    select 1 from public.available_slots(p_slug,p_service_id,p_professional_id,p_location_id,(p_starts_at at time zone org_timezone)::date) s
    where s.slot_start=p_starts_at
  ) then raise exception 'El horario ya no esta disponible'; end if;

  select id into customer_uuid from public.customers where organization_id=org_id and user_id=current_user;
  if customer_uuid is null then
    insert into public.customers(organization_id,user_id,full_name,phone,email,whatsapp_opt_in)
    values(org_id,current_user,trim(p_customer_name),trim(p_phone),customer_email,coalesce(p_whatsapp_opt_in,false))
    returning id into customer_uuid;
  else
    update public.customers
    set full_name=trim(p_customer_name),phone=trim(p_phone),email=customer_email,whatsapp_opt_in=coalesce(p_whatsapp_opt_in,false)
    where id=customer_uuid;
  end if;
  insert into public.appointments(organization_id,customer_id,professional_id,location_id,service_id,starts_at,ends_at,status)
  values(org_id,customer_uuid,p_professional_id,p_location_id,p_service_id,p_starts_at,p_starts_at+make_interval(mins=>duration_mins),'pending')
  returning id into appointment_uuid;
  insert into public.booking_holds(appointment_id,expires_at) values(appointment_uuid,now()+make_interval(mins=>hold_mins));
  return appointment_uuid;
end
$$;
revoke all on function public.create_booking_secure(text,uuid,uuid,uuid,timestamptz,text,text,boolean) from public,anon;
grant execute on function public.create_booking_secure(text,uuid,uuid,uuid,timestamptz,text,text,boolean) to authenticated;
revoke execute on function public.create_booking(text,uuid,uuid,uuid,timestamptz,text,text) from authenticated;

comment on function public.create_booking_secure(text,uuid,uuid,uuid,timestamptz,text,text,boolean)
is 'Authenticated booking boundary: validates ownership, email confirmation, limits, availability and explicit messaging consent.';
