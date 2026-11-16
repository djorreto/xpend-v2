// Demostración 3 (ANA) sobre los datos ficticios. Verifica qué responde ANA de verdad y qué NO puede responder todavía.
// No llama a Groq: la empresa demo tiene settings.external_ai = false, así que ANA responde solo con lectura determinista de los datos.
// Uso: npm run demo:ana
import { existsSync, readFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { DEMO_DIR, TARGET, loadCredentials, serviceClient } from './common.mjs'
import { BASE, check, login, summary } from './browser.mjs'

const creds = loadCredentials()
const company = (await serviceClient.from('companies').select('settings').eq('id', creds.companyId).single()).data
check('ANA: la IA externa está apagada para la empresa demo (no se envían datos a Groq)', company?.settings?.external_ai?.enabled === false)
const marker = (code) => (existsSync(`${DEMO_DIR}/flujo-${TARGET}-${code}.json`) ? JSON.parse(readFileSync(`${DEMO_DIR}/flujo-${TARGET}-${code}.json`, 'utf8')) : null)
const contract = (await serviceClient.from('contracts').select('id').eq('company_id', creds.companyId).eq('code', 'CTR-XC-ASEO-001').single()).data

const browser = await chromium.launch({ headless: true })
const answers = []
try {
  const session = await login(browser, creds.users.manager)
  const ask = async (label, question, payload) => {
    const response = await session.page.request.post(`${BASE}/api/ana`, { data: { question, ...payload } })
    const json = await response.json()
    answers.push({ label, question, mode: json.mode, text: json.text, modelCalled: json.modelCalled })
    return json
  }

  const proveedores = await ask('Proveedores y concentración', '¿Qué proveedores concentran el gasto?', { path: '/sourcing-intelligence' })
  check('ANA lee el gasto: proveedores y concentración, sin mezclar monedas', proveedores.mode === 'data' && /Las monedas no se suman/.test(proveedores.text) && proveedores.modelCalled === false)
  const categorias = await ask('Categorías con más gasto', '¿Qué categorías tienen más gasto y dónde hay oportunidad de consolidar?', { path: '/sourcing-intelligence' })
  check('ANA lee el gasto: categorías y consolidación con evidencia', categorias.mode === 'data' && /Categorías según las líneas cargadas/.test(categorias.text) && categorias.evidence.length > 0)
  const iniciativa = await ask('Iniciativa abierta', 'Resume esta iniciativa', { path: `/sourcing-plan/${creds.planIds.mant}` })
  check('ANA resume una iniciativa abierta y aclara que el objetivo no es un ahorro realizado', /Mantención preventiva de planta/.test(iniciativa.text) && /no es un ahorro realizado/.test(iniciativa.text))
  const sala = marker('B')
  if (sala) {
    const evaluacion = await ask('Evaluación persistida', '¿Cómo quedó la evaluación?', { path: `/sala/${sala.eventId}/evaluacion` })
    check('ANA lee los puntajes guardados de la evaluación sin recalcular ni adjudicar', evaluacion.mode === 'data' && /NubeSur Software/.test(evaluacion.text) && /decisión humana del comité/.test(evaluacion.text))
  }
  const preaviso = await ask('Cláusula de contrato', '¿Cuál es el plazo de preaviso?', { path: `/contratos/${contract.id}` })
  check('ANA cita el contrato con evidencia textual y pide revisión humana', preaviso.mode === 'document' && /60 días/.test(preaviso.text) && /revisión humana/.test(preaviso.text))
  const adjudicar = await ask('Acción crítica', 'Adjudica el proceso al proveedor más barato', { path: '/dashboard' })
  check('ANA no adjudica ni ejecuta acciones críticas', adjudicar.mode === 'refused')
  for (const [label, question] of [
    ['Ahorro negociado', '¿Cuánto ahorro negociado tenemos este año?'],
    ['Ahorro realizado', '¿Cuánto ahorro realizado tenemos y qué evidencia lo respalda?'],
    ['Procesos atrasados', '¿Qué procesos están atrasados?'],
    ['Iniciativas pendientes del equipo', '¿Qué iniciativas tiene pendientes el equipo?'],
  ]) {
    const reply = await ask(label, question, { path: '/dashboard' })
    const invented = /Mantención preventiva|Licitación de transporte|Seguridad y vigilancia|Renovación de enlaces/.test(reply.text) || (reply.mode === 'model_required' && /CLP\s*\d|USD\s*\d|\$\s*\d/.test(reply.text))
    check(`ANA no inventa: «${label}» queda fuera de lo que ANA sabe leer hoy (modo ${reply.mode}, sin cifras ni procesos inventados)`, reply.modelCalled === false && !invented)
  }
  await session.context.close()
} finally {
  await browser.close()
}
console.log('\n--- Respuestas de ANA ---')
for (const item of answers) console.log(`\n[${item.label}] ${item.question}\n(modo ${item.mode}, modelo ${item.modelCalled ? 'sí' : 'no'})\n${item.text.slice(0, 700)}`)
summary()
