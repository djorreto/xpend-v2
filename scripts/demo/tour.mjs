// Recorrido de verificación de las vistas de gestión sobre los datos sembrados (no crea nada).
import { chromium } from 'playwright'
import { loadCredentials } from './common.mjs'
import { BASE, body, check, login, shot, summary } from './browser.mjs'

const creds = loadCredentials()
const browser = await chromium.launch({ headless: true })
try {
  // ---- Gerente ----
  const manager = await login(browser, creds.users.manager)
  const page = manager.page
  await page.goto(`${BASE}/gestion`, { waitUntil: 'networkidle' })
  await page.getByTestId('tile-cumplimiento').waitFor()
  let text = await body(page)
  check('gestion: cumplimiento visible', /Cumplimiento del plan/.test(text))
  check('gestion: iniciativa atrasada aparece en riesgo', /Licitación de transporte de carga/.test(await page.getByTestId('en-riesgo').innerText()))
  check('gestion: iniciativa bloqueada con causa', /espera a: Aprobador|Espera/.test(await page.getByTestId('en-riesgo').innerText()) || /Renovación de licencias/.test(await page.getByTestId('en-riesgo').innerText()))
  check('gestion: carga por persona', /Valentina Rojas/.test(await page.getByTestId('carga-personas').innerText()) && /Matías Soto/.test(await page.getByTestId('carga-personas').innerText()))
  check('gestion: huecos de asignación', /Sin responsable:\s*1/.test(await page.getByTestId('huecos').innerText()))
  const ahorros = await page.getByTestId('gestion-ahorros').innerText()
  check('gestion: validado anualizado CLP 11.400.000', /11,400,000/.test(ahorros), ahorros.replace(/\s+/g, ' ').slice(0, 160))
  check('gestion: realizado del año CLP 3.800.000', /3,800,000/.test(ahorros))
  check('gestion: meta CLP sumada por categoría', /158,400,000/.test(ahorros))
  check('gestion: matriz de etapas', /Mantenimiento industrial/.test(await page.getByTestId('matriz-etapas').innerText()))
  await shot(page, 'gestion-gerente')

  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  await page.getByText('Mi portafolio').first().waitFor()
  check('inicio gerente: Mi portafolio visible', true)

  await page.goto(`${BASE}/plan-anual`, { waitUntil: 'networkidle' })
  await page.getByTestId('estado-plan').waitFor()
  text = await body(page)
  check('plan-anual: comprometido', /Comprometido el/.test(await page.getByTestId('estado-plan').innerText()))
  check('plan-anual: categorías y metas', /Mantenimiento industrial/.test(text) && /Energía/.test(text))
  await shot(page, 'plan-anual')

  await page.goto(`${BASE}/equipos`, { waitUntil: 'networkidle' })
  await page.getByText('Equipo Operaciones').first().waitFor()
  await shot(page, 'equipos')
  check('equipos: equipos y categorías cargan', true)

  await page.goto(`${BASE}/ahorros`, { waitUntil: 'networkidle' })
  await page.getByTestId('resumen-ahorros').waitFor()
  text = await body(page)
  check('ahorros: resumen por moneda', /Ahorro \d{4} en CLP/.test(text))
  check('ahorros: sin declarar no se muestra como cero', !/Realizado en el año\s*\n?\s*\$?0\b/.test(text))
  await page.getByRole('tab', { name: /Validados/ }).click()
  const card = page.getByTestId('tarjeta-validado').first()
  await card.waitFor()
  const cardText = await card.innerText()
  check('ahorros: ahorro validado con evidencia y metodología', /comparacion-facturas-aseo\.txt/.test(cardText) && /Comparación de las facturas/.test(cardText))
  check('ahorros: 4 reconocimientos', /Reconocimientos \(4\)/.test(cardText))
  check('ahorros: marcado como manual', /Manual, no pasó por comité/.test(cardText))
  await shot(page, 'ahorros-validados')
  await page.getByRole('tab', { name: 'Auditoría' }).click()
  check('ahorros: auditoría registra los eventos', /Validado/.test(await page.getByTestId('auditoria-ahorros').innerText()))
  await manager.context.close()

  // ---- Compradora (analista) ----
  const buyer = await login(browser, creds.users.buyer1)
  await buyer.page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' })
  await buyer.page.getByTestId('mi-portafolio').waitFor()
  text = await buyer.page.getByTestId('mi-portafolio').innerText()
  check('comprador: Mi portafolio con sus categorías', /Mantenimiento industrial/.test(text) && /Tecnología y software/.test(text) && !/Energía/.test(await buyer.page.getByTestId('mis-categorias').innerText()))
  check('comprador: sus iniciativas', /Mantención de equipos críticos/.test(text))
  await shot(buyer.page, 'inicio-comprador')
  await buyer.page.goto(`${BASE}/gestion`, { waitUntil: 'networkidle' })
  check('comprador: no accede al panel de gestión', !/\/gestion/.test(buyer.page.url()))
  await buyer.context.close()

  // ---- Visualizador ----
  const viewer = await login(browser, creds.users.viewer)
  await viewer.page.goto(`${BASE}/ahorros`, { waitUntil: 'networkidle' })
  await viewer.page.getByTestId('resumen-ahorros').waitFor()
  check('visualizador: sin pestaña de auditoría', (await viewer.page.getByRole('tab', { name: 'Auditoría' }).count()) === 0)
  await viewer.page.getByRole('tab', { name: /Validados/ }).click()
  const viewerCard = await viewer.page.getByTestId('tarjeta-validado').first().innerText()
  check('visualizador: no ve evidencia ni formularios', !/comparacion-facturas/.test(viewerCard) && (await viewer.page.getByRole('button', { name: 'Reconocer mes' }).count()) === 0)
  await viewer.page.goto(`${BASE}/gestion`, { waitUntil: 'networkidle' })
  check('visualizador: no accede al panel de gestión', !/\/gestion/.test(viewer.page.url()))
  await viewer.context.close()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await browser.close()
}
summary()
