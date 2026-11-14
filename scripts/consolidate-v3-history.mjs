import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const TARGET = 'qtncgtqgvilbjhrvzoxe'
const FORBIDDEN = 'vlyqrosqapwgzyovbqpg'
const COMPANY_ID = '56a0aedd-2518-4540-9348-6778a3b6b96f'
const EXPECTED_PERMISSIONS = 23
const EXPECTED_GRANTS = 92

const apply = process.argv.includes('--apply')
const recover = process.argv.includes('--recover')
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
  if (ref === FORBIDDEN) throw new Error('El proyecto antiguo no es un destino permitido.')
  if (ref !== 'local' && ref !== TARGET) throw new Error(`Destino rechazado: ${ref}.`)
  if (ref === TARGET && process.env.CONFIRM_PROJECT !== TARGET) {
    throw new Error(`Para producción hace falta CONFIRM_PROJECT=${TARGET}.`)
  }
  if (!key) throw new Error('Falta la clave de servicio del destino.')
  return { url, key, ref }
}

function permissionsPayload() {
  const permissions = read('permissions.json')
  const grants = read('role_permissions.json').map((row) => ({
    ...row,
    company_id: row.company_id || COMPANY_ID,
    created_at: row.created_at || '2026-04-11T02:27:01.014448+00:00',
    updated_at: row.updated_at || '2026-04-11T02:27:01.014448+00:00',
  }))
  if (permissions.length !== EXPECTED_PERMISSIONS || grants.length !== EXPECTED_GRANTS) {
    throw new Error(`Permisos inesperados: ${permissions.length} definiciones y ${grants.length} asignaciones.`)
  }
  const roles = new Set(grants.map((row) => row.role))
  if ([...roles].some((role) => !['admin', 'manager', 'analyst', 'viewer'].includes(role))) {
    throw new Error('Hay una asignación para un rol que la tabla no acepta.')
  }
  return { permissions, grants }
}

async function writeRows(admin, table, rows, onConflict) {
  for (let index = 0; index < rows.length; index += 400) {
    const chunk = rows.slice(index, index + 400)
    const { error } = await admin.from(table).upsert(chunk, { onConflict, ignoreDuplicates: true })
    if (error) throw new Error(`${table}: ${error.message}`)
  }
}

const data = permissionsPayload()
const { url, key, ref } = destination()
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const { count: spendBefore, error: spendError } = await admin.from('si_spend_lines').select('id', { count: 'exact', head: true })
if (spendError) throw new Error(`si_spend_lines: ${spendError.message}`)

console.log(`mode=${apply ? 'apply' : recover ? 'recover' : 'simulate'} destination=${ref}`)
console.log(`spend_import=0 spend_lines_now=${spendBefore}`)
console.log(`permissions=${data.permissions.length} grants=${data.grants.length}`)

if (!apply && !recover) {
  console.log('simulation=ok writes=0')
  console.log('recovery=restaurar public-schema.sql, public-data.sql, auth.sql y los cuatro logos')
  process.exit(0)
}

if (recover) {
  const { error: grantError } = await admin.from('role_permissions').delete().eq('company_id', COMPANY_ID)
  if (grantError) throw new Error(`recovery grants: ${grantError.message}`)
  const { error: permissionError } = await admin.from('permissions').delete().eq('company_id', COMPANY_ID)
  if (permissionError) throw new Error(`recovery permissions: ${permissionError.message}`)
  console.log('recovered_permissions=deleted')
  console.log('full_recovery=restaurar los volcados de public y auth si también se aplicaron las migraciones')
  process.exit(0)
}

const company = read('company.json')
const { error: companyError } = await admin.from('companies').upsert(
  { id: company.id, name: company.name },
  { onConflict: 'id', ignoreDuplicates: true },
)
if (companyError) throw new Error(`companies: ${companyError.message}`)
await writeRows(admin, 'permissions', data.permissions, 'company_id,id')
await writeRows(admin, 'role_permissions', data.grants, 'company_id,role,permission_id')

const { count: permissionCount } = await admin.from('permissions').select('id', { count: 'exact', head: true }).eq('company_id', COMPANY_ID)
const { count: grantCount } = await admin.from('role_permissions').select('id', { count: 'exact', head: true }).eq('company_id', COMPANY_ID)
const { count: spendAfter } = await admin.from('si_spend_lines').select('id', { count: 'exact', head: true })
if (permissionCount !== EXPECTED_PERMISSIONS || grantCount !== EXPECTED_GRANTS || spendAfter !== spendBefore) {
  throw new Error(`Integridad fallida: permisos=${permissionCount} asignaciones=${grantCount} gasto=${spendAfter}.`)
}
console.log(`applied_permissions=${permissionCount} applied_grants=${grantCount} spend_lines=${spendAfter}`)
