'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabaseBrowser } from '@/lib/supabase'
import { Target, TrendingUp, Users, DollarSign, ArrowRight, Download } from 'lucide-react'
import { SIProcurementPlan, SIPlanItem } from '@/types'

export default function PlanPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = supabaseBrowser()
  const uploadId = params.id as string

  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [plan, setPlan] = useState<SIProcurementPlan | null>(null)
  const [items, setItems] = useState<SIPlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    loadData()
  }, [uploadId])

  const loadData = async () => {
    try {
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

      if (profile) {
        setUser(profile)
        setCompany(profile.companies)

        // Buscar plan existente
        const { data: planData } = await supabase
          .from('si_procurement_plans')
          .select('*')
          .eq('upload_id', uploadId)
          .eq('company_id', profile.company_id)
          .single()

        if (planData) {
          setPlan(planData)

          // Cargar items del plan
          const { data: itemsData } = await supabase
            .from('si_plan_items')
            .select('*')
            .eq('plan_id', planData.id)
            .order('total_spend', { ascending: false })

          if (itemsData) {
            setItems(itemsData)
          }
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGeneratePlan = async () => {
    setGenerating(true)
    try {
      const response = await fetch('/api/si/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upload_id: uploadId,
          plan_name: `Plan de Compras ${new Date().getFullYear()}`,
          plan_year: new Date().getFullYear()
        })
      })

      const result = await response.json()
      if (response.ok) {
        await loadData()
      } else {
        alert(`❌ Error: ${result.error}`)
      }
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`)
    } finally {
      setGenerating(false)
    }
  }

  const getStrategyBadge = (strategy: string) => {
    const colors: Record<string, string> = {
      licitar: 'bg-blue-500',
      consolidar: 'bg-green-500',
      negociar_marco: 'bg-purple-500',
      dual_sourcing: 'bg-yellow-500',
      monitorear: 'bg-gray-500',
      optimizar: 'bg-indigo-500'
    }
    return <Badge className={colors[strategy] || 'bg-gray-500'}>{strategy.replace('_', ' ')}</Badge>
  }

  const getQuadrantBadge = (quadrant: string) => {
    const info: Record<string, { label: string; color: string }> = {
      strategic: { label: 'Estratégicas', color: 'bg-red-500' },
      leverage: { label: 'Apalancamiento', color: 'bg-green-500' },
      bottleneck: { label: 'Cuello de Botella', color: 'bg-yellow-500' },
      non_critical: { label: 'No Críticas', color: 'bg-blue-500' }
    }
    const data = info[quadrant] || info.non_critical
    return <Badge className={data.color}>{data.label}</Badge>
  }

  if (loading) {
    return (
      <MainLayout user={user} companyName={company?.name}>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </MainLayout>
    )
  }

  if (!plan) {
    return (
      <MainLayout user={user} companyName={company?.name}>
        <div className="max-w-2xl mx-auto text-center py-12">
          <Target className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-2xl font-bold mb-4">Plan de Compras No Generado</h2>
          <p className="text-muted-foreground mb-6">
            Aún no has generado el plan de compras para este análisis
          </p>
          <Button
            onClick={handleGeneratePlan}
            disabled={generating}
            size="lg"
            className="bg-gradient-to-r from-[#2AD4D2] to-[#3BE7AE]"
          >
            {generating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Generando Plan...
              </>
            ) : (
              <>
                Generar Plan Automáticamente
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{plan.name}</h1>
            <p className="text-muted-foreground mt-2">
              Año {plan.plan_year} · {items.length} categorías analizadas
            </p>
          </div>
          <div className="flex space-x-3">
            <Button
              onClick={() => router.push(`/sourcing-intelligence/${uploadId}/insights`)}
              variant="outline"
            >
              📊 Informe Preliminar
            </Button>
            <Button
              onClick={() => router.push(`/sourcing-intelligence/${uploadId}/kraljic`)}
              variant="outline"
            >
              Ver Matriz Kraljic
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button className="bg-gradient-to-r from-[#2AD4D2] to-[#3BE7AE]">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gasto Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${plan.total_spend.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ahorro Proyectado</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${plan.projected_savings_amount?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {plan.projected_savings_percentage?.toFixed(1)}% del gasto
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categorías</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{plan.category_count}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Proveedores</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{plan.supplier_count}</div>
            </CardContent>
          </Card>
        </div>

        {/* Plan Items Table */}
        <Card>
          <CardHeader>
            <CardTitle>Estrategias por Categoría</CardTitle>
            <CardDescription>
              Plan de compras generado automáticamente con IA
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gasto Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedores</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estrategia</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ahorro</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trimestre</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kraljic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap font-medium">{item.category}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        ${item.total_spend.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {item.supplier_count}
                        {item.supplier_concentration && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({item.supplier_concentration.toFixed(0)}%)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {getStrategyBadge(item.strategy)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-green-600 font-medium">
                        {item.projected_savings_percentage?.toFixed(1)}%
                        <div className="text-xs text-gray-500">
                          ${item.projected_savings_amount?.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <Badge variant="outline">{item.recommended_quarter}</Badge>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {getQuadrantBadge(item.kraljic_quadrant!)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}

