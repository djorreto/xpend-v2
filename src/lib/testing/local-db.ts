import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Soporte común de las pruebas contra Supabase LOCAL (nunca producción).

const FIXTURES = '/Users/diegojorreto/Cursor Projects/Xpend/Xpend V3 - Desarrollo/supabase/.env.fase0.local'
const ANALYST_EMAIL = 'comprador.etapa1@xpend.test'

function localKeys() {
  const raw = execSync('npx supabase status -o env', { cwd: '/Users/diegojorreto/Cursor Projects/Xpend/Xpend V3 - Desarrollo', encoding: 'utf8' })
  const env: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)="(.*)"$/)
    if (match) env[match[1]] = match[2]
  }
  if (!env.API_URL?.startsWith('http://127.0.0.1:54321') || !env.ANON_KEY || !env.SERVICE_ROLE_KEY) throw new Error('Supabase local no está disponible')
  return env
}

function fixtures() {
  const values: Record<string, string> = {}
  for (const line of readFileSync(FIXTURES, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) values[match[1]] = match[2].trim()
  }
  return values
}

async function signIn(url: string, anon: string, email: string, password: string) {
  const client = createClient(url, anon, { auth: { persistSession: false } })
  const login = await client.auth.signInWithPassword({ email, password })
  assert.equal(login.error, null, `no inició sesión ${email}`)
  return client
}

export async function setup() {
  const keys = localKeys()
  const fx = fixtures()
  const managerPassword = process.env.XPEND_MANAGER_PASSWORD
  assert.ok(managerPassword, 'Define XPEND_MANAGER_PASSWORD para la prueba local')
  const admin = createClient(keys.API_URL, keys.SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const buyer = await signIn(keys.API_URL, keys.ANON_KEY, fx.XPEND_FASE0_BUYER_EMAIL, fx.XPEND_FASE0_BUYER_PASSWORD)
  const { data: profile } = await admin.from('profiles').select('company_id').eq('email', fx.XPEND_FASE0_BUYER_EMAIL).single()
  const companyId = profile!.company_id as string

  // Cuenta de comprador solo local, con una clave aleatoria que no se imprime.
  const analystPassword = randomBytes(12).toString('hex')
  const listed = await admin.auth.admin.listUsers({ perPage: 200 })
  let analystId = listed.data.users.find(user => user.email === ANALYST_EMAIL)?.id
  if (analystId) await admin.auth.admin.updateUserById(analystId, { password: analystPassword })
  else {
    const created = await admin.auth.admin.createUser({ email: ANALYST_EMAIL, password: analystPassword, email_confirm: true })
    assert.equal(created.error, null)
    analystId = created.data.user!.id
  }
  await admin.from('profiles').upsert({ id: analystId, email: ANALYST_EMAIL, full_name: 'Camila Comprador', role: 'analyst', company_id: companyId, must_change_password: false })

  const clients: Record<string, SupabaseClient> = {
    admin: buyer,
    manager: await signIn(keys.API_URL, keys.ANON_KEY, 'gerente.f1b@xpend.test', managerPassword),
    analyst: await signIn(keys.API_URL, keys.ANON_KEY, ANALYST_EMAIL, analystPassword),
    viewer: await signIn(keys.API_URL, keys.ANON_KEY, fx.XPEND_FASE0_VIEWER_EMAIL, fx.XPEND_FASE0_VIEWER_PASSWORD),
  }
  const profiles: Record<string, string> = {}
  const { data: rows } = await admin.from('profiles').select('id, email').eq('company_id', companyId)
  for (const row of rows || []) profiles[row.email as string] = row.id as string
  return { admin, clients, companyId, profiles, analystEmail: ANALYST_EMAIL, managerEmail: 'gerente.f1b@xpend.test', adminEmail: fx.XPEND_FASE0_BUYER_EMAIL, viewerEmail: fx.XPEND_FASE0_VIEWER_EMAIL }
}


// Ejecuta SQL directamente en la base LOCAL (solo para limpiar datos de prueba que los disparadores protegen).
export function localSql(statement: string) {
  return execSync('docker exec -i supabase_db_xpend-v3-local psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q', { input: statement, encoding: 'utf8' })
}
