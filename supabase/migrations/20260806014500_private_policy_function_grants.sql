
-- RLS policies need EXECUTE on their private helper functions.
-- The private schema keeps USAGE revoked, so these helpers are not exposed as API RPCs.
grant execute on function private.current_org_id() to authenticated;
grant execute on function private.can_manage_org(uuid) to authenticated;
grant execute on function private.is_org_admin(uuid) to authenticated;
grant execute on function private.can_update_profile(uuid,public.member_role) to authenticated;
grant execute on function private.can_view_customer(uuid,uuid,uuid) to authenticated;
grant execute on function private.can_view_appointment(uuid,uuid,uuid) to authenticated;

