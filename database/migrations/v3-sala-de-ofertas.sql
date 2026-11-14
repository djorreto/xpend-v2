-- Sala de Ofertas
-- Aplicar en el proyecto Supabase de V3, no en el de producción de V2.
-- Los sobres cerrados dependen de estas políticas: sin ellas, un proveedor
-- podría leer los montos de los demás desde el cliente.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS offer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  licitacion_id TEXT REFERENCES licitaciones(id) ON DELETE SET NULL,
  sourcing_plan_id UUID REFERENCES sourcing_plans(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  modality TEXT NOT NULL CHECK (modality IN ('sealed', 'rounds', 'reverse_auction', 'adhesion')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed', 'awarded', 'cancelled')),
  currency TEXT NOT NULL DEFAULT 'CLP',
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  min_decrement_pct NUMERIC(6, 2) DEFAULT 0,
  show_leading_price BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  winning_supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  winning_amount NUMERIC(15, 2),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS offer_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES offer_events(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'open', 'closed')),
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  UNIQUE (event_id, round_number)
);

CREATE TABLE IF NOT EXISTS offer_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES offer_events(id) ON DELETE CASCADE,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined')),
  UNIQUE (event_id, supplier_id)
);

CREATE TABLE IF NOT EXISTS offer_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES offer_events(id) ON DELETE CASCADE,
  round_id UUID REFERENCES offer_rounds(id) ON DELETE CASCADE,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  note TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS adhesion_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES offer_events(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  unit TEXT,
  quantity NUMERIC(15, 2),
  reference_price NUMERIC(15, 2)
);

CREATE TABLE IF NOT EXISTS adhesion_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id UUID NOT NULL REFERENCES adhesion_lines(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES offer_events(id) ON DELETE CASCADE,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  unit_price NUMERIC(15, 2) NOT NULL CHECK (unit_price >= 0),
  accepted BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (line_id, supplier_id)
);

ALTER TABLE offer_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE adhesion_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE adhesion_offers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_buyer_of(target_company UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND company_id = target_company
      AND coalesce(role::text, '') <> 'supplier'
  );
$$;

CREATE OR REPLACE FUNCTION public.my_supplier_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT supplier_id FROM profiles WHERE id = auth.uid();
$$;

DROP POLICY IF EXISTS offer_events_select ON offer_events;
CREATE POLICY offer_events_select ON offer_events
  FOR SELECT TO authenticated
  USING (
    public.is_buyer_of(company_id)
    OR id IN (
      SELECT event_id FROM offer_invitations
      WHERE supplier_id = public.my_supplier_id()
    )
  );

DROP POLICY IF EXISTS offer_events_write ON offer_events;
CREATE POLICY offer_events_write ON offer_events
  FOR ALL TO authenticated
  USING (public.is_buyer_of(company_id))
  WITH CHECK (public.is_buyer_of(company_id));

DROP POLICY IF EXISTS offer_rounds_all ON offer_rounds;
CREATE POLICY offer_rounds_all ON offer_rounds
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM offer_events e
      WHERE e.id = offer_rounds.event_id
        AND (
          public.is_buyer_of(e.company_id)
          OR e.id IN (SELECT event_id FROM offer_invitations WHERE supplier_id = public.my_supplier_id())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM offer_events e
      WHERE e.id = offer_rounds.event_id AND public.is_buyer_of(e.company_id)
    )
  );

DROP POLICY IF EXISTS offer_invitations_select ON offer_invitations;
CREATE POLICY offer_invitations_select ON offer_invitations
  FOR SELECT TO authenticated
  USING (
    supplier_id = public.my_supplier_id()
    OR EXISTS (
      SELECT 1 FROM offer_events e
      WHERE e.id = offer_invitations.event_id AND public.is_buyer_of(e.company_id)
    )
  );

DROP POLICY IF EXISTS offer_invitations_write ON offer_invitations;
CREATE POLICY offer_invitations_write ON offer_invitations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM offer_events e
      WHERE e.id = offer_invitations.event_id AND public.is_buyer_of(e.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM offer_events e
      WHERE e.id = offer_invitations.event_id AND public.is_buyer_of(e.company_id)
    )
  );

DROP POLICY IF EXISTS offer_bids_select ON offer_bids;
CREATE POLICY offer_bids_select ON offer_bids
  FOR SELECT TO authenticated
  USING (
    supplier_id = public.my_supplier_id()
    OR EXISTS (
      SELECT 1 FROM offer_events e
      LEFT JOIN offer_rounds r ON r.id = offer_bids.round_id
      WHERE e.id = offer_bids.event_id
        AND public.is_buyer_of(e.company_id)
        AND (
          e.status IN ('closed', 'awarded')
          OR e.modality IN ('reverse_auction', 'adhesion')
          OR (e.modality = 'rounds' AND r.status = 'closed')
        )
    )
  );

DROP POLICY IF EXISTS offer_bids_insert ON offer_bids;
CREATE POLICY offer_bids_insert ON offer_bids
  FOR INSERT TO authenticated
  WITH CHECK (
    supplier_id = public.my_supplier_id()
    AND EXISTS (
      SELECT 1 FROM offer_invitations i
      JOIN offer_events e ON e.id = i.event_id
      WHERE i.event_id = offer_bids.event_id
        AND i.supplier_id = offer_bids.supplier_id
        AND e.status = 'open'
    )
  );

DROP POLICY IF EXISTS adhesion_lines_all ON adhesion_lines;
CREATE POLICY adhesion_lines_all ON adhesion_lines
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM offer_events e
      WHERE e.id = adhesion_lines.event_id
        AND (
          public.is_buyer_of(e.company_id)
          OR e.id IN (SELECT event_id FROM offer_invitations WHERE supplier_id = public.my_supplier_id())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM offer_events e
      WHERE e.id = adhesion_lines.event_id AND public.is_buyer_of(e.company_id)
    )
  );

DROP POLICY IF EXISTS adhesion_offers_select ON adhesion_offers;
CREATE POLICY adhesion_offers_select ON adhesion_offers
  FOR SELECT TO authenticated
  USING (
    supplier_id = public.my_supplier_id()
    OR EXISTS (
      SELECT 1 FROM offer_events e
      WHERE e.id = adhesion_offers.event_id AND public.is_buyer_of(e.company_id)
    )
  );

DROP POLICY IF EXISTS adhesion_offers_insert ON adhesion_offers;
CREATE POLICY adhesion_offers_insert ON adhesion_offers
  FOR INSERT TO authenticated
  WITH CHECK (
    supplier_id = public.my_supplier_id()
    AND EXISTS (
      SELECT 1 FROM offer_events e
      JOIN offer_invitations i ON i.event_id = e.id AND i.supplier_id = adhesion_offers.supplier_id
      WHERE e.id = adhesion_offers.event_id AND e.status = 'open'
    )
  );

DROP POLICY IF EXISTS adhesion_offers_buyer_update ON adhesion_offers;
CREATE POLICY adhesion_offers_buyer_update ON adhesion_offers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM offer_events e
      WHERE e.id = adhesion_offers.event_id AND public.is_buyer_of(e.company_id)
    )
  );
