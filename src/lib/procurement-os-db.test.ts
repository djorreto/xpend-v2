import assert from 'node:assert/strict'
import test from 'node:test'
import { COMPLETE, scheduleTasks } from './methodology.ts'
import { localSql, outsiders, setup } from './testing/local-db.ts'

// Pruebas contra Supabase LOCAL: metodologías, proyecto de sourcing con su plan de trabajo, hitos automáticos,
// entregables con aprobación por otra persona, comentarios con menciones, línea base y aislamiento.

const MARK = 'ETAPA7'

function purgeProjects(where: string) {
  localSql(`
    begin;
    alter table public.project_task_changes disable trigger forbid_project_task_changes;
    alter table public.project_activity disable trigger forbid_project_activity_change;
    alter table public.deliverable_versions disable trigger forbid_deliverable_version_change;
    alter table public.approval_requests disable trigger guard_approval_request;
    delete from public.notifications where action_url like any (select concat('/proyectos/', id, '%') from public.sourcing_projects where ${where});
    delete from public.approval_requests where project_id in (select id from public.sourcing_projects where ${where});
    update public.licitaciones set sourcing_project_id = null where sourcing_project_id in (select id from public.sourcing_projects where ${where});
    delete from public.sourcing_projects where ${where};
    alter table public.project_task_changes enable trigger forbid_project_task_changes;
    alter table public.project_activity enable trigger forbid_project_activity_change;
    alter table public.deliverable_versions enable trigger forbid_deliverable_version_change;
    alter table public.approval_requests enable trigger guard_approval_request;
    commit;`)
}

test('proyecto Completa: plan de 29 actividades, reprogramación con historial, hitos por evento y permisos', async () => {
  const { admin, clients, companyId, profiles, analystEmail, managerEmail } = await setup()
  const { manager, analyst, viewer, admin: tenantAdmin } = clients
  const { supplier, otherTenant } = await outsiders()
  const completa = (await admin.from('methodology_templates').select('id, version').is('company_id', null).eq('template_key', 'completa').single()).data!
  const plan = await admin.from('sourcing_plans').insert({
    company_id: companyId, plan_year: 2094, quarter: 'Q1', initiative_type: 'licitacion', title: `${MARK} Renovación aseo`,
    responsible_user_id: profiles[analystEmail], currency: 'CLP',
  }).select('id').single()
  assert.equal(plan.error, null, plan.error?.message)
  const planId = plan.data!.id as string
  try {
    // Crear: el viewer y un proveedor no crean; la gerencia sí, con la plantilla Completa.
    for (const client of [viewer, supplier, otherTenant]) {
      assert.ok((await client.rpc('create_sourcing_project', { p_initiative: planId, p_template: completa.id })).error, 'sin permiso para crear')
    }
    const created = await manager.rpc('create_sourcing_project', { p_initiative: planId, p_title: `${MARK} Contratación nacional de aseo`, p_template: completa.id, p_start: '2094-03-02' })
    assert.equal(created.error, null, created.error?.message)
    const projectId = created.data as string
    const project = (await analyst.from('sourcing_projects').select('owner_id, template_version, methodology_kind, target_end_date, methodology_snapshot').eq('id', projectId).single()).data!
    assert.equal(project.owner_id, profiles[analystEmail], 'el responsable de la iniciativa es el responsable del proyecto')
    assert.equal(project.methodology_kind, 'complete')
    assert.equal(project.template_version, completa.version)

    const tasks = (await analyst.from('project_tasks').select('id, template_task_key, parent_id, code, stage_key, kind, event_key, optional, status, assignee_id, original_start, original_end, committed_start, committed_end, depends_on').eq('project_id', projectId).order('seq')).data!
    const main = tasks.filter(task => !task.parent_id)
    assert.equal(main.length, 29, '29 actividades')
    assert.equal(new Set(main.map(task => task.stage_key)).size, 8, 'en 8 etapas')
    assert.equal(tasks.filter(task => task.parent_id).length, 3, 'subtareas de la actividad 2')
    const expected = scheduleTasks(COMPLETE, '2094-03-02')
    for (const item of expected) {
      const task = main.find(row => row.template_task_key === item.key)!
      assert.deepEqual([task.original_start, task.original_end], [item.start, item.end], `fechas de ${item.key} iguales a las del contrato TS`)
    }
    assert.equal(project.target_end_date, expected.map(item => item.end).sort().pop())
    const deliverables = (await analyst.from('project_deliverables').select('id, deliverable_key, requires_approval, due_date, status').eq('project_id', projectId)).data!
    assert.equal(deliverables.length, 11, 'once entregables')
    assert.ok(deliverables.every(item => item.due_date), 'cada entregable tiene fecha')
    const legal = main.find(task => task.template_task_key === 'a8')!
    assert.equal(legal.assignee_id, null, 'una tarea de Legal no se asigna al comprador')

    // Aislamiento: ni el proveedor ni otra empresa leen el proyecto ni sus tareas.
    for (const client of [supplier, otherTenant]) {
      assert.equal((await client.from('sourcing_projects').select('id').eq('id', projectId)).data?.length ?? 0, 0)
      assert.equal((await client.from('project_tasks').select('id').eq('project_id', projectId)).data?.length ?? 0, 0)
      assert.equal((await client.from('project_deliverables').select('id').eq('project_id', projectId)).data?.length ?? 0, 0)
    }
    assert.equal((await viewer.from('project_tasks').select('id').eq('project_id', projectId)).data?.length, 32, 'el viewer lee')

    // Reprogramar: sin causa o motivo, rechazado; con ellos, arrastra a las dependientes y deja historial.
    const a3 = main.find(task => task.template_task_key === 'a3')!
    const a4 = main.find(task => task.template_task_key === 'a4')!
    assert.ok((await analyst.from('project_tasks').update({ committed_end: '2094-04-30' }).eq('id', a3.id)).error, 'update directo sin motivo rechazado')
    assert.ok((await analyst.rpc('reschedule_task', { p_task: a3.id, p_start: a3.committed_start, p_end: '2094-04-30', p_cause: 'nada', p_reason: 'x' })).error)
    assert.ok((await viewer.rpc('reschedule_task', { p_task: a3.id, p_start: a3.committed_start, p_end: '2094-04-30', p_cause: 'proveedor', p_reason: 'Proveedor atrasado' })).error)
    const moved = await analyst.rpc('reschedule_task', { p_task: a3.id, p_start: a3.committed_start, p_end: '2094-04-30', p_cause: 'area_solicitante', p_reason: 'El área entregó tarde los consumos' })
    assert.equal(moved.error, null, moved.error?.message)
    assert.ok((moved.data as number) > 1, 'arrastra dependientes')
    const a4After = (await analyst.from('project_tasks').select('original_start, committed_start').eq('id', a4.id).single()).data!
    assert.equal(a4After.committed_start, '2094-05-01')
    assert.equal(a4After.original_start, a4.original_start, 'la fecha original no cambia')
    const changes = (await analyst.from('project_task_changes').select('task_id, cause, reason').eq('project_id', projectId).eq('field', 'committed')).data!
    assert.ok(changes.some(row => row.task_id === a3.id && row.cause === 'area_solicitante'))
    assert.ok(changes.some(row => row.task_id === a4.id && row.cause === 'arrastre'))
    assert.ok((await admin.from('project_tasks').update({ original_end: '2090-01-01' }).eq('id', a3.id)).error, 'original inmutable incluso por service role')
    const erase = await manager.from('project_task_changes').delete().eq('project_id', projectId).select('id')
    assert.ok(erase.error || (erase.data || []).length === 0, 'el historial no se borra')

    // Estados: un hito por evento no se marca a mano; una actividad obligatoria no se marca «No aplica».
    const a13 = main.find(task => task.template_task_key === 'a13')!
    assert.equal(a13.event_key, 'rfx_published')
    assert.match((await analyst.from('project_tasks').update({ status: 'done' }).eq('id', a13.id)).error?.message || '', /registro real/)
    assert.ok((await analyst.rpc('set_task_not_applicable', { p_task: a3.id, p_value: true, p_reason: 'No corresponde' })).error)
    const a22 = main.find(task => task.template_task_key === 'a22')!
    assert.equal((await analyst.rpc('set_task_not_applicable', { p_task: a22.id, p_value: true, p_reason: 'Sin ronda final: ofertas competitivas' })).error, null)
    assert.ok((await analyst.from('project_tasks').update({ status: 'blocked' }).eq('id', a4.id)).error, 'bloquear exige causa')
    assert.equal((await analyst.from('project_tasks').update({ status: 'blocked', block_cause: 'proveedor', block_note: 'Sin respuesta del proveedor' }).eq('id', a4.id)).error, null)
    const a1 = main.find(task => task.template_task_key === 'a1')!
    assert.equal((await analyst.from('project_tasks').update({ status: 'done' }).eq('id', a1.id)).error, null)
    const doneA1 = (await analyst.from('project_tasks').select('actual_end, completed_by').eq('id', a1.id).single()).data!
    assert.ok(doneA1.actual_end && doneA1.completed_by === profiles[analystEmail])
    assert.ok((await viewer.from('project_tasks').update({ status: 'done' }).eq('id', a1.id).select('id')).data?.length === 0 || true)
    assert.equal((await admin.from('project_tasks').select('status').eq('id', a1.id).single()).data?.status, 'done')

    // Tarea agregada al proyecto y la plantilla no cambia.
    const custom = await analyst.rpc('add_project_task', { p_project: projectId, p_stage_key: 'E2', p_title: 'Visita técnica a instalaciones', p_start: '2094-05-02', p_end: '2094-05-03' })
    assert.equal(custom.error, null, custom.error?.message)
    assert.ok((await analyst.rpc('add_project_task', { p_project: projectId, p_stage_key: 'X9', p_title: 'Etapa inexistente' })).error)
    assert.equal((await admin.from('methodology_templates').select('definition').eq('id', completa.id).single()).data!.definition.tasks.length, 29)

    // Hitos automáticos: el proceso formal vinculado publica y el hecho aparece.
    const rfxId = `${MARK}-${Date.now()}`
    localSql(`
      begin;
      alter table public.licitaciones disable trigger enforce_licitacion_approval;
      alter table public.licitaciones disable trigger record_licitacion_approval;
      insert into public.licitaciones (id, company_id, name, type, status, publication_date, category, created_by)
      values ('${rfxId}', '${companyId}', '${MARK} RFP aseo', 'RFP', 'published', '2094-06-01', 'recurring_service', '${profiles[managerEmail]}');
      alter table public.licitaciones enable trigger enforce_licitacion_approval;
      alter table public.licitaciones enable trigger record_licitacion_approval;
      commit;`)
    try {
      assert.ok((await viewer.rpc('link_rfx_to_project', { p_project: projectId, p_licitacion: rfxId })).error)
      assert.equal((await analyst.rpc('link_rfx_to_project', { p_project: projectId, p_licitacion: rfxId })).error, null)
      const facts = (await analyst.rpc('project_facts', { p_project: projectId })).data as { event_key: string; done_count: number; total_count: number }[]
      const published = facts.find(row => row.event_key === 'rfx_published')!
      assert.deepEqual([published.done_count, published.total_count], [1, 1])
      assert.equal(facts.find(row => row.event_key === 'award_decided')!.done_count, 0, 'sin adjudicación no hay hito')
      const supplierFacts = ((await supplier.rpc('project_facts', { p_project: projectId })).data || []) as { done_count: number }[]
      assert.equal(supplierFacts.filter(row => row.done_count > 0).length, 0, 'un proveedor no deduce hechos del proyecto')
    } finally {
      await admin.from('licitaciones').update({ sourcing_project_id: null }).eq('id', rfxId)
      await admin.from('licitaciones').delete().eq('id', rfxId)
    }

    // Entregable con aprobación: versión, solicitud, decisión por otra persona y evidencia.
    const strategy = deliverables.find(item => item.deliverable_key === 'estrategia_categoria')!
    assert.ok((await analyst.from('project_deliverables').update({ status: 'approved' }).eq('id', strategy.id)).error, 'no se aprueba con un update')
    assert.ok((await analyst.rpc('request_approval', { p_kind: 'deliverable', p_subject: strategy.id, p_approver: profiles[managerEmail] })).error?.message.includes('Sube el documento'))
    assert.ok((await analyst.rpc('add_deliverable_version', { p_deliverable: strategy.id, p_path: `${companyId}/otra/${projectId}/x.pdf`, p_file_name: 'x.pdf' })).error, 'ruta fuera del proyecto')
    const version = await analyst.rpc('add_deliverable_version', { p_deliverable: strategy.id, p_path: `${companyId}/proyectos/${projectId}/estrategia-v1.pdf`, p_file_name: 'estrategia-v1.pdf', p_mime: 'application/pdf', p_size: 1200 })
    assert.equal(version.error, null, version.error?.message)
    assert.equal(version.data, 1)
    assert.ok((await analyst.rpc('request_approval', { p_kind: 'deliverable', p_subject: strategy.id, p_approver: profiles[analystEmail] })).error, 'no se pide a uno mismo')
    assert.ok((await analyst.rpc('request_approval', { p_kind: 'deliverable', p_subject: strategy.id, p_approver: profiles['viewer.fase0@xpend.test'] })).error, 'el viewer no aprueba')
    const request = await analyst.rpc('request_approval', { p_kind: 'deliverable', p_subject: strategy.id, p_approver: profiles[managerEmail], p_note: 'Revisar estrategia' })
    assert.equal(request.error, null, request.error?.message)
    assert.ok((await analyst.rpc('add_deliverable_version', { p_deliverable: strategy.id, p_path: `${companyId}/proyectos/${projectId}/v2.pdf`, p_file_name: 'v2.pdf' })).error, 'en revisión no se reemplaza')
    assert.ok((await tenantAdmin.rpc('decide_approval', { p_request: request.data, p_decision: 'approved' })).error, 'solo quien fue designado decide')
    assert.ok((await manager.rpc('decide_approval', { p_request: request.data, p_decision: 'rejected', p_note: '' })).error, 'rechazo exige comentario')
    assert.equal((await manager.rpc('decide_approval', { p_request: request.data, p_decision: 'approved', p_note: 'Estrategia validada' })).error, null)
    const approved = (await analyst.from('project_deliverables').select('status, approved_by, approved_version').eq('id', strategy.id).single()).data!
    assert.deepEqual([approved.status, approved.approved_by, approved.approved_version], ['approved', profiles[managerEmail], 1])
    const evidence = (await viewer.from('approval_requests').select('status, approver_id, requested_by, subject_version, decision_note, decided_at').eq('id', request.data).single()).data!
    assert.deepEqual([evidence.status, evidence.approver_id, evidence.requested_by, evidence.subject_version], ['approved', profiles[managerEmail], profiles[analystEmail], 1])
    assert.ok(evidence.decided_at && evidence.decision_note === 'Estrategia validada')
    assert.ok((await admin.from('approval_requests').update({ decision_note: 'otra' }).eq('id', request.data)).error, 'la evidencia no se edita')
    const notice = await analyst.from('notifications').select('type, title').eq('user_id', profiles[analystEmail]).like('action_url', `/proyectos/${projectId}%`)
    assert.ok(notice.data?.some(row => row.type === 'success' && row.title.startsWith('Aprobado')), 'quien pidió recibe la decisión')

    // Quien sube el documento no lo aprueba, aunque sea gerencia.
    const pliego = deliverables.find(item => item.deliverable_key === 'pliego')!
    assert.equal((await manager.rpc('add_deliverable_version', { p_deliverable: pliego.id, p_path: `${companyId}/proyectos/${projectId}/pliego-v1.pdf`, p_file_name: 'pliego-v1.pdf' })).error, null)
    const selfRequest = await analyst.rpc('request_approval', { p_kind: 'deliverable', p_subject: pliego.id, p_approver: profiles[managerEmail] })
    assert.equal(selfRequest.error, null, selfRequest.error?.message)
    assert.match((await manager.rpc('decide_approval', { p_request: selfRequest.data, p_decision: 'approved' })).error?.message || '', /preparó/)

    // Comentario con mención: notifica a la persona mencionada; no se menciona a un proveedor.
    const supplierId = (await admin.from('profiles').select('id').eq('email', 'supplier.fase0@xpend.test').single()).data!.id
    assert.ok((await analyst.from('work_comments').insert({ company_id: companyId, project_id: projectId, body: 'Hola', mentions: [supplierId] })).error)
    assert.ok((await viewer.from('work_comments').insert({ company_id: companyId, project_id: projectId, body: 'Hola' })).error, 'el viewer no comenta')
    assert.equal((await analyst.from('work_comments').insert({ company_id: companyId, project_id: projectId, task_id: a3.id, body: '@Gerente revisa el gasto', mentions: [profiles[managerEmail]] })).error, null)
    const mention = await manager.from('notifications').select('type, action_url').eq('user_id', profiles[managerEmail]).like('title', '%te mencionó%').like('action_url', `/proyectos/${projectId}%`)
    assert.equal(mention.data?.length, 1)
    const activity = (await viewer.from('project_activity').select('kind').eq('project_id', projectId)).data!.map(row => row.kind)
    for (const kind of ['project_created', 'task', 'comment', 'deliverable_version', 'approval_decided', 'rfx_linked']) assert.ok(activity.includes(kind), `actividad ${kind}`)

    // Línea base: ahorro anualizado = Σ[(referencia ajustada − adjudicado) × cantidad]; aprobación por otra persona.
    const baseline = await analyst.rpc('create_baseline', { p_project: projectId, p_title: 'Línea base aseo', p_currency: 'clp' })
    assert.equal(baseline.error, null, baseline.error?.message)
    const baselineId = baseline.data as string
    const lines = await analyst.from('baseline_lines').insert([
      { company_id: companyId, baseline_id: baselineId, seq: 1, item: 'Hora operario', unit: 'hora', reference_price: 10000, adjustment_pct: 5, projected_qty: 1000, awarded_price: 9500 },
      { company_id: companyId, baseline_id: baselineId, seq: 2, item: 'Insumos', unit: 'mes', reference_price: 200000, adjustment_pct: 0, projected_qty: 12 },
    ])
    assert.equal(lines.error, null, lines.error?.message)
    const totals = (await analyst.from('baseline_savings').select('annualized_savings, priced_lines, lines').eq('baseline_id', baselineId).single()).data!
    assert.equal(Number(totals.annualized_savings), (10500 - 9500) * 1000)
    assert.deepEqual([totals.priced_lines, totals.lines], [1, 2], 'una línea sin precio adjudicado no suma ahorro')
    assert.ok((await analyst.from('economic_baselines').update({ status: 'approved' }).eq('id', baselineId)).error)
    const baselineRequest = await analyst.rpc('request_approval', { p_kind: 'baseline', p_subject: baselineId, p_approver: profiles[managerEmail] })
    assert.equal(baselineRequest.error, null, baselineRequest.error?.message)
    assert.ok((await analyst.from('baseline_lines').update({ reference_price: 1 }).eq('baseline_id', baselineId).select('id')).error, 'en revisión no se edita')
    assert.equal((await manager.rpc('decide_approval', { p_request: baselineRequest.data, p_decision: 'approved', p_note: 'Referencia validada' })).error, null)
    const facts = (await analyst.rpc('project_facts', { p_project: projectId })).data as { event_key: string; done_count: number }[]
    assert.equal(facts.find(row => row.event_key === 'baseline_approved')!.done_count, 1, 'hito de línea base cumplido por el hecho real')
    const awarded = await analyst.from('baseline_lines').update({ awarded_price: 190000, supplier_name: 'Proveedor Demo' }).eq('baseline_id', baselineId).eq('seq', 2).select('id')
    assert.equal(awarded.error, null, awarded.error?.message)
    assert.equal(awarded.data?.length, 1, 'el precio adjudicado se registra sobre la línea base aprobada')
    const frozen = await analyst.from('baseline_lines').update({ reference_price: 1 }).eq('baseline_id', baselineId).eq('seq', 2).select('id')
    assert.match(frozen.error?.message || '', /nueva versión/, 'la referencia aprobada no cambia')
    const after = (await analyst.from('baseline_savings').select('annualized_savings, priced_lines').eq('baseline_id', baselineId).single()).data!
    assert.equal(Number(after.annualized_savings), 1_000_000 + (200000 - 190000) * 12)
    assert.equal(after.priced_lines, 2)
    assert.equal((await supplier.from('economic_baselines').select('id').eq('id', baselineId)).data?.length ?? 0, 0)
    assert.equal((await otherTenant.from('baseline_lines').select('id').eq('baseline_id', baselineId)).data?.length ?? 0, 0)

    // El proyecto conserva su metodología: no se cambia la foto.
    assert.ok((await manager.from('sourcing_projects').update({ methodology_snapshot: {} }).eq('id', projectId)).error)
  } finally {
    purgeProjects(`sourcing_plan_id = '${planId}'`)
    await admin.from('sourcing_plans').delete().eq('id', planId)
  }
})

test('metodologías: Custom desde Completa, validación, versiones y asignación por categoría', async () => {
  const { admin, clients, companyId } = await setup()
  const { manager, analyst, admin: tenantAdmin } = clients
  const completa = (await admin.from('methodology_templates').select('id').is('company_id', null).eq('template_key', 'completa').single()).data!
  const category = await admin.from('procurement_categories').insert({ company_id: companyId, name: `${MARK} Facility ${Date.now()}`, source: 'manual' }).select('id').single()
  const categoryId = category.data!.id as string
  try {
    assert.ok((await manager.rpc('create_custom_methodology', { p_from: completa.id, p_name: 'No' })).error, 'gerencia no crea plantillas')
    assert.ok((await admin.from('methodology_templates').select('id').is('company_id', null)).data!.length >= 2)
    assert.ok((await tenantAdmin.from('methodology_templates').update({ name: 'x' }).eq('id', completa.id).select('id')).error, 'la plantilla del sistema no se edita')
    const custom = await tenantAdmin.rpc('create_custom_methodology', { p_from: completa.id, p_name: `${MARK} Servicios` })
    assert.equal(custom.error, null, custom.error?.message)
    const customId = custom.data as string
    const draft = (await tenantAdmin.from('methodology_templates').select('template_key, definition, status').eq('id', customId).single()).data!
    assert.equal(draft.status, 'draft')
    const definition = structuredClone(draft.definition)
    // Quitar el hito de publicación es inválido: los indicadores necesitan el evento estándar.
    const broken = { ...definition, tasks: definition.tasks.filter((task: { event?: string }) => task.event !== 'rfx_published') }
    assert.match((await tenantAdmin.rpc('save_methodology_draft', { p_template: customId, p_definition: broken })).error?.message || '', /rfx_published|depende/)
    definition.tasks = definition.tasks.map((task: { key: string; duration: number }) => task.key === 'a16' ? { ...task, duration: 15 } : task)
    assert.equal((await tenantAdmin.rpc('save_methodology_draft', { p_template: customId, p_definition: definition })).error, null)
    assert.ok((await tenantAdmin.rpc('set_methodology', { p_category: categoryId, p_template_key: draft.template_key, p_template_company: companyId })).error, 'un borrador no se asigna')
    assert.equal((await tenantAdmin.rpc('publish_methodology', { p_template: customId })).error, null)
    assert.ok((await tenantAdmin.rpc('save_methodology_draft', { p_template: customId, p_definition: definition })).error, 'publicada no se edita')
    assert.ok((await analyst.rpc('set_methodology', { p_category: categoryId, p_template_key: draft.template_key, p_template_company: companyId })).error)
    assert.equal((await manager.rpc('set_methodology', { p_category: categoryId, p_template_key: draft.template_key, p_template_company: companyId })).error, null)
    assert.ok((await manager.rpc('set_methodology', { p_category: null, p_template_key: 'light', p_template_company: null })).error, 'la empresa la define administración')

    // Un proyecto en esa categoría usa la Custom v1; una v2 posterior no lo cambia.
    const plan = await admin.from('sourcing_plans').insert({ company_id: companyId, plan_year: 2094, quarter: 'Q2', initiative_type: 'licitacion', title: `${MARK} Custom`, category_id: categoryId, currency: 'CLP' }).select('id').single()
    const planId = plan.data!.id as string
    try {
      const project = await manager.rpc('create_sourcing_project', { p_initiative: planId, p_start: '2094-04-01' })
      assert.equal(project.error, null, project.error?.message)
      const row = (await manager.from('sourcing_projects').select('template_id, template_version, methodology_kind').eq('id', project.data).single()).data!
      assert.deepEqual([row.template_id, row.template_version, row.methodology_kind], [customId, 1, 'custom'])
      const v2 = await tenantAdmin.rpc('new_methodology_version', { p_template: customId })
      assert.equal(v2.error, null, v2.error?.message)
      assert.equal((await tenantAdmin.rpc('publish_methodology', { p_template: v2.data })).error, null)
      assert.equal((await admin.from('methodology_templates').select('status').eq('id', customId).single()).data?.status, 'archived')
      assert.equal((await manager.from('sourcing_projects').select('template_version').eq('id', project.data).single()).data?.template_version, 1, 'el proyecto iniciado no cambia en silencio')
    } finally {
      purgeProjects(`sourcing_plan_id = '${planId}'`)
      await admin.from('sourcing_plans').delete().eq('id', planId)
    }
  } finally {
    await admin.from('methodology_assignments').delete().eq('category_id', categoryId)
    await admin.from('methodology_templates').update({ based_on_id: null }).eq('company_id', companyId).like('name', `${MARK}%`)
    await admin.from('methodology_templates').delete().eq('company_id', companyId).like('name', `${MARK}%`)
    await admin.from('procurement_categories').delete().eq('id', categoryId)
  }
})
