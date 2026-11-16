# Empresa de demostración — identificación, carga y reconstrucción segura

Empresa: **XPEND Company S.A. (DEMO)** · marca técnica `companies.settings->>'demo_key' = 'xpend-company-demo-v1'` · `settings.demo = true` ·
usuarios Auth con correo `*@xpend-demo.test` (dominio reservado, sin buzón).

Es una empresa **separada** de la empresa real «XPEND COMPANY S.A.» del Super Admin. No se reutilizó ni se sobrescribió ningún registro existente.

## Cómo se identifica (solo lectura)

```sql
-- La empresa demo
select id, name from companies where settings->>'demo_key' = 'xpend-company-demo-v1';

-- Todo lo que pertenece a ella lleva su company_id (ejemplo de conteo)
select 'licitaciones', count(*) from licitaciones where company_id = '<id demo>'
union all select 'sourcing_plans', count(*) from sourcing_plans where company_id = '<id demo>'
union all select 'savings_validations', count(*) from savings_validations where company_id = '<id demo>'
union all select 'si_spend_lines', count(*) from si_spend_lines where company_id = '<id demo>';

-- Usuarios ficticios
select id, email from auth.users where email like '%@xpend-demo.test';

-- Acceso del Super Admin (allowlist) y bitácora de cambios de empresa
select kind, company_id from public.tenant_access;
select * from public.tenant_switch_log order by at desc;
```

## Carga (ya realizada en producción el 16-nov-2026)

- Script: `scripts/demo/seed.mjs` + `dataset.mjs` (datos fijos, semilla pseudoaleatoria determinista).
- Producción solo con las tres condiciones: `DEMO_TARGET=prod`, `DEMO_CONFIRM=escribir-solo-en-xpend-company-demo` y `.demo/prod.env` con la URL del proyecto de producción.
  Las claves están solo en ese archivo (ignorado por Git). `--reset` se rechaza en producción.
- Idempotencia: si la empresa demo ya existe (por nombre o por `demo_key`), el script termina sin tocar nada; si algún correo `@xpend-demo.test` ya existe, aborta.
- Todo se crea con el cliente de servicio solo dentro de la empresa demo, y el recorrido de negocio (invitar, abrir ofertas, evaluar, votar, adjudicar,
  contratar, declarar, validar, reconocer) lo ejecuta `scripts/demo/flow.mjs` **por la interfaz real**, con las cuentas ficticias, para no saltarse validaciones.
- Reanudación: `flow.mjs` guarda marcadores `.demo/flujo-<destino>-<caso>.json` y retoma si un caso quedó a medias.
- Las contraseñas de las cuentas ficticias se generan al azar y se guardan en `.demo/credenciales-demo.<destino>.json` (permisos 600, fuera de Git).
- Verificación posterior: `npm run demo:qa` (inventario, conciliación de montos, aislamiento y denegaciones directas) y `npm run demo:ana`.

## Reconstrucción

### Local (Supabase local, 127.0.0.1)

```
npm run demo:seed -- --reset   # elimina solo la empresa demo, la empresa «QA Local Home S.A.», la demo antigua «Industrias Andinas Demo S.A.» y los usuarios @xpend-demo.test
npm run demo:flow              # casos A, T y B por la interfaz
npm run demo:qa && npm run demo:ana
```

### Producción: no hay reinicio automático

Decisión deliberada: borrar datos en producción no se automatiza. Si fuera necesario reconstruir la demo:

1. Pedir y registrar **confirmación explícita** de la persona responsable, indicando el `company_id` demo exacto.
2. Respaldar (exportación de las tablas de la empresa demo o punto de restauración del proyecto).
3. Verificar por consulta que `id` corresponde a `settings->>'demo_key' = 'xpend-company-demo-v1'` y que no contiene personas reales.
4. Borrar **únicamente** por `company_id = <id demo>` (hijos antes que padres, dentro de una transacción) y los usuarios `@xpend-demo.test`. Las tablas
   de auditoría y de bitácora son de solo adición por diseño (triggers): el borrado de la empresa se hace en la misma sesión privilegiada que ya usa el
   script local, y se deja constancia escrita.
5. Quitar la fila `granted` de `tenant_access` de esa empresa y volver a cargar con `seed.mjs` + `flow.mjs`.

Nunca se debe ejecutar un `delete` sin `company_id` ni sobre la empresa real. Si hay dudas, detenerse.

## Seguridad y aislamiento

- RLS intacta: cada tabla filtra por `private.current_company_id()`. El Super Admin cambia de empresa con `switch_tenant(uuid)`
  (solo hacia empresas de su lista `tenant_access`, con bitácora inmutable); no existe suplantación de identidad.
- Las cuentas ficticias no pueden leer la empresa real (verificado por `demo:qa`, incluidas consultas directas a la API).
- IA externa apagada para la empresa demo (`settings.external_ai = {"enabled": false}`). Importante: el valor debe ser un objeto; un booleano se ignora y la IA queda activa.
- Sin correos reales: la ruta de invitación a salas no envía a dominios `.test`/`.invalid`/`.example`/`.localhost` ni a empresas con `settings.demo = true`.
