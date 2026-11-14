'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { LoadingSpinner } from '@/components/ui/loading'
import { useToast } from '@/components/ui/toast'
import { supabaseBrowser } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import { formatCurrency } from '@/lib/utils'
import { loadAppSession, type AppSession } from '@/lib/offer-room'
import { estimateAwardSavings, executiveReport, type PacketSnapshot, type SavingsVerdict } from '@/lib/award'

type Policy = {
  mode: 'individual' | 'committee'
  required_approvals: number
  allow_self_approval: boolean
  approver_roles: string[]
}

type PacketRow = {
  id: string
  version: number
  status: string
  snapshot: PacketSnapshot
  risks: string | null
  exceptions: string | null
  observations: string | null
  prepared_by: string
  supersedes_id: string | null
}

type DecisionRow = {
  id: string
  packet_id: string
  outcome: string
  recommended_supplier_id: string
  approved_supplier_id: string | null
  justification: string | null
  different_supplier: boolean
  different_supplier_justification: string | null
}

type VoteRow = { id: string; decision_id: string; voter_role: string; vote: string; comment: string | null; self_approval_exception: boolean; created_at: string }

export default function DecisionPage() {
  const params = useParams()
  const eventId = params.id as string
  const router = useRouter()
  const { addToast } = useToast()
  const [session, setSession] = useState<AppSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<PacketSnapshot | null>(null)
  const [policy, setPolicy] = useState<Policy>({ mode: 'individual', required_approvals: 1, allow_self_approval: false, approver_roles: ['admin', 'manager'] })
  const [packets, setPackets] = useState<PacketRow[]>([])
  const [decisions, setDecisions] = useState<DecisionRow[]>([])
  const [votes, setVotes] = useState<VoteRow[]>([])
  const [awardId, setAwardId] = useState<string | null>(null)
  const [risks, setRisks] = useState('')
  const [exceptions, setExceptions] = useState('')
  const [observations, setObservations] = useState('')
  const [comment, setComment] = useState('')
  const [conditions, setConditions] = useState('')
  const [chosenSupplier, setChosenSupplier] = useState('')
  const [approverName, setApproverName] = useState('')
  const [approverEmail, setApproverEmail] = useState('')
  const [approverPassword, setApproverPassword] = useState('')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const appSession = await loadAppSession()
    if (!appSession || appSession.role === 'supplier') {
      router.push('/sala')
      return
    }
    setSession(appSession)
    const supabase = supabaseBrowser()
    const { data: event } = await supabase.from('offer_events').select('*').eq('id', eventId).single()
    if (!event?.offers_opened_at || !event.licitacion_id) {
      setLoading(false)
      return
    }
    setCompanyId(event.company_id)
    const [{ data: lic }, { data: links }, { data: evaluation }, { data: policyRow }, { data: packetRows }, { data: award }] = await Promise.all([
      supabase.from('licitaciones').select('*').eq('id', event.licitacion_id).single(),
      supabase.from('sourcing_plan_licitaciones').select('plan_id').eq('licitacion_id', event.licitacion_id).limit(1),
      supabase.from('evaluations').select('*').eq('event_id', eventId).maybeSingle(),
      supabase.from('award_policies').select('*').eq('company_id', event.company_id).maybeSingle(),
      supabase.from('decision_packets').select('*').eq('event_id', eventId).order('version'),
      supabase.from('process_awards').select('id').eq('event_id', eventId).maybeSingle(),
    ])
    if (policyRow) {
      setPolicy({
        mode: policyRow.mode,
        required_approvals: policyRow.required_approvals,
        allow_self_approval: policyRow.allow_self_approval,
        approver_roles: policyRow.approver_roles,
      })
    }
    setPackets((packetRows || []) as PacketRow[])
    setAwardId(award?.id || null)
    const packetIds = (packetRows || []).map(row => row.id)
    if (packetIds.length) {
      const { data: decisionRows } = await supabase.from('award_decisions').select('*').in('packet_id', packetIds)
      setDecisions((decisionRows || []) as DecisionRow[])
      const decisionIds = (decisionRows || []).map(row => row.id)
      if (decisionIds.length) {
        const { data: voteRows } = await supabase.from('award_votes').select('*').in('decision_id', decisionIds).order('created_at')
        setVotes((voteRows || []) as VoteRow[])
      }
    }
    const planId = links?.[0]?.plan_id
    const [{ data: plan }, { data: dossier }, { data: suppliers }, { data: invites }, { data: bids }, { data: lines }, { data: files }] = await Promise.all([
      planId ? supabase.from('sourcing_plans').select('id, title, estimated_spend, projected_savings_amount, currency').eq('id', planId).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('procurement_dossiers').select('rfx_project_id').eq('licitacion_id', event.licitacion_id).limit(1).maybeSingle(),
      supabase.from('suppliers').select('id, fantasy_name').eq('company_id', event.company_id),
      supabase.from('offer_invitations').select('supplier_id, status').eq('event_id', eventId),
      supabase.from('offer_bids').select('supplier_id, amount, currency, technical_summary, status').eq('event_id', eventId).eq('status', 'submitted'),
      supabase.from('offer_bid_lines').select('supplier_id, description, quantity, unit, unit_price').eq('event_id', eventId),
      supabase.from('offer_bid_files').select('supplier_id, file_name, kind').eq('event_id', eventId),
    ])
    const nameMap = Object.fromEntries((suppliers || []).map(item => [item.id, item.fantasy_name]))
    setNames(nameMap)
    let objective = lic?.description || lic?.name || event.title
    let scope = lic?.description || event.title
    if (dossier?.rfx_project_id) {
      const { data: rfx } = await supabase.from('rfx_projects').select('admin_parameters').eq('id', dossier.rfx_project_id).maybeSingle()
      const params = (rfx?.admin_parameters || null) as { objeto?: string; alcance?: string } | null
      if (params?.objeto) objective = params.objeto
      if (params?.alcance) scope = params.alcance
    }
    let criteria: { name: string; kind: string; weight: number }[] = []
    let results: { supplier_id: string; technical_score: number | null; economic_score: number | null; final_score: number | null; qualified: boolean; exclusion_reason: string | null; rank: number | null; scope_alert: boolean }[] = []
    let recommendationText = ''
    let recommendedId = ''
    if (evaluation) {
      const [{ data: criterionRows }, { data: resultRows }, { data: recommendation }] = await Promise.all([
        supabase.from('evaluation_criteria').select('name, kind, weight').eq('evaluation_id', evaluation.id).order('sort_order'),
        supabase.from('evaluation_results').select('*').eq('evaluation_id', evaluation.id),
        supabase.from('award_recommendations').select('*').eq('evaluation_id', evaluation.id).order('created_at', { ascending: false }).limit(1),
      ])
      criteria = criterionRows || []
      results = resultRows || []
      recommendationText = recommendation?.[0]?.report_text || ''
      recommendedId = recommendation?.[0]?.supplier_id || ''
    }
    const recommended = (bids || []).find(bid => bid.supplier_id === recommendedId)
    const recommendedResult = results.find(row => row.supplier_id === recommendedId)
    const savings: SavingsVerdict = estimateAwardSavings({
      budget: lic?.baseline_amount ?? null,
      baseline: lic?.baseline_amount ?? null,
      baselineCurrency: lic?.baseline_currency ?? event.currency,
      baselineSource: lic?.baseline_source ?? null,
      targetSavings: plan?.projected_savings_amount ?? null,
      awardedAmount: recommended ? Number(recommended.amount) : null,
      awardedCurrency: recommended?.currency ?? event.currency,
      scopeComparable: Boolean(recommended) && !recommendedResult?.scope_alert,
    })
    const nextPreview: PacketSnapshot = {
      title: event.title,
      licitacionId: event.licitacion_id,
      initiativeTitle: plan?.title || 'Sin iniciativa vinculada',
      objective,
      scope,
      budget: lic?.baseline_amount ?? null,
      currency: event.currency,
      baselineSource: lic?.baseline_source ?? null,
      invited: (invites || []).map(item => ({ name: nameMap[item.supplier_id] || item.supplier_id, status: item.status })),
      offers: (bids || []).map(bid => ({
        name: nameMap[bid.supplier_id] || bid.supplier_id,
        amount: Number(bid.amount),
        currency: bid.currency,
        technical: bid.technical_summary || '',
        lines: (lines || []).filter(line => line.supplier_id === bid.supplier_id).map(line => ({
          description: line.description,
          quantity: Number(line.quantity),
          unit: line.unit,
          unitPrice: Number(line.unit_price),
        })),
        files: (files || []).filter(file => file.supplier_id === bid.supplier_id).map(file => file.file_name),
        technicalScore: results.find(row => row.supplier_id === bid.supplier_id)?.technical_score ?? null,
        economicScore: results.find(row => row.supplier_id === bid.supplier_id)?.economic_score ?? null,
        finalScore: results.find(row => row.supplier_id === bid.supplier_id)?.final_score ?? null,
        qualified: Boolean(results.find(row => row.supplier_id === bid.supplier_id)?.qualified),
        exclusion: results.find(row => row.supplier_id === bid.supplier_id)?.exclusion_reason ?? null,
        rank: results.find(row => row.supplier_id === bid.supplier_id)?.rank ?? null,
        scopeAlert: Boolean(results.find(row => row.supplier_id === bid.supplier_id)?.scope_alert),
      })),
      model: {
        technicalWeight: Number(evaluation?.technical_weight || 0),
        economicWeight: Number(evaluation?.economic_weight || 0),
        threshold: evaluation?.technical_threshold == null ? null : Number(evaluation.technical_threshold),
        formula: 'Menor total habilitado dividido por el total de la oferta, por 100, en la misma moneda.',
        criteria,
      },
      recommendation: recommendationText,
      recommendedSupplier: nameMap[recommendedId] || recommendedId,
      savings,
      risks: '',
      exceptions: '',
      observations: '',
    }
    setPreview(nextPreview)
    setChosenSupplier(current => current || recommendedId)
    setLoading(false)
  }, [eventId, router])

  useEffect(() => { load() }, [load])

  const latest = packets[packets.length - 1]
  const latestDecision = decisions.find(item => item.packet_id === latest?.id)
  const frozen = latest?.status === 'submitted' || latest?.status === 'returned' || latestDecision?.outcome === 'approved'
  const shown = frozen && latest ? { ...latest.snapshot, risks: latest.risks || '', exceptions: latest.exceptions || '', observations: latest.observations || '' } : preview
  const report = shown ? executiveReport(shown) : ''

  const savePolicy = async () => {
    if (!companyId || !session) return
    const { error } = await supabaseBrowser().from('award_policies').upsert({
      company_id: companyId,
      mode: policy.mode,
      required_approvals: Number(policy.required_approvals),
      allow_self_approval: policy.allow_self_approval,
      approver_roles: policy.approver_roles,
      updated_by: session.userId,
      updated_at: new Date().toISOString(),
    })
    if (error) addToast({ type: 'error', title: 'No se guardó la política', message: errorMessage(error, 'Revisa el circuito.') })
    else addToast({ type: 'success', title: 'Política guardada', message: 'El circuito queda configurado para esta empresa.' })
  }

  const addApprover = async () => {
    const response = await fetch('/api/company/approver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: approverEmail, fullName: approverName, password: approverPassword, role: 'manager' }),
    })
    const body = await response.json()
    if (!response.ok) {
      addToast({ type: 'error', title: 'No se agregó', message: body.error || 'Error' })
      return
    }
    addToast({ type: 'success', title: 'Aprobador creado', message: 'No se envió correo. La contraseña quedó definida en este formulario.' })
    setApproverPassword('')
  }

  const submitPacket = async () => {
    if (!session || !companyId || !preview) return
    const { data: evaluation } = await supabaseBrowser().from('evaluations').select('id').eq('event_id', eventId).maybeSingle()
    const { data: recommendation } = await supabaseBrowser().from('award_recommendations').select('id').eq('event_id', eventId).order('created_at', { ascending: false }).limit(1)
    const { data: event } = await supabaseBrowser().from('offer_events').select('licitacion_id').eq('id', eventId).single()
    if (!evaluation || !recommendation?.[0] || !event?.licitacion_id) {
      addToast({ type: 'error', title: 'Falta la recomendación', message: 'Cierra la evaluación y deja una recomendación antes de enviarla.' })
      return
    }
    const snapshot = { ...preview, risks, exceptions, observations }
    const { error } = await supabaseBrowser().from('decision_packets').insert({
      company_id: companyId,
      licitacion_id: event.licitacion_id,
      event_id: eventId,
      evaluation_id: evaluation.id,
      recommendation_id: recommendation[0].id,
      version: packets.length + 1,
      status: 'submitted',
      snapshot,
      risks,
      exceptions,
      observations,
      prepared_by: session.userId,
      supersedes_id: latest?.id || null,
    })
    if (error) addToast({ type: 'error', title: 'No se envió', message: errorMessage(error, 'No se pudo enviar el expediente.') })
    else {
      addToast({ type: 'success', title: 'Expediente enviado', message: 'La evaluación usada quedó referenciada. Aprobar todavía no adjudica.' })
      load()
    }
  }

  const vote = async (kind: 'approved' | 'rejected' | 'returned') => {
    if (!latestDecision) return
    const { error } = await supabaseBrowser().from('award_votes').insert({
      decision_id: latestDecision.id,
      voter_id: session?.userId,
      voter_role: session?.role,
      vote: kind,
      comment: comment.trim() || null,
      chosen_supplier_id: kind === 'approved' ? chosenSupplier : null,
    })
    if (error) addToast({ type: 'error', title: 'No se registró el voto', message: errorMessage(error, 'El voto no se guardó.') })
    else {
      addToast({ type: 'success', title: 'Voto registrado', message: 'Quedó en el historial y no se borra.' })
      setComment('')
      load()
    }
  }

  const award = async () => {
    if (!latestDecision) return
    const { error } = await supabaseBrowser().rpc('finalize_award', {
      target_decision: latestDecision.id,
      award_conditions: conditions,
    })
    if (error) addToast({ type: 'error', title: 'No se adjudicó', message: errorMessage(error, 'La adjudicación no se publicó.') })
    else {
      addToast({ type: 'success', title: 'Adjudicación formal', message: 'La licitación, la iniciativa y el expediente quedaron actualizados.' })
      load()
    }
  }

  const download = () => {
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `decision-${shown?.licitacionId || 'proceso'}.txt`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  if (loading || !session) return <MainLayout><LoadingSpinner /></MainLayout>
  if (!shown) {
    return (
      <MainLayout user={{ name: session.name, email: session.email, role: session.role }}>
        <p className="text-sm">La decisión se prepara cuando los sobres están abiertos.</p>
      </MainLayout>
    )
  }

  const savings = shown.savings
  const pending = latestDecision?.outcome === 'pending'
  const canSend = (!latest || latest.status === 'returned') && (session.role === 'admin' || session.userId === latest?.prepared_by)

  return (
    <MainLayout user={{ name: session.name, email: session.email, role: session.role }} companyName={session.companyName}>
      <div className="space-y-5 print:space-y-3">
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" onClick={() => router.push(`/sala/${eventId}`)}>Volver a la sala</Button>
          <Button variant="outline" onClick={download}>Descargar informe</Button>
          <Button variant="outline" onClick={() => window.print()}>Imprimir o guardar PDF</Button>
        </div>
        <div>
          <h1>Decisión · {shown.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {latest ? `Versión ${latest.version} · ${latest.status}` : 'Borrador de envío'}.
            {latestDecision ? ` Decisión ${latestDecision.outcome}.` : ''}
            {awardId ? ' Adjudicación publicada.' : ' Aprobar no adjudica.'}
          </p>
        </div>

        <Card>
          <CardHeader><CardTitle>Vista ejecutiva</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Licitación {shown.licitacionId}. Iniciativa: {shown.initiativeTitle}.</p>
            <p>Objetivo: {shown.objective}</p>
            <p>Alcance: {shown.scope}</p>
            <p>Presupuesto y línea base: {formatCurrency(savings.baseline || 0, shown.currency)}. Fuente: {shown.baselineSource || 'sin fuente'}.</p>
            <p>Ahorro objetivo: {savings.targetSavings == null ? 'sin objetivo' : formatCurrency(savings.targetSavings, shown.currency)}.</p>
            <p>Ahorro estimado de la recomendación: {savings.estimatedSavings == null ? 'no calculado' : formatCurrency(savings.estimatedSavings, shown.currency)}.</p>
            <p>Ahorro realizado: sin evidencia posterior.</p>
            <p>{savings.note}</p>
            <p>Metodología: técnico {shown.model.technicalWeight}% y económico {shown.model.economicWeight}%. {shown.model.formula}</p>
            <p>Criterios: {shown.model.criteria.map(item => `${item.name} ${item.kind === 'mandatory' ? 'excluyente' : `${item.weight}%`}`).join(', ')}.</p>
            <p>Invitados: {shown.invited.map(item => `${item.name} (${item.status})`).join(', ')}.</p>
            <p>Recomendado: {shown.recommendedSupplier}.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ofertas y matriz</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {shown.offers.map(offer => (
              <div key={offer.name}>
                <p className="font-medium">{offer.rank ? `${offer.rank}. ` : 'Excluido. '}{offer.name} · {formatCurrency(offer.amount, offer.currency)}</p>
                <p>Técnico {offer.technicalScore ?? '—'}, económico {offer.economicScore ?? '—'}, final {offer.finalScore ?? '—'}{offer.exclusion ? `. ${offer.exclusion}` : ''}</p>
                <p>{offer.technical}</p>
                {offer.lines.map(line => (
                  <p key={`${offer.name}-${line.description}`}>{line.description}: {line.quantity} {line.unit} × {formatCurrency(line.unitPrice, offer.currency)}</p>
                ))}
                <p>Archivos: {offer.files.join(', ') || 'sin anexos'}.</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {session.role === 'admin' && (
          <Card className="print:hidden">
            <CardHeader><CardTitle>Circuito de aprobación</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Modo</Label>
                <select className="w-full rounded-md border bg-background p-2" value={policy.mode} onChange={event => setPolicy(prev => ({ ...prev, mode: event.target.value as Policy['mode'] }))}>
                  <option value="individual">Aprobador individual</option>
                  <option value="committee">Comité</option>
                </select>
              </div>
              <div>
                <Label>Aprobaciones requeridas</Label>
                <Input type="number" min="1" max="12" value={policy.required_approvals} onChange={event => setPolicy(prev => ({ ...prev, required_approvals: Number(event.target.value) }))} />
              </div>
              <label className="text-sm md:col-span-2">
                <input type="checkbox" checked={policy.allow_self_approval} onChange={event => setPolicy(prev => ({ ...prev, allow_self_approval: event.target.checked }))} /> Excepción auditada: quien recomienda también puede aprobar.
              </label>
              <p className="text-sm text-muted-foreground md:col-span-2">Pueden aprobar los roles administrador y gerente de esta empresa. Un administrador de otra empresa no adjudica este proceso.</p>
              <Button onClick={savePolicy}>Guardar política</Button>
              <div className="grid gap-2 md:col-span-2 md:grid-cols-4">
                <Input placeholder="Nombre del aprobador" value={approverName} onChange={event => setApproverName(event.target.value)} />
                <Input type="email" placeholder="Correo" value={approverEmail} onChange={event => setApproverEmail(event.target.value)} />
                <Input type="password" placeholder="Contraseña" value={approverPassword} onChange={event => setApproverPassword(event.target.value)} />
                <Button variant="outline" onClick={addApprover}>Agregar aprobador</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {canSend && (
          <Card className="print:hidden">
            <CardHeader><CardTitle>{latest?.status === 'returned' ? 'Corrección' : 'Envío'}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={risks} onChange={event => setRisks(event.target.value)} placeholder="Riesgos" />
              <Textarea value={exceptions} onChange={event => setExceptions(event.target.value)} placeholder="Excepciones" />
              <Textarea value={observations} onChange={event => setObservations(event.target.value)} placeholder="Observaciones" />
              <Button onClick={submitPacket}>{latest?.status === 'returned' ? 'Enviar corrección' : 'Enviar a comité'}</Button>
            </CardContent>
          </Card>
        )}

        {packets.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Historial</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {packets.map(packet => {
                const decision = decisions.find(item => item.packet_id === packet.id)
                const packetVotes = votes.filter(vote => vote.decision_id === decision?.id)
                return (
                  <div key={packet.id}>
                    <p>Versión {packet.version}: expediente {packet.status}{decision ? `, decisión ${decision.outcome}` : ''}.</p>
                    {decision?.justification && <p>Observación: {decision.justification}</p>}
                    {decision?.different_supplier && <p>Proveedor distinto al recomendado. {decision.different_supplier_justification}</p>}
                    {packetVotes.map(vote => (
                      <p key={vote.id}>{vote.vote} · {vote.voter_role} · {vote.comment || 'sin comentario'}{vote.self_approval_exception ? ' · excepción de autoaprobación' : ''}</p>
                    ))}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {pending && latestDecision && (
          <Card className="print:hidden">
            <CardHeader><CardTitle>Voto</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Label>Proveedor que se aprueba</Label>
              <select className="w-full rounded-md border bg-background p-2" value={chosenSupplier} onChange={event => setChosenSupplier(event.target.value)}>
                {shown.offers.filter(offer => offer.qualified).map(offer => {
                  const supplierId = Object.keys(names).find(id => names[id] === offer.name) || ''
                  return <option key={supplierId} value={supplierId}>{offer.name}</option>
                })}
              </select>
              <Textarea value={comment} onChange={event => setComment(event.target.value)} placeholder="Justificación u observación" />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => vote('approved')}>Aprobar recomendación</Button>
                <Button variant="outline" onClick={() => vote('returned')}>Devolver</Button>
                <Button variant="outline" onClick={() => vote('rejected')}>Rechazar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {latestDecision?.outcome === 'approved' && !awardId && (
          <Card className="print:hidden">
            <CardHeader><CardTitle>Adjudicación</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">La aprobación ya está. Publicar la adjudicación es una acción aparte y queda a nombre de quien la ejecuta.</p>
              <Textarea value={conditions} onChange={event => setConditions(event.target.value)} placeholder="Condiciones o reservas de la adjudicación" />
              <Button onClick={award}>Adjudicar</Button>
            </CardContent>
          </Card>
        )}

        {report && <pre className="whitespace-pre-wrap text-sm">{report}</pre>}
      </div>
    </MainLayout>
  )
}
