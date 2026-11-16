import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { can, type Capability } from './navigation.ts'

// Pruebas contra Supabase LOCAL. Verifican que lo que la interfaz ofrece a cada rol lo permita la base de datos:
// la interfaz nunca debe mostrar una acción que RLS rechaza, ni ocultar una lectura que RLS autoriza sin decisión explícita.

const FIXTURES = '/Users/diegojorreto/Cursor Projects/Xpend/Xpend V3 - Desarrollo/supabase/.env.fase0.local'
const ANALYST_EMAIL = 'comprador.etapa1@xpend.test'
const MARK = 'ROLEPROBE'

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

type Probe = { capability: Capability; table: string; row: (companyId: string, tag: string) => Record<string, unknown>; idColumn: string }

const PROBES: Probe[] = [
  { capability: 'createInitiative', table: 'sourcing_plans', idColumn: 'id', row: (company_id, tag) => ({ company_id, plan_year: 2026, quarter: 'Q1', initiative_type: 'project', title: `${MARK} ${tag}` }) },
  { capability: 'createRfx', table: 'rfx_projects', idColumn: 'id', row: (company_id, tag) => ({ company_id, project_code: `${MARK}-${tag}`.slice(0, 40), title: `${MARK} ${tag}`, rfx_type: 'RFP', template_version_snapshot: 1 }) },
  { capability: 'createLicitacion', table: 'licitaciones', idColumn: 'id', row: (company_id, tag) => ({ id: `${MARK}-${tag}`, company_id, name: `${MARK} ${tag}` }) },
  { capability: 'openSala', table: 'offer_events', idColumn: 'id', row: (company_id, tag) => ({ company_id, title: `${MARK} ${tag}`, modality: 'sealed' }) },
  { capability: 'writeContracts', table: 'contracts', idColumn: 'id', row: (company_id, tag) => ({ company_id, code: `${MARK}-${tag}`, name: `${MARK} ${tag}`, contract_type: 'services', origin: 'upload', status: 'draft' }) },
  { capability: 'writeSuppliers', table: 'suppliers', idColumn: 'id', row: (company_id, tag) => ({ id: `${MARK}-${tag}`, company_id, fantasy_name: `${MARK} ${tag}`, legal_name: `${MARK} ${tag}`, rut: `${MARK}-${tag}`, service_type: 'services' }) },
]

async function setup() {
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
  return { admin, clients, companyId }
}

async function tryInsert(admin: SupabaseClient, client: SupabaseClient, probe: Probe, companyId: string, tag: string) {
  const extra: Record<string, unknown> = {}
  if (probe.table === 'rfx_projects') {
    const { data } = await admin.from('rfx_templates').select('id').limit(1)
    extra.template_id = data?.[0]?.id
  }
  const { data, error } = await client.from(probe.table).insert({ ...probe.row(companyId, tag), ...extra }).select(probe.idColumn).single()
  if (data) await admin.from(probe.table).delete().eq(probe.idColumn, (data as Record<string, unknown>)[probe.idColumn] as string)
  return !error
}

const ROLES = ['admin', 'manager', 'analyst', 'viewer'] as const

// Defectos de RLS ya existentes (no introducidos por Etapa 1) que se informaron y esperan autorización para corregirse en Cloud.
const KNOWN_DB_GAPS = ['viewer:createRfx']

test('la interfaz solo ofrece a cada rol acciones de creación que la base de datos acepta', async () => {
  const { admin, clients, companyId } = await setup()
  const gaps: string[] = []
  for (const role of ROLES) {
    for (const probe of PROBES) {
      const tag = `${role}-${probe.capability}-${Date.now()}`
      const allowedByDb = await tryInsert(admin, clients[role], probe, companyId, tag)
      const shownByApp = can(role, probe.capability)
      assert.ok(!shownByApp || allowedByDb, `${role} ve "${probe.capability}" pero RLS lo rechaza`)
      if (allowedByDb && !shownByApp) gaps.push(`${role}:${probe.capability}`)
    }
  }
  // La base puede ser más permisiva que la interfaz solo donde está documentado (ver los `todo` de abajo).
  assert.deepEqual(gaps.filter(gap => !KNOWN_DB_GAPS.includes(gap)), [])
  await admin.from('contracts').delete().like('code', `${MARK}%`)
})

test('el perfil de consulta lee adjudicaciones y decisiones; ningún perfil interno ve de más ni de menos', async () => {
  const { clients } = await setup()
  const counts: Record<string, number[]> = {}
  for (const role of ROLES) {
    counts[role] = []
    for (const table of ['process_awards', 'award_decisions']) {
      const { count, error } = await clients[role].from(table).select('*', { count: 'exact', head: true })
      assert.equal(error, null, `${role} ${table}: ${error?.message}`)
      counts[role].push(count ?? 0)
    }
  }
  assert.ok(counts.viewer[0] > 0, 'el consulta debe ver las adjudicaciones: así lo autoriza RLS y por eso Inicio las cuenta')
  assert.deepEqual(counts.viewer, counts.admin)
  assert.deepEqual(counts.analyst, counts.admin)
  assert.deepEqual(counts.manager, counts.admin)
})

test('el perfil de consulta no puede crear RFx directamente', { todo: 'Defecto RLS conocido: rfx_projects_insert_company solo exige la empresa. Propuesta en docs/etapa1/propuesta-rls-roles.sql' }, async () => {
  const { admin, clients, companyId } = await setup()
  const probe = PROBES.find(item => item.capability === 'createRfx')!
  assert.equal(await tryInsert(admin, clients.viewer, probe, companyId, `viewer-todo-${Date.now()}`), false)
})

test('el perfil de consulta no puede borrar contratos directamente', { todo: 'Defecto RLS conocido: las políticas ALL de contratos no restringen DELETE por rol. Propuesta en docs/etapa1/propuesta-rls-roles.sql' }, async () => {
  const { admin, clients, companyId } = await setup()
  const probe = PROBES.find(item => item.capability === 'writeContracts')!
  const { data } = await admin.from('contracts').insert(probe.row(companyId, `del-${Date.now()}`)).select('id').single()
  const { data: deleted } = await clients.viewer.from('contracts').delete().eq('id', data!.id).select('id')
  await admin.from('contracts').delete().eq('id', data!.id)
  assert.equal(deleted?.length ?? 0, 0)
})
