'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabaseBrowser } from '@/lib/supabase'
import { canReadSpendRole } from '@/lib/spend-privacy'
import { SpendFlowBar } from '@/components/spend/spend-flow-bar'

const FIELD_LABEL: Record<string, string> = {
  description: 'Descripción',
  amount: 'Monto',
  supplier_name: 'Proveedor',
  purchase_order: 'Orden de compra',
  currency: 'Moneda',
  cost_center: 'Centro de costo',
  purchase_date: 'Fecha',
  sheet_used: 'Hoja',
}

export default function MappingInspectPage() {
  const router = useRouter()
  const params = useParams()
  const uploadId = params.id as string
  const supabase = supabaseBrowser()
  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [fileName, setFileName] = useState('')
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      const { data: profile } = await supabase.from('profiles').select('*, companies(*)').eq('id', session.user.id).single()
      if (!profile || !canReadSpendRole(profile.role)) {
        setLoading(false)
        return
      }
      setUser(profile)
      setCompany(profile.companies)
      const { data } = await supabase
        .from('si_uploads')
        .select('file_name, column_mapping')
        .eq('id', uploadId)
        .eq('company_id', profile.company_id)
        .single()
      setFileName(data?.file_name || '')
      setMapping((data?.column_mapping || {}) as Record<string, string>)
      setLoading(false)
    })()
  }, [uploadId])

  const rows = Object.entries(mapping).filter(([, value]) => value && value !== 'none')

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Mapeo usado</h1>
          <p className="mt-2 text-muted-foreground">{fileName || 'Análisis'} · columnas con las que se leyeron las líneas.</p>
        </div>
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-gray-900" />
          </div>
        ) : (
          <>
            <SpendFlowBar current="mapear" uploadId={uploadId} />
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-6 text-sm text-amber-950">
                Esto es lo que ya se usó. El archivo original no se guarda, así que cambiar una columna aquí no se puede. Para mapear de otra forma, carga el archivo de nuevo. Reprocesar no toca este mapeo: solo borra la clasificación y el plan.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Columnas</CardTitle>
                <CardDescription>Cada campo de Xpend y la columna del archivo de la que salió.</CardDescription>
              </CardHeader>
              <CardContent>
                {rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Esta carga no guardó el mapeo.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 font-medium">Campo</th>
                        <th className="py-2 font-medium">Columna del archivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(([field, column]) => (
                        <tr key={field} className="border-b last:border-0">
                          <td className="py-2">{FIELD_LABEL[field] || field}</td>
                          <td className="py-2">{column}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  )
}
