'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { can } from '@/lib/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/ui/loading'
import { supabaseBrowser } from '@/lib/supabase'
import { loadAppSession, type AppSession } from '@/lib/offer-room'
import { formatCurrency } from '@/lib/utils'

type Row = {
  id: string
  code: string
  name: string
  contract_type: string | null
  counterparty_name: string | null
  status: string
  currency: string | null
  amount: number | null
  ends_on: string | null
  owner_id: string | null
  renewal: string
}

const STATUS: Record<string, string> = {
  draft: 'Borrador',
  in_review: 'En revisión',
  active: 'Vigente',
  expired: 'Vencido',
  terminated: 'Terminado',
}

export default function ContratosPage() {
  const router = useRouter()
  const pendingView = useSearchParams().get('vista') === 'pendientes'
  const [session, setSession] = useState<AppSession | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [currency, setCurrency] = useState('')
  const [expiring, setExpiring] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAppSession().then(async appSession => {
      if (!appSession || appSession.role === 'supplier') {
        router.push('/sala')
        return
      }
      setSession(appSession)
      const { data } = await supabaseBrowser().from('contracts').select('*').order('updated_at', { ascending: false })
      setRows((data || []) as Row[])
      setLoading(false)
    })
  }, [router])

  if (loading || !session) return <MainLayout><LoadingSpinner /></MainLayout>

  const soon = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  const visible = rows.filter(row => {
    const haystack = `${row.code} ${row.name} ${row.counterparty_name || ''} ${row.contract_type || ''}`.toLowerCase()
    if (query && !haystack.includes(query.toLowerCase())) return false
    if (pendingView && row.status !== 'draft' && row.status !== 'in_review') return false
    if (status && row.status !== status) return false
    if (currency && row.currency !== currency) return false
    if (expiring && !(row.ends_on && row.ends_on >= today && row.ends_on <= soon && row.status === 'active')) return false
    return true
  })
  const due = rows.filter(row => row.ends_on && row.ends_on >= today && row.ends_on <= soon && row.status === 'active')

  return (
    <MainLayout user={{ name: session.name, email: session.email, role: session.role }} companyName={session.companyName}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1>{pendingView ? 'Contratos pendientes de revisión' : 'Repositorio de contratos'}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {pendingView
                ? 'Borradores y contratos en revisión. Una versión la aprueba alguien distinto de quien la escribió.'
                : 'Puedes cargar un contrato existente o redactar uno nuevo. No hace falta una licitación previa.'}
            </p>
          </div>
          {can(session.role, 'writeContracts') && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.push('/contratos/builder')}>Redactar contrato</Button>
              <Button onClick={() => router.push('/contratos/nuevo')}>Cargar y analizar</Button>
            </div>
          )}
        </div>
        <Card>
          <CardHeader><CardTitle>Próximos vencimientos</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {due.length === 0 ? <p>No hay contratos vigentes que terminen en 90 días.</p> : due.map(row => (
              <p key={row.id}>{row.code} · {row.name} · termina {row.ends_on}</p>
            ))}
          </CardContent>
        </Card>
        <div className="grid gap-2 md:grid-cols-4">
          <Input placeholder="Buscar código, nombre o contraparte" value={query} onChange={event => setQuery(event.target.value)} />
          <select className="rounded-md border bg-background p-2" value={status} onChange={event => setStatus(event.target.value)}>
            <option value="">Estado</option>
            {Object.entries(STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <select className="rounded-md border bg-background p-2" value={currency} onChange={event => setCurrency(event.target.value)}>
            <option value="">Moneda</option>
            <option value="USD">USD</option>
            <option value="CLP">CLP</option>
            <option value="EUR">EUR</option>
          </select>
          <label className="text-sm"><input type="checkbox" checked={expiring} onChange={event => setExpiring(event.target.checked)} /> Solo vencen en 90 días</label>
        </div>
        <div className="space-y-2">
          {visible.map(row => (
            <button key={row.id} className="w-full rounded-lg border p-3 text-left" onClick={() => router.push(`/contratos/${row.id}`)}>
              <p className="font-medium">{row.code} · {row.name}</p>
              <p className="text-sm text-muted-foreground">
                {STATUS[row.status] || row.status}
                {row.counterparty_name ? ` · ${row.counterparty_name}` : ''}
                {row.amount != null ? ` · ${formatCurrency(row.amount, row.currency || 'USD')}` : ' · monto pendiente'}
                {row.ends_on ? ` · hasta ${row.ends_on}` : ''}
                {row.renewal === 'automatic' ? ' · renovación automática' : ''}
              </p>
            </button>
          ))}
          {visible.length === 0 && (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              {rows.length === 0
                ? <>Todavía no hay contratos. Puedes <Link className="underline" href="/contratos/nuevo">cargar uno existente</Link>, <Link className="underline" href="/contratos/builder">redactarlo</Link> o prepararlo desde una <Link className="underline" href="/adjudicaciones">adjudicación</Link>.</>
                : pendingView ? 'No hay contratos pendientes de revisión.' : 'No hay contratos con ese filtro.'}
            </p>
          )}
        </div>
        {visible.length > 1 && (
          <Button variant="outline" onClick={() => router.push(`/contratos/comparar?a=${visible[0].id}&b=${visible[1].id}`)}>Comparar los dos primeros</Button>
        )}
      </div>
    </MainLayout>
  )
}
