-- Flujo de compras V3
-- Aditivo sobre la base que usa www.xpend.cl. No borra gasto, licitaciones ni usuarios.

ALTER TABLE rfx_projects
  ADD COLUMN IF NOT EXISTS sourcing_plan_id UUID REFERENCES sourcing_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rfx_projects_sourcing_plan
  ON rfx_projects(sourcing_plan_id);

ALTER TABLE licitaciones
  ADD COLUMN IF NOT EXISTS publish_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS publish_approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS award_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS award_approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS spend_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CLP',
  source TEXT NOT NULL CHECK (source IN ('si_spend_lines', 'spend_data')),
  line_count INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  closed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, period, currency)
);

ALTER TABLE spend_closures ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'spend_closures' AND policyname = 'spend_closures_company'
  ) THEN
    CREATE POLICY spend_closures_company ON spend_closures
      FOR ALL
      USING (
        company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
      )
      WITH CHECK (
        company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
      );
  END IF;
END $$;
