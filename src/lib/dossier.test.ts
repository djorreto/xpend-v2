import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { awardSavings } from './procurement-flow.ts'
import { buyerCanReadForeignBid, licitacionSeedFromPlan, salaSeedFromDossier } from './dossier.ts'
import { advanceStage, canOpenOpportunity, composeBases, pilotPathComplete, publishedParagraph } from './dossier-store.ts'

test('la licitación hereda título, gasto y moneda de la iniciativa', () => {
  const seed = licitacionSeedFromPlan({
    title: 'Monitores de PC para el holding',
    description: 'Reposición anual',
    category: 'Tecnología',
    estimated_spend: 12000000,
    currency: 'clp',
    initiative_type: 'licitacion',
  })
  assert.equal(seed.name, 'Monitores de PC para el holding')
  assert.equal(seed.baselineAmount, '12000000')
  assert.equal(seed.currency, 'CLP')
  assert.equal(seed.category, 'Tecnología')
  assert.equal(seed.type, 'RFQ')
})

test('la sala hereda el proceso y, si no hay, la iniciativa', () => {
  const fromProcess = salaSeedFromDossier({
    plan: { title: 'Iniciativa', currency: 'USD', estimated_spend: 10 },
    licitacion: { name: 'Licitación monitores', baseline_currency: 'CLP', baseline_amount: 90 },
  })
  assert.equal(fromProcess.title, 'Licitación monitores')
  assert.equal(fromProcess.currency, 'CLP')
  assert.equal(fromProcess.baselineAmount, 90)

  const fromPlan = salaSeedFromDossier({ plan: { title: 'Solo iniciativa', currency: 'pen' } })
  assert.equal(fromPlan.title, 'Solo iniciativa')
  assert.equal(fromPlan.currency, 'PEN')
})

test('adjudicar calcula el ahorro que ve el comité', () => {
  const result = awardSavings(1000, 800)
  assert.equal(result.savings_amount, 200)
  assert.equal(result.savings_percentage, 20)
  assert.equal(awardSavings(null, 800).savings_amount, null)
})

test('un sobre cerrado abierto no muestra la oferta ajena', () => {
  assert.equal(buyerCanReadForeignBid({ modality: 'sealed', eventStatus: 'open' }), false)
  assert.equal(buyerCanReadForeignBid({ modality: 'sealed', eventStatus: 'closed' }), true)
  assert.equal(buyerCanReadForeignBid({ modality: 'reverse_auction', eventStatus: 'open' }), true)
  assert.equal(buyerCanReadForeignBid({ modality: 'rounds', eventStatus: 'open', roundStatus: 'open' }), false)
  assert.equal(buyerCanReadForeignBid({ modality: 'rounds', eventStatus: 'open', roundStatus: 'closed' }), true)
})

test('la política de ofertas y la invitación coinciden con esa regla', () => {
  const sql = fs.readFileSync(new URL('../../database/migrations/v3-sala-de-ofertas.sql', import.meta.url), 'utf8')
  assert.match(sql, /supplier_id = public\.my_supplier_id\(\)/)
  assert.match(sql, /e\.status IN \('closed', 'awarded'\)/)
  assert.equal(sql.includes("modality = 'sealed' AND e.status = 'open'"), false)

  const invite = fs.readFileSync(new URL('../app/api/sala/invite/route.ts', import.meta.url), 'utf8')
  assert.equal(invite.includes('No creo usuarios proveedores'), false)
  assert.match(invite, /event\.company_id !== profile\.company_id/)

  const sala = fs.readFileSync(new URL('../app/sala/[id]/page.tsx', import.meta.url), 'utf8')
  assert.match(sala, /awardSavings\(/)
  assert.match(sala, /saveDossier\(/)
  assert.equal(sala.includes('recordApproval'), false)

  const created = fs.readFileSync(new URL('../app/licitaciones/new/page.tsx', import.meta.url), 'utf8')
  assert.match(created, /licitacionSeedFromPlan\(/)
  assert.match(created, /sourcing_plan_licitaciones/)
  assert.match(created, /saveDossier\(/)
  assert.match(created, /licitacionDocumentPath\(/)
  assert.equal(created.includes('recordApproval'), false)

  const edited = fs.readFileSync(new URL('../app/licitaciones/[id]/edit/page.tsx', import.meta.url), 'utf8')
  assert.match(edited, /syncPlanFromLicitacion\(/)
  assert.equal(edited.includes('recordApproval'), false)

  const processRoute = fs.readFileSync(new URL('../app/api/process/route.ts', import.meta.url), 'utf8')
  assert.match(processRoute, /action === 'award'/)
  assert.match(processRoute, /appendProcessEvent\(/)
  assert.equal(processRoute.includes('validated: true'), false)

  const approval = fs.readFileSync(
    new URL('../../supabase/migrations/20261113212213_fase_0_stabilization_security_documents.sql', import.meta.url),
    'utf8'
  )
  assert.match(approval, /create trigger record_licitacion_approval/)
  assert.match(approval, /after insert or update of status on public\.licitaciones/)
  assert.match(approval, /target_status is not distinct from previous_status/)
  assert.match(approval, /sync_offer_award_to_licitacion/)
  assert.equal(approval.includes('savings_amount'), false)

  const list = fs.readFileSync(new URL('../app/sala/page.tsx', import.meta.url), 'utf8')
  assert.match(list, /offer_invitations/)
  assert.match(list, /appSession\.supplierId/)

  const dossiers = fs.readFileSync(new URL('../../database/migrations/v3-procurement-dossiers.sql', import.meta.url), 'utf8')
  assert.match(dossiers, /company_id IN \(SELECT company_id FROM public\.profiles/)
  assert.match(dossiers, /<> 'supplier'/)
})

test('las respuestas se vuelven bases y un párrafo editado se publica', () => {
  const bases = composeBases({
    title: 'Monitores',
    technical: [{ question: 'Alcance', answer: 'Entrega en 30 días en Santiago.' }],
    administrative: [{ question: 'Pago', answer: '30 días factura.' }],
  })
  const edited = bases.technical.replace('30 días', '45 días hábiles')
  const published = `${edited}\n\n${bases.administrative}`
  assert.equal(publishedParagraph(published, '45 días hábiles'), true)
  assert.equal(publishedParagraph(published, '30 días factura'), true)
})

test('sin país confirmado no se abre la oportunidad', () => {
  assert.equal(canOpenOpportunity([{ decisions_confirmed: false }]), false)
  assert.equal(canOpenOpportunity([{ decisions_confirmed: true }]), true)
  assert.equal(advanceStage('iniciativa', 'bases'), 'bases')
  assert.equal(advanceStage('sala', 'bases'), 'sala')
})

test('el piloto está completo solo con el hilo y el ahorro', () => {
  assert.equal(pilotPathComplete({
    sourcing_plan_id: 'p',
    rfx_project_id: 'r',
    licitacion_id: 'l',
    offer_event_id: 's',
    currency: 'CLP',
    net_spend: 100,
    award: { amount: 80, savings_amount: 20 },
  }), true)
  assert.equal(pilotPathComplete({ sourcing_plan_id: 'p' }), false)
})
