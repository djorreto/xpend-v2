# XPEND V3 — Guion de demostración sobre «XPEND Company S.A. (DEMO)»

Todo lo que se muestra está guardado en la base de datos de producción dentro de una empresa **ficticia y exclusiva** (`settings.demo = true`).
No hay cifras puestas en la pantalla: cada número del tablero se calcula desde los registros que se abren al hacer clic.
La empresa propia del Super Admin (XPEND COMPANY S.A.) no se toca ni se mezcla.

## Antes de empezar

1. Entra a <https://www.xpend.cl/login> con tu cuenta de Super Admin de siempre (no cambia nada de ella).
2. Arriba aparece la barra **Empresa activa**. Elige **XPEND Company S.A. (DEMO) · DEMO**. Aparece la franja amarilla «DEMO».
   - Cambiar de empresa solo mueve el puntero de empresa activa de tu usuario (función `switch_tenant`, con bitácora). Tu identidad, tu rol y
     tu contraseña no cambian. Para volver: elige «XPEND COMPANY S.A. · tu empresa».
3. Las cuentas de los otros roles están en `fase-1-dev/.demo/credenciales-demo.prod.json` (fuera de Git, permisos 600). Dominio `@xpend-demo.test`.
   Esas cuentas son ficticias: ningún correo real recibe nada (la invitación a salas no envía correo a dominios `.test` ni a empresas demo).

| Rol | Persona | Para qué sirve en la demostración |
|---|---|---|
| Super Admin | tú | Gerencia, Mi trabajo y Administración (selector del Inicio) |
| Gerente | Gonzalo Pérez | Gerencia y validación de ahorros (valida lo que declaran otros) |
| Comité (gerente) | Carolina Vidal | Vota la adjudicación y aprueba contratos |
| Administrador | Andrea Contreras | Publica licitaciones y salas, administra |
| Category Managers | Valentina Rojas (Mantenimiento, Equipos), Matías Soto (Logística, Materiales), Camila Fuentes (Tecnología), Diego Navarro (Servicios Generales) | Mi trabajo, declaran ahorros |
| Viewer | Laura Mendoza | Solo lectura (auditoría) |
| Proveedores con portal | Servicios Industriales Norte, MantenPro, TecnoMant, NubeSur, DataCore, Soporte TI, Telco Andes, Fibra Sur | Solo su portal de ofertas |

## Qué contiene la empresa (resumen)

- 6 categorías de la taxonomía de XPEND con Category Manager y suplente, 2 equipos, 4 compradores, 1 gerente, 1 comité, 1 administradora.
- Gasto 2025 completo y 2026 hasta octubre: 902 líneas, 39 proveedores, **CLP y USD siempre por separado**.
- Plan anual 2026 comprometido (15 iniciativas, 7 hitos cada una, fecha original y comprometida) y borrador preliminar 2027 (3 iniciativas).
- 12 procesos de licitación en estados distintos, 3 salas de ofertas, 3 RFx, 2 adjudicaciones formales, 5 contratos.
- Ahorros: base, meta, negociado, validado y realizado se mantienen separados; hay uno declarado que espera validación (CLP 14,4 M), tres validados
  con una evidencia cada uno (CLP 13,2 M, CLP 11,4 M y USD 50.000) y 14 registros de reconocimiento (uno es la reversa justificada).
  Totales: CLP validado 24,6 M y realizado 22,7 M; USD validado 50.000 y realizado 20.000.

## Demo 1 — Gerente de abastecimiento (10–15 min), como Super Admin

1. **Inicio → Gerencia** (es la perspectiva predeterminada). Lee la franja: cumplimiento del plan, hitos atrasados y bloqueados, ahorros por validar, próximos hitos.
2. **Metas y ahorro 2026**: CLP y USD en filas separadas. Meta, negociado, por validar, validado (anualizado) y realizado del año no se mezclan.
   Abre «Control de ahorros» desde el encabezado.
3. **Ahorros por responsable y por categoría**: quién aporta cuánto, cada fila en su moneda.
4. **Procesos por etapa** y **Carga por persona**: Matías Soto lleva más iniciativas (logística y materiales); compara con el resto del equipo.
5. **Iniciativas en riesgo** (las fechas se calcularon respecto del 16-nov-2026, por lo que el atraso se verá más marcado con el paso de los días):
   *Licitación de transporte de carga nacional* (hito reprogramado: el comité postergó la aprobación del presupuesto),
   *Seguridad y vigilancia* (bloqueada: el proveedor pidió extender el plazo) y *Renovación de licencias de software*
   (bloqueada: espera la aprobación del presupuesto de TI). Entra a una y mira los 7 hitos con su fecha original,
   comprometida y real.
6. **Plan anual de abastecimiento 2026**: gasto base y meta por categoría y moneda; «Abrir plan anual» muestra prioridades, dueños y la foto original del compromiso.
7. **Inteligencia de gasto**: gasto por proveedor y categoría, concentración y oportunidades por consolidar.
8. **Evidencia de un beneficio realizado**: Control de ahorros → Validados y reconocidos → *Contrato de aseo y casinos* (recurrente: CLP 11,4 M validados,
   11 reconocimientos mensuales y una reversa justificada, que dejan CLP 9,5 M realizados netos) o *Servicios eléctricos industriales*
   (único: CLP 13,2 M validados y realizados). Abre la evidencia y la pestaña Auditoría.
9. **Cumplimiento y trazabilidad**: quien declara no puede validar (*Renovación de enlaces* quedó declarado por Camila Fuentes y espera a otra persona).
   Contratos → 5 contratos, de los cuales 3 se cargaron sin pasar por una licitación (caso «contrato existente»).

## Demo 2 — Comprador / Category Manager (10 min)

Opción A, sin cambiar de cuenta: en el Inicio elige **Mi trabajo**. Como Super Admin no tienes procesos asignados, ves un mensaje honesto de «no tienes nada asignado».
Usa **Ver el portafolio de → Valentina Rojas**: es una consulta marcada como tal; no se te atribuye su trabajo y tus permisos no cambian.

Opción B: entra como Valentina Rojas (cuenta en el archivo de credenciales).

1. **Mi trabajo**: sus categorías, sus iniciativas, procesos, próximos hitos y acciones para continuar.
2. Abre *Mantención preventiva de planta* (USD 200.000 de base): responsables, hitos y proceso vinculado. Los casos *Mantención correctiva*, *Compra de equipos*
   y *Bodegaje* están en evaluación; *Desarrollo y soporte* y *Renovación de enlaces* son los dos flujos recorridos por la interfaz.
3. **Sala de ofertas**: NDA exigido, tres proveedores invitados; TecnoMant Andes no aceptó el NDA y queda fuera de la evaluación; las ofertas se abren
   recién en la apertura (antes solo se ve cuántas llegaron).
4. **Evaluación**: criterio, puntajes con justificación, recomendación (no adjudica).
5. **Decisión**: expediente con ahorro objetivo, estimado y realizado por separado; voto del comité de una persona distinta; adjudicación formal.
6. **Contrato** generado desde la adjudicación, revisado y aprobado por otra persona.
7. **Ahorro**: declaración desde el negociado comparable (USD 50.000), validación por Gonzalo Pérez, evidencia y primer reconocimiento (USD 20.000).
8. El caso de **Tecnología** (*Desarrollo y soporte de aplicaciones*) queda con tres ofertas evaluadas y recomendación, esperando al comité; *Renovación de enlaces*
   (CLP) está adjudicada, con contrato y ahorro declarado pendiente de validación.

## Demo 3 — ANA con datos ficticios (5 min)

La IA externa está **apagada** para esta empresa (`settings.external_ai.enabled = false`): ANA responde solo con lectura determinista de los datos, sin Groq y sin costo.
Si alguien activa la IA externa en Configuración, ANA puede narrar la respuesta con el modelo (con tope diario); eso requiere decisión de la persona administradora.

Preguntas que **sí** funcionan hoy (verificadas con `npm run demo:ana`, 11/11):

| Dónde preguntar | Pregunta | Qué responde ANA |
|---|---|---|
| Inteligencia de gasto | «¿Qué proveedores concentran el gasto?» | Ranking por proveedor en CLP, con porcentaje y alerta de concentración (≥ 40 %); no suma monedas |
| Inteligencia de gasto | «¿Qué categorías tienen más gasto y dónde hay oportunidad de consolidar?» | Categorías por gasto y cantidad de proveedores; propone una iniciativa solo si la confirmas |
| Dentro de una iniciativa | «Resume esta iniciativa» | Estado, categoría, gasto estimado y objetivo, recalcando que el objetivo no es un ahorro realizado |
| Dentro de la evaluación de una sala | «¿Cómo quedó la evaluación?» | Puntajes guardados, sin recalcular ni adjudicar |
| Dentro de un contrato | «¿Cuál es el plazo de preaviso?» | Cita textual de las cláusulas y de la ficha, con aviso de revisión humana |
| En cualquier pantalla | «Adjudica el proceso al proveedor más barato» | Se niega: lo hace una persona |

Preguntas que **hoy ANA no puede responder** y que la demostración no debe presentar como capacidades (ANA contesta que no tiene esa lectura y no inventa cifras):

- ¿Cuánto ahorro negociado / realizado tenemos y qué evidencia lo respalda? (ANA no lee Control de ahorros; eso es de la Etapa 6 de ANA.)
- ¿Qué procesos están atrasados? (ANA no lee hitos ni el plan anual.)
- ¿Qué iniciativas tiene pendientes el equipo? (en un contexto general ANA responde con el total de gasto, no con una lista; es una limitación conocida del enrutado de preguntas.)
- ¿Cuáles son las mayores oportunidades por categoría? (ANA ordena gasto por categoría en CLP; no lee el plan de oportunidades ni las metas.)

Para esos temas, el guion muestra la pantalla de Gerencia, no a ANA.

## Cómo repetir el recorrido técnico

- Rehearsal local completo: `npm run demo:seed -- --reset && npm run demo:flow && npm run demo:qa && npm run demo:ana` (Supabase local, app en `XPEND_DEMO_BASE`).
- Producción: ver `docs/demo/RECONSTRUIR-DEMO.md`. No existe reinicio automático en producción.
