create extension if not exists btree_gist;

alter table public.organizations add column if not exists slug text;
alter table public.organizations add column if not exists email text;
alter table public.organizations add column if not exists phone text;
alter table public.organizations add column if not exists description text;
alter table public.organizations add column if not exists booking_enabled boolean not null default true;
alter table public.organizations add column if not exists hold_minutes integer not null default 60 check (hold_minutes between 10 and 180);
update public.organizations set slug = trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')) || '-' || left(id::text, 6) where slug is null;
alter table public.organizations alter column slug set not null;
create unique index if not exists organizations_slug_key on public.organizations(slug);

alter table public.locations add column if not exists email text;
alter table public.locations add column if not exists description text;
alter table public.services add column if not exists description text;
alter table public.profiles add column if not exists active boolean not null default true;
alter table public.profiles add column if not exists is_bookable boolean not null default false;
alter table public.profiles add column if not exists specialty text;
alter table public.profiles add column if not exists color text not null default '#3157f6';
alter table public.customers add column if not exists user_id uuid references auth.users on delete set null;
create unique index if not exists customers_org_user_key on public.customers(organization_id,user_id) where user_id is not null;
alter table public.availability_rules add column if not exists location_id uuid references public.locations on delete cascade;

create table if not exists public.professional_locations (
  professional_id uuid not null references public.profiles on delete cascade,
  location_id uuid not null references public.locations on delete cascade,
  organization_id uuid not null references public.organizations on delete cascade,
  primary key (professional_id, location_id)
);
create table if not exists public.professional_services (
  professional_id uuid not null references public.profiles on delete cascade,
  service_id uuid not null references public.services on delete cascade,
  organization_id uuid not null references public.organizations on delete cascade,
  primary key (professional_id, service_id)
);
alter table public.professional_locations enable row level security;
alter table public.professional_services enable row level security;

create or replace function private.can_manage_org(target_org uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.organization_id=target_org and p.active and p.role in ('admin','reception'))
$$;
revoke all on function private.can_manage_org(uuid) from public;

drop policy if exists organization_members on public.organizations;
create policy organization_members on public.organizations for select to authenticated using (id=(select private.current_org_id()));
create policy organization_managers_update on public.organizations for update to authenticated using ((select private.can_manage_org(id))) with check ((select private.can_manage_org(id)));

drop policy if exists profile_members on public.profiles;
create policy profile_members on public.profiles for select to authenticated using (organization_id=(select private.current_org_id()));
create policy profile_managers_update on public.profiles for update to authenticated using ((select private.can_manage_org(organization_id))) with check ((select private.can_manage_org(organization_id)));

drop policy if exists location_members on public.locations;
create policy location_members_select on public.locations for select to authenticated using (organization_id=(select private.current_org_id()));
create policy location_managers_insert on public.locations for insert to authenticated with check ((select private.can_manage_org(organization_id)));
create policy location_managers_update on public.locations for update to authenticated using ((select private.can_manage_org(organization_id))) with check ((select private.can_manage_org(organization_id)));
create policy location_managers_delete on public.locations for delete to authenticated using ((select private.can_manage_org(organization_id)));

drop policy if exists service_members on public.services;
create policy service_members_select on public.services for select to authenticated using (organization_id=(select private.current_org_id()));
create policy service_managers_insert on public.services for insert to authenticated with check ((select private.can_manage_org(organization_id)));
create policy service_managers_update on public.services for update to authenticated using ((select private.can_manage_org(organization_id))) with check ((select private.can_manage_org(organization_id)));
create policy service_managers_delete on public.services for delete to authenticated using ((select private.can_manage_org(organization_id)));

drop policy if exists availability_members on public.availability_rules;
create policy availability_members_select on public.availability_rules for select to authenticated using (organization_id=(select private.current_org_id()));
create policy availability_managers_insert on public.availability_rules for insert to authenticated with check ((select private.can_manage_org(organization_id)));
create policy availability_managers_update on public.availability_rules for update to authenticated using ((select private.can_manage_org(organization_id))) with check ((select private.can_manage_org(organization_id)));
create policy availability_managers_delete on public.availability_rules for delete to authenticated using ((select private.can_manage_org(organization_id)));

create policy professional_locations_select on public.professional_locations for select to authenticated using (organization_id=(select private.current_org_id()));
create policy professional_locations_manage on public.professional_locations for all to authenticated using ((select private.can_manage_org(organization_id))) with check ((select private.can_manage_org(organization_id)));
create policy professional_services_select on public.professional_services for select to authenticated using (organization_id=(select private.current_org_id()));
create policy professional_services_manage on public.professional_services for all to authenticated using ((select private.can_manage_org(organization_id))) with check ((select private.can_manage_org(organization_id)));

create policy customer_self_select on public.customers for select to authenticated using (user_id=(select auth.uid()));
create policy appointment_self_select on public.appointments for select to authenticated using (exists(select 1 from public.customers c where c.id=customer_id and c.user_id=(select auth.uid())));

do $$ begin
  if not exists(select 1 from pg_constraint where conname='appointment_professional_no_overlap') then
    alter table public.appointments add constraint appointment_professional_no_overlap exclude using gist
      (professional_id with =, tstzrange(starts_at,ends_at,'[)') with &&)
      where (status in ('pending','confirmed'));
  end if;
end $$;

create or replace function public.bootstrap_organization(p_name text, p_full_name text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare user_id uuid := auth.uid(); org_id uuid; org_slug text;
begin
  if user_id is null then raise exception 'Debes iniciar sesion'; end if;
  select organization_id into org_id from public.profiles where id=user_id;
  if org_id is not null then return org_id; end if;
  org_slug := trim(both '-' from regexp_replace(lower(coalesce(nullif(trim(p_name),''),'mi-empresa')), '[^a-z0-9]+', '-', 'g')) || '-' || left(gen_random_uuid()::text,6);
  insert into public.organizations(name,slug) values(coalesce(nullif(trim(p_name),''),'Mi empresa'),org_slug) returning id into org_id;
  insert into public.profiles(id,organization_id,full_name,role,is_bookable) values(user_id,org_id,coalesce(nullif(trim(p_full_name),''),'Administrador'),'admin',false);
  insert into public.locations(organization_id,name,address,active) values(org_id,'Sucursal principal','Completar direccion',true);
  return org_id;
end $$;
revoke all on function public.bootstrap_organization(text,text) from public,anon;
grant execute on function public.bootstrap_organization(text,text) to authenticated;

create or replace function public.list_booking_organizations()
returns table(id uuid,name text,slug text,description text)
language sql stable security definer set search_path=public,pg_temp as $$
  select o.id,o.name,o.slug,o.description from public.organizations o where o.booking_enabled order by o.name
$$;
revoke all on function public.list_booking_organizations() from public,anon;
grant execute on function public.list_booking_organizations() to authenticated;

create or replace function public.get_booking_catalog(p_slug text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare org_id uuid; result jsonb;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesion'; end if;
  select id into org_id from public.organizations where slug=p_slug and booking_enabled;
  if org_id is null then return null; end if;
  select jsonb_build_object(
    'organization',(select jsonb_build_object('id',o.id,'name',o.name,'description',o.description,'hold_minutes',o.hold_minutes) from public.organizations o where o.id=org_id),
    'locations',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'address',l.address) order by l.name) from public.locations l where l.organization_id=org_id and l.active),'[]'::jsonb),
    'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'description',s.description,'duration_minutes',s.duration_minutes,'price',s.price,'color',s.color) order by s.name) from public.services s where s.organization_id=org_id and s.active),'[]'::jsonb),
    'professionals',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name,'specialty',p.specialty,'color',p.color) order by p.full_name) from public.profiles p where p.organization_id=org_id and p.active and p.is_bookable),'[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.get_booking_catalog(text) from public,anon;
grant execute on function public.get_booking_catalog(text) to authenticated;

create or replace function public.available_slots(p_slug text,p_service_id uuid,p_professional_id uuid,p_location_id uuid,p_date date)
returns table(slot_start timestamptz) language sql stable security definer set search_path=public,pg_temp as $$
  with context as (
    select o.id org_id,o.timezone,s.duration_minutes
    from public.organizations o join public.services s on s.organization_id=o.id
    where o.slug=p_slug and o.booking_enabled and s.id=p_service_id and s.active and auth.uid() is not null
  ), ranges as (
    select c.*,r.starts_at,r.ends_at
    from context c join public.availability_rules r on r.organization_id=c.org_id
    where r.professional_id=p_professional_id and r.active and r.weekday=extract(dow from p_date)::smallint and (r.location_id is null or r.location_id=p_location_id)
  ), candidates as (
    select gs as starts_at, gs + make_interval(mins=>r.duration_minutes) as ends_at
    from ranges r cross join lateral generate_series((p_date+r.starts_at) at time zone r.timezone,((p_date+r.ends_at) at time zone r.timezone)-make_interval(mins=>r.duration_minutes),interval '15 minutes') gs
  )
  select c.starts_at from candidates c
  where c.starts_at>now() and not exists(select 1 from public.appointments a where a.professional_id=p_professional_id and a.status in ('pending','confirmed') and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(c.starts_at,c.ends_at,'[)'))
  order by c.starts_at
$$;
revoke all on function public.available_slots(text,uuid,uuid,uuid,date) from public,anon;
grant execute on function public.available_slots(text,uuid,uuid,uuid,date) to authenticated;

create or replace function public.create_booking(p_slug text,p_service_id uuid,p_professional_id uuid,p_location_id uuid,p_starts_at timestamptz,p_customer_name text,p_phone text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare current_user uuid:=auth.uid(); org_id uuid; duration_mins integer; customer_uuid uuid; appointment_uuid uuid; hold_mins integer; customer_email text;
begin
  if current_user is null then raise exception 'Debes iniciar sesion'; end if;
  select o.id,s.duration_minutes,o.hold_minutes into org_id,duration_mins,hold_mins from public.organizations o join public.services s on s.organization_id=o.id where o.slug=p_slug and o.booking_enabled and s.id=p_service_id and s.active;
  if org_id is null then raise exception 'Servicio no disponible'; end if;
  if not exists(select 1 from public.profiles p where p.id=p_professional_id and p.organization_id=org_id and p.active and p.is_bookable) then raise exception 'Profesional no disponible'; end if;
  if not exists(select 1 from public.locations l where l.id=p_location_id and l.organization_id=org_id and l.active) then raise exception 'Sucursal no disponible'; end if;
  if not exists(select 1 from public.available_slots(p_slug,p_service_id,p_professional_id,p_location_id,p_starts_at::date) s where s.slot_start=p_starts_at) then raise exception 'El horario ya no esta disponible'; end if;
  select email into customer_email from auth.users where id=current_user;
  select id into customer_uuid from public.customers where organization_id=org_id and user_id=current_user;
  if customer_uuid is null then
    insert into public.customers(organization_id,user_id,full_name,phone,email,whatsapp_opt_in) values(org_id,current_user,trim(p_customer_name),trim(p_phone),customer_email,true) returning id into customer_uuid;
  else
    update public.customers set full_name=trim(p_customer_name),phone=trim(p_phone),email=customer_email,whatsapp_opt_in=true where id=customer_uuid;
  end if;
  insert into public.appointments(organization_id,customer_id,professional_id,location_id,service_id,starts_at,ends_at,status)
  values(org_id,customer_uuid,p_professional_id,p_location_id,p_service_id,p_starts_at,p_starts_at+make_interval(mins=>duration_mins),'pending') returning id into appointment_uuid;
  insert into public.booking_holds(appointment_id,expires_at) values(appointment_uuid,now()+make_interval(mins=>hold_mins));
  return appointment_uuid;
end $$;
revoke all on function public.create_booking(text,uuid,uuid,uuid,timestamptz,text,text) from public,anon;
grant execute on function public.create_booking(text,uuid,uuid,uuid,timestamptz,text,text) to authenticated;

grant select,insert,update,delete on public.professional_locations,public.professional_services to authenticated;
