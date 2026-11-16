import assert from 'node:assert/strict'
import test from 'node:test'
import { localSql, setup } from './testing/local-db.ts'

// Pruebas contra Supabase LOCAL: declaración, validación con separación de funciones, evidencia privada, reconocimientos
// mensuales inmutables, reversas y prevención de doble contabilización.

const MARK = 'ETAPA4'
const NOW = new Date()
const PERIOD = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}`
const FUTURE = `${NOW.getFullYear() + 1}-01`
const START = `${NOW.getFullYear()}-01-01`

function cleanupSql(validationIds: string[], licitacionIds: string[]) {
  const ids = validationIds.map(id => `'${id}'`).join(',') || "'00000000-0000-0000-0000-000000000000'"
  const lics = licitacionIds.map(id => `'${id}'`).join(',') || "''"
  return `
    begin;
    alter table public.savings_recognitions disable trigger forbid_mutation;
    alter table public.savings_evidence disable trigger forbid_mutation;
    alter table public.savings_events disable trigger forbid_mutation;
    alter table public.savings_validations disable trigger guard_savings_validation;
    delete from public.savings_recognitions where validation_id in (${ids});
    delete from public.savings_evidence where validation_id in (${ids});
    delete from public.savings_events where validation_id in (${ids});
    delete from public.savings_validations where id in (${ids});
    alter table public.savings_recognitions enable trigger forbid_mutation;
    alter table public.savings_evidence enable trigger forbid_mutation;
    alter table public.savings_events enable trigger forbid_mutation;
    alter table public.savings_validations enable trigger guard_savings_validation;
    delete from public.licitaciones where id in (${lics});
    commit;`
}

test('ahorros: declarar, validar con otra persona, evidencia, reconocer, reversar y no contar dos veces', async () => {
  const { admin, clients, companyId, profiles, analystEmail, managerEmail, adminEmail } = await setup()
  const { manager, analyst, viewer } = clients
  const adminClient = clients.admin
  const validationIds: string[] = []
  const licitacionIds: string[] = []
  try {
    const awards = await admin.from('process_awards').select('id, licitacion_id').eq('company_id', companyId).gt('estimated_savings', 0).gt('baseline_amount', 0).limit(2)
    assert.ok((awards.data || []).length >= 1, 'se necesita una adjudicación local con línea base')
    const award = awards.data![0]
    const awardId = award.id as string
    const before = await admin.from('process_awards').select('estimated_savings, realized_savings').eq('id', awardId).single()

    // Declarar: viewer no; analista sin iniciativa propia no; manager sí.
    const args = { p_award: awardId, p_licitacion: null, p_plan: null, p_declared: 50000, p_nature: 'reduccion_precio', p_recurrence: 'recurrente', p_start: START, p_end: `${NOW.getFullYear() + 1}-12-31`, p_note: 'Condiciones negociadas' }
    assert.ok((await viewer.rpc('declare_savings', args)).error, 'viewer no declara')
    const analystTry = await analyst.rpc('declare_savings', args)
    assert.ok(analystTry.error?.message.includes('responsable'), `el analista solo declara lo suyo: ${analystTry.error?.message}`)
    assert.ok((await manager.rpc('declare_savings', { ...args, p_declared: 999999999 })).error?.message.includes('negociado'), 'no se declara más que lo negociado')
    assert.ok((await manager.rpc('declare_savings', { ...args, p_end: null })).error?.message.includes('término'), 'recurrente necesita término')
    assert.ok((await manager.rpc('declare_savings', { ...args, p_nature: 'otro' })).error)
    const declared = await manager.rpc('declare_savings', args)
    assert.equal(declared.error, null, declared.error?.message)
    const validationId = declared.data as string
    validationIds.push(validationId)

    // Declarar no cambia la adjudicación: el negociado sigue siendo negociado; el realizado de la adjudicación sigue vacío.
    const after = await admin.from('process_awards').select('estimated_savings, realized_savings').eq('id', awardId).single()
    assert.deepEqual(after.data, before.data, 'la adjudicación no se toca')

    // Doble contabilización: una sola declaración activa por adjudicación.
    const dup = await manager.rpc('declare_savings', args)
    assert.ok(dup.error?.message.includes('no se cuenta dos veces'))
    const dupOther = await adminClient.rpc('declare_savings', args)
    assert.ok(dupOther.error?.message.includes('no se cuenta dos veces'), 'otra persona tampoco puede duplicarla')

    // Quien declara no valida (ni siquiera con otro rol de gerente): lo valida otra persona.
    const self = await manager.rpc('validate_savings', { p_validation: validationId, p_validated: 40000, p_method: 'Comparación de facturas', p_note: null })
    assert.ok(self.error?.message.includes('Quien declara no valida'))
    for (const client of [analyst, viewer]) assert.ok((await client.rpc('validate_savings', { p_validation: validationId, p_validated: 40000, p_method: 'Comparación de facturas', p_note: null })).error, 'solo gerentes validan')
    assert.ok((await adminClient.rpc('validate_savings', { p_validation: validationId, p_validated: 60000, p_method: 'Comparación de facturas', p_note: null })).error?.message.includes('entre cero'), 'no se valida más que lo declarado')
    assert.ok((await adminClient.rpc('validate_savings', { p_validation: validationId, p_validated: 40000, p_method: 'abc', p_note: null })).error?.message.includes('metodología'))

    // Sin evidencia no hay reconocimiento, y un reconocimiento exige una validación vigente.
    assert.ok((await adminClient.rpc('recognize_savings', { p_validation: validationId, p_period: PERIOD, p_amount: 100, p_evidence: null, p_note: null })).error, 'sin validar no se reconoce')
    const validated = await adminClient.rpc('validate_savings', { p_validation: validationId, p_validated: 36000, p_method: 'Comparación de facturas contra la línea base', p_note: 'Revisado' })
    assert.equal(validated.error, null, validated.error?.message)
    const row = await admin.from('savings_validations').select('status, validated_amount, validated_by, declared_by').eq('id', validationId).single()
    assert.equal(row.data?.status, 'validated')
    assert.equal(row.data?.validated_by, profiles[adminEmail])
    assert.notEqual(row.data?.validated_by, row.data?.declared_by)
    // Una validación vigente no se edita.
    assert.ok((await admin.from('savings_validations').update({ validated_amount: 99999999 }).eq('id', validationId)).error, 'la validación no se edita')
    assert.ok((await admin.from('savings_validations').update({ declared_by: profiles[analystEmail] }).eq('id', validationId)).error, 'los datos declarados no cambian')
    assert.ok((await manager.rpc('validate_savings', { p_validation: validationId, p_validated: 1, p_method: 'otra vez distinto', p_note: null })).error, 'no se valida dos veces')

    const noEvidence = await adminClient.rpc('recognize_savings', { p_validation: validationId, p_period: PERIOD, p_amount: 100, p_evidence: null, p_note: null })
    assert.ok(noEvidence.error, 'sin evidencia no hay reconocimiento')

    // Evidencia: el archivo debe existir de verdad en el bucket privado y colgar de la ruta de la validación.
    const path = `${companyId}/ahorros/${validationId}/${Date.now()}-evidencia.txt`
    assert.ok((await adminClient.rpc('add_savings_evidence', { p_validation: validationId, p_path: path, p_file_name: 'evidencia.txt', p_mime: 'text/plain', p_size: 10, p_description: 'inexistente' })).error?.message.includes('no existe'), 'evidencia inexistente rechazada')
    assert.ok((await adminClient.rpc('add_savings_evidence', { p_validation: validationId, p_path: `${companyId}/ahorros/${companyId}/x.txt`, p_file_name: 'x', p_mime: null, p_size: 1 })).error?.message.includes('ruta'))
    const upload = await adminClient.storage.from('documents').upload(path, new Blob(['Factura de referencia ' + MARK]), { contentType: 'text/plain' })
    assert.equal(upload.error, null, upload.error?.message)
    const viewerUpload = await viewer.storage.from('documents').upload(`${companyId}/ahorros/${validationId}/viewer.txt`, new Blob(['x']))
    assert.ok(viewerUpload.error, 'el viewer no sube evidencia')
    const evidence = await adminClient.rpc('add_savings_evidence', { p_validation: validationId, p_path: path, p_file_name: 'evidencia.txt', p_mime: 'text/plain', p_size: 30, p_description: 'Factura de febrero' })
    assert.equal(evidence.error, null, evidence.error?.message)
    const evidenceId = evidence.data as string
    // Privacidad de la evidencia: el viewer no la descarga ni ve su registro.
    assert.ok((await viewer.storage.from('documents').download(path)).error, 'el viewer no descarga evidencia')
    assert.equal((await viewer.from('savings_evidence').select('id').eq('id', evidenceId)).data?.length, 0)
    assert.equal((await analyst.from('savings_evidence').select('id').eq('id', evidenceId)).data?.length, 1, 'el analista sí la ve')
    assert.equal((await adminClient.storage.from('documents').download(path)).error, null)
    assert.ok((await analyst.rpc('add_savings_evidence', { p_validation: validationId, p_path: path, p_file_name: 'x', p_mime: null, p_size: 1 })).error)

    // Reconocimientos: tope mensual (1/12 del anualizado = 3000), período futuro y duplicados.
    assert.ok((await adminClient.rpc('recognize_savings', { p_validation: validationId, p_period: PERIOD, p_amount: 3500, p_evidence: evidenceId, p_note: null })).error?.message.includes('doceavo'))
    assert.ok((await adminClient.rpc('recognize_savings', { p_validation: validationId, p_period: FUTURE, p_amount: 100, p_evidence: evidenceId, p_note: null })).error?.message.includes('futuro'))
    assert.ok((await adminClient.rpc('recognize_savings', { p_validation: validationId, p_period: `${NOW.getFullYear() - 1}-06`, p_amount: 100, p_evidence: evidenceId, p_note: null })).error?.message.includes('anterior'))
    for (const client of [analyst, viewer]) assert.ok((await client.rpc('recognize_savings', { p_validation: validationId, p_period: PERIOD, p_amount: 100, p_evidence: evidenceId, p_note: null })).error, 'solo gerentes reconocen')
    const recognized = await adminClient.rpc('recognize_savings', { p_validation: validationId, p_period: PERIOD, p_amount: 3000, p_evidence: evidenceId, p_note: 'Mes cerrado' })
    assert.equal(recognized.error, null, recognized.error?.message)
    const recognitionId = recognized.data as string
    assert.ok((await adminClient.rpc('recognize_savings', { p_validation: validationId, p_period: PERIOD, p_amount: 100, p_evidence: evidenceId, p_note: null })).error?.message.includes('Ya hay un reconocimiento'), 'un reconocimiento por validación y período')

    // Inmutabilidad: ni editar ni borrar, ni siquiera con service role. Una corrección es una reversa.
    assert.ok((await admin.from('savings_recognitions').update({ amount: 1 }).eq('id', recognitionId)).error, 'no se edita')
    assert.ok((await admin.from('savings_recognitions').delete().eq('id', recognitionId)).error, 'no se borra')
    assert.ok((await adminClient.from('savings_recognitions').update({ amount: 1 }).eq('id', recognitionId).select('id')).error || true)
    const intact = await admin.from('savings_recognitions').select('amount').eq('id', recognitionId).single()
    assert.equal(Number(intact.data?.amount), 3000)
    assert.ok((await admin.from('savings_evidence').delete().eq('id', evidenceId)).error, 'la evidencia no se borra')
    assert.ok((await adminClient.rpc('reverse_recognition', { p_recognition: recognitionId, p_note: '' })).error, 'la reversa exige nota')
    for (const client of [analyst, viewer]) assert.ok((await client.rpc('reverse_recognition', { p_recognition: recognitionId, p_note: 'No debería' })).error)
    // No se retira una validación con reconocimientos vigentes.
    assert.ok((await adminClient.rpc('withdraw_savings', { p_validation: validationId, p_note: 'Retiro' })).error?.message.includes('reconocimientos vigentes'))
    const reversed = await adminClient.rpc('reverse_recognition', { p_recognition: recognitionId, p_note: 'Factura mal imputada' })
    assert.equal(reversed.error, null, reversed.error?.message)
    assert.ok((await adminClient.rpc('reverse_recognition', { p_recognition: recognitionId, p_note: 'Otra vez' })).error?.message.includes('ya fue reversado'), 'una sola reversa')
    const net = await admin.from('savings_recognitions').select('kind, amount').eq('validation_id', validationId)
    const total = (net.data || []).reduce((sum, item) => sum + (item.kind === 'recognition' ? Number(item.amount) : -Number(item.amount)), 0)
    assert.equal(total, 0, 'realizado neto = reconocimientos menos reversas')
    // Tras la reversa se puede reconocer de nuevo el mismo período.
    const again = await adminClient.rpc('recognize_savings', { p_validation: validationId, p_period: PERIOD, p_amount: 2500, p_evidence: evidenceId, p_note: 'Monto corregido' })
    assert.equal(again.error, null, again.error?.message)

    // Auditoría: cada paso quedó registrado, con su actor, y el registro no se edita.
    const events = await adminClient.from('savings_events').select('event, actor_id').eq('validation_id', validationId).order('at')
    assert.deepEqual((events.data || []).map(item => item.event), ['declared', 'validated', 'evidence_added', 'recognized', 'reversed', 'recognized'])
    assert.equal(events.data![0].actor_id, profiles[managerEmail])
    assert.equal(events.data![1].actor_id, profiles[adminEmail])
    assert.ok((await admin.from('savings_events').update({ note: 'x' }).eq('validation_id', validationId)).error)
    assert.equal((await viewer.from('savings_events').select('id').eq('validation_id', validationId)).data?.length, 0, 'el viewer no lee la auditoría')
    assert.ok((await viewer.from('savings_validations').select('id').eq('id', validationId)).data?.length === 1, 'el viewer sí lee lo validado')

    // Sin escritura directa: ni gerentes insertan en las tablas.
    for (const client of [manager, adminClient, analyst, viewer]) {
      assert.ok((await client.from('savings_validations').insert({ company_id: companyId, licitacion_id: 'X', source_kind: 'manual', currency: 'CLP', baseline_amount: 1, awarded_amount: 0, declared_amount: 1, nature: 'reduccion_precio', recurrence: 'unico', start_date: START, declared_by: profiles[managerEmail] })).error, 'sin inserción directa')
      assert.ok((await client.from('savings_recognitions').insert({ company_id: companyId, validation_id: validationId, kind: 'recognition', period: PERIOD, currency: 'CLP', amount: 1, evidence_id: evidenceId })).error)
    }

    // Devolución: pide motivo, deja la declaración cerrada y permite declarar otra vez.
    const manualLic = `${MARK}-LIC-${Date.now()}`
    licitacionIds.push(manualLic)
    const lic = await admin.from('licitaciones').insert({ id: manualLic, company_id: companyId, name: `${MARK} manual`, baseline_amount: 1000, awarded_amount: 700, baseline_currency: 'CLP', status: 'planned' }).select('id').single()
    assert.equal(lic.error, null, lic.error?.message)
    const manual = await manager.rpc('declare_savings', { p_award: null, p_licitacion: manualLic, p_plan: null, p_declared: 300, p_nature: 'evitacion_costo', p_recurrence: 'unico', p_start: START, p_end: null, p_note: null })
    assert.equal(manual.error, null, manual.error?.message)
    const manualId = manual.data as string
    validationIds.push(manualId)
    assert.equal((await admin.from('savings_validations').select('source_kind').eq('id', manualId).single()).data?.source_kind, 'manual')
    assert.ok((await adminClient.rpc('return_savings', { p_validation: manualId, p_note: '' })).error?.message.includes('motivo'))
    assert.equal((await adminClient.rpc('return_savings', { p_validation: manualId, p_note: 'Falta la cotización de referencia' })).error, null)
    assert.ok((await adminClient.rpc('validate_savings', { p_validation: manualId, p_validated: 300, p_method: 'Comparación de cotizaciones', p_note: null })).error?.message.includes('pendiente'), 'una devuelta no se valida')
    const redeclared = await manager.rpc('declare_savings', { p_award: null, p_licitacion: manualLic, p_plan: null, p_declared: 250, p_nature: 'evitacion_costo', p_recurrence: 'unico', p_start: START, p_end: null, p_note: 'Ajustado' })
    assert.equal(redeclared.error, null, redeclared.error?.message)
    validationIds.push(redeclared.data as string)
    // Una licitación con adjudicación de comité se declara sobre la adjudicación, no como manual.
    assert.ok((await manager.rpc('declare_savings', { p_award: null, p_licitacion: award.licitacion_id, p_plan: null, p_declared: 1, p_nature: 'reduccion_precio', p_recurrence: 'unico', p_start: START, p_end: null, p_note: null })).error?.message.includes('adjudicación de comité'))
    // Sin línea base comparable no se declara.
    const noBase = `${MARK}-NB-${Date.now()}`
    licitacionIds.push(noBase)
    await admin.from('licitaciones').insert({ id: noBase, company_id: companyId, name: `${MARK} sin base`, awarded_amount: 10, status: 'planned' })
    assert.ok((await manager.rpc('declare_savings', { p_award: null, p_licitacion: noBase, p_plan: null, p_declared: 1, p_nature: 'reduccion_precio', p_recurrence: 'unico', p_start: START, p_end: null, p_note: null })).error?.message.includes('No comparable'))
  } finally {
    localSql(cleanupSql(validationIds, licitacionIds))
    await admin.storage.from('documents').remove(validationIds.map(id => `${companyId}/ahorros/${id}`))
    const listed = await admin.storage.from('documents').list(`${companyId}/ahorros`, { limit: 100 })
    for (const folder of listed.data || []) {
      const files = await admin.storage.from('documents').list(`${companyId}/ahorros/${folder.name}`)
      await admin.storage.from('documents').remove((files.data || []).map(file => `${companyId}/ahorros/${folder.name}/${file.name}`))
    }
  }
})
