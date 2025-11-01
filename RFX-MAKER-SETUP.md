# 🛠️ RFx MAKER - Instrucciones de Setup

## 📋 PRE-REQUISITOS

Antes de comenzar, asegúrate de tener:

1. ✅ Acceso a Supabase (Dashboard)
2. ✅ Al menos una empresa creada en tabla `companies`
3. ✅ Al menos un usuario con rol `admin` o `super_admin` en tabla `profiles`
4. ✅ API Key de Groq configurada en `.env.local` (para IA)

---

## 🚀 INSTALACIÓN PASO A PASO

### PASO 1: Aplicar Schema de Base de Datos

1. Ve a tu **Dashboard de Supabase**
2. Ve a **SQL Editor**
3. Abre el archivo `database/schemas/rfx-maker-schema.sql`
4. Copia todo el contenido
5. Pégalo en el SQL Editor
6. Click en **Run**

**Resultado esperado:**
```
✅ 8 tablas creadas:
   - rfx_templates
   - rfx_template_variables
   - rfx_company_policies
   - rfx_projects
   - rfx_project_versions
   - rfx_project_downloads
   - rfx_project_comments
   - rfx_audit_log

✅ Triggers creados:
   - update_rfx_updated_at (4x)
   - invalidate_technical_base

✅ RLS policies habilitadas
```

**⚠️ Si hay errores:**
- Verifica que la extensión `uuid-ossp` esté habilitada
- Verifica que las tablas `companies` y `profiles` existan
- Verifica que no existan tablas con los mismos nombres

---

### PASO 2: Cargar Datos de Prueba (Opcional pero Recomendado)

1. Aún en **SQL Editor**
2. Abre el archivo `database/seeds/rfx-maker-seed.sql`
3. Copia todo el contenido
4. Pégalo en el SQL Editor
5. Click en **Run**

**Resultado esperado:**
```
✅ 1 Plantilla administrativa (activa)
✅ 1 Política de empresa (activa)
✅ 2 Proyectos RFx (1 draft, 1 ready)
✅ 2 Comentarios
✅ 7 Registros de auditoría
```

**Nota:** El script automáticamente detecta tu `company_id` y `admin_user_id` de las tablas existentes.

**⚠️ Si hay errores:**
- Verifica que tengas al menos una empresa en `companies`
- Verifica que tengas al menos un usuario admin en `profiles`
- El script usa `gen_random_uuid()` para IDs únicos

---

### PASO 3: Verificar Instalación

Ejecuta este SQL para verificar que todo se instaló correctamente:

```sql
-- Verificar tablas creadas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'rfx_%';

-- Debería mostrar 8 tablas

-- Verificar datos de prueba (si los cargaste)
SELECT
  (SELECT COUNT(*) FROM rfx_templates) as templates,
  (SELECT COUNT(*) FROM rfx_company_policies) as policies,
  (SELECT COUNT(*) FROM rfx_projects) as projects;

-- Debería mostrar: templates: 1, policies: 1, projects: 2

-- Verificar plantilla activa
SELECT id, name, status, is_active_version
FROM rfx_templates
WHERE is_active_version = true;

-- Debería mostrar 1 plantilla activa
```

---

### PASO 4: Configurar Variables de Entorno (Si no está configurado)

Verifica que tu archivo `.env.local` tenga:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key

# Groq API (para IA)
GROQ_API_KEY=tu_groq_api_key

# O si usas OpenAI:
OPENAI_API_KEY=tu_openai_api_key
```

**Nota:** RFx Maker usa la misma configuración de IA que ANA Chat. Si ANA funciona, RFx Maker también funcionará.

---

### PASO 5: Reiniciar Servidor de Desarrollo

```bash
# Detener servidor actual
Ctrl + C

# Reiniciar
npm run dev
```

---

### PASO 6: Verificar en la Aplicación

1. **Accede a XPEND**: `http://localhost:3001`
2. **Login** con un usuario admin
3. En el **Sidebar**, deberías ver un nuevo ítem: **"RFx Maker"** (con ícono de documento)
4. Click en **"RFx Maker"**

**Deberías ver:**
- 📊 4 cards de estadísticas (Total, Borradores, Listos, Cerrados)
- 📋 Listado de proyectos (2 si cargaste seed data)
- 🔘 Botón "Nuevo Proyecto"
- 🔗 Enlaces a "Administrar Plantillas" y "Políticas de Empresa"

---

## ✅ PRUEBA COMPLETA DEL FLUJO

### Como ADMIN:

#### 1. Verificar Plantilla
```
1. RFx Maker → "Administrar Plantillas"
2. Deberías ver: "Plantilla Base Administrativa Estándar" (con badge "Activa")
3. Click en "Editar" para ver su estructura
4. Verás variables definidas como: currency, delivery_timeline, etc.
```

#### 2. Verificar Política
```
1. RFx Maker → "Políticas de Empresa"
2. Deberías ver formulario con valores por defecto:
   - Moneda: CLP
   - Garantía de seriedad: 10
   - Vigencia de propuesta: 90 días
   - etc.
3. Estos valores se aplicarán a nuevos proyectos
```

### Como USUARIO (o Admin):

#### 3. Ver Proyectos Existentes
```
1. RFx Maker → Listado
2. Deberías ver 2 proyectos:
   - "Licitación Servicios de Mantenimiento Industrial 2025" (Draft)
   - "RFQ - Suministro de Materiales de Oficina 2025" (Ready)
3. Click en cualquiera para ver detalles
```

#### 4. Crear Nuevo Proyecto
```
1. Click "Nuevo Proyecto"
2. Completa:
   - Tipo: RFP
   - Título: "Prueba RFx Maker"
   - Descripción: "Proyecto de prueba"
   - Contexto:
     * Industria: "Tecnología"
     * Presupuesto: "10000000"
     * Plazo: "6 meses"
3. Click "Crear Proyecto"
4. Serás redirigido a la vista del proyecto
```

#### 5. Generar Base Técnica con IA
```
1. En la vista del proyecto, ve al tab "Base Técnica (IA)"
2. Click "Generar Base Técnica"
3. Espera 10-30 segundos (la IA está trabajando)
4. Verás contenido HTML generado contextualizado a tu proyecto
5. La IA generará:
   - Introducción y antecedentes
   - Objeto de la contratación
   - Requisitos técnicos
   - Criterios de evaluación
   - Y más...
```

#### 6. Probar Invalidación Automática
```
1. Ve al tab "Base Administrativa"
2. Cambia algún parámetro (ej: garantía de 10% a 15%)
3. Click "Guardar"
4. Automáticamente verás un banner naranja:
   "Base Técnica Invalidada - Los parámetros administrativos cambiaron..."
5. Click "Regenerar Base Técnica"
6. La IA generará nueva base técnica con parámetros actualizados
```

#### 7. Marcar como Listo
```
1. Una vez satisfecho con el proyecto
2. Click "Marcar como Listo"
3. El estado cambia de "draft" a "ready"
4. Badge verde "ready" aparece
5. Proyecto listo para descargar (cuando esté disponible)
```

---

## 🐛 TROUBLESHOOTING

### Problema: "No hay plantillas disponibles"

**Síntoma:** Al intentar crear proyecto, mensaje de error.

**Solución:**
1. Ve a Supabase SQL Editor
2. Ejecuta:
```sql
SELECT id, name, status, is_active_version FROM rfx_templates;
```
3. Si no hay resultados, carga el seed data de nuevo
4. Si hay resultados pero `is_active_version = false`, activa una plantilla:
```sql
UPDATE rfx_templates SET is_active_version = true WHERE id = 'TU_TEMPLATE_ID';
```

---

### Problema: "Error al generar base técnica"

**Síntoma:** Error al click en "Generar Base Técnica".

**Solución:**
1. Verifica que `GROQ_API_KEY` esté en `.env.local`
2. Verifica que la API key sea válida
3. Revisa logs del servidor:
```bash
# En terminal donde corre npm run dev
# Busca errores como "API key invalid" o "Rate limit exceeded"
```
4. Si no tienes Groq, puedes usar OpenAI:
```env
OPENAI_API_KEY=tu_key
```

---

### Problema: "Acceso denegado" en Plantillas/Políticas

**Síntoma:** Error 403 o redirect al intentar acceder.

**Solución:**
1. Verifica tu rol en la BD:
```sql
SELECT id, email, role FROM profiles WHERE email = 'tu@email.com';
```
2. Si no eres admin, actualiza tu rol:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'tu@email.com';
```

---

### Problema: RLS Policies bloquean acceso

**Síntoma:** No puedes ver/editar datos incluso siendo admin.

**Solución:**
1. Verifica que RLS esté correctamente configurado:
```sql
SELECT tablename, policyname
FROM pg_policies
WHERE tablename LIKE 'rfx_%';
```
2. Si falta alguna policy, vuelve a ejecutar el schema completo
3. Temporalmente puedes deshabilitar RLS (NO RECOMENDADO en producción):
```sql
ALTER TABLE rfx_templates DISABLE ROW LEVEL SECURITY;
-- Repite para otras tablas si es necesario
```

---

### Problema: Triggers no funcionan

**Síntoma:** `updated_at` no se actualiza, o base técnica no se invalida.

**Solución:**
1. Verifica que los triggers existan:
```sql
SELECT tgname FROM pg_trigger WHERE tgname LIKE '%rfx%';
```
2. Si no existen, vuelve a ejecutar la sección de triggers del schema
3. Prueba manualmente:
```sql
UPDATE rfx_projects SET admin_parameters = '{}' WHERE id = 'ALGUN_ID';
SELECT technical_base_is_valid FROM rfx_projects WHERE id = 'ALGUN_ID';
-- Debería ser 'false'
```

---

## 📚 RECURSOS ADICIONALES

- **Status Técnico**: Ver `RFX-MAKER-STATUS.md`
- **Guía de Usuario**: Ver `RFX-MAKER-README.md`
- **Schema SQL**: Ver `database/schemas/rfx-maker-schema.sql`
- **Seed Data**: Ver `database/seeds/rfx-maker-seed.sql`
- **Resumen de Sesión**: Ver `RESUMEN-SESION-23-OCT-2025.md`

---

## 🎯 CHECKLIST DE INSTALACIÓN

```
[ ] Paso 1: Schema aplicado en Supabase
[ ] Paso 2: Seed data cargado (opcional)
[ ] Paso 3: Verificación SQL ejecutada exitosamente
[ ] Paso 4: Variables de entorno configuradas
[ ] Paso 5: Servidor reiniciado
[ ] Paso 6: "RFx Maker" visible en sidebar
[ ] Paso 7: Puede crear nuevo proyecto
[ ] Paso 8: IA genera base técnica correctamente
[ ] Paso 9: Invalidación automática funciona
[ ] Paso 10: Puede cambiar estados de proyecto
```

---

## ✅ CONFIRMACIÓN FINAL

Si completaste todos los pasos y el checklist está ✅, deberías poder:

- ✅ Ver "RFx Maker" en el sidebar
- ✅ Listar proyectos existentes
- ✅ Crear nuevos proyectos RFx
- ✅ Generar bases técnicas con IA
- ✅ Ver invalidación automática funcionando
- ✅ Gestionar plantillas (como admin)
- ✅ Configurar políticas (como admin)

---

## 🎉 ¡FELICITACIONES!

**RFx Maker está instalado y funcionando correctamente.**

Ahora puedes:
1. Personalizar las plantillas según tu empresa
2. Ajustar políticas por defecto
3. Crear tus primeros proyectos RFx reales
4. Aprovechar la IA para generar bases técnicas

---

## 📞 SOPORTE

Si tienes problemas durante la instalación:

1. Revisa la sección **Troubleshooting** arriba
2. Verifica los logs del servidor (`npm run dev`)
3. Verifica logs de Supabase (Dashboard → Logs)
4. Consulta la documentación técnica en `RFX-MAKER-STATUS.md`

---

**Última actualización**: 23 de Octubre, 2025
**Versión del módulo**: 1.0.0 (Alpha)

