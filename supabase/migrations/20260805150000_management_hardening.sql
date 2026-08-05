create schema if not exists extensions;
alter extension btree_gist set schema extensions;
create index if not exists appointments_customer_idx on public.appointments(customer_id);
create index if not exists appointments_location_idx on public.appointments(location_id);
create index if not exists appointments_service_idx on public.appointments(service_id);
create index if not exists availability_org_location_idx on public.availability_rules(organization_id,location_id);
create index if not exists customers_user_idx on public.customers(user_id);
create index if not exists locations_org_idx on public.locations(organization_id);
create index if not exists profiles_org_idx on public.profiles(organization_id);
create index if not exists services_org_idx on public.services(organization_id);
create index if not exists professional_locations_org_location_idx on public.professional_locations(organization_id,location_id);
create index if not exists professional_services_org_service_idx on public.professional_services(organization_id,service_id);

drop policy if exists customer_members on public.customers;
drop policy if exists customer_self_select on public.customers;
create policy customer_visible on public.customers for select to authenticated using (organization_id=(select private.current_org_id()) or user_id=(select auth.uid()));
create policy customer_managers_insert on public.customers for insert to authenticated with check ((select private.can_manage_org(organization_id)));
create policy customer_managers_update on public.customers for update to authenticated using ((select private.can_manage_org(organization_id))) with check ((select private.can_manage_org(organization_id)));
create policy customer_managers_delete on public.customers for delete to authenticated using ((select private.can_manage_org(organization_id)));

drop policy if exists appointment_members on public.appointments;
drop policy if exists appointment_self_select on public.appointments;
create policy appointment_visible on public.appointments for select to authenticated using (organization_id=(select private.current_org_id()) or exists(select 1 from public.customers c where c.id=customer_id and c.user_id=(select auth.uid())));
create policy appointment_managers_insert on public.appointments for insert to authenticated with check ((select private.can_manage_org(organization_id)));
create policy appointment_managers_update on public.appointments for update to authenticated using ((select private.can_manage_org(organization_id))) with check ((select private.can_manage_org(organization_id)));
create policy appointment_managers_delete on public.appointments for delete to authenticated using ((select private.can_manage_org(organization_id)));

drop policy if exists professional_locations_manage on public.professional_locations;
create policy professional_locations_insert on public.professional_locations for insert to authenticated with check ((select private.can_manage_org(organization_id)));
create policy professional_locations_update on public.professional_locations for update to authenticated using ((select private.can_manage_org(organization_id))) with check ((select private.can_manage_org(organization_id)));
create policy professional_locations_delete on public.professional_locations for delete to authenticated using ((select private.can_manage_org(organization_id)));
drop policy if exists professional_services_manage on public.professional_services;
create policy professional_services_insert on public.professional_services for insert to authenticated with check ((select private.can_manage_org(organization_id)));
create policy professional_services_update on public.professional_services for update to authenticated using ((select private.can_manage_org(organization_id))) with check ((select private.can_manage_org(organization_id)));
create policy professional_services_delete on public.professional_services for delete to authenticated using ((select private.can_manage_org(organization_id)));
