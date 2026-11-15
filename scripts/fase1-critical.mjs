import { randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Document, Packer, Paragraph } from 'docx'
import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'
import { chromium } from 'playwright'

const base = 'http://127.0.0.1:3027'
const stamp = Date.now().toString().slice(-6)
const title = `QA Fase 1 ${stamp}`
const licitacionId = `LIC-QA-${stamp}`
const work = mkdtempSync(join(tmpdir(), 'xpend-qa-'))
const results = []

function readEnv(path) {
  const values = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match) continue
    values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '')
  }
  return values
}

function pass(name) {
  results.push(`${name}:ok`)
  console.log(`${name}:ok`)
}

function fail(name, detail) {
  results.push(`${name}:${detail}`)
  console.log(`${name}:${detail}`)
  throw new Error(`${name}: ${detail}`)
}

async function canSignIn(local, email, password) {
  const response = await fetch(`${local.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: local.anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return response.ok
}

async function ensureLocalPassword(local, email, userId, preferred) {
  if (preferred && await canSignIn(local, email, preferred)) return preferred
  if (!/127\.0\.0\.1|localhost/.test(local.url)) {
    throw new Error('La URL de Auth no es local. No se cambió ninguna contraseña.')
  }
  const password = `Qa-${randomBytes(18).toString('base64url')}`
  const response = await fetch(`${local.url}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      apikey: local.service,
      Authorization: `Bearer ${local.service}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  })
  if (!response.ok || !await canSignIn(local, email, password)) {
    throw new Error(`No quedó usable el acceso local de ${email}.`)
  }
  console.log(`acceso local preparado: ${email}`)
  return password
}

async function session(browser, email, password, viewport = { width: 1280, height: 800 }) {
  const context = await browser.newContext({ acceptDownloads: true, viewport })
  const page = await context.newPage()
  page.setDefaultTimeout(30000)
  await page.goto(`${base}/login`, { waitUntil: 'networkidle', timeout: 90000 })
  await page.getByPlaceholder('tu@correo.com').fill(email)
  await page.getByPlaceholder('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  try {
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30000 })
  } catch (error) {
    const message = await page.locator('p.text-red-600').innerText().catch(() => '')
    throw new Error(message || (error instanceof Error ? error.message : 'No salió del login'))
  }
  return { context, page }
}

async function askAna(page, question) {
  await page.getByRole('button', { name: 'Abrir chat de ANA' }).click()
  const field = page.getByPlaceholder('Pregunta por este registro...')
  await field.waitFor()
  const pending = page.waitForResponse(response => response.url().includes('/api/ana') && response.request().method() === 'POST', { timeout: 45000 })
  await field.fill(question)
  await page.locator('form').getByRole('button').click()
  const response = await pending
  return response.json()
}

async function exportFile(page, contractId, format) {
  const payload = await page.evaluate(async ({ contractId, format }) => {
    const response = await fetch(`/api/contracts/${contractId}/export?format=${format}`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    let binary = ''
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
    }
    return { ok: response.ok, status: response.status, b64: btoa(binary) }
  }, { contractId, format })
  if (!payload.ok) fail(`export-${format}`, `http ${payload.status}`)
  return Buffer.from(payload.b64, 'base64')
}

async function setReactValue(locator, value) {
  return locator.evaluate((element, next) => {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
    const previous = element.value
    setter?.call(element, next)
    const tracker = element._valueTracker
    if (tracker) tracker.setValue(previous)
    element.dispatchEvent(new Event('input', { bubbles: true }))
    return element.value
  }, value)
}

async function offer(browser, email, password, eventId, amount, marker, acceptNda) {
  const supplier = await session(browser, email, password)
  try {
    await supplier.page.goto(`${base}/sala/${eventId}/participar`, { waitUntil: 'domcontentloaded' })
    await supplier.page.getByRole('button', { name: 'Aceptar invitación' }).click()
    await supplier.page.getByRole('button', { name: 'Aceptar NDA' }).waitFor()
    if (!acceptNda) {
      const text = await supplier.page.locator('body').innerText()
      if (!text.includes('bloqueados hasta aceptar el NDA')) fail('nda-bloqueado', 'sin aviso de bloqueo')
      if (await supplier.page.getByRole('button', { name: /Descargar/ }).count()) fail('nda-bloqueado', 'había descarga')
      if (await supplier.page.getByRole('button', { name: 'Presentar oferta' }).count()) fail('nda-bloqueado', 'podía ofertar')
      const ana = await askAna(supplier.page, '¿Cuál es el precio de Mantención Alfa?')
      if (!String(ana.text || ana.error || '').includes('no está disponible para un usuario proveedor')) fail('ana-proveedor', 'no rechazó al proveedor')
      if (String(ana.text || '').includes(String(amount))) fail('ana-proveedor', 'devolvió un monto')
      pass('nda-bloqueado')
      pass('ana-proveedor')
      return
    }
    await supplier.page.getByRole('button', { name: 'Aceptar NDA' }).click()
    await supplier.page.getByRole('button', { name: /Descargar/ }).waitFor()
    await supplier.page.getByText('NDA aceptado para esta versión.').waitFor()
    await supplier.page.locator('#technical').fill(marker)
    await supplier.page.locator('#requirement').fill('Cumple habilitación, equipo propio y reporte mensual.')
    await setReactValue(supplier.page.locator('input[placeholder="Partida"]').first(), 'Mantención mensual')
    await setReactValue(supplier.page.locator('input[placeholder="Precio"]').first(), String(amount))
    await supplier.page.getByText(`Total $${Number(amount).toLocaleString('en-US')}`).waitFor({ timeout: 8000 })
    const technical = join(work, `${marker}-tecnica.txt`)
    const economic = join(work, `${marker}-economica.txt`)
    writeFileSync(technical, marker)
    writeFileSync(economic, `Total ${amount}`)
    await supplier.page.locator('#technical-file').setInputFiles(technical)
    await supplier.page.locator('#economic-file').setInputFiles(economic)
    await supplier.page.getByRole('button', { name: 'Presentar oferta' }).click()
    await supplier.page.getByRole('heading', { name: 'Oferta presentada' }).waitFor()
    pass(`oferta-${amount}`)
  } finally {
    await supplier.context.close()
  }
}

async function reviewContract(buyer, managerBrowser, managerPassword, contractId, note) {
  await buyer.goto(`${base}/contratos/${contractId}`, { waitUntil: 'domcontentloaded' })
  const box = buyer.getByPlaceholder('Texto de la nueva versión. La anterior no se modifica.')
  await buyer.waitForFunction(() => {
    const field = document.querySelector('textarea[placeholder="Texto de la nueva versión. La anterior no se modifica."]')
    return field && field.value.length > 40
  })
  const original = await box.inputValue()
  await box.fill(`${original}\n\n${note}`)
  await buyer.getByRole('button', { name: 'Guardar nueva versión' }).click()
  await buyer.getByText('Versión 2 · draft', { exact: true }).waitFor()
  await buyer.getByRole('button', { name: 'Enviar esta versión a revisión' }).click()
  await buyer.getByText('Versión 2 · in_review', { exact: true }).waitFor()

  const manager = await session(managerBrowser, 'gerente.f1b@xpend.test', managerPassword)
  try {
    await manager.page.goto(`${base}/contratos/${contractId}`, { waitUntil: 'domcontentloaded' })
    await manager.page.getByPlaceholder('Observación para devolver esta versión').fill('Falta dejar explícita la renovación manual.')
    await manager.page.getByRole('button', { name: 'Devolver' }).click()
    await manager.page.getByText('Versión 2 · returned', { exact: true }).waitFor()
  } finally {
    await manager.context.close()
  }

  await buyer.reload({ waitUntil: 'domcontentloaded' })
  await buyer.waitForFunction(() => {
    const field = document.querySelector('textarea[placeholder="Texto de la nueva versión. La anterior no se modifica."]')
    return field && field.value.includes('Renovación') || (field && field.value.length > 40)
  })
  const returned = await box.inputValue()
  await box.fill(`${returned}\n\nRenovación manual. Observación del revisor atendida.`)
  await buyer.getByRole('button', { name: 'Guardar nueva versión' }).click()
  await buyer.getByText('Versión 3 · draft', { exact: true }).waitFor()
  await buyer.getByRole('button', { name: 'Enviar esta versión a revisión' }).click()
  await buyer.getByText('Versión 3 · in_review', { exact: true }).waitFor()

  const approver = await session(managerBrowser, 'gerente.f1b@xpend.test', managerPassword)
  try {
    await approver.page.goto(`${base}/contratos/${contractId}`, { waitUntil: 'domcontentloaded' })
    await approver.page.getByRole('button', { name: 'Aprobar esta versión' }).click()
    await approver.page.locator('p').filter({ hasText: /^Versión 3 · approved/ }).waitFor()
  } finally {
    await approver.context.close()
  }

  await buyer.reload({ waitUntil: 'domcontentloaded' })
  const docx = await exportFile(buyer, contractId, 'docx')
  const pdf = await exportFile(buyer, contractId, 'pdf')
  if (docx.subarray(0, 2).toString() !== 'PK') fail('docx', 'no es un archivo ZIP')
  if (pdf.subarray(0, 5).toString() !== '%PDF-') fail('pdf', 'cabecera inválida')
  const word = await mammoth.extractRawText({ buffer: docx })
  const parsed = await new PDFParse({ data: pdf }).getText()
  return { word: word.value, pdf: parsed.text }
}

const appEnv = readEnv(new URL('../.env.local', import.meta.url))
const fase0 = readEnv('/Users/diegojorreto/Cursor Projects/Xpend/Xpend V3 - Desarrollo/supabase/.env.fase0.local')
const local = {
  url: appEnv.NEXT_PUBLIC_SUPABASE_URL,
  anon: appEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  service: appEnv.SUPABASE_SERVICE_ROLE_KEY,
}
if (!/127\.0\.0\.1|localhost/.test(local.url || '')) fail('entorno', 'Supabase del servidor local no es local')

const users = {
  buyer: await ensureLocalPassword(local, 'buyer.fase0@xpend.test', '9c2bb2c7-f961-44c6-84c4-c31c8b817340', fase0.XPEND_FASE0_BUYER_PASSWORD),
  manager: await ensureLocalPassword(local, 'gerente.f1b@xpend.test', '57fa98ea-c33d-432c-b512-26028340f22c', process.env.XPEND_MANAGER_PASSWORD),
  alfa: await ensureLocalPassword(local, 'alfa.f1b@xpend.test', '65b0dc07-2142-4c5f-917e-7d2db2575f8f'),
  beta: await ensureLocalPassword(local, 'beta.f1b@xpend.test', '12dad1db-738f-42af-b124-9c7abd204de6'),
  gamma: await ensureLocalPassword(local, 'gamma.f1b@xpend.test', '919218a5-34d0-4746-b299-c9abe8f804ca'),
  tenant: await ensureLocalPassword(local, 'tenant.fase0@xpend.test', 'ca2f62cd-5327-408f-ac9f-1374d6b31eb1', fase0.XPEND_FASE0_OTHER_TENANT_PASSWORD),
  viewer: await ensureLocalPassword(local, 'viewer.fase0@xpend.test', 'f1136788-9c7b-43b3-82e4-a3713bb8a8c8', fase0.XPEND_FASE0_VIEWER_PASSWORD),
}

const browser = await chromium.launch({ headless: true })
let buyer
try {
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await desktop.goto(`${base}/home`, { waitUntil: 'networkidle', timeout: 90000 })
  const home = await desktop.locator('body').innerText()
  for (const expected of ['Abastecimiento más inteligente', 'XPEND Intelligence', 'XPEND Sourcing', 'XPEND Contracts', 'Empieza con lo que necesitas']) {
    if (!home.includes(expected)) fail('home-desktop', `falta ${expected}`)
  }
  for (const banned of ['Xinergy', 'DUX', 'Newton']) {
    if (home.includes(banned)) fail('home-desktop', `aparece ${banned}`)
  }
  await desktop.getByRole('link', { name: 'Sourcing' }).first().click()
  await desktop.locator('#sourcing').waitFor()
  await desktop.getByRole('link', { name: 'Iniciar sesión' }).first().click()
  await desktop.waitForURL(/\/login/)
  await desktop.close()
  pass('home-desktop')

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await mobile.goto(`${base}/home`, { waitUntil: 'networkidle', timeout: 90000 })
  const mobileText = await mobile.locator('body').innerText()
  if (!mobileText.includes('Abastecimiento más inteligente') || !mobileText.includes('Contracts')) fail('home-movil', 'faltan secciones')
  await mobile.getByRole('button', { name: 'Abrir menú' }).click()
  const mobileNav = mobile.getByRole('navigation', { name: 'Secciones' })
  await mobileNav.waitFor()
  await mobileNav.getByRole('link', { name: 'ANA' }).click()
  await mobile.locator('#ana').waitFor()
  await mobile.close()
  pass('home-movil')

  const buyerSession = await session(browser, 'buyer.fase0@xpend.test', users.buyer)
  buyer = buyerSession.page
  await buyer.goto(`${base}/sourcing-plan/new`, { waitUntil: 'domcontentloaded' })
  await buyer.locator('#title').fill(title)
  await buyer.locator('#description').fill('Mantención de equipos críticos. El objetivo de ahorro no es el resultado.')
  await buyer.locator('#category').fill('Mantenimiento industrial')
  await buyer.locator('#estimated_spend').fill('200000')
  await buyer.locator('#currency').click()
  await buyer.getByRole('option', { name: 'USD', exact: true }).click()
  await buyer.locator('#projected_savings_percentage').fill('10')
  await buyer.getByRole('button', { name: 'Crear Iniciativa' }).click()
  await buyer.waitForURL(url => url.pathname === '/sourcing-plan')
  await buyer.locator('tr', { hasText: title }).locator('button').first().click()
  await buyer.waitForURL(/\/sourcing-plan\/[0-9a-f-]{36}$/)
  const planId = buyer.url().split('/').pop()
  pass('iniciativa')

  await buyer.goto(`${base}/rfx-maker/new?planId=${planId}`, { waitUntil: 'domcontentloaded' })
  await buyer.waitForFunction(expected => {
    const input = document.querySelector('#title')
    return input && input.value.includes(expected)
  }, title)
  await buyer.locator('#alcance').fill('Mantención preventiva mensual de los equipos críticos.')
  await buyer.locator('#requisitos').fill('Técnicos certificados y reporte mensual.')
  await buyer.getByRole('button', { name: 'Crear y llenar' }).click()
  await buyer.waitForURL(/\/rfx-maker\/(?!new)[^/]+$/)
  const rfxId = buyer.url().split('/').pop()
  await buyer.getByRole('button', { name: 'Base Técnica (IA)' }).click()
  await buyer.getByRole('button', { name: 'Editar' }).click()
  await buyer.locator('textarea').last().fill('Base administrativa editada en QA. Plazo de ejecución de 12 meses.')
  await buyer.getByRole('button', { name: 'Guardar Cambios' }).click()
  await buyer.getByText('Base técnica guardada').waitFor()
  pass('rfx')

  await buyer.goto(`${base}/licitaciones/new?planId=${planId}`, { waitUntil: 'domcontentloaded' })
  await buyer.locator('#id').fill(licitacionId)
  await buyer.locator('#name').fill(title)
  await buyer.locator('button', { hasText: title }).first().waitFor()
  await buyer.getByRole('button', { name: 'Crear Licitación' }).click()
  await buyer.waitForURL(new RegExp(`/licitaciones/${licitacionId}$`))
  pass('licitacion')

  await buyer.goto(`${base}/sala/new?planId=${planId}&licitacionId=${licitacionId}`, { waitUntil: 'domcontentloaded' })
  const seeded = await buyer.waitForFunction(expected => [...document.querySelectorAll('input')].some(input => input.value.includes(expected)), title, { timeout: 15000 }).then(() => true).catch(() => false)
  if (!seeded) {
    const fields = buyer.locator('input:not([type]), input[type="text"]')
    await fields.nth(0).fill(title)
    await fields.nth(1).fill('USD')
    await fields.nth(2).fill(licitacionId)
  }
  await buyer.getByRole('button', { name: 'Crear sala' }).click()
  await buyer.waitForURL(/\/sala\/[0-9a-f-]{36}$/)
  const eventId = buyer.url().split('/').pop()
  await buyer.getByPlaceholder('Texto del NDA').fill('NDA QA: las bases técnicas de este proceso son confidenciales.')
  await buyer.getByRole('button', { name: 'Exigir NDA' }).click()
  await buyer.locator('textarea:not([placeholder])').first().fill('Documento confidencial QA. No distribuir las bases.')
  await buyer.getByRole('button', { name: 'Publicar documento' }).click()
  await buyer.getByText('Documento publicado').waitFor()
  for (const supplier of ['Mantención Alfa', 'Mantención Beta', 'Mantención Gamma']) {
    const input = buyer.getByPlaceholder(`Correo de ${supplier}`)
    await input.locator('xpath=..').getByRole('button', { name: 'Invitar' }).click()
    await buyer.getByText(`${supplier} · invited`).waitFor()
  }
  await buyer.getByRole('button', { name: 'Abrir sala' }).click()
  await buyer.getByRole('button', { name: 'Cerrar recepción' }).waitFor()
  pass('sala-invitaciones')

  await offer(browser, 'alfa.f1b@xpend.test', users.alfa, eventId, 150000, 'Ejecución Alfa QA con equipo propio.', true)
  await offer(browser, 'beta.f1b@xpend.test', users.beta, eventId, 130000, 'Ejecución Beta QA con subcontrato parcial.', true)
  await offer(browser, 'gamma.f1b@xpend.test', users.gamma, eventId, 90000, 'Ejecución Gamma QA.', false)

  await buyer.goto(`${base}/sala/${eventId}`, { waitUntil: 'domcontentloaded' })
  await buyer.getByText('Los sobres siguen cerrados').waitFor()
  const sealed = await buyer.locator('body').innerText()
  if (!sealed.includes('2 ofertas')) fail('sobres-cerrados', 'no contó las dos ofertas')
  if (sealed.includes('$150,000.00') || sealed.includes('Ejecución Alfa QA')) fail('sobres-cerrados', 'el contenido de una oferta estaba visible')
  pass('sobres-cerrados')

  await buyer.getByRole('button', { name: 'Cerrar recepción' }).click()
  await buyer.getByRole('button', { name: 'Abrir sobres' }).waitFor()
  const closedSupplier = await session(browser, 'gamma.f1b@xpend.test', users.gamma)
  await closedSupplier.page.goto(`${base}/sala/${eventId}/participar`, { waitUntil: 'domcontentloaded' })
  await closedSupplier.page.getByText('La recepción está cerrada').waitFor()
  const closedText = await closedSupplier.page.locator('body').innerText()
  if (closedText.includes('Ejecución Alfa QA') || closedText.includes('Ejecución Beta QA')) fail('oferta-ajena', 'un proveedor vio la oferta de otro')
  if (await closedSupplier.page.getByRole('button', { name: 'Presentar oferta' }).count()) fail('oferta-ajena', 'podía presentar con la recepción cerrada')
  if (await closedSupplier.page.getByRole('button', { name: /Descargar/ }).count()) fail('oferta-ajena', 'descargó bases sin NDA')
  await closedSupplier.context.close()
  pass('oferta-ajena')

  const anaSealed = await askAna(buyer, '¿Cuánto ofertó Mantención Alfa?')
  if (!String(anaSealed.text || '').toLowerCase().includes('cerrad')) fail('ana-sobres', anaSealed.text || 'sin respuesta')
  if (String(anaSealed.text || '').includes('150,000') || anaSealed.modelCalled) fail('ana-sobres', 'leyó o narró una oferta cerrada')
  pass('ana-sobres')

  const outsider = await session(browser, 'tenant.fase0@xpend.test', users.tenant)
  await outsider.page.goto(`${base}/sourcing-plan/${planId}`, { waitUntil: 'domcontentloaded' })
  await outsider.page.getByText('Error al cargar iniciativa').waitFor()
  await outsider.page.goto(`${base}/sala/${eventId}`, { waitUntil: 'domcontentloaded' })
  await outsider.page.getByText('Esta sala no está disponible').waitFor()
  const outsiderText = await outsider.page.locator('body').innerText()
  if (outsiderText.includes(title) || outsiderText.includes('$150,000.00')) fail('otra-empresa', 'vio datos de la empresa de prueba')
  await outsider.context.close()
  pass('otra-empresa')

  await buyer.goto(`${base}/sala/${eventId}/evaluacion`, { waitUntil: 'domcontentloaded' })
  await buyer.getByText('cuando los sobres están abiertos').waitFor()
  await buyer.goto(`${base}/sala/${eventId}`, { waitUntil: 'domcontentloaded' })
  await buyer.getByRole('button', { name: 'Abrir sobres' }).click()
  await buyer.getByText('Sobres abiertos').waitFor()
  await buyer.goto(`${base}/sala/${eventId}/evaluacion`, { waitUntil: 'domcontentloaded' })
  await buyer.getByRole('button', { name: 'Guardar modelo' }).click()
  await buyer.getByText('Modelo guardado').waitFor()
  await buyer.locator('#criterion-name').fill('Experiencia')
  await buyer.locator('#criterion-weight').fill('100')
  await buyer.getByRole('button', { name: 'Agregar criterio' }).click()
  await buyer.getByText('Experiencia · técnico 100%').waitFor()
  const alfaBlock = buyer.locator('div.space-y-2').filter({ has: buyer.locator('p.font-medium', { hasText: 'Mantención Alfa' }) })
  const betaBlock = buyer.locator('div.space-y-2').filter({ has: buyer.locator('p.font-medium', { hasText: 'Mantención Beta' }) })
  await setReactValue(alfaBlock.locator('input[placeholder="0 a 100"]'), '90')
  await alfaBlock.locator('input[placeholder="Justificación"]').fill('Equipo propio y cobertura completa.')
  await setReactValue(betaBlock.locator('input[placeholder="0 a 100"]'), '76')
  await betaBlock.locator('input[placeholder="Justificación"]').fill('Cumple, con parte del trabajo subcontratada.')
  const scores = await buyer.evaluate(() => [...document.querySelectorAll('input[placeholder="0 a 100"]')].map(element => element.value))
  if (!scores.includes('90') || !scores.includes('76')) fail('evaluacion', `puntajes ${scores.join(',') || 'vacíos'}`)
  await buyer.getByRole('button', { name: 'Cerrar evaluación' }).click()
  await buyer.getByText('Evaluación cerrada').waitFor()
  await buyer.getByPlaceholder('Justificación técnica').fill('Alfa tiene mejor cobertura técnica.')
  await buyer.getByPlaceholder('Justificación económica').fill('Beta es más barata, pero el modelo técnico pondera 60%.')
  await buyer.getByRole('button', { name: 'Recomendar Mantención Alfa' }).click()
  await buyer.getByText('Recomendación lista').waitFor()
  pass('evaluacion')

  await buyer.getByRole('button', { name: 'Preparar comité' }).click()
  await buyer.waitForURL(new RegExp(`/sala/${eventId}/decision`))
  await buyer.locator('p', { hasText: 'Ahorro objetivo: $20,000.00' }).waitFor()
  const dossier = await buyer.locator('body').innerText()
  const savingsLines = dossier.split('\n').filter(line => /Ahorro|Recomendado|Presupuesto|línea base/i.test(line)).join(' | ')
  if (!dossier.includes('$20,000.00')) fail('ahorros', savingsLines || 'sin objetivo')
  if (!dossier.includes('$50,000.00')) fail('ahorros', savingsLines || 'sin estimado')
  if (!dossier.includes('sin evidencia posterior')) fail('ahorros', savingsLines || 'sin realizado')
  if (!dossier.includes('Mantención Alfa')) fail('ahorros', 'no recomienda a Alfa')
  pass('ahorros')
  await buyer.getByPlaceholder('Riesgos').fill('La oferta recomendada no es la más baja.')
  await buyer.getByPlaceholder('Excepciones').fill('Sin excepción de autoaprobación.')
  await buyer.getByPlaceholder('Observaciones').fill('El comité debe aprobar con otra cuenta.')
  await buyer.getByRole('button', { name: 'Enviar a comité' }).click()
  await buyer.getByText('Expediente enviado').waitFor()

  const viewer = await session(browser, 'viewer.fase0@xpend.test', users.viewer)
  await viewer.page.goto(`${base}/sala/${eventId}/decision`, { waitUntil: 'domcontentloaded' })
  await viewer.page.getByPlaceholder('Justificación u observación').fill('Intento de un visualizador.')
  await viewer.page.locator('select').selectOption({ label: 'Mantención Alfa' })
  await viewer.page.getByRole('button', { name: 'Aprobar recomendación' }).click()
  await viewer.page.getByText('No se registró el voto').waitFor()
  await viewer.context.close()
  pass('viewer-sin-voto')

  const manager = await session(browser, 'gerente.f1b@xpend.test', users.manager)
  await manager.page.goto(`${base}/sala/${eventId}/decision`, { waitUntil: 'domcontentloaded' })
  const supplierValue = await manager.page.locator('select option', { hasText: 'Mantención Alfa' }).getAttribute('value')
  if (!supplierValue) fail('comite', 'el selector no identifica al proveedor')
  await manager.page.locator('select').selectOption(supplierValue)
  await manager.page.getByPlaceholder('Justificación u observación').fill('Apruebo a Mantención Alfa por la evaluación técnica. No adjudico todavía.')
  await manager.page.getByRole('button', { name: 'Aprobar recomendación' }).click()
  await manager.page.getByText('Voto registrado').waitFor()
  await manager.context.close()
  pass('comite')

  await buyer.reload({ waitUntil: 'domcontentloaded' })
  await buyer.getByPlaceholder('Condiciones o reservas de la adjudicación').fill('Adjudicación total del alcance ofertado.')
  await buyer.getByRole('button', { name: 'Adjudicar' }).click()
  await buyer.getByText('Adjudicación formal').waitFor()
  await buyer.getByRole('button', { name: 'Generar contrato' }).click()
  await buyer.waitForURL(/\/contratos\/desde-adjudicacion/)
  await buyer.getByPlaceholder('Código').fill(`CTR-${licitacionId}`)
  await buyer.getByPlaceholder('Fecha de inicio').fill('2026-12-01')
  await buyer.getByPlaceholder('Fecha de término').fill('2027-12-01')
  await buyer.getByPlaceholder('Plazo de preaviso').fill('60')
  await buyer.getByPlaceholder('Periodicidad').fill('mensual')
  await buyer.getByPlaceholder('Renovación').fill('manual')
  await buyer.getByRole('button', { name: 'Generar borrador' }).click()
  await buyer.waitForURL(/\/contratos\/[0-9a-f-]{36}$/)
  const awardContractId = buyer.url().split('/').pop()
  pass('adjudicacion')

  const awardExport = await reviewContract(buyer, browser, users.manager, awardContractId, 'Renovación manual pedida por el proceso QA.')
  if (!awardExport.word.includes('150') || !awardExport.pdf.includes('150')) fail('export-adjudicacion', 'el archivo no trae el monto')
  if (!awardExport.word.includes('Alfa Mantenciones') || !awardExport.pdf.includes('Alfa Mantenciones')) fail('export-adjudicacion', awardExport.word.slice(0, 240))
  if (!awardExport.word.includes('Observación del revisor atendida') || !awardExport.pdf.includes('Observación del revisor atendida')) fail('export-adjudicacion', 'no exportó la versión corregida')
  if (awardExport.word.includes('{{') || awardExport.pdf.includes('{{')) fail('export-adjudicacion', 'quedó un token sin resolver')
  pass('export-adjudicacion')

  const uploadedName = `contrato-qa-${stamp}.docx`
  const uploadedPath = join(work, uploadedName)
  const uploaded = await Packer.toBuffer(new Document({
    sections: [{ children: [new Paragraph('El plazo de preaviso de este contrato demo es de 45 dias.')] }],
  }))
  writeFileSync(uploadedPath, uploaded)
  await buyer.goto(`${base}/contratos/nuevo`, { waitUntil: 'domcontentloaded' })
  await buyer.getByPlaceholder('CTR-MANT-2026').fill(`CTR-CARGA-${stamp}`)
  await buyer.locator('input:not([placeholder]):not([type="file"])').first().fill(`Contrato cargado ${stamp}`)
  await buyer.locator('input[type="file"]').setInputFiles(uploadedPath)
  await buyer.getByRole('button', { name: 'Guardar contrato' }).click()
  await buyer.waitForURL(/\/contratos\/[0-9a-f-]{36}$/, { timeout: 45000 })
  const uploadedId = buyer.url().split('/').pop()
  await buyer.getByPlaceholder('Palabra o frase del documento').fill('45 dias')
  await buyer.getByText(/Encontrada en los caracteres/).waitFor()
  const anaContract = await askAna(buyer, '¿Con cuánta anticipación debemos avisar que no renovaremos?')
  if (!String(anaContract.text || '').includes('45')) fail('ana-contrato', anaContract.text || 'sin cita')
  if (!anaContract.modelCalled) fail('ana-groq', 'no llamó a Groq')
  if (!String(anaContract.text || '').length) fail('ana-groq', 'respuesta vacía')
  pass('ana-contrato')
  pass('ana-groq')

  const otherAna = await session(browser, 'tenant.fase0@xpend.test', users.tenant)
  await otherAna.page.goto(`${base}/contratos/${uploadedId}`, { waitUntil: 'domcontentloaded' })
  await otherAna.page.getByText('Este contrato no está disponible.').waitFor()
  const hidden = await otherAna.page.locator('body').innerText()
  if (hidden.includes('45 dias') || hidden.includes(`CTR-CARGA-${stamp}`)) fail('ana-otra-empresa', 'el contrato de otra empresa se veía')
  const denied = await askAna(otherAna.page, '¿Cuál es el preaviso de este contrato?')
  if (String(denied.text || '').includes('45')) fail('ana-otra-empresa', 'ANA leyó el contrato ajeno')
  await otherAna.context.close()
  pass('ana-otra-empresa')

  await buyer.goto(`${base}/contratos/builder`, { waitUntil: 'domcontentloaded' })
  await buyer.getByPlaceholder('Código').fill(`CTR-TPL-${stamp}`)
  await buyer.getByPlaceholder('Nombre').fill(`Contrato plantilla ${stamp}`)
  await buyer.getByPlaceholder('contraparte').fill('Taller Demo SpA')
  await buyer.getByPlaceholder('objeto').fill('Calibración de instrumentos')
  await buyer.getByPlaceholder('inicio').fill('2026-12-01')
  await buyer.getByPlaceholder('termino').fill('2027-11-30')
  await buyer.getByPlaceholder('moneda').fill('USD')
  await buyer.getByPlaceholder('monto').fill('8000')
  await buyer.getByPlaceholder('periodicidad').fill('mensual')
  await buyer.getByPlaceholder('renovacion').fill('manual')
  await buyer.getByPlaceholder('preaviso').fill('30')
  await buyer.getByRole('button', { name: 'Crear borrador' }).click()
  await buyer.waitForURL(/\/contratos\/[0-9a-f-]{36}$/)
  const templateContractId = buyer.url().split('/').pop()
  const templateExport = await reviewContract(buyer, browser, users.manager, templateContractId, 'Texto editado antes de la revisión.')
  if (!templateExport.word.includes('8000') || !templateExport.pdf.includes('Taller Demo')) fail('export-plantilla', 'el archivo no trae los datos escritos')
  pass('export-plantilla')

  console.log(JSON.stringify({ planId, rfxId, licitacionId, eventId, awardContractId, uploadedId, templateContractId }))
  await buyerSession.context.close()
  console.log(results.join('\n'))
} catch (error) {
  if (buyer) {
    await buyer.screenshot({ path: join(work, 'failure.png') }).catch(() => undefined)
    const text = await buyer.locator('body').innerText().catch(() => '')
    writeFileSync(join(work, 'failure.txt'), text.slice(0, 4000))
  }
  console.log(results.join('\n'))
  console.log(`evidencia:${work}`)
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await browser.close()
}
