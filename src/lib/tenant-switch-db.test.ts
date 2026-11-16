import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { localSql, setup } from './testing/local-db.ts'

// Pruebas contra Supabase LOCAL: cambio de empresa de un Super Admin (Etapa 6). La identidad y el rol no cambian.

function keys() {
  const raw = execSync('npx supabase status -o env', { cwd: '/Users/diegojorreto/Cursor Projects/Xpend/Xpend V3 - Desarrollo', encoding: 'utf8' })
  const env: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)="(.*)"$/)
    if (match) env[match[1]] = match[2]
  }
  return env
}

test('un Super Admin cambia solo entre sus empresas autorizadas; nadie más lo hace; todo queda en bitácora', async () => {
  const { admin, clients, companyId } = await setup()
  const env = keys()
  const email = `etapa6.sa.${Date.now()}@xpend.test`
  const password = randomBytes(12).toString('hex')
  let userId = ''
  let otherCompany = ''
  let thirdCompany = ''
  try {
    const other = await admin.from('companies').insert({ name: `ETAPA6 empresa demo ${Date.now()}`, settings: { demo: true } }).select('id').single()
    assert.equal(other.error, null)
    otherCompany = other.data!.id as string
    const third = await admin.from('companies').insert({ name: `ETAPA6 empresa ajena ${Date.now()}` }).select('id').single()
    thirdCompany = third.data!.id as string
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    assert.equal(created.error, null)
    userId = created.data.user!.id
    await admin.from('profiles').upsert({ id: userId, email, full_name: 'SA de prueba', role: 'super_admin', company_id: companyId, must_change_password: false })
    await admin.from('procurement_categories').insert({ company_id: otherCompany, name: 'ETAPA6 categoría del demo', source: 'manual' })
    await admin.from('tenant_access').insert([{ user_id: userId, company_id: companyId, kind: 'home' }, { user_id: userId, company_id: otherCompany, kind: 'granted' }])

    const sa = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } })
    assert.equal((await sa.auth.signInWithPassword({ email, password })).error, null)

    // Lista cerrada y empresa activa explícita.
    const listed = await sa.rpc('list_my_tenants')
    assert.equal(listed.error, null)
    const rows = listed.data as { company_id: string; is_demo: boolean; is_active: boolean; is_home: boolean }[]
    assert.equal(rows.length, 2)
    assert.equal(rows.find(row => row.company_id === companyId)?.is_active, true)
    assert.equal(rows.find(row => row.company_id === otherCompany)?.is_demo, true)

    // No ve la categoría de la otra empresa hasta cambiar; después ve solo esa y ninguna de la empresa anterior.
    assert.equal(((await sa.from('procurement_categories').select('id').eq('company_id', otherCompany)).data || []).length, 0)
    assert.equal((await sa.rpc('switch_tenant', { p_company: otherCompany })).error, null)
    assert.equal(((await sa.from('procurement_categories').select('id').eq('company_id', otherCompany)).data || []).length, 1)
    assert.equal(((await sa.from('procurement_categories').select('id').eq('company_id', companyId)).data || []).length, 0, 'no se mezclan datos entre empresas')
    const profile = await sa.from('profiles').select('role, company_id').eq('id', userId).single()
    assert.equal(profile.data?.role, 'super_admin', 'el rol no cambia')
    assert.equal(profile.data?.company_id, otherCompany)

    // Una empresa fuera de la lista se rechaza.
    const denied = await sa.rpc('switch_tenant', { p_company: thirdCompany })
    assert.ok(denied.error?.message.includes('autorización'))
    // Volver a la empresa propia.
    assert.equal((await sa.rpc('switch_tenant', { p_company: companyId })).error, null)
    assert.equal((await sa.from('profiles').select('company_id').eq('id', userId).single()).data?.company_id, companyId)

    // La lista y la bitácora no se escriben desde la aplicación.
    const grant = await sa.from('tenant_access').insert({ user_id: userId, company_id: thirdCompany, kind: 'granted' })
    assert.ok(grant.error, 'nadie se autoriza a sí mismo desde la API')
    const forged = await sa.from('tenant_switch_log').insert({ user_id: userId, to_company: thirdCompany })
    assert.ok(forged.error)
    const log = await sa.from('tenant_switch_log').select('to_company').eq('user_id', userId)
    assert.equal(log.data?.length, 2)
    assert.ok(localSqlFails(`delete from public.tenant_switch_log where user_id = '${userId}'`), 'la bitácora no se borra')

    // Otros roles: lista vacía y no cambian de empresa (aunque la empresa existiera).
    for (const role of ['manager', 'analyst', 'viewer', 'admin']) {
      const client = clients[role]
      assert.deepEqual((await client.rpc('list_my_tenants')).data, [], `${role} no ve empresas alternativas`)
      assert.ok((await client.rpc('switch_tenant', { p_company: otherCompany })).error, `${role} no cambia de empresa`)
    }
  } finally {
    if (userId) {
      localSql(`set session_replication_role = replica; delete from public.tenant_switch_log where user_id = '${userId}'; delete from public.tenant_access where user_id = '${userId}'; delete from public.profiles where id = '${userId}';`)
      await admin.auth.admin.deleteUser(userId)
    }
    for (const id of [otherCompany, thirdCompany].filter(Boolean)) {
      localSql(`set session_replication_role = replica; delete from public.procurement_categories where company_id = '${id}'; delete from public.companies where id = '${id}';`)
    }
  }
})

function localSqlFails(statement: string) {
  try {
    localSql(statement)
    return false
  } catch {
    return true
  }
}
