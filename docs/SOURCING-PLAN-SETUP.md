# 🎯 Sourcing Plan - Guía de Instalación en Supabase

## 📋 Resumen

Esta guía te ayudará a configurar el módulo **Sourcing Plan** en tu proyecto de Supabase.

---

## ✅ Requisitos Previos

- Proyecto de Supabase creado
- Acceso al SQL Editor de Supabase
- Las tablas `companies`, `profiles`, `departments`, `licitaciones` y `projects` deben existir

---

## 🚀 Instalación (3 minutos)

### **Opción 1: Script Todo-en-Uno** (Recomendado)

1. Ve a tu proyecto en [supabase.com](https://supabase.com)

2. Navega a **SQL Editor** en el menú lateral

3. Abre el archivo:
   ```
   database/migrations/complete-sourcing-plan-setup.sql
   ```

4. Copia **TODO** el contenido del archivo

5. Pégalo en el SQL Editor de Supabase

6. Click en **Run** (▶️)

7. **¡Listo!** Deberías ver el mensaje de éxito

### **Opción 2: Paso a Paso**

Si prefieres ejecutar por partes:

#### Paso 1: Crear la tabla
```
database/schemas/sourcing-plan-schema.sql
```

#### Paso 2: Agregar foreign keys a licitaciones y proyectos
```
database/migrations/add-sourcing-plan-foreign-keys.sql
```

---

## 🔍 Verificación

Después de ejecutar el script, verifica que todo esté correcto:

### 1. Verificar Tabla

En el SQL Editor, ejecuta:

```sql
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'sourcing_plans'
ORDER BY ordinal_position;
```

Deberías ver **25+ columnas** incluyendo:
- `id`, `company_id`, `title`, `description`
- `plan_year`, `quarter`
- `estimated_spend`, `actual_spend`
- `projected_savings_amount`, `actual_savings_amount`
- `status`, `is_spot`
- `licitacion_id`, `project_id`
- etc.

### 2. Verificar RLS (Seguridad)

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'sourcing_plans';
```

Deberías ver **4 políticas**:
- ✅ Users can view sourcing plans from their company (SELECT)
- ✅ Users can insert sourcing plans in their company (INSERT)
- ✅ Users can update sourcing plans from their company (UPDATE)
- ✅ Only admins can delete sourcing plans (DELETE)

### 3. Verificar Triggers

```sql
SELECT trigger_name, event_manipulation
FROM information_schema.triggers
WHERE event_object_table = 'sourcing_plans';
```

Deberías ver **3 triggers**:
- ✅ `trigger_calculate_projected_savings`
- ✅ `trigger_calculate_actual_savings`
- ✅ `trigger_update_sourcing_plans_updated_at`

### 4. Verificar Foreign Keys en Licitaciones

```sql
SELECT column_name 
FROM information_schema.columns
WHERE table_name = 'licitaciones' AND column_name = 'sourcing_plan_id';
```

Deberías ver la columna `sourcing_plan_id`.

### 5. Verificar Foreign Keys en Projects

```sql
SELECT column_name 
FROM information_schema.columns
WHERE table_name = 'projects' AND column_name = 'sourcing_plan_id';
```

Deberías ver la columna `sourcing_plan_id`.

---

## 🎨 Probar el Módulo

Una vez instalado:

1. **Reinicia el servidor** (si está corriendo):
   ```bash
   # Ctrl+C para detener, luego:
   npm run dev
   ```

2. **Accede a la aplicación**:
   ```
   http://localhost:3000
   ```

3. **Ve al Sourcing Plan**:
   - Haz clic en "Sourcing Plan" en el sidebar (🎯)
   - O ve directamente a: `http://localhost:3000/sourcing-plan`

4. **Crea tu primera iniciativa**:
   - Click en "Nueva Iniciativa"
   - Llena el formulario
   - Guarda

5. **Verifica en el Dashboard**:
   - Ve al Dashboard
   - Deberías ver el widget "Sourcing Plan 2025"

---

## 🐛 Troubleshooting

### Error: "relation sourcing_plans does not exist"

**Causa**: La tabla no se creó correctamente.

**Solución**: Ejecuta nuevamente el script `complete-sourcing-plan-setup.sql`.

---

### Error: "column sourcing_plan_id does not exist in licitaciones"

**Causa**: Las foreign keys no se agregaron.

**Solución**: 
1. Ejecuta el script `add-sourcing-plan-foreign-keys.sql`
2. O ejecuta manualmente:
   ```sql
   ALTER TABLE licitaciones 
   ADD COLUMN sourcing_plan_id UUID REFERENCES sourcing_plans(id);
   
   ALTER TABLE projects 
   ADD COLUMN sourcing_plan_id UUID REFERENCES sourcing_plans(id);
   ```

---

### Error: "permission denied for table sourcing_plans"

**Causa**: Las políticas RLS no están configuradas o tu usuario no tiene company_id.

**Solución**:
1. Verifica que el script creó las políticas RLS
2. Verifica que tu usuario tiene `company_id` en la tabla `profiles`:
   ```sql
   SELECT id, email, company_id FROM profiles WHERE id = auth.uid();
   ```

---

### La aplicación sigue en modo Mockup

**Causa**: Las variables de entorno no están configuradas.

**Solución**:
1. Verifica que `.env.local` existe y tiene:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
   ```
2. Reinicia el servidor después de modificar `.env.local`

---

## 📊 Datos de Prueba (Opcional)

Si quieres agregar datos de ejemplo para probar:

```sql
-- Ejemplo de iniciativa planificada
INSERT INTO sourcing_plans (
  company_id,
  plan_year,
  quarter,
  title,
  description,
  category,
  initiative_type,
  estimated_spend,
  currency,
  projected_savings_percentage,
  status,
  is_spot,
  created_by
) VALUES (
  'tu-company-id-aqui',
  2025,
  'Q1',
  'Licitación Servicios de Aseo',
  'Renovación del contrato de servicios de aseo para todas las oficinas',
  'Servicios Generales',
  'licitacion',
  50000000,
  'CLP',
  15.0,
  'planned',
  false,
  auth.uid()
);
```

**Nota**: Reemplaza `'tu-company-id-aqui'` con el ID real de tu empresa.

---

## ✨ Funcionalidades Disponibles

Una vez instalado, tendrás acceso a:

✅ **Planificación Anual**: Define iniciativas por trimestre
✅ **Seguimiento de Ahorros**: Proyectados vs Reales
✅ **Integración con Licitaciones**: Vincula licitaciones con el plan
✅ **Integración con Proyectos**: Vincula proyectos con el plan
✅ **Dashboard**: Widget con métricas del año
✅ **Exportación CSV**: Descarga el plan completo
✅ **Filtros Avanzados**: Por año, trimestre, tipo, estado
✅ **Iniciativas Spot**: Registra iniciativas no planificadas
✅ **Seguridad**: RLS por empresa

---

## 📚 Documentación Adicional

- **Schema**: `database/schemas/sourcing-plan-schema.sql`
- **Types**: `src/types/index.ts` - Interface `SourcingPlan`
- **Mock Data**: `src/lib/mock-data.ts` - Datos de ejemplo

---

## 🆘 Soporte

Si tienes problemas:

1. Verifica los logs de Supabase (pestaña "Logs")
2. Verifica la consola del navegador (F12)
3. Revisa que todas las tablas dependientes existan
4. Asegúrate de tener `.env.local` configurado

---

## 🎉 ¡Felicidades!

El módulo **Sourcing Plan** está instalado y listo para usar. 

Ahora puedes:
- Planificar tus iniciativas de Strategic Sourcing
- Hacer seguimiento de ahorros
- Integrar con licitaciones y proyectos
- Generar reportes

**Happy Sourcing! 🎯**

