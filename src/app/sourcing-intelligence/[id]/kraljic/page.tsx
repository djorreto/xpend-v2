'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabaseBrowser } from '@/lib/supabase'
import { ArrowLeft, Download } from 'lucide-react'
import { SIPlanItem } from '@/types'
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Label } from 'recharts'

export default function KraljicPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = supabaseBrowser()
  const uploadId = params.id as string

  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
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

        // Buscar plan
        const { data: planData } = await supabase
          .from('si_procurement_plans')
          .select('id')
          .eq('upload_id', uploadId)
          .eq('company_id', profile.company_id)
          .single()

        if (planData) {
          // Cargar items
          const { data: itemsData } = await supabase
            .from('si_plan_items')
            .select('*')
            .eq('plan_id', planData.id)

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

  // Transformar datos para el gráfico con tamaño proporcional al gasto
  const totalSpend = items.reduce((sum, item) => sum + item.total_spend, 0)
  const maxSpend = Math.max(...items.map(item => item.total_spend))

  const chartData = items.map(item => {
    // Calcular tamaño del círculo basado en el gasto (20-400 para buena visualización)
    const spendPercentage = item.total_spend / totalSpend
    const size = Math.max(20, Math.min(400, spendPercentage * 2000))

    return {
      name: item.category,
      impact: (item.impact_score || 0) * 100,
      risk: (item.risk_score || 0) * 100,
      spend: item.total_spend,
      spendPercentage: (spendPercentage * 100).toFixed(1),
      z: size, // Tamaño del círculo
      quadrant: item.kraljic_quadrant,
      strategy: item.strategy
    }
  })

  const getQuadrantColor = (quadrant: string) => {
    const colors: Record<string, string> = {
      strategic: '#EF4444', // Rojo
      leverage: '#10B981', // Verde
      bottleneck: '#F59E0B', // Amarillo
      non_critical: '#3B82F6' // Azul
    }
    return colors[quadrant] || '#6B7280'
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-4 border rounded-lg shadow-lg min-w-[200px]">
          <p className="font-bold mb-2 text-lg">{data.name}</p>
          <div className="space-y-1">
            <p className="text-sm">📊 Impacto: <strong>{data.impact.toFixed(1)}%</strong></p>
            <p className="text-sm">⚠️ Riesgo: <strong>{data.risk.toFixed(1)}%</strong></p>
            <p className="text-sm">💰 Gasto: <strong>${data.spend.toLocaleString()}</strong></p>
            <p className="text-sm">📈 % del Total: <strong>{data.spendPercentage}%</strong></p>
            <p className="text-sm">🎯 Estrategia: <strong>{data.strategy}</strong></p>
          </div>
        </div>
      )
    }
    return null
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

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => router.push(`/sourcing-intelligence/${uploadId}/plan`)}
              className="mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Plan
            </Button>
            <h1 className="text-3xl font-bold">Matriz de Kraljic</h1>
            <p className="text-muted-foreground mt-2">
              Clasificación estratégica de categorías por impacto y riesgo
            </p>
          </div>
          <Button className="bg-gradient-to-r from-[#2AD4D2] to-[#3BE7AE]">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>

        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Matriz de Kraljic</CardTitle>
            <CardDescription>
              Visualización interactiva de categorías por impacto en el negocio y riesgo de suministro
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[600px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="risk"
                    name="Riesgo"
                    domain={[0, 100]}
                  >
                    <Label value="Riesgo de Suministro →" offset={-10} position="insideBottom" />
                  </XAxis>
                  <YAxis
                    type="number"
                    dataKey="impact"
                    name="Impacto"
                    domain={[0, 100]}
                  >
                    <Label value="← Impacto en el Negocio" angle={-90} position="insideLeft" />
                  </YAxis>
                  <ZAxis
                    type="number"
                    dataKey="z"
                    range={[100, 2000]}
                    name="Gasto"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Scatter data={chartData} fill="#8884d8">
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getQuadrantColor(entry.quadrant!)} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* Leyenda de tamaños */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>💡 Nota:</strong> El tamaño de cada círculo es proporcional al % de gasto.
                Círculos más grandes = mayor porcentaje del gasto total en esa categoría.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Leyenda */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                <CardTitle className="text-base">Estratégicas</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Alto impacto + Alto riesgo
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Requieren relaciones estratégicas a largo plazo
              </p>
              <div className="mt-3">
                <Badge variant="outline" className="text-xs">
                  {items.filter(i => i.kraljic_quadrant === 'strategic').length} categorías
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                <CardTitle className="text-base">Apalancamiento</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Alto impacto + Bajo riesgo
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Aprovechar poder de negociación
              </p>
              <div className="mt-3">
                <Badge variant="outline" className="text-xs">
                  {items.filter(i => i.kraljic_quadrant === 'leverage').length} categorías
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                <CardTitle className="text-base">Cuello de Botella</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Bajo impacto + Alto riesgo
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Asegurar suministro continuo
              </p>
              <div className="mt-3">
                <Badge variant="outline" className="text-xs">
                  {items.filter(i => i.kraljic_quadrant === 'bottleneck').length} categorías
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                <CardTitle className="text-base">No Críticas</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Bajo impacto + Bajo riesgo
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Eficiencia y automatización
              </p>
              <div className="mt-3">
                <Badge variant="outline" className="text-xs">
                  {items.filter(i => i.kraljic_quadrant === 'non_critical').length} categorías
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Categorías por Cuadrante */}
        <Card>
          <CardHeader>
            <CardTitle>Detalle por Cuadrante</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {['strategic', 'leverage', 'bottleneck', 'non_critical'].map((quadrant) => {
                const quadrantItems = items.filter(i => i.kraljic_quadrant === quadrant)
                const quadrantLabels: Record<string, string> = {
                  strategic: 'Estratégicas',
                  leverage: 'Apalancamiento',
                  bottleneck: 'Cuello de Botella',
                  non_critical: 'No Críticas'
                }

                if (quadrantItems.length === 0) return null

                return (
                  <div key={quadrant}>
                    <h4 className="font-medium mb-2">{quadrantLabels[quadrant]}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {quadrantItems.map(item => (
                        <Badge
                          key={item.id}
                          variant="outline"
                          className="justify-start"
                        >
                          {item.category}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}

