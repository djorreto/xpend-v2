-- Grupos de gasto, país, impuesto y tipo de cambio.
-- El monto original de la línea no se reescribe. amount_net es el gasto sin impuesto.
-- Las cargas que ya existían quedan como neto, sin confirmar, para no cambiar sus cifras.

CREATE TABLE IF NOT EXISTS public.si_tax_rates (
  country_code text PRIMARY KEY,
  country_name text NOT NULL,
  tax_name text,
  rate numeric(6, 3),
  as_of date NOT NULL DEFAULT DATE '2026-11-01',
  note text
);

INSERT INTO public.si_tax_rates (country_code, country_name, tax_name, rate, note) VALUES
  ('CL', 'Chile', 'IVA', 19, 'Tasa de referencia. Confirmar al cargar.'),
  ('PE', 'Perú', 'IGV', 18, 'Tasa de referencia. Confirmar al cargar.'),
  ('AR', 'Argentina', 'IVA', 21, 'Tasa de referencia. Confirmar al cargar.'),
  ('CO', 'Colombia', 'IVA', 19, 'Tasa de referencia. Confirmar al cargar.'),
  ('MX', 'México', 'IVA', 16, 'Tasa de referencia. Confirmar al cargar.'),
  ('UY', 'Uruguay', 'IVA', 22, 'Tasa de referencia. Confirmar al cargar.'),
  ('PY', 'Paraguay', 'IVA', 10, 'Tasa de referencia. Confirmar al cargar.'),
  ('BO', 'Bolivia', 'IVA', 13, 'Tasa de referencia. Confirmar al cargar.'),
  ('EC', 'Ecuador', 'IVA', 15, 'Tasa de referencia. Confirmar al cargar.'),
  ('PA', 'Panamá', 'ITBMS', 7, 'Tasa de referencia. Confirmar al cargar.'),
  ('CR', 'Costa Rica', 'IVA', 13, 'Tasa de referencia. Confirmar al cargar.'),
  ('DO', 'República Dominicana', 'ITBIS', 18, 'Tasa de referencia. Confirmar al cargar.'),
  ('GT', 'Guatemala', 'IVA', 12, 'Tasa de referencia. Confirmar al cargar.'),
  ('HN', 'Honduras', 'ISV', 15, 'Tasa de referencia. Confirmar al cargar.'),
  ('NI', 'Nicaragua', 'IVA', 15, 'Tasa de referencia. Confirmar al cargar.'),
  ('SV', 'El Salvador', 'IVA', 13, 'Tasa de referencia. Confirmar al cargar.'),
  ('ES', 'España', 'IVA', 21, 'Tasa de referencia. Confirmar al cargar.'),
  ('BR', 'Brasil', NULL, NULL, 'No hay una tasa única. Si el archivo trae impuesto, escríbela.'),
  ('US', 'Estados Unidos', NULL, NULL, 'No hay un IVA federal. Si el archivo trae impuesto, escríbela.'),
  ('VE', 'Venezuela', 'IVA', NULL, 'La tasa cambia seguido. Escríbela al cargar.')
ON CONFLICT (country_code) DO UPDATE
SET country_name = EXCLUDED.country_name,
    tax_name = EXCLUDED.tax_name,
    rate = EXCLUDED.rate,
    note = EXCLUDED.note;

CREATE TABLE IF NOT EXISTS public.si_spend_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_currency text,
  fx_mode text NOT NULL DEFAULT 'native' CHECK (fx_mode IN ('native', 'observed', 'fixed')),
  fx_rates jsonb NOT NULL DEFAULT '{}'::jsonb,
  fx_as_of date,
  window_mode text NOT NULL DEFAULT 'all' CHECK (window_mode IN ('all', 'calendar', 'rolling')),
  window_year integer,
  window_end date,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS si_spend_groups_company_name
  ON public.si_spend_groups (company_id, lower(btrim(name)));

ALTER TABLE public.si_uploads
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.si_spend_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS country_mixed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_basis text NOT NULL DEFAULT 'net' CHECK (tax_basis IN ('net', 'gross')),
  ADD COLUMN IF NOT EXISTS tax_rate numeric(6, 3),
  ADD COLUMN IF NOT EXISTS tax_rate_kind text NOT NULL DEFAULT 'none' CHECK (tax_rate_kind IN ('official', 'custom', 'none')),
  ADD COLUMN IF NOT EXISTS tax_rates jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS decisions_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_dates boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_currency text,
  ADD COLUMN IF NOT EXISTS fx_mode text NOT NULL DEFAULT 'native' CHECK (fx_mode IN ('native', 'observed', 'fixed')),
  ADD COLUMN IF NOT EXISTS fx_rates jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fx_as_of date,
  ADD COLUMN IF NOT EXISTS window_mode text NOT NULL DEFAULT 'all' CHECK (window_mode IN ('all', 'calendar', 'rolling')),
  ADD COLUMN IF NOT EXISTS window_year integer,
  ADD COLUMN IF NOT EXISTS window_end date;

ALTER TABLE public.si_spend_lines
  ADD COLUMN IF NOT EXISTS amount_net numeric(18, 2),
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS tax_rate_applied numeric(6, 3);

UPDATE public.si_spend_lines
SET amount_net = amount
WHERE amount_net IS NULL;

ALTER TABLE public.si_spend_lines
  ALTER COLUMN amount_net SET NOT NULL;

ALTER TABLE public.si_procurement_plans
  ALTER COLUMN upload_id DROP NOT NULL;

ALTER TABLE public.si_procurement_plans
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.si_spend_groups(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS display_currency text,
  ADD COLUMN IF NOT EXISTS fx_mode text,
  ADD COLUMN IF NOT EXISTS fx_rates jsonb,
  ADD COLUMN IF NOT EXISTS fx_as_of date,
  ADD COLUMN IF NOT EXISTS stale boolean NOT NULL DEFAULT false;

ALTER TABLE public.si_procurement_plans
  DROP CONSTRAINT IF EXISTS si_procurement_plans_scope;

ALTER TABLE public.si_procurement_plans
  ADD CONSTRAINT si_procurement_plans_scope CHECK (upload_id IS NOT NULL OR group_id IS NOT NULL);

ALTER TABLE public.sourcing_plans
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.si_spend_groups(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.si_spend_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  upload_id uuid REFERENCES public.si_uploads(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.si_spend_groups(id) ON DELETE SET NULL,
  snapshot jsonb NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_si_uploads_group ON public.si_uploads (group_id);
CREATE INDEX IF NOT EXISTS idx_si_plans_group ON public.si_procurement_plans (group_id);
CREATE INDEX IF NOT EXISTS idx_sourcing_plans_group ON public.sourcing_plans (group_id);
CREATE INDEX IF NOT EXISTS idx_si_decisions_upload ON public.si_spend_decisions (upload_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_si_lines_date ON public.si_spend_lines (upload_id, purchase_date);

UPDATE public.si_uploads u
SET
  has_dates = EXISTS (
    SELECT 1 FROM public.si_spend_lines l
    WHERE l.upload_id = u.id AND l.purchase_date IS NOT NULL
  ),
  display_currency = (
    SELECT upper(l.currency)
    FROM public.si_spend_lines l
    WHERE l.upload_id = u.id AND l.currency IS NOT NULL AND btrim(l.currency) <> ''
    GROUP BY upper(l.currency)
    ORDER BY count(*) DESC
    LIMIT 1
  )
WHERE u.decisions_confirmed = false;

UPDATE public.si_procurement_plans p
SET stale = true
WHERE p.upload_id IS NOT NULL
  AND (
    SELECT count(DISTINCT upper(l.currency))
    FROM public.si_spend_lines l
    WHERE l.upload_id = p.upload_id AND l.currency IS NOT NULL
  ) > 1;

INSERT INTO public.si_spend_decisions (company_id, upload_id, snapshot, created_at)
SELECT
  u.company_id,
  u.id,
  jsonb_build_object(
    'source', 'carga_anterior',
    'tax_basis', 'net',
    'note', 'El monto se dejó como neto. País, impuesto y moneda quedan por confirmar.'
  ),
  u.created_at
FROM public.si_uploads u
WHERE NOT EXISTS (
  SELECT 1 FROM public.si_spend_decisions d WHERE d.upload_id = u.id
);

CREATE OR REPLACE FUNCTION public.spend_group_same_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  g_company uuid;
BEGIN
  IF NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT company_id INTO g_company FROM public.si_spend_groups WHERE id = NEW.group_id;
  IF g_company IS NULL OR g_company <> NEW.company_id THEN
    RAISE EXCEPTION 'el grupo no es de esta empresa';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS spend_group_same_company_uploads ON public.si_uploads;
CREATE TRIGGER spend_group_same_company_uploads
  BEFORE INSERT OR UPDATE OF group_id, company_id ON public.si_uploads
  FOR EACH ROW EXECUTE FUNCTION public.spend_group_same_company();

DROP TRIGGER IF EXISTS spend_group_same_company_plans ON public.si_procurement_plans;
CREATE TRIGGER spend_group_same_company_plans
  BEFORE INSERT OR UPDATE OF group_id, company_id ON public.si_procurement_plans
  FOR EACH ROW EXECUTE FUNCTION public.spend_group_same_company();

DROP TRIGGER IF EXISTS spend_group_same_company_sourcing ON public.sourcing_plans;
CREATE TRIGGER spend_group_same_company_sourcing
  BEFORE INSERT OR UPDATE OF group_id, company_id ON public.sourcing_plans
  FOR EACH ROW EXECUTE FUNCTION public.spend_group_same_company();

CREATE OR REPLACE FUNCTION public.recompute_spend_net(p_upload_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_basis text;
  v_rate numeric;
  v_country text;
  v_mixed boolean;
  v_rates jsonb;
  v_updated integer;
  v_missing integer;
BEGIN
  SELECT tax_basis, tax_rate, country_code, country_mixed, coalesce(tax_rates, '{}'::jsonb)
    INTO v_basis, v_rate, v_country, v_mixed, v_rates
  FROM public.si_uploads
  WHERE id = p_upload_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'upload no encontrado';
  END IF;

  IF coalesce(v_mixed, false) = false AND v_country IS NOT NULL THEN
    UPDATE public.si_spend_lines
       SET country_code = v_country
     WHERE upload_id = p_upload_id
       AND (country_code IS NULL OR btrim(country_code) = '');
  END IF;

  IF v_basis = 'net' THEN
    UPDATE public.si_spend_lines
       SET amount_net = amount,
           tax_rate_applied = 0
     WHERE upload_id = p_upload_id;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN jsonb_build_object('updated', v_updated, 'missing_rate', 0);
  END IF;

  IF coalesce(v_mixed, false) = false THEN
    IF v_rate IS NULL OR v_rate < 0 OR v_rate >= 100 THEN
      RAISE EXCEPTION 'tasa inválida';
    END IF;
    UPDATE public.si_spend_lines
       SET amount_net = round(amount / (1 + (v_rate / 100.0)), 2),
           tax_rate_applied = v_rate
     WHERE upload_id = p_upload_id;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN jsonb_build_object('updated', v_updated, 'missing_rate', 0);
  END IF;

  SELECT count(*) INTO v_missing
  FROM public.si_spend_lines l
  WHERE l.upload_id = p_upload_id
    AND coalesce(v_rates ->> coalesce(l.country_code, ''), '') = '';

  IF v_missing > 0 THEN
    RAISE EXCEPTION 'falta la tasa de un país';
  END IF;

  UPDATE public.si_spend_lines l
     SET tax_rate_applied = (v_rates ->> l.country_code)::numeric,
         amount_net = round(l.amount / (1 + ((v_rates ->> l.country_code)::numeric / 100.0)), 2)
   WHERE l.upload_id = p_upload_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('updated', v_updated, 'missing_rate', 0);
END;
$$;

ALTER TABLE public.si_tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.si_spend_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.si_spend_decisions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.si_tax_rates TO authenticated;
REVOKE ALL ON TABLE public.si_tax_rates FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.si_spend_groups TO authenticated;
REVOKE ALL ON TABLE public.si_spend_groups FROM anon;

GRANT SELECT, INSERT ON TABLE public.si_spend_decisions TO authenticated;
REVOKE ALL ON TABLE public.si_spend_decisions FROM anon;

GRANT EXECUTE ON FUNCTION public.recompute_spend_net(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_group_same_company() TO authenticated;

DROP POLICY IF EXISTS si_tax_rates_read ON public.si_tax_rates;
CREATE POLICY si_tax_rates_read ON public.si_tax_rates
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS si_spend_groups_select ON public.si_spend_groups;
CREATE POLICY si_spend_groups_select ON public.si_spend_groups
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.id = auth.uid()));

DROP POLICY IF EXISTS si_spend_groups_insert ON public.si_spend_groups;
CREATE POLICY si_spend_groups_insert ON public.si_spend_groups
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.id = auth.uid()));

DROP POLICY IF EXISTS si_spend_groups_update ON public.si_spend_groups;
CREATE POLICY si_spend_groups_update ON public.si_spend_groups
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.id = auth.uid()))
  WITH CHECK (company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.id = auth.uid()));

DROP POLICY IF EXISTS si_spend_groups_delete ON public.si_spend_groups;
CREATE POLICY si_spend_groups_delete ON public.si_spend_groups
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.id = auth.uid()));

DROP POLICY IF EXISTS si_spend_decisions_select ON public.si_spend_decisions;
CREATE POLICY si_spend_decisions_select ON public.si_spend_decisions
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.id = auth.uid()));

DROP POLICY IF EXISTS si_spend_decisions_insert ON public.si_spend_decisions;
CREATE POLICY si_spend_decisions_insert ON public.si_spend_decisions
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT profiles.company_id FROM public.profiles WHERE profiles.id = auth.uid()));

COMMENT ON COLUMN public.si_spend_lines.amount IS 'Monto tal como vino en el archivo. No se reescribe.';
COMMENT ON COLUMN public.si_spend_lines.amount_net IS 'Gasto sin impuesto, calculado desde amount con la decisión vigente.';
COMMENT ON TABLE public.si_spend_groups IS 'Agrupa análisis de gasto dentro de una empresa. El nombre lo define el usuario.';
COMMENT ON TABLE public.si_spend_decisions IS 'Historial de país, impuesto, moneda y tipo de cambio. No se edita: cada cambio agrega una fila.';

CREATE OR REPLACE FUNCTION public.si_spend_lines_default_net()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.amount_net IS NULL THEN
    NEW.amount_net := NEW.amount;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS si_spend_lines_default_net ON public.si_spend_lines;
CREATE TRIGGER si_spend_lines_default_net
  BEFORE INSERT ON public.si_spend_lines
  FOR EACH ROW EXECUTE FUNCTION public.si_spend_lines_default_net();
