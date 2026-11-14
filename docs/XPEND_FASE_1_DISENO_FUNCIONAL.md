# XPEND — Diseño funcional de Fase 1

Fecha: 14 de noviembre de 2026. Parte del commit `238f3d6`. Rama `fase-1/flujo-inicial`.

Fase 1 termina cuando un comprador puede recorrer una oportunidad hasta una adjudicación con ahorro consistente y, además, analizar, redactar o generar un contrato con revisión humana. No termina en la adjudicación sola. No incluye firma electrónica, compras spot ni P2P.

Costo incremental de esta etapa: USD 0. Todo se probó en Supabase local. ANA y la extracción de contratos usan el Groq que ya existe; no se enciende un servicio nuevo ni una llamada sin tope.

## Decisiones ya tomadas en el código

- Las observaciones de una iniciativa viven en `sourcing_plans.notes`. `description` sigue siendo el alcance.
- La categoría escrita por el usuario vive en `licitaciones.category_label`. El enum `category` es el tipo de proceso (`recurring_service`, `non_recurring_service`, `improvement_project`, `construction_project`) y puede quedar vacío.
- Si el monto nace del gasto estimado de la iniciativa, `baseline_source` queda en `budget`. El origen del proceso es la fila de `sourcing_plan_licitaciones`, no esa fuente.
- Un RFx ligado guarda `rfx_projects.sourcing_plan_id`. Sin iniciativa, esa columna queda nula y el RFx sigue siendo usable solo.
- `technical_base_is_valid` es verdadero solo si el objeto, el alcance, los requisitos y el criterio de evaluación tienen texto distinto de “Por completar”. El estado `ready` usa la misma regla.

## Reglas comunes

- Cada registro lleva `company_id`. Un proveedor solo ve su invitación, su oferta y sus documentos.
- Los roles que escriben siguen la matriz de Fase 0. `super_admin` entra por `private.is_platform_admin()`, no por una fila de `role_permissions`.
- ANA propone texto o una extracción. No cambia un estado de publicación, adjudicación o contrato.
- Un error de base se muestra con su mensaje, traducido cuando el código es conocido. No se usa “Error desconocido” para un objeto `{ message }`.
- Anular no borra el expediente. El estado pasa a cancelado o archivado y queda la fecha y el actor.
- Los módulos se abren sin configurar el resto. El vínculo aparece cuando el registro de origen existe.

## 1. Spend y Sourcing Intelligence

**Problema.** El gasto está en planillas y no dice qué conviene licitar.

**Valor solo.** Subir un archivo, ver el gasto por categoría y moneda, y marcar una oportunidad. No exige plan ni licitación.

**Usuarios.** Analista carga y clasifica. Manager confirma país, impuesto y moneda. Admin ve toda la empresa. Proveedor no entra.

**Flujo.** Archivo → `si_uploads` y `si_spend_lines` → revisión humana → grupo `si_spend_groups` → oportunidad. Si el usuario quiere, el grupo crea una iniciativa. Si no, el análisis queda solo.

**Datos.** Línea: fecha, proveedor, categoría, monto, moneda, neto. No se suman monedas distintas. La clasificación automática queda en `si_ai_calls` con tope y se puede corregir a mano.

**Estados.** Carga recibida, clasificación propuesta, decisiones confirmadas, oportunidad abierta.

**Hoy.** La carga, el grupo y el paso a iniciativa existen. La clasificación depende de Groq. Este incremento no se construye todavía: el flujo inicial ya puede nacer de una iniciativa escrita, sin archivo.

**Aceptación.** Una carga de prueba en USD no se mezcla con CLP. Corregir una categoría persiste. Sin Groq, la carga manual sigue guardando.

## 2. Sourcing Plan

**Problema.** La oportunidad no tiene dueño, meta ni trimestre.

**Valor solo.** Crear una iniciativa con gasto, moneda, ahorro esperado y observaciones, aunque no exista un archivo de gasto.

**Flujo.** Alta → ficha → edición → vínculo opcional a RFx, licitación y sala. Cancelar deja la fila en `cancelled`.

**Datos.** `sourcing_plans`: título, descripción, `category` texto, `notes`, año, trimestre, `estimated_spend`, moneda, ahorro proyectado, responsable, estado. Fechas de inicio y fin existen en la tabla y todavía no están en el formulario.

**Estados.** `planned`, `in_progress`, `completed`, `cancelled`.

**Regla.** El responsable del alta es quien crea. Cambiarlo es una edición, no un segundo registro.

**Hoy.** Corregido y probado en la interfaz: “Mantenimiento industrial Fase 1B”, USD 150.000, ahorro USD 12.000, notas creadas y luego editadas.

**Aceptación.** El botón Crear iniciativa inserta la fila al primer intento, incluidas las notas. La ficha y la edición muestran el mismo texto.

## 3. RFx Maker

**Problema.** Las bases no deben empezar en un archivo suelto ni declararse listas vacías.

**Valor solo.** Un RFx sin iniciativa. Con iniciativa, hereda título, monto y `sourcing_plan_id`.

**Flujo.** Elegir RFP, RFQ o RFI → borrador `draft` → completar objeto, alcance, requisitos y criterio → recién entonces `ready`. ANA puede proponer secciones. El usuario corrige y guarda. Cerrar o archivar no borra el texto.

**Publicación.** Marcar listo exige esas cuatro secciones con texto real. Un esqueleto “Por completar” permanece en borrador aunque tenga más de 80 caracteres.

**Datos.** `rfx_projects`, `admin_parameters`, `technical_base_content`, `technical_base_is_valid`, `sourcing_plan_id`.

**Hoy.** Probado: el RFx `RFX-356215` quedó en `draft`, inválido, y con `sourcing_plan_id` de la iniciativa. ANA no se ejecutó.

**Aceptación.** Crear desde una iniciativa y crear sin iniciativa. El segundo no exige plan. Ninguno de los dos marca válido un borrador vacío.

## 4. Licitaciones y comunicaciones

**Problema.** El proceso de compra necesita línea base, fechas, bases y una invitación, sin reescribir la iniciativa.

**Valor solo.** Se puede crear una licitación directa. Si viene de una iniciativa, nombre, descripción, monto, moneda y categoría escrita llegan solos.

**Distinciones.** `category_label` es la categoría del usuario. `category` es el tipo de proceso y es opcional en el alta. `baseline_source` dice cómo se estimó el monto (`budget`, `historical`, `other`). El origen es el vínculo `sourcing_plan_licitaciones`.

**Flujo.** Alta en `planned` → bases en el bucket `documents` → `published` solo con archivo y con un admin o manager → preguntas y respuestas quedan en el expediente → evaluación → adjudicación. Publicar, evaluar o adjudicar sin bases lo rechaza la base, no solo la pantalla.

**Comunicaciones de este incremento.** La invitación a la sala y el aviso al comprador. Una carta de adjudicación entra con el incremento de comité, no como un botón suelto.

**Hoy.** Probado al primer intento: `LIC-F1B-MANT`, USD 150.000, fuente `budget`, categoría escrita “Mantenimiento industrial”, tipo de proceso vacío, un vínculo y un expediente.

**Aceptación.** Desde la ficha de la iniciativa, sin corregir categoría ni fuente a mano, existen la licitación, el puente y `procurement_dossiers`.

## 5. Sala de Ofertas y proveedores oferentes

**Problema.** La oferta no puede depender de un correo ni ver el precio de otro proveedor.

**Valor solo.** Una sala puede abrirse con un título y una moneda, sin licitación. Si hay licitación, hereda nombre y moneda.

**Flujo.** Modalidad sobre cerrado, rondas, subasta inversa o adhesión → invitación por proveedor → el proveedor entra solo a su sala → envía un monto o precios por ítem → el comprador ve según la modalidad. En sobre cerrado no ve montos ajenos hasta el cierre.

**Datos.** `offer_events`, `offer_rounds`, `offer_invitations`, `offer_bids`, `adhesion_lines`, `adhesion_offers`.

**Hoy.** Las tablas y las pantallas existen. Este recorrido no envió una invitación ni una oferta. Sigue siendo el incremento 2.

**Aceptación.** Dos proveedores invitados. Cada uno ve solo su oferta. El monto queda en `offer_bids`. El comprador no lee el sobre abierto.

## 6. Evaluación técnica y económica

**Problema.** Comparar por un solo precio no alcanza cuando hay requisitos.

**Valor solo.** Una comparación de ofertas cargadas a mano, sin haber usado RFx Maker.

**Flujo.** Definir criterios y pesos que sumen 100 → puntuar cada oferta → la recomendación queda escrita por una persona, con el puntaje y el monto. ANA puede ordenar un resumen. No elige al ganador.

**Datos a crear en ese incremento.** Pesos por licitación y puntaje por oferta. No se reutiliza un párrafo dentro de las bases como si fuera la matriz.

**Hoy.** No existe. `licitacion_weightings` no se escribe. La oferta es un número.

**Aceptación.** Dos ofertas, pesos 60/40, puntajes persistidos y una recomendación con autor. Recargar la pantalla muestra los mismos números.

## 7. Comité y adjudicación

**Problema.** La decisión y el ahorro tienen que ser un hecho, no un texto en la pantalla.

**Valor solo.** El comité puede leer gasto, atrasos y ahorro ya adjudicado aunque no haya usado la sala.

**Flujo.** La recomendación entra a la cola → un admin o manager registra la decisión → la sala y la licitación pasan a adjudicadas en la misma acción → el ahorro es línea base menos adjudicado, en la moneda del proceso → el expediente guarda actor, fecha, proveedor, monto y ahorro. Cerrar el mes es otra acción y no adjudica.

**Datos.** Hace falta `award_decisions`: licitación, proveedor, monto, moneda, ahorro, actor, fecha y referencia a la oferta. El JSON actual del expediente no reemplaza esa fila.

**Hoy.** El comité lee y puede cerrar el mes. Adjudicar desde la sala escribe estado y ahorro, sin una decisión separada ni votación.

**Aceptación.** La cifra del comité es la misma de la licitación. Una segunda persona no puede adjudicar de nuevo el mismo proceso sin anular la decisión anterior.

## 8. XPEND Contracts

Contratos es un módulo propio. También puede nacer de una adjudicación. No es un CLM ni firma electrónica.

### 8.1 Contract Intelligence

**Problema.** Los contratos vigentes están en PDF y nadie puede consultar una cláusula sin abrir el archivo.

**Valor solo.** Subir contratos que no nacieron en XPEND y consultarlos.

**Flujo.** Subir PDF o Word al bucket privado → guardar archivo, nombre y hash → extracción propuesta de partes, monto, moneda, vigencia, renovación, SLA, multas y obligaciones → una persona corrige campo por campo → el texto corregido queda como vigente y la extracción original queda como historial. ANA responde citando el archivo y la página o cláusula, y no inventa una condición ausente.

**Datos.** `contracts`, `contract_documents`, `contract_extractions`. Cada campo extraído tiene valor, confianza, estado `proposed` o `confirmed`, y autor de la corrección.

**Límite.** Sin aprobación de costo no se llama a Groq por cada página en un lote. La carga y la ficha manual funcionan sin IA.

**Aceptación.** Un PDF de prueba muestra monto y vigencia corregidos por el usuario. Una pregunta de ANA que no está en el archivo responde que no consta.

### 8.2 Contract Builder

**Problema.** Redactar un contrato no puede depender de copiar el último Word.

**Valor solo.** Elegir una plantilla de la empresa, completar variables y exportar, sin adjudicación.

**Flujo.** Plantilla aprobada → formulario de partes, plazo, monto, moneda y cláusulas opcionales → borrador versionado → revisión → aprobación humana → exportar. ANA propone una cláusula. La versión aprobada no cambia si alguien sigue editando: eso crea la versión siguiente.

**Regla.** No hay estado vigente sin un actor y una fecha de aprobación. El aprobador es un admin o manager de la empresa. Un revisor legal externo queda como decisión pendiente, no como un rol inventado.

**Aceptación.** Dos versiones del mismo contrato. La aprobada se exporta. La edición posterior no la pisa.

### 8.3 Contract Generation

**Problema.** Después de adjudicar, el borrador no debe reescribir proveedor, monto y plazo.

**Flujo.** Desde una adjudicación, generar un borrador con proveedor, oferta, monto, moneda, condiciones y expediente → la persona edita → aprueba como en Builder. Si no hay adjudicación, este camino no aparece y Builder sigue disponible.

**Aceptación.** El borrador nace con el mismo monto de `award_decisions`. Cambiar el monto del contrato no cambia el ahorro de la licitación.

## 9. Gestión de proveedores

**Problema.** No se puede invitar a quien no tiene ficha ni NDA cuando el proceso lo exige.

**Valor solo.** Alta, edición, evaluación y NDA, sin licitación.

**Flujo.** Ficha → documentos en `supplier-documents` → NDA con fecha → evaluación vigente → disponible para invitar. Desactivar oculta al proveedor en invitaciones nuevas y no borra historial. La eliminación física de la ficha sigue pendiente y no se presenta como hecha.

**Hoy.** Alta, ficha, NDA y evaluación existen. Falta el recorrido de invitación real del incremento 2.

**Aceptación.** Un proveedor sin NDA no recibe invitación cuando el proceso lo marca obligatorio. Con NDA, la invitación guarda `supplier_id`.

## 10. Expedientes y trazabilidad

**Problema.** El proceso no puede quedar repartido en pantallas sin un hilo.

**Valor.** `procurement_dossiers` enlaza iniciativa, RFx, licitación, sala, adjudicación y, más adelante, contrato. No guarda precios ni cláusulas dentro del mismo JSON como única fuente.

**Flujo.** Cada paso escribe su etapa. La ficha muestra el hilo. Borrar un paso no borra el hilo: queda la anulación.

**Hoy.** La licitación de prueba generó un expediente ligado a la iniciativa. El RFx también puede escribir el mismo hilo.

**Aceptación.** Abrir el expediente muestra iniciativa, RFx y licitación de esta prueba, con los identificadores reales.

## 11. ANA

**Problema.** Redactar y buscar no debe obligar a salir del registro.

**Regla.** Lee el registro abierto y la empresa de la sesión. Propone clasificación, secciones de bases, un resumen de ofertas o una cláusula. Escribe solo si la persona pulsa guardar. No publica, no adjudica y no aprueba un contrato.

**Costo.** Cada función declara un tope de llamadas. Sin tope, el botón no se habilita.

**Hoy.** Preparar bases y clasificar gasto llaman a Groq. En esta prueba no se llamó.

**Aceptación.** Con la clave ausente, el borrador manual sigue guardando y el botón de ANA dice que no está disponible.

## Backlog por dependencia

1. Invitación, NDA obligatorio y oferta en sobre cerrado.
2. Pesos, puntajes y recomendación.
3. `award_decisions`, adjudicación única y ahorro igual en comité y licitación.
4. Contract Intelligence manual, sin extracción masiva.
5. Contract Builder con plantilla, versiones y aprobación.
6. Borrador de contrato desde la adjudicación.
7. ANA sobre el registro abierto, con tope.
8. Carga de gasto de demostración y guion comercial. No usa las 4.246 líneas ficticias como historia real.

## Incrementos

1. **Plan, RFx y licitación.** Entregado en esta rama. Prueba: iniciativa → RFx → licitación → expediente, al primer intento, en la interfaz.
2. **Invitaciones y ofertas.** Prueba: dos proveedores, aislamiento y un monto persistido.
3. **Evaluación.** Prueba: pesos, puntajes y recomendación con autor después de recargar.
4. **Comité y adjudicación.** Prueba: una decisión y el mismo ahorro en comité, licitación y expediente.
5. **Contracts standalone.** Prueba: un PDF corregido a mano y un contrato redactado desde plantilla, aprobado y exportado.
6. **Contrato desde adjudicación.** Prueba: el borrador copia el monto adjudicado y la edición no altera el ahorro.
7. **ANA transversal.** Prueba: propone y no guarda hasta el clic; sin clave, el flujo manual sigue.
8. **QA y demostración.** Prueba: el guion completo en local, con datos de prueba identificables, sin producción.

## Decisiones que sí necesitan al usuario

- Quién aprueba un contrato además del admin o manager de la empresa, si debe existir un revisor legal.
- Si la extracción de contratos con Groq se habilita después de un tope de llamadas, o si la primera versión de Contracts es solo manual.
- Si el tipo de proceso sigue siendo el catálogo fijo de cuatro valores o cada empresa carga el suyo. La categoría escrita ya no se pierde.
