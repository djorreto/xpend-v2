import assert from 'node:assert/strict'
import test from 'node:test'
import { setup } from './testing/local-db.ts'

// Pruebas contra Supabase LOCAL: permisos, historial y aislamiento multiempresa de la Etapa 2.

const MARK = 'ETAPA2'

test('categorías, equipos y asignaciones: permisos por rol, historial y reasignación con motivo', async () => {
  const { admin, clients, companyId, profiles, analystEmail, managerEmail, adminEmail, viewerEmail } = await setup()
  const created: { table: string; id: string; key?: string }[] = []
  try {
    const manager = clients.manager
    const analyst = clients.analyst
    const viewer = clients.viewer

    // Crear categoría: manager sí, analista y viewer no.
    const asManager = await manager.from('procurement_categories').insert({ company_id: companyId, name: `${MARK} Mantenimiento`, source: 'manual' }).select('id').single()
    assert.equal(asManager.error, null)
    const categoryId = asManager.data!.id as string
    created.push({ table: 'procurement_categories', id: categoryId })
    for (const [role, client] of [['analyst', analyst], ['viewer', viewer]] as const) {
      const denied = await client.from('procurement_categories').insert({ company_id: companyId, name: `${MARK} ${role}`, source: 'manual' })
      assert.ok(denied.error, `${role} no debe crear categorías`)
    }
    // Lectura: todos los internos ven la categoría.
    for (const client of [analyst, viewer]) {
      const seen = await client.from('procurement_categories').select('id').eq('id', categoryId)
      assert.equal(seen.data?.length, 1)
    }
    // Una categoría repetida (mismo nombre normalizado) se rechaza.
    const dup = await manager.from('procurement_categories').insert({ company_id: companyId, name: `  ${MARK.toLowerCase()}   MANTENIMIENTO `, source: 'manual' })
    assert.ok(dup.error, 'nombre duplicado')

    // Equipo y miembros.
    const team = await manager.from('procurement_teams').insert({ company_id: companyId, name: `${MARK} Equipo Industrial` }).select('id').single()
    assert.equal(team.error, null)
    const teamId = team.data!.id as string
    created.push({ table: 'procurement_teams', id: teamId })
    const member = await manager.from('procurement_team_members').insert({ team_id: teamId, company_id: companyId, user_id: profiles[analystEmail], member_role: 'member' }).select('id').single()
    assert.equal(member.error, null)
    const viewerMember = await manager.from('procurement_team_members').insert({ team_id: teamId, company_id: companyId, user_id: profiles[viewerEmail] })
    assert.ok(viewerMember.error, 'un viewer no es asignable a equipos de compras')
    assert.equal((await analyst.from('procurement_teams').insert({ company_id: companyId, name: `${MARK} X` })).error !== null, true)

    // Asignación inicial sin motivo: permitida (no hay nada que reasignar).
    const first = await manager.rpc('assign_category', { p_category: categoryId, p_manager: profiles[managerEmail], p_backup: null, p_team: teamId, p_reason: null })
    assert.equal(first.error, null, first.error?.message)
    // Reasignar sin motivo: rechazado. Con motivo: permitido.
    const noReason = await manager.rpc('assign_category', { p_category: categoryId, p_manager: profiles[analystEmail], p_backup: profiles[managerEmail], p_team: teamId, p_reason: '' })
    assert.ok(noReason.error?.message.includes('motivo'))
    const same = await manager.rpc('assign_category', { p_category: categoryId, p_manager: profiles[analystEmail], p_backup: profiles[analystEmail], p_team: teamId, p_reason: 'mismo' })
    assert.ok(same.error, 'manager y suplente no pueden ser la misma persona')
    const ok = await manager.rpc('assign_category', { p_category: categoryId, p_manager: profiles[analystEmail], p_backup: profiles[managerEmail], p_team: teamId, p_reason: 'Rotación de portafolio' })
    assert.equal(ok.error, null, ok.error?.message)
    // El viewer y el analista no reasignan.
    for (const client of [analyst, viewer]) {
      const denied = await client.rpc('assign_category', { p_category: categoryId, p_manager: profiles[adminEmail], p_backup: null, p_team: null, p_reason: 'no debería' })
      assert.ok(denied.error, 'sin permiso para reasignar categorías')
    }
    const row = await admin.from('category_assignments').select('manager_user_id, backup_user_id').eq('category_id', categoryId).single()
    assert.equal(row.data?.manager_user_id, profiles[analystEmail])

    // Historial: conserva el valor anterior y el motivo, y no se puede editar ni borrar.
    const history = await manager.from('assignment_history').select('role_kind, from_value, to_value, reason').eq('entity_id', categoryId).order('changed_at')
    const managerChanges = (history.data || []).filter(entry => entry.role_kind === 'manager')
    assert.equal(managerChanges.length, 2)
    assert.equal(managerChanges[1].from_value, profiles[managerEmail])
    assert.equal(managerChanges[1].reason, 'Rotación de portafolio')
    const tamper = await manager.from('assignment_history').update({ reason: 'editado' }).eq('entity_id', categoryId).select('id')
    assert.ok(tamper.error || (tamper.data || []).length === 0, 'el historial es de solo agregar')
    const erase = await manager.from('assignment_history').delete().eq('entity_id', categoryId).select('id')
    assert.ok(erase.error || (erase.data || []).length === 0)
    const viewerHistory = await viewer.from('assignment_history').select('id').eq('entity_id', categoryId)
    assert.ok((viewerHistory.data || []).length > 0, 'el viewer puede leer el historial')

    // Iniciativa: asignar, reasignar con motivo, historial y aislamiento de otra empresa.
    const plan = await admin.from('sourcing_plans').insert({ company_id: companyId, plan_year: 2026, quarter: 'Q1', initiative_type: 'project', title: `${MARK} iniciativa` }).select('id').single()
    assert.equal(plan.error, null)
    const planId = plan.data!.id as string
    created.push({ table: 'sourcing_plans', id: planId })
    const assigned = await manager.rpc('assign_initiative', { p_plan: planId, p_responsible: profiles[analystEmail], p_backup: profiles[managerEmail], p_team: teamId, p_category: categoryId, p_reason: null })
    assert.equal(assigned.error, null, assigned.error?.message)
    const reassignNoReason = await manager.rpc('assign_initiative', { p_plan: planId, p_responsible: profiles[managerEmail], p_backup: profiles[analystEmail], p_team: teamId, p_category: categoryId, p_reason: null })
    assert.ok(reassignNoReason.error?.message.includes('motivo'))
    const reassigned = await manager.rpc('assign_initiative', { p_plan: planId, p_responsible: profiles[managerEmail], p_backup: profiles[analystEmail], p_team: teamId, p_category: categoryId, p_reason: 'Vacaciones' })
    assert.equal(reassigned.error, null, reassigned.error?.message)
    const planHistory = await admin.from('assignment_history').select('role_kind, from_value, to_value, reason').eq('entity_id', planId)
    const responsible = (planHistory.data || []).filter(entry => entry.role_kind === 'responsible')
    assert.equal(responsible.length, 2)
    assert.ok(responsible.some(entry => entry.reason === 'Vacaciones' && entry.from_value === profiles[analystEmail]))
    for (const client of [analyst, viewer]) {
      const denied = await client.rpc('assign_initiative', { p_plan: planId, p_responsible: profiles[adminEmail], p_backup: null, p_team: null, p_category: null, p_reason: 'no' })
      assert.ok(denied.error, 'sin permiso para reasignar iniciativas')
    }
    const unchanged = await admin.from('sourcing_plans').select('responsible_user_id').eq('id', planId).single()
    assert.equal(unchanged.data?.responsible_user_id, profiles[managerEmail])

    // Una categoría de otra empresa no se puede usar en la iniciativa.
    const other = await admin.from('companies').select('id').neq('id', companyId).limit(1)
    if (other.data?.length) {
      const foreign = await admin.from('procurement_categories').insert({ company_id: other.data[0].id, name: `${MARK} ajena`, source: 'manual' }).select('id').single()
      assert.equal(foreign.error, null)
      created.push({ table: 'procurement_categories', id: foreign.data!.id as string })
      const crossed = await manager.rpc('assign_initiative', { p_plan: planId, p_responsible: profiles[managerEmail], p_backup: null, p_team: null, p_category: foreign.data!.id, p_reason: 'cruce' })
      assert.ok(crossed.error, 'categoría de otra empresa rechazada')
      assert.equal((await manager.from('procurement_categories').select('id').eq('id', foreign.data!.id)).data?.length, 0, 'no se ve la categoría ajena')
    }
  } finally {
    for (const item of created.reverse()) {
      if (item.table === 'sourcing_plans') await admin.from('sourcing_plans').update({ category_id: null, team_id: null }).eq('id', item.id)
      await admin.from(item.table).delete().eq('id', item.id)
    }
    await admin.from('assignment_history').delete().in('entity_id', created.map(item => item.id))
  }
})
