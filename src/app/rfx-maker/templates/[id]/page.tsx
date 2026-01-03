'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { supabaseBrowser } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  HelpCircle
} from 'lucide-react'
import type { RfxTemplate, PlaceholderDefinition } from '@/types/rfx-maker'

interface Props {
  params: { id: string }
}

export default function TemplateEditorPage({ params }: Props) {
  const router = useRouter()
  const { addToast } = useToast()
  const isNew = params.id === 'new'

  const [isLoading, setIsLoading] = useState(!isNew)
  const [isSaving, setIsSaving] = useState(false)
  const [template, setTemplate] = useState<Partial<RfxTemplate>>({
    name: '',
    description: '',
    template_structure: '',
    placeholder_definitions: [],
    status: 'draft',
    version_number: 1,
  })

  useEffect(() => {
    if (!isNew) {
      loadTemplate()
    }
  }, [params.id])

  const loadTemplate = async () => {
    try {
      const supabase = supabaseBrowser()
      const { data, error } = await supabase
        .from('rfx_templates')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error) throw error
      setTemplate(data)
    } catch (error) {
      console.error('Error loading template:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo cargar la plantilla'
      })
      router.push('/rfx-maker/templates')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddPlaceholder = () => {
    const newPlaceholder: PlaceholderDefinition = {
      field_key: `field_${Date.now()}`,
      label: 'Nuevo Campo',
      type: 'text',
      default_value: '',
      editable_by: 'admin',
      group: 'General',
    }

    setTemplate({
      ...template,
      placeholder_definitions: [...(template.placeholder_definitions || []), newPlaceholder],
    })
  }

  const handleUpdatePlaceholder = (index: number, updates: Partial<PlaceholderDefinition>) => {
    const updatedPlaceholders = [...(template.placeholder_definitions || [])]
    updatedPlaceholders[index] = { ...updatedPlaceholders[index], ...updates }
    setTemplate({ ...template, placeholder_definitions: updatedPlaceholders })
  }

  const handleRemovePlaceholder = (index: number) => {
    const updatedPlaceholders = [...(template.placeholder_definitions || [])]
    updatedPlaceholders.splice(index, 1)
    setTemplate({ ...template, placeholder_definitions: updatedPlaceholders })
  }

  const handleSave = async () => {
    if (!template.name || !template.template_structure) {
      addToast({
        type: 'error',
        title: 'Campos requeridos',
        message: 'Por favor completa nombre y estructura de la plantilla'
      })
      return
    }

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

      if (isNew) {
        const { error } = await supabase.from('rfx_templates').insert({
          ...template,
          company_id: profile.company_id,
          created_by: user.id,
        })

        if (error) throw error

        addToast({
          type: 'success',
          title: 'Plantilla creada',
          message: 'La plantilla se creó exitosamente'
        })
      } else {
        const { error } = await supabase
          .from('rfx_templates')
          .update({
            name: template.name,
            description: template.description,
            template_structure: template.template_structure,
            placeholder_definitions: template.placeholder_definitions,
            status: template.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.id)

        if (error) throw error

        addToast({
          type: 'success',
          title: 'Plantilla actualizada',
          message: 'Los cambios se guardaron correctamente'
        })
      }

      router.push('/rfx-maker/templates')
    } catch (error) {
      console.error('Error saving template:', error)
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo guardar la plantilla'
      })
    } finally {
      setIsSaving(false)
    }
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

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push('/rfx-maker/templates')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isNew ? 'Nueva Plantilla' : 'Editar Plantilla'}
              </h1>
              <p className="text-gray-600 mt-1">
                Define la estructura de la base administrativa
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

        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la Plantilla *</Label>
              <Input
                id="name"
                value={template.name}
                onChange={(e) => setTemplate({ ...template, name: e.target.value })}
                placeholder="Ej: Plantilla Base Administrativa Estándar"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={template.description || ''}
                onChange={(e) => setTemplate({ ...template, description: e.target.value })}
                placeholder="Descripción breve de esta plantilla..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <select
                id="status"
                value={template.status || 'draft'}
                onChange={(e) => setTemplate({ ...template, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="draft">Borrador</option>
                <option value="active">Activa</option>
                <option value="archived">Archivada</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Template Structure */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Estructura de la Plantilla</CardTitle>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <HelpCircle className="h-4 w-4" />
                <span>Usa variables con formato: {'{{'} nombre_variable {'}}'}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={template.template_structure || ''}
              onChange={(e) => setTemplate({ ...template, template_structure: e.target.value })}
              placeholder={`Ejemplo:

BASES ADMINISTRATIVAS

1. ANTECEDENTES GENERALES
   - Moneda: {{ currency }}
   - Plazo de entrega: {{ delivery_timeline }}

2. GARANTÍAS
   - Garantía de seriedad de oferta: {{ performance_bond_percent }}%
   - Vigencia de propuesta: {{ proposal_validity_days }} días

3. CONDICIONES DE PAGO
   - {{ payment_terms }}

...`}
              rows={20}
              className="font-mono text-sm"
              required
            />
          </CardContent>
        </Card>

        {/* Placeholder Definitions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Definición de Variables (Placeholders)</CardTitle>
              <Button onClick={handleAddPlaceholder} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Variable
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {(!template.placeholder_definitions || template.placeholder_definitions.length === 0) ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p>No hay variables definidas</p>
                <p className="text-sm">Agrega variables para los campos dinámicos de tu plantilla</p>
              </div>
            ) : (
              <div className="space-y-4">
                {template.placeholder_definitions.map((placeholder, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">Variable #{index + 1}</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemovePlaceholder(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Clave (field_key)</Label>
                        <Input
                          value={placeholder.field_key}
                          onChange={(e) => handleUpdatePlaceholder(index, { field_key: e.target.value })}
                          placeholder="currency"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Etiqueta</Label>
                        <Input
                          value={placeholder.label}
                          onChange={(e) => handleUpdatePlaceholder(index, { label: e.target.value })}
                          placeholder="Moneda"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Tipo</Label>
                        <select
                          value={placeholder.type}
                          onChange={(e) => handleUpdatePlaceholder(index, { type: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="text">Texto</option>
                          <option value="number">Número</option>
                          <option value="date">Fecha</option>
                          <option value="enum">Opciones (enum)</option>
                          <option value="bool">Booleano</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label>Valor por defecto</Label>
                        <Input
                          value={placeholder.default_value || ''}
                          onChange={(e) => handleUpdatePlaceholder(index, { default_value: e.target.value })}
                          placeholder="CLP"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Grupo</Label>
                        <Input
                          value={placeholder.group || ''}
                          onChange={(e) => handleUpdatePlaceholder(index, { group: e.target.value })}
                          placeholder="General"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Editable por</Label>
                        <select
                          value={placeholder.editable_by}
                          onChange={(e) => handleUpdatePlaceholder(index, { editable_by: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="admin">Solo Admin</option>
                          <option value="user">Usuarios</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Texto de ayuda</Label>
                      <Input
                        value={placeholder.help_text || ''}
                        onChange={(e) => handleUpdatePlaceholder(index, { help_text: e.target.value })}
                        placeholder="Texto explicativo para el usuario"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-blue-900 mb-2">💡 Cómo usar las variables</h4>
            <ul className="space-y-1 text-sm text-blue-800">
              <li>• Define variables con formato: {'{{'} nombre_variable {'}}'}</li>
              <li>• Cada variable debe tener una definición correspondiente abajo</li>
              <li>• El &quot;field_key&quot; debe coincidir exactamente con el nombre en la plantilla</li>
              <li>• Las variables se reemplazan automáticamente en cada proyecto</li>
              <li>• Puedes agrupar variables relacionadas usando el campo &quot;Grupo&quot;</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}

