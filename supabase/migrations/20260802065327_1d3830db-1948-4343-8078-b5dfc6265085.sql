REVOKE ALL ON FUNCTION public.has_report_grant(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_report_grant(uuid, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_report_grant(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;