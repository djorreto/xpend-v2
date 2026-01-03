'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabaseBrowser } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/loading'
import { ErrorMessage } from '@/components/ui/error'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Label } from 'recharts'
import type { SourcingPlan } from '@/types'
import { ArrowLeft } from 'lucide-react'

type Quadrant = 'strategic' | 'leverage' | 'bottleneck' | 'non_critical'

export default function KraljicForSourcingPlanPage() {
  const router = useRouter()
  const supabase = supabaseBrowser()

  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [plans, setPlans] = useState<SourcingPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Record<string, Quadrant>>({})

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/login')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*, companies(*)')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profile) throw new Error('Perfil no encontrado')
      setUser(profile)
      setCompany(profile.companies)

      const { data: plansData, error: plansError } = await supabase
        .from('sourcing_plans')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('estimated_spend', { ascending: false })

      if (plansError) throw plansError
      setPlans(plansData || [])
    } catch (err: any) {
      setError(err?.message || 'Error al cargar iniciativas')
    } finally {
      setLoading(false)
    }
  }

  const thresholds = useMemo(() => {
    const spends = plans.map(p => Number(p.estimated_spend || 0))
    const medianSpend = spends.sort((a, b) => a - b)[Math.floor(spends.length / 2)] || 0
    return {
      impact_high: medianSpend || 1,
      risk_high: 50 // heurístico
    }
  }, [plans])

  const inferQuadrant = (plan: SourcingPlan): Quadrant => {
    const override = overrides[plan.id]
    if (override) return override

    const impact = Number(plan.estimated_spend || 0)
    const risk =
      (plan.is_spot ? 70 : 40) +
      (plan.status === 'in_progress' ? 5 : 0) +
      (plan.status === 'planned' ? 0 : 5)

    const impactHigh = impact >= thresholds.impact_high
    const riskHigh = risk >= thresholds.risk_high

    if (impactHigh && riskHigh) return 'strategic'
    if (impactHigh && !riskHigh) return 'leverage'
    if (!impactHigh && riskHigh) return 'bottleneck'
    return 'non_critical'
  }

  const data = plans.map(plan => ({
    id: plan.id,
    title: plan.title,
    category: plan.category || 'Sin categoría',
    impact: Number(plan.estimated_spend || 0),
    risk:
      (plan.is_spot ? 70 : 40) +
      (plan.status === 'in_progress' ? 5 : 0) +
      (plan.status === 'planned' ? 0 : 5),
    quadrant: inferQuadrant(plan)
  }))

  const colors: Record<Quadrant, string> = {
    strategic: '#ef4444',
    leverage: '#22c55e',
    bottleneck: '#eab308',
    non_critical: '#3b82f6'
  }

  if (loading) {
    return (
      <MainLayout user={user} companyName={company?.name}>
        <LoadingSpinner />
      </MainLayout>
    )
  }

  if (error) {
    return (
      <MainLayout user={user} companyName={company?.name}>
        <ErrorMessage
          title="Error al cargar la Matriz Kraljic"
          message={error}
          onRetry={loadData}
        />
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => router.push('/sourcing-plan')} className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Sourcing Plan
            </Button>
            <h1 className="text-3xl font-bold">Matriz de Kraljic (Iniciativas)</h1>
            <p className="text-muted-foreground mt-2">
              Distribución de las iniciativas del Sourcing Plan. Puedes ajustar el cuadrante manualmente para graficar.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Matriz de Kraljic</CardTitle>
            <CardDescription>
              Impacto (eje X) se aproxima al gasto estimado; Riesgo (eje Y) se estima con heurística (spot / estado). Ajusta el cuadrante en la tabla y se actualizará el gráfico (no persistente).
            </CardDescription>
          </CardHeader>
          <CardContent style={{ height: 420 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
              >
                <CartesianGrid />
                <XAxis type="number" dataKey="impact" name="Impacto" tick={{ fontSize: 12 }}>
                  <Label value="Impacto (gasto estimado)" offset={-10} position="insideBottom" />
                </XAxis>
                <YAxis type="number" dataKey="risk" name="Riesgo" tick={{ fontSize: 12 }}>
                  <Label value="Riesgo" angle={-90} position="insideLeft" />
                </YAxis>
                <Tooltip
                  formatter={(value: any, name: any, props: any) => [`${value}`, name]}
                  contentStyle={{ fontSize: 12 }}
                  cursor={{ strokeDasharray: '3 3' }}
                  labelFormatter={() => ''}
                />
                <Scatter data={data} shape="circle">
                  {data.map((entry) => (
                    <Cell key={entry.id} fill={colors[entry.quadrant]} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ajustar cuadrante manual</CardTitle>
            <CardDescription>Selecciona el cuadrante para reflejarlo en el gráfico (no se persiste todavía).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {plans.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay iniciativas en el Sourcing Plan.</p>
            )}
            {plans.map(plan => (
              <div key={plan.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                <div>
                  <div className="font-medium">{plan.title}</div>
                  <div className="text-xs text-muted-foreground">{plan.category || 'Sin categoría'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={overrides[plan.id] || inferQuadrant(plan)}
                    onValueChange={(value: Quadrant) => {
                      setOverrides(prev => ({ ...prev, [plan.id]: value }))
                    }}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="strategic">Estratégicas</SelectItem>
                      <SelectItem value="leverage">Apalancamiento</SelectItem>
                      <SelectItem value="bottleneck">Cuello de Botella</SelectItem>
                      <SelectItem value="non_critical">No Críticas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}

