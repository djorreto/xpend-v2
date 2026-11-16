# XPEND V3 — registro de release de la V1 comercial

Producción: www.xpend.cl · Supabase `qtncgtqgvilbjhrvzoxe` (sin cambiar de proyecto) · Vercel `xpend-v3`.
Rama de trabajo: `fase-1/flujo-inicial`. Cada etapa es un commit.

## Publicación de las Etapas 2 a 5

- Código: commit `a9f626b` en `main` y `fase-1/flujo-inicial` (origin).
- Vista previa `xpend-v3-37def1kep` y producción `xpend-v3-pkjzr8g01` (alias www.xpend.cl). Rollback inmediato: promover `xpend-v3-ac8edn36l`
  (la versión previa, compatible porque las migraciones son aditivas).
- Rutas públicas verificadas en producción (200): `/`, `/login`, `/dashboard`, `/ahorros`, `/gestion`, `/plan-anual`, `/equipos`.

## Etapas

| Etapa | Contenido | Migración (repo) | Estado |
|---|---|---|---|
| 1 | Seguridad RLS, UX por rol, consulta de solo lectura | `20261116000000`, `etapa1_viewer_read_only` | Publicada (`2e953ab`) |
| 2 | Categorías, Category Manager y suplente, equipos, historial de asignaciones | `20261117000000` + `20261117050000` | Publicada |
| 3 | Plan anual (borrador/comprometido), metas, siete hitos S2C | `20261117100000` | Publicada |
| 4 | Control de ahorros: declarado, validado, realizado, evidencia, auditoría | `20261117200000` | Publicada |
| 5 | Gestión del equipo y «Mi portafolio» | sin migración | Publicada |
| 12 | Demostración reproducible (solo local) | sin migración | Local, documentada en `docs/demo/GUION-DEMO.md` |

## Migraciones aplicadas en Cloud (todas aditivas, sin borrar ni reescribir datos)

Aplicadas con `apply_migration` (una transacción cada una) en este orden: `etapa2_categories_teams` (incluye el vínculo
`rfx_projects.sourcing_plan_id`), `etapa3_annual_plan_milestones`, `etapa4_savings_control`, y un `alter function` que fija
`search_path` en `private.forbid_mutation`.

- 15 tablas nuevas, todas con RLS activa, restrictiva contra proveedores y sin privilegios para `anon`.
- Columnas nuevas nulas: `sourcing_plans.{category_id, backup_user_id, team_id, si_plan_item_id}`, `si_plan_items.category_id`,
  `rfx_projects.sourcing_plan_id`.
- Hallazgo: producción **no tenía** `rfx_projects.sourcing_plan_id` (el baseline local sí). La app ya lo consultaba; ahora existe.
- Las funciones de negocio son `SECURITY DEFINER` con verificación de rol y empresa dentro; ninguna es ejecutable por `anon`.
- Rollback: cada archivo de `supabase/migrations/20261117*` documenta su reversa en la cabecera (solo sirve mientras no haya datos).

## Verificación

- Local: 153 pruebas unitarias y de base de datos, 122/122 verificaciones de UX (Playwright), recorrido 25/25, flujo de demostración 17/17, `tsc` limpio, `next build` correcto.
- Cloud (solo lectura tras migrar): 15/15 tablas con RLS, ninguna concesión a `anon`, columnas usadas por los cargadores presentes.
  Los avisos del asesor de seguridad restantes ya existían (funciones antiguas con `search_path` mutable; `handle_new_user` e `is_super_admin`;
  protección de contraseñas filtradas desactivada).
- **No se pudo** verificar con sesión autenticada en producción (no hay credenciales autorizadas) ni con datos reales.

## Mantenimiento

- Un viewer nunca escribe: lo garantiza la base. `can()` en `src/lib/navigation.ts` espeja las políticas.
- Las pruebas con base local se ejecutan en serie: `npm test`.
- No hay procesos recurrentes nuevos ni servicios de pago. El costo incremental es USD 0 (mismo Supabase y Vercel).

## Limitaciones conocidas

- `category_assignments` no se separa por año.
- Algunas fechas reales derivadas son aproximaciones (RFx listo usa `updated_at`).
- La evidencia de ahorros la sube solo un gerente o administrador; el viewer no ve evidencia ni auditoría.
- Existe la declaración manual (sin comité), marcada «Manual, no pasó por comité».
- No se mide el consumo de modelos de Cursor desde el entorno.
