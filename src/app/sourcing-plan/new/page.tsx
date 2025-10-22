'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowLeft, Save } from 'lucide-react'
import { useVersion } from '@/contexts/version-context'
import { supabaseBrowser } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/loading'
import { useToast } from '@/components/ui/toast'
import type { Quarter, InitiativeType, PlanStatus } from '@/types'

export default function NewSourcingPlanPage() {
  const router = useRouter()
  const { isMockup } = useVersion()
  const { addToast } = useToast()

  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Datos del formulario
  const [formData, setFormData] = useState({
    plan_year: new Date().getFullYear(),
    quarter: 'Q1' as Quarter,
    title: '',
    description: '',
    category: '',
    initiative_type: 'licitacion' as InitiativeType,
    estimated_spend: '',
    currency: 'CLP',
    projected_savings_percentage: '',
    status: 'planned' as PlanStatus,
    is_spot: false,
    notes: ''
  })

  useEffect(() => {
    loadUserData()
  }, [isMockup])

  const loadUserData = async () => {
    try {
      setLoading(true)

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
      }
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Error al cargar datos'
      })
      router.push('/sourcing-plan')
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
      const savingsPercentage = formData.projected_savings_percentage
        ? parseFloat(formData.projected_savings_percentage)
        : null

      const projectedSavingsAmount = savingsPercentage
        ? (estimatedSpend * savingsPercentage) / 100
        : null

      const isSupabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (isMockup || !isSupabaseConfigured) {
        // Modo mockup - simular guardado
        await new Promise(resolve => setTimeout(resolve, 1000))

        addToast({
          type: 'success',
          title: 'Iniciativa creada',
          message: `${formData.title} se creó exitosamente`
        })

        router.push('/sourcing-plan')
        return
      }

      // Modo funcional con Supabase
      const supabase = supabaseBrowser()

      const newPlan = {
        company_id: company.id,
        plan_year: formData.plan_year,
        quarter: formData.quarter,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        category: formData.category.trim() || null,
        initiative_type: formData.initiative_type,
        estimated_spend: estimatedSpend,
        currency: formData.currency,
        projected_savings_percentage: savingsPercentage,
        projected_savings_amount: projectedSavingsAmount,
        status: formData.status,
        is_spot: formData.is_spot,
        notes: formData.notes.trim() || null,
        responsible_user_id: user.id,
        created_by: user.id
      }

      const { data, error } = await supabase
        .from('sourcing_plans')
        .insert([newPlan])
        .select()
        .single()

      if (error) throw error

      addToast({
        type: 'success',
        title: 'Iniciativa creada',
        message: `${formData.title} se creó exitosamente`
      })

      router.push('/sourcing-plan')
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error al crear iniciativa',
        message: err instanceof Error ? err.message : 'Error desconocido'
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <MainLayout user={user} companyName={company?.name}>
        <LoadingSpinner />
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/sourcing-plan')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Nueva Iniciativa</h1>
            <p className="text-muted-foreground">
              Agrega una nueva iniciativa al Sourcing Plan
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
              {/* Año y Trimestre */}
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

              {/* Spend y Moneda */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-2">
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

              {/* Ahorro Proyectado */}
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
                    Ahorro proyectado: ${((parseFloat(formData.estimated_spend) * parseFloat(formData.projected_savings_percentage)) / 100).toLocaleString('es-CL')} {formData.currency}
                  </p>
                )}
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
          <div className="flex justify-end gap-4 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/sourcing-plan')}
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
                  Crear Iniciativa
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  )
}

