# Etapa 1 — estado de release

Estado: **sin publicar. Esperando el GO del producto.** No hay migraciones ni tablas nuevas: el frontend corre sobre el
esquema actual de producción (columnas verificadas en solo lectura).

## A. Hotfix de seguridad RLS — ya aplicado

Aplicado en Cloud (`qtncgtqgvilbjhrvzoxe`) e integrado en esta rama (`4c43fd2`). No se vuelve a aplicar.
`supabase/migrations/20261116000000_fase_1_supplier_internal_tables_rls.sql`: función `private.is_internal_profile()` y
22 políticas `AS RESTRICTIVE ... <tabla>_no_supplier`. Respaldo en `docs/hotfix-rls/`. Verificación final de esta etapa:
22 políticas presentes en local y en Cloud; el portal del proveedor (invitaciones, sala, ficha, NDA, ofertas) sigue
funcionando (`src/lib/supplier-rls.test.ts` y el recorrido S2C).

## B. Etapa 1 de UX — ajustes finales

### Definición de cada número de Inicio
Sección **Actividad por tipo de registro**. No es un embudo: cada número cuenta registros de **un** tipo y enlaza a la
lista que lo explica. Una licitación y su sala son registros distintos, por eso no se suman ni miden conversión.

| Número | Qué cuenta | Desglose (suma exactamente el número) | Abre |
|---|---|---|---|
| Iniciativas abiertas {año} | Iniciativas del plan del año, planificadas o en curso, con o sin proceso | sin proceso aún · con proceso | `/sourcing-plan` |
| RFx en curso | Bases en borrador o listas | en borrador · listas | `/procesos?tipo=rfx` |
| Licitaciones en curso | Licitaciones no adjudicadas | en preparación · en revisión de bases · publicadas · en evaluación | `/procesos?tipo=licitacion` |
| Salas de ofertas activas | Salas en borrador, recibiendo ofertas o cerradas por evaluar | en borrador · recibiendo ofertas · por evaluar | `/procesos?tipo=sala` |
| Adjudicaciones registradas | Total histórico de adjudicaciones de la empresa | sin contrato (solo si el rol lee contratos) · decisiones pendientes | `/adjudicaciones` |
| Contratos en preparación | Contratos en borrador o en revisión (no los vigentes) | en borrador · en revisión | `/contratos?vista=pendientes` |

La discrepancia original ("19 iniciativas abiertas" vs "0" en el flujo) era una pregunta distinta con el mismo nombre
("iniciativas sin proceso"). Ahora el desglose lo dice explícitamente. La prueba de Playwright compara cada número con la
lista a la que enlaza para los roles gerente, comprador y consulta.

### Cola de trabajo única (`workQueue` en `src/lib/workspace.ts`)
La usan "Continuar donde quedaste", "Tu trabajo" y Procesos. Cada elemento está en un solo grupo y muestra **Por qué**:
Requiere tu atención ahora · Trabajo pendiente · Borradores para continuar · En curso, sin acción inmediata.
Un RFx en borrador ya no "se puede continuar" sin aparecer en los pendientes.
Los grupos dependen del rol (p. ej. bases en revisión: el gerente las aprueba, el comprador las sigue).

### Procesos simplificado
Se quitaron los botones de tipo y el selector de etapa que repetían las pestañas. Quedan: pestañas (acceso independiente a
RFx, licitaciones y salas), búsqueda, **Estado** (activos, todos o un estado concreto) y "Solo donde soy responsable".
`?tipo=` se muestra como una etiqueta que se puede quitar.

### Claridad visual
Texto secundario con contraste mínimo 4,5:1 y tamaño mínimo 12 px (comprobado con Playwright en Inicio). El informe de
evaluación de la licitación se presenta con secciones (cómo se calculó, ranking, recomendación, fundamentos) a partir del
texto persistido (`src/lib/evaluation-report.ts`); si el formato no se reconoce se muestra el texto tal cual. No cambia
ningún cálculo ni inventa datos.

### Permisos por rol (verificados contra la base local, no solo en la interfaz)
- El perfil de consulta **sí** puede leer adjudicaciones y decisiones por RLS (misma lectura que el administrador);
  por eso Inicio muestra su total y el flujo ya no dice "Sin acceso". Los contratos se ocultan al perfil de consulta por
  decisión de producto, **no** por RLS (la base le permite leerlos). Ver decisión pendiente abajo.
- `src/lib/role-permissions.test.ts`: para admin, gerente, comprador y consulta, toda acción de creación que la interfaz
  ofrece (iniciativa, licitación, sala, RFx, contrato, proveedor) la acepta la base de datos.

### Defectos de RLS ya existentes (no corregidos; requieren autorización antes de tocar Cloud)
Confirmados en local con consultas directas y presentes en Cloud (mismas políticas; hoy solo hay perfiles admin y super_admin, sin exposición real):
1. `rfx_projects`: INSERT/UPDATE solo exigen la empresa → un perfil de consulta puede crear/editar RFx por la API.
2. Tablas de contratos: DELETE no se restringe por rol → un perfil de consulta puede borrar contratos por la API.

Propuesta mínima y reversible (políticas restrictivas adicionales, sin tocar las existentes) en
`docs/etapa1/propuesta-rls-roles.sql`, ensayada en local y revertida. Dos pruebas `todo` en
`role-permissions.test.ts` pasan a verde al aplicarla.

### Validación
Ver el informe final entregado con este commit. Capturas en `docs/etapa1/capturas/` (generadas con `scripts/etapa1-ux.mjs`):
`inicio-{admin,manager,analyst,viewer}-escritorio.png`, `inicio-{manager,analyst,viewer}-movil.png`,
`procesos-escritorio.png`, `procesos-manager-movil.png`, `procesos-busqueda-escritorio.png`,
`informe-evaluacion-escritorio.png`, `menu-{manager,analyst,viewer}-movil.png`, `adjudicaciones-escritorio.png`,
`plan-escritorio.png`, `roles-escritorio.png`, `licitacion-migas-escritorio.png`, `proveedor-escritorio.png`.

## Decisiones pendientes
- ¿El perfil de consulta debe ver Contratos en solo lectura? La base lo permite; hoy la interfaz los oculta.
- ¿Autorizas aplicar `propuesta-rls-roles.sql` en Cloud (después del GO de Etapa 1 o antes)?

## Fuera de alcance (Etapas 2 y 3)
Equipos, metas de ahorro, plan anual completo, calendario de hitos, reconocimiento mensual de ahorros, Desempeño,
página propia de invitaciones, alcance por departamento.
