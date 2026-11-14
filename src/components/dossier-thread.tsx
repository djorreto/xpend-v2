'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase'
import { DOSSIER_STEPS, dossierHref, type Dossier, type DossierStage } from '@/lib/dossier-store'

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
  }, [match.companyId, match.id, match.sourcingPlanId, match.rfxProjectId, match.licitacionId, match.offerEventId, match.groupId])

  if (!dossier) return null
  const current = DOSSIER_STEPS.findIndex(step => step.stage === dossier.stage)

  return (
    <div className="rounded-lg border p-3 text-sm">
      <p className="font-medium">Expediente {dossier.title}</p>
      <p className="text-xs text-muted-foreground">
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
    </div>
  )
}
