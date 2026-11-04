-- prescriptions
DROP POLICY IF EXISTS "Admins manage prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Grantees read shared prescriptions" ON public.prescriptions;
CREATE POLICY "Admins manage prescriptions" ON public.prescriptions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));
CREATE POLICY "Grantees read shared prescriptions" ON public.prescriptions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.reports r
    JOIN public.report_grants g ON g.report_id = r.id
    WHERE r.prescription_id = prescriptions.id
      AND g.grantee_id = auth.uid()
      AND g.revoked_at IS NULL
      AND (g.expires_at IS NULL OR g.expires_at > now())
  ));

-- profiles
DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins update profiles" ON public.profiles;
CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));
CREATE POLICY "Admins update profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

-- reports
DROP POLICY IF EXISTS "Admins manage reports" ON public.reports;
DROP POLICY IF EXISTS "Grantees read shared reports" ON public.reports;
CREATE POLICY "Admins manage reports" ON public.reports FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));
CREATE POLICY "Grantees read shared reports" ON public.reports FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.report_grants g
    WHERE g.report_id = reports.id AND g.grantee_id = auth.uid()
      AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at > now())
  ));

-- shared_reports
DROP POLICY IF EXISTS "Admins read shares" ON public.shared_reports;
CREATE POLICY "Admins read shares" ON public.shared_reports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

-- system_logs
DROP POLICY IF EXISTS "Admins read logs" ON public.system_logs;
CREATE POLICY "Admins read logs" ON public.system_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

-- report_grants
DROP POLICY IF EXISTS "Admins manage all grants" ON public.report_grants;
CREATE POLICY "Admins manage all grants" ON public.report_grants FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

-- report_access_log
DROP POLICY IF EXISTS "Admins read all report access history" ON public.report_access_log;
CREATE POLICY "Admins read all report access history" ON public.report_access_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

-- user_roles: role administration moves to trusted server code only
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins read all roles" ON public.user_roles;