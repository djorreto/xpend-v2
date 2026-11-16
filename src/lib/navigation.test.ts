import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import {
  CAPABILITY_ROLES,
  NAV_SECTIONS,
  activeNav,
  breadcrumbsFor,
  can,
  navigationFor,
  roleLabel,
} from './navigation.ts'
import { dossierHref, dossierNextStep, type Dossier } from './dossier-store.ts'

const appDir = join(import.meta.dirname, '..', 'app')
const read = (path: string) => readFileSync(join(import.meta.dirname, '..', path), 'utf8')
const labels = (role: string) => navigationFor(role, { invoices: true }).map(section => section.label)

test('cada entrada del menú abre una página que existe', () => {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      const path = item.href.split('?')[0]
      assert.ok(existsSync(join(appDir, path, 'page.tsx')), `${item.label} -> ${path}`)
    }
  }
})

test('el menú agrupa los módulos en seis secciones con nombres comprensibles', () => {
  assert.deepEqual(labels('admin'), ['Inicio', 'Abastecimiento', 'Inteligencia de gasto', 'Contratos', 'Proveedores', 'Administración'])
  const all = NAV_SECTIONS.flatMap(section => section.items.map(item => item.label))
  assert.ok(all.includes('Cierre mensual de gasto'))
  assert.ok(!all.includes('Comité'))
  assert.ok(!all.some(label => /Sourcing Intelligence|Spend Analysis|Dashboard/.test(label)))
  const procesos = NAV_SECTIONS.flatMap(section => section.items).find(item => item.id === 'procesos')
  assert.deepEqual(procesos?.match, ['/procesos', '/rfx-maker', '/licitaciones', '/sala'])
})

test('cada rol ve solo lo que puede usar', () => {
  assert.deepEqual(labels('analyst'), ['Inicio', 'Abastecimiento', 'Inteligencia de gasto', 'Contratos', 'Proveedores'])
  assert.deepEqual(labels('manager'), ['Inicio', 'Abastecimiento', 'Inteligencia de gasto', 'Contratos', 'Proveedores'])
  assert.deepEqual(labels('viewer'), ['Inicio', 'Abastecimiento', 'Proveedores'])
  assert.deepEqual(labels(''), [])

  const items = (role: string) => navigationFor(role).flatMap(section => section.items.map(item => item.id))
  assert.ok(!items('viewer').includes('nuevo-proveedor'))
  assert.ok(!items('analyst').includes('nuevo-proveedor'))
  assert.ok(items('manager').includes('nuevo-proveedor'))
  assert.ok(items('analyst').includes('redactar'))
  assert.ok(!items('admin').includes('super-admin'))
  assert.ok(items('super_admin').includes('super-admin'))
  assert.ok(!items('admin').includes('facturas'), 'facturas solo con la bandera')
})

test('el proveedor queda en su portal, sin gasto, plan, ahorros ni contratos', () => {
  const nav = navigationFor('supplier', { invoices: true })
  const hrefs = nav.flatMap(section => section.items.map(item => item.href))
  assert.deepEqual(hrefs, ['/sala'])
  assert.equal(nav[0].label, 'Mis procesos')
  for (const capability of Object.keys(CAPABILITY_ROLES) as (keyof typeof CAPABILITY_ROLES)[]) {
    assert.equal(can('supplier', capability), false, capability)
  }
})

test('los permisos del menú reflejan las políticas de la base, sin ampliarlas', () => {
  assert.equal(can('analyst', 'createLicitacion'), false)
  assert.equal(can('analyst', 'createInitiative'), false)
  assert.equal(can('analyst', 'openSala'), false)
  assert.equal(can('analyst', 'writeSuppliers'), false)
  assert.equal(can('analyst', 'createRfx'), true)
  assert.equal(can('analyst', 'writeContracts'), true)
  assert.equal(can('viewer', 'readSpend'), false)
  assert.equal(can('viewer', 'readContracts'), false)
  assert.equal(can('viewer', 'createRfx'), false)
  assert.equal(can('manager', 'administer'), false)
  assert.equal(can('admin', 'administer'), true)
  assert.equal(can(undefined, 'readSpend'), false)
  assert.equal(roleLabel('analyst'), 'Comprador')
})

test('la ruta activa y las migas de pan siguen la nueva jerarquía', () => {
  assert.equal(activeNav('/licitaciones/LIC-1/edit')?.item.id, 'procesos')
  assert.equal(activeNav('/sala/abc/decision')?.section.id, 'abastecimiento')
  assert.equal(activeNav('/contratos/builder')?.item.id, 'redactar')
  assert.equal(activeNav('/contratos', undefined, '?vista=pendientes')?.item.id, 'pendientes')
  assert.equal(activeNav('/contratos/123')?.item.id, 'repositorio')
  assert.equal(activeNav('/comite')?.item.label, 'Cierre mensual de gasto')
  assert.equal(activeNav('/suppliers/new')?.item.id, 'nuevo-proveedor')

  assert.deepEqual(breadcrumbsFor('/dashboard'), [])
  assert.deepEqual(
    breadcrumbsFor('/licitaciones/LIC-1/edit').map(crumb => crumb.label),
    ['Abastecimiento', 'Procesos', 'Licitaciones', 'Detalle', 'Editar']
  )
  const crumbs = breadcrumbsFor('/licitaciones/LIC-1/edit')
  assert.equal(crumbs[3].href, '/licitaciones/LIC-1')
  assert.equal(crumbs[crumbs.length - 1].href, undefined)
  assert.deepEqual(
    breadcrumbsFor('/sourcing-intelligence/u1/classify').map(crumb => crumb.label),
    ['Inteligencia de gasto', 'Clasificación y categorías', 'Detalle', 'Clasificar']
  )
  assert.deepEqual(breadcrumbsFor('/comite').map(crumb => crumb.label), ['Inteligencia de gasto', 'Cierre mensual de gasto'])
})

test('el expediente adjudicado lleva a Adjudicaciones, no al cierre mensual de gasto', () => {
  const dossier = { id: 'd', company_id: 'c', title: 't', stage: 'adjudicada' } as Dossier
  assert.equal(dossierHref(dossier, 'adjudicada'), '/adjudicaciones')
  assert.equal(dossierNextStep(dossier)?.href, '/adjudicaciones')
  const bases = { ...dossier, stage: 'bases', rfx_project_id: 'r1', sourcing_plan_id: 'p1' } as Dossier
  assert.equal(dossierNextStep(bases)?.href, '/licitaciones/new?rfxId=r1&planId=p1')
  assert.equal(dossierNextStep(bases)?.capability, 'createLicitacion')
  assert.equal(dossierNextStep({ ...dossier, stage: 'oportunidad' } as Dossier), null)
})

test('la interfaz usa la navegación central y las páginas internas expulsan al proveedor', () => {
  const sidebar = read('components/layout/sidebar.tsx')
  assert.match(sidebar, /navigationFor\(/)
  assert.doesNotMatch(sidebar, /href: '\/(comite|spend|licitaciones)'/)
  for (const page of ['app/dashboard/page.tsx', 'app/procesos/page.tsx', 'app/adjudicaciones/page.tsx', 'app/oportunidades/page.tsx', 'app/administracion/roles/page.tsx']) {
    assert.match(read(page), /router\.replace\('\/sala'\)/, page)
  }
  const topbar = read('components/layout/topbar.tsx')
  assert.match(topbar, /\/procesos\?q=/)
  assert.doesNotMatch(topbar, /<span>Perfil<\/span>/)
})

test('el Inicio no simula indicadores que todavía no existen', () => {
  const inicio = read('app/dashboard/page.tsx')
  assert.doesNotMatch(inicio, /MonthlyTrendChart|data=\{\[\]\}/)
  assert.doesNotMatch(inicio, /meta anual|atrasad[oa]s? del plan|hito comprometido/i)
  // Los ahorros del Inicio vienen del tablero de gestión, que usa la clasificación común (savings.ts) y nunca el ahorro tipeado.
  assert.match(inicio, /ManagementDashboard/)
  assert.doesNotMatch(inicio, /realized_savings|actual_savings_amount\s*\)/)
  const management = read('components/management-dashboard.tsx')
  assert.match(management, /summarizeSavings/)
  assert.doesNotMatch(management, /realized_savings|actual_savings_amount\s*\)/)
})
