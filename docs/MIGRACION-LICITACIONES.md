# Migración del Sistema de Licitaciones

Este documento describe los cambios realizados en el sistema de licitaciones y cómo migrar los datos existentes.

## 📋 Cambios Realizados

### 1. **Esquema de Base de Datos**

#### Nueva tabla: `departments` (Gerencias)
```sql
- id: uuid (PK)
- company_id: uuid (FK a companies)
- name: text (único por compañía)
- is_active: boolean
- created_at: timestamptz
- updated_at: timestamptz
```

#### Tabla `licitaciones` - Cambios importantes:
- ✅ **ID ahora es texto** (ej: "LIC-2025-001") en lugar de UUID
- ✅ Campo `name` reemplaza a `title`
- ✅ Nuevos estados: `planned`, `bases_review`, `published`, `evaluation`, `awarded`, `contract_signed`
- ✅ Nuevos campos de tipo: `RFP`, `RFQ`, `RFI`
- ✅ Nuevas categorías: `recurring_service`, `non_recurring_service`, `improvement_project`, `construction_project`
- ✅ Sistema de baseline y cálculo automático de ahorro
- ✅ Múltiples fechas del proceso de licitación
- ✅ Carga de bases de licitación (hasta 100MB)
- ✅ Enlace a documentos externos

#### Campos eliminados:
- ❌ `reference_number`
- ❌ `requirements` 
- ❌ `contact_person`
- ❌ `contact_email`
- ❌ `contact_phone`

#### Campos nuevos:
- `type` - Tipo de licitación (RFP, RFQ, RFI)
- `category` - Categoría del servicio/proyecto
- `baseline_amount` - Monto base de referencia
- `baseline_currency` - Moneda del baseline
- `baseline_source` - Fuente del baseline (historical, budget, other)
- `awarded_amount` - Monto adjudicado final
- `savings_amount` - Ahorro calculado automáticamente
- `savings_percentage` - Porcentaje de ahorro calculado automáticamente
- `department_id` - Gerencia responsable
- `responsible_user_id` - Usuario solicitante responsable
- Fechas del proceso (9 fechas diferentes)
- Campos para archivo de bases de licitación

## 🚀 Pasos de Migración

### Paso 1: Backup de Datos Existentes

```sql
-- Crear backup de licitaciones existentes
CREATE TABLE licitaciones_backup AS SELECT * FROM licitaciones;
```

### Paso 2: Ejecutar el Nuevo Esquema

```bash
# Ejecutar el esquema actualizado en Supabase
psql -h YOUR_SUPABASE_HOST -U postgres -d postgres -f supabase-schema.sql
```

### Paso 3: Migrar Datos Existentes (Si aplica)

```sql
-- Si tienes datos existentes, necesitarás migrarlos
-- NOTA: Ajusta estos queries según tus necesidades

-- 1. Primero, eliminar la tabla actual (¡CUIDADO!)
DROP TABLE IF EXISTS licitaciones CASCADE;

-- 2. Ejecutar el nuevo esquema (ver supabase-schema.sql)

-- 3. Migrar datos del backup con transformaciones
INSERT INTO licitaciones (
  id,
  company_id,
  name,
  description,
  status,
  type,
  category,
  baseline_currency,
  baseline_amount,
  baseline_source,
  created_by,
  created_at,
  updated_at
)
SELECT 
  -- Generar nuevo ID de texto basado en UUID anterior
  CONCAT('LIC-', TO_CHAR(created_at, 'YYYY'), '-', LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::text, 3, '0')),
  company_id,
  title as name, -- title → name
  description,
  -- Mapear estados antiguos a nuevos
  CASE status
    WHEN 'draft' THEN 'planned'::licitacion_status
    WHEN 'published' THEN 'published'::licitacion_status
    WHEN 'in_progress' THEN 'published'::licitacion_status
    WHEN 'evaluation' THEN 'evaluation'::licitacion_status
    WHEN 'awarded' THEN 'awarded'::licitacion_status
    WHEN 'cancelled' THEN 'planned'::licitacion_status
    ELSE 'planned'::licitacion_status
  END as status,
  'RFP'::licitacion_type as type, -- Valor por defecto
  'non_recurring_service'::licitacion_category as category, -- Valor por defecto
  currency as baseline_currency,
  estimated_value as baseline_amount,
  'budget'::baseline_source as baseline_source, -- Valor por defecto
  created_by,
  created_at,
  updated_at
FROM licitaciones_backup;
```

### Paso 4: Crear Gerencias Predeterminadas

```bash
# Ejecutar el script de seed de gerencias
# Primero, obtén el ID de tu compañía y reemplázalo en el script
psql -h YOUR_SUPABASE_HOST -U postgres -d postgres -f seed-departments.sql
```

O directamente desde la UI:
1. Ir a `/settings`
2. Sección "Gerencias"
3. Agregar las gerencias una por una

### Paso 5: Verificar la Migración

```sql
-- Verificar que las licitaciones se migraron correctamente
SELECT 
  id,
  name,
  status,
  type,
  category,
  baseline_amount,
  baseline_currency
FROM licitaciones
ORDER BY created_at DESC
LIMIT 10;

-- Verificar que las gerencias se crearon
SELECT * FROM departments WHERE company_id = 'YOUR_COMPANY_ID';
```

## 📝 Nuevas Funcionalidades

### 1. **Gerencias Configurables**
- Accede a `/settings` para configurar las gerencias de tu empresa
- Puedes crear, editar, activar/desactivar y eliminar gerencias
- Las gerencias inactivas no aparecen al crear licitaciones pero se mantienen en las existentes

### 2. **Formulario Completo de Licitación**
El nuevo formulario incluye:
- ✅ ID personalizado de licitación (texto libre)
- ✅ Tipo de licitación (RFP, RFQ, RFI)
- ✅ Categoría del servicio/proyecto
- ✅ Sistema de baseline con fuente
- ✅ Cálculo automático de ahorro
- ✅ Asignación de gerencia y responsable
- ✅ 9 fechas diferentes del proceso
- ✅ Carga de archivo de bases (hasta 100MB)
- ✅ Enlace a documentos externos

### 3. **Vista de Detalle Mejorada**
- Información organizada en tabs
- Visualización clara de ahorros
- Cronograma completo del proceso
- Información del equipo asignado
- Acceso a documentos

### 4. **Listado con Filtros**
- Búsqueda por ID, nombre o descripción
- Visualización de ahorro/sobrecosto
- Estados codificados por color

## 🔧 Configuración Post-Migración

### 1. Configurar Storage para Documentos

```sql
-- Crear bucket para documentos si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false);

-- Políticas de acceso para documentos
CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Users can view documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');
```

### 2. Configurar Gerencias Iniciales

Las gerencias predeterminadas sugeridas son:
- Finanzas
- Operaciones
- Recursos Humanos
- Comercial
- TI
- Marketing
- Legal

Puedes personalizarlas según tu organización desde `/settings`.

## ⚠️ Notas Importantes

1. **ID de Licitación**: Ahora es un campo de texto. Usa un formato consistente como `LIC-YYYY-###`
2. **Ahorro Automático**: El sistema calcula automáticamente el ahorro cuando ingresas baseline y monto adjudicado
3. **Gerencias**: Deben estar configuradas antes de crear licitaciones (aunque son opcionales)
4. **Documentos**: El bucket de storage debe estar configurado para subir bases de licitación
5. **Fechas**: Todas las fechas son opcionales, ingresa solo las que sean relevantes

## 🐛 Solución de Problemas

### Error: "Could not insert into licitaciones"
- Verifica que el ID sea único y no esté vacío
- Asegúrate de que company_id sea válido

### Error: "Could not upload document"
- Verifica que el bucket 'documents' exista en Storage
- Confirma que las políticas de acceso estén configuradas
- Verifica que el archivo no supere los 100MB

### Las gerencias no aparecen en el formulario
- Ve a `/settings` y crea al menos una gerencia
- Verifica que la gerencia esté marcada como "Activa"

### No se calculan los ahorros
- El cálculo es automático via trigger en la base de datos
- Verifica que tanto baseline_amount como awarded_amount tengan valores

## 📚 Recursos Adicionales

- `supabase-schema.sql` - Esquema completo de la base de datos
- `seed-departments.sql` - Script para poblar gerencias predeterminadas
- `/src/types/index.ts` - Tipos TypeScript actualizados

## 🆘 Soporte

Si encuentras problemas durante la migración:
1. Verifica que hayas seguido todos los pasos en orden
2. Revisa los logs de Supabase para errores específicos
3. Consulta la documentación de cada componente modificado

