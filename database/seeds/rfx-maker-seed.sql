-- =====================================================
-- RFx MAKER - Datos de Prueba (Seed Data)
-- =====================================================
-- IMPORTANTE: Este script asume que ya existe:
-- - Una empresa (companies.id)
-- - Al menos un usuario admin (profiles.id con role='admin')
-- =====================================================

-- Variables para personalizar (CAMBIAR ESTOS IDs según tu BD)
-- Obtén estos valores con: SELECT id FROM companies LIMIT 1;
--                          SELECT id FROM profiles WHERE role='admin' LIMIT 1;

DO $$
DECLARE
  v_company_id UUID;
  v_admin_user_id UUID;
  v_template_id UUID;
  v_policy_id UUID;
  v_project1_id UUID;
  v_project2_id UUID;
BEGIN

  -- =====================================================
  -- 1. OBTENER IDs EXISTENTES
  -- =====================================================

  SELECT id INTO v_company_id FROM companies LIMIT 1;
  SELECT id INTO v_admin_user_id FROM profiles WHERE role IN ('admin', 'super_admin') LIMIT 1;

  IF v_company_id IS NULL OR v_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró company_id o admin_user_id. Verifica que existan datos en companies y profiles.';
  END IF;

  RAISE NOTICE 'Usando company_id: %', v_company_id;
  RAISE NOTICE 'Usando admin_user_id: %', v_admin_user_id;

  -- =====================================================
  -- 2. CREAR PLANTILLA ADMINISTRATIVA
  -- =====================================================

  INSERT INTO rfx_templates (
    id,
    company_id,
    name,
    description,
    language,
    status,
    template_structure,
    placeholder_definitions,
    include_toc,
    auto_numbering,
    branding_settings,
    version_number,
    is_active_version,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_company_id,
    'Plantilla Base Administrativa Estándar',
    'Plantilla estándar para licitaciones RFP/RFQ/RFI con secciones comunes de bases administrativas',
    'es-CL',
    'active',
    E'BASES ADMINISTRATIVAS\n\n' ||
    E'1. ANTECEDENTES GENERALES\n' ||
    E'   1.1. Moneda del Proceso: {{ currency }}\n' ||
    E'   1.2. Plazo de Entrega: {{ delivery_timeline }}\n' ||
    E'   1.3. Lugar de Entrega: {{ delivery_location }}\n\n' ||
    E'2. GARANTÍAS\n' ||
    E'   2.1. Garantía de Seriedad de Oferta: {{ performance_bond_percent }}% del monto total\n' ||
    E'   2.2. Vigencia de la Propuesta: {{ proposal_validity_days }} días corridos desde apertura\n' ||
    E'   2.3. Garantía de Fiel Cumplimiento: {{ fulfillment_bond_percent }}% del monto adjudicado\n\n' ||
    E'3. CONDICIONES DE PAGO\n' ||
    E'   {{ payment_terms }}\n\n' ||
    E'4. PLAZOS\n' ||
    E'   4.1. Plazo de Ejecución: {{ execution_timeline }}\n' ||
    E'   4.2. Fecha Inicio: {{ start_date }}\n\n' ||
    E'5. CRITERIOS DE EVALUACIÓN\n' ||
    E'   5.1. Evaluación Técnica: {{ technical_evaluation_weight }}%\n' ||
    E'   5.2. Evaluación Económica: {{ economic_evaluation_weight }}%\n' ||
    E'   5.3. Puntaje Mínimo: {{ minimum_score }} puntos\n\n' ||
    E'6. PENALIDADES Y MULTAS\n' ||
    E'   {{ penalties_clause }}\n\n' ||
    E'7. CONTACTO\n' ||
    E'   Responsable: {{ contact_person }}\n' ||
    E'   Email: {{ contact_email }}\n' ||
    E'   Teléfono: {{ contact_phone }}',
    jsonb_build_array(
      jsonb_build_object(
        'field_key', 'currency',
        'label', 'Moneda',
        'type', 'text',
        'default_value', 'CLP',
        'editable_by', 'admin',
        'help_text', 'Moneda en la que se cotizará y pagará',
        'group', 'Moneda y Reajuste'
      ),
      jsonb_build_object(
        'field_key', 'delivery_timeline',
        'label', 'Plazo de Entrega',
        'type', 'text',
        'default_value', '30 días corridos',
        'editable_by', 'user',
        'help_text', 'Plazo máximo para entrega desde adjudicación',
        'group', 'Plazos'
      ),
      jsonb_build_object(
        'field_key', 'delivery_location',
        'label', 'Lugar de Entrega',
        'type', 'text',
        'default_value', 'Bodega Central, Santiago',
        'editable_by', 'user',
        'group', 'General'
      ),
      jsonb_build_object(
        'field_key', 'performance_bond_percent',
        'label', 'Garantía de Seriedad (%)',
        'type', 'number',
        'default_value', '10',
        'editable_by', 'admin',
        'help_text', 'Porcentaje del monto total para garantía de seriedad',
        'group', 'Garantías'
      ),
      jsonb_build_object(
        'field_key', 'proposal_validity_days',
        'label', 'Vigencia de Propuesta (días)',
        'type', 'number',
        'default_value', '90',
        'editable_by', 'user',
        'group', 'Plazos'
      ),
      jsonb_build_object(
        'field_key', 'fulfillment_bond_percent',
        'label', 'Garantía de Fiel Cumplimiento (%)',
        'type', 'number',
        'default_value', '5',
        'editable_by', 'admin',
        'group', 'Garantías'
      ),
      jsonb_build_object(
        'field_key', 'payment_terms',
        'label', 'Condiciones de Pago',
        'type', 'text',
        'default_value', 'Pago a 30 días término de mes factura, contra recepción conforme',
        'editable_by', 'user',
        'group', 'Pagos'
      ),
      jsonb_build_object(
        'field_key', 'execution_timeline',
        'label', 'Plazo de Ejecución',
        'type', 'text',
        'default_value', '6 meses',
        'editable_by', 'user',
        'group', 'Plazos'
      ),
      jsonb_build_object(
        'field_key', 'start_date',
        'label', 'Fecha de Inicio',
        'type', 'date',
        'default_value', '',
        'editable_by', 'user',
        'group', 'Plazos'
      ),
      jsonb_build_object(
        'field_key', 'technical_evaluation_weight',
        'label', 'Peso Evaluación Técnica (%)',
        'type', 'number',
        'default_value', '60',
        'editable_by', 'admin',
        'group', 'Evaluación'
      ),
      jsonb_build_object(
        'field_key', 'economic_evaluation_weight',
        'label', 'Peso Evaluación Económica (%)',
        'type', 'number',
        'default_value', '40',
        'editable_by', 'admin',
        'group', 'Evaluación'
      ),
      jsonb_build_object(
        'field_key', 'minimum_score',
        'label', 'Puntaje Mínimo',
        'type', 'number',
        'default_value', '60',
        'editable_by', 'admin',
        'group', 'Evaluación'
      ),
      jsonb_build_object(
        'field_key', 'penalties_clause',
        'label', 'Cláusula de Penalidades',
        'type', 'text',
        'default_value', 'Se aplicará una multa equivalente al 1% del monto total por cada día de atraso, con un máximo de 10% del contrato.',
        'editable_by', 'admin',
        'group', 'Penalidades'
      ),
      jsonb_build_object(
        'field_key', 'contact_person',
        'label', 'Persona de Contacto',
        'type', 'text',
        'default_value', 'Juan Pérez - Jefe de Abastecimiento',
        'editable_by', 'user',
        'group', 'Contacto'
      ),
      jsonb_build_object(
        'field_key', 'contact_email',
        'label', 'Email de Contacto',
        'type', 'text',
        'default_value', 'abastecimiento@empresa.cl',
        'editable_by', 'user',
        'group', 'Contacto'
      ),
      jsonb_build_object(
        'field_key', 'contact_phone',
        'label', 'Teléfono de Contacto',
        'type', 'text',
        'default_value', '+56 2 2345 6789',
        'editable_by', 'user',
        'group', 'Contacto'
      )
    ),
    true,
    true,
    '{"primary_color": "#3BE7AE", "secondary_color": "#2AD4D2"}'::jsonb,
    1,
    true,
    v_admin_user_id,
    NOW(),
    NOW()
  ) RETURNING id INTO v_template_id;

  RAISE NOTICE 'Plantilla creada: %', v_template_id;

  -- =====================================================
  -- 3. CREAR POLÍTICA DE EMPRESA
  -- =====================================================

  INSERT INTO rfx_company_policies (
    id,
    company_id,
    template_id,
    policy_name,
    description,
    policy_values,
    is_active,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_company_id,
    v_template_id,
    'Política por Defecto - Estándar',
    'Política con valores por defecto para procesos estándar de licitación',
    jsonb_build_object(
      'currency', 'CLP',
      'delivery_timeline', '30 días corridos',
      'delivery_location', 'Bodega Central, Santiago',
      'performance_bond_percent', '10',
      'proposal_validity_days', '90',
      'fulfillment_bond_percent', '5',
      'payment_terms', 'Pago a 30 días término de mes factura, contra recepción conforme',
      'execution_timeline', '6 meses',
      'start_date', '',
      'technical_evaluation_weight', '60',
      'economic_evaluation_weight', '40',
      'minimum_score', '60',
      'penalties_clause', 'Se aplicará una multa equivalente al 1% del monto total por cada día de atraso, con un máximo de 10% del contrato.',
      'contact_person', 'Juan Pérez - Jefe de Abastecimiento',
      'contact_email', 'abastecimiento@empresa.cl',
      'contact_phone', '+56 2 2345 6789'
    ),
    true,
    v_admin_user_id,
    NOW(),
    NOW()
  ) RETURNING id INTO v_policy_id;

  RAISE NOTICE 'Política creada: %', v_policy_id;

  -- =====================================================
  -- 4. CREAR PROYECTOS DE EJEMPLO
  -- =====================================================

  -- Proyecto 1: Draft con base técnica generada
  INSERT INTO rfx_projects (
    id,
    company_id,
    project_code,
    title,
    description,
    rfx_type,
    template_id,
    template_version_snapshot,
    policy_snapshot,
    status,
    admin_parameters,
    technical_base_content,
    technical_base_generated_at,
    technical_base_is_valid,
    technical_base_manually_edited,
    project_context,
    version_number,
    responsible_user_id,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_company_id,
    'RFX-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0'),
    'Licitación Servicios de Mantenimiento Industrial 2025',
    'Contratación de servicios de mantenimiento preventivo y correctivo para maquinaria industrial en planta de producción',
    'RFP',
    v_template_id,
    1,
    jsonb_build_object(
      'currency', 'CLP',
      'delivery_timeline', '15 días corridos',
      'performance_bond_percent', '10'
    ),
    'draft',
    jsonb_build_object(
      'currency', 'CLP',
      'delivery_timeline', '15 días corridos',
      'delivery_location', 'Planta Industrial, Quilicura',
      'performance_bond_percent', '15',
      'proposal_validity_days', '120',
      'fulfillment_bond_percent', '10',
      'payment_terms', 'Pago a 45 días término de mes factura',
      'execution_timeline', '12 meses',
      'start_date', '2025-01-15',
      'technical_evaluation_weight', '70',
      'economic_evaluation_weight', '30',
      'minimum_score', '70',
      'penalties_clause', 'Multa del 2% por día de atraso, máximo 15% del contrato',
      'contact_person', 'María González - Gerente de Mantenimiento',
      'contact_email', 'mantenimiento@empresa.cl',
      'contact_phone', '+56 2 2111 2222'
    ),
    '<h2>BASE TÉCNICA - Servicios de Mantenimiento Industrial</h2><p>Esta es una base técnica de ejemplo generada por IA.</p>',
    NOW() - INTERVAL '2 days',
    true,
    false,
    jsonb_build_object(
      'industry', 'Manufactura Industrial',
      'project_budget', '85000000',
      'deadline', '12 meses',
      'special_requirements', jsonb_build_array(
        'Disponibilidad 24/7 para emergencias',
        'Certificación ISO 9001',
        'Personal técnico especializado'
      )
    ),
    1,
    v_admin_user_id,
    v_admin_user_id,
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '2 days'
  ) RETURNING id INTO v_project1_id;

  RAISE NOTICE 'Proyecto 1 creado: %', v_project1_id;

  -- Proyecto 2: Ready para descargar
  INSERT INTO rfx_projects (
    id,
    company_id,
    project_code,
    title,
    description,
    rfx_type,
    template_id,
    template_version_snapshot,
    policy_snapshot,
    status,
    admin_parameters,
    technical_base_content,
    technical_base_generated_at,
    technical_base_is_valid,
    technical_base_manually_edited,
    project_context,
    version_number,
    responsible_user_id,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_company_id,
    'RFX-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0'),
    'RFQ - Suministro de Materiales de Oficina 2025',
    'Contratación anual para suministro de materiales de oficina y consumibles',
    'RFQ',
    v_template_id,
    1,
    jsonb_build_object(
      'currency', 'CLP',
      'delivery_timeline', '30 días corridos',
      'performance_bond_percent', '10'
    ),
    'ready',
    jsonb_build_object(
      'currency', 'CLP',
      'delivery_timeline', '7 días corridos',
      'delivery_location', 'Oficinas Centrales, Santiago Centro',
      'performance_bond_percent', '5',
      'proposal_validity_days', '60',
      'fulfillment_bond_percent', '3',
      'payment_terms', 'Pago a 30 días término de mes factura',
      'execution_timeline', '12 meses',
      'start_date', '2025-02-01',
      'technical_evaluation_weight', '40',
      'economic_evaluation_weight', '60',
      'minimum_score', '50',
      'penalties_clause', 'Multa del 0.5% por día de atraso en entregas',
      'contact_person', 'Carlos Rodríguez - Jefe de Administración',
      'contact_email', 'administracion@empresa.cl',
      'contact_phone', '+56 2 2333 4444'
    ),
    '<h2>BASE TÉCNICA - Suministro de Materiales de Oficina</h2><p>Base técnica completa y validada.</p>',
    NOW() - INTERVAL '7 days',
    true,
    false,
    jsonb_build_object(
      'industry', 'Servicios Administrativos',
      'project_budget', '15000000',
      'deadline', '12 meses',
      'special_requirements', jsonb_build_array(
        'Entregas quincenales',
        'Stock mínimo garantizado'
      )
    ),
    1,
    v_admin_user_id,
    v_admin_user_id,
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '1 day'
  ) RETURNING id INTO v_project2_id;

  RAISE NOTICE 'Proyecto 2 creado: %', v_project2_id;

  -- =====================================================
  -- 5. CREAR COMENTARIOS DE EJEMPLO
  -- =====================================================

  INSERT INTO rfx_project_comments (project_id, comment_text, section, created_by, created_at) VALUES
  (v_project1_id, 'Revisar si las garantías son suficientes para este tipo de proyecto crítico', 'admin', v_admin_user_id, NOW() - INTERVAL '3 days'),
  (v_project1_id, 'La base técnica generada por IA es muy completa, solo ajustar algunos detalles', 'technical', v_admin_user_id, NOW() - INTERVAL '2 days');

  -- =====================================================
  -- 6. CREAR REGISTRO DE AUDITORÍA
  -- =====================================================

  INSERT INTO rfx_audit_log (entity_type, entity_id, action, metadata, performed_by, performed_at) VALUES
  ('template', v_template_id, 'created', '{"version": 1}'::jsonb, v_admin_user_id, NOW() - INTERVAL '15 days'),
  ('template', v_template_id, 'status_changed', '{"from": "draft", "to": "active"}'::jsonb, v_admin_user_id, NOW() - INTERVAL '14 days'),
  ('policy', v_policy_id, 'created', '{}'::jsonb, v_admin_user_id, NOW() - INTERVAL '13 days'),
  ('project', v_project1_id, 'created', '{"rfx_type": "RFP"}'::jsonb, v_admin_user_id, NOW() - INTERVAL '5 days'),
  ('project', v_project1_id, 'generated', '{"section": "technical_base"}'::jsonb, v_admin_user_id, NOW() - INTERVAL '2 days'),
  ('project', v_project2_id, 'created', '{"rfx_type": "RFQ"}'::jsonb, v_admin_user_id, NOW() - INTERVAL '10 days'),
  ('project', v_project2_id, 'status_changed', '{"from": "draft", "to": "ready"}'::jsonb, v_admin_user_id, NOW() - INTERVAL '1 day');

  RAISE NOTICE '✅ Seed data cargado exitosamente!';
  RAISE NOTICE '📋 Resumen:';
  RAISE NOTICE '  - 1 Plantilla administrativa (activa)';
  RAISE NOTICE '  - 1 Política de empresa (activa)';
  RAISE NOTICE '  - 2 Proyectos RFx (1 draft, 1 ready)';
  RAISE NOTICE '  - 2 Comentarios';
  RAISE NOTICE '  - 7 Registros de auditoría';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Ya puedes probar RFx Maker en /rfx-maker';

END $$;

