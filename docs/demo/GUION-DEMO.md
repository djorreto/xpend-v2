# Demostración comercial XPEND V1 (10–15 minutos)

La demostración corre **solo en local** sobre una empresa ficticia, «Industrias Andinas Demo S.A.». No toca producción ni
usa datos reales ni de QA.

## 1. Preparar (una vez, ~3 minutos)

```bash
export PATH="$HOME/.local/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"
supabase start                              # Supabase local (Docker/Colima)
cd fase-1-dev
npm run demo:seed -- --reset                # empresa, usuarios, gasto, categorías, equipos, plan anual, iniciativas, hitos
rm -rf .next && npx next build && npx next start -p 3027
```

- Las credenciales se generan al azar en cada siembra y quedan en `.demo/credenciales-demo.local.json` (ignorado por git).
  Abre ese archivo para ver correo y contraseña de cada persona. No se escriben en ningún documento.
- Reproducibilidad: `npm run demo:seed -- --reset` deja siempre el mismo escenario. Para comprobarlo:
  `npm run demo:flow` (17 verificaciones del recorrido por la interfaz) y `npm run demo:tour` (25 verificaciones de las vistas).
  Ambos usan Playwright contra `http://localhost:3027`. Después de `demo:flow` conviene volver a sembrar con `--reset`.

## 2. Personas y roles

| Rol | Persona | Qué muestra |
|---|---|---|
| Administradora | Andrea Contreras | Configuración, equipos, plan anual |
| Gerente de Abastecimiento | Gonzalo Pérez | Gestión, validación de ahorros, hitos |
| Gerente de Finanzas (comité) | Carolina Vidal | Segunda firma: valida lo que otro declara |
| Compradora / Comprador | Valentina Rojas / Matías Soto | Mi portafolio, declaración de ahorro |
| Auditoría (solo lectura) | Laura Mendoza | Ve cifras, no escribe ni ve evidencia |
| Proveedores | Servicios Industriales Norte, MantenPro Chile, TecnoMant Andes | Portal del proveedor y sala de ofertas |

## 3. Guion

1. **Inicio** (Gonzalo, 1 min). «Mi portafolio»: categorías e iniciativas a su cargo; los números enlazan a la lista que los explica.
2. **Plan anual** `/plan-anual` (Andrea, 2 min). Metas por categoría, año y moneda, **comprometido** con foto del original.
   Un cambio posterior exige motivo y queda en el historial. Las monedas nunca se mezclan.
3. **Equipos y categorías** `/equipos` (2 min). Category Manager y suplente son asignaciones, no roles nuevos; reasignar pide motivo.
4. **Iniciativa y siete hitos** `/sourcing-plan` (2 min). Fecha original inmutable, comprometida (reprogramar exige causa y
   motivo), real (derivada del sistema o manual) y bloqueos con causa.
5. **Del proceso a la adjudicación** (3 min, Valentina → Carolina). Sala de ofertas con los proveedores, evaluación,
   adjudicación del comité y contrato desde una plantilla aprobada.
6. **Ahorros** `/ahorros` (2 min). Cinco conceptos separados: línea base, objetivo, negociado, validado, realizado.
   Valentina **declara**; Gonzalo **valida** (quien declara no valida: lo exige la base). El realizado son reconocimientos
   mensuales con evidencia; una corrección es una reversa, nunca una edición.
7. **Gestión** `/gestion` (2 min). Cumplimiento, atrasados, bloqueados, sin responsable, matriz por etapa, carga por persona,
   huecos de datos y ahorros por validar. Lo no medido se muestra como «Sin información», no como cero.
8. **Consulta** (Laura, 1 min). Mismas cifras, sin botones de escritura ni evidencia ni auditoría.

## 4. Cifras esperadas (siembra limpia)

| Moneda | Meta | Negociado | Validado | Realizado |
|---|---|---|---|---|
| CLP | 158.400.000 | 12.000.000 | 11.400.000 | 3.800.000 |
| USD | 36.000 | 50.000 | 50.000 | 20.000 |

Después de `demo:flow` el ahorro del flujo en vivo se suma a la categoría correspondiente y la iniciativa de Mantención pasa a
«completada» (sale de la matriz de etapas): es el comportamiento esperado.

## 5. Limitaciones conocidas

- La demostración no se publica ni se copia a producción.
- La evidencia solo la sube un gerente o administrador. Groq/ANA en vivo están topados y no forman parte del guion.
- Algunas fechas reales derivadas del sistema son aproximaciones (por ejemplo, RFx listo usa la fecha de última actualización).
