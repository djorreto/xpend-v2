'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { supabaseBrowser } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Save,
  CheckCircle,
  Loader2,
  Settings,
  AlertCircle
} from 'lucide-react'
import type { RfxCompanyPolicy, RfxTemplate } from '@/types/rfx-maker'

export default function CompanyPoliciesPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [policy, setPolicy] = useState<RfxCompanyPolicy | null>(null)
  const [activeTemplate, setActiveTemplate] = useState<RfxTemplate | null>(null)
  const [policyValues, setPolicyValues] = useState<Record<string, any>>({})
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    checkPermissions()
    loadData()
  }, [])

  const checkPermissions = async () => {
    try {
      const supabase = supabaseBrowser()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
        addToast({
          type: 'error',
          title: 'Acceso denegado',
          message: 'Solo administradores pueden acceder a esta sección'
        })
        router.push('/rfx-maker')
        return
      }

      setUserRole(profile.role)
    } catch (error) {
      console.error('Error checking permissions:', error)
      router.push('/rfx-maker')
    }
  }

  const loadData = async () => {
    try {
      const supabase = supabaseBrowser()

      // Cargar plantilla activa
      const { data: templateData, error: templateError } = await supabase
        .from('rfx_templates')
        .select('*')
        .eq('is_active_version', true)
        .eq('status', 'active')
        .single()

      if (templateError && templateError.code !== 'PGRST116') {
        throw templateError
      }

      setActiveTemplate(templateData)

      // Cargar política activa
      const { data: policyData, error: policyError } = await supabase
        .from('rfx_company_policies')
        .select('*')
        .eq('is_active', true)
        .single()

      if (policyError && policyError.code !== 'PGRST116') {
        throw policyError
      }

      if (policyData) {
        setPolicy(policyData)
        setPolicyValues(policyData.policy_values || {})
      } else if (templateData) {
        // Inicializar valores por defecto desde la plantilla
        const defaultValues: Record<string, any> = {}
        templateData.placeholder_definitions?.forEach((placeholder: any) => {
          defaultValues[placeholder.field_key] = placeholder.default_value || ''
        })
        setPolicyValues(defaultValues)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudieron cargar las políticas'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const supabase = supabaseBrowser()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) throw new Error('Usuario no autenticado')

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile) throw new Error('Perfil no encontrado')

      if (policy) {
        // Actualizar política existente
        const { error } = await supabase
          .from('rfx_company_policies')
          .update({
            policy_values: policyValues,
            updated_at: new Date().toISOString(),
          })
          .eq('id', policy.id)

        if (error) throw error
      } else {
        // Crear nueva política
        const { error } = await supabase
          .from('rfx_company_policies')
          .insert({
            company_id: profile.company_id,
            policy_name: 'Política por Defecto',
            policy_values: policyValues,
            is_active: true,
            created_by: user.id,
          })

        if (error) throw error
      }

      addToast({
        type: 'success',
        title: 'Política guardada',
        message: 'Los valores por defecto se guardaron correctamente'
      })

      loadData() // Recargar datos
    } catch (error) {
      console.error('Error saving policy:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo guardar la política'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleValueChange = (fieldKey: string, value: any) => {
    setPolicyValues({
      ...policyValues,
      [fieldKey]: value,
    })
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </MainLayout>
    )
  }

  if (!activeTemplate) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-4">No hay plantilla activa</h2>
              <p className="text-gray-600 mb-6">
                Necesitas activar una plantilla administrativa antes de poder configurar políticas de empresa
              </p>
              <Button onClick={() => router.push('/rfx-maker/templates')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Ir a Plantillas
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    )
  }

  // Agrupar placeholders por grupo
  const groupedPlaceholders = (activeTemplate.placeholder_definitions || []).reduce((acc: any, placeholder: any) => {
    const group = placeholder.group || 'General'
    if (!acc[group]) acc[group] = []
    acc[group].push(placeholder)
    return acc
  }, {})

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push('/rfx-maker')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Política de Empresa</h1>
              <p className="text-gray-600 mt-1">
                Valores por defecto para nuevos proyectos RFx
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Guardar
              </>
            )}
          </Button>
        </div>

        {/* Template Info */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-semibold text-blue-900">
                  Plantilla activa: {activeTemplate.name}
                </p>
                <p className="text-sm text-blue-700">
                  Los valores configurados aquí se usarán como valores por defecto en todos los nuevos proyectos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Policy Values by Group */}
        {Object.entries(groupedPlaceholders).map(([groupName, placeholders]: [string, any]) => (
          <Card key={groupName}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {groupName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {placeholders.map((placeholder: any) => (
                <div key={placeholder.field_key} className="space-y-2">
                  <Label htmlFor={placeholder.field_key}>
                    {placeholder.label}
                    {placeholder.help_text && (
                      <span className="text-sm text-gray-500 ml-2">
                        ({placeholder.help_text})
                      </span>
                    )}
                  </Label>

                  {placeholder.type === 'text' && (
                    <Input
                      id={placeholder.field_key}
                      value={policyValues[placeholder.field_key] || ''}
                      onChange={(e) => handleValueChange(placeholder.field_key, e.target.value)}
                      placeholder={placeholder.default_value || ''}
                    />
                  )}

                  {placeholder.type === 'number' && (
                    <Input
                      id={placeholder.field_key}
                      type="number"
                      value={policyValues[placeholder.field_key] || ''}
                      onChange={(e) => handleValueChange(placeholder.field_key, e.target.value)}
                      placeholder={placeholder.default_value || ''}
                    />
                  )}

                  {placeholder.type === 'date' && (
                    <Input
                      id={placeholder.field_key}
                      type="date"
                      value={policyValues[placeholder.field_key] || ''}
                      onChange={(e) => handleValueChange(placeholder.field_key, e.target.value)}
                    />
                  )}

                  {placeholder.type === 'bool' && (
                    <div className="flex items-center gap-2">
                      <input
                        id={placeholder.field_key}
                        type="checkbox"
                        checked={policyValues[placeholder.field_key] || false}
                        onChange={(e) => handleValueChange(placeholder.field_key, e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <label htmlFor={placeholder.field_key} className="text-sm text-gray-700">
                        Activado
                      </label>
                    </div>
                  )}

                  {placeholder.type === 'enum' && placeholder.rules?.allowed_values && (
                    <select
                      id={placeholder.field_key}
                      value={policyValues[placeholder.field_key] || ''}
                      onChange={(e) => handleValueChange(placeholder.field_key, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seleccionar...</option>
                      {placeholder.rules.allowed_values.map((option: string) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        {/* Info */}
        <Card className="bg-gray-50">
          <CardContent className="p-4">
            <h4 className="font-semibold text-gray-900 mb-2">ℹ️ Sobre las Políticas de Empresa</h4>
            <ul className="space-y-1 text-sm text-gray-700">
              <li>• Estos valores se aplican automáticamente a todos los nuevos proyectos RFx</li>
              <li>• Los usuarios podrán modificar estos valores en cada proyecto individual</li>
              <li>• Los cambios aquí NO afectan proyectos ya creados</li>
              <li>• Solo puede haber una política activa a la vez por empresa</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}

