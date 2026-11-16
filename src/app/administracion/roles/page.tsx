'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Minus } from 'lucide-react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/loading'
import { EmptyHint } from '@/components/workspace-blocks'
import { loadAppSession, type AppSession } from '@/lib/offer-room'
import { CAPABILITY_LABELS, CAPABILITY_ROLES, ROLE_LABELS, can, navigationFor, type Capability } from '@/lib/navigation'

const ROLES = ['admin', 'manager', 'analyst', 'viewer', 'supplier'] as const

export default function RolesPage() {
  const router = useRouter()
  const [session, setSession] = useState<AppSession | null>(null)

  useEffect(() => {
    loadAppSession().then(appSession => {
      if (!appSession) {
        router.replace('/login')
        return
      }
      if (appSession.role === 'supplier') {
        router.replace('/sala')
        return
      }
      setSession(appSession)
    })
  }, [router])

  if (!session) return <MainLayout><LoadingSpinner /></MainLayout>
  const layoutUser = { name: session.name, email: session.email, role: session.role }

  if (!can(session.role, 'administer')) {
    return (
      <MainLayout user={layoutUser} companyName={session.companyName}>
        <EmptyHint>Esta vista es para administradores.</EmptyHint>
      </MainLayout>
    )
  }

  const capabilities = (Object.keys(CAPABILITY_ROLES) as Capability[]).filter(capability => capability !== 'platform')

  return (
    <MainLayout user={layoutUser} companyName={session.companyName}>
      <div className="space-y-5">
        <div>
          <h1>Roles y permisos</h1>
          <p className="mt-1 max-w-3xl text-[13px] text-petrol-blue/75">
            Qué puede hacer cada rol hoy. Las reglas las aplica la base de datos; el menú solo oculta lo que un rol no puede usar.
            Para cambiar el rol de una persona, ve a <Link href="/users" className="underline">Usuarios</Link>.
          </p>
        </div>

        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[640px] text-[12.5px]">
              <caption className="sr-only">Permisos por rol</caption>
              <thead>
                <tr className="border-b border-petrol-blue/10 text-left text-petrol-blue/75">
                  <th scope="col" className="px-4 py-3 font-medium">Acción</th>
                  {ROLES.map(role => <th key={role} scope="col" className="px-3 py-3 text-center font-medium">{ROLE_LABELS[role]}</th>)}
                </tr>
              </thead>
              <tbody>
                {capabilities.map(capability => (
                  <tr key={capability} className="border-b border-petrol-blue/[0.06]">
                    <th scope="row" className="px-4 py-2.5 text-left font-normal text-petrol-blue">{CAPABILITY_LABELS[capability]}</th>
                    {ROLES.map(role => (
                      <td key={role} className="px-3 py-2.5 text-center">
                        {can(role, capability)
                          ? <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="Sí" />
                          : <Minus className="mx-auto h-4 w-4 text-petrol-blue/25" aria-label="No" />}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row" className="px-4 py-2.5 text-left font-normal text-petrol-blue">Secciones del menú</th>
                  {ROLES.map(role => (
                    <td key={role} className="px-3 py-2.5 text-center text-[12px] text-petrol-blue/75">
                      {navigationFor(role).map(section => section.label).join(', ')}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        <p className="text-[12px] text-petrol-blue/75">
          El menú del proveedor solo muestra sus invitaciones, NDA y ofertas; las pantallas internas lo redirigen a su portal.
          Los roles personalizados y los equipos de Procurement llegarán en una etapa posterior.
        </p>
      </div>
    </MainLayout>
  )
}
