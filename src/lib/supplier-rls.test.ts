import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Pruebas contra Supabase LOCAL con consultas directas a PostgREST.
// Un proveedor no debe leer ni escribir datos internos del comprador.

const FIXTURES = '/Users/diegojorreto/Cursor Projects/Xpend/Xpend V3 - Desarrollo/supabase/.env.fase0.local'

function localKeys() {
  const raw = execSync('npx supabase status -o env', {
    cwd: '/Users/diegojorreto/Cursor Projects/Xpend/Xpend V3 - Desarrollo',
    encoding: 'utf8',
  })
  const env: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)="(.*)"$/)
    if (match) env[match[1]] = match[2]
  }
  if (!env.API_URL?.startsWith('http://127.0.0.1:54321') || !env.ANON_KEY || !env.SERVICE_ROLE_KEY) {
    throw new Error('Supabase local no está disponible')
  }
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

// Tablas internas del comprador a las que un proveedor no tiene ninguna razón de acceder.
const INTERNAL_TABLES = [
  'rfx_projects', 'rfx_project_comments', 'rfx_project_downloads', 'rfx_project_versions',
  'rfx_audit_log', 'rfx_templates', 'rfx_template_variables', 'rfx_company_policies',
  'si_plan_items', 'si_procurement_plans', 'si_uploads', 'si_spend_lines', 'si_spend_groups',
  'si_spend_decisions', 'si_categories', 'si_learning_rules',
  'spend_data', 'spend_closures', 'reports', 'report_templates', 'service_invoices',
  'licitacion_documents',
]

async function count(client: SupabaseClient, table: string) {
  const { count: total, error } = await client.from(table).select('*', { count: 'exact', head: true })
  assert.equal(error, null, `${table}: ${error?.message}`)
  return total ?? 0
}

test('un proveedor no lee ni escribe RFx internos ni oportunidades de gasto; los perfiles internos conservan su acceso', async () => {
  const keys = localKeys()
  const fx = fixtures()
  const managerPassword = process.env.XPEND_MANAGER_PASSWORD
  assert.ok(managerPassword, 'Define XPEND_MANAGER_PASSWORD para la prueba local')
  const admin = createClient(keys.API_URL, keys.SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const buyer = await signIn(keys.API_URL, keys.ANON_KEY, fx.XPEND_FASE0_BUYER_EMAIL, fx.XPEND_FASE0_BUYER_PASSWORD)
  const manager = await signIn(keys.API_URL, keys.ANON_KEY, 'gerente.f1b@xpend.test', managerPassword)
  const viewer = await signIn(keys.API_URL, keys.ANON_KEY, fx.XPEND_FASE0_VIEWER_EMAIL, fx.XPEND_FASE0_VIEWER_PASSWORD)
  const supplier = await signIn(keys.API_URL, keys.ANON_KEY, fx.XPEND_FASE0_SUPPLIER_EMAIL, fx.XPEND_FASE0_SUPPLIER_PASSWORD)
  const outsider = await signIn(keys.API_URL, keys.ANON_KEY, fx.XPEND_FASE0_OTHER_TENANT_EMAIL, fx.XPEND_FASE0_OTHER_TENANT_PASSWORD)

  const buyerUser = (await buyer.auth.getUser()).data.user
  const { data: profile } = await admin.from('profiles').select('company_id').eq('id', buyerUser?.id).single()
  const companyId = profile?.company_id as string
  assert.ok(companyId)
  const supplierProfile = await admin.from('profiles').select('company_id, supplier_id').eq('email', fx.XPEND_FASE0_SUPPLIER_EMAIL).single()
  assert.equal(supplierProfile.data?.company_id, companyId, 'el escenario exige un proveedor con company_id de la compradora')

  const tag = `RLS-PROV-${Date.now()}`
  const baseRfx = await admin.from('rfx_projects').select('*').eq('company_id', companyId).limit(1).single()
  assert.equal(baseRfx.error, null, 'no hay un RFx local de referencia')
  const { id: _id, created_at: _c, updated_at: _u, ...rfxBase } = baseRfx.data as Record<string, unknown>
  const rfxPayload = { ...rfxBase, project_code: `${tag}-rfx`, title: `${tag} rfx` }
  let uploadId: string | undefined
  let documentId: string | undefined
  let planId: string | undefined
  try {
    // Datos de gasto de la compradora (se crean con service role y se borran al final).
    const upload = await admin.from('si_uploads').insert({
      company_id: companyId, user_id: buyerUser?.id, file_name: `${tag}.csv`, file_size: 1, file_type: 'csv',
    }).select('id').single()
    assert.equal(upload.error, null)
    uploadId = upload.data?.id
    const plan = await admin.from('si_procurement_plans').insert({
      company_id: companyId, upload_id: uploadId, name: tag, plan_year: 2026, total_spend: 1000, category_count: 1, supplier_count: 1,
    }).select('id').single()
    assert.equal(plan.error, null, plan.error?.message)
    planId = plan.data?.id
    const item = await admin.from('si_plan_items').insert({
      plan_id: planId, company_id: companyId, category: tag, total_spend: 1000, supplier_count: 1, strategy: 'compete',
    }).select('id').single()
    assert.equal(item.error, null, item.error?.message)

    // La licitación debe ser una que el proveedor SÍ puede ver (invitado): la fuga ocurre sobre sus documentos internos.
    const licitacion = await supplier.from('licitaciones').select('id').limit(1).single()
    assert.equal(licitacion.error, null, 'el proveedor de prueba no tiene una licitación invitada')
    const document = await admin.from('licitacion_documents').insert({
      licitacion_id: licitacion.data?.id, name: `${tag}.pdf`, file_path: `rls/${tag}.pdf`, file_size: 1, mime_type: 'application/pdf',
    }).select('id').single()
    assert.equal(document.error, null, document.error?.message)
    documentId = document.data?.id

    // 1. El proveedor no ve nada de las tablas internas.
    const leaks: string[] = []
    for (const table of INTERNAL_TABLES) {
      const seen = await count(supplier, table)
      if (seen > 0) leaks.push(`${table}=${seen}`)
    }
    assert.deepEqual(leaks, [], `el proveedor lee tablas internas: ${leaks.join(', ')}`)

    // 2. Tampoco por una incrustación de PostgREST ni por filtros directos.
    const embed = await supplier.from('si_procurement_plans').select('id, items:si_plan_items(id, category)').eq('id', planId as string)
    assert.equal(embed.error, null)
    assert.equal(embed.data?.length ?? 0, 0)
    const direct = await supplier.from('si_plan_items').select('id').eq('category', tag)
    assert.equal(direct.data?.length ?? 0, 0)

    // 3. El proveedor no escribe en esas tablas.
    const insertRfx = await supplier.from('rfx_projects').insert(rfxPayload)
    assert.equal(insertRfx.error?.code, '42501', `el proveedor pudo crear un RFx (${insertRfx.error?.message ?? 'sin error'})`)
    const insertItem = await supplier.from('si_plan_items').insert({
      plan_id: planId, company_id: companyId, category: `${tag}-x`, total_spend: 1, supplier_count: 1, strategy: 'compete',
    })
    assert.equal(insertItem.error?.code, '42501', `el proveedor pudo crear una oportunidad (${insertItem.error?.message ?? 'sin error'})`)
    const updateRfx = await supplier.from('rfx_projects').update({ name: 'manipulado' }).eq('company_id', companyId).select('id')
    assert.equal(updateRfx.data?.length ?? 0, 0, 'el proveedor pudo editar RFx')
    const updateItem = await supplier.from('si_plan_items').update({ category: 'manipulado' }).eq('plan_id', planId as string).select('id')
    assert.equal(updateItem.data?.length ?? 0, 0, 'el proveedor pudo editar oportunidades')
    const deleteItem = await supplier.from('si_plan_items').delete().eq('plan_id', planId as string).select('id')
    assert.equal(deleteItem.data?.length ?? 0, 0, 'el proveedor pudo borrar oportunidades')

    const docUpdate = await supplier.from('licitacion_documents').update({ name: 'manipulado' }).eq('id', documentId as string).select('id')
    assert.equal(docUpdate.data?.length ?? 0, 0, 'el proveedor pudo editar documentos de licitación')

    // 4. Los perfiles internos conservan su acceso.
    for (const [label, client] of [['comprador (admin)', buyer], ['gerente', manager], ['consulta', viewer]] as const) {
      const docs = await client.from('licitacion_documents').select('id').eq('id', documentId as string)
      assert.equal(docs.data?.length, 1, `${label} perdió acceso a licitacion_documents`)
      assert.ok(await count(client, 'rfx_projects') > 0, `${label} perdió acceso a rfx_projects`)
      const items = await client.from('si_plan_items').select('id').eq('category', tag)
      assert.equal(items.data?.length, 1, `${label} perdió acceso a si_plan_items`)
    }
    const insertedByBuyer = await buyer.from('rfx_projects').insert(rfxPayload).select('id').single()
    assert.equal(insertedByBuyer.error, null, 'el comprador ya no puede crear RFx')
    await admin.from('rfx_projects').delete().eq('id', insertedByBuyer.data?.id)

    // 5. Aislamiento entre empresas.
    assert.equal(await count(outsider, 'rfx_projects'), 0)
    assert.equal((await outsider.from('si_plan_items').select('id').eq('category', tag)).data?.length ?? 0, 0)

    // 6. El portal del proveedor sigue funcionando: invitaciones, sala, licitación invitada, su ficha.
    assert.ok(await count(supplier, 'offer_invitations') > 0, 'el proveedor perdió sus invitaciones')
    assert.ok(await count(supplier, 'offer_events') > 0, 'el proveedor perdió su sala')
    assert.ok(await count(supplier, 'suppliers') === 1, 'el proveedor perdió su ficha')
    assert.ok(await count(supplier, 'profiles') === 1)
    assert.ok(await count(supplier, 'notifications') >= 0)
    await count(supplier, 'nda_acceptances')
    await count(supplier, 'offer_bids')
  } finally {
    if (planId) await admin.from('si_plan_items').delete().eq('plan_id', planId)
    if (planId) await admin.from('si_procurement_plans').delete().eq('id', planId)
    if (uploadId) await admin.from('si_uploads').delete().eq('id', uploadId)
    if (documentId) await admin.from('licitacion_documents').delete().eq('id', documentId)
    await admin.from('rfx_projects').delete().like('project_code', `${tag}%`)
  }
})

test('la migración de seguridad es aditiva: solo agrega políticas restrictivas y no toca datos', () => {
  const dir = new URL('../../supabase/migrations/', import.meta.url)
  const file = readdirSync(dir).find(name => name.endsWith('_supplier_internal_tables_rls.sql'))
  assert.ok(file, 'falta la migración de aislamiento de proveedores')
  const sql = readFileSync(new URL(file as string, dir), 'utf8')
  for (const table of INTERNAL_TABLES) assert.ok(sql.includes(`'${table}'`), `la migración no cubre ${table}`)
  assert.match(sql, /as restrictive/i)
  assert.doesNotMatch(sql, /\b(delete\s+from|truncate|drop\s+table|drop\s+column|alter\s+table[^;]*disable)/i)
  assert.doesNotMatch(sql, /create\s+policy[^;]*as\s+permissive/i)
})
