'use client'

import { Card } from '@/components/ui/card'

interface RfxParamsViewerProps {
  params: Record<string, any>
}

export function RfxParamsViewer({ params }: RfxParamsViewerProps) {
  // Formatear el nombre del campo para mostrar
  const formatFieldName = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Formatear el valor según su tipo
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'N/A'
    if (typeof value === 'boolean') return value ? 'Sí' : 'No'
    if (typeof value === 'number') {
      // Si es un porcentaje
      if (Math.abs(value) <= 100) return `${value}%`
      return value.toLocaleString()
    }
    return value.toString()
  }

  // Agrupar parámetros por categoría (heurística simple)
  const categorizeParams = (params: Record<string, any>) => {
    const categories: Record<string, Record<string, any>> = {
      'Información General': {},
      'Condiciones Comerciales': {},
      'Plazos y Entregas': {},
      'Evaluación': {},
      'Otros': {}
    }

    Object.entries(params).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase()

      if (lowerKey.includes('currency') || lowerKey.includes('start_date') || lowerKey.includes('contact')) {
        categories['Información General'][key] = value
      } else if (lowerKey.includes('payment') || lowerKey.includes('bond') || lowerKey.includes('penalties')) {
        categories['Condiciones Comerciales'][key] = value
      } else if (lowerKey.includes('delivery') || lowerKey.includes('timeline') || lowerKey.includes('execution')) {
        categories['Plazos y Entregas'][key] = value
      } else if (lowerKey.includes('score') || lowerKey.includes('evaluation') || lowerKey.includes('weight')) {
        categories['Evaluación'][key] = value
      } else {
        categories['Otros'][key] = value
      }
    })

    // Eliminar categorías vacías
    return Object.entries(categories).filter(([_, values]) => Object.keys(values).length > 0)
  }

  const categorizedParams = categorizeParams(params)

  if (Object.keys(params).length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No hay parámetros administrativos definidos para este proyecto.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {categorizedParams.map(([category, categoryParams]) => (
        <div key={category}>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b-2 border-blue-500">
            {category}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(categoryParams).map(([key, value]) => (
              <Card key={key} className="p-4 hover:shadow-md transition">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-500 mb-1">
                    {formatFieldName(key)}
                  </span>
                  <span className="text-base font-semibold text-gray-900">
                    {formatValue(value)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-800">
          💡 <strong>Tip:</strong> Estos parámetros se utilizarán como base para generar la especificación técnica del proyecto.
        </p>
      </div>
    </div>
  )
}

