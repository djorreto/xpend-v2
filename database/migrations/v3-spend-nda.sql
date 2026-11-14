-- Gasto de clientes: minimización, acceso por rol, retención y auditoría de IA externa.
-- No guarda el archivo original ni el texto enviado al modelo.

ALTER TABLE public.si_uploads
  ADD COLUMN IF NOT EXISTS retain_until timestamptz;

UPDATE public.si_uploads
SET retain_until = created_at + interval '365 days'
WHERE retain_until IS NULL;

CREATE INDEX IF NOT EXISTS idx_si_uploads_retain_until ON public.si_uploads (retain_until);

ALTER TABLE public.si_spend_lines
  DROP COLUMN IF EXISTS raw_data;

CREATE TABLE IF NOT EXISTS public.si_ai_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  line_id uuid REFERENCES public.si_spend_lines(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  outcome text NOT NULL CHECK (outcome IN ('sent', 'blocked')),
  block_reason text,
  model text,
  payload_chars integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_si_ai_calls_company ON public.si_ai_calls (company_id, created_at DESC);

COMMENT ON TABLE public.si_ai_calls IS 'Registro de intentos de categorización externa. No almacena la descripción ni el gasto.';

ALTER TABLE public.si_ai_calls ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON TABLE public.si_ai_calls TO authenticated;
REVOKE ALL ON TABLE public.si_ai_calls FROM anon;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'si_uploads','si_spend_lines','si_categories','si_learning_rules',
        'si_procurement_plans','si_plan_items','si_ai_calls'
      ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

DO $$
DECLARE
  t text;
  readable text[] := ARRAY[
    'si_uploads','si_spend_lines','si_categories','si_learning_rules',
    'si_procurement_plans','si_plan_items'
  ];
  manager_insert text[] := ARRAY['si_uploads','si_spend_lines'];
  analyst_insert text[] := ARRAY['si_categories','si_learning_rules','si_procurement_plans','si_plan_items'];
  manager_delete text[] := ARRAY['si_uploads','si_spend_lines','si_categories','si_procurement_plans','si_plan_items'];
BEGIN
  FOREACH t IN ARRAY readable LOOP
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
      FOR SELECT TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('analyst','manager','admin')
      )
    $f$, t || '_select_spend', t);

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
      FOR UPDATE TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('analyst','manager','admin')
      )
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('analyst','manager','admin')
      )
    $f$, t || '_update_spend', t);
  END LOOP;

  FOREACH t IN ARRAY manager_insert LOOP
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
      FOR INSERT TO authenticated
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('manager','admin')
      )
    $f$, t || '_insert_spend', t);
  END LOOP;

  FOREACH t IN ARRAY analyst_insert LOOP
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
      FOR INSERT TO authenticated
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('analyst','manager','admin')
      )
    $f$, t || '_insert_spend', t);
  END LOOP;

  FOREACH t IN ARRAY manager_delete LOOP
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
      FOR DELETE TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('manager','admin')
      )
    $f$, t || '_delete_spend', t);
  END LOOP;

  EXECUTE $f$
    CREATE POLICY si_learning_rules_delete_spend ON public.si_learning_rules
    FOR DELETE TO authenticated
    USING (
      company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
      AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('analyst','manager','admin')
    )
  $f$;
END $$;

CREATE POLICY si_ai_calls_select ON public.si_ai_calls
  FOR SELECT TO authenticated
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('manager','admin')
  );

CREATE POLICY si_ai_calls_insert ON public.si_ai_calls
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND user_id = auth.uid()
    AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('analyst','manager','admin','super_admin')
  );

-- El administrador de la empresa puede guardar la autorización de IA en su propia fila.
DROP POLICY IF EXISTS companies_admin_update_own ON public.companies;
CREATE POLICY companies_admin_update_own ON public.companies
  FOR UPDATE TO authenticated
  USING (
    id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('admin','super_admin')
  )
  WITH CHECK (
    id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role::text FROM public.profiles WHERE id = auth.uid()) IN ('admin','super_admin')
  );
