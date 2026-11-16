import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { runAna } from '../ana-run.ts'
import { completeGroq, GroqCallError, groundedPrompt } from '../groq-call.ts'

// Pruebas de integración REALES contra Groq con datos ficticios. Consumen cuota diaria: se ejecutan a propósito con
// `npm run test:live`. Si no hay clave o cuota, se marcan como OMITIDAS con el motivo; nunca como aprobadas.

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
  if (!env.API_URL?.startsWith('http://127.0.0.1:54321') || !env.ANON_KEY) throw new Error('Supabase local no está disponible')
  return env
}

function buyerPassword() {
  const text = readFileSync('/Users/diegojorreto/Cursor Projects/Xpend/Xpend V3 - Desarrollo/supabase/.env.fase0.local', 'utf8')
  const match = text.match(/^XPEND_FASE0_BUYER_PASSWORD=(.*)$/m)
  if (!match) throw new Error('Falta la clave local del comprador')
  return match[1].trim()
}


test('EN VIVO · Groq narra un contrato ficticio y registra los tokens', async t => {
  if (!process.env.GROQ_API_KEY) return t.skip('Sin GROQ_API_KEY: no se hizo ninguna llamada real')
  const keys = localKeys()
  const buyer = createClient(keys.API_URL, keys.ANON_KEY, { auth: { persistSession: false } })
  const login = await buyer.auth.signInWithPassword({ email: 'buyer.fase0@xpend.test', password: buyerPassword() })
  assert.equal(login.error, null)
  const buyerId = login.data.user?.id
  const { data: profile } = await buyer.from('profiles').select('company_id').eq('id', buyerId).single()
  const created = await buyer.from('contracts').insert({
    company_id: profile?.company_id,
    code: `CTR-ANA-FICT-${Date.now()}`,
    name: 'Contrato ficticio',
    origin: 'upload',
    status: 'draft',
    created_by: buyerId,
  }).select('id').single()
  assert.equal(created.error, null)
  await buyer.from('contract_versions').insert({
    contract_id: created.data?.id,
    company_id: profile?.company_id,
    version: 1,
    status: 'draft',
    body: 'Texto ficticio. Taller Demo debe avisar con 30 dias de anticipacion para no renovar el servicio de prueba.',
    created_by: buyerId,
  })
  try {
    const result = await runAna(buyer, '¿Con cuánta anticipación hay que avisar?', {
      module: 'contrato',
      recordId: created.data?.id,
      label: 'Contrato ficticio',
    }, { useModel: true })
    assert.equal(result.error, undefined)
    if (!result.answer.modelCalled) return t.skip('Sin cuota diaria o IA externa apagada: NO se hizo llamada real, no cuenta como aprobada')
    assert.equal(result.answer.modelCalled, true)
    assert.match(result.answer.text, /30/)
    const { data: row } = await buyer.from('ana_interactions').select('model, tokens, input_tokens, output_tokens, model_called').eq('id', result.interactionId).single()
    assert.equal(row?.model_called, true)
    assert.equal(row?.model, 'qwen/qwen3.8-27b')
    assert.equal(Number(row?.tokens) > 0, true)
    assert.equal(Number(row?.tokens), Number(row?.input_tokens) + Number(row?.output_tokens))
  } finally {
    await buyer.from('contracts').delete().eq('id', created.data?.id)
  }
})

test('EN VIVO · Groq responde un texto ficticio y devuelve el uso de tokens', async t => {
  if (!process.env.GROQ_API_KEY) return t.skip('Sin GROQ_API_KEY: no se hizo ninguna llamada real')
  let result
  try {
    result = await completeGroq({
    system: 'Responde solo con el número que aparece en el texto ficticio.',
    prompt: groundedPrompt('¿Cuántos días de aviso constan?', 'Texto ficticio: Taller Demo debe avisar con 30 dias.'),
    maxOutputTokens: 16,
    temperature: 0,
    })
  } catch (error) {
    if (error instanceof GroqCallError && error.status === 429) return t.skip('Groq limitó la cuenta (429): NO se hizo llamada real, no cuenta como aprobada')
    throw error
  }
  assert.match(result.text, /30/)
  assert.equal(result.inputTokens > 0, true)
  assert.equal(result.outputTokens > 0, true)
  assert.equal(result.inputTokens + result.outputTokens <= 6000, true)
})
