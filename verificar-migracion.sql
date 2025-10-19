-- ============================================
-- SCRIPT DE VERIFICACIÓN - MIGRACIÓN LICITACIONES
-- ============================================
-- Ejecuta este script en Supabase SQL Editor para verificar
-- que la migración se completó correctamente
-- ============================================

-- 1. Verificar que la tabla licitaciones existe y tiene la estructura correcta
SELECT '1. ESTRUCTURA DE LICITACIONES' as verificacion;
SELECT 
    column_name, 
    data_type,
    udt_name,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'licitaciones' 
ORDER BY ordinal_position;

-- Debería mostrar columnas como: id (text), name, description, status (licitacion_status), 
-- type (licitacion_type), baseline_amount, savings_amount, department_id, etc.

-- 2. Verificar que la tabla departments existe
SELECT '2. ESTRUCTURA DE DEPARTMENTS' as verificacion;
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'departments' 
ORDER BY ordinal_position;

-- Debería mostrar: id, company_id, name, is_active, created_at, updated_at

-- 3. Verificar que los tipos ENUM se crearon correctamente
SELECT '3. TIPOS ENUM CREADOS' as verificacion;
SELECT 
    t.typname as enum_name,
    e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname IN ('licitacion_status', 'licitacion_type', 'licitacion_category', 'baseline_source')
ORDER BY t.typname, e.enumsortorder;

-- Debería mostrar todos los valores de cada ENUM:
-- licitacion_status: planned, bases_review, published, evaluation, awarded, contract_signed
-- licitacion_type: RFP, RFQ, RFI
-- licitacion_category: recurring_service, non_recurring_service, improvement_project, construction_project
-- baseline_source: historical, budget, other

-- 4. Verificar políticas RLS para licitaciones
SELECT '4. POLÍTICAS RLS PARA LICITACIONES' as verificacion;
SELECT 
    schemaname,
    tablename, 
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'licitaciones'
ORDER BY policyname;

-- Debería mostrar 4 políticas: select, insert, update, delete

-- 5. Verificar políticas RLS para departments
SELECT '5. POLÍTICAS RLS PARA DEPARTMENTS' as verificacion;
SELECT 
    schemaname,
    tablename, 
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'departments'
ORDER BY policyname;

-- Debería mostrar 4 políticas: select, insert, update, delete

-- 6. Verificar que los triggers existen
SELECT '6. TRIGGERS PARA LICITACIONES' as verificacion;
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'licitaciones'
ORDER BY trigger_name;

-- Debería mostrar 2 triggers:
-- - trg_licitaciones_calculate_savings (calcula ahorros)
-- - trg_licitaciones_touch (actualiza updated_at)

-- 7. Verificar triggers para departments
SELECT '7. TRIGGERS PARA DEPARTMENTS' as verificacion;
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'departments'
ORDER BY trigger_name;

-- Debería mostrar 1 trigger: trg_departments_touch

-- 8. Verificar índices creados
SELECT '8. ÍNDICES CREADOS' as verificacion;
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('licitaciones', 'departments', 'licitacion_documents')
ORDER BY tablename, indexname;

-- Debería mostrar índices para company_id, status, department_id, etc.

-- 9. Verificar que no hay datos en las tablas (recién creadas)
SELECT '9. CONTEO DE REGISTROS' as verificacion;
SELECT 
    'licitaciones' as tabla, 
    COUNT(*) as total_registros 
FROM public.licitaciones
UNION ALL
SELECT 
    'departments' as tabla, 
    COUNT(*) as total_registros 
FROM public.departments;

-- Ambas deberían estar en 0 (vacías) a menos que ya hayas agregado datos

-- 10. PROBAR que el trigger de cálculo de ahorros funciona
SELECT '10. PRUEBA DE TRIGGER DE AHORROS' as verificacion;
-- Esta es una prueba simulada - no inserta datos reales
SELECT 
    100000 as baseline_amount,
    85000 as awarded_amount,
    100000 - 85000 as savings_calculated,
    ((100000 - 85000) / 100000.0) * 100 as savings_percentage_calculated;

-- Debería mostrar:
-- baseline: 100000
-- awarded: 85000
-- savings: 15000
-- percentage: 15.00

-- ============================================
-- RESUMEN DE VERIFICACIÓN
-- ============================================
SELECT '✅ VERIFICACIÓN COMPLETADA' as resultado;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'licitaciones') 
        THEN '✅ Tabla licitaciones creada'
        ELSE '❌ Tabla licitaciones NO existe'
    END as check_licitaciones,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'departments') 
        THEN '✅ Tabla departments creada'
        ELSE '❌ Tabla departments NO existe'
    END as check_departments,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'licitacion_status') 
        THEN '✅ Tipos ENUM creados'
        ELSE '❌ Tipos ENUM NO existen'
    END as check_enums,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_licitaciones_calculate_savings') 
        THEN '✅ Trigger de ahorros funciona'
        ELSE '❌ Trigger de ahorros NO existe'
    END as check_trigger;

-- ============================================
-- SI TODO ESTÁ ✅ ENTONCES:
-- ============================================
-- 1. ✅ Ve a Storage y crea el bucket "documents"
-- 2. ✅ Ve a /settings en tu app y agrega gerencias
-- 3. ✅ Ve a /licitaciones/new y crea tu primera licitación
-- ============================================

