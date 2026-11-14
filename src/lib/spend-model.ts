import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { Assessment } from '@/lib/spend-assessment'
import { supabaseAdmin } from '@/lib/supabase'

type ModelClass = {
  family: string
  name: string
  strategy: string
  intercept: number
  w: Array<[number, number]>
}

type PackedModel = {
  name: string
  trained_at: string
  ngram_range: [number, number]
  sublinear_tf: boolean
  vocab: string[]
  idf: number[]
  classes: ModelClass[]
  metrics?: { holdout20?: number }
}

const MODEL_PATH = join(process.cwd(), 'data', 'xpend-taxonomia-v1.json')
const TOKEN = /[a-z0-9]{2,}/g
const ACCEPT = 0.2
const HIGH = 0.52

type ReadyClass = ModelClass & { coef: Map<number, number> }

type ReadyModel = {
  index: Map<string, number>
  model: PackedModel
  classes: ReadyClass[]
}

const packedByName = new Map<string, ReadyModel>()
let activeName = ''
let activeCheckedAt = 0
const ACTIVE_TTL_MS = 30_000

function fold(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function ngrams(text: string) {
  const tokens = fold(text).match(TOKEN) || []
  const out = [...tokens]
  for (let i = 0; i < tokens.length - 1; i++) out.push(`${tokens[i]} ${tokens[i + 1]}`)
  return out
}

function packModel(model: PackedModel): ReadyModel {
  return {
    model,
    index: new Map(model.vocab.map((token, i) => [token, i])),
    classes: model.classes.map(item => ({ ...item, coef: new Map(item.w) })),
  }
}

function loadFileModel(): ReadyModel | null {
  if (packedByName.has('archivo')) return packedByName.get('archivo') || null
  if (!existsSync(MODEL_PATH)) return null
  const packed = packModel(JSON.parse(readFileSync(MODEL_PATH, 'utf8')) as PackedModel)
  packedByName.set('archivo', packed)
  packedByName.set(packed.model.name, packed)
  return packed
}

export function forgetSpendModel() {
  activeName = ''
  activeCheckedAt = 0
}

async function activeNameFromDatabase() {
  if (!supabaseAdmin) return null
  const { data, error } = await supabaseAdmin
    .from('si_model_versions')
    .select('name')
    .eq('is_active', true)
    .limit(1)
  if (error || !data?.length) return null
  return data[0].name as string
}

async function payloadFromDatabase(name: string) {
  if (!supabaseAdmin) return null
  const { data, error } = await supabaseAdmin
    .from('si_model_versions')
    .select('payload')
    .eq('name', name)
    .limit(1)
  if (error || !data?.[0]?.payload) return null
  return data[0].payload as PackedModel
}

export async function loadOperatingModel(): Promise<ReadyModel | null> {
  const now = Date.now()
  if (!activeName || now - activeCheckedAt > ACTIVE_TTL_MS) {
    activeCheckedAt = now
    const fromDb = await activeNameFromDatabase()
    if (fromDb) activeName = fromDb
  }
  if (activeName && packedByName.has(activeName)) return packedByName.get(activeName) || null
  if (activeName) {
    const payload = await payloadFromDatabase(activeName)
    if (payload) {
      const packed = packModel(payload)
      packedByName.set(activeName, packed)
      return packed
    }
  }
  return loadFileModel()
}

function vectorize(text: string, packed: ReadyModel) {
  const counts = new Map<number, number>()
  for (const gram of ngrams(text)) {
    const i = packed.index.get(gram)
    if (i == null) continue
    counts.set(i, (counts.get(i) || 0) + 1)
  }
  const values: Array<[number, number]> = []
  let norm = 0
  counts.forEach((tf, i) => {
    const weighted = (packed.model.sublinear_tf ? 1 + Math.log(tf) : tf) * packed.model.idf[i]
    values.push([i, weighted])
    norm += weighted * weighted
  })
  const scale = norm > 0 ? 1 / Math.sqrt(norm) : 1
  return values.map(([i, v]) => [i, v * scale] as [number, number])
}

export async function trainedModelInfo() {
  const packed = await loadOperatingModel()
  if (!packed) return null
  return {
    name: packed.model.name,
    trained_at: packed.model.trained_at,
    classes: packed.model.classes.length,
    holdout: packed.model.metrics?.holdout20 ?? null,
    source: activeName ? 'database' : 'archivo',
  }
}

export async function predictSpendModel(description: string): Promise<Assessment | null> {
  const packed = await loadOperatingModel()
  if (!packed || !description.trim()) return null
  const x = vectorize(description, packed)
  if (x.length === 0) return null

  const scores = packed.classes.map(item => {
    let score = item.intercept
    for (const [i, v] of x) {
      const w = item.coef.get(i)
      if (w) score += w * v
    }
    return score
  })
  const max = Math.max(...scores)
  const exps = scores.map(score => Math.exp(score - max))
  const sum = exps.reduce((a, b) => a + b, 0)
  const probs = exps.map(value => value / sum)
  let best = 0
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i
  const confidence = probs[best]
  if (confidence < ACCEPT) return null
  const hit = packed.classes[best]
  return {
    category: hit.family,
    subcategory: hit.name,
    confidence: Number(confidence.toFixed(4)),
    justification: `El modelo propio (${packed.model.name}) propone esta categoría.`,
    suggested_strategy: hit.strategy,
    source: 'modelo',
  }
}

export function modelNeedsReview(confidence: number) {
  return confidence < HIGH
}
