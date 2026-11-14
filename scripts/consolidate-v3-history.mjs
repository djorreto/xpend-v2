import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const TARGET = 'qtncgtqgvilbjhrvzoxe'
const FORBIDDEN = 'vlyqrosqapwgzyovbqpg'
const USEFUL_UPLOAD = 'c3cf2bf1-0b2f-4654-8633-7647ab4abafd'
const EXPECTED_LINES = 4150
const EXPECTED_AMOUNT = 868114.86
const COMPANY_ID = '56a0aedd-2518-4540-9348-6778a3b6b96f'

const apply = process.argv.includes('--apply')
const recover = process.argv.includes('--recover')
const includeDummy = process.env.INCLUDE_DUMMY === '1'
const root = new URL('../supabase/.temp/v3-history/', import.meta.url)
const read = (name) => JSON.parse(readFileSync(new URL(name, root), 'utf8'))

function projectRef(url) {
  const host = new URL(url).hostname
  if (host.startsWith('127.0.0.1') || host === 'localhost') return 'local'
  return host.split('.')[0]
}

function destination() {
  let url = process.env.CONSOLIDATE_URL
  let key = process.env.CONSOLIDATE_SERVICE_ROLE_KEY
  if (!url) {
    const status = execFileSync('npx', ['supabase', 'status', '-o', 'env'], {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
    })
    const env = Object.fromEntries(
      status.split('\n').filter((line) => /^[A-Z0-9_]+=/.test(line)).map((line) => {
        const index = line.indexOf('=')
        return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, '')]
      }),
    )
    url = env.API_URL
    key = env.SERVICE_ROLE_KEY
  }
  const ref = projectRef(url)
  if (ref === FORBIDDEN) {
    throw new Error('El proyecto antiguo no es un destino permitido.')
  }
  if (ref !== 'local' && ref !== TARGET) {
    throw new Error(`Destino rechazado: ${ref}.`)
  }
  if (ref === TARGET && process.env.CONFIRM_PROJECT !== TARGET) {
    throw new Error(`Para producción hace falta CONFIRM_PROJECT=${TARGET}.`)
  }
  if (!key) throw new Error('Falta la clave de servicio del destino.')
  return { url, key, ref }
}

function payload() {
  const company = read('company.json')
  const uploads = read('uploads.json').filter((row) => includeDummy || row.id === USEFUL_UPLOAD)
  const uploadIds = new Set(uploads.map((row) => row.id))
  const lines = read('si_spend_lines.json').filter((row) => uploadIds.has(row.upload_id))
  const amount = lines.reduce((sum, row) => sum + Number(row.amount), 0)
  return { company, uploads, lines, amount: Math.round(amount * 100) / 100 }
}

function assertUsefulShape(data) {
  if (includeDummy) return
  if (data.lines.length !== EXPECTED_LINES) {
    throw new Error(`Se esperaban ${EXPECTED_LINES} líneas útiles y hay ${data.lines.length}.`)
  }
  if (Math.abs(data.amount - EXPECTED_AMOUNT) > 0.001) {
    throw new Error(`El monto útil ${data.amount} no coincide con ${EXPECTED_AMOUNT}.`)
  }
  if (data.uploads.length !== 1 || data.uploads[0].id !== USEFUL_UPLOAD) {
    throw new Error('La carga útil no es la esperada.')
  }
}

async function existingIds(admin, table, ids) {
  let found = 0
  for (let index = 0; index < ids.length; index += 200) {
    const chunk = ids.slice(index, index + 200)
    const { count, error } = await admin.from(table).select('id', { count: 'exact', head: true }).in('id', chunk)
    if (error) throw new Error(`${table}: ${error.message}`)
    found += count || 0
  }
  return found
}

async function writeRows(admin, table, rows, onConflict) {
  for (let index = 0; index < rows.length; index += 400) {
    const chunk = rows.slice(index, index + 400)
    const { error } = await admin.from(table).upsert(chunk, { onConflict, ignoreDuplicates: true })
    if (error) throw new Error(`${table}: ${error.message}`)
  }
}

const data = payload()
assertUsefulShape(data)
const { url, key, ref } = destination()
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const lineIds = data.lines.map((row) => row.id)
const already = await existingIds(admin, 'si_spend_lines', lineIds)

console.log(`mode=${apply ? 'apply' : recover ? 'recover' : 'simulate'} destination=${ref}`)
console.log(`useful_lines=${data.lines.length} useful_amount=${data.amount} uploads=${data.uploads.length}`)
console.log(`permissions=${read('permissions.json').length} grants=${read('role_permissions.json').length}`)
console.log(`already_present=${already} dummy_included=${includeDummy}`)

if (!apply && !recover) {
  console.log('simulation=ok writes=0')
  console.log(`recovery=delete from si_uploads where id = '${USEFUL_UPLOAD}'`)
  process.exit(0)
}

if (recover) {
  if (ref === TARGET && process.env.CONFIRM_PROJECT !== TARGET) {
    throw new Error('La recuperación en producción exige CONFIRM_PROJECT.')
  }
  const { error } = await admin.from('si_uploads').delete().eq('id', USEFUL_UPLOAD)
  if (error) throw new Error(`recovery: ${error.message}`)
  const left = await existingIds(admin, 'si_spend_lines', lineIds)
  console.log(`recovered_remaining_lines=${left}`)
  process.exit(left === 0 ? 0 : 1)
}

const { error: companyError } = await admin.from('companies').upsert(
  { id: data.company.id, name: data.company.name },
  { onConflict: 'id', ignoreDuplicates: true },
)
if (companyError) throw new Error(`companies: ${companyError.message}`)

await writeRows(admin, 'si_uploads', data.uploads.map(({ classification, ...row }) => row), 'id')
await writeRows(admin, 'si_spend_lines', data.lines.map((row) => ({
  id: row.id,
  upload_id: row.upload_id,
  company_id: row.company_id,
  purchase_order: row.purchase_order,
  line_number: row.line_number,
  description: row.description,
  supplier_name: row.supplier_name,
  supplier_code: row.supplier_code,
  amount: row.amount,
  currency: row.currency,
  cost_center: row.cost_center,
  purchase_date: row.purchase_date,
  category: row.category,
  subcategory: row.subcategory,
  ai_confidence: row.ai_confidence,
  ai_justification: row.ai_justification,
  needs_review: row.needs_review,
  reviewed_by: row.reviewed_by,
  reviewed_at: row.reviewed_at,
  raw_data: row.raw_data,
  created_at: row.created_at,
  updated_at: row.updated_at,
})), 'id')
await writeRows(admin, 'permissions', read('permissions.json'), 'company_id,id')
await writeRows(admin, 'role_permissions', read('role_permissions.json').map((row) => ({
  ...row,
  company_id: row.company_id || COMPANY_ID,
  created_at: row.created_at || '2026-04-11T02:27:01.014448+00:00',
  updated_at: row.updated_at || '2026-04-11T02:27:01.014448+00:00',
})), 'company_id,role,permission_id')

const present = await existingIds(admin, 'si_spend_lines', lineIds)
let loadedAmount = 0
for (let index = 0; index < lineIds.length; index += 200) {
  const chunk = lineIds.slice(index, index + 200)
  const { data: amounts, error } = await admin.from('si_spend_lines').select('amount').in('id', chunk)
  if (error) throw new Error(`integrity: ${error.message}`)
  loadedAmount += (amounts || []).reduce((sum, row) => sum + Number(row.amount), 0)
}
loadedAmount = Math.round(loadedAmount * 100) / 100
if (!includeDummy && (present !== EXPECTED_LINES || Math.abs(loadedAmount - EXPECTED_AMOUNT) > 0.001)) {
  throw new Error(`Integridad fallida: líneas=${present} monto=${loadedAmount}. Recuperación: delete from si_uploads where id = '${USEFUL_UPLOAD}'.`)
}
console.log(`applied_present=${present} applied_amount=${loadedAmount} duplicates_kept=${already}`)
