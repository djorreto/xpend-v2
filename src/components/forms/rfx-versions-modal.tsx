'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { X, RotateCcw, Clock, User } from 'lucide-react'

interface Version {
  id: string
  version_number: number
  snapshot_data: any
  version_notes: string
  created_at: string
  created_by_user?: {
    full_name?: string
    email: string
  }
}

interface RfxVersionsModalProps {
  projectId: string
  onClose: () => void
  onVersionRestored: () => void
}

export function RfxVersionsModal({ projectId, onClose, onVersionRestored }: RfxVersionsModalProps) {
  const [versions, setVersions] = useState<Version[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRestoring, setIsRestoring] = useState<string | null>(null)

  useEffect(() => {
    loadVersions()
  }, [projectId])

  const loadVersions = async () => {
    try {
      const response = await fetch(`/api/rfx-maker/version?project_id=${projectId}`)
      const data = await response.json()

      if (data.success) {
        setVersions(data.versions)
      }
    } catch (error) {
      console.error('Error loading versions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRestore = async (versionId: string, versionNumber: number) => {
    if (!confirm(`¿Estás seguro de restaurar la versión ${versionNumber}? Esta acción creará un backup del estado actual.`)) {
      return
    }

    setIsRestoring(versionId)
    try {
      const response = await fetch('/api/rfx-maker/version', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          version_id: versionId,
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert(data.message)
        onVersionRestored()
        onClose()
      } else {
        alert('Error: ' + data.error)
      }
    } catch (error) {
      console.error('Error restoring version:', error)
      alert('Error al restaurar la versión')
    } finally {
      setIsRestoring(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Historial de Versiones</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">
              Cargando historial...
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No hay versiones anteriores de este proyecto.
            </div>
          ) : (
            <div className="space-y-4">
              {versions.map((version) => (
                <Card key={version.id} className="p-4 hover:shadow-md transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg font-bold text-blue-600">
                          Versión {version.version_number}
                        </span>
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {new Date(version.created_at).toLocaleString('es-ES')}
                        </span>
                      </div>

                      {version.version_notes && (
                        <p className="text-gray-700 mb-2">{version.version_notes}</p>
                      )}

                      {version.created_by_user && (
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {version.created_by_user.full_name || version.created_by_user.email}
                        </p>
                      )}

                      {/* Vista previa del snapshot */}
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm text-blue-600 hover:underline">
                          Ver contenido
                        </summary>
                        <div className="mt-2 p-3 bg-gray-50 rounded text-sm overflow-auto max-h-40">
                          <pre>{JSON.stringify(version.snapshot_data, null, 2)}</pre>
                        </div>
                      </details>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(version.id, version.version_number)}
                      disabled={isRestoring !== null}
                      className="ml-4"
                    >
                      {isRestoring === version.id ? (
                        <>Restaurando...</>
                      ) : (
                        <>
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Restaurar
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50">
          <p className="text-sm text-gray-600">
            💡 <strong>Tip:</strong> Al restaurar una versión, se creará automáticamente un backup del estado actual.
          </p>
        </div>
      </Card>
    </div>
  )
}

