import { mkdirSync } from 'node:fs'
import { DEMO_DIR } from './common.mjs'

export const BASE = process.env.XPEND_DEMO_BASE || 'http://127.0.0.1:3027'
export const SHOTS = `${DEMO_DIR}/capturas`
mkdirSync(SHOTS, { recursive: true })

export const results = []
export function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` · ${detail}` : ''}`)
}
export function summary() {
  const failed = results.filter(item => !item.ok)
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones correctas`)
  if (failed.length) process.exitCode = 1
  return failed.length === 0
}

export async function login(browser, user, viewport = { width: 1360, height: 900 }) {
  const context = await browser.newContext({ acceptDownloads: true, viewport })
  const page = await context.newPage()
  page.setDefaultTimeout(30000)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 90000 })
  await page.getByPlaceholder('tu@correo.com').fill(user.email)
  await page.getByPlaceholder('Contraseña').fill(user.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30000 })
  return { context, page }
}

export async function setReactValue(locator, value) {
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

export async function body(page) {
  return page.locator('body').innerText()
}

export async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
}
