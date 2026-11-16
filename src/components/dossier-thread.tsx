'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase'
import { DOSSIER_STEPS, dossierHref, dossierNextStep, type Dossier, type DossierStage } from '@/lib/dossier-store'
import { can } from '@/lib/navigation'
import { EvaluationReport } from '@/components/evaluation-report'

type Match = {
  companyId: string
  id?: string
  sourcingPlanId?: string
  rfxProjectId?: string
  licitacionId?: string
  offerEventId?: string
  groupId?: string
}

export function DossierThread({ match }: { match: Match }) {
  const [dossier, setDossier] = useState<Dossier | null>(null)
  const [events, setEvents] = useState<{ id: string; action: string; detail: string | null; created_at: string }[]>([])
  const [report, setReport] = useState<string | null>(null)
  const [linkedContract, setLinkedContract] = useState<{ id: string; code: string; status: string } | null>(null)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    setRole(sessionStorage.getItem('xpend-user-role'))
  }, [])

  useEffect(() => {
    const filters = [
      match.id ? `id.eq.${match.id}` : '',
      match.sourcingPlanId ? `sourcing_plan_id.eq.${match.sourcingPlanId}` : '',
      match.rfxProjectId ? `rfx_project_id.eq.${match.rfxProjectId}` : '',
      match.licitacionId ? `licitacion_id.eq.${match.licitacionId}` : '',
      match.offerEventId ? `offer_event_id.eq.${match.offerEventId}` : '',
      match.groupId ? `group_id.eq.${match.groupId}` : '',
    ].filter(Boolean)
    if (!filters.length) return
    const supabase = supabaseBrowser()
    void supabase
      .from('procurement_dossiers')
      .select('*')
      .eq('company_id', match.companyId)
      .or(filters.join(','))
      .order('updated_at', { ascending: false })
      .limit(1)
      .then(({ data }) => setDossier((data?.[0] as Dossier) || null))
    if (match.offerEventId) {
      void supabase
        .from('offer_audit')
        .select('id, action, detail, created_at')
        .eq('event_id', match.offerEventId)
        .order('created_at')
        .then(({ data }) => setEvents(data || []))
    }
    const recommendationEvent = match.offerEventId
    const recommendationLicitacion = match.licitacionId
    if (recommendationEvent || recommendationLicitacion) {
      const recommendation = supabase
        .from('award_recommendations')
        .select('report_text')
        .order('created_at', { ascending: false })
        .limit(1)
      const scoped = recommendationEvent
        ? recommendation.eq('event_id', recommendationEvent)
        : recommendation.eq('licitacion_id', recommendationLicitacion)
      void scoped.then(({ data }) => setReport(data?.[0]?.report_text || null))
    }
    if (match.licitacionId) {
      void supabase
        .from('contracts')
        .select('id, code, status')
        .eq('licitacion_id', match.licitacionId)
        .neq('status', 'terminated')
        .limit(1)
        .maybeSingle()
        .then(({ data }) => setLinkedContract(data || null))
    }
  }, [match.companyId, match.id, match.sourcingPlanId, match.rfxProjectId, match.licitacionId, match.offerEventId, match.groupId])

  if (!dossier) return null
  const current = DOSSIER_STEPS.findIndex(step => step.stage === dossier.stage)
  const next = linkedContract ? null : dossierNextStep(dossier)
  const allowed = next && (!next.capability || can(role, next.capability))

  return (
    <div className="rounded-lg border p-3 text-sm">
      <p className="font-medium">Expediente {dossier.title}</p>
      <p className="text-[13px] text-muted-foreground">
        {dossier.currency || 'moneda'} {dossier.net_spend != null ? `· neto ${Number(dossier.net_spend).toLocaleString('es-CL')}` : ''} {dossier.country_code ? `· ${dossier.country_code}` : ''}
      </p>
      <ol className="mt-2 flex flex-wrap gap-2">
        {DOSSIER_STEPS.map((step, index) => {
          const href = dossierHref(dossier, step.stage as DossierStage)
          const reached = index <= current
          const label = reached && href ? <Link href={href} className="underline">{step.label}</Link> : step.label
          return (
            <li key={step.stage} className={reached ? 'font-medium' : 'text-muted-foreground'}>
              {index + 1}. {label}
            </li>
          )
        })}
      </ol>
      {next && role !== 'viewer' && (
        <p className="mt-2 text-[13px]">
          Siguiente paso sugerido:{' '}
          {allowed
            ? <Link href={next.href} className="font-medium underline">{next.label}</Link>
            : <span>{next.label} (lo realiza un gerente o administrador)</span>}
        </p>
      )}
      {events.length > 0 && (
        <ul className="mt-3 space-y-1 text-[13px] text-muted-foreground">
          {events.map(event => (
            <li key={event.id}>{new Date(event.created_at).toLocaleString('es-CL')} · {event.action}{event.detail ? ` · ${event.detail}` : ''}</li>
          ))}
        </ul>
      )}
      {report && (
        <div className="mt-4 rounded-xl border border-petrol-blue/10 bg-white/60 p-4">
          <EvaluationReport text={report} />
        </div>
      )}
      {linkedContract && (
        <p className="mt-3 text-[13px]">
          Contrato <Link className="underline" href={`/contratos/${linkedContract.id}`}>{linkedContract.code}</Link> · {linkedContract.status}
        </p>
      )}
      {dossier.award && (
        <p className="mt-3 text-[13px]">
          Adjudicación {dossier.award.amount != null ? `${dossier.currency || ''} ${dossier.award.amount}` : ''}.
          Objetivo {dossier.award.target_savings ?? '—'} · estimado {dossier.award.estimated_savings ?? '—'} · realizado {dossier.award.realized_savings ?? 'sin evidencia'}.
        </p>
      )}
    </div>
  )
}
