'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { format } from 'date-fns'
import { CalendarIcon, ArrowLeft, Save, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabaseBrowser } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { LoadingSpinner } from '@/components/ui/loading'
import { ErrorMessage } from '@/components/ui/error'

export default function NewProjectPage() {
  const supabase = supabaseBrowser()
  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [projectStatus, setProjectStatus] = useState('planning')
  const [startDate, setStartDate] = useState<Date | undefined>(new Date())
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [budget, setBudget] = useState<string>('')
  const [currency, setCurrency] = useState('USD')
  const [sourcingPlanId, setSourcingPlanId] = useState('')
  const [sourcingPlans, setSourcingPlans] = useState<any[]>([])
  const router = useRouter()
  const { addToast } = useToast()

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser()
      if (userError || !authUser) {
        throw new Error('Usuario no autenticado')
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (profileError || !profile) {
        throw new Error('Perfil no encontrado')
      }

      setUser({
        name: profile.full_name || authUser.email,
        email: authUser.email,
        role: profile.role
      })

      if (profile.company_id) {
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profile.company_id)
          .single()

        if (!companyError && companyData) {
          setCompany(companyData)
        }

        // Load active sourcing plans (project type, planned or in_progress)
        const currentYear = new Date().getFullYear()
        const { data: plansData, error: plansError } = await supabase
          .from('sourcing_plans')
          .select('id, title, plan_year, quarter, status')
          .eq('company_id', profile.company_id)
          .eq('initiative_type', 'project')
          .gte('plan_year', currentYear - 1)
          .in('status', ['planned', 'in_progress'])
          .is('project_id', null)
          .order('plan_year', { ascending: false })
          .order('quarter', { ascending: true })

        if (!plansError && plansData) {
          setSourcingPlans(plansData)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos de usuario')
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudieron cargar los datos de usuario'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !company) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo obtener la información del usuario o empresa.'
      })
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: projectName,
          description: projectDescription,
          company_id: company.id,
          status: projectStatus,
          start_date: startDate ? format(startDate, 'yyyy-MM-dd') : null,
          end_date: endDate ? format(endDate, 'yyyy-MM-dd') : null,
          budget: budget ? parseFloat(budget) : null,
          currency: currency,
          sourcing_plan_id: sourcingPlanId || null,
          created_by: user.id,
        })
        .select()
        .single()

      if (error) throw error

      // If sourcing_plan_id is provided, update the sourcing plan with the project_id
      if (sourcingPlanId) {
        await supabase
          .from('sourcing_plans')
          .update({ 
            project_id: data.id,
            status: 'in_progress' 
          })
          .eq('id', sourcingPlanId)
      }

      addToast({
        type: 'success',
        title: 'Proyecto creado',
        message: `El proyecto "${projectName}" ha sido creado exitosamente.`,
      })
      router.push(`/projects/${data.id}`)
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Error al crear el proyecto.',
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <MainLayout user={user} companyName={company?.name || 'Spendora'}>
        <LoadingSpinner />
      </MainLayout>
    )
  }

  if (error) {
    return (
      <MainLayout user={user} companyName={company?.name || 'Spendora'}>
        <ErrorMessage
          title="Error de carga"
          message={error}
          onRetry={loadUserData}
        />
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName={company?.name || 'Spendora'}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Crear Nuevo Proyecto</h1>
              <p className="text-muted-foreground">
                Define los detalles de tu nuevo proyecto de Strategic Sourcing
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Detalles del Proyecto</CardTitle>
            <CardDescription>
              Información básica y fechas clave del proyecto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del Proyecto</Label>
                  <Input
                    id="name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Ej: Renovación Contrato Proveedor X"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Estado</Label>
                  <Select value={projectStatus} onValueChange={setProjectStatus}>
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Selecciona un estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">Planificación</SelectItem>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="on_hold">En Pausa</SelectItem>
                      <SelectItem value="completed">Completado</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Describe brevemente el objetivo y alcance del proyecto."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Fecha de Inicio</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={'outline'}
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !startDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, 'PPP') : <span>Selecciona una fecha</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Fecha de Fin (Opcional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={'outline'}
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !endDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, 'PPP') : <span>Selecciona una fecha</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="budget">Presupuesto (Opcional)</Label>
                  <Input
                    id="budget"
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="Ej: 100000.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Moneda</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="currency">
                      <SelectValue placeholder="Selecciona una moneda" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="JPY">JPY</SelectItem>
                      <SelectItem value="CLP">CLP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Sourcing Plan */}
              <div className="space-y-2">
                <Label htmlFor="sourcing_plan_id">Iniciativa del Sourcing Plan (Opcional)</Label>
                <Select value={sourcingPlanId} onValueChange={setSourcingPlanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una iniciativa del plan..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin asociar</SelectItem>
                    {sourcingPlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.title} ({plan.plan_year} {plan.quarter})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Vincula este proyecto con una iniciativa del Sourcing Plan para seguimiento de ahorros
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creando Proyecto...' : 'Crear Proyecto'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}