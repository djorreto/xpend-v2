'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ArrowLeft,
  Save,
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  FileText
} from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/loading'
import { ErrorMessage } from '@/components/ui/error'
import { useToast } from '@/components/ui/toast'
import type { Supplier, UpdateSupplierData, ServiceType } from '@/types'

const serviceTypeLabels: Record<ServiceType, string> = {
  tecnologia: 'Tecnología',
  servicios_profesionales: 'Servicios Profesionales',
  suministros: 'Suministros',
  marketing: 'Marketing',
  infraestructura: 'Infraestructura',
  construccion: 'Construcción',
  consultoria: 'Consultoría',
  mantenimiento: 'Mantenimiento',
  otros: 'Otros'
}

export default function EditSupplierPage() {
  const router = useRouter()
  const params = useParams()
  const { addToast } = useToast()

  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)

  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [formData, setFormData] = useState<UpdateSupplierData>({})
  const [ndaSigned, setNdaSigned] = useState(false)
  const [ndaFile, setNdaFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supplierId = params.id as string

  // Load user and company data on component mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        // In functional mode, load real user data
        const supabase = supabaseBrowser()

        // Get current user
        const { data: { user: authUser }, error: userError } = await supabase.auth.getUser()
        if (userError || !authUser) {
          return
        }

        // Get user profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single()

        if (profileError || !profile) {
          return
        }

        setUser({
          id: authUser.id,
          name: profile.full_name || authUser.email,
          email: authUser.email,
          role: profile.role
        })

        // Get company info
        if (profile.company_id) {
          const { data: companyData, error: companyError } = await supabase
            .from('companies')
            .select('*')
            .eq('id', profile.company_id)
            .single()

          if (!companyError && companyData) {
            setCompany({
              id: companyData.id,
              name: companyData.name
            })
          }
        }
      } catch (err) {
        console.error('Error loading user data:', err)
      }
    }

    loadUserData()
  }, [])

  useEffect(() => {
    loadSupplier()
  }, [supplierId])

  const loadSupplier = async () => {
    try {
      setLoading(true)
      setError(null)

      const supabase = supabaseBrowser()

      const { data: supplierData, error: supplierError } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', supplierId)
        .single()

      if (supplierError || !supplierData) {
        throw new Error('Proveedor no encontrado')
      }

      setSupplier(supplierData as Supplier)
      setFormData({
        fantasy_name: supplierData.fantasy_name,
        legal_name: supplierData.legal_name,
        rut: supplierData.rut,
        service_type: supplierData.service_type as ServiceType,
        contact_name: supplierData.contact_name || '',
        contact_email: supplierData.contact_email || '',
        contact_phone: supplierData.contact_phone || '',
        website: supplierData.website || '',
        comments: supplierData.comments || '',
        is_active: supplierData.is_active
      })
      setNdaSigned(supplierData.nda_signed)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar proveedor')
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo cargar el proveedor'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof UpdateSupplierData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setNdaFile(file)
    }
  }

  const validateForm = (): boolean => {
    if (!formData.fantasy_name?.trim()) {
      addToast({
        type: 'error',
        title: 'Error de validación',
        message: 'El nombre de fantasía es requerido'
      })
      return false
    }

    if (!formData.legal_name?.trim()) {
      addToast({
        type: 'error',
        title: 'Error de validación',
        message: 'La razón social es requerida'
      })
      return false
    }

    if (!formData.rut?.trim()) {
      addToast({
        type: 'error',
        title: 'Error de validación',
        message: 'El RUT es requerido'
      })
      return false
    }

    // Basic RUT validation (Chilean format)
    const rutRegex = /^\d{1,2}\.\d{3}\.\d{3}-[\dkK]$/
    if (formData.rut && !rutRegex.test(formData.rut)) {
      addToast({
        type: 'error',
        title: 'Error de validación',
        message: 'El formato del RUT no es válido (ej: 12.345.678-9)'
      })
      return false
    }

    if (formData.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)) {
      addToast({
        type: 'error',
        title: 'Error de validación',
        message: 'El formato del email no es válido'
      })
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setSaving(true)

    try {
      // Functional mode: update in Supabase
      const supabase = supabaseBrowser()

      // Prepare update data
      const updateData: any = {
        ...formData,
        nda_signed: ndaSigned,
        nda_signed_date: ndaSigned ? new Date().toISOString().split('T')[0] : null,
        updated_at: new Date().toISOString()
      }

      // Upload NDA file if provided
      if (ndaFile) {
        const fileExt = ndaFile.name.split('.').pop()
        const fileName = `${supplierId}-nda.${fileExt}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('supplier-documents')
          .upload(fileName, ndaFile, { upsert: true })

        if (!uploadError && uploadData) {
          updateData.nda_file_path = uploadData.path
          updateData.nda_file_name = ndaFile.name
          updateData.nda_file_size = ndaFile.size
        }
      }

      // Update supplier
      const { error: updateError } = await supabase
        .from('suppliers')
        .update(updateData)
        .eq('id', supplierId)

      if (updateError) {
        if (updateError.code === '23505') {
          throw new Error('Ya existe un proveedor con este RUT en la empresa')
        }
        throw new Error(updateError.message || 'Error al actualizar el proveedor')
      }

      addToast({
        type: 'success',
        title: 'Proveedor actualizado',
        message: 'El proveedor ha sido actualizado correctamente'
      })

      router.push(`/suppliers/${supplierId}`)

    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo actualizar el proveedor'
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

  if (error || !supplier) {
    return (
      <MainLayout user={user} companyName={company?.name}>
        <ErrorMessage
          title="Error al cargar proveedor"
          message={error || 'Proveedor no encontrado'}
          onRetry={loadSupplier}
        />
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={() => router.push(`/suppliers/${supplierId}`)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Editar Proveedor</h1>
              <p className="text-muted-foreground">Modificar información del proveedor</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Información Básica */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building2 className="mr-2 h-5 w-5" />
                  Información Básica
                </CardTitle>
                <CardDescription>
                  Datos principales del proveedor
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="fantasy_name">Nombre de Fantasía *</Label>
                  <Input
                    id="fantasy_name"
                    value={formData.fantasy_name || ''}
                    onChange={(e) => handleInputChange('fantasy_name', e.target.value)}
                    placeholder="Ej: TechSolutions Pro"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="legal_name">Razón Social *</Label>
                  <Input
                    id="legal_name"
                    value={formData.legal_name || ''}
                    onChange={(e) => handleInputChange('legal_name', e.target.value)}
                    placeholder="Ej: TechSolutions Pro SpA"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="rut">RUT *</Label>
                  <Input
                    id="rut"
                    value={formData.rut || ''}
                    onChange={(e) => handleInputChange('rut', e.target.value)}
                    placeholder="Ej: 76.123.456-7"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="service_type">Tipo de Servicio *</Label>
                  <Select
                    value={formData.service_type || 'otros'}
                    onValueChange={(value) => handleInputChange('service_type', value as ServiceType)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo de servicio" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(serviceTypeLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="comments">Comentarios</Label>
                  <Textarea
                    id="comments"
                    value={formData.comments || ''}
                    onChange={(e) => handleInputChange('comments', e.target.value)}
                    placeholder="Información adicional sobre el proveedor..."
                    rows={3}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_active"
                    checked={formData.is_active ?? true}
                    onCheckedChange={(checked) => handleInputChange('is_active', checked as boolean)}
                  />
                  <Label htmlFor="is_active">Proveedor activo</Label>
                </div>
              </CardContent>
            </Card>

            {/* Información de Contacto */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="mr-2 h-5 w-5" />
                  Información de Contacto
                </CardTitle>
                <CardDescription>
                  Datos de contacto del proveedor
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="contact_name">Nombre del Contacto</Label>
                  <Input
                    id="contact_name"
                    value={formData.contact_name || ''}
                    onChange={(e) => handleInputChange('contact_name', e.target.value)}
                    placeholder="Ej: María González"
                  />
                </div>

                <div>
                  <Label htmlFor="contact_email">Email de Contacto</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={formData.contact_email || ''}
                    onChange={(e) => handleInputChange('contact_email', e.target.value)}
                    placeholder="Ej: maria@techsolutions.cl"
                  />
                </div>

                <div>
                  <Label htmlFor="contact_phone">Teléfono de Contacto</Label>
                  <Input
                    id="contact_phone"
                    value={formData.contact_phone || ''}
                    onChange={(e) => handleInputChange('contact_phone', e.target.value)}
                    placeholder="Ej: +56 9 1234 5678"
                  />
                </div>

                <div>
                  <Label htmlFor="website">Sitio Web</Label>
                  <Input
                    id="website"
                    value={formData.website || ''}
                    onChange={(e) => handleInputChange('website', e.target.value)}
                    placeholder="Ej: https://techsolutions.cl"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Documentos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5" />
                Documentos
              </CardTitle>
              <CardDescription>
                Gestión de documentos del proveedor
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="nda_signed"
                  checked={ndaSigned}
                  onCheckedChange={(checked) => setNdaSigned(checked as boolean)}
                />
                <Label htmlFor="nda_signed">NDA firmado</Label>
              </div>

              <div>
                <Label htmlFor="nda_file">Archivo NDA</Label>
                <Input
                  id="nda_file"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Formatos permitidos: PDF, DOC, DOCX (máximo 10MB)
                </p>
                {supplier.nda_file_name && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Archivo actual: {supplier.nda_file_name}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/suppliers/${supplierId}`)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  )
}
