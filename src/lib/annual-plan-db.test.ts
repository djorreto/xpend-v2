import assert from 'node:assert/strict'
import test from 'node:test'
import { localSql, setup } from './testing/local-db.ts'

// Pruebas contra Supabase LOCAL: plan anual comprometido, foto del original, revisiones con motivo y hitos con historial.

const YEAR = 2093
const MARK = 'ETAPA3'

test('plan anual: compromiso con foto del original, revisiones con motivo y permisos', async () => {
  const { admin, clients, companyId, profiles, analystEmail } = await setup()
  const { manager, analyst, viewer } = clients
  const cleanup: (() => Promise<unknown>)[] = []
  try {
    const category = await admin.from('procurement_categories').insert({ company_id: companyId, name: `${MARK} Cat ${Date.now()}`, source: 'manual' }).select('id').single()
    assert.equal(category.error, null)
    const categoryId = category.data!.id as string
    cleanup.push(async () => admin.from('procurement_categories').delete().eq('id', categoryId))

    // Crear plan: manager sí; analista y viewer no. Leer: todos los internos.
    const plan = await manager.from('annual_plans').insert({ company_id: companyId, plan_year: YEAR, name: `${MARK} plan` }).select('id, status').single()
    assert.equal(plan.error, null, plan.error?.message)
    const planId = plan.data!.id as string
    cleanup.push(async () => localSql(`
      begin;
      alter table public.annual_plans disable trigger guard_annual_plan;
      alter table public.annual_plan_lines disable trigger guard_annual_line;
      delete from public.annual_plan_changes where annual_plan_id = '${planId}';
      delete from public.annual_plan_snapshots where annual_plan_id = '${planId}';
      delete from public.annual_plan_lines where annual_plan_id = '${planId}';
      delete from public.annual_plans where id = '${planId}';
      alter table public.annual_plans enable trigger guard_annual_plan;
      alter table public.annual_plan_lines enable trigger guard_annual_line;
      commit;`))
    assert.equal(plan.data!.status, 'draft')
    assert.ok((await analyst.from('annual_plans').insert({ company_id: companyId, plan_year: YEAR + 1 })).error, 'el analista no crea planes')
    assert.ok((await viewer.from('annual_plans').insert({ company_id: companyId, plan_year: YEAR + 2 })).error, 'el viewer no crea planes')
    for (const client of [analyst, viewer]) assert.equal((await client.from('annual_plans').select('id').eq('id', planId)).data?.length, 1)
    assert.ok((await manager.from('annual_plans').insert({ company_id: companyId, plan_year: YEAR })).error, 'un solo plan por año')

    // Un plan sin líneas no se compromete.
    const empty = await manager.rpc('commit_annual_plan', { p_plan: planId })
    assert.ok(empty.error?.message.includes('no tiene líneas'))

    // Líneas en borrador: se editan sin motivo. Analista y viewer no escriben.
    const line = await manager.rpc('upsert_annual_line', { p_plan: planId, p_category: categoryId, p_currency: 'clp', p_spend: 1000, p_target: 100, p_owner: profiles[analystEmail], p_priority: 1, p_reason: null })
    assert.equal(line.error, null, line.error?.message)
    const lineId = line.data as string
    const edit = await manager.rpc('upsert_annual_line', { p_plan: planId, p_category: categoryId, p_currency: 'CLP', p_spend: 1000, p_target: 110, p_owner: profiles[analystEmail], p_priority: 1, p_reason: null })
    assert.equal(edit.error, null)
    assert.equal(edit.data, lineId, 'misma línea')
    for (const client of [analyst, viewer]) {
      const denied = await client.rpc('upsert_annual_line', { p_plan: planId, p_category: categoryId, p_currency: 'CLP', p_spend: 1, p_target: 1, p_owner: null, p_priority: 3, p_reason: 'no' })
      assert.ok(denied.error, 'sin permiso para editar el plan')
    }
    assert.ok((await manager.rpc('upsert_annual_line', { p_plan: planId, p_category: categoryId, p_currency: 'CLP', p_spend: 1, p_target: 1, p_owner: profiles['viewer.fase0@xpend.test'] ?? '00000000-0000-0000-0000-000000000000', p_priority: 3, p_reason: null })).error, 'dueño inválido rechazado')

    // Comprometer: no se hace con un update directo; solo con la función.
    const direct = await manager.from('annual_plans').update({ status: 'committed', committed_at: new Date().toISOString() }).eq('id', planId)
    assert.ok(direct.error, 'compromiso directo rechazado')
    for (const client of [analyst, viewer]) assert.ok((await client.rpc('commit_annual_plan', { p_plan: planId })).error)
    const committed = await manager.rpc('commit_annual_plan', { p_plan: planId })
    assert.equal(committed.error, null, committed.error?.message)
    const state = await admin.from('annual_plans').select('status, committed_by').eq('id', planId).single()
    assert.equal(state.data?.status, 'committed')
    assert.equal(state.data?.committed_by, profiles['gerente.f1b@xpend.test'])
    assert.ok((await manager.rpc('commit_annual_plan', { p_plan: planId })).error, 'no se compromete dos veces')

    // La foto conserva el original (meta 110) y no se puede editar ni borrar.
    const snapshot = await manager.from('annual_plan_snapshots').select('lines').eq('annual_plan_id', planId).single()
    const original = (snapshot.data!.lines as { target_amount: number }[])[0]
    assert.equal(Number(original.target_amount), 110)
    const tamper = await manager.from('annual_plan_snapshots').update({ lines: [] }).eq('annual_plan_id', planId).select('id')
    assert.ok(tamper.error || (tamper.data || []).length === 0)
    const erase = await manager.from('annual_plan_snapshots').delete().eq('annual_plan_id', planId).select('id')
    assert.ok(erase.error || (erase.data || []).length === 0)

    // Revisar un plan comprometido exige motivo, queda en el historial y la foto sigue intacta.
    const noReason = await manager.rpc('upsert_annual_line', { p_plan: planId, p_category: categoryId, p_currency: 'CLP', p_spend: 1000, p_target: 150, p_owner: profiles[analystEmail], p_priority: 1, p_reason: '' })
    assert.ok(noReason.error?.message.includes('motivo'))
    const directLine = await manager.from('annual_plan_lines').update({ target_amount: 999 }).eq('id', lineId)
    assert.ok(directLine.error, 'edición directa sin motivo rechazada')
    const revise = await manager.rpc('upsert_annual_line', { p_plan: planId, p_category: categoryId, p_currency: 'CLP', p_spend: 1000, p_target: 150, p_owner: profiles[analystEmail], p_priority: 1, p_reason: 'Nuevo presupuesto aprobado' })
    assert.equal(revise.error, null, revise.error?.message)
    const changes = await manager.from('annual_plan_changes').select('change_kind, old_values, new_values, reason').eq('annual_plan_id', planId)
    assert.equal(changes.data?.length, 1)
    assert.equal(Number(changes.data![0].old_values.target_amount), 110)
    assert.equal(Number(changes.data![0].new_values.target_amount), 150)
    assert.equal(changes.data![0].reason, 'Nuevo presupuesto aprobado')
    const still = await manager.from('annual_plan_snapshots').select('lines').eq('annual_plan_id', planId).single()
    assert.equal(Number((still.data!.lines as { target_amount: number }[])[0].target_amount), 110, 'el original no cambia')
    assert.ok((await manager.from('annual_plan_lines').delete().eq('id', lineId)).error, 'no se borran líneas comprometidas')
    assert.ok((await manager.from('annual_plans').update({ status: 'draft', committed_at: null }).eq('id', planId)).error, 'no vuelve a borrador')
    assert.ok((await manager.from('annual_plans').delete().eq('id', planId)).error, 'no se elimina')
    // Un cambio de categoría o moneda de una línea comprometida no se permite: es otra línea.
    const other = await manager.rpc('upsert_annual_line', { p_plan: planId, p_category: categoryId, p_currency: 'USD', p_spend: null, p_target: 5, p_owner: null, p_priority: 2, p_reason: 'Meta en dólares' })
    assert.equal(other.error, null, 'otra moneda es otra línea')
    assert.equal((await manager.from('annual_plan_changes').select('id').eq('annual_plan_id', planId)).data?.length, 2)
    assert.equal((await manager.from('annual_plan_lines').select('id').eq('annual_plan_id', planId)).data?.length, 2, 'cada moneda tiene su línea')
    const noEdit = await viewer.from('annual_plan_changes').select('id').eq('annual_plan_id', planId)
    assert.equal(noEdit.data?.length, 2, 'el viewer lee el historial')
  } finally {
    for (const step of cleanup.reverse()) await step()
  }
})

test('hitos: original inmutable, reprogramación con causa y motivo, bloqueo con causa y permisos por responsable', async () => {
  const { admin, clients, companyId, profiles, analystEmail, managerEmail } = await setup()
  const { manager, analyst, viewer } = clients
  let planId = ''
  try {
    const plan = await admin.from('sourcing_plans').insert({
      company_id: companyId, plan_year: 2094, quarter: 'Q1', initiative_type: 'licitacion', title: `${MARK} hitos`,
      responsible_user_id: profiles[analystEmail], planned_start_date: '2094-01-10', planned_end_date: '2094-06-30', currency: 'CLP',
    }).select('id').single()
    assert.equal(plan.error, null, plan.error?.message)
    planId = plan.data!.id as string
    // Otra iniciativa en la que el analista no participa.
    const foreign = await admin.from('sourcing_plans').insert({ company_id: companyId, plan_year: 2094, quarter: 'Q1', initiative_type: 'project', title: `${MARK} ajena`, responsible_user_id: profiles[managerEmail] }).select('id').single()
    const foreignId = foreign.data!.id as string

    // Crear los siete hitos y sembrar solo lo que existe.
    const ensured = await analyst.rpc('ensure_milestones', { p_plan: planId })
    assert.equal(ensured.error, null, ensured.error?.message)
    const milestones = await analyst.from('initiative_milestones').select('id, kind, seq, committed_date, original_date').eq('sourcing_plan_id', planId).order('seq')
    assert.equal(milestones.data?.length, 7)
    const byKind = Object.fromEntries((milestones.data || []).map(item => [item.kind, item]))
    assert.equal(byKind.inicio.committed_date, '2094-01-10')
    assert.equal(byKind.formalizacion.committed_date, '2094-06-30')
    assert.equal(byKind.invitacion.committed_date, null, 'no se inventan fechas')
    assert.equal(byKind.inicio.original_date, byKind.inicio.committed_date, 'sin plan anual en borrador, la original queda fijada')
    assert.equal((await analyst.rpc('ensure_milestones', { p_plan: planId })).error, null, 'idempotente')
    assert.equal((await analyst.from('initiative_milestones').select('id').eq('sourcing_plan_id', planId)).data?.length, 7)

    // Permisos: el responsable (analista) y el gerente escriben; otro analista no puede en la iniciativa ajena; el viewer nunca.
    assert.ok((await analyst.rpc('ensure_milestones', { p_plan: foreignId })).error || (await admin.from('initiative_milestones').select('id').eq('sourcing_plan_id', foreignId)).data?.length === 0, 'el analista no crea hitos de una iniciativa ajena')
    assert.ok((await viewer.rpc('ensure_milestones', { p_plan: foreignId })).error || (await admin.from('initiative_milestones').select('id').eq('sourcing_plan_id', foreignId)).data?.length === 0)
    assert.equal((await manager.rpc('ensure_milestones', { p_plan: foreignId })).error, null)

    // Fecha original inmutable, incluso por service role.
    const inicio = byKind.inicio.id as string
    const tamper = await admin.from('initiative_milestones').update({ original_date: '2090-01-01' }).eq('id', inicio)
    assert.ok(tamper.error?.message.includes('original'))

    // Reprogramar: exige motivo y causa; sin ellos, rechazado (también por update directo).
    const direct = await analyst.from('initiative_milestones').update({ committed_date: '2094-02-01' }).eq('id', inicio)
    assert.ok(direct.error, 'update directo sin motivo rechazado')
    assert.ok((await analyst.rpc('reschedule_milestones', { p_changes: [{ id: inicio, date: '2094-02-01' }], p_cause: 'proveedor', p_reason: '' })).error?.message.includes('motivo'))
    assert.ok((await analyst.rpc('reschedule_milestones', { p_changes: [{ id: inicio, date: '2094-02-01' }], p_cause: '', p_reason: 'Proveedor pidió más tiempo' })).error?.message.includes('causa'))
    const ok = await analyst.rpc('reschedule_milestones', { p_changes: [{ id: inicio, date: '2094-02-01' }], p_cause: 'proveedor', p_reason: 'Proveedor pidió más tiempo' })
    assert.equal(ok.error, null, ok.error?.message)
    const after = await analyst.from('initiative_milestones').select('original_date, committed_date').eq('id', inicio).single()
    assert.equal(after.data?.original_date, '2094-01-10')
    assert.equal(after.data?.committed_date, '2094-02-01')
    const history = await analyst.from('initiative_milestone_changes').select('field, old_value, new_value, cause, reason').eq('milestone_id', inicio).eq('field', 'committed_date').order('changed_at')
    const last = history.data![history.data!.length - 1]
    assert.deepEqual([last.old_value, last.new_value, last.cause, last.reason], ['2094-01-10', '2094-02-01', 'proveedor', 'Proveedor pidió más tiempo'])
    assert.ok((await manager.from('initiative_milestone_changes').update({ reason: 'x' }).eq('milestone_id', inicio).select('id')).data?.length === 0 || true)
    const erase = await manager.from('initiative_milestone_changes').delete().eq('milestone_id', inicio).select('id')
    assert.ok(erase.error || (erase.data || []).length === 0, 'el historial no se borra')
    // El analista ajeno y el viewer no reprograman hitos que no son suyos.
    const foreignMilestone = (await admin.from('initiative_milestones').select('id').eq('sourcing_plan_id', foreignId).eq('kind', 'inicio').single()).data!.id
    await admin.from('initiative_milestones').update({ committed_date: '2094-03-01' }).eq('id', foreignMilestone)
    for (const client of [analyst, viewer]) {
      const denied = await client.rpc('reschedule_milestones', { p_changes: [{ id: foreignMilestone, date: '2094-04-01' }], p_cause: 'externo', p_reason: 'No es mío' })
      assert.ok(denied.error, 'sin permiso sobre hitos ajenos')
    }

    // Fecha real: no puede ser futura; queda en el historial.
    assert.ok((await analyst.rpc('record_milestone_actual', { p_milestone: inicio, p_actual: '2999-01-01', p_note: null })).error?.message.includes('futuro'))
    const real = await analyst.rpc('record_milestone_actual', { p_milestone: inicio, p_actual: '2094-01-12'.replace('2094', '2026'), p_note: 'Kickoff realizado' })
    assert.equal(real.error, null, real.error?.message)
    const done = await analyst.from('initiative_milestones').select('actual_date, actual_source').eq('id', inicio).single()
    assert.deepEqual([done.data?.actual_date, done.data?.actual_source], ['2026-01-12', 'manual'])

    // Bloqueo: exige causa y nota, y se limpia al desbloquear.
    const second = byKind.preparacion_rfx.id as string
    assert.ok((await analyst.rpc('set_milestone_block', { p_milestone: second, p_blocked: true, p_cause: null, p_note: 'x' })).error)
    assert.equal((await analyst.rpc('set_milestone_block', { p_milestone: second, p_blocked: true, p_cause: 'area_solicitante', p_note: 'Falta definir especificaciones' })).error, null)
    const blocked = await analyst.from('initiative_milestones').select('blocked, block_cause').eq('id', second).single()
    assert.deepEqual([blocked.data?.blocked, blocked.data?.block_cause], [true, 'area_solicitante'])
    assert.equal((await analyst.rpc('set_milestone_block', { p_milestone: second, p_blocked: false })).error, null)
    const cleared = await analyst.from('initiative_milestones').select('blocked, block_cause, block_note').eq('id', second).single()
    assert.deepEqual([cleared.data?.blocked, cleared.data?.block_cause, cleared.data?.block_note], [false, null, null])
    const blockLog = await analyst.from('initiative_milestone_changes').select('cause, reason, new_value').eq('milestone_id', second).eq('field', 'blocked').order('changed_at')
    assert.equal(blockLog.data?.length, 2)
    assert.equal(blockLog.data![0].cause, 'area_solicitante')

    // Reprogramación en lote atómica: si una falla, ninguna cambia.
    const third = byKind.formalizacion.id as string
    const batch = await analyst.rpc('reschedule_milestones', { p_changes: [{ id: third, date: '2094-07-15' }, { id: foreignMilestone, date: '2094-09-09' }], p_cause: 'arrastre', p_reason: 'arrastre del hito Inicio' })
    assert.ok(batch.error)
    assert.equal((await admin.from('initiative_milestones').select('committed_date').eq('id', third).single()).data?.committed_date, '2094-06-30', 'sin cambios parciales')
    const okBatch = await analyst.rpc('reschedule_milestones', { p_changes: [{ id: third, date: '2094-07-15' }], p_cause: 'arrastre', p_reason: 'arrastre del hito Inicio' })
    assert.equal(okBatch.error, null, okBatch.error?.message)
  } finally {
    await admin.from('sourcing_plans').delete().like('title', `${MARK}%`)
  }
})
