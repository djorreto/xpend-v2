// Escenario «Facility Management» de XPEND Company S.A. (DEMO): categoría con subcategorías, iniciativa «Renovación de servicios de aseo 2027»,
// proyecto «Contratación nacional de aseo» con metodología Completa (29 actividades), contratos anteriores, RFI y RFP, documentos PDF ficticios,
// línea base, aprobaciones, comentarios y recorridos guiados.
//
// Reglas:
//  * Solo escribe en la empresa demo existente (settings.demo = true y demo_key correcto). No toca otras empresas ni borra nada.
//  * Idempotente: cada paso comprueba si ya existe. Se corre dos veces: antes y después de «npm run demo:flow -- F».
//  * Las acciones de negocio usan las mismas funciones (RPC) y reglas que la aplicación, con la persona que corresponde.
// Uso: node scripts/demo/facility.mjs   (producción: DEMO_TARGET=prod DEMO_CONFIRM=… como en la siembra)
import { COMPANY_NAME, DEMO_DOMAIN, DEMO_KEY, TARGET, addDays, authAdmin, findUser, loadCredentials, must, randomPassword, saveCredentials, serviceClient, signedIn, today } from './common.mjs'
import { FACILITY } from './dataset.mjs'
import { textPdf } from './pdf.mjs'

const creds = loadCredentials()
const companyId = creds.companyId
const t0 = today()
const log = (text) => console.log(`· ${text}`)
const year = creds.year

const company = must(await serviceClient.from('companies').select('id, name, settings').eq('id', companyId).single(), 'empresa demo')
if (company.settings?.demo !== true || company.settings?.demo_key !== DEMO_KEY || company.name !== COMPANY_NAME) {
  throw new Error('La empresa de las credenciales no es la empresa demo. No se modificó nada.')
}
log(`Destino: ${TARGET === 'prod' ? 'PRODUCCIÓN · solo la empresa demo' : 'Supabase local'} · ${COMPANY_NAME}`)

const sessions = {}
for (const key of ['manager', 'admin', 'buyer1', 'buyer3', 'buyer4', 'committee']) sessions[key] = await signedIn(creds.users[key].email, creds.users[key].password)
const { manager, admin, buyer4, committee } = sessions
const ids = creds.ids
const one = async (query, label) => (must(await query, label) || [])[0] || null

// ---- Metodología: Completa para la empresa demo ------------------------------------------------------------------------------
if (!(await one(serviceClient.from('methodology_assignments').select('template_key').eq('company_id', companyId).is('category_id', null), 'asignación'))) {
  must(await admin.rpc('set_methodology', { p_category: null, p_template_key: 'completa', p_template_company: null }), 'metodología de la empresa')
  log('La empresa demo usa la metodología Completa (Xinergy).')
}

// ---- Categoría Facility Management y subcategorías ----------------------------------------------------------------------------
const categories = {}
const findCategory = (name, parent) => one(serviceClient.from('procurement_categories').select('id').eq('company_id', companyId).eq('name', name)[parent ? 'eq' : 'is']('parent_id', parent || null), `categoría ${name}`)
categories.fm = (await findCategory(FACILITY.category.name, null))?.id
if (!categories.fm) categories.fm = must(await manager.from('procurement_categories').insert({ company_id: companyId, name: FACILITY.category.name, source: 'manual', created_by: ids.manager }).select('id').single(), 'categoría FM').id
for (const sub of FACILITY.category.subs) {
  categories[sub.key] = (await findCategory(sub.name, categories.fm))?.id
  if (!categories[sub.key]) categories[sub.key] = must(await manager.from('procurement_categories').insert({ company_id: companyId, name: sub.name, parent_id: categories.fm, source: 'manual', created_by: ids.manager }).select('id').single(), `subcategoría ${sub.name}`).id
}
const teamCorp = (await one(serviceClient.from('procurement_teams').select('id').eq('company_id', companyId).eq('name', 'Equipo Corporativo'), 'equipo'))?.id || null
for (const [key, owner, backup] of [['fm', 'buyer4', 'buyer3'], ['aseo', 'buyer4', 'buyer3'], ['asc', 'buyer1', 'buyer4'], ['clima', 'buyer1', 'buyer4'], ['seg', 'buyer4', 'buyer3']]) {
  if (await one(serviceClient.from('category_assignments').select('category_id').eq('category_id', categories[key]), 'asignación')) continue
  must(await manager.from('category_assignments').insert({ company_id: companyId, category_id: categories[key], manager_user_id: ids[owner], backup_user_id: ids[backup], team_id: teamCorp }), `asignación ${key}`)
}
log(`Categoría ${FACILITY.category.name} con ${FACILITY.category.subs.length} subcategorías y responsables.`)

// ---- Proveedores (directorio y portal) -------------------------------------------------------------------------------------------
let credsChanged = false
for (const supplier of FACILITY.suppliers) {
  const address = `contacto.${supplier.key}@${DEMO_DOMAIN}`
  const existing = await one(serviceClient.from('suppliers').select('id, contact_email').eq('id', supplier.id), 'proveedor')
  if (!existing) must(await serviceClient.from('suppliers').insert({ id: supplier.id, company_id: companyId, fantasy_name: supplier.fantasy, legal_name: supplier.legal, rut: supplier.rut, service_type: 'Aseo e higiene', contact_email: supplier.portal ? address : null, is_active: true }), `proveedor ${supplier.key}`)
  else if (supplier.portal && !existing.contact_email) must(await serviceClient.from('suppliers').update({ contact_email: address }).eq('id', supplier.id).eq('company_id', companyId), `correo ${supplier.key}`)
  if (!supplier.portal || creds.users[`supplier_${supplier.key}`]) continue
  if (await findUser(address)) throw new Error(`El usuario ${address} ya existe sin credenciales guardadas; se detiene sin modificarlo.`)
  const password = randomPassword()
  const user = await authAdmin('users', { method: 'POST', body: JSON.stringify({ email: address, password, email_confirm: true, user_metadata: { full_name: supplier.fantasy, demo: true } }) })
  must(await serviceClient.from('profiles').upsert({ id: user.id, email: address, full_name: supplier.fantasy, role: 'supplier', company_id: companyId, supplier_id: supplier.id, must_change_password: false }, { onConflict: 'id' }), `perfil ${supplier.key}`)
  creds.users[`supplier_${supplier.key}`] = { email: address, password, name: supplier.fantasy, role: 'supplier', title: 'Proveedor oferente (portal)' }
  credsChanged = true
}
if (credsChanged) saveCredentials(creds)
log(`${FACILITY.suppliers.length} proveedores de aseo (${FACILITY.suppliers.filter(item => item.portal).length} con portal).`)

// ---- Iniciativas del plan 2027 --------------------------------------------------------------------------------------------------
const plan2027 = await one(serviceClient.from('annual_plans').select('id, status').eq('company_id', companyId).eq('plan_year', year + 1), 'plan 2027')
creds.planIds ||= {}
for (const item of FACILITY.initiatives) {
  let row = await one(serviceClient.from('sourcing_plans').select('id').eq('company_id', companyId).eq('title', item.title), `iniciativa ${item.key}`)
  if (!row) {
    row = must(await manager.from('sourcing_plans').insert({
      company_id: companyId, plan_year: year + 1, quarter: item.quarter, initiative_type: 'licitacion', title: item.title, description: item.description,
      category: FACILITY.category.subs.find(sub => sub.key === item.cat).name, category_id: categories[item.cat], estimated_spend: item.spend, currency: 'CLP',
      projected_savings_percentage: item.pct, projected_savings_amount: Math.round((item.spend * item.pct) / 100), status: item.status,
      responsible_user_id: ids[item.owner], backup_user_id: ids[item.backup], team_id: teamCorp, created_by: ids.manager,
      planned_start_date: addDays(t0, item.start), planned_end_date: addDays(t0, item.end),
    }).select('id').single(), `iniciativa ${item.key}`)
    if (plan2027 && plan2027.status !== 'committed') {
      const line = await manager.rpc('upsert_annual_line', { p_plan: plan2027.id, p_category: categories[item.cat], p_currency: 'CLP', p_spend: item.spend, p_target: Math.round((item.spend * item.pct) / 100), p_owner: ids[item.owner], p_priority: 1, p_reason: 'Facility Management 2027 (demostración)' })
      if (line.error) console.log(`  (línea del plan ${year + 1} para ${item.key}: ${line.error.message})`)
    }
    if (item.milestones) {
      must(await manager.rpc('ensure_milestones', { p_plan: row.id }), `hitos ${item.key}`)
      const milestones = must(await manager.from('initiative_milestones').select('id, kind, committed_date').eq('sourcing_plan_id', row.id), 'hitos')
      for (const [kind, offset] of Object.entries(item.milestones)) {
        const milestone = milestones.find(entry => entry.kind === kind)
        if (milestone && !milestone.committed_date) must(await manager.from('initiative_milestones').update({ committed_date: addDays(t0, offset) }).eq('id', milestone.id), `hito ${kind}`)
      }
    }
  }
  creds.planIds[item.key] = row.id
}
saveCredentials(creds)
log(`${FACILITY.initiatives.length} iniciativas de Facility Management en el plan ${year + 1}.`)

// ---- Contratos anteriores con su documento PDF --------------------------------------------------------------------------------
const contracts = {}
for (const item of FACILITY.contracts) {
  let row = await one(serviceClient.from('contracts').select('id').eq('company_id', companyId).eq('code', item.code), `contrato ${item.code}`)
  if (!row) {
    const startsOn = addDays(t0, item.start)
    const endsOn = addDays(t0, item.end)
    row = must(await admin.from('contracts').insert({
      company_id: companyId, code: item.code, name: item.name, contract_type: 'Servicio', counterparty_name: item.counterparty, supplier_id: item.supplier, status: 'draft', origin: 'upload',
      owner_id: ids[item.owner], starts_on: startsOn, ends_on: endsOn, signed_on: addDays(startsOn, -12), renewal: 'manual', notice_days: 60, currency: 'CLP', amount: item.amount, periodicity: 'monthly',
      object_text: item.object, scope_text: item.scope, notes: 'DEMO · Contrato vigente cargado al repositorio.', category_id: categories[item.cat], created_by: ids.admin,
    }).select('id').single(), `contrato ${item.code}`)
    const body = [
      `Código ${item.code}. Partes: ${COMPANY_NAME} y ${item.counterparty}.`, '',
      `PRIMERA · Objeto. ${item.object}`, `Alcance: ${item.scope}`, '',
      `SEGUNDA · Vigencia. Desde el ${startsOn} hasta el ${endsOn}. Se renueva solo por acuerdo escrito de ambas partes.`, '',
      `TERCERA · Precio. Monto total ${item.amount.toLocaleString('es-CL')} CLP, facturado mensualmente y pagado a 30 días desde la recepción conforme.`, '',
      'CUARTA · Niveles de servicio. Cumplimiento mínimo de 95% de las pautas de aseo verificadas en inspección mensual. Bajo ese umbral se aplica una multa de 2% de la facturación mensual por punto porcentual, con tope de 10%.', '',
      'QUINTA · Dotación y reemplazos. El proveedor mantiene la dotación comprometida y cubre ausencias dentro de las 4 horas siguientes al aviso.', '',
      'SEXTA · Término. Cualquiera de las partes puede no renovar avisando con 60 días de anticipación.', '',
      'Este documento es ficticio y fue creado para la demostración comercial de XPEND.',
    ].join('\n')
    const pdf = textPdf(`Contrato ${item.code} · ${item.name}`, body)
    const path = `${companyId}/contratos/${row.id}/${item.code}.pdf`
    const stored = await serviceClient.storage.from('documents').upload(path, pdf, { contentType: 'application/pdf', upsert: false })
    if (stored.error) throw new Error(`documento ${item.code}: ${stored.error.message}`)
    must(await admin.from('contract_documents').insert({ contract_id: row.id, company_id: companyId, kind: 'original', version: 1, file_name: `${item.code}.pdf`, storage_path: path, mime: 'application/pdf', size_bytes: pdf.length, sha256: 'demo', processing: 'processed', extracted_text: body, uploaded_by: ids.admin }), `documento ${item.code}`)
    const activated = await admin.from('contracts').update({ status: 'active' }).eq('id', row.id)
    if (activated.error) console.log(`  (contrato ${item.code} queda en borrador: ${activated.error.message})`)
  }
  contracts[item.key] = row.id
}
log(`${FACILITY.contracts.length} contratos vigentes de aseo, ascensores y climatización con su PDF.`)

// ---- Procesos RFI y RFP regiones (el RFP Santiago lo recorre «demo:flow F» por la interfaz) ---------------------------------------
for (const lic of FACILITY.licitaciones) {
  if (await one(serviceClient.from('licitaciones').select('id').eq('id', lic.id), lic.id)) continue
  const pdf = textPdf(lic.document.title, lic.document.body)
  const path = `${companyId}/bases/${lic.id}/${lic.document.file}`
  const stored = await serviceClient.storage.from('documents').upload(path, pdf, { contentType: 'application/pdf', upsert: false })
  if (stored.error) throw new Error(`bases ${lic.id}: ${stored.error.message}`)
  must(await manager.from('licitaciones').insert({
    id: lic.id, company_id: companyId, name: lic.name, description: lic.description, status: 'planned', type: lic.type, category: 'recurring_service', category_label: 'Aseo e higiene',
    baseline_currency: lic.baseline ? 'CLP' : null, baseline_amount: lic.baseline || null, baseline_source: lic.baseline ? 'historical' : null,
    tender_document_path: path, tender_document_name: lic.document.file, tender_document_size: pdf.length,
    publication_date: lic.published ? addDays(t0, lic.published) : null, proposal_closing_date: lic.closing ? addDays(t0, lic.closing) : null,
    responsible_user_id: ids.buyer4, created_by: ids.manager,
  }), lic.id)
  must(await serviceClient.from('sourcing_plan_licitaciones').insert({ plan_id: creds.planIds.fmaseo, licitacion_id: lic.id }), `enlace ${lic.id}`)
  for (const stage of lic.stages) {
    const moved = await manager.from('licitaciones').update({ status: stage }).eq('id', lic.id)
    if (moved.error) { console.log(`  (${lic.id} queda antes de «${stage}»: ${moved.error.message})`); break }
  }
}

// ---- Proyectos de sourcing ------------------------------------------------------------------------------------------------------
const templates = must(await serviceClient.from('methodology_templates').select('id, template_key').is('company_id', null).eq('status', 'published'), 'plantillas')
const templateId = (key) => templates.find(item => item.template_key === key).id
const projects = {}
const fresh = new Set()
for (const spec of FACILITY.projects) {
  let row = await one(serviceClient.from('sourcing_projects').select('id').eq('company_id', companyId).eq('title', spec.title), `proyecto ${spec.key}`)
  if (!row) {
    const id = must(await manager.rpc('create_sourcing_project', { p_initiative: creds.planIds[spec.initiative], p_title: spec.title, p_template: templateId(spec.template), p_owner: ids[spec.owner], p_start: addDays(t0, spec.start), p_priority: spec.priority, p_description: spec.description }), `proyecto ${spec.key}`)
    row = { id: typeof id === 'string' ? id : id.id }
    fresh.add(spec.key)
  }
  projects[spec.key] = row.id
}
log(`Proyectos: ${FACILITY.projects.map(item => item.title).join(' · ')}${fresh.size ? ` (${fresh.size} nuevos)` : ''}.`)

const tasksOf = async (project) => must(await serviceClient.from('project_tasks').select('id, template_task_key, parent_id, title, role, status, kind, event_key, assignee_id, committed_start, committed_end, depends_on').eq('project_id', project).order('seq'), 'tareas')
const deliverablesOf = async (project) => must(await serviceClient.from('project_deliverables').select('id, deliverable_key, title, status, current_version, requires_approval').eq('project_id', project), 'entregables')
const sessionFor = (key) => sessions[key] || manager
const minDate = (a, b) => (a < b ? a : b)

async function uploadVersion(session, project, deliverable, doc) {
  const pdf = textPdf(doc.title, doc.body)
  const version = deliverable.current_version + 1
  const path = `${companyId}/proyectos/${project}/${deliverable.deliverable_key}/v${version}-${Date.now()}.pdf`
  const stored = await session.storage.from('documents').upload(path, pdf, { contentType: 'application/pdf', upsert: false })
  if (stored.error) throw new Error(`documento ${doc.title}: ${stored.error.message}`)
  must(await session.rpc('add_deliverable_version', { p_deliverable: deliverable.id, p_path: path, p_file_name: doc.file, p_mime: 'application/pdf', p_size: pdf.length, p_note: doc.note || null }), `versión ${doc.title}`)
}

async function approve(requester, approverKey, kind, subject, note, decision = 'approved') {
  const request = must(await requester.rpc('request_approval', { p_kind: kind, p_subject: subject, p_approver: ids[approverKey], p_note: note }), 'pedir aprobación')
  if (decision === 'pending') return request
  must(await sessions[approverKey].rpc('decide_approval', { p_request: request, p_decision: decision, p_note: decision === 'approved' ? 'Revisado y aprobado.' : 'Ajustar alcance de regiones antes de aprobar.' }), 'decidir aprobación')
  return request
}

// Avance real del proyecto nacional: cada cambio lo hace la persona asignada o el responsable, con las reglas de la aplicación.
if (fresh.has('nacional')) {
  const project = projects.nacional
  const spec = FACILITY.projects.find(item => item.key === 'nacional')
  let tasks = await tasksOf(project)
  const byKey = (key) => tasks.find(task => task.template_task_key === key && !task.parent_id)
  for (const [key, person] of Object.entries(spec.assign)) {
    const task = byKey(key)
    if (task && task.assignee_id !== ids[person]) must(await buyer4.from('project_tasks').update({ assignee_id: ids[person] }).eq('id', task.id), `asignar ${key}`)
  }
  tasks = await tasksOf(project)
  for (const key of spec.done) {
    const task = byKey(key)
    const actor = Object.entries(sessions).find(([name]) => ids[name] === task.assignee_id)?.[1] || buyer4
    const end = minDate(addDays(task.committed_end, spec.slip?.[key] || 0), addDays(t0, -1))
    must(await actor.from('project_tasks').update({ status: 'done', actual_start: minDate(task.committed_start, end), actual_end: end }).eq('id', task.id), `cumplir ${key}`)
    for (const sub of tasks.filter(item => item.parent_id === task.id)) must(await actor.from('project_tasks').update({ status: 'done', actual_start: minDate(task.committed_start, end), actual_end: end }).eq('id', sub.id), `subtarea ${key}`)
  }
  for (const key of spec.inProgress) must(await buyer4.from('project_tasks').update({ status: 'in_progress', actual_start: byKey(key).committed_start }).eq('id', byKey(key).id), `en curso ${key}`)
  must(await buyer4.from('project_tasks').update({ status: 'blocked', block_cause: spec.block.cause, block_note: spec.block.note }).eq('id', byKey(spec.block.key).id), 'bloqueo')
  const moved = must(await manager.rpc('reschedule_task', { p_task: byKey(spec.reschedule.key).id, p_start: addDays(t0, spec.reschedule.start), p_end: addDays(t0, spec.reschedule.end), p_cause: spec.reschedule.cause, p_reason: spec.reschedule.reason, p_shift_dependents: true }), 'reprogramación')
  log(`Plan de trabajo: ${spec.done.length} actividades cumplidas, ${spec.inProgress.length} en curso, 1 bloqueada y una reprogramación con causa que arrastró ${moved} tareas.`)

  // Entregables con documentos PDF, aprobaciones por otra persona y un rechazo con motivo.
  for (const doc of spec.documents) {
    let deliverable = (await deliverablesOf(project)).find(item => item.deliverable_key === doc.deliverable)
    const author = sessionFor(doc.by)
    await uploadVersion(author, project, deliverable, doc)
    if (doc.reject) {
      deliverable = (await deliverablesOf(project)).find(item => item.deliverable_key === doc.deliverable)
      await approve(author, doc.approver, 'deliverable', deliverable.id, doc.request, 'rejected')
      deliverable = (await deliverablesOf(project)).find(item => item.deliverable_key === doc.deliverable)
      await uploadVersion(author, project, deliverable, doc.reject)
    }
    if (doc.approver) {
      deliverable = (await deliverablesOf(project)).find(item => item.deliverable_key === doc.deliverable)
      await approve(author, doc.approver, 'deliverable', deliverable.id, doc.request, doc.pending ? 'pending' : 'approved')
    }
  }
  log(`${spec.documents.length} entregables con documento (PDF), aprobados por otra persona; uno rechazado y corregido; uno pendiente.`)

  // Línea base formal (Completa): la prepara el responsable y la aprueba la gerencia antes de publicar.
  const baseline = must(await buyer4.rpc('create_baseline', { p_project: project, p_title: spec.baseline.title, p_currency: 'CLP', p_period_months: 12, p_scope: spec.baseline.scope, p_conditions: spec.baseline.conditions }), 'línea base')
  const baselineId = typeof baseline === 'string' ? baseline : baseline.id
  must(await buyer4.from('baseline_lines').insert(spec.baseline.lines.map((line, index) => ({ company_id: companyId, baseline_id: baselineId, seq: index + 1, ...line }))), 'líneas base')
  await approve(buyer4, 'manager', 'baseline', baselineId, 'Línea base nacional con precios 2026 reajustados por IPC y dotación por sede.')
  creds.fm = { ...(creds.fm || {}), baselineId }
  log('Línea base formal aprobada por la gerencia (preparada por el responsable).')

  // Comentarios con menciones (notificaciones internas, sin correos).
  tasks = await tasksOf(project)
  for (const comment of spec.comments) {
    const task = comment.task ? byKey(comment.task) : null
    const deliverable = comment.deliverable ? (await deliverablesOf(project)).find(item => item.deliverable_key === comment.deliverable) : null
    must(await sessionFor(comment.by).from('work_comments').insert({ company_id: companyId, project_id: project, task_id: task?.id || null, deliverable_id: deliverable?.id || null, body: comment.body, mentions: comment.mentions.map(key => ids[key]), author_id: ids[comment.by] }), 'comentario')
  }
  log(`${spec.comments.length} comentarios con menciones y notificaciones internas.`)

  for (const lic of FACILITY.licitaciones) must(await buyer4.rpc('link_rfx_to_project', { p_project: project, p_licitacion: lic.id, p_link: true }), `vincular ${lic.id}`)
  for (const [key, role, note] of spec.contracts) must(await buyer4.rpc('link_project_contract', { p_project: project, p_contract: contracts[key], p_role: role, p_note: note }), `contrato ${key}`)
  log('RFI y RFP regiones vinculados; contratos de Santiago, Norte y Sur como situación anterior.')
}

// Proyectos más simples: sanitización (Light, en curso) y ascensores (Completa, planificado).
for (const spec of FACILITY.projects.filter(item => item.key !== 'nacional' && fresh.has(item.key))) {
  const owner = sessions[spec.owner]
  const tasks = await tasksOf(spec.key === 'nacional' ? projects.nacional : projects[spec.key])
  for (const task of tasks.filter(item => !item.parent_id && !item.event_key && item.committed_end < addDays(t0, -2))) {
    must(await owner.from('project_tasks').update({ status: 'done', actual_start: task.committed_start, actual_end: minDate(task.committed_end, addDays(t0, -1)) }).eq('id', task.id), `avance ${spec.key}`)
  }
  const current = tasks.find(item => !item.parent_id && !item.event_key && item.committed_start <= t0 && item.committed_end >= addDays(t0, -2))
  if (current) must(await owner.from('project_tasks').update({ status: 'in_progress', actual_start: current.committed_start }).eq('id', current.id), `en curso ${spec.key}`)
  for (const [key, role, note] of spec.contracts || []) must(await owner.rpc('link_project_contract', { p_project: projects[spec.key], p_contract: contracts[key], p_role: role, p_note: note }), `contrato ${spec.key}`)
  if (spec.document) {
    let deliverable = (await deliverablesOf(projects[spec.key])).find(item => item.deliverable_key === spec.document.deliverable)
    if (deliverable) {
      await uploadVersion(owner, projects[spec.key], deliverable, spec.document)
      deliverable = (await deliverablesOf(projects[spec.key])).find(item => item.deliverable_key === spec.document.deliverable)
      if (spec.document.approver) await approve(owner, spec.document.approver, 'deliverable', deliverable.id, spec.document.request)
    }
  }
  if (spec.baseline) {
    const created = must(await owner.rpc('create_baseline', { p_project: projects[spec.key], p_title: spec.baseline.title, p_currency: 'CLP', p_period_months: 12, p_scope: spec.baseline.scope, p_conditions: spec.baseline.conditions }), `línea base ${spec.key}`)
    const baselineId = typeof created === 'string' ? created : created.id
    must(await owner.from('baseline_lines').insert(spec.baseline.lines.map((line, index) => ({ company_id: companyId, baseline_id: baselineId, seq: index + 1, ...line }))), `líneas ${spec.key}`)
    await approve(owner, 'manager', 'baseline', baselineId, 'Referencia económica para aprobar.')
  }
}

// ---- Segunda pasada: después del RFP Santiago recorrido por la interfaz ---------------------------------------------------------
const santiago = await one(serviceClient.from('licitaciones').select('id, status, sourcing_project_id').eq('id', FACILITY.flowLicitacion), 'RFP Santiago')
if (!santiago) {
  console.log(`\nFalta el RFP Santiago. Siguiente paso: npm run demo:flow -- F  y luego vuelve a correr este script.`)
} else {
  const project = projects.nacional
  if (santiago.sourcing_project_id !== project) must(await buyer4.rpc('link_rfx_to_project', { p_project: project, p_licitacion: santiago.id, p_link: true }), 'vincular RFP Santiago')
  const successor = await one(serviceClient.from('contracts').select('id').eq('company_id', companyId).eq('licitacion_id', santiago.id), 'contrato nuevo')
  const links = must(await serviceClient.from('project_contracts').select('contract_id, role').eq('project_id', project), 'vínculos')
  if (successor && !links.some(item => item.contract_id === successor.id)) {
    must(await buyer4.rpc('link_project_contract', { p_project: project, p_contract: successor.id, p_role: 'successor', p_note: 'Contrato nuevo de Santiago, resultado del RFP' }), 'contrato sucesor')
    const effective = addDays(t0, FACILITY.successorStart)
    must(await manager.rpc('relate_contracts', { p_from: contracts.stgo, p_to: successor.id, p_relation: 'replacement', p_project: project, p_scope: 'Oficinas centrales y centro de distribución de Santiago', p_share: null, p_effective: effective }), 'reemplazo Santiago')
    must(await manager.rpc('relate_contracts', { p_from: contracts.norte, p_to: successor.id, p_relation: 'partial_replacement', p_project: project, p_scope: 'Bodega Quilicura, hoy dentro del contrato Aseo Norte', p_share: 20, p_effective: effective }), 'reemplazo parcial Norte')
    log('Historia de contratos: Aseo Santiago reemplazado y 20% de Aseo Norte absorbido por el nuevo contrato (n→1 y parcial). Los anteriores siguen vigentes hasta su término.')
  }
  const delivs = await deliverablesOf(project)
  for (const doc of FACILITY.afterFlowDocuments) {
    const deliverable = delivs.find(item => item.deliverable_key === doc.deliverable)
    if (!deliverable || deliverable.current_version > 0) continue
    await uploadVersion(sessionFor(doc.by), project, deliverable, doc)
    if (doc.approver) {
      const refreshed = (await deliverablesOf(project)).find(item => item.deliverable_key === doc.deliverable)
      await approve(sessionFor(doc.by), doc.approver, 'deliverable', refreshed.id, doc.request, doc.pending ? 'pending' : 'approved')
    }
  }
  const baselineId = creds.fm?.baselineId || (await one(serviceClient.from('economic_baselines').select('id').eq('project_id', project).eq('status', 'approved'), 'línea base'))?.id
  const award = FACILITY.awardedPrices
  if (baselineId) {
    const lines = must(await serviceClient.from('baseline_lines').select('id, seq, awarded_price').eq('baseline_id', baselineId), 'líneas')
    for (const [seq, price] of Object.entries(award)) {
      const line = lines.find(item => item.seq === Number(seq))
      if (line && line.awarded_price == null) must(await buyer4.from('baseline_lines').update({ awarded_price: price, supplier_name: FACILITY.winner }).eq('id', line.id), 'precio adjudicado')
    }
  }
  log('RFP Santiago vinculado al proyecto, con matriz, recomendación, acta y plan de implementación, y precios adjudicados en la línea base.')

  // ---- Recorridos guiados (solo lectura) ----------------------------------------------------------------------------------------
  const event = await one(serviceClient.from('offer_events').select('id').eq('licitacion_id', santiago.id), 'sala Santiago')
  const upload = await one(serviceClient.from('si_uploads').select('id').eq('company_id', companyId).order('created_at').limit(1), 'carga')
  const ref = { project, plan: creds.planIds.fmaseo, category: categories.aseo, licitacion: santiago.id, event: event?.id, baseline: baselineId, successor: successor?.id, upload: upload?.id }
  for (const tour of FACILITY.tours(ref)) {
    const existing = await one(serviceClient.from('demo_tours').select('id').eq('company_id', companyId).eq('tour_key', tour.tour_key), 'recorrido')
    if (existing && !process.argv.includes('--tours')) continue
    if (existing) must(await serviceClient.from('demo_tours').update({ name: tour.name, description: tour.description, steps: tour.steps }).eq('id', existing.id), 'recorrido')
    else must(await serviceClient.from('demo_tours').insert({ company_id: companyId, ...tour }), 'recorrido')
  }
  log('Recorridos guiados listos: interno (10 pasos) y portal de proveedores.')
  creds.fm = { ...(creds.fm || {}), ...ref }
}
creds.fm = { ...(creds.fm || {}), projects, categories, contracts }
saveCredentials(creds)
console.log('\nListo.')
