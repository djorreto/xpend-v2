'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabaseBrowser } from '@/lib/supabase'
import { ArrowLeft, TrendingUp, AlertTriangle, Target, Users, FileText } from 'lucide-react'
import { SIPlanItem } from '@/types'

export default function InsightsPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = supabaseBrowser()
  const uploadId = params.id as string
  
  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [plan, setPlan] = useState<any>(null)
  const [items, setItems] = useState<SIPlanItem[]>([])
  const [loading, setLoading] = useState(true)

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

        const { data: planData } = await supabase
          .from('si_procurement_plans')
          .select('*')
          .eq('upload_id', uploadId)
          .eq('company_id', profile.company_id)
          .single()

        if (planData) {
          setPlan(planData)

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

  // Análisis de datos
  const totalSpend = items.reduce((sum, item) => sum + item.total_spend, 0)
  const topCategories = items.slice(0, 5)
  const topSpend = topCategories.reduce((sum, item) => sum + item.total_spend, 0)
  const topSpendPercentage = (topSpend / totalSpend) * 100

  // Oportunidades de ahorro
  const savingsOpportunities = items
    .filter(item => (item.projected_savings_percentage || 0) > 5)
    .sort((a, b) => (b.projected_savings_amount || 0) - (a.projected_savings_amount || 0))
    .slice(0, 5)

  // Concentración de proveedores
  const highConcentration = items.filter(item => (item.supplier_concentration || 0) > 70)
  const lowConcentration = items.filter(item => item.supplier_count >= 5)

  // Categorías estratégicas
  const strategic = items.filter(item => item.kraljic_quadrant === 'strategic')
  const leverage = items.filter(item => item.kraljic_quadrant === 'leverage')
  const bottleneck = items.filter(item => item.kraljic_quadrant === 'bottleneck')

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
        <div className="text-center py-12">
          <p className="text-muted-foreground">No hay plan generado para este análisis</p>
          <Button onClick={() => router.push(`/sourcing-intelligence/${uploadId}/classify`)} className="mt-4">
            Volver a Clasificación
          </Button>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Button
            variant="ghost"
            onClick={() => router.push(`/sourcing-intelligence/${uploadId}/plan`)}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al Plan
          </Button>
          <h1 className="text-3xl font-bold flex items-center space-x-3">
            <FileText className="h-8 w-8" style={{ color: '#2AD4D2' }} />
            <span>Informe Preliminar</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            Análisis objetivo de la situación actual del gasto
          </p>
        </div>

        {/* Resumen Ejecutivo */}
        <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-blue-600" />
              <span>Resumen Ejecutivo</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-gray-800">
              <strong>Gasto Total Analizado:</strong> ${totalSpend.toLocaleString()} USD distribuido en {items.length} categorías principales.
            </p>
            <p className="text-gray-800">
              <strong>Concentración de Gasto:</strong> Las 5 categorías principales representan el <strong>{topSpendPercentage.toFixed(1)}%</strong> del gasto total.
            </p>
            <p className="text-gray-800">
              <strong>Ahorro Proyectado:</strong> ${plan.projected_savings_amount?.toLocaleString() || 0} USD 
              ({plan.projected_savings_percentage?.toFixed(1)}% del gasto total) mediante optimización estratégica.
            </p>
          </CardContent>
        </Card>

        {/* Oportunidades Principales */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span>Principales Oportunidades de Ahorro</span>
            </CardTitle>
            <CardDescription>
              Categorías con mayor potencial de optimización
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {savingsOpportunities.length > 0 ? (
                savingsOpportunities.map((item, index) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {index + 1}. {item.category}
                      </p>
                      <p className="text-sm text-gray-600">
                        Gasto: ${item.total_spend.toLocaleString()} • {item.supplier_count} proveedores
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">
                        {item.projected_savings_percentage?.toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-600">
                        ${item.projected_savings_amount?.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No se identificaron oportunidades significativas</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Análisis de Riesgos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Alta Concentración */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                <span>Alta Concentración de Proveedores</span>
              </CardTitle>
              <CardDescription>
                Categorías con riesgo de dependencia
              </CardDescription>
            </CardHeader>
            <CardContent>
              {highConcentration.length > 0 ? (
                <div className="space-y-2">
                  {highConcentration.map(item => (
                    <div key={item.id} className="p-2 bg-red-50 rounded border border-red-200">
                      <p className="font-medium text-sm">{item.category}</p>
                      <p className="text-xs text-gray-600">
                        {item.supplier_concentration?.toFixed(0)}% del gasto en 1 proveedor ({item.main_supplier})
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Sin concentración alta detectada</p>
              )}
            </CardContent>
          </Card>

          {/* Buena Diversificación */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-green-600">
                <Users className="h-5 w-5" />
                <span>Buena Diversificación</span>
              </CardTitle>
              <CardDescription>
                Categorías con múltiples proveedores
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lowConcentration.length > 0 ? (
                <div className="space-y-2">
                  {lowConcentration.slice(0, 5).map(item => (
                    <div key={item.id} className="p-2 bg-green-50 rounded border border-green-200">
                      <p className="font-medium text-sm">{item.category}</p>
                      <p className="text-xs text-gray-600">
                        {item.supplier_count} proveedores activos
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No hay categorías con alta diversificación</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recomendaciones Estratégicas */}
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <CardHeader>
            <CardTitle>🎯 Recomendaciones Estratégicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {strategic.length > 0 && (
              <div className="p-4 bg-white rounded-lg border border-red-300">
                <h4 className="font-bold text-red-900 mb-2">🔴 Categorías Estratégicas ({strategic.length})</h4>
                <p className="text-sm text-gray-700 mb-2">
                  Alto impacto y alto riesgo. Requieren relaciones estratégicas a largo plazo y monitoreo constante.
                </p>
                <div className="flex flex-wrap gap-2">
                  {strategic.map(item => (
                    <Badge key={item.id} variant="outline" className="bg-red-50">
                      {item.category}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {leverage.length > 0 && (
              <div className="p-4 bg-white rounded-lg border border-green-300">
                <h4 className="font-bold text-green-900 mb-2">🟢 Categorías de Apalancamiento ({leverage.length})</h4>
                <p className="text-sm text-gray-700 mb-2">
                  Alto impacto, bajo riesgo. <strong>Mayor oportunidad de ahorro mediante licitaciones y consolidación.</strong>
                </p>
                <div className="flex flex-wrap gap-2">
                  {leverage.map(item => (
                    <Badge key={item.id} variant="outline" className="bg-green-50">
                      {item.category}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {bottleneck.length > 0 && (
              <div className="p-4 bg-white rounded-lg border border-yellow-300">
                <h4 className="font-bold text-yellow-900 mb-2">🟡 Cuellos de Botella ({bottleneck.length})</h4>
                <p className="text-sm text-gray-700 mb-2">
                  Bajo impacto, alto riesgo. Priorizar aseguramiento de suministro y dual sourcing.
                </p>
                <div className="flex flex-wrap gap-2">
                  {bottleneck.map(item => (
                    <Badge key={item.id} variant="outline" className="bg-yellow-50">
                      {item.category}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 bg-white rounded-lg border border-blue-300">
              <h4 className="font-bold text-blue-900 mb-2">💡 Plan de Acción Recomendado</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                <li><strong>Corto Plazo (Q1):</strong> Iniciar licitaciones en categorías de Apalancamiento para capturar ahorros rápidos.</li>
                <li><strong>Medio Plazo (Q2-Q3):</strong> Desarrollar estrategias de dual sourcing para Cuellos de Botella.</li>
                <li><strong>Largo Plazo (Q4):</strong> Establecer acuerdos marco con proveedores estratégicos en categorías críticas.</li>
                <li><strong>Continuo:</strong> Monitorear concentración de proveedores y ajustar estrategias según performance.</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Navegación */}
        <div className="flex space-x-4">
          <Button
            variant="outline"
            onClick={() => router.push(`/sourcing-intelligence/${uploadId}/plan`)}
          >
            Ver Plan Detallado
          </Button>
          <Button
            onClick={() => router.push(`/sourcing-intelligence/${uploadId}/kraljic`)}
            className="bg-gradient-to-r from-[#2AD4D2] to-[#3BE7AE]"
          >
            Ver Matriz de Kraljic
          </Button>
        </div>
      </div>
    </MainLayout>
  )
}

