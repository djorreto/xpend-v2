// Recorre por la interfaz el proceso completo de la iniciativa "Mantención de equipos críticos":
// bases (RFx) → licitación → sala de ofertas → evaluación → comité → adjudicación → contrato → declaración, validación,
// evidencia y reconocimiento del ahorro, y luego verifica el panel de gestión. Requiere: npm run demo:seed y la app en marcha.
// Es el guion técnico de la demostración: cada paso es lo que haría una persona.
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { DEMO_DIR, loadCredentials, serviceClient } from './common.mjs'
import { BASE, body, check, login, setReactValue, shot, summary } from './browser.mjs'

const creds = loadCredentials()
const DONE_MARK = `${DEMO_DIR}/flujo-ejecutado.json`
if (existsSync(DONE_MARK) && !process.argv.includes('--force')) {
  console.log('El recorrido ya se ejecutó sobre estos datos. Para repetirlo: npm run demo:seed -- --reset && npm run demo:flow')
  process.exit(0)
}

const work = mkdtempSync(join(tmpdir(), 'xpend-demo-'))
const planId = creds.planIds.mant
const licitacionId = 'LIC-DEMO-MANT'
const title = 'Mantención de equipos críticos'
const SUPPLIERS = [
  { key: 'alfa', name: 'Servicios Industriales Norte', amount: 150000, nda: true, text: 'Ejecución con equipo propio y cobertura en toda la planta.' },
  { key: 'beta', name: 'MantenPro Chile', amount: 130000, nda: true, text: 'Ejecución con subcontrato parcial de especialidades.' },
  { key: 'gamma', name: 'TecnoMant Andes', amount: 90000, nda: false, text: 'Oferta sin NDA aceptado.' },
]

async function supplierOffer(browser, supplier) {
  const session = await login(browser, creds.users[`supplier_${supplier.key}`])
  const page = session.page
  try {
    await page.goto(`${BASE}/sala/${eventId}/participar`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Aceptar invitación' }).click()
    await page.getByRole('button', { name: 'Aceptar NDA' }).waitFor()
    if (!supplier.nda) {
      const text = await body(page)
      check(`${supplier.name}: sin NDA no hay descarga ni oferta`, text.includes('bloqueados hasta aceptar el NDA') && (await page.getByRole('button', { name: 'Presentar oferta' }).count()) === 0)
      return
    }
    await page.getByRole('button', { name: 'Aceptar NDA' }).click()
    await page.getByText('NDA aceptado para esta versión.').waitFor()
    await page.locator('#technical').fill(supplier.text)
    await page.locator('#requirement').fill('Cumple habilitación, equipo propio y reporte mensual.')
    await setReactValue(page.locator('input[placeholder="Partida"]').first(), 'Mantención mensual')
    await setReactValue(page.locator('input[placeholder="Precio"]').first(), String(supplier.amount))
    await page.getByText(`Total $${supplier.amount.toLocaleString('en-US')}`).waitFor({ timeout: 8000 })
    const technical = join(work, `${supplier.key}-tecnica.txt`)
    const economic = join(work, `${supplier.key}-economica.txt`)
    writeFileSync(technical, supplier.text)
    writeFileSync(economic, `Total ${supplier.amount}`)
    await page.locator('#technical-file').setInputFiles(technical)
    await page.locator('#economic-file').setInputFiles(economic)
    await page.getByRole('button', { name: 'Presentar oferta' }).click()
    await page.getByRole('heading', { name: 'Oferta presentada' }).waitFor()
    check(`${supplier.name}: oferta presentada`, true)
  } finally {
    await session.context.close()
  }
}

let eventId = ''
let awardId = ''
let contractId = ''
const browser = await chromium.launch({ headless: true })
let current = 'inicio'
let lastPage = null
try {
  // 1) La compradora responsable abre su iniciativa y prepara las bases.
  current = 'bases'
  const valentina = await login(browser, creds.users.buyer1)
  const vp = valentina.page
  await vp.goto(`${BASE}/sourcing-plan/${planId}`, { waitUntil: 'networkidle' })
  const detail = await body(vp)
  check('iniciativa: responsables y plan de hitos visibles', /Responsables/.test(detail) && /Hitos/.test(detail))
  await shot(vp, 'flujo-01-iniciativa')
  await vp.goto(`${BASE}/rfx-maker/new?planId=${planId}`, { waitUntil: 'domcontentloaded' })
  await vp.waitForFunction(expected => {
    const input = document.querySelector('#title')
    return input && input.value.includes(expected)
  }, title)
  await vp.locator('#alcance').fill('Mantención preventiva y correctiva mensual de los equipos críticos de planta.')
  await vp.locator('#requisitos').fill('Técnicos certificados, repuestos originales y reporte mensual de disponibilidad.')
  await vp.getByRole('button', { name: 'Crear y llenar' }).click()
  await vp.waitForURL(/\/rfx-maker\/(?!new)[^/]+$/)
  check('bases (RFx) creadas por la compradora responsable', true)
  await valentina.context.close()

  // 2) La administradora publica la licitación y abre la sala de ofertas.
  current = 'licitación y sala'
  const andrea = await login(browser, creds.users.admin)
  const ap = andrea.page
  lastPage = ap
  await ap.goto(`${BASE}/licitaciones/new?planId=${planId}`, { waitUntil: 'domcontentloaded' })
  await ap.locator('#id').fill(licitacionId)
  await ap.locator('#name').fill(title)
  await ap.locator('button', { hasText: title }).first().waitFor()
  await ap.getByRole('button', { name: 'Crear Licitación' }).click()
  await ap.waitForURL(new RegExp(`/licitaciones/${licitacionId}$`))
  check('licitación creada y enlazada a la iniciativa', true)

  await ap.goto(`${BASE}/sala/new?planId=${planId}&licitacionId=${licitacionId}`, { waitUntil: 'domcontentloaded' })
  const seeded = await ap.waitForFunction(expected => [...document.querySelectorAll('input')].some(input => input.value.includes(expected)), title, { timeout: 15000 }).then(() => true).catch(() => false)
  if (!seeded) {
    const fields = ap.locator('input:not([type]), input[type="text"]')
    await fields.nth(0).fill(title)
    await fields.nth(1).fill('USD')
    await fields.nth(2).fill(licitacionId)
  }
  await ap.getByRole('button', { name: 'Crear sala' }).click()
  await ap.waitForURL(/\/sala\/[0-9a-f-]{36}$/)
  eventId = ap.url().split('/').pop()
  await ap.getByPlaceholder('Texto del NDA').fill('Las bases técnicas de este proceso son confidenciales y no pueden compartirse.')
  await ap.getByRole('button', { name: 'Exigir NDA' }).click()
  await ap.locator('textarea:not([placeholder])').first().fill('Bases técnicas confidenciales de la mantención de equipos críticos.')
  await ap.getByRole('button', { name: 'Publicar documento' }).click()
  await ap.getByText('Documento publicado').waitFor()
  for (const supplier of SUPPLIERS) {
    const input = ap.getByPlaceholder(`Correo de ${supplier.name}`)
    await input.locator('xpath=..').getByRole('button', { name: 'Invitar' }).click()
    await ap.getByText(`${supplier.name} · invited`).waitFor()
  }
  await ap.getByRole('button', { name: 'Abrir sala' }).click()
  await ap.getByRole('button', { name: 'Cerrar recepción' }).waitFor()
  await shot(ap, 'flujo-02-sala')
  check('sala de ofertas abierta con NDA y tres proveedores invitados', true)

  // 3) Los proveedores ofertan desde su portal.
  current = 'ofertas'
  for (const supplier of SUPPLIERS) await supplierOffer(browser, supplier)
  await ap.goto(`${BASE}/sala/${eventId}`, { waitUntil: 'domcontentloaded' })
  await ap.getByText('Los sobres siguen cerrados').waitFor()
  const sealed = await body(ap)
  check('sobres cerrados: se cuentan las ofertas sin mostrar montos', sealed.includes('2 ofertas') && !sealed.includes('$150,000.00'))
  await ap.getByRole('button', { name: 'Cerrar recepción' }).click()
  await ap.getByRole('button', { name: 'Abrir sobres' }).waitFor()
  await ap.getByRole('button', { name: 'Abrir sobres' }).click()
  await ap.getByText('Sobres abiertos').waitFor()

  // 4) Evaluación y recomendación.
  current = 'evaluación'
  await ap.goto(`${BASE}/sala/${eventId}/evaluacion`, { waitUntil: 'domcontentloaded' })
  await ap.getByRole('button', { name: 'Guardar modelo' }).click()
  await ap.getByText('Modelo guardado').waitFor()
  await ap.locator('#criterion-name').fill('Experiencia')
  await ap.locator('#criterion-weight').fill('100')
  await ap.getByRole('button', { name: 'Agregar criterio' }).click()
  await ap.getByText('Experiencia · técnico 100%').waitFor()
  const blockOf = name => ap.locator('div.space-y-2').filter({ has: ap.locator('p.font-medium', { hasText: name }) })
  await setReactValue(blockOf('Servicios Industriales Norte').locator('input[placeholder="0 a 100"]'), '90')
  await blockOf('Servicios Industriales Norte').locator('input[placeholder="Justificación"]').fill('Equipo propio y cobertura completa.')
  await setReactValue(blockOf('MantenPro Chile').locator('input[placeholder="0 a 100"]'), '76')
  await blockOf('MantenPro Chile').locator('input[placeholder="Justificación"]').fill('Cumple, con parte del trabajo subcontratada.')
  await ap.getByRole('button', { name: 'Cerrar evaluación' }).click()
  await ap.getByText('Evaluación cerrada').waitFor()
  await ap.getByPlaceholder('Justificación técnica').fill('Servicios Industriales Norte tiene mejor cobertura técnica.')
  await ap.getByPlaceholder('Justificación económica').fill('MantenPro es más barata, pero el modelo técnico pondera la experiencia.')
  await ap.getByRole('button', { name: 'Recomendar Servicios Industriales Norte' }).click()
  await ap.getByText('Recomendación lista').waitFor()
  check('evaluación cerrada y recomendación emitida', true)

  // 5) Expediente de decisión y comité.
  current = 'comité'
  await ap.getByRole('button', { name: 'Preparar comité' }).click()
  await ap.waitForURL(new RegExp(`/sala/${eventId}/decision`))
  await ap.locator('p', { hasText: 'Ahorro objetivo: $20,000.00' }).waitFor()
  const dossier = await body(ap)
  check('expediente: objetivo, estimado y realizado separados', dossier.includes('$20,000.00') && dossier.includes('$50,000.00') && dossier.includes('sin evidencia posterior'))
  await ap.getByPlaceholder('Riesgos').fill('La oferta recomendada no es la más baja.')
  await ap.getByPlaceholder('Excepciones').fill('Sin excepción de autoaprobación.')
  await ap.getByPlaceholder('Observaciones').fill('El comité aprueba con una cuenta distinta de quien recomienda.')
  await ap.getByRole('button', { name: 'Enviar a comité' }).click()
  await ap.getByText('Expediente enviado').waitFor()

  const carolina = await login(browser, creds.users.committee)
  const cp = carolina.page
  await cp.goto(`${BASE}/sala/${eventId}/decision`, { waitUntil: 'domcontentloaded' })
  const value = await cp.locator('select option', { hasText: 'Servicios Industriales Norte' }).getAttribute('value')
  await cp.locator('select').selectOption(value)
  await cp.getByPlaceholder('Justificación u observación').fill('Apruebo la recomendación por la evaluación técnica.')
  await cp.getByRole('button', { name: 'Aprobar recomendación' }).click()
  await cp.getByText('Voto registrado').waitFor()
  check('comité: aprueba una persona distinta de quien recomienda', true)

  // 6) Adjudicación formal y contrato.
  current = 'adjudicación y contrato'
  await ap.reload({ waitUntil: 'domcontentloaded' })
  await ap.getByPlaceholder('Condiciones o reservas de la adjudicación').fill('Adjudicación total del alcance ofertado.')
  await ap.getByRole('button', { name: 'Adjudicar' }).click()
  await ap.getByText('Adjudicación formal').waitFor()
  await ap.getByRole('button', { name: 'Generar contrato' }).click()
  await ap.waitForURL(/\/contratos\/desde-adjudicacion/)
  awardId = new URL(ap.url()).searchParams.get('award') || ''
  const year = new Date().getFullYear()
  const createTemplate = ap.getByRole('button', { name: 'Crear plantilla de servicio' })
  const generate = ap.getByRole('button', { name: 'Generar borrador' })
  await Promise.race([createTemplate.waitFor(), ap.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Generar borrador' && !button.disabled))])
  if (await createTemplate.count()) {
    // Primera vez en la empresa: se crea la plantilla de servicio aprobada que luego reutilizan todos los contratos.
    await createTemplate.click()
    await ap.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Generar borrador' && !button.disabled))
  }
  await ap.getByPlaceholder('Código').fill('CTR-DEMO-MANT-001')
  await ap.getByPlaceholder('Fecha de inicio').fill(`${year}-12-01`)
  await ap.getByPlaceholder('Fecha de término').fill(`${year + 1}-12-01`)
  await ap.getByPlaceholder('Plazo de preaviso').fill('60')
  await ap.getByPlaceholder('Periodicidad').fill('mensual')
  await ap.getByPlaceholder('Renovación').fill('manual')
  await generate.click()
  await ap.waitForURL(/\/contratos\/[0-9a-f-]{36}$/)
  contractId = ap.url().split('/').pop()
  await ap.getByRole('button', { name: 'Enviar esta versión a revisión' }).click()
  await ap.getByText('Versión 1 · in_review', { exact: true }).waitFor()
  await cp.goto(`${BASE}/contratos/${contractId}`, { waitUntil: 'domcontentloaded' })
  await cp.getByRole('button', { name: 'Aprobar esta versión' }).click()
  await cp.locator('p').filter({ hasText: /^Versión 1 · approved/ }).waitFor()
  await shot(cp, 'flujo-03-contrato')
  check('adjudicación formal y contrato aprobado por otra persona', true)
  await carolina.context.close()

  // 7) Control de ahorros: declara la responsable, valida otra persona, evidencia y reconocimiento.
  current = 'ahorros'
  const valentina2 = await login(browser, creds.users.buyer1)
  const sp = valentina2.page
  await sp.goto(`${BASE}/adjudicaciones`, { waitUntil: 'networkidle' })
  await sp.getByRole('link', { name: 'Ahorro: declarar o ver' }).first().click()
  await sp.getByTestId('pendientes-declarar').waitFor()
  await sp.getByRole('button', { name: 'Declarar ahorro' }).first().click()
  const form = sp.getByTestId('form-declarar')
  await form.waitFor()
  check('ahorros: la declaración parte del negociado comparable (USD 50.000)', (await form.innerText()).includes('50,000'))
  await form.getByLabel('Nota de la declaración').fill('Precio adjudicado frente a la línea base de USD 200.000.')
  await form.getByRole('button', { name: 'Declarar para validación' }).click()
  await sp.getByText('Ahorro declarado.').waitFor()
  await sp.getByRole('tab', { name: /Por validar/ }).click()
  check('ahorros: quien declara no puede validar', (await sp.getByRole('button', { name: 'Validar ahorro' }).count()) === 0 && /otra persona/.test(await body(sp)))
  await valentina2.context.close()

  const gonzalo = await login(browser, creds.users.manager)
  const gp = gonzalo.page
  await gp.goto(`${BASE}/ahorros`, { waitUntil: 'networkidle' })
  await gp.getByRole('tab', { name: /Por validar/ }).click()
  const toValidate = gp.getByTestId('tarjeta-validar').filter({ hasText: title })
  await toValidate.getByLabel('Metodología de validación').fill('Comparación del precio adjudicado con la línea base documentada y la cotización vigente del año anterior')
  await toValidate.getByRole('button', { name: 'Validar ahorro' }).click()
  await gp.getByText('Ahorro validado.').waitFor()
  await gp.getByRole('tab', { name: /Validados/ }).click()
  const card = gp.getByTestId('tarjeta-validado').filter({ hasText: title })
  await card.waitFor()
  const evidence = join(work, 'cotizacion-comparativa.txt')
  writeFileSync(evidence, 'Cotización comparativa ficticia para la demostración.')
  await card.getByLabel('Archivo de evidencia').setInputFiles(evidence)
  await card.getByLabel('Descripción de la evidencia').fill('Cotización comparativa')
  await card.getByRole('button', { name: 'Subir evidencia' }).click()
  await gp.getByText('Evidencia agregada.').waitFor()
  await card.getByLabel('Evidencia que respalda').selectOption({ index: 1 })
  await card.getByLabel('Monto a reconocer').fill('20000')
  await card.getByRole('button', { name: 'Reconocer mes' }).click()
  await gp.getByText('Ahorro reconocido.').waitFor()
  await shot(gp, 'flujo-04-ahorro-reconocido')
  check('ahorros: validado por otra persona, con evidencia y primer reconocimiento', true)

  // 8) El panel de gestión refleja todo, con su trazabilidad.
  current = 'panel de gestión'
  await gp.goto(`${BASE}/gestion`, { waitUntil: 'networkidle' })
  const savings = await gp.getByTestId('gestion-ahorros').innerText()
  check('gestión: USD con meta, negociado 50.000, validado 50.000 y realizado 20.000', /USD[\s\S]*\$36,000\.00[\s\S]*\$50,000\.00[\s\S]*\$20,000\.00/.test(savings), savings.replace(/\s+/g, ' ').slice(0, 220))
  await shot(gp, 'flujo-05-gestion')
  await gp.goto(`${BASE}/sourcing-plan/${planId}`, { waitUntil: 'networkidle' })
  const after = await body(gp)
  check('iniciativa: hitos con fechas reales derivadas del proceso', /Adjudicación|Comité/.test(after))
  await shot(gp, 'flujo-06-iniciativa-hitos')
  await gonzalo.context.close()
  await andrea.context.close()

  writeFileSync(DONE_MARK, JSON.stringify({ at: new Date().toISOString(), planId, licitacionId, eventId, awardId, contractId }, null, 2))
  console.log(JSON.stringify({ planId, licitacionId, eventId, awardId, contractId }))
} catch (error) {
  if (lastPage) {
    await shot(lastPage, 'fallo').catch(() => undefined)
    console.error((await body(lastPage).catch(() => '')).slice(0, 1500))
  }
  console.error(`\nFalló en el paso «${current}»: ${error instanceof Error ? error.message.split('\n')[0] : error}`)
  process.exitCode = 1
} finally {
  await browser.close()
}
summary()
void serviceClient
