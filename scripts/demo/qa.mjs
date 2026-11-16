// QA de «XPEND Company S.A. (DEMO)»: perspectivas del Super Admin, cambio de empresa autorizado, roles independientes, aislamiento,
// consultas directas a la API, coherencia matemática de los tableros y responsive. No crea ni modifica datos de negocio.
// En producción corre solo con las cuentas demo (no hay credenciales del Super Admin real): las comprobaciones del Super Admin se hacen en local.
// Uso: npm run demo:qa      (XPEND_DEMO_BASE apunta a la app; DEMO_TARGET=prod para producción)
import { chromium } from 'playwright'
import { TARGET, loadCredentials, serviceClient, signedIn } from './common.mjs'
import { BASE, body, check, login, shot, summary } from './browser.mjs'

const creds = loadCredentials()
const companyId = creds.companyId
const fmt = (value) => Number(value).toLocaleString('en-US')
const sum = (rows, pick) => rows.reduce((total, row) => total + Number(pick(row) || 0), 0)
const byCurrency = (rows, pick) => {
  const out = {}
  for (const row of rows) out[row.currency] = (out[row.currency] || 0) + Number(pick(row) || 0)
  return out
}
const scoped = (table, columns = '*') => serviceClient.from(table).select(columns).eq('company_id', companyId)

// ---- 1. Inventario y coherencia en la base de datos (lo que los tableros deben reflejar) -------------------------------------------
async function inventory() {
  const [categories, assignments, teams, members, plans, lines, initiatives, milestones, lics, contracts, docs, validations, recognitions, evidence, awards, suppliers, spend] = await Promise.all([
    scoped('procurement_categories', 'id'), scoped('category_assignments', 'category_id'), scoped('procurement_teams', 'id'), scoped('procurement_team_members', 'user_id'),
    scoped('annual_plans', 'id, plan_year, status'), scoped('annual_plan_lines', 'id, currency, target_amount, annual_plan_id'), scoped('sourcing_plans', 'id, plan_year, currency, projected_savings_amount, status'),
    scoped('initiative_milestones', 'id, committed_date, original_date, actual_date'), scoped('licitaciones', 'id, status'), scoped('contracts', 'id, code, status, origin'),
    scoped('contract_documents', 'id, contract_id'), scoped('savings_validations', 'id, status, currency, declared_amount, validated_amount, declared_by, validated_by, source_kind'),
    scoped('savings_recognitions', 'id, kind, currency, amount, validation_id, period'), scoped('savings_evidence', 'id, validation_id'), scoped('process_awards', 'id, estimated_savings, currency'),
    scoped('suppliers', 'id'), scoped('si_spend_lines', 'amount, currency, purchase_date'),
  ])
  const data = { categories, assignments, teams, members, plans, lines, initiatives, milestones, lics, contracts, docs, validations, recognitions, evidence, awards, suppliers, spend }
  for (const [name, result] of Object.entries(data)) if (result.error) throw new Error(`${name}: ${result.error.message}`)
  return Object.fromEntries(Object.entries(data).map(([name, result]) => [name, result.data]))
}

const data = await inventory()
const year = new Date().getFullYear()
check('datos: 6 categorías con 6 Category Managers asignados y 2 equipos', data.categories.length === 6 && data.assignments.length === 6 && data.teams.length === 2 && data.members.length === 4)
check('datos: plan anual del año comprometido y borrador del siguiente', data.plans.some(p => p.plan_year === year && p.status === 'committed') && data.plans.some(p => p.plan_year === year + 1 && p.status !== 'committed'), JSON.stringify(data.plans))
check('datos: 18 iniciativas (15 del año y 3 preliminares)', data.initiatives.length === 18 && data.initiatives.filter(i => i.plan_year === year).length === 15)
check('datos: al menos 12 procesos de licitación en estados distintos', data.lics.length >= 12 && new Set(data.lics.map(l => l.status)).size >= 3, `${data.lics.length} procesos, estados ${Array.from(new Set(data.lics.map(l => l.status))).join(', ')}`)
check('datos: 5 contratos con documento (2 de adjudicación y 3 cargados aparte)', data.contracts.length === 5 && data.contracts.filter(c => c.origin === 'upload').length === 3 && data.contracts.every(c => data.docs.some(d => d.contract_id === c.id) || c.origin === 'award'))
check('datos: hitos con fecha original conservada tras el compromiso', data.milestones.filter(m => m.committed_date).every(m => m.original_date))
check('datos: gasto histórico solo en CLP y USD, sin mezclar monedas', new Set(data.spend.map(l => l.currency)).size === 2 && data.spend.length > 800)
check('datos: gasto de 2025 completo y del año en curso hasta el último mes cerrado', new Set(data.spend.filter(l => l.purchase_date.startsWith(`${year - 1}-`)).map(l => l.purchase_date.slice(5, 7))).size === 12)
const validated = data.validations.filter(v => v.status === 'validated')
check('ahorros: toda validación la hizo una persona distinta de quien declaró', validated.length > 0 && validated.every(v => v.validated_by && v.validated_by !== v.declared_by))
check('ahorros: hay declarado sin validar, validado y reconocido', data.validations.some(v => v.status === 'declared') && validated.length === 3 && data.recognitions.length > 0)
check('ahorros: solo se reconoce lo validado y todo reconocimiento tiene evidencia', data.recognitions.every(r => validated.some(v => v.id === r.validation_id)) && data.evidence.length >= 3)
check('ahorros: hay una reversa justificada de un reconocimiento', data.recognitions.some(r => r.kind === 'reversal'))
const net = (rows) => rows.reduce((acc, r) => { acc[r.currency] = (acc[r.currency] || 0) + (r.kind === 'reversal' ? -1 : 1) * Number(r.amount); return acc }, {})
const realized = net(data.recognitions.filter(r => r.period.startsWith(String(year))))
const validatedTotals = byCurrency(validated, v => v.validated_amount)
const declaredPending = byCurrency(data.validations.filter(v => v.status === 'declared'), v => v.declared_amount)
const targets = byCurrency(data.initiatives.filter(i => i.plan_year === year), i => i.projected_savings_amount)
const lineTargets = {}
const committed = data.plans.find(p => p.plan_year === year)
for (const line of data.lines.filter(l => l.annual_plan_id === committed.id)) lineTargets[line.currency] = (lineTargets[line.currency] || 0) + Number(line.target_amount)
check('metas: la meta del plan por moneda es la suma de las metas de sus iniciativas', Object.keys(targets).every(c => Math.round(targets[c]) === Math.round(lineTargets[c] || 0)), `${JSON.stringify(targets)} vs ${JSON.stringify(lineTargets)}`)
check('ahorros: el realizado nunca supera lo validado por moneda', Object.keys(realized).every(c => realized[c] <= (validatedTotals[c] || 0)), `${JSON.stringify(realized)} <= ${JSON.stringify(validatedTotals)}`)
const adjudicated = byCurrency(data.awards, a => a.estimated_savings)
const negotiatedExpected = {}
for (const v of data.validations.filter(item => item.status !== 'returned' && item.status !== 'withdrawn')) negotiatedExpected[v.currency] = (negotiatedExpected[v.currency] || 0) + Number(v.declared_amount)
check('ahorros: negociado de las adjudicaciones = declarado (cada adjudicación ya declaró su ahorro)', Object.keys(adjudicated).every(c => adjudicated[c] <= (negotiatedExpected[c] || 0)), `${JSON.stringify(adjudicated)}`)

const browser = await chromium.launch({ headless: true })
const textOf = async (page, id) => (await page.getByTestId(id).innerText()).replace(/\s+/g, ' ')

try {
  // ---- 2. Gerente: el tablero coincide con los registros ----------------------------------------------------------------------------
  const manager = await login(browser, creds.users.manager)
  const mp = manager.page
  await mp.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  await mp.getByTestId('vista-gerencia').waitFor()
  await mp.waitForTimeout(2500)
  const table = await textOf(mp, 'gestion-ahorros')
  for (const currency of Object.keys(targets)) {
    const row = table.slice(table.indexOf(currency))
    check(`tablero ${currency}: meta del plan = suma de iniciativas`, row.includes(fmt(Math.round(targets[currency]))), fmt(Math.round(targets[currency])))
    if (validatedTotals[currency]) check(`tablero ${currency}: validado = suma de validaciones`, row.includes(fmt(validatedTotals[currency])), fmt(validatedTotals[currency]))
    if (realized[currency]) check(`tablero ${currency}: realizado del año = reconocimientos netos de reversas`, row.includes(fmt(realized[currency])), fmt(realized[currency]))
    if (declaredPending[currency]) check(`tablero ${currency}: por validar = declaraciones pendientes`, row.includes(fmt(declaredPending[currency])), fmt(declaredPending[currency]))
  }
  check('tablero: no mezcla monedas (CLP y USD en filas separadas)', /CLP/.test(table) && /USD/.test(table))
  const load = await textOf(mp, 'carga-personas')
  check('tablero: carga por persona con los cuatro Category Managers', ['Valentina Rojas', 'Matías Soto', 'Camila Fuentes', 'Diego Navarro'].every(name => load.includes(name)))
  const risk = await textOf(mp, 'en-riesgo')
  check('tablero: procesos atrasados con causa (transporte y seguridad)', /Licitación de transporte/.test(risk) && /Seguridad y vigilancia/.test(risk) && /espera a: /.test(risk))
  const pending = await textOf(mp, 'gestion-por-validar')
  check('tablero: la declaración de telecomunicaciones espera validación de otra persona', /Renovación de enlaces/.test(pending) && /declarado por Camila Fuentes/.test(pending))
  const plan = await textOf(mp, 'plan-anual-card')
  check('tablero: plan anual con gasto base y meta por moneda', /Comprometido/.test(plan) && /CLP/.test(plan) && /USD/.test(plan))
  const stageRows = await mp.getByTestId('matriz-etapas').locator('tbody tr').allInnerTexts()
  const stages = stageRows.reduce((total, row) => total + Number(row.trim().split(/\s+/).slice(-1)[0] || 0), 0)
  check('tablero: la matriz de etapas cuenta las iniciativas abiertas con hitos', stages >= 10, `${stages}`)
  await shot(mp, 'qa-gerente-gerencia')
  check('gerente: no ve la vista de Administración, sí Gerencia y Mi trabajo', (await mp.getByTestId('perspectiva-administracion').count()) === 0 && (await mp.getByTestId('perspectiva-gerencia').count()) === 1 && (await mp.getByTestId('perspectiva-trabajo').count()) === 1)
  await manager.context.close()

  // ---- 3. Administrador, comprador, viewer y proveedor, cada uno con su cuenta -----------------------------------------------------
  const admin = await login(browser, creds.users.admin)
  await admin.page.goto(`${BASE}/dashboard?vista=administracion`, { waitUntil: 'networkidle' })
  await admin.page.getByTestId('vista-administracion').waitFor()
  check('administrador: ve Administración con usuarios, equipos y categorías', /Usuarios|Equipos|Categorías/.test(await body(admin.page)))
  check('administrador: no ve el acceso exclusivo del Super Admin', (await admin.page.getByTestId('link-super-admin').count()) === 0)
  await admin.context.close()

  const buyer = await login(browser, creds.users.buyer1)
  const bp = buyer.page
  await bp.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  await bp.waitForTimeout(2500)
  const buyerText = await body(bp)
  check('comprador: su portafolio muestra sus iniciativas', /Mantención preventiva de planta/.test(buyerText))
  check('comprador: sin selector de perspectiva ni tablero gerencial', (await bp.getByTestId('selector-perspectiva').count()) === 0 && (await bp.getByTestId('vista-gerencia').count()) === 0)
  await bp.goto(`${BASE}/gestion`, { waitUntil: 'networkidle' })
  check('comprador: /gestion no entrega el panel gerencial', (await bp.getByTestId('carga-personas').count()) === 0)
  await bp.goto(`${BASE}/ahorros`, { waitUntil: 'networkidle' })
  check('comprador: puede declarar pero no validar', (await bp.getByRole('button', { name: 'Validar ahorro' }).count()) === 0)
  await buyer.context.close()

  const viewer = await login(browser, creds.users.viewer)
  const vp = viewer.page
  await vp.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  await vp.waitForTimeout(1500)
  check('viewer: solo lectura, sin acciones para crear', (await vp.getByText('Comenzar algo nuevo').count()) === 0 && (await vp.getByTestId('selector-perspectiva').count()) === 0)
  await vp.goto(`${BASE}/ahorros`, { waitUntil: 'networkidle' })
  check('viewer: no declara ni valida ahorros', (await vp.getByRole('button', { name: /Declarar ahorro|Validar ahorro/ }).count()) === 0)
  await viewer.context.close()

  const supplier = await login(browser, creds.users.supplier_norte)
  const sp = supplier.page
  await sp.waitForURL(/\/sala|\/proveedor|\/portal/, { timeout: 20000 }).catch(() => undefined)
  check('proveedor: su sesión entra a su portal', /\/sala|\/proveedor|\/portal/.test(sp.url()), sp.url())
  await sp.goto(`${BASE}/gestion`, { waitUntil: 'networkidle' })
  await sp.waitForTimeout(1000)
  check('proveedor: no accede al panel de gestión', (await sp.getByTestId('carga-personas').count()) === 0 && !/Panel de gestión/.test((await body(sp)).slice(0, 600)))
  await supplier.context.close()

  // ---- 4. Super Admin (solo local): perspectivas y empresa autorizada ----------------------------------------------------------------
  if (creds.users.superadmin) {
    const superAdmin = await login(browser, creds.users.superadmin)
    const page = superAdmin.page
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
    await page.getByTestId('tenant-select').waitFor()
    const options = await page.getByTestId('tenant-select').locator('option').allInnerTexts()
    check('super admin: el selector lista solo su empresa y la demo autorizada', options.length === 2 && options.some(o => /tu empresa/.test(o)) && options.some(o => /DEMO/.test(o)), options.join(' / '))
    check('super admin: su empresa propia no muestra datos ni marca de demostración', (await page.getByTestId('demo-badge').count()) === 0)
    await page.getByTestId('tenant-select').selectOption(companyId)
    await page.waitForURL(/\/dashboard/)
    await page.getByTestId('demo-badge').waitFor()
    check('super admin: tras cambiar de empresa la marca DEMO es explícita', /XPEND Company S\.A\. \(DEMO\)/.test(await textOf(page, 'demo-badge')))
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
    await page.getByTestId('vista-gerencia').waitFor()
    check('super admin: Gerencia es la perspectiva predeterminada', true)
    await page.waitForTimeout(2500)
    const sa = await textOf(page, 'gestion-ahorros')
    check('super admin: Gerencia muestra las mismas cifras que el gerente (CLP y USD)', sa.includes(fmt(Math.round(targets.CLP))) && sa.includes(fmt(Math.round(targets.USD))))
    check('super admin: ve en Gerencia el plan anual, la carga del equipo y los atrasos', (await page.getByTestId('plan-anual-card').count()) === 1 && /Matías Soto/.test(await textOf(page, 'carga-personas')) && /Seguridad y vigilancia/.test(await textOf(page, 'en-riesgo')))
    await shot(page, 'qa-superadmin-gerencia')
    const role = async () => (await body(page)).match(/SUPER ADMINISTRADOR/)?.[0]
    await page.getByTestId('perspectiva-trabajo').click()
    await page.getByTestId('mi-trabajo-vacio').waitFor()
    check('super admin: Mi trabajo sin asignaciones muestra un vacío honesto, no trabajo ajeno', /No tienes categorías, iniciativas ni procesos asignados a tu usuario/.test(await body(page)) && (await role()) === 'SUPER ADMINISTRADOR')
    await page.locator('#ver-portafolio').selectOption({ label: 'Valentina Rojas' })
    await page.getByText('Estás viendo el trabajo de Valentina Rojas en modo consulta').waitFor()
    check('super admin: puede consultar el portafolio de un comprador, marcado como consulta', /Mantención preventiva de planta/.test(await body(page)))
    await shot(page, 'qa-superadmin-mi-trabajo')
    await page.getByTestId('perspectiva-administracion').click()
    await page.getByTestId('vista-administracion').waitFor()
    check('super admin: Administración con accesos exclusivos de la plataforma', (await page.getByTestId('link-super-admin').count()) === 1 && (await role()) === 'SUPER ADMINISTRADOR')
    await shot(page, 'qa-superadmin-administracion')
    await page.goto(`${BASE}/dashboard?vista=gerencia`, { waitUntil: 'networkidle' })
    check('super admin: la perspectiva se elige por enlace sin cambiar la identidad', (await page.getByTestId('vista-gerencia').count()) === 1)
    const { data: identity } = await serviceClient.from('profiles').select('email, role').eq('id', creds.ids.superadmin).single()
    check('super admin: su rol y su correo siguen intactos tras usar las tres perspectivas', identity?.role === 'super_admin' && identity?.email === creds.users.superadmin.email)
    // Móvil
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const mpage = await mobile.newPage()
    await mpage.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
    await mpage.getByPlaceholder('tu@correo.com').fill(creds.users.superadmin.email)
    await mpage.getByPlaceholder('Contraseña').fill(creds.users.superadmin.password)
    await mpage.getByRole('button', { name: 'Entrar' }).click()
    await mpage.waitForURL(url => !url.pathname.includes('/login'))
    for (const view of ['gerencia', 'trabajo', 'administracion']) {
      await mpage.goto(`${BASE}/dashboard?vista=${view}`, { waitUntil: 'networkidle' })
      await mpage.waitForTimeout(1500)
      const overflow = await mpage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      check(`móvil (390px): ${view} sin desborde horizontal de la página`, overflow <= 1, `desborde ${overflow}px`)
    }
    await shot(mpage, 'qa-superadmin-movil')
    await mobile.close()
    // Volver a la empresa propia y comprobar el aislamiento visible
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
    await page.getByTestId('tenant-select').selectOption({ index: 0 })
    await page.waitForURL(/\/dashboard/)
    await page.goto(`${BASE}/sourcing-plan`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    const home = await body(page)
    check('super admin: en su empresa propia no aparece ninguna iniciativa demo', !/Mantención preventiva de planta|Renovación de enlaces/.test(home) && (await page.getByTestId('demo-badge').count()) === 0)
    await superAdmin.context.close()
  }

  // ---- 5. Consultas directas a la API con la sesión de cada rol (RLS y funciones) ------------------------------------------------------
  const clients = {}
  for (const key of ['admin', 'manager', 'buyer1', 'buyer3', 'viewer', 'supplier_norte']) clients[key] = await signedIn(creds.users[key].email, creds.users[key].password)
  for (const key of ['admin', 'manager', 'buyer1', 'viewer']) {
    let foreign = 0
    for (const table of ['licitaciones', 'sourcing_plans', 'contracts', 'savings_validations', 'suppliers', 'annual_plans', 'si_spend_lines']) {
      const { data: rows } = await clients[key].from(table).select('company_id').limit(1000)
      foreign += (rows || []).filter(row => row.company_id !== companyId).length
    }
    check(`API ${key}: ninguna fila de otra empresa en ocho tablas de negocio`, foreign === 0)
  }
  const supplierView = await Promise.all(['sourcing_plans', 'contracts', 'savings_validations', 'annual_plans', 'si_spend_lines', 'process_awards'].map(table => clients.supplier_norte.from(table).select('id', { count: 'exact', head: true })))
  check('API proveedor: no lee planes, contratos, ahorros, gasto ni adjudicaciones', supplierView.every(result => (result.count || 0) === 0))
  const viewerWrite = await clients.viewer.from('sourcing_plans').insert({ company_id: companyId, plan_year: year, quarter: 'Q1', initiative_type: 'licitacion', title: 'No debería crearse', status: 'planned' })
  check('API viewer: no puede crear iniciativas', Boolean(viewerWrite.error))
  const buyerAssign = await clients.buyer1.rpc('assign_category', { p_category: creds.categoryIds.mant, p_manager: creds.ids.buyer1, p_backup: creds.ids.buyer2, p_team: null, p_reason: 'Prueba de permisos' })
  check('API comprador: no puede reasignar categorías', Boolean(buyerAssign.error), buyerAssign.error?.message)
  const pendingId = data.validations.find(v => v.status === 'declared')?.id
  const selfValidate = await clients.buyer3.rpc('validate_savings', { p_validation: pendingId, p_validated: 1, p_method: 'Intento de autovalidación', p_note: null })
  check('API: quien declaró no puede validar su propio ahorro', Boolean(selfValidate.error), selfValidate.error?.message)
  const viewerValidate = await clients.viewer.rpc('validate_savings', { p_validation: pendingId, p_validated: 1, p_method: 'Intento de un viewer', p_note: null })
  check('API viewer: no puede validar ahorros', Boolean(viewerValidate.error), viewerValidate.error?.message)
  const switchAttempt = await clients.manager.rpc('switch_tenant', { p_company: companyId })
  check('API gerente: no puede cambiar de empresa (solo el Super Admin autorizado)', Boolean(switchAttempt.error), switchAttempt.error?.message)
  const viewerReads = await clients.viewer.from('savings_validations').select('id', { count: 'exact', head: true })
  check('API viewer: lee los ahorros de su empresa (auditoría) y nada más', (viewerReads.count || 0) === data.validations.length)
  void sum
} finally {
  await browser.close()
}
summary()
console.log(`(destino ${TARGET}, base ${BASE})`)
