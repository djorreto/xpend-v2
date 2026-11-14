-- Hilo único del piloto: gasto, iniciativa, bases, licitación, sala y adjudicación.

CREATE TABLE IF NOT EXISTS public.procurement_dossiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  group_id uuid REFERENCES public.si_spend_groups(id) ON DELETE SET NULL,
  upload_id uuid REFERENCES public.si_uploads(id) ON DELETE SET NULL,
  sourcing_plan_id uuid REFERENCES public.sourcing_plans(id) ON DELETE SET NULL,
  rfx_project_id uuid REFERENCES public.rfx_projects(id) ON DELETE SET NULL,
  licitacion_id text REFERENCES public.licitaciones(id) ON DELETE SET NULL,
  offer_event_id uuid REFERENCES public.offer_events(id) ON DELETE SET NULL,
  currency text,
  net_spend numeric,
  country_code text,
  stage text NOT NULL DEFAULT 'oportunidad' CHECK (stage IN ('oportunidad','iniciativa','bases','licitacion','sala','adjudicada')),
  bases_text text,
  award jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS procurement_dossiers_plan
  ON public.procurement_dossiers (sourcing_plan_id) WHERE sourcing_plan_id IS NOT NULL;

ALTER TABLE public.procurement_dossiers ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON TABLE public.procurement_dossiers TO authenticated;
REVOKE ALL ON TABLE public.procurement_dossiers FROM anon;

DROP POLICY IF EXISTS procurement_dossiers_select ON public.procurement_dossiers;
CREATE POLICY procurement_dossiers_select ON public.procurement_dossiers
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND coalesce((SELECT role::text FROM public.profiles WHERE id = auth.uid()), '') <> 'supplier'
  );

DROP POLICY IF EXISTS procurement_dossiers_write ON public.procurement_dossiers;
CREATE POLICY procurement_dossiers_write ON public.procurement_dossiers
  FOR ALL TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND coalesce((SELECT role::text FROM public.profiles WHERE id = auth.uid()), '') <> 'supplier'
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND coalesce((SELECT role::text FROM public.profiles WHERE id = auth.uid()), '') <> 'supplier'
  );
