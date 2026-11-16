'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { LoadingSpinner } from '@/components/ui/loading'
import { BlockCard, EmptyHint, ItemList } from '@/components/workspace-blocks'
import { supabaseBrowser } from '@/lib/supabase'
import { loadAppSession, type AppSession } from '@/lib/offer-room'
import { can } from '@/lib/navigation'
import { formatCurrency } from '@/lib/utils'
import { SAVINGS_LABELS, realizedSavingsLabel, validatedSavingsLabel } from '@/lib/procurement-flow'

type Award = {
  id: string
  licitacion_id: string | null
  event_id: string | null
  contract_id: string | null
  amount: number | null
  currency: string | null
  estimated_savings: number | null
  awarded_at: string | null
  licitacion: { name: string | null } | { name: string | null }[] | null
  supplier: { fantasy_name: string | null; legal_name: string | null } | { fantasy_name: string | null; legal_name: string | null }[] | null
}

type Pending = { id: string; licitacion_id: string | null; created_at: string | null; packet: { event_id?: string } | { event_id?: string }[] | null }

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] || null : value || null
}

export default function AdjudicacionesPage() {
  const router = useRouter()
  const [session, setSession] = useState<AppSession | null>(null)
  const [awards, setAwards] = useState<Award[]>([])
  const [pending, setPending] = useState<Pending[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [contracts, setContracts] = useState<Map<string, { id: string; code: string | null }>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAppSession().then(async appSession => {
      if (!appSession) {
        router.replace('/login')
        return
      }
      if (appSession.role === 'supplier') {
        router.replace('/sala')
        return
      }
      setSession(appSession)
      if (!appSession.companyId) {
        setLoading(false)
        return
      }
      const supabase = supabaseBrowser()
      const [awardRows, pendingRows, licitaciones, contractRows] = await Promise.all([
        supabase.from('process_awards')
          .select('id, licitacion_id, event_id, contract_id, amount, currency, estimated_savings, awarded_at, licitacion:licitaciones(name), supplier:suppliers(fantasy_name, legal_name)')
          .eq('company_id', appSession.companyId)
          .order('awarded_at', { ascending: false })
          .limit(200),
        supabase.from('award_decisions')
          .select('id, licitacion_id, created_at, packet:decision_packets(event_id)')
          .eq('company_id', appSession.companyId)
          .eq('outcome', 'pending')
          .limit(100),
        supabase.from('licitaciones').select('id, name').eq('company_id', appSession.companyId).limit(500),
        can(appSession.role, 'readContracts')
          ? supabase.from('contracts').select('id, code, licitacion_id').eq('company_id', appSession.companyId).neq('status', 'terminated').limit(500)
          : Promise.resolve({ data: [] as { id: string; code: string | null; licitacion_id: string | null }[], error: null }),
      ])
      setAwards((awardRows.data || []) as Award[])
      setPending((pendingRows.data || []) as Pending[])
      setNames(new Map((licitaciones.data || []).map(row => [row.id, row.name || row.id])))
      setContracts(new Map((contractRows.data || []).filter(row => row.licitacion_id).map(row => [row.licitacion_id as string, { id: row.id, code: row.code }])))
      setLoading(false)
    })
  }, [router])

  if (loading || !session) return <MainLayout><LoadingSpinner /></MainLayout>

  const canDecide = can(session.role, 'approve')
  const canContract = can(session.role, 'writeContracts')

  return (
    <MainLayout user={{ name: session.name, email: session.email, role: session.role }} companyName={session.companyName}>
      <div className="space-y-5">
        <div>
          <h1>Adjudicaciones</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-petrol-blue/60">
            Decisiones del comité de adjudicación y su paso a contrato. Recomendar no es adjudicar: una adjudicación aparece aquí solo cuando el comité la aprueba.
          </p>
        </div>

        <BlockCard title="Decisiones pendientes" description="Recomendaciones que esperan la decisión del comité.">
          <ItemList
            items={pending.map(row => {
              const eventId = one(row.packet)?.event_id
              return {
                id: row.id,
                title: names.get(row.licitacion_id || '') || row.licitacion_id || 'Licitación',
                detail: row.created_at ? `Enviada el ${new Date(row.created_at).toLocaleDateString('es-CL')}` : undefined,
                href: eventId ? `/sala/${eventId}/decision` : undefined,
                cta: eventId ? (canDecide ? 'Decidir' : 'Ver expediente') : undefined,
              }
            })}
            empty="No hay decisiones pendientes."
          />
        </BlockCard>

        <BlockCard title="Adjudicaciones registradas" description={`Montos en su moneda, sin conversión. ${SAVINGS_LABELS.realized}: ${realizedSavingsLabel()}.`}>
          {awards.length === 0 ? (
            <EmptyHint>
              Todavía no hay adjudicaciones. Se registran al decidir en la sala de ofertas: <Link href="/procesos?etapa=evaluacion" className="font-medium underline">ver procesos en evaluación</Link>.
            </EmptyHint>
          ) : (
            <ul className="divide-y divide-petrol-blue/[0.06]">
              {awards.map(award => {
                const supplier = one(award.supplier)
                const licitacion = one(award.licitacion)
                const contract = award.contract_id ? { id: award.contract_id, code: null } : contracts.get(award.licitacion_id || '')
                const currency = award.currency || 'USD'
                return (
                  <li key={award.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      {award.licitacion_id ? (
                        <Link href={`/licitaciones/${award.licitacion_id}`} className="text-[14px] font-medium text-petrol-blue hover:underline">
                          {licitacion?.name || award.licitacion_id}
                        </Link>
                      ) : (
                        <p className="text-[14px] font-medium text-petrol-blue">Adjudicación</p>
                      )}
                      <p className="text-[12px] text-petrol-blue/60">
                        {supplier?.fantasy_name || supplier?.legal_name || 'Proveedor'}
                        {' · '}
                        {award.amount != null ? formatCurrency(award.amount, currency) : 'sin monto'}
                        {award.awarded_at ? ` · ${new Date(award.awarded_at).toLocaleDateString('es-CL')}` : ''}
                      </p>
                      <p className="text-[11.5px] text-petrol-blue/50">
                        {SAVINGS_LABELS.negotiated}: {award.estimated_savings != null ? formatCurrency(award.estimated_savings, currency) : `${SAVINGS_LABELS.noInfo} (sin base comparable)`}
                        {' · '}Validado: {validatedSavingsLabel(award.estimated_savings != null)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {award.event_id && (
                        <Link href={`/sala/${award.event_id}/decision`} className="rounded-full border border-petrol-blue/15 bg-white/70 px-3 py-1.5 text-[12px] text-petrol-blue hover:bg-white">
                          Ver decisión
                        </Link>
                      )}
                      {contract && can(session.role, 'readContracts') ? (
                        <Link href={`/contratos/${contract.id}`} className="rounded-full bg-petrol-blue px-3 py-1.5 text-[12px] font-medium text-white">
                          Ver contrato{contract.code ? ` ${contract.code}` : ''}
                        </Link>
                      ) : canContract ? (
                        <Link href={`/contratos/desde-adjudicacion?award=${award.id}`} className="rounded-full bg-petrol-blue px-3 py-1.5 text-[12px] font-medium text-white">
                          Preparar contrato
                        </Link>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </BlockCard>
      </div>
    </MainLayout>
  )
}
