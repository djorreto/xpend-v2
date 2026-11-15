import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const base = 'http://127.0.0.1:3027'
const password = readFileSync('/Users/diegojorreto/Cursor Projects/Xpend/Xpend V3 - Desarrollo/supabase/.env.fase0.local', 'utf8')
  .match(/^XPEND_FASE0_BUYER_PASSWORD=(.*)$/m)[1].trim()

const browser = await chromium.launch({ headless: true })
const results = []

async function checkHome(width, height, label) {
  const page = await browser.newPage({ viewport: { width, height } })
  const response = await page.goto(`${base}/home`, { waitUntil: 'networkidle' })
  const text = await page.locator('body').innerText()
  const fail = []
  if (response.status() !== 200) fail.push(`status ${response.status()}`)
  for (const expected of [
    'Abastecimiento más inteligente',
    'XPEND Intelligence',
    'XPEND Sourcing',
    'XPEND Contracts',
    'Empieza con lo que necesitas',
    'Solicitar una demo',
    'Iniciar sesión',
  ]) {
    if (!text.includes(expected)) fail.push(`falta ${expected}`)
  }
  for (const banned of ['Xinergy', 'DUX', 'Newton', 'P2P']) {
    if (text.includes(banned)) fail.push(`aparece ${banned}`)
  }
  if (!text.includes('no está conectado') && !text.includes('Escribir para una demo')) fail.push('cta demo')
  const login = page.getByRole('link', { name: 'Iniciar sesión' }).first()
  await login.click()
  await page.waitForURL(/\/login/)
  results.push(`${label}:${fail.length ? fail.join(',') : 'ok'}`)
  await page.close()
}

await checkHome(1280, 800, 'desktop')
await checkHome(390, 844, 'mobile')

const page = await browser.newPage()
await page.goto(`${base}/login`, { waitUntil: 'networkidle' })
await page.getByPlaceholder('tu@correo.com').fill('buyer.fase0@xpend.test')
await page.getByPlaceholder('Contraseña').fill(password)
await page.getByRole('button', { name: 'Entrar' }).click()
await page.waitForURL(url => !url.pathname.includes('login'), { timeout: 20000 })
await page.goto(`${base}/contratos/43c31453-6713-4de9-b167-26bc6e0b95ee`, { waitUntil: 'networkidle' })
const contract = await page.locator('body').innerText()
const contractFail = []
if (!contract.includes('CTR-LIC-F1B-MANT')) contractFail.push('sin codigo')
if (!contract.includes('150')) contractFail.push('sin monto')
if (!contract.includes('Exportar DOCX') && !contract.includes('Exportar PDF')) contractFail.push('sin export')
results.push(`contrato:${contractFail.length ? contractFail.join(',') : 'ok'}`)

await page.goto(`${base}/sourcing-plan/d3455755-7dac-4500-8d8b-d823a2ceca76`, { waitUntil: 'networkidle' })
const plan = await page.locator('body').innerText()
results.push(`plan:${plan.includes('Mantenimiento industrial Fase 1B') ? 'ok' : 'sin titulo'}`)

await page.goto(`${base}/licitaciones/LIC-F1B-MANT`, { waitUntil: 'networkidle' })
const tender = await page.locator('body').innerText()
results.push(`licitacion:${tender.includes('LIC-F1B-MANT') ? 'ok' : 'sin codigo'}`)

await page.goto(`${base}/sala/81113478-3ddd-402a-8262-9149ae38ef2f/decision`, { waitUntil: 'networkidle' })
const decision = await page.locator('body').innerText()
results.push(`decision:${decision.includes('150') ? 'ok' : 'sin monto'}`)

await page.goto(`${base}/contratos/43c31453-6713-4de9-b167-26bc6e0b95ee`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Abrir chat de ANA' }).click()
await page.getByPlaceholder('Pregunta por este registro...').fill('¿Con cuánta anticipación debemos avisar que no renovaremos?')
await page.locator('form').getByRole('button').click()
await page.getByText('60', { exact: false }).first().waitFor({ timeout: 30000 })
const ana = await page.locator('body').innerText()
results.push(`ana:${ana.includes('60') ? 'ok' : 'sin preaviso'}`)

await browser.close()
console.log(results.join('\n'))
if (results.some(item => !item.endsWith(':ok'))) process.exit(1)
