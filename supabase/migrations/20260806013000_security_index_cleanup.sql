-- Cover every composite tenant foreign key and remove a redundant index.
drop index if exists public.booking_holds_appointment_uidx;

create index if not exists appointments_customer_org_idx on public.appointments(customer_id,organization_id);
create index if not exists appointments_professional_org_idx on public.appointments(professional_id,organization_id);
create index if not exists appointments_location_org_idx on public.appointments(location_id,organization_id);
create index if not exists appointments_service_org_idx on public.appointments(service_id,organization_id);
create index if not exists availability_professional_org_idx on public.availability_rules(professional_id,organization_id);
create index if not exists availability_location_org_fk_idx on public.availability_rules(location_id,organization_id);
create index if not exists professional_locations_professional_org_idx on public.professional_locations(professional_id,organization_id);
create index if not exists professional_locations_location_org_idx on public.professional_locations(location_id,organization_id);
create index if not exists professional_services_professional_org_idx on public.professional_services(professional_id,organization_id);
create index if not exists professional_services_service_org_idx on public.professional_services(service_id,organization_id);
