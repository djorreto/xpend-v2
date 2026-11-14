import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'
import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'
import { buildContractDocx, buildContractPdf, contractExportModel } from './contract-document.ts'

const AWARD_ID = '4573f972-500a-4222-bca9-7bd69b0bd731'
const CONTRACT_ID = '43c31453-6713-4de9-b167-26bc6e0b95ee'
const VIEWER_ID = 'f1136788-9c7b-43b3-82e4-a3713bb8a8c8'
const OTHER_COMPANY_ADMIN = 'ca2f62cd-5327-408f-ac9f-1374d6b31eb1'
const SUPPLIER_USER = '919218a5-34d0-4746-b299-c9abe8f804ca'
const PLAN_ID = 'd3455755-7dac-4500-8d8b-d823a2ceca76'

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

function assertDocument(text: string) {
  for (const expected of [
    'Versión aprobada 4',
    'Fase0 Compradora',
    'Alfa Mantenciones',
    '76.111.111-1',
    '150000',
    'Mano de obra preventiva',
    '8000',
    'Repuestos',
    '54000',
    'Anexo comercial',
    'Anexo técnico',
    'Documentos citados',
    'Renovación manual',
    'reporte mensual',
    'LIC-F1B-MANT',
    'Descripción',
    'Cantidad',
    'Unidad',
    'Precio',
    'Moneda',
  ]) {
    assert.match(text, new RegExp(expected))
  }
  assert.match(text, /\d+\.\s/)
  assert.equal(text.includes('{{'), false)
  assert.equal(text.includes('Datos confirmados'), false)
  assert.equal(text.includes('Observaciones de la evaluación'), false)
}

test('el contrato de LIC-F1B-MANT conserva el circuito y exporta la versión 4', async () => {
  const keys = localKeys()
  const buyer = createClient(keys.API_URL, keys.ANON_KEY, { auth: { persistSession: false } })
  const login = await buyer.auth.signInWithPassword({
    email: 'buyer.fase0@xpend.test',
    password: buyerPassword(),
  })
  assert.equal(login.error, null)
  const buyerId = login.data.user?.id

  const { data: contract, error: contractError } = await buyer
    .from('contracts')
    .select('id, code, licitacion_id, award_id, dossier_id, amount, currency, status, origin, source_snapshot')
    .eq('id', CONTRACT_ID)
    .single()
  assert.equal(contractError, null)
  assert.equal(contract?.code, 'CTR-LIC-F1B-MANT')
  assert.equal(contract?.licitacion_id, 'LIC-F1B-MANT')
  assert.equal(contract?.award_id, AWARD_ID)
  assert.equal(contract?.origin, 'award')
  assert.equal(contract?.status, 'active')
  assert.equal(Number(contract?.amount), 150000)
  assert.equal(contract?.currency, 'USD')
  assert.ok(contract?.dossier_id)

  const { data: award } = await buyer
    .from('process_awards')
    .select('amount, currency, estimated_savings, contract_id')
    .eq('id', AWARD_ID)
    .single()
  assert.equal(Number(award?.amount), 150000)
  assert.equal(award?.currency, 'USD')
  assert.equal(Number(award?.estimated_savings), 0)
  assert.equal(award?.contract_id, CONTRACT_ID)

  const { data: licitacion } = await buyer
    .from('licitaciones')
    .select('status, savings_amount, savings_percentage')
    .eq('id', 'LIC-F1B-MANT')
    .single()
  assert.equal(licitacion?.status, 'awarded')
  assert.equal(Number(licitacion?.savings_amount), 0)
  assert.equal(Number(licitacion?.savings_percentage), 0)

  const { data: versions } = await buyer
    .from('contract_versions')
    .select('id, version, status, body, created_by, approved_by, return_note')
    .eq('contract_id', CONTRACT_ID)
    .order('version')
  assert.deepEqual(versions?.map(version => version.status), ['draft', 'returned', 'approved', 'approved'])
  assert.match(versions?.[1]?.return_note || '', /reporte mensual/)
  assert.equal(versions?.every(version => version.created_by === buyerId), true)
  assert.notEqual(versions?.[3]?.approved_by, buyerId)
  assert.match(versions?.[2]?.body || '', /\{\{renovacion\}\}/)
  assert.equal((versions?.[3]?.body || '').includes('{{'), false)
  assert.match(versions?.[3]?.body || '', /Renovación manual/)
  assert.match(versions?.[3]?.body || '', /reporte mensual/)

  const { data: reviews } = await buyer
    .from('contract_reviews')
    .select('version_id, action, note')
    .in('version_id', (versions || []).map(version => version.id))
    .order('created_at')
  const byVersion = new Map((versions || []).map(version => [version.id, version.version]))
  assert.deepEqual(
    (reviews || []).map(review => `${byVersion.get(review.version_id)}:${review.action}`),
    ['2:submitted', '2:returned', '3:submitted', '3:approved', '4:submitted', '4:approved'],
  )

  const approved = versions?.find(version => version.version === 4)
  const model = contractExportModel({
    code: contract.code,
    title: 'Contrato Alfa Mantenciones SpA',
    version: approved?.version || 0,
    body: approved?.body || '',
    buyer: contract.source_snapshot?.buyer || null,
    supplier: contract.source_snapshot?.supplierName || null,
    supplierRut: contract.source_snapshot?.supplierRut || null,
    currency: contract.currency,
    amount: contract.amount,
    lines: contract.source_snapshot?.lines || [],
  })
  const docx = await buildContractDocx(model)
  const word = await mammoth.extractRawText({ buffer: docx })
  assertDocument(word.value)
  const parser = new PDFParse({ data: buildContractPdf(model) })
  const pdf = await parser.getText()
  assertDocument(pdf.text)

  const frozen = await buyer.from('contract_versions').update({ body: 'cambio silencioso' }).eq('id', approved?.id)
  assert.match(frozen.error?.message || '', /ya no se edita/)
  const { data: sameBody } = await buyer.from('contract_versions').select('body').eq('id', approved?.id).single()
  assert.equal(sameBody?.body, approved?.body)

  const duplicate = await buyer.from('contracts').insert({
    company_id: '967506d9-2ce9-4420-9c90-2cbd9df79683',
    code: `CTR-DUP-${Date.now()}`,
    name: 'Duplicado',
    origin: 'award',
    award_id: AWARD_ID,
    licitacion_id: 'LIC-F1B-MANT',
    currency: 'USD',
    amount: 150000,
    created_by: buyerId,
  })
  assert.ok(duplicate.error)

  const untouched = await buyer.from('process_awards').update({ amount: 1, estimated_savings: 99 }).eq('id', AWARD_ID).select('amount')
  assert.equal(untouched.data?.length || 0, 0)
  const { data: awardAfter } = await buyer.from('process_awards').select('amount, estimated_savings').eq('id', AWARD_ID).single()
  assert.equal(Number(awardAfter?.amount), 150000)
  assert.equal(Number(awardAfter?.estimated_savings), 0)

  psql(`
    do $$
    declare n int;
    begin
      if (select count(*) from public.process_awards pa join public.award_decisions d on d.id = pa.decision_id where d.outcome is distinct from 'approved') <> 0 then
        raise exception 'hay una adjudicación sin decisión aprobada';
      end if;
      if (select projected_savings_amount from public.sourcing_plans where id = '${PLAN_ID}') <> 12000
         or (select actual_savings_amount from public.sourcing_plans where id = '${PLAN_ID}') is not null then
        raise exception 'el objetivo o el ahorro realizado de la iniciativa cambió';
      end if;

      perform set_config('request.jwt.claims', json_build_object('sub','${OTHER_COMPANY_ADMIN}','role','authenticated')::text, true);
      perform set_config('role','authenticated', true);
      select count(*) into n from public.contracts where id = '${CONTRACT_ID}';
      if n <> 0 then raise exception 'otra empresa vio el contrato'; end if;
      select count(*) into n from public.contract_reviews r
        join public.contract_versions v on v.id = r.version_id
        where v.contract_id = '${CONTRACT_ID}';
      if n <> 0 then raise exception 'otra empresa vio las revisiones'; end if;

      perform set_config('request.jwt.claims', json_build_object('sub','${SUPPLIER_USER}','role','authenticated')::text, true);
      select count(*) into n from public.contracts where id = '${CONTRACT_ID}';
      if n <> 0 then raise exception 'el proveedor vio el contrato'; end if;
      select count(*) into n from public.contract_versions where contract_id = '${CONTRACT_ID}';
      if n <> 0 then raise exception 'el proveedor vio las versiones'; end if;
      select count(*) into n from storage.objects where bucket_id = 'documents' and name like '%/contratos/%';
      if n <> 0 then raise exception 'el proveedor vio archivos internos de contratos'; end if;

      perform set_config('request.jwt.claims', json_build_object('sub','${VIEWER_ID}','role','authenticated')::text, true);
      begin
        update public.contract_versions set body = 'cambio no autorizado'
        where contract_id = '${CONTRACT_ID}' and version = 4;
        get diagnostics n = row_count;
        if n <> 0 then raise exception 'un lector modificó la versión aprobada'; end if;
      exception
        when others then
          if sqlerrm not like '%ya no se edita%' and sqlerrm not like '%no se reescribe%' and sqlerrm not like '%no está habilitado%' then
            raise;
          end if;
      end;
      if (select body from public.contract_versions where contract_id = '${CONTRACT_ID}' and version = 4) like '%cambio no autorizado%' then
        raise exception 'la versión aprobada quedó modificada';
      end if;
    end $$;
  `)
})

test('la revisión legal se exige solo cuando la política de la empresa está activa', async () => {
  const password = process.env.XPEND_MANAGER_PASSWORD
  assert.ok(password, 'Define XPEND_MANAGER_PASSWORD para la prueba local')
  const keys = localKeys()
  const buyer = createClient(keys.API_URL, keys.ANON_KEY, { auth: { persistSession: false } })
  const manager = createClient(keys.API_URL, keys.ANON_KEY, { auth: { persistSession: false } })
  const buyerLogin = await buyer.auth.signInWithPassword({ email: 'buyer.fase0@xpend.test', password: buyerPassword() })
  const managerLogin = await manager.auth.signInWithPassword({ email: 'gerente.f1b@xpend.test', password })
  assert.equal(buyerLogin.error, null)
  assert.equal(managerLogin.error, null)
  const buyerId = buyerLogin.data.user?.id
  const { data: profile } = await buyer.from('profiles').select('company_id').eq('id', buyerId).single()
  const companyId = profile?.company_id as string
  const { data: previous } = await buyer.from('contract_policies').select('legal_review_required').eq('company_id', companyId).maybeSingle()
  const code = `CTR-LEGAL-${Date.now()}`
  let contractId = ''
  try {
    const policy = await buyer.from('contract_policies').upsert({
      company_id: companyId,
      legal_review_required: true,
      updated_by: buyerId,
      updated_at: new Date().toISOString(),
    })
    assert.equal(policy.error, null)
    const created = await buyer.from('contracts').insert({
      company_id: companyId,
      code,
      name: 'Contrato independiente de prueba legal',
      origin: 'upload',
      status: 'draft',
      created_by: buyerId,
    }).select('id').single()
    assert.equal(created.error, null)
    contractId = created.data?.id
    const version = await buyer.from('contract_versions').insert({
      contract_id: contractId,
      company_id: companyId,
      version: 1,
      body: 'Contrato independiente, sin licitación ni adjudicación.',
      status: 'in_review',
      created_by: buyerId,
    }).select('id').single()
    assert.equal(version.error, null)
    const missing = await manager.from('contract_versions').update({ status: 'approved' }).eq('id', version.data?.id)
    assert.match(missing.error?.message || '', /revisión legal/)
    const approved = await manager.from('contract_versions').update({
      status: 'approved',
      legal_note: 'Revisión legal de la prueba local. No forma parte del expediente de mantención.',
    }).eq('id', version.data?.id).select('status').single()
    assert.equal(approved.error, null)
    assert.equal(approved.data?.status, 'approved')
  } finally {
    if (contractId) await buyer.from('contracts').delete().eq('id', contractId)
    await buyer.from('contract_policies').upsert({
      company_id: companyId,
      legal_review_required: Boolean(previous?.legal_review_required),
      updated_by: buyerId,
      updated_at: new Date().toISOString(),
    })
  }
  const { data: restored } = await buyer.from('contract_policies').select('legal_review_required').eq('company_id', companyId).single()
  assert.equal(Boolean(restored?.legal_review_required), Boolean(previous?.legal_review_required))
  const leftover = await buyer.from('contracts').select('id').eq('code', code)
  assert.equal(leftover.data?.length || 0, 0)
})
