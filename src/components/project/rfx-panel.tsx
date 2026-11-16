'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Link2, Unlink } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { modalityName } from '@/lib/offer-room'
import { STANDARD_EVENTS } from '@/lib/methodology'
import type { Fact } from '@/lib/project'
import { cn } from '@/lib/utils'

const FIELD = 'h-9 w-full rounded-xl border border-petrol-blue/15 bg-white/80 px-3 text-[13px] text-petrol-blue'
const LIC_STATUS: Record<string, string> = { planned: 'En preparación', bases_review: 'Bases en revisión', published: 'Publicada', evaluation: 'En evaluación', awarded: 'Adjudicada', contract_signed: 'Contrato firmado' }
const EVENT_STATUS: Record<string, string> = { draft: 'Borrador', open: 'Recibiendo ofertas', closed: 'Cerrada', awarded: 'Adjudicada', cancelled: 'Cancelada' }

export type RfxRow = { id: string; name: string; type: string; status: string; publication_date: string | null; proposal_closing_date: string | null; award_date: string | null }
type Sala = { id: string; licitacion_id: string | null; title: string; modality: string; status: string; nda_required: boolean | null; offers_opened_at: string | null; closes_at: string | null }
type Round = { event_id: string; round_number: number; status: string }

function fmt(date: string | null) {
  if (!date) return '—'
  const [y, m, d] = date.slice(0, 10).split('-')
  return `${d}-${m}-${y}`
}

export function RfxPanel({ companyId, projectId, initiativeId, rfx, facts, canManage, readOnly, onChanged }: {
  companyId: string
  projectId: string
  initiativeId: string
  rfx: RfxRow[]
  facts: Fact[]
  canManage: boolean
  readOnly: boolean
  onChanged: () => void
}) {
  const supabase = supabaseBrowser()
  const [salas, setSalas] = useState<Sala[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [candidates, setCandidates] = useState<RfxRow[]>([])
  const [pick, setPick] = useState('')
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    const ids = rfx.map(item => item.id)
    const [events, links, open] = await Promise.all([
      ids.length ? supabase.from('offer_events').select('id, licitacion_id, title, modality, status, nda_required, offers_opened_at, closes_at').in('licitacion_id', ids) : Promise.resolve({ data: [] }),
      supabase.from('sourcing_plan_licitaciones').select('licitacion_id').eq('plan_id', initiativeId),
      supabase.from('licitaciones').select('id, name, type, status, publication_date, proposal_closing_date, award_date').eq('company_id', companyId).is('sourcing_project_id', null).order('created_at', { ascending: false }).limit(200),
    ])
    const eventRows = (events.data || []) as Sala[]
    setSalas(eventRows)
    const roundRows = eventRows.length ? (await supabase.from('offer_rounds').select('event_id, round_number, status').in('event_id', eventRows.map(item => item.id))).data || [] : []
    setRounds(roundRows as Round[])
    const preferred = new Set(((links.data || []) as { licitacion_id: string }[]).map(item => item.licitacion_id))
    setCandidates(((open.data || []) as RfxRow[]).sort((a, b) => Number(preferred.has(b.id)) - Number(preferred.has(a.id))))
  }, [supabase, companyId, initiativeId, rfx])
  useEffect(() => { load() }, [load])

  const run = async (action: PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    const { error } = await action
    if (error) setMessage({ kind: 'error', text: error.message })
    else { setMessage({ kind: 'ok', text: ok }); setPick(''); onChanged() }
  }

  const factRows = facts.filter(item => ['rfx_published', 'offers_opened', 'evaluation_closed', 'final_round_opened', 'award_decided', 'contract_approved'].includes(item.event_key))

  return (
    <div className="space-y-4" data-testid="procesos-proyecto">
      {message && <p role="status" className={cn('rounded-xl px-3 py-2 text-[12.5px]', message.kind === 'ok' ? 'bg-accent-mint/30 text-petrol-blue' : 'bg-red-50 text-red-800')}>{message.text}</p>}
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6" data-testid="hechos-proyecto">
        {factRows.map(item => (
          <div key={item.event_key} className={cn('rounded-xl px-3 py-2', item.total_count > 0 && item.done_count >= item.total_count ? 'bg-accent-mint/35' : 'bg-white/60')}>
            <p className="text-[11.5px] text-petrol-blue/70">{STANDARD_EVENTS[item.event_key as keyof typeof STANDARD_EVENTS]}</p>
            <p className="text-[14px] font-medium text-petrol-blue">{item.total_count ? `${item.done_count} de ${item.total_count}` : '—'}</p>
          </div>
        ))}
      </div>
      <p className="text-[11.5px] text-petrol-blue/65">Cuentan los procesos formales (RFQ y RFP). Una RFI sirve para conocer el mercado y no se adjudica.</p>

      {rfx.length === 0 ? (
        <p className="rounded-xl border border-dashed border-petrol-blue/15 px-4 py-5 text-[12.5px] text-petrol-blue/75">El proyecto aún no tiene procesos RFx. Un proyecto simple puede tener uno solo; uno complejo, una RFI y varias RFP por lote o región.</p>
      ) : (
        <ul className="space-y-2">
          {rfx.map(item => {
            const own = salas.filter(sala => sala.licitacion_id === item.id)
            return (
              <li key={item.id} className="rounded-2xl border border-white/70 bg-white/70 p-4" data-testid="proceso-proyecto">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[14px] font-medium text-petrol-blue"><span className="mr-1.5 rounded-md bg-petrol-blue px-1.5 py-0.5 text-[11px] text-white">{item.type}</span>{item.name}</p>
                    <p className="mt-1 text-[12px] text-petrol-blue/70">{LIC_STATUS[item.status] || item.status} · publicación {fmt(item.publication_date)} · cierre de ofertas {fmt(item.proposal_closing_date)}{item.award_date ? ` · adjudicación ${fmt(item.award_date)}` : ''}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Link href={`/licitaciones/${item.id}`} className="inline-flex items-center gap-1 rounded-full border border-petrol-blue/15 bg-white px-3 py-1 text-[12px] font-medium text-petrol-blue hover:bg-petrol-blue/[0.04]">Expediente<ExternalLink className="h-3 w-3" /></Link>
                    {canManage && !readOnly && <Button size="sm" variant="ghost" aria-label={`Desvincular ${item.name}`} onClick={() => run(supabase.rpc('link_rfx_to_project', { p_project: projectId, p_licitacion: item.id, p_link: false }), 'Proceso desvinculado.')}><Unlink className="h-3.5 w-3.5" /></Button>}
                  </div>
                </div>
                {own.length > 0 && (
                  <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                    {own.map(sala => {
                      const ownRounds = rounds.filter(round => round.event_id === sala.id)
                      return (
                        <li key={sala.id} className="rounded-xl bg-petrol-blue/[0.04] px-3 py-2 text-[12px] text-petrol-blue">
                          <Link href={`/sala/${sala.id}`} className="font-medium hover:underline">{sala.title}</Link>
                          <p className="text-petrol-blue/75">{modalityName(sala.modality)} · {EVENT_STATUS[sala.status] || sala.status}{sala.nda_required ? ' · con NDA' : ''}{ownRounds.length > 1 ? ` · ${ownRounds.length} rondas` : ''}</p>
                          <p className="text-petrol-blue/65">{sala.offers_opened_at ? `Ofertas abiertas el ${fmt(sala.offers_opened_at)}` : sala.closes_at ? `Cierra el ${fmt(sala.closes_at)}` : 'Sin fecha de cierre'}</p>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {canManage && !readOnly && (
        <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-white/70 bg-white/55 p-3">
          <label className="min-w-[260px] flex-1 text-[12px] text-petrol-blue/80">Vincular un proceso existente
            <select className={`${FIELD} mt-1`} value={pick} onChange={event => setPick(event.target.value)} data-testid="vincular-proceso">
              <option value="">Elegir…</option>
              {candidates.map(item => <option key={item.id} value={item.id}>{item.type} · {item.name}</option>)}
            </select>
          </label>
          <Button size="sm" disabled={!pick} onClick={() => run(supabase.rpc('link_rfx_to_project', { p_project: projectId, p_licitacion: pick }), 'Proceso vinculado. Los hitos del proyecto se actualizan con sus registros.')}><Link2 className="mr-1 h-3.5 w-3.5" />Vincular</Button>
          <Link href="/licitaciones/new" className="text-[12px] font-medium text-petrol-blue underline">Crear un proceso nuevo</Link>
        </div>
      )}
    </div>
  )
}
