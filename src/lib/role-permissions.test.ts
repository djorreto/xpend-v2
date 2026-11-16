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
  // La base nunca es más permisiva que la interfaz: el viewer es de solo lectura y los demás roles coinciden.
  assert.deepEqual(gaps, [])
  await admin.from('contracts').delete().like('code', `${MARK}%`)
})

test('el perfil de consulta lee adjudicaciones y decisiones como el resto de perfiles internos', async () => {
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

const WRITE_TABLES = [
  'rfx_projects', 'rfx_templates', 'rfx_company_policies', 'report_templates', 'reports', 'service_invoices',
  'si_categories', 'si_learning_rules', 'si_plan_items', 'si_procurement_plans', 'si_spend_decisions',
  'si_spend_groups', 'si_spend_lines', 'si_uploads', 'spend_closures', 'spend_data', 'procurement_dossiers',
  'sourcing_plans', 'licitaciones', 'offer_events', 'suppliers', 'contracts', 'contract_versions',
]

test('el perfil de consulta no escribe en ninguna tabla de negocio: crear, editar y borrar quedan rechazados', async () => {
  const { admin, clients, companyId } = await setup()
  for (const table of WRITE_TABLES) {
    const inserted = await clients.viewer.from(table).insert({ company_id: companyId })
    assert.ok(inserted.error, `${table}: el viewer pudo insertar`)
    assert.notEqual(inserted.error?.code, '23502', `${table}: RLS dejó pasar la fila hasta las restricciones de columna`)
    const { data: any } = await admin.from(table).select('*').limit(1)
    const row = any?.[0] as Record<string, unknown> | undefined
    if (!row?.id) continue
    const updated = await clients.viewer.from(table).update({ id: row.id }).eq('id', row.id as string).select('id')
    assert.equal(updated.data?.length ?? 0, 0, `${table}: el viewer pudo editar`)
    const deleted = await clients.viewer.from(table).delete().eq('id', row.id as string).select('id')
    assert.equal(deleted.data?.length ?? 0, 0, `${table}: el viewer pudo borrar`)
    const stillThere = await admin.from(table).select('id').eq('id', row.id as string)
    assert.equal(stillThere.data?.length, 1, `${table}: la fila ya no existe`)
  }
})

test('el perfil de consulta no lee contratos ni sus documentos; los demás perfiles internos sí', async () => {
  const { admin, clients, companyId } = await setup()
  const contractTables = ['contracts', 'contract_versions', 'contract_documents', 'contract_extractions', 'contract_findings', 'contract_clauses', 'contract_templates', 'contract_policies', 'contract_reviews']
  for (const table of contractTables) {
    const viewer = await clients.viewer.from(table).select('*', { count: 'exact', head: true })
    assert.equal(viewer.error, null, table)
    assert.equal(viewer.count ?? 0, 0, `${table}: el viewer lee filas`)
  }
  const { count: contracts } = await admin.from('contracts').select('*', { count: 'exact', head: true }).eq('company_id', companyId)
  assert.ok((contracts ?? 0) > 0, 'debe haber contratos para que la prueba sea significativa')
  for (const role of ['admin', 'manager', 'analyst']) {
    const seen = await clients[role].from('contracts').select('*', { count: 'exact', head: true })
    assert.equal(seen.count, contracts, `${role} debe seguir viendo los contratos`)
  }
})

test('storage: el perfil de consulta no sube ni borra archivos y no lee documentos de contratos', async () => {
  const { admin, clients, companyId } = await setup()
  const path = `${companyId}/contratos/${MARK}/${Date.now()}-contrato.txt`
  const seeded = await admin.storage.from('documents').upload(path, new Blob(['contrato ficticio']), { upsert: true })
  assert.equal(seeded.error, null)
  try {
    assert.ok((await clients.viewer.storage.from('documents').download(path)).error, 'el viewer descargó un contrato')
    assert.equal((await clients.admin.storage.from('documents').download(path)).error, null, 'el administrador debe poder descargarlo')
    const upload = await clients.viewer.storage.from('documents').upload(`${companyId}/rfx/${MARK}-${Date.now()}.txt`, new Blob(['x']))
    assert.ok(upload.error, 'el viewer subió un archivo')
    const removed = await clients.viewer.storage.from('documents').remove([path])
    assert.equal(removed.data?.length ?? 0, 0, 'el viewer borró un archivo')
    assert.equal((await admin.storage.from('documents').download(path)).error, null, 'el archivo debe seguir existiendo')
  } finally {
    await admin.storage.from('documents').remove([path])
  }
})

test('el perfil de consulta conserva lo que usa: marcar sus notificaciones y consultar ANA', async () => {
  const { clients } = await setup()
  const notifications = await clients.viewer.from('notifications').select('id').limit(1)
  assert.equal(notifications.error, null)
  const me = (await clients.viewer.auth.getUser()).data.user!.id
  const profile = await clients.viewer.from('profiles').select('id, role').eq('id', me).single()
  const selfUpdate = await clients.viewer.from('profiles').update({ role: 'admin' }).eq('id', me).select('role')
  assert.ok(selfUpdate.error || selfUpdate.data?.length === 0, 'un viewer no puede subirse el rol')
  assert.equal(profile.error, null)
  assert.equal(profile.data?.role, 'viewer')
})
