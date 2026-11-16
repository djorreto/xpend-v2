// QA de solo lectura del escenario Facility Management: pantallas clave, móvil, home pública y recorrido guiado.
// Uso: node scripts/demo/qa-os.mjs  (DEMO_TARGET=prod + XPEND_DEMO_BASE=https://www.xpend.cl para producción)
import { chromium } from 'playwright'
import { createHash } from 'node:crypto'
import { TARGET, loadCredentials, serviceClient } from './common.mjs'
import { BASE, check, login, shot, summary } from './browser.mjs'

const creds = loadCredentials()
const company = creds.companyId
const project = creds.fm?.projects?.nacional
if (!project) throw new Error('Falta el escenario Facility Management: ejecuta scripts/demo/facility.mjs.')
const event = (await serviceClient.from('offer_events').select('id').eq('company_id', company).eq('licitacion_id', 'DEMO-XC-FM-STGO').maybeSingle()).data?.id
const successor = (await serviceClient.from('contract_relations').select('to_contract_id').eq('company_id', company).eq('from_contract_id', creds.fm.contracts.stgo).maybeSingle()).data?.to_contract_id

const WATCHED = ['sourcing_plans', 'sourcing_projects', 'project_tasks', 'project_deliverables', 'deliverable_versions', 'licitaciones', 'offer_events', 'contracts', 'contract_relations', 'economic_baselines', 'savings_validations', 'approval_requests']
async function fingerprint() {
  const hash = createHash('sha256')
  for (const table of WATCHED) {
    const { data, error } = await serviceClient.from(table).select('*').eq('company_id', company).order('id')
    if (error) throw new Error(`${table}: ${error.message}`)
    hash.update(`${table}:${JSON.stringify(data)}`)
  }
  return hash.digest('hex')
}

async function visit(page, errors, { name, path, testid, text, heading }) {
  errors.length = 0
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
  let ok = true
  let detail = ''
  try {
    if (testid) await page.getByTestId(testid).first().waitFor({ timeout: 30000 })
    if (text) await page.getByText(text).first().waitFor({ timeout: 30000 })
    if (heading) await page.getByRole('heading', { name: heading }).first().waitFor({ timeout: 30000 })
    await page.waitForLoadState('networkidle').catch(() => undefined)
  } catch (error) {
    ok = false
    detail = error.message.split('\n')[0]
  }
  if (await page.getByText('Application error').count()) { ok = false; detail = 'error de cliente' }
  if (errors.length) { ok = false; detail = errors.join(' | ').slice(0, 300) }
  await shot(page, `os-${TARGET}-${name}`)
  check(`${name}: ${path}`, ok, detail)
}

function watch(page) {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  return errors
}

const browser = await chromium.launch()
try {
  const anon = await browser.newPage({ viewport: { width: 1360, height: 900 } })
  const anonErrors = watch(anon)
  await visit(anon, anonErrors, { name: 'home-publica', path: '/', heading: /Compra con\s*claridad\./ })
  await anon.close()

  const manager = await login(browser, creds.users.manager)
  const me = manager.page
  const errors = watch(me)
  const screens = [
    { name: 'inicio-gerencial', path: '/dashboard?vista=gerencia', testid: 'atencion-gerencia' },
    { name: 'plan-anual', path: '/plan-anual?anio=2027&vista=tabla', testid: 'vista-tabla' },
    { name: 'arbol', path: '/plan-anual?anio=2027&vista=arbol', testid: 'vista-arbol' },
    { name: 'gantt-portafolio', path: '/plan-anual?anio=2027&vista=gantt', testid: 'gantt-portafolio' },
    { name: 'entregables-plan', path: '/plan-anual?anio=2027&vista=entregables', testid: 'vista-entregables' },
    { name: 'proyecto', path: `/proyectos/${project}`, testid: 'siguiente-accion' },
    { name: 'tablero', path: `/proyectos/${project}?tab=tablero`, testid: 'tablero' },
    { name: 'gantt-proyecto', path: `/proyectos/${project}?tab=gantt`, testid: 'gantt-proyecto' },
    { name: 'entregables', path: `/proyectos/${project}?tab=entregables`, testid: 'entregables' },
    { name: 'expediente-rfx', path: `/proyectos/${project}?tab=rfx`, testid: 'procesos-proyecto' },
    { name: 'contratos-proyecto', path: `/proyectos/${project}?tab=contratos`, testid: 'situacion-contratos' },
    { name: 'vista-ahorro', path: `/proyectos/${project}?tab=ahorro`, testid: 'linea-base' },
    { name: 'colaboracion', path: `/proyectos/${project}?tab=actividad`, testid: 'actividad-proyecto' },
    { name: 'portafolio-proyectos', path: '/proyectos', testid: 'tabla-proyectos' },
    { name: 'metodologia', path: '/administracion/metodologia', testid: 'metodologia' },
  ]
  if (successor) screens.push({ name: 'historia-contratos', path: `/contratos/${successor}`, testid: 'historia-contrato' })
  else check('contrato sucesor registrado', false, 'sin relación desde Aseo Santiago')
  if (event) screens.push({ name: 'evaluacion-ofertas', path: `/sala/${event}/evaluacion`, text: 'Higiene Integral Chile' })
  for (const screen of screens) await visit(me, errors, screen)
  await manager.context.close()

  const buyer = await login(browser, creds.users.buyer4)
  await visit(buyer.page, watch(buyer.page), { name: 'hoy-comprador', path: '/dashboard?vista=trabajo', testid: 'hoy-comprador' })
  await buyer.context.close()

  const mobile = await login(browser, creds.users.manager, { width: 390, height: 844 })
  const mobileErrors = watch(mobile.page)
  await visit(mobile.page, mobileErrors, { name: 'movil-inicio', path: '/dashboard?vista=gerencia', testid: 'atencion-gerencia' })
  await visit(mobile.page, mobileErrors, { name: 'movil-proyecto', path: `/proyectos/${project}`, testid: 'siguiente-accion' })
  await visit(mobile.page, mobileErrors, { name: 'movil-gantt', path: `/proyectos/${project}?tab=gantt`, testid: 'gantt-proyecto' })
  const overflow = await mobile.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('móvil: la página no se desborda horizontalmente', overflow <= 1, `${overflow}px`)
  await mobile.context.close()

  // Recorrido guiado interno: no arranca solo, recorre registros reales y no modifica datos.
  const before = await fingerprint()
  const admin = await login(browser, creds.users.admin)
  const ap = admin.page
  const tourErrors = watch(ap)
  await ap.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' })
  await ap.getByTestId('iniciar-demo-guiada').waitFor()
  check('recorrido: no se inicia automáticamente', (await ap.getByTestId('recorrido-guiado').count()) === 0)
  const tour = (await serviceClient.from('demo_tours').select('steps').eq('company_id', company).eq('tour_key', 'principal').single()).data
  await ap.getByTestId('iniciar-demo-guiada').click()
  for (const [index, step] of tour.steps.entries()) {
    const panel = ap.getByTestId('recorrido-guiado')
    await panel.getByText(step.title).waitFor()
    const target = new URL(step.href, BASE)
    await ap.waitForURL(url => url.pathname === target.pathname)
    let highlighted = true
    if (step.target) highlighted = await ap.waitForSelector('.tour-highlight', { timeout: 20000 }).then(() => true).catch(() => false)
    const missing = await ap.getByTestId('recorrido-sin-registro').count()
    await shot(ap, `os-${TARGET}-recorrido-${index + 1}-${step.key}`)
    check(`recorrido paso ${index + 1} «${step.key}»`, highlighted && !missing && !tourErrors.length, [!highlighted && `sin resaltar ${step.target}`, missing && 'registro no disponible', tourErrors.join(' | ')].filter(Boolean).join(' · '))
    const last = index === tour.steps.length - 1
    await ap.getByTestId(last ? 'recorrido-terminar' : 'recorrido-siguiente').click()
  }
  check('recorrido: se cierra al terminar', (await ap.getByTestId('recorrido-guiado').count()) === 0)
  await ap.getByRole('button', { name: 'Menú de usuario' }).click()
  check('recorrido: disponible en el menú de usuario', await ap.getByTestId('menu-recorrido').waitFor({ timeout: 10000 }).then(() => true).catch(() => false))
  await ap.keyboard.press('Escape')
  await admin.context.close()

  const supplier = await login(browser, creds.users.supplier_higiene)
  const sp = supplier.page
  await sp.goto(`${BASE}/sala`, { waitUntil: 'domcontentloaded' })
  await sp.waitForLoadState('networkidle').catch(() => undefined)
  await sp.getByRole('button', { name: 'Menú de usuario' }).click()
  await sp.getByTestId('menu-recorrido').click()
  await sp.getByTestId('recorrido-guiado').getByText('Tus procesos').waitFor()
  await sp.getByTestId('recorrido-siguiente').click()
  await sp.waitForURL(/\/participar$/)
  await sp.getByTestId('recorrido-guiado').getByText('NDA antes de los documentos').waitFor()
  await sp.waitForLoadState('networkidle').catch(() => undefined)
  await shot(sp, `os-${TARGET}-recorrido-proveedor`)
  check('proveedor: recorrido del portal llega a su sala con NDA', true)
  const supplierText = await sp.locator('body').innerText()
  check('proveedor: no ve el recorrido interno ni ofertas ajenas', !supplierText.includes('Lo que requiere tu atención') && !supplierText.includes('Limpieza Total'))
  await supplier.context.close()

  check('recorrido: no modificó registros de negocio', before === await fingerprint())
} finally {
  await browser.close()
}
summary()
