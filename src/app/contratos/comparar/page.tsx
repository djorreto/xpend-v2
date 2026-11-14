'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/loading'
import { supabaseBrowser } from '@/lib/supabase'
import { loadAppSession, type AppSession } from '@/lib/offer-room'

type Contract = { id: string; code: string; name: string; amount: number | null; currency: string | null; renewal: string; notice_days: number | null; ends_on: string | null; payment_terms: string | null; object_text: string | null }
type Finding = { contract_id: string; kind: string; statement: string; review_status: string }

export default function CompararPage() {
  return (
    <Suspense fallback={<MainLayout><LoadingSpinner /></MainLayout>}>
      <CompararForm />
    </Suspense>
  )
}

function CompararForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [session, setSession] = useState<AppSession | null>(null)
  const [left, setLeft] = useState<Contract | null>(null)
  const [right, setRight] = useState<Contract | null>(null)
  const [findings, setFindings] = useState<Finding[]>([])

  useEffect(() => {
    const a = params.get('a')
    const b = params.get('b')
    loadAppSession().then(async appSession => {
      if (!appSession || appSession.role === 'supplier' || !a || !b) {
        router.push('/contratos')
        return
      }
      setSession(appSession)
      const supabase = supabaseBrowser()
      const [{ data: first }, { data: second }, { data: found }] = await Promise.all([
        supabase.from('contracts').select('id, code, name, amount, currency, renewal, notice_days, ends_on, payment_terms, object_text').eq('id', a).single(),
        supabase.from('contracts').select('id, code, name, amount, currency, renewal, notice_days, ends_on, payment_terms, object_text').eq('id', b).single(),
        supabase.from('contract_findings').select('contract_id, kind, statement, review_status').in('contract_id', [a, b]),
      ])
      setLeft(first)
      setRight(second)
      setFindings(found || [])
    })
  }, [params, router])

  if (!session || !left || !right) return <MainLayout><LoadingSpinner /></MainLayout>
  const rows: { label: string; a: string; b: string }[] = [
    { label: 'Monto', a: left.amount == null ? 'pendiente' : `${left.currency || ''} ${left.amount}`, b: right.amount == null ? 'pendiente' : `${right.currency || ''} ${right.amount}` },
    { label: 'Término', a: left.ends_on || 'pendiente', b: right.ends_on || 'pendiente' },
    { label: 'Renovación', a: left.renewal, b: right.renewal },
    { label: 'Preaviso', a: left.notice_days == null ? 'pendiente' : String(left.notice_days), b: right.notice_days == null ? 'pendiente' : String(right.notice_days) },
    { label: 'Pago', a: left.payment_terms || 'pendiente', b: right.payment_terms || 'pendiente' },
    { label: 'Objeto', a: left.object_text || 'pendiente', b: right.object_text || 'pendiente' },
  ]

  return (
    <MainLayout user={{ name: session.name, email: session.email, role: session.role }} companyName={session.companyName}>
      <Card>
        <CardHeader><CardTitle>{left.code} y {right.code}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {rows.map(row => (
            <p key={row.label}>{row.label}: {row.a} / {row.b}{row.a !== row.b ? ' · distinto' : ' · igual'}</p>
          ))}
          <p className="pt-2 font-medium">Hallazgos</p>
          {findings.map((finding, index) => (
            <p key={`${finding.contract_id}-${index}`}>{finding.contract_id === left.id ? left.code : right.code} · {finding.kind} · {finding.review_status}: {finding.statement}</p>
          ))}
        </CardContent>
      </Card>
    </MainLayout>
  )
}
