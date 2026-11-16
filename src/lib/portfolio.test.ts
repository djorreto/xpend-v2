import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assignmentGaps,
  describeHistory,
  effectiveOwner,
  filterByScope,
  suggestCategoryLinks,
  workloadByPerson,
  type Category,
  type CategoryAssignment,
  type PlanLike,
} from './portfolio.ts'

const cat = (id: string, name: string, extra: Partial<Category> = {}): Category => ({ id, name, parent_id: null, source: 'manual', taxonomy_ref: null, is_active: true, ...extra })
const assignments: Record<string, CategoryAssignment> = {
  c1: { category_id: 'c1', manager_user_id: 'ana', backup_user_id: 'beto', team_id: 't1' },
  c2: { category_id: 'c2', manager_user_id: null, backup_user_id: null, team_id: null },
}

test('la sugerencia de categoría solo es exacta con el mismo nombre y deja lo ambiguo a una persona', () => {
  const categories = [cat('c1', 'Mantenimiento industrial'), cat('c2', 'Mantenimiento'), cat('c3', 'Logística')]
  const plans: PlanLike[] = [
    { id: 'p1', category: '  mantenimiento   INDUSTRIAL ' },
    { id: 'p2', category: 'Mantenimiento de flota' },
    { id: 'p3', category: 'Tecnología' },
    { id: 'p4', category: '' },
    { id: 'p5', category: 'Logística', category_id: 'c3' },
  ]
  const result = suggestCategoryLinks(plans, categories)
  assert.deepEqual(result.find(item => item.planId === 'p1'), { kind: 'exact', planId: 'p1', categoryId: 'c1' })
  const ambiguous = result.find(item => item.planId === 'p2')
  assert.equal(ambiguous?.kind, 'ambiguous')
  assert.equal(result.find(item => item.planId === 'p3')?.kind, 'unmatched')
  assert.equal(result.find(item => item.planId === 'p4')?.kind, 'unmatched')
  assert.equal(result.some(item => item.planId === 'p5'), false, 'lo ya vinculado no se vuelve a sugerir')
})

test('una categoría inactiva no se sugiere', () => {
  const result = suggestCategoryLinks([{ id: 'p1', category: 'Logística' }], [cat('c3', 'Logística', { is_active: false })])
  assert.equal(result[0].kind, 'unmatched')
})

test('el responsable efectivo es el de la iniciativa y, si no hay, el Category Manager de su categoría', () => {
  assert.deepEqual(effectiveOwner({ id: 'p', responsible_user_id: 'carla', category_id: 'c1' }, assignments), { userId: 'carla', source: 'iniciativa' })
  assert.deepEqual(effectiveOwner({ id: 'p', category_id: 'c1' }, assignments), { userId: 'ana', source: 'categoria' })
  assert.deepEqual(effectiveOwner({ id: 'p', category_id: 'c2' }, assignments), { userId: null, source: 'sin_responsable' })
  assert.deepEqual(effectiveOwner({ id: 'p' }, new Map()), { userId: null, source: 'sin_responsable' })
})

test('los filtros Mi portafolio, Equipo y Área no ocultan nada cuando no se filtra', () => {
  const plans: PlanLike[] = [
    { id: 'a', responsible_user_id: 'ana', department_id: 'd1' },
    { id: 'b', category_id: 'c1', department_id: 'd2' },
    { id: 'c', backup_user_id: 'ana', team_id: 't2' },
    { id: 'd', department_id: 'd1' },
  ]
  const ctx = { userId: 'ana', teamIds: ['t1'], areaId: 'd1', assignments }
  assert.equal(filterByScope(plans, 'all', ctx).length, 4)
  assert.deepEqual(filterByScope(plans, 'mine', ctx).map(plan => plan.id), ['a', 'b', 'c'])
  assert.deepEqual(filterByScope(plans, 'team', ctx).map(plan => plan.id), ['b'], 'el equipo se hereda de la categoría')
  assert.deepEqual(filterByScope(plans, 'area', ctx).map(plan => plan.id), ['a', 'd'])
  assert.deepEqual(filterByScope(plans, 'area', { ...ctx, areaId: null }), [])
})

test('los huecos de asignación ignoran iniciativas cerradas y consideran al Category Manager', () => {
  const plans: PlanLike[] = [
    { id: 'a', status: 'planned' },
    { id: 'b', status: 'in_progress', category_id: 'c1' },
    { id: 'c', status: 'completed' },
    { id: 'd', status: 'cancelled' },
    { id: 'e', status: 'planned', responsible_user_id: 'ana', backup_user_id: 'beto', category_id: 'c2' },
  ]
  const gaps = assignmentGaps(plans, assignments)
  assert.deepEqual(gaps.withoutOwner.map(plan => plan.id), ['a'])
  assert.deepEqual(gaps.withoutCategory.map(plan => plan.id), ['a'])
  assert.deepEqual(gaps.withoutBackup.map(plan => plan.id), ['a'], 'b tiene suplente por su categoría')
})

test('la carga por persona cuenta responsable efectivo y suplente, sin cerradas', () => {
  const rows = workloadByPerson([
    { id: 'a', category_id: 'c1', status: 'planned' },
    { id: 'b', responsible_user_id: 'ana', status: 'planned' },
    { id: 'c', responsible_user_id: 'carla', backup_user_id: 'ana', status: 'planned' },
    { id: 'd', responsible_user_id: 'carla', status: 'completed' },
  ], assignments)
  const byUser = Object.fromEntries(rows.map(row => [row.userId, row]))
  assert.equal(byUser.ana.initiatives, 2)
  assert.equal(byUser.ana.asBackup, 1)
  assert.equal(byUser.carla.initiatives, 1)
  assert.equal(byUser.beto.asBackup, 1)
})

test('el historial se lee como asignación o reasignación con su motivo', () => {
  const names = { u1: 'Ana', u2: 'Beto' }
  const base = { id: 'h', entity_type: 'initiative', entity_id: 'p', role_kind: 'responsible', changed_by: null, changed_at: '2026-11-17' } as const
  assert.equal(describeHistory({ ...base, from_value: null, to_value: 'u1', reason: null }, names), 'Responsable asignado: Sin asignar → Ana')
  assert.equal(describeHistory({ ...base, from_value: 'u1', to_value: 'u2', reason: 'Licencia' }, names), 'Responsable reasignado: Ana → Beto (Licencia)')
  assert.match(describeHistory({ ...base, from_value: 'zz', to_value: null, reason: null }, names), /Valor eliminado/)
})
