// Recorre por la interfaz los casos de punta a punta de «XPEND Company S.A. (DEMO)»: cada paso es lo que haría una persona.
//   A  Mantención preventiva (USD): bases → licitación → sala → ofertas → evaluación → comité → adjudicación → contrato → ahorro validado y reconocido.
//   T  Enlaces y telefonía (CLP): igual, y el ahorro queda declarado, pendiente de validación.
//   B  Desarrollo y soporte de aplicaciones (USD): tres oferentes, evaluación y recomendación; queda a la espera del comité.
// Uso: npm run demo:flow [-- A T B]   Requiere la siembra y la aplicación en marcha (XPEND_DEMO_BASE).
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { DEMO_DIR, TARGET, addDays, loadCredentials, serviceClient, today } from './common.mjs'
import { FACILITY, FLOWS, INITIATIVES } from './dataset.mjs'
import { BASE, body, check, login, setReactValue, shot, summary } from './browser.mjs'

const creds = loadCredentials()
const wanted = process.argv.slice(2).filter(arg => FLOWS[arg])
const cases = wanted.length ? wanted : ['A', 'T', 'B']
const work = mkdtempSync(join(tmpdir(), 'xpend-demo-'))
const money = (amount) => String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, '[.,]?')
const t0 = today()

async function supplierOffer(browser, spec, supplier, eventId) {
  const session = await login(browser, creds.users[`supplier_${supplier.key}`])
  const page = session.page
  try {
    await page.goto(`${BASE}/sala/${eventId}/participar`, { waitUntil: 'domcontentloaded' })
    if (await page.getByRole('heading', { name: 'Oferta presentada' }).count()) return check(`${supplier.name}: oferta ya presentada`, true)
    const accept = page.getByRole('button', { name: 'Aceptar invitación' })
    await Promise.race([accept.waitFor(), page.getByText('Acuerdo de confidencialidad').waitFor()])
    if (await accept.count()) await accept.click()
    const ndaAccepted = page.getByText('NDA aceptado para esta versión.')
    await Promise.race([page.getByRole('button', { name: 'Aceptar NDA' }).waitFor(), ndaAccepted.waitFor()])
    if (!supplier.nda) {
      const text = await body(page)
      check(`${supplier.name}: sin NDA no hay descarga ni oferta`, text.includes('bloqueados hasta aceptar el NDA') && (await page.getByRole('button', { name: 'Presentar oferta' }).count()) === 0)
      return
    }
    if (!(await ndaAccepted.count())) {
      await page.getByRole('button', { name: 'Aceptar NDA' }).click()
      await ndaAccepted.waitFor()
    }
    await page.locator('#technical').fill(supplier.text)
    await page.locator('#requirement').fill('Cumple habilitación, equipo propio y reporte periódico.')
    await page.getByRole('button', { name: 'Agregar partida' }).waitFor()
    await page.waitForTimeout(1500)
    if (!(await page.locator('input[placeholder="Partida"]').count())) await page.getByRole('button', { name: 'Agregar partida' }).click()
    await page.locator('input[placeholder="Partida"]').first().waitFor({ timeout: 10000 })
    await setReactValue(page.locator('input[placeholder="Partida"]').first(), 'Servicio contratado')
    await setReactValue(page.locator('input[placeholder="Precio"]').first(), String(supplier.amount))
    await page.getByText(new RegExp(`Total\\s*[A-Z]*\\s*\\$?${money(supplier.amount)}`)).first().waitFor({ timeout: 8000 })
    const technical = join(work, `${supplier.key}-tecnica.txt`)
    const economic = join(work, `${supplier.key}-economica.txt`)
    writeFileSync(technical, `${supplier.text}\n(Documento ficticio de demostración)`)
    writeFileSync(economic, `Total ${supplier.amount} ${spec.currency} (documento ficticio de demostración)`)
    await page.locator('#technical-file').setInputFiles(technical)
    await page.locator('#economic-file').setInputFiles(economic)
    await page.getByRole('button', { name: 'Presentar oferta' }).click()
    await page.getByRole('heading', { name: 'Oferta presentada' }).waitFor()
    check(`${supplier.name}: oferta presentada`, true)
  } catch (error) {
    await shot(page, `fallo-oferta-${supplier.key}`).catch(() => undefined)
    console.error(`Oferta de ${supplier.name}: ${(await body(page).catch(() => '')).slice(0, 800)}`)
    throw error
  } finally {
    await session.context.close()
  }
}

async function runCase(browser, code) {
  const spec = FLOWS[code]
  const marker = `${DEMO_DIR}/flujo-${TARGET}-${code}.json`
  if (existsSync(marker) && !process.argv.includes('--force')) {
    console.log(`Caso ${code}: ya ejecutado sobre estos datos (${marker}).`)
    return
  }
  const initiative = INITIATIVES.find(item => item.key === spec.plan) || FACILITY.initiatives.find(item => item.key === spec.plan)
  const title = initiative.title
  const name = spec.name || title
  const either = new RegExp([title, name].map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'))
  const planId = creds.planIds[spec.plan]
  if (!planId) throw new Error(`Falta la iniciativa ${spec.plan}: corre primero su script de siembra.`)
  const licitacionId = spec.licitacion
  const target = Math.round((initiative.spend * initiative.pct) / 100)
  const offering = spec.suppliers.filter(item => item.nda)
  const winner = spec.suppliers.find(item => item.name === spec.recommend)
  const negotiated = spec.baseline - winner.amount
  let current = `${code}/inicio`
  let lastPage = null
  let eventId = ''
  let awardId = ''
  let contractId = ''
  console.log(`\n=== Caso ${code}: ${name} ===`)
  // Reanudación: si la sala ya abrió sobres (una ejecución anterior se cortó), se retoma desde la evaluación sin repetir nada.
  const existingEvent = (await serviceClient.from('offer_events').select('id, offers_opened_at').eq('company_id', creds.companyId).eq('licitacion_id', licitacionId).maybeSingle()).data
  const resume = Boolean(existingEvent?.offers_opened_at)
  const resumeOffers = Boolean(existingEvent && !existingEvent.offers_opened_at)
  let andrea
  let ap
  try {
    if (resume) {
      console.log('Se reanuda desde la evaluación: la sala ya tiene los sobres abiertos.')
      eventId = existingEvent.id
      andrea = await login(browser, creds.users.admin)
      ap = andrea.page
      lastPage = ap
    }
    if (resumeOffers) {
      console.log('Se reanuda desde las ofertas: la sala ya existe y sus sobres siguen cerrados.')
      eventId = existingEvent.id
      andrea = await login(browser, creds.users.admin)
      ap = andrea.page
      lastPage = ap
    }
    if (!resume) {
    if (!resumeOffers) {
    // 1) La responsable abre su iniciativa y prepara las bases.
    current = `${code}/bases`
    const owner = await login(browser, creds.users[spec.responsible])
    const op = owner.page
    await op.goto(`${BASE}/sourcing-plan/${planId}`, { waitUntil: 'networkidle' })
    check(`${code}: iniciativa con responsables y plan de hitos`, /Responsables/.test(await body(op)) && /Hitos/.test(await body(op)))
    await op.goto(`${BASE}/rfx-maker/new?planId=${planId}`, { waitUntil: 'domcontentloaded' })
    await op.waitForFunction(expected => document.querySelector('#title')?.value.includes(expected), title)
    await op.locator('#alcance').fill(spec.scope)
    await op.locator('#requisitos').fill(spec.requirements)
    await op.getByRole('button', { name: 'Crear y llenar' }).click()
    await op.waitForURL(/\/rfx-maker\/(?!new)[^/]+$/)
    check(`${code}: bases (RFx) creadas por la responsable`, true)
    await owner.context.close()

    // 2) La administradora publica la licitación y abre la sala de ofertas.
    current = `${code}/licitación y sala`
    andrea = await login(browser, creds.users.admin)
    ap = andrea.page
    lastPage = ap
    await ap.goto(`${BASE}/licitaciones/new?planId=${planId}`, { waitUntil: 'domcontentloaded' })
    await ap.locator('#id').fill(licitacionId)
    await ap.locator('#name').fill(name)
    await ap.locator('button', { hasText: title }).first().waitFor()
    if (spec.overrideBaseline) {
      await ap.waitForFunction(() => document.querySelector('#baseline_amount')?.value !== '')
      await ap.locator('#baseline_amount').fill(String(spec.baseline))
    }
    await ap.getByRole('button', { name: 'Crear Licitación' }).click()
    await ap.waitForURL(new RegExp(`/licitaciones/${licitacionId}$`))
    check(`${code}: licitación creada y enlazada a la iniciativa`, true)

    await ap.goto(`${BASE}/sala/new?planId=${planId}&licitacionId=${licitacionId}`, { waitUntil: 'domcontentloaded' })
    const seeded = await ap.waitForFunction(expected => Array.from(document.querySelectorAll('input')).some(input => expected.some(text => input.value.includes(text))), [title, name], { timeout: 15000 }).then(() => true).catch(() => false)
    const field = label => ap.locator(`div:has(> label:text-is("${label}")) > input`)
    if (!seeded) {
      await field('Título').fill(name)
      await field('ID de licitación, si ya existe').fill(licitacionId)
    }
    await field('Moneda').fill(spec.currency)
    await ap.getByRole('button', { name: 'Crear sala' }).click()
    await ap.waitForURL(/\/sala\/[0-9a-f-]{36}$/)
    eventId = ap.url().split('/').pop()
    await ap.getByPlaceholder('Texto del NDA').fill('Las bases técnicas de este proceso son confidenciales y no pueden compartirse. Proceso ficticio de demostración.')
    await ap.getByRole('button', { name: 'Exigir NDA' }).click()
    await ap.locator('textarea:not([placeholder])').first().fill(`Bases técnicas confidenciales: ${title}. Documento ficticio de demostración.`)
    await ap.getByRole('button', { name: 'Publicar documento' }).click()
    await ap.getByText('Documento publicado').waitFor()
    for (const supplier of spec.suppliers) {
      await ap.getByLabel('Buscar proveedor del directorio').fill(supplier.name)
      const input = ap.getByPlaceholder(`Correo de ${supplier.name}`)
      await input.locator('xpath=..').getByRole('button', { name: 'Invitar' }).click()
      await ap.getByText(`${supplier.name} · invited`).waitFor()
    }
    await ap.getByRole('button', { name: 'Abrir sala' }).click()
    await ap.getByRole('button', { name: 'Cerrar recepción' }).waitFor()
    check(`${code}: sala abierta con NDA y ${spec.suppliers.length} proveedores invitados`, true)
    }

    // 3) Los proveedores ofertan desde su portal.
    current = `${code}/ofertas`
    for (const supplier of spec.suppliers) await supplierOffer(browser, spec, supplier, eventId)
    await ap.goto(`${BASE}/sala/${eventId}`, { waitUntil: 'domcontentloaded' })
    await ap.getByText('Los sobres siguen cerrados').waitFor()
    const sealed = await body(ap)
    check(`${code}: sobres cerrados, se cuentan ${offering.length} ofertas sin mostrar montos`, sealed.includes(`${offering.length} ofertas`) && !new RegExp(`\\$${money(offering[0].amount)}`).test(sealed))
    await ap.getByRole('button', { name: 'Cerrar recepción' }).click()
    await ap.getByRole('button', { name: 'Abrir sobres' }).waitFor()
    await ap.getByRole('button', { name: 'Abrir sobres' }).click()
    await ap.getByText('Sobres abiertos').waitFor()
    }

    // 4) Evaluación y recomendación.
    current = `${code}/evaluación`
    await ap.goto(`${BASE}/sala/${eventId}/evaluacion`, { waitUntil: 'networkidle' })
    const recommended = async () => (await ap.getByRole('button', { name: 'Preparar comité' }).count()) > 0
    if (!(await recommended())) {
      // Si una ejecución anterior cerró la evaluación sin todos los puntajes, se usa la reapertura excepcional del producto (queda en la auditoría).
      if (await ap.getByRole('button', { name: 'Reabrir evaluación' }).count()) {
        await ap.getByRole('button', { name: 'Reabrir evaluación' }).click()
        await ap.getByRole('button', { name: 'Cerrar evaluación' }).waitFor()
      }
      if (!(await ap.getByText('Experiencia · técnico 100%').count())) {
        await ap.getByRole('button', { name: 'Guardar modelo' }).click()
        await ap.getByText('Modelo guardado').waitFor()
        await ap.locator('#criterion-name').fill('Experiencia')
        await ap.locator('#criterion-weight').fill('100')
        await ap.getByRole('button', { name: 'Agregar criterio' }).click()
        await ap.getByText('Experiencia · técnico 100%').waitFor()
      }
      await ap.waitForLoadState('networkidle')
      await ap.waitForTimeout(2000)
      const blockOf = name => ap.locator('div.space-y-2').filter({ has: ap.locator('p.font-medium', { hasText: name }) })
      // Los puntajes viven en el formulario hasta cerrar la evaluación: se escriben y se leen de vuelta antes de cerrar.
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        for (const supplier of offering) {
          const [score, reason] = spec.scores[supplier.key]
          await setReactValue(blockOf(supplier.name).locator('input[placeholder="0 a 100"]'), score)
          await blockOf(supplier.name).locator('input[placeholder="Justificación"]').fill(reason)
        }
        await ap.waitForTimeout(1200)
        const saved = await Promise.all(offering.map(async supplier => (await blockOf(supplier.name).locator('input[placeholder="0 a 100"]').inputValue()) === spec.scores[supplier.key][0]))
        if (saved.every(Boolean)) break
        if (attempt === 5) throw new Error('Los puntajes no quedaron en el formulario')
      }
      await ap.getByRole('button', { name: 'Cerrar evaluación' }).click()
      await ap.getByText('Evaluación cerrada').waitFor()
      await ap.getByPlaceholder('Justificación técnica').fill(`${spec.recommend} obtiene el mejor puntaje técnico.`)
      await ap.getByPlaceholder('Justificación económica').fill(`La oferta de ${spec.recommend} es conveniente frente a la línea base del proceso.`)
      await ap.getByRole('button', { name: `Recomendar ${spec.recommend}` }).click()
      await ap.getByText('Recomendación lista').waitFor()
    }
    check(`${code}: evaluación cerrada y recomendación emitida`, true)
    await shot(ap, `flujo-${code}-recomendacion`)
    if (spec.stopAfter) {
      await andrea.context.close()
      writeFileSync(marker, JSON.stringify({ at: new Date().toISOString(), planId, licitacionId, eventId }, null, 2))
      return
    }

    // 5) Expediente de decisión y comité.
    current = `${code}/comité`
    await ap.getByRole('button', { name: 'Preparar comité' }).click()
    await ap.waitForURL(new RegExp(`/sala/${eventId}/decision`))
    await ap.locator('p', { hasText: 'Ahorro objetivo' }).first().waitFor()
    const dossier = await body(ap)
    check(`${code}: expediente con objetivo y estimado separados del realizado`, new RegExp(money(target)).test(dossier) && new RegExp(money(negotiated)).test(dossier) && dossier.includes('sin evidencia posterior'))
    await ap.getByPlaceholder('Riesgos').fill('La oferta recomendada no es necesariamente la más baja.')
    await ap.getByPlaceholder('Excepciones').fill('Sin excepción de autoaprobación.')
    await ap.getByPlaceholder('Observaciones').fill('El comité aprueba con una cuenta distinta de quien recomienda.')
    await ap.getByRole('button', { name: 'Enviar a comité' }).click()
    await ap.getByText('Expediente enviado').waitFor()

    const carolina = await login(browser, creds.users[spec.committeeKey])
    const cp = carolina.page
    await cp.goto(`${BASE}/sala/${eventId}/decision`, { waitUntil: 'domcontentloaded' })
    const value = await cp.locator('select option', { hasText: spec.recommend }).getAttribute('value')
    await cp.locator('select').selectOption(value)
    await cp.getByPlaceholder('Justificación u observación').fill('Apruebo la recomendación por la evaluación técnica.')
    await cp.getByRole('button', { name: 'Aprobar recomendación' }).click()
    await cp.getByText('Voto registrado').waitFor()
    check(`${code}: el comité aprueba una persona distinta de quien recomienda`, true)

    // 6) Adjudicación formal y contrato.
    current = `${code}/adjudicación y contrato`
    await ap.reload({ waitUntil: 'domcontentloaded' })
    await ap.getByPlaceholder('Condiciones o reservas de la adjudicación').fill('Adjudicación total del alcance ofertado.')
    await ap.getByRole('button', { name: 'Adjudicar' }).click()
    await ap.getByText('Adjudicación formal').waitFor()
    await ap.getByRole('button', { name: 'Generar contrato' }).click()
    await ap.waitForURL(/\/contratos\/desde-adjudicacion/)
    awardId = new URL(ap.url()).searchParams.get('award') || ''
    const createTemplate = ap.getByRole('button', { name: 'Crear plantilla de servicio' })
    const generate = ap.getByRole('button', { name: 'Generar borrador' })
    await Promise.race([createTemplate.waitFor(), ap.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(button => button.textContent === 'Generar borrador' && !button.disabled))])
    if (await createTemplate.count()) {
      await createTemplate.click()
      await ap.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(button => button.textContent === 'Generar borrador' && !button.disabled))
    }
    const start = addDays(t0, spec.contract.startOffset)
    await ap.getByPlaceholder('Código').fill(spec.contract.code)
    await ap.getByPlaceholder('Fecha de inicio').fill(start)
    await ap.getByPlaceholder('Fecha de término').fill(addDays(start, 365 * (spec.contract.years || (code === 'T' ? 2 : 1)) - 1))
    await ap.getByPlaceholder('Plazo de preaviso').fill(spec.contract.notice)
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
    check(`${code}: adjudicación formal y contrato aprobado por otra persona`, true)
    await carolina.context.close()
    await andrea.context.close()

    // 7) Control de ahorros: declara la responsable; valida y reconoce otra persona.
    current = `${code}/ahorros`
    const declarer = await login(browser, creds.users[spec.responsible])
    const sp = declarer.page
    await sp.goto(`${BASE}/ahorros`, { waitUntil: 'networkidle' })
    await sp.getByRole('tab', { name: /Por declarar/ }).click()
    await sp.getByTestId('pendientes-declarar').waitFor()
    await sp.getByTestId('pendientes-declarar').locator('li').filter({ hasText: either }).getByRole('button', { name: 'Declarar ahorro' }).click()
    const form = sp.getByTestId('form-declarar')
    await form.waitFor()
    check(`${code}: la declaración parte del negociado comparable`, new RegExp(money(negotiated)).test(await form.innerText()))
    await form.getByLabel('Nota de la declaración').fill(`Precio adjudicado frente a la línea base de ${spec.currency} ${spec.baseline.toLocaleString('en-US')}.`)
    await form.getByRole('button', { name: 'Declarar para validación' }).click()
    await sp.getByText('Ahorro declarado.').waitFor()
    await sp.getByRole('tab', { name: /Por validar/ }).click()
    check(`${code}: quien declara no puede validar`, (await sp.getByRole('button', { name: 'Validar ahorro' }).count()) === 0 && /otra persona/.test(await body(sp)))
    await declarer.context.close()

    if (spec.savings === 'validate') {
      const gonzalo = await login(browser, creds.users.manager)
      const gp = gonzalo.page
      await gp.goto(`${BASE}/ahorros`, { waitUntil: 'networkidle' })
      await gp.getByRole('tab', { name: /Por validar/ }).click()
      const toValidate = gp.getByTestId('tarjeta-validar').filter({ hasText: either })
      await toValidate.getByLabel('Metodología de validación').fill('Comparación del precio adjudicado con la línea base documentada y la cotización vigente del año anterior')
      await toValidate.getByRole('button', { name: 'Validar ahorro' }).click()
      await gp.getByText('Ahorro validado.').waitFor()
      await gp.getByRole('tab', { name: /Validados/ }).click()
      const card = gp.getByTestId('tarjeta-validado').filter({ hasText: either })
      await card.waitFor()
      const evidence = join(work, `cotizacion-comparativa-${code}.txt`)
      writeFileSync(evidence, 'Cotización comparativa ficticia para la demostración.')
      await card.getByLabel('Archivo de evidencia').setInputFiles(evidence)
      await card.getByLabel('Descripción de la evidencia').fill('Cotización comparativa (documento ficticio)')
      await card.getByRole('button', { name: 'Subir evidencia' }).click()
      await gp.getByText('Evidencia agregada.').waitFor()
      await card.getByLabel('Evidencia que respalda').selectOption({ index: 1 })
      await card.getByLabel('Monto a reconocer').fill(String(spec.recognize))
      await card.getByRole('button', { name: 'Reconocer mes' }).click()
      await gp.getByText('Ahorro reconocido.').waitFor()
      await shot(gp, `flujo-${code}-ahorro-reconocido`)
      check(`${code}: validado por otra persona, con evidencia y primer reconocimiento`, true)
      await gonzalo.context.close()
    }
    writeFileSync(marker, JSON.stringify({ at: new Date().toISOString(), planId, licitacionId, eventId, awardId, contractId }, null, 2))
  } catch (error) {
    if (lastPage) {
      await shot(lastPage, `fallo-${code}`).catch(() => undefined)
      console.error((await body(lastPage).catch(() => '')).slice(0, 1200))
    }
    console.error(`\nFalló en el paso «${current}»: ${error instanceof Error ? error.message.split('\n')[0] : error}`)
    process.exitCode = 1
    throw error
  }
}

const browser = await chromium.launch({ headless: true })
try {
  for (const code of cases) await runCase(browser, code)
} catch {
  // el detalle ya se imprimió; se corta la secuencia para no encadenar datos incompletos
} finally {
  await browser.close()
}
summary()
