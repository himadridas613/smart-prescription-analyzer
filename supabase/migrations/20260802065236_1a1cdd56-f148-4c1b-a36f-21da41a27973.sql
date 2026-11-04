-- 1. Report access grants (patient explicitly grants a clinician)
CREATE TABLE public.report_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grantee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grantee_role public.app_role NOT NULL,
  note text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, grantee_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_grants TO authenticated;
GRANT ALL ON public.report_grants TO service_role;
ALTER TABLE public.report_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their grants" ON public.report_grants
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Grantees read their grants" ON public.report_grants
  FOR SELECT TO authenticated USING (auth.uid() = grantee_id);

CREATE POLICY "Admins manage all grants" ON public.report_grants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER report_grants_updated_at BEFORE UPDATE ON public.report_grants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX report_grants_grantee_idx ON public.report_grants (grantee_id) WHERE revoked_at IS NULL;
CREATE INDEX report_grants_report_idx ON public.report_grants (report_id);

-- 2. Helper: is a report readable by this user through an active grant?
CREATE OR REPLACE FUNCTION public.has_report_grant(_user_id uuid, _report_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.report_grants g
    WHERE g.grantee_id = _user_id
      AND g.report_id = _report_id
      AND g.revoked_at IS NULL
      AND (g.expires_at IS NULL OR g.expires_at > now())
  );
$$;

-- 3. Replace blanket clinician access with grant-scoped access
DROP POLICY IF EXISTS "Clinicians read reports" ON public.reports;
CREATE POLICY "Grantees read shared reports" ON public.reports
  FOR SELECT TO authenticated
  USING (public.has_report_grant(auth.uid(), id) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Doctors read all prescriptions" ON public.prescriptions;
CREATE POLICY "Grantees read shared prescriptions" ON public.prescriptions
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.prescription_id = prescriptions.id
        AND public.has_report_grant(auth.uid(), r.id)
    )
  );

-- 4. Access history for shared/granted reports
CREATE TABLE public.report_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES public.reports(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  viewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  access_type text NOT NULL DEFAULT 'token',
  token_id uuid REFERENCES public.shared_reports(id) ON DELETE SET NULL,
  ip text,
  user_agent text,
  status text NOT NULL DEFAULT 'allowed',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.report_access_log TO authenticated;
GRANT ALL ON public.report_access_log TO service_role;
ALTER TABLE public.report_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their report access history" ON public.report_access_log
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Admins read all report access history" ON public.report_access_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX report_access_log_report_idx ON public.report_access_log (report_id, created_at DESC);

-- 5. Richer audit trail on system_logs
ALTER TABLE public.system_logs
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS ip text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS actor_email text;

CREATE INDEX IF NOT EXISTS system_logs_created_idx ON public.system_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS system_logs_action_idx ON public.system_logs (action);

-- 6. AI / OCR monitoring metrics
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS processing_ms integer,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ocr_confidence numeric,
  ADD COLUMN IF NOT EXISTS image_quality numeric,
  ADD COLUMN IF NOT EXISTS blur_score numeric,
  ADD COLUMN IF NOT EXISTS json_valid boolean,
  ADD COLUMN IF NOT EXISTS error_type text,
  ADD COLUMN IF NOT EXISTS ai_model text;

CREATE INDEX IF NOT EXISTS prescriptions_created_idx ON public.prescriptions (created_at DESC);
CREATE INDEX IF NOT EXISTS prescriptions_user_idx ON public.prescriptions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_user_idx ON public.reports (user_id, created_at DESC);

-- 7. Role helper is not for anonymous callers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_report_grant(uuid, uuid) FROM anon;