'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import { useVersion } from '@/contexts/version-context'
import { supabaseBrowser } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import type { CreateSupplierData, ServiceType } from '@/types'

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

export default function NewSupplierPage() {
  const router = useRouter()
  const { isMockup } = useVersion()
  const { addToast } = useToast()

  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)

  const [formData, setFormData] = useState<CreateSupplierData>({
    fantasy_name: '',
    legal_name: '',
    rut: '',
    service_type: 'otros',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    website: '',
    comments: ''
  })

  const [ndaSigned, setNdaSigned] = useState(false)
  const [ndaFile, setNdaFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  // Load user and company data on component mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        if (isMockup) {
          // Use demo data in mockup mode
          setUser({
            id: '550e8400-e29b-41d4-a716-446655440001',
            name: 'Usuario Demo',
            email: 'demo@xpend.cl',
            role: 'admin'
          })
          setCompany({
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Xpend'
          })
          return
        }

        // In functional mode, load real user data
        const supabase = supabaseBrowser()
        
        // Get current user
        const { data: { user: authUser }, error: userError } = await supabase.auth.getUser()
        if (userError || !authUser) {
          console.log('No authenticated user found')
          return
        }

        // Get user profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single()

        if (profileError || !profile) {
          console.log('No profile found')
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
  }, [isMockup])

  const handleInputChange = (field: keyof CreateSupplierData, value: string) => {
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
    if (!formData.fantasy_name.trim()) {
      addToast({
        type: 'error',
        title: 'Error de validación',
        message: 'El nombre de fantasía es requerido'
      })
      return false
    }

    if (!formData.legal_name.trim()) {
      addToast({
        type: 'error',
        title: 'Error de validación',
        message: 'La razón social es requerida'
      })
      return false
    }

    if (!formData.rut.trim()) {
      addToast({
        type: 'error',
        title: 'Error de validación',
        message: 'El RUT es requerido'
      })
      return false
    }

    // Basic RUT validation (Chilean format)
    const rutRegex = /^\d{1,2}\.\d{3}\.\d{3}-[\dkK]$/
    if (!rutRegex.test(formData.rut)) {
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

    setLoading(true)

    try {
      // Mockup mode: simulate creation
      if (isMockup) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        addToast({
          type: 'success',
          title: 'Proveedor creado',
          message: 'El proveedor ha sido creado correctamente (modo demo)'
        })
        router.push('/suppliers')
        return
      }

      // Functional mode: create in Supabase
      const supabase = supabaseBrowser()
      
      // Get authenticated user
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser()
      if (userError || !authUser) {
        throw new Error('No hay usuario autenticado')
      }

      // Get user's company_id from profile or use current company
      let companyId = company?.id
      if (!companyId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', authUser.id)
          .single()
        
        companyId = profile?.company_id
      }

      if (!companyId) {
        throw new Error('No se pudo determinar la empresa del usuario')
      }

      // Generate supplier ID
      const supplierId = `supplier-${Date.now()}`
      
      // Prepare supplier data
      const supplierData = {
        id: supplierId,
        company_id: companyId,
        ...formData,
        nda_signed: ndaSigned,
        nda_signed_date: ndaSigned ? new Date().toISOString().split('T')[0] : null,
        is_active: true,
        created_by: authUser.id
      }

      // Upload NDA file if provided
      let ndaFilePath = null
      if (ndaFile) {
        const fileExt = ndaFile.name.split('.').pop()
        const fileName = `${supplierId}-nda.${fileExt}`
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('supplier-documents')
          .upload(fileName, ndaFile)

        if (!uploadError && uploadData) {
          ndaFilePath = uploadData.path
        }
      }

      // Insert supplier
      const { error: insertError } = await supabase
        .from('suppliers')
        .insert({
          ...supplierData,
          nda_file_path: ndaFilePath,
          nda_file_name: ndaFile?.name,
          nda_file_size: ndaFile?.size
        })

      if (insertError) {
        // Handle specific errors
        if (insertError.code === '23505') {
          throw new Error('Ya existe un proveedor con este RUT en la empresa')
        }
        throw new Error(insertError.message || 'Error al crear el proveedor')
      }

      addToast({
        type: 'success',
        title: 'Proveedor creado',
        message: 'El proveedor ha sido creado correctamente'
      })

      router.push('/suppliers')

    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo crear el proveedor'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={() => router.push('/suppliers')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Nuevo Proveedor</h1>
              <p className="text-muted-foreground">Agregar un nuevo proveedor al sistema</p>
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
                    value={formData.fantasy_name}
                    onChange={(e) => handleInputChange('fantasy_name', e.target.value)}
                    placeholder="Ej: TechSolutions Pro"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="legal_name">Razón Social *</Label>
                  <Input
                    id="legal_name"
                    value={formData.legal_name}
                    onChange={(e) => handleInputChange('legal_name', e.target.value)}
                    placeholder="Ej: TechSolutions Pro SpA"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="rut">RUT *</Label>
                  <Input
                    id="rut"
                    value={formData.rut}
                    onChange={(e) => handleInputChange('rut', e.target.value)}
                    placeholder="Ej: 76.123.456-7"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="service_type">Tipo de Servicio *</Label>
                  <Select
                    value={formData.service_type}
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
                    value={formData.comments}
                    onChange={(e) => handleInputChange('comments', e.target.value)}
                    placeholder="Información adicional sobre el proveedor..."
                    rows={3}
                  />
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
                    value={formData.contact_name}
                    onChange={(e) => handleInputChange('contact_name', e.target.value)}
                    placeholder="Ej: María González"
                  />
                </div>

                <div>
                  <Label htmlFor="contact_email">Email de Contacto</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => handleInputChange('contact_email', e.target.value)}
                    placeholder="Ej: maria@techsolutions.cl"
                  />
                </div>

                <div>
                  <Label htmlFor="contact_phone">Teléfono de Contacto</Label>
                  <Input
                    id="contact_phone"
                    value={formData.contact_phone}
                    onChange={(e) => handleInputChange('contact_phone', e.target.value)}
                    placeholder="Ej: +56 9 1234 5678"
                  />
                </div>

                <div>
                  <Label htmlFor="website">Sitio Web</Label>
                  <Input
                    id="website"
                    value={formData.website}
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
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/suppliers')}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Crear Proveedor
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  )
}
