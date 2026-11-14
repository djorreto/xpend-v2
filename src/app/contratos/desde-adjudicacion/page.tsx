'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/ui/loading'
import { useToast } from '@/components/ui/toast'
import { supabaseBrowser } from '@/lib/supabase'
import { loadAppSession, type AppSession } from '@/lib/offer-room'
import { errorMessage } from '@/lib/errors'
import { awardContractDraft, type AwardLine, type ConfirmedFact, type PendingField } from '@/lib/award-contract'
import { OPTIONAL_CLAUSES, SERVICE_TEMPLATE } from '@/lib/contract-extract'

type Template = { id: string; name: string; body: string }
type Clause = { id: string; title: string; body: string }

export default function DesdeAdjudicacionPage() {
  return (
    <Suspense fallback={<MainLayout><LoadingSpinner /></MainLayout>}>
      <DesdeAdjudicacionForm />
    </Suspense>
  )
}

function DesdeAdjudicacionForm() {
  const router = useRouter()
  const params = useSearchParams()
  const awardId = params.get('award') || ''
  const { addToast } = useToast()
  const [session, setSession] = useState<AppSession | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [clauses, setClauses] = useState<Clause[]>([])
  const [templateId, setTemplateId] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [variables, setVariables] = useState<Record<string, string>>({ inicio: '', termino: '', preaviso: '', periodicidad: '', renovacion: '' })
  const [code, setCode] = useState('')
  const [confirmed, setConfirmed] = useState<ConfirmedFact[]>([])
  const [pending, setPending] = useState<PendingField[]>([])
  const [preview, setPreview] = useState('')
  const [existingId, setExistingId] = useState<string | null>(null)
  const [packet, setPacket] = useState<Parameters<typeof awardContractDraft>[0] | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!awardId) return
    loadAppSession().then(async appSession => {
      if (!appSession || appSession.role === 'supplier' || !appSession.companyId) {
        router.push('/sala')
        return
      }
      setSession(appSession)
      const supabase = supabaseBrowser()
      const [{ data: award }, { data: templateRows }, { data: clauseRows }, { data: existing }] = await Promise.all([
        supabase.from('process_awards').select('*').eq('id', awardId).maybeSingle(),
        supabase.from('contract_templates').select('id, name, body, status').eq('company_id', appSession.companyId).eq('status', 'approved'),
        supabase.from('contract_clauses').select('id, title, body').eq('company_id', appSession.companyId),
        supabase.from('contracts').select('id').eq('award_id', awardId).neq('status', 'terminated').maybeSingle(),
      ])
      setTemplates(templateRows || [])
      setClauses(clauseRows || [])
      if (templateRows?.[0]) setTemplateId(templateRows[0].id)
      if (existing?.id) setExistingId(existing.id)
      if (!award) return
      const [{ data: supplier }, { data: licitacion }, { data: bid }, { data: answers }, { data: files }, { data: recommendation }, { data: decision }, { data: dossier }] = await Promise.all([
        supabase.from('suppliers').select('fantasy_name, legal_name, rut').eq('id', award.supplier_id).maybeSingle(),
        supabase.from('licitaciones').select('id, name, description').eq('id', award.licitacion_id).maybeSingle(),
        supabase.from('offer_bids').select('technical_summary').eq('id', award.bid_id).maybeSingle(),
        supabase.from('offer_bid_answers').select('response').eq('bid_id', award.bid_id),
        supabase.from('offer_bid_files').select('file_name, kind').eq('bid_id', award.bid_id),
        supabase.from('award_recommendations').select('technical_note, economic_note').eq('evaluation_id', award.evaluation_id).order('created_at', { ascending: false }).limit(1),
        supabase.from('award_decisions').select('conditions, justification, different_supplier_justification').eq('id', award.decision_id).maybeSingle(),
        supabase.from('procurement_dossiers').select('id').eq('licitacion_id', award.licitacion_id).limit(1).maybeSingle(),
      ])
      const lines = Array.isArray(award.lines) ? award.lines as AwardLine[] : []
      const notes = [recommendation?.[0]?.technical_note, recommendation?.[0]?.economic_note].filter(Boolean).join(' ')
      const nextPacket: Parameters<typeof awardContractDraft>[0] = {
        companyName: appSession.companyName || null,
        supplierName: supplier?.legal_name || supplier?.fantasy_name || null,
        supplierRut: supplier?.rut || null,
        licitacionId: award.licitacion_id,
        licitacionName: licitacion?.name || null,
        scope: award.scope_summary || licitacion?.description || null,
        technical: bid?.technical_summary || null,
        answers: (answers || []).map(item => item.response).filter(Boolean),
        lines: lines.map(line => ({
          description: line.description,
          quantity: Number(line.quantity),
          unit: line.unit,
          unitPrice: Number(line.unitPrice ?? (line as { unit_price?: number }).unit_price),
          currency: line.currency || award.currency,
        })),
        amount: Number(award.amount),
        currency: award.currency,
        conditions: [award.conditions, decision?.justification, decision?.different_supplier_justification].filter(Boolean).join(' '),
        observations: notes || null,
        files: (files || []).map(file => `${file.kind}: ${file.file_name}`),
        ownerName: appSession.name,
        templateBody: templateRows?.[0]?.body || 'Entre {{contratante}} y {{contraparte}}. Objeto: {{objeto}}. Monto {{moneda}} {{monto}}.',
        variables,
        clauses: [],
      }
      setPacket({ ...nextPacket, dossierId: dossier?.id || null, supplierId: award.supplier_id, bidId: award.bid_id, eventId: award.event_id } as Parameters<typeof awardContractDraft>[0])
      setCode(`CTR-${award.licitacion_id}`)
    })
  }, [awardId, router])

  useEffect(() => {
    if (!packet) return
    const template = templates.find(item => item.id === templateId)
    const chosen = clauses.filter(clause => selected[clause.id]).map(clause => `${clause.title}. ${clause.body}`)
    const draft = awardContractDraft({ ...packet, templateBody: template?.body || packet.templateBody, variables, clauses: chosen })
    setConfirmed(draft.confirmed)
    setPending(draft.pending)
    setPreview(draft.body)
  }, [clauses, packet, selected, templateId, templates, variables])

  const generate = async () => {
    if (!session?.companyId || !packet || !awardId || existingId || saving) return
    if (pending.length) {
      addToast({ type: 'error', title: 'Faltan datos', message: 'Completa las fechas y plazos que el proceso no trae.' })
      return
    }
    setSaving(true)
    const snapshot = {
      awardId,
      amount: packet.amount,
      currency: packet.currency,
      supplierId: (packet as { supplierId?: string }).supplierId,
      supplierName: packet.supplierName,
      supplierRut: packet.supplierRut,
      buyer: packet.companyName,
      licitacionId: packet.licitacionId,
      bidId: (packet as { bidId?: string }).bidId,
      scope: packet.scope,
      lines: packet.lines,
    }
    const { data, error } = await supabaseBrowser().from('contracts').insert({
      company_id: session.companyId,
      code: code.trim(),
      name: `Contrato ${packet.supplierName || packet.licitacionId}`,
      contract_type: 'Servicio',
      supplier_id: snapshot.supplierId,
      counterparty_name: packet.supplierName,
      status: 'draft',
      origin: 'award',
      award_id: awardId,
      licitacion_id: packet.licitacionId,
      event_id: (packet as { eventId?: string }).eventId,
      bid_id: snapshot.bidId,
      dossier_id: (packet as { dossierId?: string | null }).dossierId || null,
      source_snapshot: snapshot,
      owner_id: session.userId,
      starts_on: variables.inicio || null,
      ends_on: variables.termino || null,
      notice_days: variables.preaviso ? Number(variables.preaviso) : null,
      periodicity: variables.periodicidad || null,
      renewal: variables.renovacion === 'automatic' ? 'automatic' : 'manual',
      currency: packet.currency,
      amount: packet.amount,
      object_text: packet.scope,
      scope_text: packet.technical,
      created_by: session.userId,
    }).select('id').single()
    if (error || !data) {
      setSaving(false)
      addToast({ type: 'error', title: 'No se generó', message: errorMessage(error, 'Ya existe un contrato para esta adjudicación.') })
      return
    }
    const version = await supabaseBrowser().from('contract_versions').insert({
      contract_id: data.id,
      company_id: session.companyId,
      version: 1,
      body: preview,
      status: 'draft',
      created_by: session.userId,
    })
    if (version.error) {
      setSaving(false)
      addToast({ type: 'error', title: 'No se guardó el borrador', message: version.error.message })
      return
    }
    await supabaseBrowser().rpc('link_contract_to_award', { target_award: awardId, target_contract: data.id })
    setSaving(false)
    router.push(`/contratos/${data.id}`)
  }

  if (!session || !packet) return <MainLayout><LoadingSpinner /></MainLayout>

  return (
    <MainLayout user={{ name: session.name, email: session.email, role: session.role }} companyName={session.companyName}>
      <div className="space-y-5">
        <h1>Contrato desde la adjudicación</h1>
        {existingId && (
          <Card>
            <CardContent className="space-y-2 p-5 text-sm">
              <p>Esta adjudicación ya tiene un contrato abierto.</p>
              <Button onClick={() => router.push(`/contratos/${existingId}`)}>Abrir contrato</Button>
            </CardContent>
          </Card>
        )}
        {!existingId && (
          <>
            <Card>
              <CardHeader><CardTitle>Datos confirmados</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {confirmed.map(fact => <p key={fact.label}>{fact.label}: {fact.value} · {fact.source}</p>)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Pendientes de validación</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {templates.length === 0 && <Button variant="outline" onClick={async () => {
                  if (!session.companyId) return
                  const { data, error } = await supabaseBrowser().from('contract_templates').insert({
                    company_id: session.companyId,
                    name: 'Servicio',
                    body: SERVICE_TEMPLATE,
                    status: 'approved',
                    approved_by: session.userId,
                    approved_at: new Date().toISOString(),
                    created_by: session.userId,
                  }).select('id, name, body').single()
                  if (error || !data) {
                    addToast({ type: 'error', title: 'No se creó la plantilla', message: errorMessage(error, 'Error') })
                    return
                  }
                  await supabaseBrowser().from('contract_clauses').insert(OPTIONAL_CLAUSES.map(clause => ({
                    company_id: session.companyId,
                    template_id: data.id,
                    title: clause.title,
                    body: clause.body,
                    optional: true,
                  })))
                  setTemplates([data])
                  setTemplateId(data.id)
                  const { data: clauseRows } = await supabaseBrowser().from('contract_clauses').select('id, title, body').eq('template_id', data.id)
                  setClauses(clauseRows || [])
                }}>Crear plantilla de servicio</Button>}
                <Input placeholder="Código" value={code} onChange={event => setCode(event.target.value)} />
                <select className="rounded-md border bg-background p-2" value={templateId} onChange={event => setTemplateId(event.target.value)}>
                  {templates.length === 0 && <option value="">Sin plantilla aprobada</option>}
                  {templates.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                {pending.map(field => (
                  <Input key={field.key} placeholder={field.label} value={variables[field.key] || ''} onChange={event => setVariables(prev => ({ ...prev, [field.key]: event.target.value }))} />
                ))}
                <div className="space-y-1 md:col-span-2">
                  {clauses.map(clause => (
                    <label key={clause.id} className="block text-sm">
                      <input type="checkbox" checked={Boolean(selected[clause.id])} onChange={event => setSelected(prev => ({ ...prev, [clause.id]: event.target.checked }))} /> {clause.title}
                    </label>
                  ))}
                </div>
                <Button disabled={saving || !templateId} onClick={generate}>{saving ? 'Generando…' : 'Generar borrador'}</Button>
              </CardContent>
            </Card>
            <pre className="whitespace-pre-wrap rounded-lg border p-3 text-sm">{preview}</pre>
          </>
        )}
      </div>
    </MainLayout>
  )
}
