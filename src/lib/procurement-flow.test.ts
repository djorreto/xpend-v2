import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import * as flow from './procurement-flow.ts'
import {
  SAVINGS_LABELS,
  classifyLinkSavings,
  licitacionSavingsView,
  moneyListText,
  planSavings,
  realizedSavingsLabel,
  savingsByCurrency,
  toSavingsLinks,
  validatedSavingsLabel,
  type SavingsLink,
} from './procurement-flow.ts'

const committee = (estimated: number | null, currency = 'USD') => ({ estimated_savings: estimated, currency })

function link(partial: Partial<SavingsLink>): SavingsLink {
  return { plan_id: 'plan-1', licitacion_id: 'LIC-1', status: 'awarded', currency: 'USD', ...partial }
}

test('una adjudicación de comité es ahorro negociado, nunca realizado', () => {
  const result = classifyLinkSavings(link({ award: committee(5000), savings_amount: 5000 }))
  assert.deepEqual(result, { kind: 'negotiated', amount: 5000, currency: 'USD' })
  assert.equal(realizedSavingsLabel(), SAVINGS_LABELS.noInfo)
  assert.equal('realizedSavings' in flow, false)
})

test('adjudicada o con contrato firmado se clasifica igual: negociado, no realizado', () => {
  for (const status of ['awarded', 'contract_signed']) {
    const summary = planSavings(
      { id: 'plan-1', currency: 'USD', projected_savings_amount: 12000, actual_savings_amount: null },
      [link({ status, award: committee(3000) })]
    )
    assert.deepEqual(summary.negotiated, [{ currency: 'USD', amount: 3000 }])
    assert.deepEqual(summary.declared, [])
    assert.equal(summary.negotiatedVsTarget, 25)
  }
})

test('un ahorro tipeado en el formulario de la licitación es declarado aunque esté adjudicada o firmada', () => {
  for (const status of ['awarded', 'contract_signed']) {
    const result = classifyLinkSavings(link({ status, savings_amount: 9000, award: null }))
    assert.deepEqual(result, { kind: 'declared', amount: 9000, currency: 'USD' })
    const summary = planSavings({ id: 'plan-1', currency: 'USD' }, [link({ status, savings_amount: 9000 })])
    assert.deepEqual(summary.negotiated, [])
    assert.deepEqual(summary.declared, [{ currency: 'USD', amount: 9000 }])
    assert.equal(summary.negotiatedVsTarget, null)
  }
})

test('el ahorro tipeado en la iniciativa es declarado y no se suma al de la licitación', () => {
  const alone = planSavings(
    { id: 'plan-1', currency: 'CLP', actual_savings_amount: 700 },
    []
  )
  assert.deepEqual(alone.declared, [{ currency: 'CLP', amount: 700 }])
  assert.deepEqual(alone.negotiated, [])

  const both = planSavings(
    { id: 'plan-1', currency: 'USD', actual_savings_amount: 777 },
    [link({ savings_amount: 400 })]
  )
  assert.deepEqual(both.declared, [{ currency: 'USD', amount: 400 }])

  const withAward = planSavings(
    { id: 'plan-1', currency: 'USD', actual_savings_amount: 777 },
    [link({ award: committee(1000) })]
  )
  assert.deepEqual(withAward.negotiated, [{ currency: 'USD', amount: 1000 }])
  assert.deepEqual(withAward.declared, [{ currency: 'USD', amount: 777 }])
})

test('sin base comparable no hay ahorro negociado ni cero inventado', () => {
  const result = classifyLinkSavings(link({ award: committee(null), savings_amount: 4000 }))
  assert.deepEqual(result, { kind: 'none', reason: 'not_comparable' })
  const summary = planSavings({ id: 'plan-1', currency: 'USD' }, [link({ award: committee(null) })])
  assert.deepEqual(summary.negotiated, [])
  assert.equal(summary.withoutComparableBase, 1)
  assert.equal(moneyListText(summary.negotiated), 'Sin información')
})

test('sin ninguna medición se informa «Sin información», no cero', () => {
  const summary = planSavings({ id: 'plan-1', currency: 'USD' }, [])
  assert.equal(summary.target, null)
  assert.deepEqual(summary.negotiated, [])
  assert.deepEqual(summary.declared, [])
  assert.equal(summary.negotiatedVsTarget, null)
  assert.equal(validatedSavingsLabel(false), SAVINGS_LABELS.noInfo)
  assert.equal(
    savingsByCurrency([{ id: 'plan-1', currency: 'USD' }], []).length,
    0
  )
})

test('un ahorro negociado de cero es una medición y se conserva; el validado queda pendiente', () => {
  const summary = planSavings(
    { id: 'plan-1', currency: 'USD', projected_savings_amount: 12000 },
    [link({ award: committee(0) })]
  )
  assert.deepEqual(summary.negotiated, [{ currency: 'USD', amount: 0 }])
  assert.equal(summary.negotiatedVsTarget, 0)
  assert.equal(validatedSavingsLabel(true), SAVINGS_LABELS.pendingValidation)
})

test('el objetivo no se copia como negociado ni como realizado', () => {
  const rows = savingsByCurrency(
    [{ id: 'plan-1', currency: 'USD', projected_savings_amount: 12000 }],
    []
  )
  assert.deepEqual(rows, [
    { currency: 'USD', target: 12000, negotiated: null, declared: null, negotiatedVsTarget: null },
  ])
})

test('las monedas no se mezclan ni se convierten', () => {
  const rows = savingsByCurrency(
    [
      { id: 'a', currency: 'USD', projected_savings_amount: 1000 },
      { id: 'b', currency: 'CLP', projected_savings_amount: 500000 },
    ],
    [
      { plan_id: 'a', licitacion_id: 'L1', currency: 'USD', award: committee(250, 'USD') },
      { plan_id: 'b', licitacion_id: 'L2', currency: 'CLP', award: committee(100000, 'CLP') },
      { plan_id: 'b', licitacion_id: 'L3', currency: 'USD', award: committee(10, 'USD') },
    ]
  )
  const usd = rows.find(row => row.currency === 'USD')
  const clp = rows.find(row => row.currency === 'CLP')
  assert.equal(usd?.negotiated, 260)
  assert.equal(clp?.negotiated, 100000)
  assert.equal(clp?.negotiatedVsTarget, 20)
  assert.equal(usd?.negotiatedVsTarget, 26)
})

test('negociado sobre objetivo solo existe con objetivo y negociado en la moneda de la iniciativa', () => {
  const noTarget = planSavings({ id: 'plan-1', currency: 'USD' }, [link({ award: committee(100) })])
  assert.equal(noTarget.negotiatedVsTarget, null)
  const otherCurrency = planSavings(
    { id: 'plan-1', currency: 'CLP', projected_savings_amount: 1000 },
    [link({ currency: 'USD', award: committee(100, 'USD') })]
  )
  assert.equal(otherCurrency.negotiatedVsTarget, null)
})

test('la vista de una licitación nombra cada ahorro por su origen', () => {
  const negotiated = licitacionSavingsView({
    status: 'contract_signed',
    baseline_currency: 'USD',
    savings_amount: 800,
    savings_percentage: 8,
    award: [{ estimated_savings: 800, estimated_percentage: 8, currency: 'USD' }],
  })
  assert.deepEqual(negotiated, { kind: 'negotiated', amount: 800, percentage: 8, currency: 'USD' })

  const declared = licitacionSavingsView({
    status: 'awarded',
    baseline_currency: 'CLP',
    savings_amount: 120,
    savings_percentage: 12,
    award: null,
  })
  assert.deepEqual(declared, { kind: 'declared', amount: 120, percentage: 12, currency: 'CLP' })

  assert.deepEqual(licitacionSavingsView({ status: 'published' }), { kind: 'none', reason: 'no_amount' })
})

test('las filas con su adjudicación se leen igual como objeto o como lista', () => {
  const asObject = toSavingsLinks([
    { plan_id: 'p', licitacion: { id: 'L1', status: 'awarded', baseline_currency: 'USD', savings_amount: 5, award: { estimated_savings: 5, currency: 'USD' } } },
  ])
  const asList = toSavingsLinks([
    { plan_id: 'p', licitacion: [{ id: 'L1', status: 'awarded', baseline_currency: 'USD', savings_amount: 5, award: [{ estimated_savings: 5, currency: 'USD' }] }] },
  ])
  assert.deepEqual(asObject, asList)
  assert.equal(classifyLinkSavings(asObject[0]).kind, 'negotiated')
  assert.deepEqual(toSavingsLinks([{ plan_id: 'p', licitacion: null }]), [])
})

function sourceFiles(dir: string, found: string[] = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) sourceFiles(path, found)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) found.push(path)
  }
  return found
}

test('ninguna pantalla vuelve a llamar real o comprometido a un ahorro estimado o declarado', () => {
  const root = join(import.meta.dirname, '..')
  const forbidden: [RegExp, string][] = [
    [/\brealizedSavings\s*\(/, 'realizedSavings( ya no existe'],
    [/\bimport\s*{[^}]*\brealizedSavings\b[^}]*}/, 'importa realizedSavings'],
    [/Ahorro\s+(real|comprometido|registrado)\b/i, 'rótulo «Ahorro real/comprometido/registrado»'],
    [/ahorro\s+comprometido/i, 'texto «ahorro comprometido»'],
    [/\brow\.actual\b/, 'row.actual (campo retirado)'],
    [/\blic_savings_sum\b/, 'lic_savings_sum (suma de ahorros de cualquier estado)'],
    [/\bestimated_award_savings\b/, 'estimated_award_savings (campo retirado)'],
    [/>\s*Real\s*</, 'columna «Real» en tabla de ahorros'],
  ]
  const problems: string[] = []
  for (const file of sourceFiles(root)) {
    const text = readFileSync(file, 'utf8')
    for (const [pattern, reason] of forbidden) {
      if (pattern.test(text)) problems.push(`${file.replace(root, 'src')}: ${reason}`)
    }
  }
  assert.deepEqual(problems, [])
})

test('las pantallas con ahorro usan la clasificación común y no leen el ahorro tipeado como resultado', () => {
  const root = join(import.meta.dirname, '..')
  for (const file of [
    'app/sourcing-plan/page.tsx',
    'app/sourcing-plan/[id]/page.tsx',
    'app/dashboard/page.tsx',
    'app/comite/page.tsx',
    'app/licitaciones/page.tsx',
    'app/licitaciones/[id]/page.tsx',
    'app/reports/page.tsx',
  ]) {
    const text = readFileSync(join(root, file), 'utf8')
    assert.match(text, /procurement-flow/, `${file} debe usar procurement-flow`)
    assert.match(text, /SAVINGS_LABELS/, `${file} debe usar los rótulos comunes`)
    assert.match(text, /realizedSavingsLabel|licitacionSavingsView|planSavings/, `${file} debe usar la clasificación común`)
  }
})
