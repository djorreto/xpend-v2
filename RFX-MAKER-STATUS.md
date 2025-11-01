# RFx MAKER - Estado del Desarrollo

**Fecha**: 23 de Octubre, 2025
**Versión**: 1.0.0 (Alpha)
**Estado General**: 🟡 En Desarrollo Activo (70% completado)

---

## 📋 RESUMEN EJECUTIVO

El módulo **RFx Maker** permite a los equipos de Strategic Sourcing crear automáticamente Bases Administrativas y Bases Técnicas para procesos de licitación (RFP/RFQ/RFI).

### Características Principales:
- ✅ Creación de plantillas administrativas con variables dinámicas
- ✅ Políticas de empresa (valores por defecto)
- ✅ Proyectos RFx con versionado y auditoría
- ✅ Generación automática de Base Técnica con IA (Groq + Llama 3.3)
- ✅ Invalidación automática de base técnica al cambiar parámetros
- ⏳ Sistema de descargas (DOCX/PDF) - Pendiente
- ⏳ Editor WYSIWYG avanzado - Pendiente

---

## ✅ LO QUE ESTÁ HECHO

### 1. Base de Datos (100%)
- [x] **Schema SQL completo** (`database/schemas/rfx-maker-schema.sql`)
  - 8 tablas: templates, variables, policies, projects, versions, downloads, comments, audit_log
  - Triggers automáticos para `updated_at`
  - Trigger de invalidación automática de base técnica
  - Row Level Security (RLS) configurado
  - Índices optimizados
  - Constraint único para plantilla activa por empresa

### 2. Tipos TypeScript (100%)
- [x] **Tipos completos** (`src/types/rfx-maker.ts`)
  - RfxTemplate (plantillas administrativas)
  - RfxTemplateVariable (variables/placeholders)
  - PlaceholderDefinition (alias simplificado)
  - RfxCompanyPolicy (políticas de empresa)
  - RfxProject (proyectos RFx)
  - RfxProjectVersion, RfxProjectDownload, RfxProjectComment, RfxAuditLog
  - ProjectContext, BrandingSettings, ValidationRules

### 3. API Endpoints (50%)
- [x] **POST /api/rfx-maker/generate-technical**
  - Genera base técnica usando la IA existente de XPEND
  - Usa Groq + Llama 3.3 (misma IA que ANA Chat)
  - Prompt contextualizado con parámetros del proyecto
  - Responde con HTML/Markdown generado
- [ ] **POST /api/rfx-maker/download** (Pendiente)
- [ ] **POST /api/rfx-maker/duplicate** (Pendiente)

### 4. Servicios y Helpers (80%)
- [x] **rfx-maker-service.ts** (`src/lib/rfx-maker-service.ts`)
  - `replacePlaceholders()` - Reemplaza {{variables}} con valores
  - `validatePlaceholders()` - Valida campos requeridos
  - `getActiveTemplate()` - Obtiene plantilla activa
  - `getActivePolicy()` - Obtiene política activa
  - `createRfxProject()` - Crea nuevo proyecto
  - `updateProjectAdminParameters()` - Actualiza parámetros (con invalidación)
  - `generateAdminBase()` - Genera base administrativa renderizada
  - `getRfxStats()` - Estadísticas del módulo
  - `duplicateProject()` - Duplica un proyecto existente

### 5. Páginas y UI (70%)

#### ✅ Página Principal
- [x] **`/rfx-maker`** (`src/app/rfx-maker/page.tsx`)
  - Listado de proyectos RFx
  - Filtros por estado (draft, ready, closed, archived)
  - Cards de estadísticas (Total, Borradores, Listos, Cerrados)
  - Botón "Nuevo Proyecto"
  - Link a gestión de plantillas (solo admin)
  - Link a políticas de empresa (solo admin)

#### ✅ Crear Proyecto
- [x] **`/rfx-maker/new`** (`src/app/rfx-maker/new/page.tsx`)
  - Formulario de creación de proyecto
  - Selección de tipo (RFP/RFQ/RFI)
  - Selección de plantilla administrativa
  - Campos de contexto para IA (industria, presupuesto, plazo)
  - Validaciones y manejo de errores
  - Redirección automática al proyecto creado

#### ✅ Vista/Edición de Proyecto
- [x] **`/rfx-maker/[id]`** (`src/app/rfx-maker/[id]/page.tsx`)
  - Header con código de proyecto, tipo, estado
  - Badges de estado visual
  - Tabs: Base Administrativa, Base Técnica (IA), Contexto
  - Banner de invalidación (si parámetros cambiaron)
  - Botón "Generar Base Técnica" con IA
  - Botón "Regenerar" si base técnica existe
  - Transiciones de estado (draft→ready→closed)
  - Botón "Guardar" para cambios pendientes
  - Preview de base técnica generada

#### ✅ Administración de Plantillas (Solo Admin)
- [x] **`/rfx-maker/templates`** (`src/app/rfx-maker/templates/page.tsx`)
  - Listado de plantillas administrativas
  - Badge "Activa" para plantilla en uso
  - Botón "Activar" para cambiar plantilla activa
  - Botones: Editar, Duplicar, Eliminar
  - Protección de acceso (solo admin/super_admin)
  - Card informativa sobre plantillas

#### ✅ Editor de Plantillas
- [x] **`/rfx-maker/templates/[id]`** (`src/app/rfx-maker/templates/[id]/page.tsx`)
  - Formulario de información general (nombre, descripción, estado)
  - Textarea grande para estructura de plantilla (con {{variables}})
  - Gestión de placeholders/variables:
    - Agregar/eliminar variables
    - Configurar: field_key, label, tipo, valor por defecto
    - Agrupar variables (para mejor UX)
    - Definir quién puede editar (admin/user)
    - Texto de ayuda para cada variable
  - Tipos soportados: text, number, date, enum, bool
  - Validaciones y guías visuales

#### ✅ Políticas de Empresa (Solo Admin)
- [x] **`/rfx-maker/policies`** (`src/app/rfx-maker/policies/page.tsx`)
  - Formulario de valores por defecto basado en plantilla activa
  - Agrupación de campos por categoría
  - Inputs específicos según tipo de campo
  - Info card sobre impacto de cambios
  - Carga automática desde plantilla activa
  - Creación automática si no existe política

### 6. Navegación (100%)
- [x] **Integración en Sidebar**
  - Nuevo ítem "RFx Maker" con ícono `FilePenLine`
  - Visible para todos los usuarios
  - Posicionado después de Sourcing Plan

---

## ⏳ LO QUE FALTA (30% restante)

### 1. Sistema de Descargas (0%)
- [ ] API endpoint `/api/rfx-maker/download`
- [ ] Generación de DOCX (base administrativa)
- [ ] Generación de DOCX (base técnica)
- [ ] Generación de PDF (ambas bases)
- [ ] Generación de ZIP (paquete completo)
- [ ] Librería: `docx` para generación de DOCX
- [ ] Librería: `puppeteer` o `jsPDF` para PDF
- [ ] Registro de descargas en `rfx_project_downloads`

### 2. Editor WYSIWYG Avanzado (0%)
- [ ] Integración de TipTap o similar
- [ ] Toolbar de formato (bold, italic, lists, headers)
- [ ] Inserción de variables con selector visual
- [ ] Preview en tiempo real
- [ ] Drag & drop para reordenar secciones
- [ ] Templates pre-diseñados

### 3. Editor de Parámetros en Proyecto (30%)
- [ ] Formulario dinámico basado en placeholders
- [ ] Validaciones según tipo de campo
- [ ] Agrupación visual por categoría
- [ ] Auto-guardado mientras se edita
- [ ] Indicador de cambios no guardados

### 4. Versionado de Proyectos (0%)
- [ ] Crear nueva versión de proyecto
- [ ] Historial de versiones
- [ ] Comparación entre versiones
- [ ] Restaurar versión anterior
- [ ] Tabla `rfx_project_versions` poblada

### 5. Sistema de Comentarios (0%)
- [ ] Agregar comentarios a proyectos
- [ ] Comentarios por sección (admin/técnica/general)
- [ ] Notificaciones de nuevos comentarios
- [ ] Tabla `rfx_project_comments` poblada

### 6. Auditoría Detallada (0%)
- [ ] Registro automático de acciones
- [ ] Vista de audit log por proyecto
- [ ] Filtros de auditoría (por usuario, fecha, acción)
- [ ] Tabla `rfx_audit_log` poblada

### 7. Mejoras de UX (20%)
- [ ] Loading skeletons en lugar de spinners
- [ ] Confirmaciones antes de acciones destructivas
- [ ] Tooltips explicativos en campos complejos
- [ ] Atajos de teclado (Ctrl+S para guardar)
- [ ] Breadcrumbs de navegación
- [ ] Filtros avanzados en listado de proyectos
- [ ] Búsqueda por título/código

### 8. Permisos Granulares (0%)
- [ ] Permisos por rol (viewer, contributor, admin)
- [ ] Control de quién puede editar qué campos
- [ ] Restricción de estados según rol
- [ ] Auditoría de permisos

---

## 🏗️ ARQUITECTURA DEL SISTEMA

### Flujo Principal:

```
1. ADMIN crea Plantilla Administrativa
   ├─ Define estructura con {{variables}}
   ├─ Define placeholders (currency, deadline, etc.)
   └─ Marca como "Activa"

2. ADMIN configura Política de Empresa
   ├─ Carga automáticamente placeholders de plantilla activa
   ├─ Define valores por defecto (CLP, 10%, etc.)
   └─ Guarda política

3. USER crea Nuevo Proyecto RFx
   ├─ Selecciona tipo (RFP/RFQ/RFI)
   ├─ Ingresa título y contexto
   ├─ Sistema carga plantilla activa + política
   └─ Proyecto en estado "draft"

4. USER edita Parámetros Administrativos
   ├─ Puede cambiar valores por defecto
   ├─ Si cambia parámetros → base técnica se INVALIDA
   └─ Guarda cambios

5. USER genera Base Técnica con IA
   ├─ Click en "Generar Base Técnica"
   ├─ API llama a /api/rfx-maker/generate-technical
   ├─ IA (Groq + Llama 3.3) genera contenido contextualizado
   ├─ Base técnica se guarda en proyecto
   └─ Proyecto marcado como "válido"

6. USER marca Proyecto como "Listo"
   ├─ Validación: debe tener base técnica válida
   ├─ Estado cambia a "ready"
   └─ Listo para descargar (cuando esté disponible)

7. USER descarga Documentos (Pendiente)
   ├─ Descarga DOCX/PDF de base administrativa
   ├─ Descarga DOCX/PDF de base técnica
   └─ Registro en tabla de descargas
```

### Invalidación Automática:

```
Trigger SQL: invalidate_technical_base
├─ Se activa al UPDATE de rfx_projects
├─ Detecta si admin_parameters cambió
├─ Si cambió:
   ├─ technical_base_is_valid = false
   ├─ admin_parameters_last_modified = NOW()
   └─ UI muestra banner de "Base Técnica Invalidada"
```

---

## 🔧 TECNOLOGÍAS UTILIZADAS

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Base de Datos**: PostgreSQL (Supabase)
- **IA**: Groq Cloud + Llama 3.3 70B (vía @ai-sdk/openai)
- **Autenticación**: Supabase Auth
- **Storage**: Supabase Storage (para futuras descargas)
- **Librerías UI**: Radix UI, Lucide Icons

---

## 📊 MÉTRICAS DE CÓDIGO

- **Archivos creados**: 12+
- **Líneas de código**: ~3,500+
- **Tablas de BD**: 8
- **Endpoints API**: 1 (+ 2 pendientes)
- **Páginas**: 6
- **Tipos TypeScript**: 20+
- **Funciones de servicio**: 9

---

## 🚀 PRÓXIMOS PASOS RECOMENDADOS

### Prioridad ALTA:
1. ✅ Implementar sistema de descargas (DOCX/PDF)
2. ✅ Editor de parámetros dinámico en vista de proyecto
3. ✅ Validaciones completas de formularios

### Prioridad MEDIA:
4. ✅ Versionado de proyectos
5. ✅ Sistema de comentarios
6. ✅ Editor WYSIWYG avanzado

### Prioridad BAJA:
7. ✅ Mejoras de UX y polish
8. ✅ Permisos granulares
9. ✅ Filtros y búsqueda avanzada

---

## 🧪 TESTING

### Estado Actual:
- ❌ Sin tests unitarios
- ❌ Sin tests de integración
- ❌ Sin tests E2E

### Tests Recomendados:
- Unit tests para `rfx-maker-service.ts`
- Integration tests para API endpoints
- E2E tests para flujo completo (crear plantilla → crear proyecto → generar base técnica)

---

## 📝 NOTAS TÉCNICAS

### Consideraciones de Performance:
- Las plantillas se cachean en el cliente
- Las políticas se cargan solo cuando cambia la plantilla activa
- La generación de base técnica es asíncrona (no bloquea UI)
- Índices de BD optimizados para queries frecuentes

### Consideraciones de Seguridad:
- RLS habilitado en todas las tablas
- Solo admins pueden crear/editar plantillas
- Solo admins pueden modificar políticas
- Los usuarios solo ven proyectos de su empresa
- Validación de roles en frontend y backend

### Consideraciones de Escalabilidad:
- Sistema de versionado permite historial completo
- Audit log para compliance
- Estructura modular permite agregar nuevos tipos de RFx
- Placeholders extensibles (se pueden agregar nuevos tipos)

---

## 🐛 BUGS CONOCIDOS

- Ninguno reportado por ahora (módulo nuevo)

---

## 📚 DOCUMENTACIÓN

### Para Desarrolladores:
- Ver schema SQL completo: `database/schemas/rfx-maker-schema.sql`
- Ver tipos TypeScript: `src/types/rfx-maker.ts`
- Ver servicios: `src/lib/rfx-maker-service.ts`

### Para Usuarios:
- Documentación de usuario: Pendiente
- Video tutoriales: Pendiente
- FAQ: Pendiente

---

## 👥 EQUIPO

- **Desarrollador Principal**: Claude (Cursor AI Assistant)
- **Product Owner**: Diego Jorreto
- **Fecha de Inicio**: 23 de Octubre, 2025
- **Tiempo de Desarrollo**: ~6 horas

---

## 📞 SOPORTE

Para consultas sobre este módulo:
- GitHub Issues: Pendiente
- Email: Pendiente
- Slack: Pendiente

---

**Última actualización**: 23 de Octubre, 2025 - 19:30 CLT

