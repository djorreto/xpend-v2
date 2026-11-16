// Siembra la demostración comercial: empresa FICTICIA, usuarios, proveedores, gasto histórico, categorías, equipos,
// plan anual comprometido, iniciativas con hitos y un ahorro manual ya validado y reconocido.
// Solo corre contra el Supabase local. Uso: npm run demo:seed   (reiniciar: npm run demo:seed -- --reset)
import { execFileSync } from 'node:child_process'
import {
  COMPANY_NAME, DEMO_DOMAIN, addDays, authAdmin, findUser, local, must, prng, randomPassword, saveCredentials, serviceClient, signedIn, today,
} from './common.mjs'

const RESET = process.argv.includes('--reset')
const year = new Date().getFullYear()
const t0 = today()
const log = (text) => console.log(`· ${text}`)

const PEOPLE = {
  admin: { email: `andrea.contreras@${DEMO_DOMAIN}`, name: 'Andrea Contreras', role: 'admin', title: 'Administradora' },
  manager: { email: `gonzalo.perez@${DEMO_DOMAIN}`, name: 'Gonzalo Pérez', role: 'manager', title: 'Gerente de Abastecimiento' },
  committee: { email: `carolina.vidal@${DEMO_DOMAIN}`, name: 'Carolina Vidal', role: 'manager', title: 'Gerente de Finanzas (comité)' },
  buyer1: { email: `valentina.rojas@${DEMO_DOMAIN}`, name: 'Valentina Rojas', role: 'analyst', title: 'Compradora' },
  buyer2: { email: `matias.soto@${DEMO_DOMAIN}`, name: 'Matías Soto', role: 'analyst', title: 'Comprador' },
  viewer: { email: `laura.mendoza@${DEMO_DOMAIN}`, name: 'Laura Mendoza', role: 'viewer', title: 'Auditoría (solo lectura)' },
}
const SUPPLIERS = [
  { key: 'alfa', id: 'demo-sup-norte', fantasy: 'Servicios Industriales Norte', legal: 'Servicios Industriales Norte SpA', rut: '76.410.220-1', email: `contacto.norte@${DEMO_DOMAIN}`, type: 'Mantenimiento industrial' },
  { key: 'beta', id: 'demo-sup-mantenpro', fantasy: 'MantenPro Chile', legal: 'MantenPro Chile Ltda.', rut: '77.512.330-4', email: `contacto.mantenpro@${DEMO_DOMAIN}`, type: 'Mantenimiento industrial' },
  { key: 'gamma', id: 'demo-sup-tecnomant', fantasy: 'TecnoMant Andes', legal: 'TecnoMant Andes S.A.', rut: '76.998.101-7', email: `contacto.tecnomant@${DEMO_DOMAIN}`, type: 'Mantenimiento industrial' },
]
const DIRECTORY = [
  { id: 'demo-sup-logistica', fantasy: 'TransAndes Logística', legal: 'TransAndes Logística SpA', rut: '76.220.145-8', type: 'Logística y transporte' },
  { id: 'demo-sup-cloud', fantasy: 'NubeSur Software', legal: 'NubeSur Software SpA', rut: '77.101.882-3', type: 'Tecnología y software' },
  { id: 'demo-sup-aseo', fantasy: 'Limpieza Total', legal: 'Limpieza Total Ltda.', rut: '76.554.001-6', type: 'Servicios generales' },
]
// Gasto histórico del año anterior por categoría (moneda propia, sin conversión).
const CATEGORIES = [
  { name: 'Mantenimiento industrial', currency: 'CLP', spend: 850_000_000, target: 68_000_000, owner: 'buyer1', backup: 'buyer2', team: 'Operaciones', strategy: 'Licitación competitiva', quarter: 'Q4', pct: 8, suppliers: ['Servicios Industriales Norte', 'MantenPro Chile', 'TecnoMant Andes', 'Taller Central'] },
  { name: 'Logística y transporte', currency: 'CLP', spend: 620_000_000, target: 49_600_000, owner: 'buyer2', backup: 'buyer1', team: 'Operaciones', strategy: 'Consolidar proveedores', quarter: 'Q1', pct: 8, suppliers: ['TransAndes Logística', 'Cargas del Sur', 'Fletes Rápidos'] },
  { name: 'Tecnología y software', currency: 'USD', spend: 400_000, target: 36_000, owner: 'buyer1', backup: 'buyer2', team: 'Corporativo', strategy: 'Renegociar licencias', quarter: 'Q2', pct: 9, suppliers: ['NubeSur Software', 'DataCore', 'Soporte TI Chile'] },
  { name: 'Servicios generales', currency: 'CLP', spend: 210_000_000, target: 16_800_000, owner: 'buyer2', backup: 'buyer1', team: 'Corporativo', strategy: 'Licitación competitiva', quarter: 'Q2', pct: 8, suppliers: ['Limpieza Total', 'Casino Andino', 'Seguridad Cordillera'] },
  { name: 'Insumos de seguridad', currency: 'CLP', spend: 150_000_000, target: 9_000_000, owner: 'buyer1', backup: 'buyer2', team: 'Operaciones', strategy: 'Acuerdo marco', quarter: 'Q3', pct: 6, suppliers: ['EPP Chile', 'Seguridad Total'] },
  { name: 'Energía', currency: 'CLP', spend: 300_000_000, target: 15_000_000, owner: null, backup: null, team: null, strategy: 'Licitación de suministro', quarter: 'Q4', pct: 5, suppliers: ['Energía Andes'] },
]

function resetDemo() {
  const sql = `
    begin;
    set local session_replication_role = replica;
    do $$
    declare c uuid; t record;
    begin
      select id into c from public.companies where name = '${COMPANY_NAME}';
      if c is null then return; end if;
      for t in select table_name from information_schema.columns where table_schema = 'public' and column_name = 'company_id'
               and table_name in (select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE') loop
        execute format('delete from public.%I where company_id = $1', t.table_name) using c;
      end loop;
      delete from storage.objects where name like c::text || '/%';
      delete from public.companies where id = c;
    end $$;
    commit;`
  execFileSync('docker', ['exec', '-i', 'supabase_db_xpend-v3-local', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'], { input: sql, stdio: ['pipe', 'inherit', 'inherit'] })
  // Los usuarios se eliminan por la API de Auth para que se limpien identidades y sesiones.
  return true
}

async function removeDemoUsers() {
  for (let page = 1; page <= 5; page += 1) {
    const body = await authAdmin(`users?per_page=200&page=${page}`)
    for (const user of body.users || []) if (user.email?.endsWith(`@${DEMO_DOMAIN}`)) await authAdmin(`users/${user.id}`, { method: 'DELETE' })
    if (!body.users || body.users.length < 200) break
  }
  log('Demostración anterior eliminada (solo la empresa ficticia y sus usuarios).')
}

async function main() {
  if (RESET) {
    resetDemo()
    await removeDemoUsers()
  }

  // ---- Empresa y usuarios ------------------------------------------------------------------------------------------------
  let company = (await serviceClient.from('companies').select('id').eq('name', COMPANY_NAME).maybeSingle()).data
  if (company) {
    console.log('La demostración ya existe. Para reconstruirla desde cero: npm run demo:seed -- --reset')
    return
  }
  company = must(await serviceClient.from('companies').insert({ name: COMPANY_NAME, tax_id: '76.000.123-4', industry: 'Manufactura', description: 'Empresa ficticia para la demostración comercial de XPEND.' }).select('id').single(), 'empresa')
  const companyId = company.id
  log(`Empresa ficticia creada: ${COMPANY_NAME}`)

  const credentials = { company: COMPANY_NAME, companyId, users: {} }
  const ids = {}
  const upsertUser = async (key, person, extra = {}) => {
    const password = randomPassword()
    let user = await findUser(person.email)
    if (user) await authAdmin(`users/${user.id}`, { method: 'PUT', body: JSON.stringify({ password }) })
    else user = await authAdmin('users', { method: 'POST', body: JSON.stringify({ email: person.email, password, email_confirm: true, user_metadata: { full_name: person.name } }) })
    must(await serviceClient.from('profiles').upsert({ id: user.id, email: person.email, full_name: person.name, role: person.role, company_id: companyId, must_change_password: false, ...extra }, { onConflict: 'id' }), `perfil ${key}`)
    ids[key] = user.id
    credentials.users[key] = { email: person.email, password, name: person.name, role: person.role, title: person.title }
  }
  for (const [key, person] of Object.entries(PEOPLE)) await upsertUser(key, person)

  // Proveedores con acceso al portal (oferentes) y proveedores solo en el directorio.
  for (const supplier of SUPPLIERS) {
    must(await serviceClient.from('suppliers').insert({ id: supplier.id, company_id: companyId, fantasy_name: supplier.fantasy, legal_name: supplier.legal, rut: supplier.rut, service_type: supplier.type, contact_email: supplier.email, is_active: true }), `proveedor ${supplier.key}`)
    await upsertUser(`supplier_${supplier.key}`, { email: supplier.email, name: supplier.fantasy, role: 'supplier', title: 'Proveedor oferente' }, { supplier_id: supplier.id })
  }
  for (const supplier of DIRECTORY) {
    must(await serviceClient.from('suppliers').insert({ id: supplier.id, company_id: companyId, fantasy_name: supplier.fantasy, legal_name: supplier.legal, rut: supplier.rut, service_type: supplier.type, is_active: true }), `directorio ${supplier.id}`)
  }
  log(`${Object.keys(PEOPLE).length} usuarios internos y ${SUPPLIERS.length} proveedores con acceso creados.`)

  const manager = await signedIn(PEOPLE.manager.email, credentials.users.manager.password)
  const buyer2 = await signedIn(PEOPLE.buyer2.email, credentials.users.buyer2.password)

  // ---- Gasto histórico y oportunidades (año anterior) ----------------------------------------------------------------------
  const upload = must(await serviceClient.from('si_uploads').insert({
    company_id: companyId, user_id: ids.manager, file_name: `gasto-${year - 1}-demo.xlsx`, file_size: 184_320, file_type: 'xlsx', status: 'completed', display_currency: null,
  }).select('id').single(), 'carga de gasto')
  const rand = prng(20260101)
  const lines = []
  for (const category of CATEGORIES) {
    const count = 14
    const weights = Array.from({ length: count }, () => 0.4 + rand())
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    let assigned = 0
    for (let index = 0; index < count; index += 1) {
      const last = index === count - 1
      const amount = last ? category.spend - assigned : Math.round((category.spend * weights[index]) / total)
      assigned += amount
      const month = (index % 12) + 1
      lines.push({
        upload_id: upload.id, company_id: companyId, line_number: lines.length + 1, description: `${category.name} · servicio ${index + 1}`,
        supplier_name: category.suppliers[index % category.suppliers.length], amount, amount_net: amount, currency: category.currency,
        purchase_date: `${year - 1}-${String(month).padStart(2, '0')}-${String(5 + (index % 20)).padStart(2, '0')}`, category: category.name,
        needs_review: false, ai_confidence: 0.96,
      })
    }
  }
  for (let from = 0; from < lines.length; from += 50) must(await serviceClient.from('si_spend_lines').insert(lines.slice(from, from + 50)), 'líneas de gasto')
  for (const category of CATEGORIES) {
    must(await serviceClient.from('si_categories').insert({ company_id: companyId, name: category.name, spend_total: category.spend, supplier_count: category.suppliers.length }), 'categoría de gasto')
  }
  const siPlan = must(await serviceClient.from('si_procurement_plans').insert({
    company_id: companyId, upload_id: upload.id, name: `Oportunidades ${year}`, plan_year: year, status: 'approved', total_spend: CATEGORIES.reduce((sum, item) => sum + item.spend, 0) /* mezcla monedas: solo referencia interna */,
    category_count: CATEGORIES.length, supplier_count: 15, created_by: ids.manager,
  }).select('id').single(), 'plan de oportunidades')
  log(`Gasto histórico ${year - 1}: ${lines.length} líneas en ${CATEGORIES.length} categorías.`)

  // ---- Categorías, equipos y asignaciones (como gerente) --------------------------------------------------------------------
  const categoryIds = {}
  for (const category of CATEGORIES) {
    const row = must(await manager.from('procurement_categories').insert({ company_id: companyId, name: category.name, source: 'taxonomia_spend', taxonomy_ref: category.name, created_by: ids.manager }).select('id').single(), `categoría ${category.name}`)
    categoryIds[category.name] = row.id
  }
  const teams = {}
  for (const [name, lead] of [['Operaciones', 'buyer1'], ['Corporativo', 'buyer2']]) {
    const team = must(await manager.from('procurement_teams').insert({ company_id: companyId, name: `Equipo ${name}`, description: `Compras de ${name.toLowerCase()}`, lead_user_id: ids[lead] }).select('id').single(), `equipo ${name}`)
    teams[name] = team.id
    for (const [index, member] of ['buyer1', 'buyer2'].entries()) {
      if (name === 'Operaciones' || index === 1) must(await manager.from('procurement_team_members').insert({ company_id: companyId, team_id: team.id, user_id: ids[member], member_role: member === lead ? 'lead' : 'member' }), 'miembro de equipo')
    }
  }
  const opportunityItems = {}
  for (const [index, category] of CATEGORIES.entries()) {
    const item = must(await serviceClient.from('si_plan_items').insert({
      plan_id: siPlan.id, company_id: companyId, category: category.name, total_spend: category.spend, supplier_count: category.suppliers.length, main_supplier: category.suppliers[0],
      supplier_concentration: 0.4, strategy: category.strategy, recommended_quarter: category.quarter, projected_savings_percentage: category.pct,
      projected_savings_amount: Math.round((category.spend * category.pct) / 100), ai_reasoning: `Gasto concentrado en ${category.suppliers[0]}; una licitación competitiva permite negociar precio y condiciones.`,
      impact_score: 8 - index * 0.5, risk_score: 4 + index * 0.3, kraljic_quadrant: index % 2 ? 'leverage' : 'strategic', status: 'approved', priority: index + 1, category_id: categoryIds[category.name],
    }).select('id').single(), 'oportunidad')
    opportunityItems[category.name] = item.id
    if (category.owner) {
      must(await manager.from('category_assignments').insert({ company_id: companyId, category_id: categoryIds[category.name], manager_user_id: ids[category.owner], backup_user_id: ids[category.backup], team_id: teams[category.team] }), `asignación ${category.name}`)
    }
  }
  log('Categorías, equipos y Category Managers asignados (Energía queda sin responsable a propósito).')

  // ---- Plan anual (borrador → líneas → iniciativas → hitos → comprometido) -----------------------------------------------------
  const plan = must(await manager.from('annual_plans').insert({ company_id: companyId, plan_year: year, name: `Plan anual ${year}`, created_by: ids.manager }).select('id').single(), 'plan anual')
  for (const category of CATEGORIES) {
    must(await manager.rpc('upsert_annual_line', { p_plan: plan.id, p_category: categoryIds[category.name], p_currency: category.currency, p_spend: category.spend, p_target: category.target, p_owner: category.owner ? ids[category.owner] : null, p_priority: category.name === 'Mantenimiento industrial' ? 1 : 2, p_reason: 'Carga inicial del plan' }), `línea ${category.name}`)
  }

  const INITIATIVES = [
    { key: 'mant', title: 'Mantención de equipos críticos', category: 'Mantenimiento industrial', quarter: 'Q4', spend: 200_000, currency: 'USD', pct: 10, responsible: 'buyer1', backup: 'buyer2', team: 'Operaciones', status: 'in_progress',
      dates: [0, 2, 5, 12, 19, 26, 40], actual: 1 },
    { key: 'transporte', title: 'Licitación de transporte de carga', category: 'Logística y transporte', quarter: 'Q3', spend: 620_000_000, currency: 'CLP', pct: 8, responsible: 'buyer2', backup: 'buyer1', team: 'Operaciones', status: 'in_progress',
      dates: [-70, -50, -20, 6, 14, 24, 45], actual: 2, reschedule: { index: 2, from: -35, cause: 'aprobador', reason: 'El comité postergó la aprobación del presupuesto' } },
    { key: 'licencias', title: 'Renovación de licencias de software', category: 'Tecnología y software', quarter: 'Q4', spend: 400_000, currency: 'USD', pct: 9, responsible: 'buyer1', backup: 'buyer2', team: 'Corporativo', status: 'in_progress',
      dates: [-25, 3, 10, 18, 25, 32, 50], actual: 1, block: { index: 1, cause: 'aprobador', note: 'Espera la aprobación del presupuesto de TI' } },
    { key: 'aseo', title: 'Contrato de aseo y casinos', category: 'Servicios generales', quarter: 'Q2', spend: 210_000_000, currency: 'CLP', pct: 8, responsible: 'buyer2', backup: 'buyer1', team: 'Corporativo', status: 'in_progress',
      dates: [-200, -180, -160, -140, -120, -110, -100], actual: 7 },
    { key: 'seguridad', title: 'Acuerdo marco de insumos de seguridad', category: 'Insumos de seguridad', quarter: 'Q1', spend: 150_000_000, currency: 'CLP', pct: 6, responsible: 'buyer1', backup: 'buyer2', team: 'Operaciones', status: 'planned', dates: null },
    { key: 'energia', title: 'Suministro eléctrico', category: 'Energía', quarter: 'Q4', spend: 300_000_000, currency: 'CLP', pct: 5, responsible: null, backup: null, team: null, status: 'planned', dates: null },
  ]
  const planIds = {}
  const milestoneKinds = ['inicio', 'preparacion_rfx', 'invitacion', 'recepcion', 'evaluacion', 'comite_adjudicacion', 'formalizacion']
  for (const item of INITIATIVES) {
    const row = must(await manager.from('sourcing_plans').insert({
      company_id: companyId, plan_year: year, quarter: item.quarter, initiative_type: 'licitacion', title: item.title, description: `${item.title}. Iniciativa ficticia de la demostración.`, category: item.category,
      category_id: categoryIds[item.category], si_plan_item_id: opportunityItems[item.category], estimated_spend: item.spend, currency: item.currency, projected_savings_percentage: item.pct,
      projected_savings_amount: Math.round((item.spend * item.pct) / 100), status: item.status, responsible_user_id: item.responsible ? ids[item.responsible] : null,
      backup_user_id: item.backup ? ids[item.backup] : null, team_id: item.team ? teams[item.team] : null, created_by: ids.manager,
    }).select('id').single(), `iniciativa ${item.key}`)
    planIds[item.key] = row.id
    if (!item.dates) continue
    must(await manager.rpc('ensure_milestones', { p_plan: row.id }), `hitos ${item.key}`)
    const milestones = must(await manager.from('initiative_milestones').select('id, kind').eq('sourcing_plan_id', row.id), 'hitos')
    for (const [index, kind] of milestoneKinds.entries()) {
      const milestone = milestones.find(entry => entry.kind === kind)
      const date = addDays(t0, item.reschedule && item.reschedule.index === index ? item.reschedule.from : item.dates[index])
      must(await manager.from('initiative_milestones').update({ committed_date: date }).eq('id', milestone.id), `fecha ${item.key}/${kind}`)
    }
    item._milestones = milestones
  }
  must(await manager.rpc('commit_annual_plan', { p_plan: plan.id }), 'comprometer plan')
  log(`Plan anual ${year} comprometido con ${CATEGORIES.length} categorías y ${INITIATIVES.filter(item => item.dates).length} iniciativas con hitos.`)

  // Desvíos posteriores al compromiso: reprogramación con causa, bloqueo y hitos ya cumplidos.
  for (const item of INITIATIVES.filter(entry => entry.dates)) {
    const byKind = (kind) => item._milestones.find(entry => entry.kind === kind)
    if (item.reschedule) {
      const target = byKind(milestoneKinds[item.reschedule.index])
      must(await manager.rpc('reschedule_milestones', { p_changes: [{ id: target.id, date: addDays(t0, item.dates[item.reschedule.index]) }], p_cause: item.reschedule.cause, p_reason: item.reschedule.reason }), `reprogramación ${item.key}`)
    }
    for (let index = 0; index < (item.actual || 0); index += 1) {
      const committed = addDays(t0, item.dates[index])
      const actual = committed > t0 ? t0 : committed
      must(await manager.rpc('record_milestone_actual', { p_milestone: byKind(milestoneKinds[index]).id, p_actual: actual, p_note: 'Cumplido según lo planificado' }), `real ${item.key}/${index}`)
    }
    if (item.block) {
      must(await manager.rpc('set_milestone_block', { p_milestone: byKind(milestoneKinds[item.block.index]).id, p_blocked: true, p_cause: item.block.cause, p_note: item.block.note }), `bloqueo ${item.key}`)
    }
  }

  // ---- Un ahorro de comité ya cerrado en el año: manual, validado y con reconocimientos mensuales -----------------------------
  const aseoPlan = planIds.aseo
  const licitacionId = 'LIC-DEMO-ASEO'
  must(await serviceClient.from('licitaciones').insert({
    id: licitacionId, company_id: companyId, name: 'Contrato de aseo y casinos', description: 'Licitación del año, cerrada antes de usar el control de ahorros.', status: 'planned', type: 'RFP', category: 'recurring_service',
    baseline_currency: 'CLP', baseline_amount: 120_000_000, baseline_source: 'historical', awarded_amount: 108_000_000, award_date: addDays(t0, -170), created_by: ids.manager,
  }), 'licitación histórica')
  must(await serviceClient.from('sourcing_plan_licitaciones').insert({ plan_id: aseoPlan, licitacion_id: licitacionId }), 'enlace iniciativa-licitación')
  const startDate = new Date(`${t0}T12:00:00Z`)
  startDate.setUTCMonth(startDate.getUTCMonth() - 5, 1)
  const start = startDate.toISOString().slice(0, 10)
  const end = addDays(start, 364)
  const declared = must(await buyer2.rpc('declare_savings', { p_award: null, p_licitacion: licitacionId, p_plan: null, p_declared: 12_000_000, p_nature: 'reduccion_precio', p_recurrence: 'recurrente', p_start: start, p_end: end, p_note: 'Contrato anual con rebaja del 10% sobre la base histórica.' }), 'declarar ahorro')
  const validationId = typeof declared === 'string' ? declared : declared?.id || declared
  must(await manager.rpc('validate_savings', { p_validation: validationId, p_validated: 11_400_000, p_method: 'Comparación de las facturas del año anterior con las del nuevo contrato, mismo alcance y frecuencia', p_note: 'Se descuentan 600.000 por un servicio extra que se agregó al alcance.' }), 'validar ahorro')
  const companyFolder = `${companyId}/ahorros/${validationId}`
  const evidencePath = `${companyFolder}/${Date.now()}-evidencia.txt`
  const uploaded = await serviceClient.storage.from('documents').upload(evidencePath, Buffer.from('Evidencia ficticia: comparación de facturas aseo y casinos (demostración).'), { contentType: 'text/plain', upsert: false })
  if (uploaded.error) throw new Error(`evidencia: ${uploaded.error.message}`)
  const evidence = must(await manager.rpc('add_savings_evidence', { p_validation: validationId, p_path: evidencePath, p_file_name: 'comparacion-facturas-aseo.txt', p_mime: 'text/plain', p_size: 72, p_description: 'Comparación de facturas' }), 'evidencia')
  const evidenceId = typeof evidence === 'string' ? evidence : evidence?.id || evidence
  for (let back = 4; back >= 1; back -= 1) {
    const period = new Date(`${t0}T12:00:00Z`)
    period.setUTCMonth(period.getUTCMonth() - back, 1)
    must(await manager.rpc('recognize_savings', { p_validation: validationId, p_period: period.toISOString().slice(0, 7), p_amount: 950_000, p_evidence: evidenceId, p_note: 'Reconocido con la factura del mes' }), `reconocimiento -${back}`)
  }
  log('Ahorro manual validado con evidencia y 4 meses reconocidos (aseo y casinos).')

  saveCredentials({ ...credentials, ids, planIds, categoryIds, year })
  console.log('\nListo. Credenciales guardadas en .demo/credenciales-demo.local.json (fuera de Git).')
  console.log('Siguiente paso: npm run demo:flow  (recorre bases, licitación, ofertas, evaluación, adjudicación, contrato y ahorro por la interfaz).')
}

main().catch(error => {
  console.error(`\nLa siembra falló: ${error.message}`)
  console.error('Para reintentar desde cero: npm run demo:seed -- --reset')
  process.exitCode = 1
})
