import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'
import {
  SAVINGS_LABELS,
  loadPlanSavingsLinks,
  planSavings,
  realizedSavingsLabel,
  savingsByCurrency,
} from './procurement-flow.ts'

// Prueba contra el Supabase LOCAL. No toca producción: se niega a correr si la URL no es 127.0.0.1:54321.
const COMPANY_ID = '967506d9-2ce9-4420-9c90-2cbd9df79683'
const BUYER_ID = '9c2bb2c7-f961-44c6-84c4-c31c8b817340'
const MANT_PLAN = 'd3455755-7dac-4500-8d8b-d823a2ceca76'
const QA_PLAN = 'b9c0736e-7be2-442a-99b4-e95436fa5b8a'
const TYPED_PLAN = '11111111-1111-4111-8111-111111111111'

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
  if (!env.API_URL?.startsWith('http://127.0.0.1:54321') || !env.ANON_KEY) {
    throw new Error('Supabase local no está disponible')
  }
  return env
}

function buyerPassword() {
  const text = readFileSync('/Users/diegojorreto/Cursor Projects/Xpend/Xpend V3 - Desarrollo/supabase/.env.fase0.local', 'utf8')
  const match = text.match(/^XPEND_FASE0_BUYER_PASSWORD=(.*)$/m)
  if (!match) throw new Error('Falta la clave local del comprador')
  return match[1].trim()
}

function psql(sql: string) {
  execSync('docker exec -i supabase_db_xpend-v3-local psql -U postgres -d postgres -v ON_ERROR_STOP=1', {
    input: sql,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

async function signedInBuyer() {
  const keys = localKeys()
  const buyer = createClient(keys.API_URL, keys.ANON_KEY, { auth: { persistSession: false } })
  const login = await buyer.auth.signInWithPassword({ email: 'buyer.fase0@xpend.test', password: buyerPassword() })
  assert.equal(login.error, null)
  return buyer
}

test('la adjudicación de LIC-F1B-MANT es negociado en cero: ni realizado ni sin información', async () => {
  const buyer = await signedInBuyer()
  const links = await loadPlanSavingsLinks(buyer, [MANT_PLAN])
  const mant = links.find(item => item.licitacion_id === 'LIC-F1B-MANT')
  assert.ok(mant, 'la iniciativa debe seguir vinculada a LIC-F1B-MANT')
  assert.equal(mant?.status, 'awarded')
  assert.equal(mant?.award?.currency, 'USD')

  const { data: plan } = await buyer
    .from('sourcing_plans')
    .select('id, currency, projected_savings_amount, actual_savings_amount')
    .eq('id', MANT_PLAN)
    .single()
  assert.equal(Number(plan?.projected_savings_amount), 12000)
  assert.equal(plan?.actual_savings_amount, null)

  const summary = planSavings(plan!, links)
  assert.deepEqual(summary.negotiated, [{ currency: 'USD', amount: 0 }])
  assert.deepEqual(summary.declared, [])
  assert.equal(summary.target, 12000)
  assert.equal(summary.negotiatedVsTarget, 0)
  assert.equal(realizedSavingsLabel(), SAVINGS_LABELS.noInfo)
})

test('una adjudicación con ahorro negociado sobre el objetivo no se presenta como cumplimiento real', async () => {
  const buyer = await signedInBuyer()
  const links = await loadPlanSavingsLinks(buyer, [QA_PLAN])
  const { data: plan } = await buyer
    .from('sourcing_plans')
    .select('id, currency, projected_savings_amount, actual_savings_amount')
    .eq('id', QA_PLAN)
    .single()
  const summary = planSavings(plan!, links)
  assert.deepEqual(summary.negotiated, [{ currency: 'USD', amount: 50000 }])
  assert.equal(summary.target, 20000)
  assert.equal(summary.negotiatedVsTarget, 250)
  assert.deepEqual(summary.declared, [])
  assert.equal('realized' in summary, false)
  const rows = savingsByCurrency([plan!], links)
  assert.equal(rows[0].negotiated, 50000)
  assert.equal('actual' in rows[0], false)
  assert.equal('rate' in rows[0], false)
})

test('licitaciones adjudicadas y firmadas con ahorro tipeado quedan como declarado, no como negociado ni realizado', async () => {
  try {
    psql(`
      begin;
      set local session_replication_role = replica;
      delete from public.sourcing_plan_licitaciones where plan_id = '${TYPED_PLAN}';
      delete from public.licitaciones where id in ('SAV-TEST-AWARDED', 'SAV-TEST-SIGNED');
      delete from public.sourcing_plans where id = '${TYPED_PLAN}';
      insert into public.sourcing_plans (id, company_id, plan_year, quarter, initiative_type, title, estimated_spend, currency, status, projected_savings_amount, actual_savings_amount, created_by)
      values ('${TYPED_PLAN}', '${COMPANY_ID}', 2026, 'Q4', 'licitacion', 'SAV-TEST iniciativa con cifras tipeadas', 1000, 'USD', 'in_progress', 600, 777, '${BUYER_ID}');
      insert into public.licitaciones (id, company_id, name, status, baseline_currency, baseline_amount, awarded_amount, savings_amount, savings_percentage, created_by)
      values
        ('SAV-TEST-AWARDED', '${COMPANY_ID}', 'SAV-TEST adjudicada tipeada', 'awarded', 'USD', 1000, 900, 100, 10, '${BUYER_ID}'),
        ('SAV-TEST-SIGNED', '${COMPANY_ID}', 'SAV-TEST firmada tipeada', 'contract_signed', 'USD', 2000, 1500, 500, 25, '${BUYER_ID}');
      insert into public.sourcing_plan_licitaciones (plan_id, licitacion_id)
      values ('${TYPED_PLAN}', 'SAV-TEST-AWARDED'), ('${TYPED_PLAN}', 'SAV-TEST-SIGNED');
      commit;
    `)
    const buyer = await signedInBuyer()
    const links = await loadPlanSavingsLinks(buyer, [TYPED_PLAN])
    assert.deepEqual(links.map(item => item.status).sort(), ['awarded', 'contract_signed'])
    assert.equal(links.every(item => item.award == null), true)

    const { data: plan } = await buyer
      .from('sourcing_plans')
      .select('id, currency, projected_savings_amount, actual_savings_amount')
      .eq('id', TYPED_PLAN)
      .single()
    const summary = planSavings(plan!, links)
    assert.deepEqual(summary.negotiated, [], 'sin comité no hay ahorro negociado')
    assert.deepEqual(summary.declared, [{ currency: 'USD', amount: 600 }], 'declarado: 100 + 500, sin sumar el 777 tipeado en la iniciativa')
    assert.equal(summary.negotiatedVsTarget, null)

    const [row] = savingsByCurrency([plan!], links)
    assert.equal(row.negotiated, null)
    assert.equal(row.declared, 600)
    assert.equal(row.negotiatedVsTarget, null)
  } finally {
    psql(`
      begin;
      set local session_replication_role = replica;
      delete from public.sourcing_plan_licitaciones where plan_id = '${TYPED_PLAN}';
      delete from public.licitaciones where id in ('SAV-TEST-AWARDED', 'SAV-TEST-SIGNED');
      delete from public.sourcing_plans where id = '${TYPED_PLAN}';
      commit;
    `)
  }
})
