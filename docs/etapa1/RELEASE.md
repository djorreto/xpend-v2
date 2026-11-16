# Etapa 1 — preparación de release

Estado: **sin publicar**. Dos piezas independientes con decisiones distintas.

## A. Hotfix de seguridad (publicable de forma aislada)

**Hallazgo.** Los perfiles de proveedor tienen `company_id` de la empresa compradora que los invitó. Las políticas
`*_select_company` / `*_insert_company` / `*_update_company` solo comparan `company_id`, por lo que un proveedor podía
leer y escribir datos internos del comprador.

**Evidencia (local, PostgREST con credenciales reales de proveedor, antes de la migración):**
`rfx_projects`=29 filas leídas (el comprador ve las mismas 29), `si_plan_items`, `si_procurement_plans`, `si_uploads`
y `rfx_templates` legibles. Después de la migración: 0 filas en todas, y insertar/editar/borrar devuelve error o 0 filas.

**Corrección.** `supabase/migrations/20261116000000_fase_1_supplier_internal_tables_rls.sql`
- Función `private.is_internal_profile()` (perfil con `supplier_id` nulo y rol distinto de `supplier`).
- Una política `AS RESTRICTIVE ... FOR ALL` por tabla (`<tabla>_no_supplier`) en 21 tablas internas:
  `rfx_projects`, `rfx_project_comments`, `rfx_project_downloads`, `rfx_project_versions`, `rfx_audit_log`,
  `rfx_templates`, `rfx_template_variables`, `rfx_company_policies`, `si_plan_items`, `si_procurement_plans`,
  `si_uploads`, `si_spend_lines`, `si_spend_groups`, `si_spend_decisions`, `si_categories`, `si_learning_rules`,
  `spend_data`, `spend_closures`, `reports`, `report_templates`, `service_invoices`.
- Aditiva: no modifica ni borra políticas existentes, no toca datos, no amplía ningún privilegio. Idempotente.
  Omite con aviso las tablas que no existan en el entorno.
- Sin vistas ni funciones `SECURITY DEFINER` que expongan esas tablas (verificado). El almacenamiento (`storage.objects`)
  ya excluía a proveedores.

**Rollback.** `drop policy if exists <tabla>_no_supplier on public.<tabla>;` por cada tabla (ensayado en transacción local).

**Pruebas.** `src/lib/supplier-rls.test.ts` (consultas directas a Supabase/PostgREST): proveedor sin lectura ni escritura,
incluida incrustación y filtros directos; comprador, gerente y consulta conservan acceso; otra empresa no ve nada;
el portal del proveedor (invitaciones, sala, ficha, NDA, ofertas) sigue funcionando. Más el recorrido S2C completo.

**Antes de publicar en producción (no hecho):** (1) autorización expresa para aplicar la migración en Cloud;
(2) consulta de solo lectura en producción para confirmar la exposición real:
`select count(*) from profiles where (supplier_id is not null or role = 'supplier') and company_id is not null;`
(si es 0 no hay exposición hoy, pero la migración sigue siendo un cinturón de seguridad); (3) revisar que no existan
otras rutas de proveedor en producción que lean estas tablas (en el código local no hay ninguna).

**Hallazgo adicional no corregido:** `licitacion_documents` tiene una política de lectura por empresa sin exclusión de
proveedores (tabla vacía localmente y sin uso en el código). Queda fuera de este alcance; conviene incluirla en una revisión posterior.

## B. Etapa 1 de UX (requiere aprobación visual)

Navegación en seis secciones, Inicio por rol, Procesos unificados, Adjudicaciones, Oportunidades, Roles y permisos,
migas de pan, y los ajustes de cierre: selector de empresa del proveedor (muestra su razón social y "Invitado por ...",
sin selección de empresas) y acciones de escritura ocultas según capacidad en licitación, sala, proveedor e iniciativa.
La validación real sigue en servidor y RLS.

Capturas en `docs/etapa1/capturas/` (generadas con `scripts/etapa1-ux.mjs`, local):
`inicio-{admin,manager,analyst,viewer}-escritorio.png`, `inicio-{manager,analyst,viewer}-movil.png`,
`procesos-escritorio.png`, `procesos-manager-movil.png`, `menu-{manager,analyst,viewer}-movil.png`,
`adjudicaciones-escritorio.png`, `plan-escritorio.png`, `roles-escritorio.png`, `licitacion-migas-escritorio.png`,
`proveedor-escritorio.png`.

## Fuera de alcance (Etapas 2 y 3)

Equipos, metas de ahorro, plan anual completo, calendario de hitos, reconocimiento mensual de ahorros, Desempeño,
página propia de invitaciones, alcance por departamento.
