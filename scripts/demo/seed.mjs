// Siembra «XPEND Company S.A. (DEMO)»: empresa ficticia con historial de gasto, categorías, equipo comprador, plan anual 2026 comprometido,
// borrador 2027, iniciativas con hitos, licitaciones en distintos estados, contratos y ahorros validados con evidencia.
//
// Reglas de seguridad:
//  * Solo escribe en la empresa demo que crea (settings.demo = true). Nunca modifica ni borra datos de otras empresas.
//  * Es idempotente: si la empresa demo ya existe, no hace nada (en producción jamás se reinicia).
//  * Los hitos de negocio (adjudicación, comité, contrato, ahorro) pasan por las mismas funciones y reglas que usa la aplicación.
// Uso local: npm run demo:seed [-- --reset]      Producción: ver docs/demo/RECONSTRUIR-DEMO.md
import { execFileSync } from 'node:child_process'
import {
  COMPANY_NAME, DEMO_DOMAIN, DEMO_KEY, LEGACY_DEMO_NAMES, TARGET, addDays, authAdmin, findUser, must, prng, randomPassword, saveCredentials, serviceClient, signedIn, today,
} from './common.mjs'
import { CATEGORIES, FLOWS, INITIATIVES, PEOPLE, PORTAL_SUPPLIERS, TEAMS, spendLines } from './dataset.mjs'

const RESET = process.argv.includes('--reset')
const now = new Date()
const year = now.getFullYear()
const nowMonth = now.getUTCMonth() // meses completos del año en curso
const t0 = today()
const log = (text) => console.log(`· ${text}`)
const mail = (local) => `${local}@${DEMO_DOMAIN}`
const QA_HOME = 'QA Local Home S.A.'

function resetDemo() {
  if (TARGET !== 'local') throw new Error('El reinicio solo existe en el entorno local.')
  const names = [COMPANY_NAME, QA_HOME, ...LEGACY_DEMO_NAMES].map(name => `'${name.replace(/'/g, "''")}'`).join(', ')
  const sql = `
    begin;
    set local session_replication_role = replica;
    do $$
    declare c uuid; t record; f record; ids uuid[];
    begin
      select array_agg(id) into ids from public.companies where name in (${names});
      if ids is null then return; end if;
      foreach c in array ids loop
        for t in select table_name from information_schema.columns where table_schema = 'public' and column_name = 'company_id'
                 and table_name in (select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE') loop
          execute format('delete from public.%I where company_id = $1', t.table_name) using c;
        end loop;
        delete from storage.objects where name like c::text || '/%';
        delete from public.companies where id = c;
      end loop;
      for pass in 1..4 loop
        for f in
          select c2.conrelid::regclass as child, c2.confrelid::regclass as parent,
            (select string_agg(format('c.%I = p.%I', a.attname, b.attname), ' and ' order by k.ord)
               from unnest(c2.conkey, c2.confkey) with ordinality k(ck, pk, ord)
               join pg_attribute a on a.attrelid = c2.conrelid and a.attnum = k.ck
               join pg_attribute b on b.attrelid = c2.confrelid and b.attnum = k.pk) as cond,
            (select string_agg(format('c.%I is not null', a.attname), ' and ')
               from unnest(c2.conkey) ck join pg_attribute a on a.attrelid = c2.conrelid and a.attnum = ck) as nn
          from pg_constraint c2
          where c2.contype = 'f' and c2.confdeltype = 'c' and c2.connamespace = 'public'::regnamespace
            and c2.confrelid in (select oid from pg_class where relnamespace = 'public'::regnamespace)
        loop
          execute format('delete from %s c where %s and not exists (select 1 from %s p where %s)', f.child, f.nn, f.parent, f.cond);
        end loop;
      end loop;
    end $$;
    commit;`
  execFileSync('docker', ['exec', '-i', 'supabase_db_xpend-v3-local', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'], { input: sql, stdio: ['pipe', 'inherit', 'inherit'] })
}

async function removeDemoUsers() {
  for (let page = 1; page <= 5; page += 1) {
    const body = await authAdmin(`users?per_page=200&page=${page}`)
    for (const user of body.users || []) if (user.email?.endsWith(`@${DEMO_DOMAIN}`)) await authAdmin(`users/${user.id}`, { method: 'DELETE' })
    if (!body.users || body.users.length < 200) break
  }
  log('Demostración anterior eliminada (solo las empresas ficticias y los usuarios @' + DEMO_DOMAIN + ').')
}

const asId = (value) => (typeof value === 'string' ? value : value?.id || value)
const monthStart = (back) => {
  const date = new Date(`${t0}T12:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() - back, 1)
  return date.toISOString().slice(0, 10)
}

async function main() {
  if (RESET) {
    resetDemo()
    await removeDemoUsers()
  }

  // ---- Verificaciones previas: aislamiento y no sobrescritura --------------------------------------------------------------
  const existing = must(await serviceClient.from('companies').select('id, name, settings').or(`name.eq.${COMPANY_NAME},settings->>demo_key.eq.${DEMO_KEY}`), 'consulta de empresa demo')
  if (existing.length) {
    console.log('La empresa demo ya existe: no se modifica nada. (Reconstrucción local: npm run demo:seed -- --reset)')
    return
  }
  for (const person of Object.values(PEOPLE)) {
    if (await findUser(mail(person.mail))) throw new Error(`El usuario ${mail(person.mail)} ya existe fuera de la empresa demo; se detiene sin modificar nada.`)
  }
  log(`Destino: ${TARGET === 'prod' ? 'PRODUCCIÓN (solo la empresa demo nueva)' : 'Supabase local'}.`)

  const company = must(await serviceClient.from('companies').insert({
    name: COMPANY_NAME, tax_id: '99.999.999-K', industry: 'Manufactura y servicios industriales',
    description: 'EMPRESA FICTICIA DE DEMOSTRACIÓN. Todos los datos, personas, proveedores y montos son inventados.',
    settings: { demo: true, demo_key: DEMO_KEY, demo_notice: 'Datos ficticios para demostración comercial. No contiene información real.', external_ai: { enabled: false } },
  }).select('id').single(), 'empresa')
  const companyId = company.id
  log(`Empresa demo creada: ${COMPANY_NAME}`)

  const credentials = { company: COMPANY_NAME, companyId, target: TARGET, users: {} }
  const ids = {}
  const upsertUser = async (key, person, address, extra = {}) => {
    const password = randomPassword()
    const user = await authAdmin('users', { method: 'POST', body: JSON.stringify({ email: address, password, email_confirm: true, user_metadata: { full_name: person.name, demo: true } }) })
    must(await serviceClient.from('profiles').upsert({ id: user.id, email: address, full_name: person.name, role: person.role, company_id: companyId, must_change_password: false, ...extra }, { onConflict: 'id' }), `perfil ${key}`)
    ids[key] = user.id
    credentials.users[key] = { email: address, password, name: person.name, role: person.role, title: person.title }
  }
  for (const [key, person] of Object.entries(PEOPLE)) await upsertUser(key, person, mail(person.mail))

  // ---- Proveedores: oferentes con portal y proveedores del directorio -------------------------------------------------------
  for (const supplier of PORTAL_SUPPLIERS) {
    const address = mail(`contacto.${supplier.key}`)
    must(await serviceClient.from('suppliers').insert({ id: supplier.id, company_id: companyId, fantasy_name: supplier.fantasy, legal_name: supplier.legal, rut: supplier.rut, service_type: supplier.type, contact_email: address, is_active: true }), `proveedor ${supplier.key}`)
    await upsertUser(`supplier_${supplier.key}`, { name: supplier.fantasy, role: 'supplier', title: 'Proveedor oferente (portal)' }, address, { supplier_id: supplier.id })
  }
  const directory = new Map()
  for (const category of CATEGORIES) for (const stream of category.streams) for (const [name] of stream.suppliers) {
    if (PORTAL_SUPPLIERS.some(item => item.fantasy === name) || directory.has(name)) continue
    directory.set(name, category.name)
  }
  let rutSeed = 76_100_000
  for (const [name, categoryName] of directory) {
    rutSeed += 7_919
    const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    must(await serviceClient.from('suppliers').insert({ id: `xc-dir-${slug}`, company_id: companyId, fantasy_name: name, legal_name: `${name} SpA`, rut: `${String(rutSeed).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-K`, service_type: categoryName, is_active: true }), `directorio ${name}`)
  }
  log(`${Object.keys(PEOPLE).length} usuarios internos, ${PORTAL_SUPPLIERS.length} proveedores con portal y ${directory.size} proveedores del directorio.`)

  const sessions = {}
  for (const key of ['manager', 'admin', 'buyer1', 'buyer2', 'buyer3', 'buyer4']) sessions[key] = await signedIn(credentials.users[key].email, credentials.users[key].password)
  const { manager, admin } = sessions

  // ---- Gasto histórico (año anterior completo + año en curso) con proveedor, moneda y estacionalidad ---------------------------
  const upload = must(await serviceClient.from('si_uploads').insert({
    company_id: companyId, user_id: ids.manager, file_name: `gasto-${year - 1}-${year}-demo.xlsx`, file_size: 2_184_320, file_type: 'xlsx', status: 'completed', display_currency: null, has_dates: true,
  }).select('id').single(), 'carga de gasto')
  const rand = prng(20261116)
  const lines = []
  const totals = {}
  for (const category of CATEGORIES) {
    for (const row of spendLines(category, rand, year, nowMonth)) {
      lines.push({
        upload_id: upload.id, company_id: companyId, line_number: lines.length + 1, description: `${row.subcategory} · ${row.supplier}`, supplier_name: row.supplier, amount: row.amount, amount_net: row.amount,
        currency: row.currency, purchase_date: `${row.year}-${String(row.month).padStart(2, '0')}-${String(row.day).padStart(2, '0')}`, category: row.category, subcategory: row.subcategory,
        needs_review: false, ai_confidence: 0.97, ai_justification: 'Dato ficticio de demostración',
      })
      if (row.year === year - 1) {
        const bucket = (totals[`${category.key}|${row.currency}`] ||= { category, currency: row.currency, total: 0, bySupplier: {} })
        bucket.total += row.amount
        bucket.bySupplier[row.supplier] = (bucket.bySupplier[row.supplier] || 0) + row.amount
      }
    }
  }
  for (let from = 0; from < lines.length; from += 200) must(await serviceClient.from('si_spend_lines').insert(lines.slice(from, from + 200)), 'líneas de gasto')
  log(`Gasto histórico ${year - 1}–${year}: ${lines.length} líneas, ${directory.size + PORTAL_SUPPLIERS.length} proveedores, CLP y USD por separado.`)

  // ---- Categorías, equipos y asignaciones -----------------------------------------------------------------------------------
  const categoryIds = {}
  for (const category of CATEGORIES) {
    categoryIds[category.key] = must(await manager.from('procurement_categories').insert({ company_id: companyId, name: category.name, source: 'taxonomia_spend', taxonomy_ref: category.ref, created_by: ids.manager }).select('id').single(), `categoría ${category.key}`).id
  }
  const teams = {}
  for (const team of TEAMS) {
    teams[team.key] = must(await manager.from('procurement_teams').insert({ company_id: companyId, name: team.name, description: team.description, lead_user_id: ids[team.lead] }).select('id').single(), `equipo ${team.key}`).id
    for (const member of team.members) must(await manager.from('procurement_team_members').insert({ company_id: companyId, team_id: teams[team.key], user_id: ids[member], member_role: member === team.lead ? 'lead' : 'member' }), 'miembro de equipo')
  }
  for (const category of CATEGORIES) {
    must(await manager.from('category_assignments').insert({ company_id: companyId, category_id: categoryIds[category.key], manager_user_id: ids[category.owner], backup_user_id: ids[category.backup], team_id: teams[category.team] }), `asignación ${category.key}`)
  }

  // ---- Oportunidades detectadas desde el gasto (plan de oportunidades) --------------------------------------------------------
  const strategies = { mant: 'Licitación competitiva', tec: 'Renegociar licencias y consolidar', log: 'Consolidar proveedores', mat: 'Acuerdo marco', svc: 'Licitación competitiva', eq: 'Compra por volumen' }
  const siPlan = must(await serviceClient.from('si_procurement_plans').insert({
    company_id: companyId, upload_id: upload.id, name: `Oportunidades ${year}`, plan_year: year, status: 'approved', total_spend: Object.values(totals).filter(item => item.currency === 'CLP').reduce((sum, item) => sum + item.total, 0),
    category_count: CATEGORIES.length, supplier_count: directory.size + PORTAL_SUPPLIERS.length, created_by: ids.manager, display_currency: 'CLP',
  }).select('id').single(), 'plan de oportunidades')
  const opportunityItems = {}
  let priority = 0
  for (const bucket of Object.values(totals)) {
    const category = bucket.category
    const ranked = Object.entries(bucket.bySupplier).sort((a, b) => b[1] - a[1])
    const pct = { mant: 8, tec: 9, log: 8, mat: 7, svc: 8, eq: 8 }[category.key]
    priority += 1
    const item = must(await serviceClient.from('si_plan_items').insert({
      plan_id: siPlan.id, company_id: companyId, category: category.name, total_spend: bucket.total, supplier_count: ranked.length, main_supplier: ranked[0][0],
      supplier_concentration: Math.round((ranked[0][1] / bucket.total) * 100) / 100, strategy: strategies[category.key], recommended_quarter: 'Q1',
      projected_savings_percentage: pct, projected_savings_amount: Math.round((bucket.total * pct) / 100),
      ai_reasoning: `El gasto en ${bucket.currency} se concentra ${Math.round((ranked[0][1] / bucket.total) * 100)}% en ${ranked[0][0]}; una negociación o licitación competitiva permite mejorar precio y condiciones. Dato ficticio de demostración.`,
      impact_score: Math.max(4, 9 - priority * 0.4), risk_score: 3 + (priority % 4), kraljic_quadrant: priority % 2 ? 'leverage' : 'strategic', status: 'approved', priority, category_id: categoryIds[category.key],
    }).select('id').single(), 'oportunidad')
    opportunityItems[`${category.key}|${bucket.currency}`] = item.id
  }
  for (const category of CATEGORIES) {
    const own = Object.values(totals).filter(item => item.category.key === category.key)
    const main = own.find(item => item.currency === 'CLP') || own[0]
    must(await serviceClient.from('si_categories').insert({ company_id: companyId, name: category.name, spend_total: main.total, supplier_count: Object.keys(main.bySupplier).length, description: `Gasto en ${main.currency} del año anterior (demostración)` }), 'categoría de gasto')
  }
  log('Oportunidades desde el gasto creadas por categoría y moneda.')

  // ---- Planes anuales: 2026 (comprometido) y borrador 2027 --------------------------------------------------------------------
  const plans = {}
  for (const planYear of [year, year + 1]) {
    plans[planYear] = must(await manager.from('annual_plans').insert({ company_id: companyId, plan_year: planYear, name: `Plan anual ${planYear}${planYear > year ? ' (preliminar)' : ''}`, created_by: ids.manager }).select('id').single(), `plan ${planYear}`).id
  }
  const yearOf = (item) => (item.year ? year + (item.year - 2026) : year)
  for (const planYear of [year, year + 1]) {
    const items = INITIATIVES.filter(item => yearOf(item) === planYear)
    const groups = new Map()
    for (const item of items) {
      const key = `${item.cat}|${item.currency}`
      groups.set(key, { cat: item.cat, currency: item.currency, target: (groups.get(key)?.target || 0) + Math.round((item.spend * item.pct) / 100) })
    }
    let order = 0
    for (const group of groups.values()) {
      const category = CATEGORIES.find(entry => entry.key === group.cat)
      const base = totals[`${group.cat}|${group.currency}`]?.total || 0
      const spend = planYear === year ? base : Math.round(base * 1.05)
      order += 1
      must(await manager.rpc('upsert_annual_line', { p_plan: plans[planYear], p_category: categoryIds[group.cat], p_currency: group.currency, p_spend: spend, p_target: group.target, p_owner: ids[category.owner], p_priority: group.cat === 'mant' ? 1 : Math.min(order + 1, 3), p_reason: 'Carga inicial del plan (demostración)' }), `línea ${planYear}/${group.cat}/${group.currency}`)
    }
  }

  const planIds = {}
  const milestoneKinds = ['inicio', 'preparacion_rfx', 'invitacion', 'recepcion', 'evaluacion', 'comite_adjudicacion', 'formalizacion']
  for (const item of INITIATIVES) {
    const row = must(await manager.from('sourcing_plans').insert({
      company_id: companyId, plan_year: yearOf(item), quarter: item.quarter, initiative_type: 'licitacion', title: item.title, description: `${item.title}. Iniciativa ficticia de la demostración (DEMO).`,
      category: CATEGORIES.find(entry => entry.key === item.cat).name, category_id: categoryIds[item.cat], si_plan_item_id: opportunityItems[`${item.cat}|${item.currency}`] || null,
      estimated_spend: item.spend, currency: item.currency, projected_savings_percentage: item.pct, projected_savings_amount: Math.round((item.spend * item.pct) / 100), status: item.status,
      responsible_user_id: ids[item.owner], backup_user_id: ids[item.backup], team_id: teams[item.team], created_by: ids.manager,
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
  must(await manager.rpc('commit_annual_plan', { p_plan: plans[year] }), 'comprometer plan')
  log(`Plan anual ${year} comprometido (${INITIATIVES.filter(item => yearOf(item) === year).length} iniciativas) y borrador ${year + 1} con ${INITIATIVES.filter(item => yearOf(item) > year).length} iniciativas.`)

  // Desvíos posteriores al compromiso: reprogramación con causa, hitos reales y bloqueos.
  for (const item of INITIATIVES.filter(entry => entry.dates && yearOf(entry) === year)) {
    const byKind = (kind) => item._milestones.find(entry => entry.kind === kind)
    if (item.reschedule) {
      must(await manager.rpc('reschedule_milestones', { p_changes: [{ id: byKind(milestoneKinds[item.reschedule.index]).id, date: addDays(t0, item.dates[item.reschedule.index]) }], p_cause: item.reschedule.cause, p_reason: item.reschedule.reason }), `reprogramación ${item.key}`)
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

  // ---- Licitaciones en distintos estados (las de los casos A, B y T se crean por la interfaz con demo:flow) ----------------------
  const stageOrder = ['planned', 'bases_review', 'published', 'evaluation', 'awarded']
  let transitionsBlocked = 0
  for (const item of INITIATIVES.filter(entry => entry.lic)) {
    const lic = item.lic
    const owner = CATEGORIES.find(entry => entry.key === item.cat).owner
    const dateOf = (offset) => addDays(t0, offset)
    const basesBody = Buffer.from(`BASES FICTICIAS DE DEMOSTRACIÓN\nProceso ${lic.id}: ${item.title}\nEste documento no es real.\n`)
    const basesPath = `${companyId}/bases/${lic.id}/bases-${lic.id}.txt`
    const basesStored = await serviceClient.storage.from('documents').upload(basesPath, basesBody, { contentType: 'text/plain', upsert: false })
    if (basesStored.error) throw new Error(`bases de ${lic.id}: ${basesStored.error.message}`)
    must(await manager.from('licitaciones').insert({
      tender_document_path: basesPath, tender_document_name: `bases-${lic.id}.txt`, tender_document_size: basesBody.length,
      id: lic.id, company_id: companyId, name: item.title, description: `${item.title}. Proceso ficticio de demostración (DEMO).`, status: 'planned', type: 'RFP', category: 'recurring_service',
      baseline_currency: lic.noBaseline ? null : lic.currency, baseline_amount: lic.noBaseline ? null : lic.baseline, baseline_source: lic.noBaseline ? null : 'historical',
      awarded_amount: lic.awarded || null, savings_amount: lic.noBaseline || !lic.awarded ? null : lic.baseline - lic.awarded,
      award_date: lic.awarded ? dateOf((item.dates?.[5] ?? -200) + 6) : null, publication_date: item.dates ? dateOf(item.dates[2]) : null, proposal_closing_date: item.dates ? dateOf(item.dates[3]) : null,
      committee_date: item.dates ? dateOf(item.dates[5]) : null, responsible_user_id: ids[owner], created_by: ids.manager, category_label: CATEGORIES.find(entry => entry.key === item.cat).name,
    }), `licitación ${lic.id}`)
    must(await serviceClient.from('sourcing_plan_licitaciones').insert({ plan_id: planIds[item.key], licitacion_id: lic.id }), `enlace ${lic.id}`)
    for (const stage of stageOrder.slice(1, stageOrder.indexOf(lic.status) + 1)) {
      const moved = await manager.from('licitaciones').update({ status: stage }).eq('id', lic.id)
      if (moved.error) { transitionsBlocked += 1; console.log(`  (estado ${stage} de ${lic.id} no permitido por la regla de negocio: ${moved.error.message})`); break }
    }
  }
  log(`Licitaciones ficticias creadas${transitionsBlocked ? ` (${transitionsBlocked} transiciones se dejaron como las permite el negocio)` : ''}.`)

  // ---- Contratos existentes cargados por separado (no vienen de una licitación) ----------------------------------------------------
  const contractIds = {}
  for (const item of INITIATIVES.filter(entry => entry.contract)) {
    const contract = item.contract
    const supplierId = `xc-dir-${contract.supplierName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
    const supplier = (await serviceClient.from('suppliers').select('id').eq('id', supplierId).maybeSingle()).data
    const startsOn = addDays(t0, contract.startsOffset)
    const endsOn = addDays(startsOn, contract.months * 30 - 1)
    const row = must(await admin.from('contracts').insert({
      company_id: companyId, code: contract.code, name: contract.name, contract_type: 'Servicio', counterparty_name: contract.counterparty, supplier_id: supplier?.id || null, status: 'draft', origin: 'upload',
      owner_id: ids[item.owner], starts_on: startsOn, ends_on: endsOn, renewal: 'manual', notice_days: 60, currency: contract.currency, amount: contract.amount, periodicity: 'monthly',
      object_text: `${contract.name} (contrato ficticio de demostración).`, notes: 'DEMO · Contrato existente cargado sin pasar por una licitación.', created_by: ids.admin,
    }).select('id').single(), `contrato ${contract.code}`)
    contractIds[contract.code] = row.id
    const body = Buffer.from([
      'CONTRATO DE SERVICIOS (DOCUMENTO FICTICIO DE DEMOSTRACIÓN)',
      `Código ${contract.code}. Partes: ${COMPANY_NAME} y ${contract.counterparty}.`,
      `Cláusula primera, objeto. El proveedor presta el servicio de ${contract.name.toLowerCase()} en las instalaciones de la empresa.`,
      `Cláusula segunda, vigencia. El contrato rige desde el ${startsOn} hasta el ${endsOn}.`,
      `Cláusula tercera, precio y pago. El monto total es ${contract.amount} ${contract.currency}. La factura se paga a 30 días desde su recepción conforme.`,
      'Cláusula cuarta, renovación y preaviso. El contrato se renueva solo si ambas partes lo acuerdan por escrito. Cualquiera de las partes debe avisar con 60 días de anticipación si no desea renovar.',
      'Cláusula quinta, penalidades. Por incumplimiento de los niveles de servicio se aplica una multa de 2% del monto mensual por cada día de atraso, con un tope de 10%.',
      'Cláusula sexta, obligaciones del proveedor. El proveedor debe entregar un informe mensual y mantener al día sus cotizaciones previsionales.',
      '',
    ].join('\n'))
    const path = `${companyId}/contratos/${row.id}/${contract.code}.txt`
    const stored = await serviceClient.storage.from('documents').upload(path, body, { contentType: 'text/plain', upsert: false })
    if (stored.error) throw new Error(`documento de contrato: ${stored.error.message}`)
    must(await admin.from('contract_documents').insert({ contract_id: row.id, company_id: companyId, kind: 'original', version: 1, file_name: `${contract.code}.txt`, storage_path: path, mime: 'text/plain', size_bytes: body.length, sha256: 'demo', processing: 'processed', extracted_text: body.toString('utf8'), uploaded_by: ids.admin }), `documento ${contract.code}`)
    const activated = await admin.from('contracts').update({ status: 'active' }).eq('id', row.id)
    if (activated.error) console.log(`  (contrato ${contract.code} queda en borrador: ${activated.error.message})`)
  }
  log(`${Object.keys(contractIds).length} contratos existentes cargados con su documento.`)

  // ---- Ahorros: declarados, validados por otra persona, con evidencia y reconocimientos mensuales ---------------------------------
  const uploadEvidence = async (validationId, label, description) => {
    const path = `${companyId}/ahorros/${validationId}/${Date.now()}-evidencia.txt`
    const content = Buffer.from(`EVIDENCIA FICTICIA DE DEMOSTRACIÓN\n${description}\n`)
    const stored = await serviceClient.storage.from('documents').upload(path, content, { contentType: 'text/plain', upsert: false })
    if (stored.error) throw new Error(`evidencia: ${stored.error.message}`)
    return asId(must(await manager.rpc('add_savings_evidence', { p_validation: validationId, p_path: path, p_file_name: `${label}.txt`, p_mime: 'text/plain', p_size: content.length, p_description: description }), 'evidencia'))
  }
  const savings = {}
  const specs = {
    aseo: { declare: 12_000_000, validate: 11_400_000, recurrence: 'recurrente', start: monthStart(10), end: null, method: 'Comparación de las facturas del año anterior con las del nuevo contrato, mismo alcance y frecuencia', note: 'Contrato anual con rebaja del 10% sobre la base histórica.', vnote: 'Se descuentan 600.000 por un servicio extra agregado al alcance.', label: 'comparacion-facturas-aseo', description: 'Comparación de facturas de aseo y casinos', monthly: 950_000, months: 10, reverse: 3 },
    elec: { declare: 14_000_000, validate: 13_200_000, recurrence: 'unico', start: addDays(t0, -240), end: addDays(t0, -240), method: 'Cotización vigente contra tarifa adjudicada, mismo alcance', note: 'Rebaja única negociada sobre la tarifa histórica.', vnote: 'Se descuenta un cargo de movilización que no estaba en la base.', label: 'cotizacion-vs-adjudicado-electricos', description: 'Comparación de cotización base y tarifa adjudicada', onceOff: true },
  }
  for (const item of INITIATIVES.filter(entry => entry.savings)) {
    const spec = specs[item.savings]
    const buyer = sessions[item.owner]
    let end = spec.end
    if (!end) { const last = new Date(`${spec.start}T12:00:00Z`); last.setUTCDate(last.getUTCDate() + 364); end = last.toISOString().slice(0, 10) }
    const declared = asId(must(await buyer.rpc('declare_savings', { p_award: null, p_licitacion: item.lic.id, p_plan: null, p_declared: spec.declare, p_nature: 'reduccion_precio', p_recurrence: spec.recurrence, p_start: spec.start, p_end: end, p_note: spec.note }), `declarar ${item.savings}`))
    must(await manager.rpc('validate_savings', { p_validation: declared, p_validated: spec.validate, p_method: spec.method, p_note: spec.vnote }), `validar ${item.savings}`)
    const evidenceId = await uploadEvidence(declared, spec.label, spec.description)
    savings[item.savings] = declared
    if (spec.onceOff) {
      const period = addDays(t0, -240).slice(0, 7)
      must(await manager.rpc('recognize_savings', { p_validation: declared, p_period: period, p_amount: spec.validate, p_evidence: evidenceId, p_note: 'Reconocido con la factura del mes de adjudicación' }), 'reconocimiento único')
      continue
    }
    for (let back = spec.months; back >= 1; back -= 1) {
      const period = monthStart(back).slice(0, 7)
      const recognize = () => manager.rpc('recognize_savings', { p_validation: declared, p_period: period, p_amount: spec.monthly, p_evidence: evidenceId, p_note: 'Reconocido con la factura del mes' })
      const first = asId(must(await recognize(), `reconocimiento -${back}`))
      if (back === spec.reverse) {
        must(await manager.rpc('reverse_recognition', { p_recognition: first, p_note: 'La factura del mes venía con la tarifa anterior; se corrige y se reconoce de nuevo.' }), 'reversa de reconocimiento')
        must(await recognize(), 'reconocimiento corregido')
      }
    }
  }
  for (const item of INITIATIVES.filter(entry => entry.lic?.awarded && !entry.lic.noBaseline)) {
    const signed = await manager.from('licitaciones').update({ status: 'contract_signed' }).eq('id', item.lic.id)
    if (signed.error) console.log(`  (${item.lic.id} no pasa a contrato firmado: ${signed.error.message})`)
  }
  log('Ahorros validados con evidencia: aseo y casinos (recurrente, con una reversa justificada) y servicios eléctricos (único).')

  // ---- Acceso del Super Admin a la empresa demo ------------------------------------------------------------------------------
  if (TARGET === 'local') {
    const home = must(await serviceClient.from('companies').insert({ name: QA_HOME, tax_id: '99.999.998-K', description: 'Empresa de prueba local: representa la empresa propia del Super Admin.' }).select('id').single(), 'empresa propia local')
    const password = randomPassword()
    const address = mail('superadmin.qa')
    const user = await authAdmin('users', { method: 'POST', body: JSON.stringify({ email: address, password, email_confirm: true, user_metadata: { full_name: 'Super Admin QA' } }) })
    must(await serviceClient.from('profiles').upsert({ id: user.id, email: address, full_name: 'Super Admin QA', role: 'super_admin', company_id: home.id, must_change_password: false }, { onConflict: 'id' }), 'perfil super admin local')
    credentials.users.superadmin = { email: address, password, name: 'Super Admin QA', role: 'super_admin', title: 'Super Admin (solo local)' }
    credentials.homeCompanyId = home.id
    ids.superadmin = user.id
    must(await serviceClient.from('tenant_access').insert([{ user_id: user.id, company_id: home.id, kind: 'home', granted_by: 'seed-local' }, { user_id: user.id, company_id: companyId, kind: 'granted', granted_by: 'seed-local' }]), 'acceso del super admin')
  } else {
    const superAdmins = must(await serviceClient.from('profiles').select('id, email, company_id').eq('role', 'super_admin').is('supplier_id', null), 'super admins')
    if (superAdmins.length !== 1) throw new Error(`Se esperaba un único Super Admin y hay ${superAdmins.length}; se detiene el otorgamiento de acceso.`)
    const [owner] = superAdmins
    must(await serviceClient.from('tenant_access').upsert([{ user_id: owner.id, company_id: owner.company_id, kind: 'home', granted_by: 'seed-demo' }, { user_id: owner.id, company_id: companyId, kind: 'granted', granted_by: 'seed-demo' }], { onConflict: 'user_id,company_id', ignoreDuplicates: true }), 'acceso del super admin')
    credentials.superAdminHomeCompanyId = owner.company_id
    log(`Acceso del Super Admin (${owner.email.replace(/^(.{3}).*(@.*)$/, '$1***$2')}) autorizado a la empresa demo; su identidad y credenciales no se tocaron.`)
  }

  saveCredentials({ ...credentials, ids, planIds, categoryIds, contractIds, savings, year })
  console.log('\nListo. Credenciales guardadas en .demo/ (fuera de Git).')
  console.log('Siguiente paso: npm run demo:flow  (recorre bases, licitación, ofertas, evaluación, adjudicación, contrato y ahorro por la interfaz).')
}

main().catch(error => {
  console.error(`\nLa siembra falló: ${error.message}`)
  if (TARGET === 'local') console.error('Para reintentar desde cero: npm run demo:seed -- --reset')
  process.exitCode = 1
})
