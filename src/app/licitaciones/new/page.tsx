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
import { CalendarIcon, ArrowLeft, Save, Loader2, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabaseBrowser } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { LoadingSpinner } from '@/components/ui/loading'
import { ErrorMessage } from '@/components/ui/error'
import type { Department } from '@/types'

export default function NewLicitacionPage() {
  const supabase = supabaseBrowser()
  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [sourcingPlans, setSourcingPlans] = useState<any[]>([])
  const [selectedPlans, setSelectedPlans] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Form data
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    status: 'planned',
    type: '',
    category: '',
    baseline_currency: 'USD',
    baseline_amount: '',
    baseline_source: '',
    awarded_amount: '',
    department_id: '',
    responsible_user_id: '',
    request_date: undefined as Date | undefined,
    publication_date: undefined as Date | undefined,
    questions_date: undefined as Date | undefined,
    answers_date: undefined as Date | undefined,
    proposal_reception_date: undefined as Date | undefined,
    proposal_closing_date: undefined as Date | undefined,
    committee_date: undefined as Date | undefined,
    award_date: undefined as Date | undefined,
    contract_signature_date: undefined as Date | undefined,
    tender_link: '',
    tender_file: null as File | null
  })

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
        id: authUser.id,
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

        // Load departments
        const { data: departmentsData, error: deptsError } = await supabase
          .from('departments')
          .select('*')
          .eq('company_id', profile.company_id)
          .eq('is_active', true)
          .order('name')

        if (!deptsError && departmentsData) {
          setDepartments(departmentsData)
        }

        // Load users from same company
        const { data: usersData, error: usersError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('company_id', profile.company_id)

        if (!usersError && usersData) {
          setUsers(usersData)
        }

        // Load sourcing plans (para asociar licitaciones)
        const currentYear = new Date().getFullYear()
        const { data: plansData, error: plansError } = await supabase
          .from('sourcing_plans')
          .select('id, title, plan_year, quarter, status, initiative_type')
          .eq('company_id', profile.company_id)
          .gte('plan_year', currentYear - 1)
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

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file size (100MB)
      if (file.size > 100 * 1024 * 1024) {
        addToast({
          type: 'error',
          title: 'Error',
          message: 'El archivo no debe superar los 100MB'
        })
        return
      }
      handleInputChange('tender_file', file)
    }
  }

  const uploadTenderDocument = async (file: File, licitacionId: string) => {
    try {
      setUploading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${licitacionId}/bases.${fileExt}`
      const filePath = `licitaciones/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      return {
        path: filePath,
        name: file.name,
        size: file.size
      }
    } catch (err) {
      throw err
    } finally {
      setUploading(false)
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

    if (!formData.id || !formData.name) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'El ID y el Nombre son requeridos.'
      })
      return
    }

    setSaving(true)
    try {
      let tenderDocData = null

      // Upload tender document if exists
      if (formData.tender_file) {
        tenderDocData = await uploadTenderDocument(formData.tender_file, formData.id)
      }

      const { data, error } = await supabase
        .from('licitaciones')
        .insert({
          id: formData.id,
          name: formData.name,
          description: formData.description || null,
          status: formData.status,
          type: formData.type || null,
          category: formData.category || null,
          baseline_currency: formData.baseline_currency,
          baseline_amount: formData.baseline_amount ? parseFloat(formData.baseline_amount) : null,
          baseline_source: formData.baseline_source || null,
          awarded_amount: formData.awarded_amount ? parseFloat(formData.awarded_amount) : null,
          department_id: formData.department_id || null,
          responsible_user_id: formData.responsible_user_id || null,
          request_date: formData.request_date ? format(formData.request_date, 'yyyy-MM-dd') : null,
          publication_date: formData.publication_date ? format(formData.publication_date, 'yyyy-MM-dd') : null,
          questions_date: formData.questions_date ? format(formData.questions_date, 'yyyy-MM-dd') : null,
          answers_date: formData.answers_date ? format(formData.answers_date, 'yyyy-MM-dd') : null,
          proposal_reception_date: formData.proposal_reception_date ? format(formData.proposal_reception_date, 'yyyy-MM-dd') : null,
          proposal_closing_date: formData.proposal_closing_date ? format(formData.proposal_closing_date, 'yyyy-MM-dd') : null,
          committee_date: formData.committee_date ? format(formData.committee_date, 'yyyy-MM-dd') : null,
          award_date: formData.award_date ? format(formData.award_date, 'yyyy-MM-dd') : null,
          contract_signature_date: formData.contract_signature_date ? format(formData.contract_signature_date, 'yyyy-MM-dd') : null,
          tender_document_path: tenderDocData?.path || null,
          tender_document_name: tenderDocData?.name || null,
          tender_document_size: tenderDocData?.size || null,
          tender_link: formData.tender_link || null,
          company_id: company.id,
          created_by: user.id
        })
        .select()
        .single()

      if (error) throw error

      // Asociar múltiples iniciativas en tabla puente
      if (selectedPlans.length) {
        const links = selectedPlans.map(planId => ({
          plan_id: planId,
          licitacion_id: data.id
        }))
        await supabase.from('sourcing_plan_licitaciones').insert(links)
      }

      addToast({
        type: 'success',
        title: 'Licitación creada',
        message: `La licitación "${formData.name}" ha sido creada exitosamente.`,
      })
      router.push(`/licitaciones/${data.id}`)
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'Error al crear la licitación.',
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

  if (error) {
    return (
      <MainLayout user={user} companyName={company?.name}>
        <ErrorMessage
          title="Error de carga"
          message={error}
          onRetry={loadUserData}
        />
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Nueva Licitación</h1>
              <p className="text-muted-foreground">
                Crea una nueva licitación para tu empresa
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información Básica */}
          <Card>
            <CardHeader>
              <CardTitle>Información Básica</CardTitle>
              <CardDescription>
                Detalles principales de la licitación
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="id">ID de Licitación *</Label>
                  <Input
                    id="id"
                    value={formData.id}
                    onChange={(e) => handleInputChange('id', e.target.value)}
                    placeholder="Ej: LIC-2025-001"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Estado</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planned">Planificado</SelectItem>
                      <SelectItem value="bases_review">Revisión Bases</SelectItem>
                      <SelectItem value="published">Publicada</SelectItem>
                      <SelectItem value="evaluation">Evaluación</SelectItem>
                      <SelectItem value="awarded">Adjudicada</SelectItem>
                      <SelectItem value="contract_signed">Contrato firmado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nombre de la Licitación *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Ej: Suministro de Equipos de Oficina"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe los objetivos y alcance de la licitación..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select value={formData.type} onValueChange={(value) => handleInputChange('type', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RFP">RFP (Request for Proposal)</SelectItem>
                      <SelectItem value="RFQ">RFQ (Request for Quotation)</SelectItem>
                      <SelectItem value="RFI">RFI (Request for Information)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoría</Label>
                  <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recurring_service">Servicio recurrente</SelectItem>
                      <SelectItem value="non_recurring_service">Servicio no recurrente</SelectItem>
                      <SelectItem value="improvement_project">Proyecto de mejora</SelectItem>
                      <SelectItem value="construction_project">Proyecto de construcción</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Asociar a iniciativas del Sourcing Plan */}
          <Card>
            <CardHeader>
              <CardTitle>Iniciativas del Sourcing Plan</CardTitle>
              <CardDescription>Selecciona una o varias iniciativas asociadas (opcional).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Iniciativas</Label>
                <div className="flex flex-col gap-2">
                  <div className="grid gap-2">
                    {sourcingPlans.map(plan => {
                      const isSelected = selectedPlans.includes(plan.id)
                      return (
                        <button
                          type="button"
                          key={plan.id}
                          className={cn(
                            'flex items-center justify-between rounded-lg border px-3 py-2 text-left transition',
                            isSelected ? 'border-primary bg-primary/5' : 'border-muted'
                          )}
                          onClick={() => {
                            setSelectedPlans(prev =>
                              isSelected ? prev.filter(id => id !== plan.id) : [...prev, plan.id]
                            )
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold">{plan.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {plan.plan_year} - {plan.quarter} • {plan.initiative_type}
                            </span>
                          </div>
                          <div
                            className={cn(
                              'h-2 w-2 rounded-full',
                              isSelected ? 'bg-primary' : 'bg-muted-foreground/40'
                            )}
                          />
                        </button>
                      )
                    })}
                    {sourcingPlans.length === 0 && (
                      <p className="text-sm text-muted-foreground">No hay iniciativas disponibles.</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Baseline y Montos */}
          <Card>
            <CardHeader>
              <CardTitle>Baseline y Montos</CardTitle>
              <CardDescription>
                Información financiera de la licitación
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="baseline_currency">Moneda Baseline</Label>
                  <Select value={formData.baseline_currency} onValueChange={(value) => handleInputChange('baseline_currency', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="CLP">CLP</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="UF">UF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="baseline_amount">Baseline</Label>
                  <Input
                    id="baseline_amount"
                    type="number"
                    step="0.01"
                    value={formData.baseline_amount}
                    onChange={(e) => handleInputChange('baseline_amount', e.target.value)}
                    placeholder="100000.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="baseline_source">Fuente Baseline</Label>
                  <Select value={formData.baseline_source} onValueChange={(value) => handleInputChange('baseline_source', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona fuente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="historical">Línea base histórica</SelectItem>
                      <SelectItem value="budget">Presupuesto</SelectItem>
                      <SelectItem value="other">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="awarded_amount">Monto Adjudicado</Label>
                <Input
                  id="awarded_amount"
                  type="number"
                  step="0.01"
                  value={formData.awarded_amount}
                  onChange={(e) => handleInputChange('awarded_amount', e.target.value)}
                  placeholder="95000.00"
                />
                <p className="text-sm text-muted-foreground">
                  El ahorro se calculará automáticamente al comparar con el baseline
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Gerencia y Responsable */}
          <Card>
            <CardHeader>
              <CardTitle>Gerencia y Responsable</CardTitle>
              <CardDescription>
                Asignación de responsabilidades
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department_id">Gerencia</Label>
                  <Select value={formData.department_id} onValueChange={(value) => handleInputChange('department_id', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una gerencia" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {departments.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No hay gerencias configuradas. <a href="/settings" className="text-primary underline">Crear gerencias</a>
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="responsible_user_id">Solicitante Responsable</Label>
                  <Select value={formData.responsible_user_id} onValueChange={(value) => handleInputChange('responsible_user_id', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un responsable" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name || u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Sourcing Plan (multi) */}
              <div className="space-y-3">
                <Label>Iniciativas del Sourcing Plan (opcional, puedes elegir varias)</Label>
                <div className="grid gap-2">
                  {sourcingPlans.map(plan => {
                    const isSelected = selectedPlans.includes(plan.id)
                    return (
                      <button
                        type="button"
                        key={plan.id}
                        className={cn(
                          'flex items-center justify-between rounded-lg border px-3 py-2 text-left transition',
                          isSelected ? 'border-primary bg-primary/5' : 'border-muted'
                        )}
                        onClick={() => {
                          setSelectedPlans(prev =>
                            isSelected ? prev.filter(id => id !== plan.id) : [...prev, plan.id]
                          )
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold">{plan.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {plan.plan_year} - {plan.quarter} • {plan.initiative_type}
                          </span>
                        </div>
                        <div
                          className={cn(
                            'h-2 w-2 rounded-full',
                            isSelected ? 'bg-primary' : 'bg-muted-foreground/40'
                          )}
                        />
                      </button>
                    )
                  })}
                  {sourcingPlans.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No hay iniciativas disponibles. Crea iniciativas en Sourcing Plan.
                    </p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Vincula esta licitación con iniciativas del Sourcing Plan para seguimiento de ahorros.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Fechas del Proceso */}
          <Card>
            <CardHeader>
              <CardTitle>Fechas del Proceso</CardTitle>
              <CardDescription>
                Cronograma de la licitación
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Fecha de solicitud</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={'outline'}
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !formData.request_date && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.request_date ? format(formData.request_date, 'PP') : <span>Seleccionar</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.request_date}
                        onSelect={(date) => handleInputChange('request_date', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Fecha de Publicación</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={'outline'}
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !formData.publication_date && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.publication_date ? format(formData.publication_date, 'PP') : <span>Seleccionar</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.publication_date}
                        onSelect={(date) => handleInputChange('publication_date', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Fecha de Preguntas</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={'outline'}
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !formData.questions_date && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.questions_date ? format(formData.questions_date, 'PP') : <span>Seleccionar</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.questions_date}
                        onSelect={(date) => handleInputChange('questions_date', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Fecha de Respuestas</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={'outline'}
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !formData.answers_date && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.answers_date ? format(formData.answers_date, 'PP') : <span>Seleccionar</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.answers_date}
                        onSelect={(date) => handleInputChange('answers_date', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Fecha de recepción de propuestas</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={'outline'}
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !formData.proposal_reception_date && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.proposal_reception_date ? format(formData.proposal_reception_date, 'PP') : <span>Seleccionar</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.proposal_reception_date}
                        onSelect={(date) => handleInputChange('proposal_reception_date', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Fecha de cierre de propuestas</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={'outline'}
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !formData.proposal_closing_date && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.proposal_closing_date ? format(formData.proposal_closing_date, 'PP') : <span>Seleccionar</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.proposal_closing_date}
                        onSelect={(date) => handleInputChange('proposal_closing_date', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Fecha de Comité / Informe</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={'outline'}
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !formData.committee_date && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.committee_date ? format(formData.committee_date, 'PP') : <span>Seleccionar</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.committee_date}
                        onSelect={(date) => handleInputChange('committee_date', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Fecha de Adjudicación</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={'outline'}
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !formData.award_date && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.award_date ? format(formData.award_date, 'PP') : <span>Seleccionar</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.award_date}
                        onSelect={(date) => handleInputChange('award_date', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
              </div>

              <div className="space-y-2">
                  <Label>Fecha de firma de contrato</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={'outline'}
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !formData.contract_signature_date && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.contract_signature_date ? format(formData.contract_signature_date, 'PP') : <span>Seleccionar</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.contract_signature_date}
                        onSelect={(date) => handleInputChange('contract_signature_date', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documentos */}
          <Card>
            <CardHeader>
              <CardTitle>Documentos</CardTitle>
              <CardDescription>
                Bases de licitación y enlaces
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="tender_file">Bases de Licitación</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="tender_file"
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.zip,.rar,.7z"
                  />
                  {formData.tender_file && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleInputChange('tender_file', null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Admite archivos comprimidos y hasta 100MB
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tender_link">Enlace a bases de licitación y anexos</Label>
                <Input
                  id="tender_link"
                  type="url"
                  value={formData.tender_link}
                  onChange={(e) => handleInputChange('tender_link', e.target.value)}
                  placeholder="https://drive.google.com/..."
                />
                <p className="text-sm text-muted-foreground">
                  Enlace a Google Drive, Dropbox u otro servicio con el resto de la información
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Botones de Acción */}
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={saving || uploading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || uploading}>
              {saving || uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {uploading ? 'Subiendo archivo...' : 'Creando...'}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Crear Licitación
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  )
}
