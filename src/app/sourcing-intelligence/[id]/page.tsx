'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabaseBrowser } from '@/lib/supabase'
import { SIUpload } from '@/types'
import { canReadSpendRole } from '@/lib/spend-privacy'
import { SpendFlowBar } from '@/components/spend/spend-flow-bar'
import { ReprocessButton } from '@/components/spend/reprocess-button'
import { hrefForStep } from '@/lib/spend-flow'
import { SpendBasisPanel } from '@/components/spend/spend-basis-panel'

export default function UploadOverviewPage() {
  const router = useRouter()
  const params = useParams()
  const uploadId = params.id as string
  const supabase = supabaseBrowser()
  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [upload, setUpload] = useState<SIUpload | null>(null)
  const [pending, setPending] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      const { data: profile } = await supabase.from('profiles').select('*, companies(*)').eq('id', session.user.id).single()
      if (!profile) return
      setUser(profile)
      setCompany(profile.companies)
      if (!canReadSpendRole(profile.role)) {
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('si_uploads')
        .select('*')
        .eq('id', uploadId)
        .eq('company_id', profile.company_id)
        .single()
      setUpload(data)
      const { count } = await supabase
        .from('si_spend_lines')
        .select('id', { count: 'exact', head: true })
        .eq('upload_id', uploadId)
        .eq('company_id', profile.company_id)
        .eq('needs_review', true)
      setPending(count || 0)
      setLoading(false)
    })()
  }, [uploadId])

  if (loading) {
    return (
      <MainLayout user={user} companyName={company?.name}>
        <div className="flex h-96 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-gray-900" />
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">{upload?.file_name || 'Análisis'}</h1>
            <p className="mt-2 text-muted-foreground">
              Este es el archivo ya cargado. Desde la barra puedes mirar cada etapa sin perderlo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ReprocessButton uploadId={uploadId} />
            <Button onClick={() => router.push(hrefForStep('clasificar', uploadId))}>
              Ir a clasificar
            </Button>
          </div>
        </div>
        <SpendFlowBar current="cargar" uploadId={uploadId} pending={pending} />
        <SpendBasisPanel uploadId={uploadId} />
        <Card>
          <CardHeader>
            <CardTitle>Qué hay cargado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong>Estado:</strong> {upload?.status || '—'}</p>
            <p><strong>Filas:</strong> {upload?.total_rows?.toLocaleString() || '—'}</p>
            <p><strong>Procesadas:</strong> {upload?.processed_rows?.toLocaleString() || '—'}</p>
            <p><strong>Pendientes de revisión:</strong> {pending.toLocaleString()}</p>
            <p className="text-muted-foreground">
              Reprocesar borra categorías, Kraljic y el plan. Las líneas y el mapeo se quedan. Para cambiar columnas hay que cargar el archivo otra vez: el original no se guarda.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
