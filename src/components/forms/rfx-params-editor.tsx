'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Save, X } from 'lucide-react'

interface RfxParamsEditorProps {
  initialParams: Record<string, any>
  onSave: (params: Record<string, any>) => Promise<void>
  onCancel: () => void
}

export function RfxParamsEditor({ initialParams, onSave, onCancel }: RfxParamsEditorProps) {
  const [params, setParams] = useState<Record<string, any>>(initialParams)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateParams = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Validar campos numéricos
    Object.entries(params).forEach(([key, value]) => {
      if (typeof value === 'number') {
        if (isNaN(value) || value < 0) {
          newErrors[key] = 'Debe ser un número positivo'
        }
      }

      // Validar campos de texto obligatorios (los que tienen valores)
      if (typeof value === 'string') {
        if (key.includes('required') || key.includes('mandatory')) {
          if (!value || value.trim().length === 0) {
            newErrors[key] = 'Este campo es requerido'
          }
        }

        if (value && value.length > 500) {
          newErrors[key] = 'El texto no puede exceder 500 caracteres'
        }
      }

      // Validar porcentajes
      if (key.toLowerCase().includes('percent') && typeof value === 'number') {
        if (value < 0 || value > 100) {
          newErrors[key] = 'Debe estar entre 0 y 100'
        }
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateParams()) {
      return
    }

    setIsSaving(true)
    try {
      await onSave(params)
      setErrors({})
    } catch (error) {
      // El error ya se maneja en el parent
    } finally {
      setIsSaving(false)
    }
  }

  const handleChange = (key: string, value: any) => {
    setParams(prev => ({
      ...prev,
      [key]: value
    }))
  }

  // Detectar tipo de campo según el valor
  const getFieldType = (value: any): string => {
    if (typeof value === 'number') return 'number'
    if (typeof value === 'boolean') return 'checkbox'
    if (typeof value === 'string' && value.length > 100) return 'textarea'
    return 'text'
  }

  // Formatear el nombre del campo para mostrar
  const formatFieldName = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Editar Parámetros Administrativos</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isSaving}
            >
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(params).map(([key, value]) => {
            const fieldType = getFieldType(value)

            if (fieldType === 'checkbox') {
              return (
                <div key={key} className="flex items-center space-x-2 p-3 border rounded">
                  <input
                    type="checkbox"
                    id={key}
                    checked={value as boolean}
                    onChange={(e) => handleChange(key, e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor={key} className="font-medium">
                    {formatFieldName(key)}
                  </Label>
                </div>
              )
            }

            if (fieldType === 'textarea') {
              return (
                <div key={key} className="md:col-span-2">
                  <Label htmlFor={key} className="font-medium">
                    {formatFieldName(key)}
                  </Label>
                  <textarea
                    id={key}
                    value={value as string}
                    onChange={(e) => handleChange(key, e.target.value)}
                    rows={3}
                    className="w-full mt-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )
            }

            return (
              <div key={key}>
                <Label htmlFor={key} className="font-medium">
                  {formatFieldName(key)}
                </Label>
                <Input
                  id={key}
                  type={fieldType}
                  value={value?.toString() || ''}
                  onChange={(e) => {
                    const newValue = fieldType === 'number'
                      ? parseFloat(e.target.value) || 0
                      : e.target.value
                    handleChange(key, newValue)
                    // Limpiar error al modificar
                    if (errors[key]) {
                      setErrors(prev => {
                        const newErrors = { ...prev }
                        delete newErrors[key]
                        return newErrors
                      })
                    }
                  }}
                  className={`mt-1 ${errors[key] ? 'border-red-500' : ''}`}
                />
                {errors[key] && (
                  <p className="text-sm text-red-600 mt-1">{errors[key]}</p>
                )}
              </div>
            )
          })}
        </div>

        {Object.keys(params).length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No hay parámetros definidos para este proyecto.
          </div>
        )}
      </div>
    </Card>
  )
}

