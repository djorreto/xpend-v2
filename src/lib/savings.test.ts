import assert from 'node:assert/strict'
import test from 'node:test'
import {
  activeMonthsInYear,
  awardNegotiated,
  calendarImpact,
  canValidate,
  netRecognized,
  pendingDeclarations,
  summarizeSavings,
  targetsByOwner,
  type AwardLite,
  type RecognitionLite,
  type ValidationLite,
} from './savings.ts'

const award = (extra: Partial<AwardLite> = {}): AwardLite => ({
  id: 'a1', licitacion_id: 'L1', currency: 'CLP', amount: 800, baseline_amount: 1000, baseline_currency: 'CLP', estimated_savings: 200, awarded_at: '2026-03-10T00:00:00Z', ...extra,
})
const validation = (extra: Partial<ValidationLite> = {}): ValidationLite => ({
  id: 'v1', award_id: 'a1', licitacion_id: 'L1', sourcing_plan_id: null, category_id: 'c1', owner_user_id: 'u1', team_id: null, source_kind: 'comite', currency: 'CLP',
  baseline_amount: 1000, awarded_amount: 800, declared_amount: 200, nature: 'reduccion_precio', recurrence: 'unico', start_date: '2026-04-01', end_date: null,
  validated_amount: null, status: 'declared', declared_by: 'u1', validated_by: null, ...extra,
})
const rec = (extra: Partial<RecognitionLite>): RecognitionLite => ({ id: Math.random().toString(), validation_id: 'v1', kind: 'recognition', period: '2026-04', currency: 'CLP', amount: 100, ...extra })

test('el negociado solo es comparable con línea base y adjudicado en la misma moneda', () => {
  assert.deepEqual(awardNegotiated(award()), { comparable: true, amount: 200, currency: 'CLP', baseline: 1000 })
  assert.equal(awardNegotiated(award({ baseline_currency: 'USD' })).comparable, false)
  assert.equal(awardNegotiated(award({ baseline_amount: null })).comparable, false)
  assert.equal(awardNegotiated(award({ currency: null })).comparable, false)
  assert.deepEqual(awardNegotiated(award({ amount: 1200 })), { comparable: true, amount: 0, currency: 'CLP', baseline: 1000 }, 'adjudicar sobre la base no es ahorro negativo')
})

test('un negociado sin validación no aparece como validado ni como realizado', () => {
  const rows = summarizeSavings({ year: 2026, awards: [award()], validations: [], recognitions: [], targets: [{ currency: 'CLP', target_amount: 500 }] })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].negotiated, 200)
  assert.equal(rows[0].target, 500)
  assert.equal(rows[0].baseline, 1000)
  assert.equal(rows[0].validatedAnnualized, null)
  assert.equal(rows[0].validatedYear, null)
  assert.equal(rows[0].realizedYear, null, 'sin información, no cero')
})

test('una declaración pendiente no es validada: queda como pendiente de validación', () => {
  const [row] = summarizeSavings({ year: 2026, awards: [award()], validations: [validation()], recognitions: [], targets: [] })
  assert.equal(row.pendingValidation, 200)
  assert.equal(row.validatedAnnualized, null)
  assert.equal(row.realizedYear, null)
})

test('anualizado, impacto del año calendario y realizado son tres cifras distintas', () => {
  const recurring = validation({ recurrence: 'recurrente', start_date: '2026-10-01', end_date: '2027-09-30', validated_amount: 1200, status: 'validated', validated_by: 'u2' })
  assert.equal(activeMonthsInYear(recurring, 2026), 3)
  assert.equal(activeMonthsInYear(recurring, 2027), 9)
  assert.equal(activeMonthsInYear(recurring, 2028), 0)
  assert.equal(calendarImpact(recurring, 2026), 300)
  assert.equal(calendarImpact(recurring, 2027), 900)
  const recognitions = [rec({ period: '2026-10', amount: 100 }), rec({ period: '2026-11', amount: 100 })]
  const [row] = summarizeSavings({ year: 2026, awards: [], validations: [recurring], recognitions, targets: [] })
  assert.equal(row.validatedAnnualized, 1200)
  assert.equal(row.validatedYear, 300)
  assert.equal(row.realizedYear, 200)
  const [next] = summarizeSavings({ year: 2027, awards: [], validations: [recurring], recognitions, targets: [] })
  assert.equal(next.validatedAnnualized, 1200)
  assert.equal(next.realizedYear, null, 'validado en 2027 sin reconocimientos aún: sin información, no cero')
})

test('un ahorro único cuenta en el año de inicio y no se anualiza dos veces', () => {
  const single = validation({ validated_amount: 150, status: 'validated', validated_by: 'u2' })
  assert.equal(calendarImpact(single, 2026), 150)
  assert.equal(calendarImpact(single, 2027), 0)
  assert.equal(calendarImpact(validation({ status: 'declared' }), 2026), null)
})

test('las reversas restan y el realizado neto nunca cuenta dos veces un período corregido', () => {
  const first = rec({ id: 'r1', period: '2026-04', amount: 100 })
  const reversal = rec({ id: 'r2', kind: 'reversal', period: '2026-04', amount: 100, reverses_id: 'r1' })
  const again = rec({ id: 'r3', period: '2026-04', amount: 80 })
  assert.equal(netRecognized([first]), 100)
  assert.equal(netRecognized([first, reversal]), 0)
  assert.equal(netRecognized([first, reversal, again]), 80)
  assert.equal(netRecognized([first, reversal, again], { year: 2025 }), 0)
})

test('reducción de precio y evitación de costo se muestran por separado', () => {
  const price = validation({ id: 'p', validated_amount: 100, status: 'validated', validated_by: 'u2' })
  const avoidance = validation({ id: 'c', award_id: 'a2', nature: 'evitacion_costo', validated_amount: 500, status: 'validated', validated_by: 'u2' })
  const [row] = summarizeSavings({ year: 2026, awards: [], validations: [price, avoidance], recognitions: [rec({ validation_id: 'p', amount: 100 }), rec({ validation_id: 'c', amount: 500 })], targets: [] })
  assert.equal(row.validatedAnnualized, 100)
  assert.equal(row.realizedYear, 100)
  assert.equal(row.costAvoidance.validatedAnnualized, 500)
  assert.equal(row.costAvoidance.realizedYear, 500)
})

test('las monedas no se mezclan ni se convierten', () => {
  const rows = summarizeSavings({
    year: 2026,
    awards: [award(), award({ id: 'a2', currency: 'USD', baseline_currency: 'USD', amount: 90, baseline_amount: 100 })],
    validations: [],
    recognitions: [],
    targets: [{ currency: 'CLP', target_amount: 10 }, { currency: 'USD', target_amount: 5 }],
  })
  assert.deepEqual(rows.map(item => [item.currency, item.negotiated, item.target]), [['CLP', 200, 10], ['USD', 10, 5]])
})

test('el filtro por categoría, persona o equipo no duplica ni pierde montos', () => {
  const a = validation({ id: 'a', category_id: 'c1', owner_user_id: 'u1', validated_amount: 100, status: 'validated', validated_by: 'u2' })
  const b = validation({ id: 'b', award_id: 'a9', category_id: 'c2', owner_user_id: 'u3', team_id: 't1', validated_amount: 40, status: 'validated', validated_by: 'u2' })
  const all = summarizeSavings({ year: 2026, awards: [], validations: [a, b], recognitions: [], targets: [] })[0]
  const c1 = summarizeSavings({ year: 2026, awards: [], validations: [a, b], recognitions: [], targets: [], scope: { categoryId: 'c1' } })[0]
  const c2 = summarizeSavings({ year: 2026, awards: [], validations: [a, b], recognitions: [], targets: [], scope: { categoryId: 'c2' } })[0]
  assert.equal(all.validatedAnnualized, 140)
  assert.equal((c1.validatedAnnualized ?? 0) + (c2.validatedAnnualized ?? 0), 140)
  assert.equal(summarizeSavings({ year: 2026, awards: [], validations: [a, b], recognitions: [], targets: [], scope: { teamId: 't1' } })[0].validatedAnnualized, 40)
  assert.equal(summarizeSavings({ year: 2026, awards: [], validations: [a, b], recognitions: [], targets: [], scope: { ownerId: 'nadie' } }).length, 0)
})

test('el negociado manual se suma una sola vez y las declaraciones devueltas no cuentan', () => {
  const manual = validation({ id: 'm', award_id: null, source_kind: 'manual', status: 'declared' })
  const returned = validation({ id: 'r', award_id: null, source_kind: 'manual', status: 'returned' })
  const [row] = summarizeSavings({ year: 2026, awards: [], validations: [manual, returned], recognitions: [], targets: [] })
  assert.equal(row.negotiated, 200)
})

test('las metas por responsable cuentan cada línea una sola vez', () => {
  const owners = targetsByOwner([
    { category_id: 'c1', currency: 'CLP', target_amount: 100, owner_user_id: null },
    { category_id: 'c2', currency: 'CLP', target_amount: 50, owner_user_id: 'u9' },
    { category_id: 'c3', currency: 'CLP', target_amount: null, owner_user_id: 'u9' },
    { category_id: 'c4', currency: 'USD', target_amount: 7, owner_user_id: null },
  ], { c1: 'u1', c4: null })
  const total = owners.filter(item => item.currency === 'CLP').reduce((sum, item) => sum + item.target, 0)
  assert.equal(total, 150)
  assert.deepEqual(owners.find(item => item.ownerId === 'u1'), { ownerId: 'u1', currency: 'CLP', target: 100 })
  assert.ok(owners.some(item => item.ownerId === null && item.currency === 'USD'), 'sin responsable es visible, no se pierde')
})

test('pendientes de declarar: solo negociado comparable, positivo y sin declaración activa', () => {
  const awards = [award(), award({ id: 'a2', amount: 1000 }), award({ id: 'a3', baseline_currency: 'USD' }), award({ id: 'a4' })]
  const validations = [validation({ award_id: 'a4', status: 'declared' }), validation({ id: 'x', award_id: 'a1', status: 'returned' })]
  assert.deepEqual(pendingDeclarations(awards, validations).map(item => item.awardId), ['a1'], 'a1 solo tiene una declaración devuelta')
})

test('quien declara no valida y solo gerentes o administradores validan', () => {
  assert.equal(canValidate({ declared_by: 'u1', status: 'declared' }, 'u1', 'manager'), false)
  assert.equal(canValidate({ declared_by: 'u1', status: 'declared' }, 'u2', 'manager'), true)
  assert.equal(canValidate({ declared_by: 'u1', status: 'declared' }, 'u2', 'analyst'), false)
  assert.equal(canValidate({ declared_by: 'u1', status: 'declared' }, 'u2', 'viewer'), false)
  assert.equal(canValidate({ declared_by: 'u1', status: 'validated' }, 'u2', 'admin'), false)
})

test('un reconocimiento totalmente reversado es un cero medido, no un dato ausente', () => {
  const v = validation({ validated_amount: 100, status: 'validated', validated_by: 'u2' })
  const [row] = summarizeSavings({ year: 2026, awards: [], validations: [v], recognitions: [rec({ id: 'r1', amount: 100 }), rec({ id: 'r2', kind: 'reversal', reverses_id: 'r1', amount: 100 })], targets: [] })
  assert.equal(row.realizedYear, 0)
})
