// Utilidades compartidas de la demostración. Todo corre contra el Supabase LOCAL: si la URL no es local, se aborta.
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

export const ROOT = fileURLToPath(new URL('../../', import.meta.url))
export const DEMO_DIR = `${ROOT}.demo`
export const CREDENTIALS_FILE = `${DEMO_DIR}/credenciales-demo.local.json`
export const COMPANY_NAME = 'Industrias Andinas Demo S.A.'
export const DEMO_DOMAIN = 'xpend-demo.test'

export function readEnv(path) {
  const values = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '')
  }
  return values
}

const env = readEnv(`${ROOT}.env.local`)
export const local = { url: env.NEXT_PUBLIC_SUPABASE_URL, anon: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service: env.SUPABASE_SERVICE_ROLE_KEY }
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(local.url || '')) {
  throw new Error('La demostración solo corre contra el Supabase local. No se modificó nada.')
}

export const adminHeaders = { apikey: local.service, Authorization: `Bearer ${local.service}`, 'Content-Type': 'application/json' }
export const serviceClient = createClient(local.url, local.service, { auth: { persistSession: false, autoRefreshToken: false } })

export function randomPassword() {
  return `Demo-${randomBytes(15).toString('base64url')}`
}

export async function authAdmin(path, init = {}) {
  const response = await fetch(`${local.url}/auth/v1/admin/${path}`, { ...init, headers: { ...adminHeaders, ...(init.headers || {}) } })
  const text = await response.text()
  if (!response.ok) throw new Error(`auth ${path}: ${response.status} ${text}`)
  return text ? JSON.parse(text) : null
}

export async function findUser(email) {
  for (let page = 1; page <= 10; page += 1) {
    const body = await authAdmin(`users?per_page=200&page=${page}`)
    const hit = (body.users || []).find(user => user.email === email)
    if (hit) return hit
    if (!body.users || body.users.length < 200) return null
  }
  return null
}

export async function signedIn(email, password) {
  const client = createClient(local.url, local.anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`No se pudo iniciar sesión como ${email}: ${error.message}`)
  return client
}

export function saveCredentials(data) {
  mkdirSync(DEMO_DIR, { recursive: true })
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(data, null, 2), { mode: 0o600 })
}

export function loadCredentials() {
  if (!existsSync(CREDENTIALS_FILE)) throw new Error('No hay credenciales de demostración. Ejecuta primero: npm run demo:seed')
  return JSON.parse(readFileSync(CREDENTIALS_FILE, 'utf8'))
}

export const iso = (date) => date.toISOString().slice(0, 10)
export function addDays(base, days) {
  const next = new Date(`${base}T12:00:00Z`)
  next.setUTCDate(next.getUTCDate() + days)
  return iso(next)
}
export const today = () => iso(new Date())

// Generador pseudoaleatorio determinista: la misma demostración produce los mismos montos.
export function prng(seed) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

export function must(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
}
