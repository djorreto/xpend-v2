import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { Document, Packer, Paragraph } from 'docx'
import mammoth from 'mammoth'
import { extractContractSignals } from './contract-extract.ts'

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

test('un contrato cargado se confirma, se versiona y no altera la adjudicación', async () => {
  const keys = localKeys()
  const buyer = createClient(keys.API_URL, keys.ANON_KEY, { auth: { persistSession: false } })
  const buyerLogin = await buyer.auth.signInWithPassword({
    email: 'buyer.fase0@xpend.test',
    password: buyerPassword(),
  })
  assert.equal(buyerLogin.error, null)
  const buyerId = buyerLogin.data.user?.id
  const { data: profile } = await buyer.from('profiles').select('company_id').eq('id', buyerId).single()
  assert.ok(profile?.company_id)

  const doc = new Document({
    sections: [{
      children: [new Paragraph('Contrato de mantenimiento. Contraparte: Mantención Alfa. Objeto: mantenimiento preventivo mensual de la planta con stock crítico. Vigencia desde el 2026-01-01 hasta el 2026-12-31. Monto USD 150000. Pago a 30 días de la factura aceptada. Renovación automática salvo aviso contrario. Preaviso de 60 días. Obligación del proveedor de mantener el stock crítico.')],
    }],
  })
  const buffer = await Packer.toBuffer(doc)
  const extracted = await mammoth.extractRawText({ buffer })
  const signals = extractContractSignals(extracted.value || '')
  assert.equal(signals.fields.find(field => field.fieldKey === 'amount')?.value, '150000')
  assert.ok(signals.findings.some(item => item.kind === 'obligation'))

  const code = `CTR-TEST-${Date.now()}`
  const { data: contract, error: contractError } = await buyer.from('contracts').insert({
    company_id: profile.company_id,
    code,
    name: 'Contrato de prueba de ingesta',
    contract_type: 'Servicio',
    origin: 'upload',
    owner_id: buyerId,
    created_by: buyerId,
    status: 'draft',
  }).select('id').single()
  assert.equal(contractError, null)
  const contractId = contract.id as string

  const path = `${profile.company_id}/contratos/${contractId}/${Date.now()}-contrato.docx`
  const uploaded = await buyer.storage.from('documents').upload(path, buffer, {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    upsert: false,
  })
  assert.equal(uploaded.error, null)
  const { error: documentError } = await buyer.from('contract_documents').insert({
    contract_id: contractId,
    company_id: profile.company_id,
    kind: 'original',
    version: 1,
    file_name: 'contrato-mantencion.docx',
    storage_path: path,
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size_bytes: buffer.length,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    processing: 'processed',
    extracted_text: extracted.value,
    uploaded_by: buyerId,
  })
  assert.equal(documentError, null)
  const { error: fieldError } = await buyer.from('contract_extractions').insert(signals.fields.map(field => ({
    contract_id: contractId,
    field_key: field.fieldKey,
    proposed_value: field.value,
    source: 'extracted',
    confidence: field.confidence,
    evidence_quote: field.quote,
    evidence_location: field.location,
  })))
  assert.equal(fieldError, null)

  const { data: amountField } = await buyer.from('contract_extractions').select('id, proposed_value').eq('contract_id', contractId).eq('field_key', 'amount').single()
  const confirmed = await buyer.from('contract_extractions').update({
    review_status: 'confirmed',
    confirmed_value: amountField?.proposed_value,
    source: 'confirmed',
    reviewed_by: buyerId,
    reviewed_at: new Date().toISOString(),
  }).eq('id', amountField?.id).select('proposed_value, confirmed_value, source').single()
  assert.equal(confirmed.error, null)
  assert.equal(confirmed.data?.proposed_value, '150000')
  assert.equal(confirmed.data?.source, 'confirmed')

  const { data: draft, error: draftError } = await buyer.from('contracts').insert({
    company_id: profile.company_id,
    code: `${code}-B`,
    name: 'Borrador de plantilla',
    origin: 'builder',
    status: 'in_review',
    currency: 'USD',
    amount: 150000,
    created_by: buyerId,
  }).select('id').single()
  assert.equal(draftError, null)
  const { data: version, error: versionError } = await buyer.from('contract_versions').insert({
    contract_id: draft.id,
    company_id: profile.company_id,
    version: 1,
    body: 'Monto USD 150000. Objeto: {{objeto}}.',
    status: 'in_review',
    created_by: buyerId,
  }).select('id').single()
  assert.equal(versionError, null)
  const selfApproval = await buyer.from('contract_versions').update({ status: 'approved' }).eq('id', version.id)
  assert.match(selfApproval.error?.message || '', /no puede aprobar/)

  const managerPassword = process.env.XPEND_MANAGER_PASSWORD
  assert.ok(managerPassword, 'Define XPEND_MANAGER_PASSWORD para la prueba local')
  const manager = createClient(keys.API_URL, keys.ANON_KEY, { auth: { persistSession: false } })
  const managerLogin = await manager.auth.signInWithPassword({
    email: 'gerente.f1b@xpend.test',
    password: managerPassword,
  })
  assert.equal(managerLogin.error, null)
  const approved = await manager.from('contract_versions').update({ status: 'approved' }).eq('id', version.id).select('status, approved_by').single()
  assert.equal(approved.error, null)
  assert.equal(approved.data?.status, 'approved')
  assert.notEqual(approved.data?.approved_by, buyerId)

  const rewrite = await buyer.from('contract_versions').update({ body: 'texto distinto' }).eq('id', version.id)
  assert.match(rewrite.error?.message || '', /no se reescribe/)
  const next = await buyer.from('contract_versions').insert({
    contract_id: draft.id,
    company_id: profile.company_id,
    version: 2,
    body: 'Edición posterior.',
    status: 'draft',
    created_by: buyerId,
  })
  assert.equal(next.error, null)
  const { data: still } = await buyer.from('contract_versions').select('body, status').eq('id', version.id).single()
  assert.equal(still?.status, 'approved')
  assert.match(still?.body || '', /150000/)

  const { data: award } = await buyer.from('process_awards').select('id, estimated_savings').eq('licitacion_id', 'LIC-F1B-MANT').single()
  if (award?.id) {
    await buyer.from('contracts').update({ award_id: award.id, amount: 10 }).eq('id', draft.id)
    const { data: same } = await buyer.from('process_awards').select('estimated_savings').eq('id', award.id).single()
    assert.equal(Number(same?.estimated_savings), 0)
    const changed = await buyer.from('process_awards').update({ amount: 1 }).eq('id', award.id).select('amount')
    assert.equal(changed.data?.length || 0, 0)
    const { data: untouched } = await buyer.from('process_awards').select('amount, estimated_savings').eq('id', award.id).single()
    assert.equal(Number(untouched?.amount), 150000)
    assert.equal(Number(untouched?.estimated_savings), 0)
    const duplicate = await buyer.from('contracts').insert({
      company_id: profile.company_id,
      code: `${code}-DUP`,
      name: 'Duplicado',
      origin: 'award',
      award_id: award.id,
      currency: 'USD',
      amount: 150000,
      supplier_id: 'supplier-1794671438413',
      created_by: buyerId,
    })
    assert.ok(duplicate.error)
  }

  execSync(`docker exec -i supabase_db_xpend-v3-local psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "DO \\$\\$ DECLARE n int; BEGIN PERFORM set_config('request.jwt.claims', json_build_object('sub','919218a5-34d0-4746-b299-c9abe8f804ca','role','authenticated')::text, true); PERFORM set_config('role','authenticated', true); SELECT count(*) INTO n FROM public.contracts WHERE id = '${contractId}'; IF n <> 0 THEN RAISE EXCEPTION 'el proveedor vio el contrato'; END IF; END \\$\\$;"`, { stdio: 'pipe' })

  await buyer.from('contracts').delete().in('id', [contractId, draft.id])
  await buyer.storage.from('documents').remove([path])
})
