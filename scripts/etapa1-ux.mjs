import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const base = process.env.XPEND_QA_BASE || 'http://127.0.0.1:3031'
const shots = process.env.XPEND_QA_SHOTS || fileURLToPath(new URL('../docs/etapa1/capturas', import.meta.url))
const ANALYST_EMAIL = 'comprador.etapa1@xpend.test'
mkdirSync(shots, { recursive: true })

function readEnv(path) {
  const values = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '')
  }
  return values
}

const env = readEnv(new URL('../.env.local', import.meta.url))
const local = { url: env.NEXT_PUBLIC_SUPABASE_URL, anon: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service: env.SUPABASE_SERVICE_ROLE_KEY }
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(local.url || '')) {
  throw new Error('Supabase no es local. No se cambia ningún usuario.')
}
const admin = { apikey: local.service, Authorization: `Bearer ${local.service}`, 'Content-Type': 'application/json' }

async function rest(path, init = {}) {
  const response = await fetch(`${local.url}/rest/v1/${path}`, { ...init, headers: { ...admin, Prefer: 'return=representation', ...(init.headers || {}) } })
  const text = await response.text()
  if (!response.ok) throw new Error(`${path}: ${response.status} ${text}`)
  return text ? JSON.parse(text) : null
}

async function userByEmail(email) {
  const response = await fetch(`${local.url}/auth/v1/admin/users?per_page=200`, { headers: admin })
  const body = await response.json()
  return (body.users || []).find(user => user.email === email) || null
}

const fixtures = readEnv('/Users/diegojorreto/Cursor Projects/Xpend/Xpend V3 - Desarrollo/supabase/.env.fase0.local')
const fixturePasswords = Object.fromEntries(['BUYER', 'VIEWER', 'SUPPLIER', 'OTHER_TENANT']
  .map(key => [fixtures[`XPEND_FASE0_${key}_EMAIL`], fixtures[`XPEND_FASE0_${key}_PASSWORD`]])
  .filter(([email, password]) => email && password))

async function setPassword(email) {
  let user = await userByEmail(email)
  if (user && fixturePasswords[email]) return { id: user.id, password: fixturePasswords[email] }
  const password = `Qa-${randomBytes(18).toString('base64url')}`
  if (!user) {
    const created = await fetch(`${local.url}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password, email_confirm: true }) })
    user = await created.json()
    if (!created.ok) throw new Error(`no se creó ${email}`)
  } else {
    const updated = await fetch(`${local.url}/auth/v1/admin/users/${user.id}`, { method: 'PUT', headers: admin, body: JSON.stringify({ password }) })
    if (!updated.ok) throw new Error(`no se actualizó ${email}`)
  }
  return { id: user.id, password }
}

const results = []
const consoleErrors = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` · ${detail}` : ''}`)
}

const roles = {
  admin: 'buyer.fase0@xpend.test',
  manager: 'gerente.f1b@xpend.test',
  analyst: ANALYST_EMAIL,
  viewer: 'viewer.fase0@xpend.test',
  supplier: 'supplier.fase0@xpend.test',
}

const creds = {}
for (const [role, email] of Object.entries(roles)) creds[role] = { email, ...(await setPassword(email)) }

const manager = (await rest(`profiles?id=eq.${creds.manager.id}&select=company_id`))[0]
await rest('profiles?on_conflict=id', {
  method: 'POST',
  headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify({ id: creds.analyst.id, email: ANALYST_EMAIL, full_name: 'Camila Comprador', role: 'analyst', company_id: manager.company_id, must_change_password: false }),
})

// Temporarily assign a few existing local rows to the analyst; restored in finally.
const borrowed = []
async function borrow(table, filter, idColumn = 'id') {
  const rows = await rest(`${table}?${filter}&select=${idColumn},responsible_user_id&limit=1`)
  if (!rows.length) return null
  borrowed.push({ table, id: rows[0][idColumn], idColumn, original: rows[0].responsible_user_id })
  await rest(`${table}?${idColumn}=eq.${encodeURIComponent(rows[0][idColumn])}`, { method: 'PATCH', body: JSON.stringify({ responsible_user_id: creds.analyst.id }) })
  return rows[0][idColumn]
}

const browser = await chromium.launch({ headless: true })

async function login(role, viewport) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  page.setDefaultTimeout(30000)
  page.on('console', message => {
    if (message.type() === 'error' && !/Failed to load resource|favicon/.test(message.text())) consoleErrors.push(`${role}: ${message.text().slice(0, 160)}`)
  })
  page.on('pageerror', error => consoleErrors.push(`${role} pageerror: ${error.message.slice(0, 160)}`))
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' })
  await page.getByPlaceholder('tu@correo.com').fill(creds[role].email)
  await page.getByPlaceholder('Contraseña').fill(creds[role].password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30000 })
  return { context, page }
}

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForFunction(() => !document.querySelector('.animate-spin'), null, { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(300)
}

async function bodyText(page) {
  return page.locator('main').innerText().catch(() => page.locator('body').innerText())
}

async function sidebarLabels(page) {
  return page.locator('nav[aria-label="Navegación principal"] > a, nav[aria-label="Navegación principal"] > div > button').allInnerTexts()
}

const expectedSections = {
  admin: ['Inicio', 'Abastecimiento', 'Inteligencia de gasto', 'Contratos', 'Proveedores', 'Administración'],
  manager: ['Inicio', 'Abastecimiento', 'Inteligencia de gasto', 'Contratos', 'Proveedores'],
  analyst: ['Inicio', 'Abastecimiento', 'Inteligencia de gasto', 'Contratos', 'Proveedores'],
  viewer: ['Inicio', 'Abastecimiento', 'Proveedores'],
}

const routesByRole = {
  admin: ['/sourcing-plan', '/procesos', '/rfx-maker', '/licitaciones', '/sala', '/adjudicaciones', '/reports', '/spend', '/sourcing-intelligence', '/oportunidades', '/comite', '/contratos', '/contratos?vista=pendientes', '/contratos/builder', '/contratos/nuevo', '/suppliers', '/suppliers/new', '/users', '/administracion/roles', '/settings'],
  manager: ['/procesos', '/adjudicaciones', '/comite', '/contratos?vista=pendientes', '/oportunidades'],
  analyst: ['/procesos?mios=1', '/adjudicaciones', '/contratos', '/sourcing-plan'],
  viewer: ['/procesos', '/adjudicaciones', '/sourcing-plan', '/suppliers'],
}

try {
  const rfxId = await borrow('rfx_projects', `company_id=eq.${manager.company_id}&status=eq.draft&archived_at=is.null&order=updated_at.desc`)
  const planId = await borrow('sourcing_plans', `company_id=eq.${manager.company_id}&status=eq.planned&is_spot=eq.false&plan_year=eq.2026&order=updated_at.desc`)
  check('datos locales asignados al comprador', Boolean(rfxId && planId), `rfx ${rfxId ? 'sí' : 'no'} · iniciativa ${planId ? 'sí' : 'no'}`)

  for (const role of ['admin', 'manager', 'analyst', 'viewer']) {
    const { context, page } = await login(role, { width: 1440, height: 960 })
    check(`${role}: el login lleva a Inicio`, new URL(page.url()).pathname === '/dashboard', page.url())
    await settle(page)
    const inicio = await bodyText(page)
    check(`${role}: Inicio saluda y muestra la actividad por tipo (sin embudo ni "Sin acceso")`, /Hola, /.test(inicio) && inicio.includes('Actividad por tipo de registro') && !inicio.includes('Sin acceso'))
    await page.screenshot({ path: join(shots, `inicio-${role}-escritorio.png`), fullPage: true })

    const labels = (await sidebarLabels(page)).map(text => text.trim()).filter(Boolean)
    check(`${role}: secciones del menú`, JSON.stringify(labels) === JSON.stringify(expectedSections[role]), labels.join(' | '))

    const hasLicitacionAction = await page.getByRole('link', { name: /Nueva licitación/ }).count()
    const hasRfxAction = await page.getByRole('link', { name: /Preparar bases \(RFx\)/ }).count()
    if (role === 'analyst') {
      check('analyst: sin acción de licitación (la base no lo permite)', hasLicitacionAction === 0)
      check('analyst: puede preparar bases', hasRfxAction > 0)
      check('analyst: ve sus iniciativas y procesos', inicio.includes('Mis iniciativas asignadas') && inicio.includes('Tu trabajo') && inicio.includes('Por qué:') && !inicio.includes('No tienes iniciativas asignadas'))
      check('analyst: continuar donde quedó', /continuar donde quedaste/i.test(inicio))
      check('analyst: sin aprobaciones de gerente', !inicio.includes('Aprobaciones pendientes'))
    }
    if (role === 'viewer') {
      check('viewer: sin acciones de escritura', hasLicitacionAction === 0 && hasRfxAction === 0 && !inicio.includes('Comenzar algo nuevo'))
      check('viewer: aviso de consulta', inicio.includes('Tu perfil es de consulta'))
      check('viewer: ve el total de adjudicaciones (RLS se lo autoriza) y no ve contratos', inicio.includes('Adjudicaciones registradas') && !inicio.includes('Contratos en preparación'))
    }
    if (role === 'manager' || role === 'admin') {
      check(`${role}: aprobaciones y atención`, inicio.includes('Aprobaciones pendientes') && inicio.includes('Atención en toda la empresa'))
      // Desde la Etapa 6 el Inicio tiene perspectivas: Gerencia (predeterminada), Mi trabajo y, para administradores, Administración.
      await page.goto(`${base}/dashboard?vista=trabajo`, { waitUntil: 'domcontentloaded' })
      await page.getByText('Comenzar algo nuevo').first().waitFor({ timeout: 20000 }).catch(() => undefined)
      await page.waitForTimeout(1500)
      const trabajo = await page.locator('body').innerText()
      const trabajoLicitacion = await page.getByRole('link', { name: /Nueva licitación/ }).count()
      check(`${role}: plan del año sin ahorro realizado inventado`, /Metas y ahorro/.test(inicio) && /Realizado en el año|Sin información/.test(inicio) && !/Ahorro realizado\s*\n?\s*(USD|CLP|\$)/.test(inicio + trabajo))
      check(`${role}: acción nueva licitación`, hasLicitacionAction + trabajoLicitacion > 0)
      if (role === 'admin') {
        await page.goto(`${base}/dashboard?vista=administracion`, { waitUntil: 'domcontentloaded' })
        await page.getByTestId('vista-administracion').waitFor({ timeout: 20000 })
        check('admin: tarjeta de administración', (await page.locator('body').innerText()).includes('Roles y permisos'))
      }
      await page.goto(`${base}/dashboard`, { waitUntil: 'domcontentloaded' })
    }

    for (const route of routesByRole[role]) {
      const response = await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded' })
      await settle(page)
      const text = await bodyText(page)
      const h1 = await page.locator('main h1').first().innerText().catch(() => '')
      const broken = /Application error|Unhandled Runtime Error|404|This page could not be found/.test(text)
      check(`${role}: ${route}`, response?.status() === 200 && !broken && Boolean(h1), h1)
    }
    await context.close()
  }

  {
    const { context, page } = await login('manager', { width: 1440, height: 960 })
    await settle(page)
    await page.goto(`${base}/licitaciones/LIC-F1B-MANT`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    const crumbs = await page.locator('nav[aria-label="Ruta"]').innerText().catch(() => '')
    check('migas de pan en una licitación', crumbs.replace(/\s+/g, ' ').includes('Abastecimiento') && crumbs.includes('Licitaciones'), crumbs.replace(/\s+/g, ' '))
    const tabs = await page.locator('[role="tablist"][aria-label="Tipo de proceso"]').count()
    check('pestañas de tipo de proceso', tabs === 1)
    const lic = await bodyText(page)
    check('S2C: licitación adjudicada sigue mostrando su adjudicación', lic.includes('150') && !/Ahorro realizado:?\s*(USD|\$)\s*\d/.test(lic))
    await page.screenshot({ path: join(shots, 'licitacion-migas-escritorio.png'), fullPage: false })

    await page.goto(`${base}/comite`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    const cierre = await bodyText(page)
    check('Comité renombrado a Cierre mensual de gasto', cierre.includes('Cierre mensual de gasto') && cierre.includes('Ir a Adjudicaciones'))

    await page.goto(`${base}/adjudicaciones`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    const adj = await bodyText(page)
    check('Adjudicaciones lista decisiones con su contrato', adj.includes('Adjudicaciones registradas') && /Ver contrato|Preparar contrato/.test(adj))
    check('Adjudicaciones no muestra ahorro realizado con monto', !/Ahorro realizado:?\s*(USD|\$)\s*\d/.test(adj))
    await page.screenshot({ path: join(shots, 'adjudicaciones-escritorio.png'), fullPage: true })

    await page.goto(`${base}/dashboard`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    await page.getByLabel('Buscar procesos por nombre o código').fill('MANT')
    await page.keyboard.press('Enter')
    await page.waitForURL(/\/procesos\?q=MANT/)
    await settle(page)
    const procesos = await bodyText(page)
    check('el buscador superior encuentra procesos', procesos.includes('LIC-F1B-MANT') || /Mantenimiento/i.test(procesos), page.url())
    await page.screenshot({ path: join(shots, 'procesos-busqueda-escritorio.png'), fullPage: true })

    await page.goto(`${base}/contratos/43c31453-6713-4de9-b167-26bc6e0b95ee`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    const contract = await bodyText(page)
    check('Contracts: el contrato de la adjudicación abre', contract.includes('CTR-LIC-F1B-MANT'))
    const ana = await page.getByRole('button', { name: /ANA/i }).count()
    check('ANA sigue disponible', ana > 0)
    await context.close()
  }

  {
    // Coherencia: cada número de Inicio debe coincidir con la lista a la que enlaza.
    const tileValue = async (page, label) => {
      const aria = await page.locator(`a[aria-label^="${label}:"]`).first().getAttribute('aria-label').catch(() => null)
      const match = aria && aria.match(/:\s*(\d+)\./)
      return match ? Number(match[1]) : null
    }
    for (const role of ['manager', 'analyst', 'viewer']) {
      const { context, page } = await login(role, { width: 1440, height: 960 })
      await settle(page)
      for (const [label, route] of [['RFx en curso', '/procesos?tipo=rfx'], ['Licitaciones en curso', '/procesos?tipo=licitacion'], ['Salas de ofertas activas', '/procesos?tipo=sala']]) {
        const value = await tileValue(page, label)
        await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded' })
        await settle(page)
        const rows = await page.locator('main ul.divide-y > li').count()
        check(`${role}: "${label}" (${value}) coincide con su lista`, value !== null && value === rows, `lista ${rows}`)
        await page.goto(`${base}/dashboard`, { waitUntil: 'domcontentloaded' })
        await settle(page)
      }
      const awards = await tileValue(page, 'Adjudicaciones registradas')
      await page.goto(`${base}/adjudicaciones`, { waitUntil: 'domcontentloaded' })
      await settle(page)
      const adjText = await bodyText(page)
      const listed = Number((adjText.match(/Adjudicaciones registradas \((\d+)\)/) || [])[1])
      check(`${role}: "Adjudicaciones registradas" (${awards}) coincide con la página de Adjudicaciones`, awards !== null && awards === listed, `página ${listed}`)
      await page.goto(`${base}/dashboard`, { waitUntil: 'domcontentloaded' })
      await settle(page)
      const small = await page.evaluate(() => {
        const out = []
        const walker = document.createTreeWalker(document.querySelector('main') || document.body, NodeFilter.SHOW_TEXT)
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const el = node.parentElement
          if (!el || !node.textContent.trim() || el.closest('.sr-only')) continue
          const size = parseFloat(getComputedStyle(el).fontSize)
          if (size < 12) out.push(`${size}px ${node.textContent.trim().slice(0, 30)}`)
        }
        return out
      })
      check(`${role}: Inicio sin texto menor a 12px`, small.length === 0, small.slice(0, 3).join(' | '))
      await context.close()
    }
  }

  {
    const { context, page } = await login('manager', { width: 1440, height: 960 })
    await settle(page)
    await page.goto(`${base}/procesos`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    const tabsGroup = await page.locator('[role="tablist"][aria-label="Tipo de proceso"]').count()
    const typeGroups = await page.locator('[role="group"][aria-label="Tipo de proceso"]').count()
    const stageSelect = await page.getByLabel('Etapa', { exact: true }).count()
    const statusSelect = await page.getByLabel('Estado', { exact: true }).count()
    check('Procesos: un solo selector de tipo (pestañas), sin repetirlo en filtros', tabsGroup === 1 && typeGroups === 0 && stageSelect === 0, `pestañas ${tabsGroup} · grupos ${typeGroups} · etapa ${stageSelect}`)
    check('Procesos: conserva búsqueda, estado y responsable', statusSelect === 1 && (await page.getByLabel('Buscar por nombre o código').count()) === 1 && (await page.getByText('Solo donde soy responsable').count()) === 1)
    const reasons = await page.getByText(/^[A-ZÁÉÍÓÚ].+/, { exact: false }).count()
    check('Procesos: cada fila explica el estado', (await bodyText(page)).length > 0 && reasons > 0)
    for (const tab of ['RFx (bases)', 'Licitaciones', 'Salas de ofertas']) {
      check(`Procesos: acceso independiente a ${tab}`, (await page.locator('[role="tablist"][aria-label="Tipo de proceso"]').getByRole('tab', { name: tab, exact: true }).count()) === 1)
    }
    await page.goto(`${base}/licitaciones/LIC-F1B-MANT`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    const report = page.locator('article[aria-label="Informe de evaluación"]')
    const hasReport = (await report.count()) > 0
    check('Informe de evaluación con secciones, ranking y fundamentos', hasReport && (await report.getByRole('heading', { name: /Ranking de ofertas/i }).count()) === 1 && (await report.locator('table').count()) === 1 && (await report.getByRole('heading', { name: /Recomendación/i }).count()) === 1)
    if (hasReport) {
      await report.scrollIntoViewIfNeeded()
      await report.screenshot({ path: join(shots, 'informe-evaluacion-escritorio.png') })
    }
    await context.close()
  }

  for (const role of ['manager', 'analyst', 'viewer']) {
    const { context, page } = await login(role, { width: 390, height: 844 })
    await settle(page)
    await page.screenshot({ path: join(shots, `inicio-${role}-movil.png`), fullPage: true })
    const hiddenNav = await page.locator('nav[aria-label="Navegación principal"]').isVisible()
    check(`${role} móvil: el menú empieza cerrado`, !hiddenNav)
    await page.getByRole('button', { name: 'Abrir menú' }).click()
    await page.waitForTimeout(400)
    check(`${role} móvil: el menú se abre`, await page.locator('nav[aria-label="Navegación principal"]').isVisible())
    await page.screenshot({ path: join(shots, `menu-${role}-movil.png`) })
    if (role === 'manager') {
      const nav = page.locator('nav[aria-label="Navegación principal"]')
      await nav.getByRole('button', { name: 'Abastecimiento' }).click()
      await nav.getByRole('link', { name: 'Procesos' }).click()
      await page.waitForURL(/\/procesos/)
      await settle(page)
      check('manager móvil: navega a Procesos y cierra el menú', !(await page.locator('nav[aria-label="Navegación principal"]').isVisible()))
      await page.screenshot({ path: join(shots, 'procesos-manager-movil.png'), fullPage: true })
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    check(`${role} móvil: sin desborde horizontal`, overflow <= 1, `${overflow}px`)
    await context.close()
  }

  {
    const { context, page } = await login('supplier', { width: 1440, height: 960 })
    await settle(page)
    check('proveedor: el login termina en su portal', new URL(page.url()).pathname === '/sala', page.url())
    for (const route of ['/dashboard', '/procesos', '/adjudicaciones', '/oportunidades', '/administracion/roles', '/contratos']) {
      await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded' })
      await page.waitForURL(url => url.pathname === '/sala', { timeout: 15000 }).catch(() => {})
      check(`proveedor: ${route} lo devuelve a su portal`, new URL(page.url()).pathname === '/sala', page.url())
    }
    await settle(page)
    const labels = (await sidebarLabels(page)).map(text => text.trim()).filter(Boolean)
    check('proveedor: menú solo con Mis procesos', JSON.stringify(labels) === '["Mis procesos"]', labels.join(' | '))
    const text = await bodyText(page)
    check('proveedor: sin plan, gasto, ahorros ni contratos internos', !/Plan de abastecimiento|Inteligencia de gasto|Ahorro objetivo|Adjudicaciones registradas/.test(text))
    const selectorText = await page.getByRole('button').filter({ hasText: /\S/ }).first().innerText().catch(() => '')
    check('proveedor: el selector muestra su propia empresa, no la compradora', selectorText.length > 0 && !/Compradora/i.test(selectorText), selectorText.trim())
    await page.getByRole('button').filter({ hasText: /\S/ }).first().click().catch(() => {})
    await page.waitForTimeout(250)
    const dropdown = await page.locator('[role="menu"]').innerText().catch(() => '')
    check('proveedor: el selector no ofrece cambiar de empresa', /Invitado por|Mis procesos/.test(dropdown) && !/Seleccionar empresa/.test(dropdown), dropdown.trim())
    await page.keyboard.press('Escape')
    await page.screenshot({ path: join(shots, 'proveedor-escritorio.png'), fullPage: true })
    await context.close()
  }

  {
    const [lic] = await rest('licitaciones?select=id&id=eq.LIC-F1B-MANT')
    const [sala] = await rest(`offer_events?select=id&company_id=eq.${manager.company_id}&order=created_at.desc&limit=1`)
    const [supplier] = await rest(`suppliers?select=id&company_id=eq.${manager.company_id}&limit=1`)
    const writeButtons = { lic: /^(Abrir sala|Editar|Eliminar)$/, sala: /^(Abrir sala|Cerrar recepción|Abrir sobres|Abrir siguiente ronda|Reenviar acceso|Agregar e invitar|Invitar|Publicar documento|Exigir NDA|Responder en privado|Publicar aclaración)$/, supplier: /^(Editar|Eliminar)$/ }
    for (const role of ['manager', 'analyst', 'viewer']) {
      const { context, page } = await login(role, { width: 1280, height: 900 })
      const pages = [['lic', `/licitaciones/${lic.id}`], ['sala', `/sala/${sala.id}`], ['supplier', `/suppliers/${supplier.id}`]]
      for (const [kind, path] of pages) {
        await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' })
        await settle(page)
        const count = await page.getByRole('button', { name: writeButtons[kind] }).count()
        if (role === 'manager') check(`manager: ve las acciones de ${kind}`, count > 0, `${count}`)
        else check(`${role}: no ve acciones de escritura en ${kind}`, count === 0, `${count}`)
      }
      await context.close()
    }
  }

  {
    const { context, page } = await login('manager', { width: 1440, height: 960 })
    await settle(page)
    await page.goto(`${base}/procesos`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    await page.screenshot({ path: join(shots, 'procesos-escritorio.png'), fullPage: true })
    await page.goto(`${base}/sourcing-plan`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    await page.screenshot({ path: join(shots, 'plan-escritorio.png'), fullPage: false })
    await context.close()
    const adminSession = await login('admin', { width: 1440, height: 960 })
    await adminSession.page.goto(`${base}/administracion/roles`, { waitUntil: 'domcontentloaded' })
    await settle(adminSession.page)
    await adminSession.page.screenshot({ path: join(shots, 'roles-escritorio.png'), fullPage: true })
    await adminSession.context.close()
  }
} finally {
  for (const row of borrowed) {
    await rest(`${row.table}?${row.idColumn}=eq.${encodeURIComponent(row.id)}`, { method: 'PATCH', body: JSON.stringify({ responsible_user_id: row.original }) }).catch(error => console.log(`no se restauró ${row.table}: ${error.message}`))
  }
  await browser.close()
}

const failed = results.filter(result => !result.ok)
writeFileSync(join(shots, 'resultado.json'), JSON.stringify({ results, consoleErrors }, null, 2))
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones · errores de consola: ${consoleErrors.length}`)
for (const error of consoleErrors.slice(0, 15)) console.log(`  consola: ${error}`)
process.exit(failed.length ? 1 : 0)
