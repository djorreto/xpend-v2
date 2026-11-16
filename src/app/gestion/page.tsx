'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { LoadingSpinner } from '@/components/ui/loading'
import { EmptyHint } from '@/components/workspace-blocks'
import { ManagementDashboard } from '@/components/management-dashboard'
import { loadAppSession, type AppSession } from '@/lib/offer-room'
import { can } from '@/lib/navigation'

export default function GestionPage() {
  const router = useRouter()
  const [session, setSession] = useState<AppSession | null>(null)

  useEffect(() => {
    loadAppSession().then(appSession => {
      if (!appSession) return router.replace('/login')
      if (appSession.role === 'supplier') return router.replace('/sala')
      if (!can(appSession.role, 'manageTeams')) return router.replace('/dashboard')
      setSession(appSession)
    })
  }, [router])

  if (!session) return <MainLayout><LoadingSpinner /></MainLayout>
  const layoutUser = { name: session.name, email: session.email, role: session.role }
  return (
    <MainLayout user={layoutUser} companyName={session.companyName}>
      {session.companyId ? <ManagementDashboard session={session} /> : <EmptyHint>Tu usuario no está asociado a una empresa.</EmptyHint>}
    </MainLayout>
  )
}
