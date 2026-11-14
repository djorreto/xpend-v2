'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@/components/ui/button'
import { supabaseBrowser } from '@/lib/supabase'
import { SpendGutsCanvas } from '@/components/spend/spend-guts-canvas'
import { SpendFlowBar } from '@/components/spend/spend-flow-bar'

export default function FlujoPage() {
  const router = useRouter()
  const supabase = supabaseBrowser()
  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('*, companies(*)')
        .eq('id', session.user.id)
        .single()
      if (!profile) return
      setUser(profile)
      setCompany(profile.companies)
    })()
  }, [])

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Flujo de clasificación</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Las entrañas del gasto: qué entra, qué clasifica y qué sale. Un clic en un nodo abre la pieza que ya se puede editar.
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push('/sourcing-intelligence/cerebro')}>
            Cerebro
          </Button>
        </div>
        <SpendFlowBar current="clasificar" />
        <SpendGutsCanvas />
      </div>
    </MainLayout>
  )
}
