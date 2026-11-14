'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { supabaseBrowser } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { LoadingSpinner } from '@/components/ui/loading'
import { errorMessage } from '@/lib/errors'
import { formatCurrency } from '@/lib/utils'
import {
  evaluateBids,
  evaluationCsv,
  recommendationReport,
  weightsAreValid,
  type SupplierResult,
} from '@/lib/evaluation'
import { loadAppSession, type AppSession } from '@/lib/offer-room'

type Criterion = { id: string; name: string; kind: 'technical' | 'mandatory'; weight: number; threshold: number | null }
type BidRow = { supplier_id: string; amount: number; currency: string; technical_summary: string | null }
type LineRow = { supplier_id: string; description: string; quantity: number; unit: string; unit_price: number; currency: string }

export default function EvaluacionPage() {
  const params = useParams()
  const eventId = params.id as string
  const router = useRouter()
  const { addToast } = useToast()
  const [session, setSession] = useState<AppSession | null>(null)
  const [title, setTitle] = useState('')
  const [opened, setOpened] = useState(false)
  const [licitacionId, setLicitacionId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [evaluationId, setEvaluationId] = useState<string | null>(null)
  const [status, setStatus] = useState<'draft' | 'closed'>('draft')
  const [technicalWeight, setTechnicalWeight] = useState('60')
  const [economicWeight, setEconomicWeight] = useState('40')
  const [threshold, setThreshold] = useState('70')
  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [criterionName, setCriterionName] = useState('')
  const [criterionWeight, setCriterionWeight] = useState('50')
  const [criterionKind, setCriterionKind] = useState<'technical' | 'mandatory'>('technical')
  const [bids, setBids] = useState<BidRow[]>([])
  const [lines, setLines] = useState<LineRow[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [scores, setScores] = useState<Record<string, string>>({})
  const [comments, setComments] = useState<Record<string, string>>({})
  const [failed, setFailed] = useState<Record<string, boolean>>({})
  const [results, setResults] = useState<SupplierResult[]>([])
  const [technicalNote, setTechnicalNote] = useState('')
  const [economicNote, setEconomicNote] = useState('')
  const [report, setReport] = useState('')
  const [rfxHint, setRfxHint] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const appSession = await loadAppSession()
    if (!appSession || appSession.role === 'supplier') {
      router.push('/sala')
      return
    }
    setSession(appSession)
    const supabase = supabaseBrowser()
    const { data: event } = await supabase.from('offer_events').select('title, offers_opened_at, licitacion_id, company_id, status').eq('id', eventId).single()
    if (!event) {
      setLoading(false)
      return
    }
    setTitle(event.title)
    setOpened(Boolean(event.offers_opened_at))
    setLicitacionId(event.licitacion_id)
    setCompanyId(event.company_id)
    if (event.licitacion_id) {
      const { data: dossier } = await supabase
        .from('procurement_dossiers')
        .select('rfx_project_id')
        .eq('licitacion_id', event.licitacion_id)
        .limit(1)
        .maybeSingle()
      if (dossier?.rfx_project_id) {
        const { data: rfx } = await supabase
          .from('rfx_projects')
          .select('admin_parameters')
          .eq('id', dossier.rfx_project_id)
          .maybeSingle()
        const params = (rfx?.admin_parameters || null) as { ponderacion?: unknown } | null
        const written = params?.ponderacion
        setRfxHint(typeof written === 'string' ? written.trim() : '')
      }
    }
    if (!event.offers_opened_at) {
      setLoading(false)
      return
    }
    const { data: evaluation } = await supabase.from('evaluations').select('*').eq('event_id', eventId).maybeSingle()
    if (evaluation) {
      setEvaluationId(evaluation.id)
      setStatus(evaluation.status)
      setTechnicalWeight(String(evaluation.technical_weight))
      setEconomicWeight(String(evaluation.economic_weight))
      setThreshold(evaluation.technical_threshold == null ? '' : String(evaluation.technical_threshold))
      const { data: criterionRows } = await supabase.from('evaluation_criteria').select('*').eq('evaluation_id', evaluation.id).order('sort_order')
      setCriteria((criterionRows || []) as Criterion[])
      const { data: scoreRows } = await supabase.from('evaluation_scores').select('*').in('criterion_id', (criterionRows || []).map(row => row.id).concat(['00000000-0000-4000-8000-000000000000']))
      const nextScores: Record<string, string> = {}
      const nextComments: Record<string, string> = {}
      const nextFailed: Record<string, boolean> = {}
      for (const row of scoreRows || []) {
        const key = `${row.criterion_id}:${row.supplier_id}`
        if (row.score != null) nextScores[key] = String(row.score)
        if (row.comment) nextComments[key] = row.comment
        nextFailed[key] = row.failed_mandatory
      }
      setScores(nextScores)
      setComments(nextComments)
      setFailed(nextFailed)
      const { data: stored } = await supabase.from('evaluation_results').select('*').eq('evaluation_id', evaluation.id)
      setResults((stored || []).map(row => ({
        supplierId: row.supplier_id,
        technicalScore: row.technical_score,
        economicScore: row.economic_score,
        finalScore: row.final_score,
        qualified: row.qualified,
        exclusionReason: row.exclusion_reason,
        totalAmount: Number(row.total_amount),
        currency: row.currency,
        lowBidAlert: row.low_bid_alert,
        scopeAlert: row.scope_alert,
        rank: row.rank,
        breakdown: row.parameters?.breakdown || [],
      })))
      const { data: recommendation } = await supabase.from('award_recommendations').select('report_text').eq('evaluation_id', evaluation.id).order('created_at', { ascending: false }).limit(1)
      setReport(recommendation?.[0]?.report_text || '')
    }
    const { data: bidRows } = await supabase.from('offer_bids').select('supplier_id, amount, currency, technical_summary').eq('event_id', eventId).eq('status', 'submitted')
    setBids((bidRows || []) as BidRow[])
    const { data: lineRows } = await supabase.from('offer_bid_lines').select('supplier_id, description, quantity, unit, unit_price, currency').eq('event_id', eventId)
    setLines((lineRows || []) as LineRow[])
    const { data: suppliers } = await supabase.from('suppliers').select('id, fantasy_name').eq('company_id', event.company_id)
    setNames(Object.fromEntries((suppliers || []).map(item => [item.id, item.fantasy_name])))
    setLoading(false)
  }, [eventId, router])

  useEffect(() => { load() }, [load])

  const ensureEvaluation = async () => {
    if (evaluationId) return evaluationId
    if (!companyId || !session) throw new Error('Falta la sesión')
    const technical = Number(technicalWeight)
    const economic = Number(economicWeight)
    const { data, error } = await supabaseBrowser().from('evaluations').insert({
      company_id: companyId,
      event_id: eventId,
      licitacion_id: licitacionId,
      technical_weight: technical,
      economic_weight: economic,
      technical_threshold: threshold === '' ? null : Number(threshold),
      economic_formula: 'lowest_qualified_price',
      price_basis: 'as_bid',
      created_by: session.userId,
    }).select('id').single()
    if (error) throw error
    setEvaluationId(data.id)
    return data.id as string
  }

  const saveWeights = async () => {
    try {
      const id = await ensureEvaluation()
      const { error } = await supabaseBrowser().from('evaluations').update({
        technical_weight: Number(technicalWeight),
        economic_weight: Number(economicWeight),
        technical_threshold: threshold === '' ? null : Number(threshold),
      }).eq('id', id)
      if (error) throw error
      addToast({ type: 'success', title: 'Modelo guardado', message: 'Las ponderaciones quedaron en la evaluación.' })
    } catch (error) {
      addToast({ type: 'error', title: 'No se guardó', message: errorMessage(error, 'Revisa que técnica y económica sumen 100.') })
    }
  }

  const addCriterion = async () => {
    try {
      const id = await ensureEvaluation()
      const { error } = await supabaseBrowser().from('evaluation_criteria').insert({
        evaluation_id: id,
        name: criterionName.trim(),
        kind: criterionKind,
        weight: criterionKind === 'mandatory' ? 0 : Number(criterionWeight),
        sort_order: criteria.length + 1,
      })
      if (error) throw error
      setCriterionName('')
      load()
    } catch (error) {
      addToast({ type: 'error', title: 'No se agregó', message: errorMessage(error, 'No se pudo agregar el criterio.') })
    }
  }

  const calculate = async (close: boolean) => {
    if (!evaluationId || !session) return
    if (!weightsAreValid(criteria)) {
      addToast({ type: 'error', title: 'Pesos inválidos', message: 'Los criterios técnicos deben sumar 100.' })
      return
    }
    const lineCount = new Map<string, number>()
    for (const line of lines) lineCount.set(line.supplier_id, (lineCount.get(line.supplier_id) || 0) + 1)
    let computed: SupplierResult[]
    try {
      computed = evaluateBids({
        technicalWeight: Number(technicalWeight),
        economicWeight: Number(economicWeight),
        technicalThreshold: threshold === '' ? null : Number(threshold),
        scaleMax: 100,
        criteria: criteria.map(item => ({ id: item.id, name: item.name, kind: item.kind, weight: Number(item.weight), threshold: item.threshold })),
        scores: criteria.flatMap(criterion => bids.map(bid => {
          const key = `${criterion.id}:${bid.supplier_id}`
          return {
            criterionId: criterion.id,
            supplierId: bid.supplier_id,
            evaluatorId: session.userId,
            score: scores[key] === undefined || scores[key] === '' ? null : Number(scores[key]),
            failedMandatory: Boolean(failed[key]),
          }
        })),
        bids: bids.map(bid => ({ supplierId: bid.supplier_id, amount: Number(bid.amount), currency: bid.currency, lineCount: lineCount.get(bid.supplier_id) || 0 })),
      })
    } catch (error) {
      addToast({ type: 'error', title: 'No se calculó', message: errorMessage(error, 'La evaluación no se pudo calcular.') })
      return
    }
    const supabase = supabaseBrowser()
    for (const criterion of criteria) {
      for (const bid of bids) {
        const key = `${criterion.id}:${bid.supplier_id}`
        const { error } = await supabase.from('evaluation_scores').upsert({
          criterion_id: criterion.id,
          supplier_id: bid.supplier_id,
          evaluator_id: session.userId,
          score: scores[key] === undefined || scores[key] === '' ? null : Number(scores[key]),
          failed_mandatory: Boolean(failed[key]),
          comment: comments[key] || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'criterion_id,supplier_id,evaluator_id' })
        if (error) {
          addToast({ type: 'error', title: 'No se guardó el puntaje', message: error.message })
          return
        }
      }
    }
    await supabase.from('evaluation_results').delete().eq('evaluation_id', evaluationId)
    const { error } = await supabase.from('evaluation_results').insert(computed.map(item => ({
      evaluation_id: evaluationId,
      supplier_id: item.supplierId,
      technical_score: item.technicalScore,
      economic_score: item.economicScore,
      final_score: item.finalScore,
      qualified: item.qualified,
      exclusion_reason: item.exclusionReason,
      total_amount: item.totalAmount,
      currency: item.currency,
      low_bid_alert: item.lowBidAlert,
      scope_alert: item.scopeAlert,
      rank: item.rank,
      parameters: {
        formula: 'menor total habilitado / total de la oferta × 100',
        technicalWeight: Number(technicalWeight),
        economicWeight: Number(economicWeight),
        threshold: threshold === '' ? null : Number(threshold),
        breakdown: item.breakdown,
      },
    })))
    if (error) {
      addToast({ type: 'error', title: 'No se guardó la matriz', message: error.message })
      return
    }
    if (close) {
      const { error: closeError } = await supabase.from('evaluations').update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        closed_by: session.userId,
      }).eq('id', evaluationId)
      if (closeError) {
        addToast({ type: 'error', title: 'No se cerró', message: closeError.message })
        return
      }
      await supabase.from('offer_audit').insert({
        company_id: companyId,
        event_id: eventId,
        actor_id: session.userId,
        action: 'evaluation_closed',
        detail: 'Evaluación cerrada. No adjudica.',
      }).then(() => undefined, () => undefined)
    }
    setResults(computed)
    addToast({ type: 'success', title: close ? 'Evaluación cerrada' : 'Matriz guardada', message: 'Los puntajes quedaron persistidos.' })
    load()
  }

  const recommend = async (supplierId: string) => {
    if (!evaluationId || !session || !companyId) return
    const winner = results.find(item => item.supplierId === supplierId)
    const lowest = Math.min(...results.filter(item => item.qualified).map(item => item.totalAmount))
    const notLowest = winner != null && winner.totalAmount > lowest
    const text = recommendationReport({
      title,
      supplierName: names[supplierId] || supplierId,
      technicalNote,
      economicNote,
      notLowest,
      results,
      names,
      technicalWeight: Number(technicalWeight),
      economicWeight: Number(economicWeight),
    })
    const { error } = await supabaseBrowser().from('award_recommendations').insert({
      evaluation_id: evaluationId,
      event_id: eventId,
      licitacion_id: licitacionId,
      company_id: companyId,
      supplier_id: supplierId,
      technical_note: technicalNote,
      economic_note: economicNote,
      not_lowest_price: notLowest,
      report_text: text,
      prepared_by: session.userId,
    })
    if (error) {
      addToast({ type: 'error', title: 'No se guardó', message: error.message })
      return
    }
    await supabaseBrowser().from('offer_audit').insert({
      company_id: companyId,
      event_id: eventId,
      supplier_id: supplierId,
      actor_id: session.userId,
      action: 'recommendation_prepared',
      detail: `Recomendación para ${names[supplierId] || supplierId}. No adjudica.`,
    })
    setReport(text)
    addToast({ type: 'success', title: 'Recomendación lista', message: 'Quedó en el expediente. La licitación no se adjudicó.' })
  }

  const reopen = async () => {
    if (!evaluationId || !session || !companyId) return
    const { error } = await supabaseBrowser().from('evaluations').update({
      status: 'draft',
      closed_at: null,
      closed_by: null,
    }).eq('id', evaluationId)
    if (error) {
      addToast({ type: 'error', title: 'No se reabrió', message: error.message })
      return
    }
    await supabaseBrowser().from('offer_audit').insert({
      company_id: companyId,
      event_id: eventId,
      actor_id: session.userId,
      action: 'evaluation_reopened',
      detail: 'Reapertura excepcional. Los criterios ya puntuados siguen bloqueados. No adjudica.',
    })
    addToast({ type: 'success', title: 'Evaluación reabierta', message: 'Se puede corregir un puntaje. Los criterios no cambian.' })
    load()
  }

  const downloadCsv = () => {
    const blob = new Blob([evaluationCsv(results, names)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'matriz-evaluacion.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  if (loading || !session) return <MainLayout><LoadingSpinner /></MainLayout>
  if (!opened) {
    return (
      <MainLayout user={{ name: session.name, email: session.email, role: session.role }}>
        <p className="text-sm">La evaluación empieza cuando los sobres están abiertos.</p>
      </MainLayout>
    )
  }

  return (
    <MainLayout user={{ name: session.name, email: session.email, role: session.role }} companyName={session.companyName}>
      <div className="space-y-5">
        <Button variant="outline" onClick={() => router.push(`/sala/${eventId}`)}>Volver a la sala</Button>
        <div>
          <h1>Evaluación · {title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Estado: {status === 'closed' ? 'cerrada' : 'borrador'}. Recomendar no adjudica. Los montos se comparan como fueron ofertados, sin convertir moneda. ANA no asigna puntajes ni adjudica.</p>
          {status === 'closed' && <Button variant="outline" onClick={reopen}>Reabrir evaluación</Button>}
        </div>

        <Card>
          <CardHeader><CardTitle>Modelo</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div><Label>Peso técnico %</Label><Input id="technical-weight" value={technicalWeight} onChange={event => setTechnicalWeight(event.target.value)} /></div>
            <div><Label>Peso económico %</Label><Input id="economic-weight" value={economicWeight} onChange={event => setEconomicWeight(event.target.value)} /></div>
            <div><Label>Umbral técnico</Label><Input id="threshold" value={threshold} onChange={event => setThreshold(event.target.value)} /></div>
            {status === 'draft' && <Button onClick={saveWeights}>Guardar modelo</Button>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Criterios</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {rfxHint && <p className="text-sm">Texto de evaluación del RFx: {rfxHint}</p>}
            {criteria.map(item => (
              <p key={item.id} className="text-sm">{item.name} · {item.kind === 'mandatory' ? 'excluyente' : `técnico ${item.weight}%`}</p>
            ))}
            {status === 'draft' && (
              <div className="grid gap-2 md:grid-cols-4">
                <Input id="criterion-name" placeholder="Nombre del criterio" value={criterionName} onChange={event => setCriterionName(event.target.value)} />
                <Input id="criterion-weight" type="number" value={criterionWeight} onChange={event => setCriterionWeight(event.target.value)} />
                <select className="rounded-md border bg-background p-2" value={criterionKind} onChange={event => setCriterionKind(event.target.value as 'technical' | 'mandatory')}>
                  <option value="technical">Técnico</option>
                  <option value="mandatory">Excluyente</option>
                </select>
                <Button type="button" onClick={addCriterion}>Agregar criterio</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Partidas</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {lines.map((line, index) => (
              <p key={index}>{names[line.supplier_id] || line.supplier_id}: {line.description} · {line.quantity} {line.unit} · {formatCurrency(Number(line.unit_price), line.currency)}</p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Puntajes</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {bids.map(bid => (
              <div key={bid.supplier_id} className="space-y-2">
                <p className="font-medium">{names[bid.supplier_id] || bid.supplier_id} · {formatCurrency(Number(bid.amount), bid.currency)}</p>
                <p className="text-sm text-muted-foreground">{bid.technical_summary}</p>
                {criteria.map(criterion => {
                  const key = `${criterion.id}:${bid.supplier_id}`
                  return (
                    <div key={key} className="grid gap-2 md:grid-cols-3">
                      <span className="text-sm">{criterion.name}</span>
                      {criterion.kind === 'mandatory' ? (
                        <label className="text-sm"><input type="checkbox" checked={Boolean(failed[key])} onChange={event => setFailed(prev => ({ ...prev, [key]: event.target.checked }))} /> Incumple</label>
                      ) : (
                        <Input type="number" value={scores[key] || ''} onChange={event => setScores(prev => ({ ...prev, [key]: event.target.value }))} placeholder="0 a 100" />
                      )}
                      <Input value={comments[key] || ''} onChange={event => setComments(prev => ({ ...prev, [key]: event.target.value }))} placeholder="Justificación" />
                    </div>
                  )
                })}
              </div>
            ))}
            {status === 'draft' && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => calculate(false)}>Guardar matriz</Button>
                <Button onClick={() => calculate(true)}>Cerrar evaluación</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {results.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Matriz</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {results.map(item => (
                <p key={item.supplierId}>
                  {item.rank ? `${item.rank}. ` : ''}{names[item.supplierId] || item.supplierId}: técnico {item.technicalScore ?? '—'}, económico {item.economicScore ?? '—'}, final {item.finalScore ?? '—'}
                  {item.exclusionReason ? `. ${item.exclusionReason}` : ''}{item.lowBidAlert ? '. Alerta de precio bajo' : ''}{item.scopeAlert ? '. Partidas incompletas' : ''}
                </p>
              ))}
              <Button variant="outline" onClick={downloadCsv}>Exportar CSV</Button>
            </CardContent>
          </Card>
        )}

        {status === 'closed' && (
          <Card>
            <CardHeader><CardTitle>Recomendación</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={technicalNote} onChange={event => setTechnicalNote(event.target.value)} placeholder="Justificación técnica" />
              <Textarea value={economicNote} onChange={event => setEconomicNote(event.target.value)} placeholder="Justificación económica" />
              <div className="flex flex-wrap gap-2">
                {results.filter(item => item.qualified).map(item => (
                  <Button key={item.supplierId} variant="outline" onClick={() => recommend(item.supplierId)}>
                    Recomendar {names[item.supplierId] || item.supplierId}
                  </Button>
                ))}
              </div>
              {report && <pre className="whitespace-pre-wrap text-sm">{report}</pre>}
              {report && <Button variant="outline" onClick={() => router.push(`/sala/${eventId}/decision`)}>Preparar comité</Button>}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}
