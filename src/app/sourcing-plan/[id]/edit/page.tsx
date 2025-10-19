'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import { useVersion } from '@/contexts/version-context'
import { supabaseBrowser } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/loading'
import { ErrorMessage } from '@/components/ui/error'
import { useToast } from '@/components/ui/toast'
import { mockSourcingPlansData } from '@/lib/mock-data'
import type { Quarter, InitiativeType, PlanStatus } from '@/types'

export default function EditSourcingPlanPage() {
  const router = useRouter()
  const params = useParams()
  const planId = params.id as string
  const { isMockup } = useVersion()
  const { addToast } = useToast()

  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Datos del formulario
  const [formData, setFormData] = useState({
    plan_year: new Date().getFullYear(),
    quarter: 'Q1' as Quarter,
    title: '',
    description: '',
    category: '',
    initiative_type: 'licitacion' as InitiativeType,
    estimated_spend: '',
    actual_spend: '',
    currency: 'CLP',
    projected_savings_percentage: '',
    actual_savings_percentage: '',
    status: 'planned' as PlanStatus,
    is_spot: false,
    notes: ''
  })

  useEffect(() => {
    loadPlan()
  }, [planId, isMockup])

  const loadPlan = async () => {
    try {
      setLoading(true)
      setError(null)

      const isSupabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (isMockup || !isSupabaseConfigured) {
        // Modo mockup
        setUser({
          name: 'Usuario Demo',
          email: 'demo@xpend.cl',
          role: 'admin'
        })
        setCompany({
          name: 'Xpend Demo',
          id: 'company-1'
        })

        const mockPlan = mockSourcingPlansData.find(p => p.id === planId)
        if (!mockPlan) throw new Error('Iniciativa no encontrada')

        setFormData({
          plan_year: mockPlan.plan_year,
          quarter: mockPlan.quarter,
          title: mockPlan.title,
          description: mockPlan.description || '',
          category: mockPlan.category || '',
          initiative_type: mockPlan.initiative_type,
          estimated_spend: mockPlan.estimated_spend.toString(),
          actual_spend: mockPlan.actual_spend?.toString() || '',
          currency: mockPlan.currency,
          projected_savings_percentage: mockPlan.projected_savings_percentage?.toString() || '',
          actual_savings_percentage: mockPlan.actual_savings_percentage?.toString() || '',
          status: mockPlan.status,
          is_spot: mockPlan.is_spot,
          notes: mockPlan.notes || ''
        })

        setLoading(false)
        return
      }

      // Modo funcional con Supabase
      const supabase = supabaseBrowser()
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser()
      if (userError || !authUser) throw new Error('Usuario no autenticado')

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (profileError || !profile) throw new Error('Perfil no encontrado')

      setUser({
        id: authUser.id,
        name: profile.full_name || authUser.email,
        email: authUser.email,
        role: profile.role
      })

      if (profile.company_id) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profile.company_id)
          .single()

        if (companyData) setCompany(companyData)

        // Cargar plan específico
        const { data: planData, error: planError } = await supabase
          .from('sourcing_plans')
          .select('*')
          .eq('id', planId)
          .eq('company_id', profile.company_id)
          .single()

        if (planError) throw planError
        if (!planData) throw new Error('Iniciativa no encontrada')

        setFormData({
          plan_year: planData.plan_year,
          quarter: planData.quarter,
          title: planData.title,
          description: planData.description || '',
          category: planData.category || '',
          initiative_type: planData.initiative_type,
          estimated_spend: planData.estimated_spend.toString(),
          actual_spend: planData.actual_spend?.toString() || '',
          currency: planData.currency,
          projected_savings_percentage: planData.projected_savings_percentage?.toString() || '',
          actual_savings_percentage: planData.actual_savings_percentage?.toString() || '',
          status: planData.status,
          is_spot: planData.is_spot,
          notes: planData.notes || ''
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar la iniciativa')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validaciones básicas
    if (!formData.title.trim()) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'El título es obligatorio'
      })
      return
    }

    if (!formData.estimated_spend || parseFloat(formData.estimated_spend) <= 0) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'El spend estimado debe ser mayor a 0'
      })
      return
    }

    try {
      setSaving(true)

      const estimatedSpend = parseFloat(formData.estimated_spend)
      const actualSpend = formData.actual_spend ? parseFloat(formData.actual_spend) : null

      const savingsPercentage = formData.projected_savings_percentage
        ? parseFloat(formData.projected_savings_percentage)
        : null
      const projectedSavingsAmount = savingsPercentage
        ? (estimatedSpend * savingsPercentage) / 100
        : null

      const actualSavingsPercentage = formData.actual_savings_percentage
        ? parseFloat(formData.actual_savings_percentage)
        : null
      const actualSavingsAmount = actualSavingsPercentage && actualSpend
        ? (actualSpend * actualSavingsPercentage) / 100
        : null

      const isSupabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (isMockup || !isSupabaseConfigured) {
        // Modo mockup - simular guardado
        await new Promise(resolve => setTimeout(resolve, 1000))

        addToast({
          type: 'success',
          title: 'Iniciativa actualizada',
          message: `${formData.title} se actualizó exitosamente`
        })

        router.push(`/sourcing-plan/${planId}`)
        return
      }

      // Modo funcional con Supabase
      const supabase = supabaseBrowser()

      const updatedPlan = {
        plan_year: formData.plan_year,
        quarter: formData.quarter,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        category: formData.category.trim() || null,
        initiative_type: formData.initiative_type,
        estimated_spend: estimatedSpend,
        actual_spend: actualSpend,
        currency: formData.currency,
        projected_savings_percentage: savingsPercentage,
        projected_savings_amount: projectedSavingsAmount,
        actual_savings_percentage: actualSavingsPercentage,
        actual_savings_amount: actualSavingsAmount,
        status: formData.status,
        is_spot: formData.is_spot,
        notes: formData.notes.trim() || null,
        updated_at: new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from('sourcing_plans')
        .update(updatedPlan)
        .eq('id', planId)
        .eq('company_id', company.id)

      if (updateError) throw updateError

      addToast({
        type: 'success',
        title: 'Iniciativa actualizada',
        message: `${formData.title} se actualizó exitosamente`
      })

      router.push(`/sourcing-plan/${planId}`)
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error al actualizar iniciativa',
        message: err instanceof Error ? err.message : 'Error desconocido'
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <MainLayout user={user} companyName={company?.name || 'Xpend'}>
        <LoadingSpinner />
      </MainLayout>
    )
  }

  if (error) {
    return (
      <MainLayout user={user} companyName={company?.name || 'Xpend'}>
        <ErrorMessage
          title="Error al cargar iniciativa"
          message={error}
          onRetry={loadPlan}
        />
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName={company?.name || 'Xpend'}>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/sourcing-plan/${planId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Editar Iniciativa</h1>
            <p className="text-muted-foreground">
              {formData.title}
            </p>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Información de la Iniciativa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Año, Trimestre y Estado */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="plan_year">Año del Plan *</Label>
                  <Select
                    value={formData.plan_year.toString()}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, plan_year: parseInt(value) }))}
                  >
                    <SelectTrigger id="plan_year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2024">2024</SelectItem>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2026">2026</SelectItem>
                      <SelectItem value="2027">2027</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quarter">Trimestre *</Label>
                  <Select
                    value={formData.quarter}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, quarter: value as Quarter }))}
                  >
                    <SelectTrigger id="quarter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Q1">Q1 (Ene-Mar)</SelectItem>
                      <SelectItem value="Q2">Q2 (Abr-Jun)</SelectItem>
                      <SelectItem value="Q3">Q3 (Jul-Sep)</SelectItem>
                      <SelectItem value="Q4">Q4 (Oct-Dic)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Estado</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as PlanStatus }))}
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planned">Planificado</SelectItem>
                      <SelectItem value="in_progress">En Progreso</SelectItem>
                      <SelectItem value="completed">Completado</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Título */}
              <div className="space-y-2">
                <Label htmlFor="title">Título de la Iniciativa *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ej: Licitación Servicios de Aseo 2025"
                  required
                />
              </div>

              {/* Descripción */}
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe el alcance y objetivos de esta iniciativa..."
                  rows={3}
                />
              </div>

              {/* Categoría y Tipo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Categoría</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="Ej: Servicios Generales"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="initiative_type">Tipo de Iniciativa *</Label>
                  <Select
                    value={formData.initiative_type}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, initiative_type: value as InitiativeType }))}
                  >
                    <SelectTrigger id="initiative_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="licitacion">Licitación</SelectItem>
                      <SelectItem value="project">Proyecto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Spend Estimado, Real y Moneda */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="estimated_spend">Spend Estimado *</Label>
                  <Input
                    id="estimated_spend"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.estimated_spend}
                    onChange={(e) => setFormData(prev => ({ ...prev, estimated_spend: e.target.value }))}
                    placeholder="Ej: 50000000"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="actual_spend">Spend Real</Label>
                  <Input
                    id="actual_spend"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.actual_spend}
                    onChange={(e) => setFormData(prev => ({ ...prev, actual_spend: e.target.value }))}
                    placeholder="Ej: 45000000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Moneda</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                  >
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLP">CLP</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Ahorros Proyectados y Reales */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="projected_savings_percentage">Ahorro Proyectado (%)</Label>
                  <Input
                    id="projected_savings_percentage"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.projected_savings_percentage}
                    onChange={(e) => setFormData(prev => ({ ...prev, projected_savings_percentage: e.target.value }))}
                    placeholder="Ej: 15"
                  />
                  {formData.estimated_spend && formData.projected_savings_percentage && (
                    <p className="text-sm text-muted-foreground">
                      ${((parseFloat(formData.estimated_spend) * parseFloat(formData.projected_savings_percentage)) / 100).toLocaleString('es-CL')} {formData.currency}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="actual_savings_percentage">Ahorro Real (%)</Label>
                  <Input
                    id="actual_savings_percentage"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.actual_savings_percentage}
                    onChange={(e) => setFormData(prev => ({ ...prev, actual_savings_percentage: e.target.value }))}
                    placeholder="Ej: 18"
                  />
                  {formData.actual_spend && formData.actual_savings_percentage && (
                    <p className="text-sm text-muted-foreground">
                      ${((parseFloat(formData.actual_spend) * parseFloat(formData.actual_savings_percentage)) / 100).toLocaleString('es-CL')} {formData.currency}
                    </p>
                  )}
                </div>
              </div>

              {/* Checkbox Is Spot */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_spot"
                  checked={formData.is_spot}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_spot: checked as boolean }))}
                />
                <Label
                  htmlFor="is_spot"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Iniciativa Spot (No planificada)
                </Label>
              </div>

              {/* Notas */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notas Adicionales</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Información adicional, observaciones, etc..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Botones de Acción */}
          <div className="flex justify-between mt-6">
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                addToast({
                  type: 'info',
                  title: 'Próximamente',
                  message: 'Función de eliminación en desarrollo'
                })
              }}
              disabled={saving}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/sourcing-plan/${planId}`)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>Guardando...</>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar Cambios
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </MainLayout>
  )
}

