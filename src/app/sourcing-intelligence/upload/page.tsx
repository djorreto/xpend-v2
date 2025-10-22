'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, FileSpreadsheet, CheckCircle, ArrowRight, AlertCircle } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase'

export default function UploadPage() {
  const router = useRouter()
  const supabase = supabaseBrowser()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [columns, setColumns] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [step, setStep] = useState<'select' | 'mapping' | 'uploading' | 'success'>('select')
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*, companies(*)')
      .eq('id', session.user.id)
      .single()

    if (profile) {
      setUser(profile)
      setCompany(profile.companies)
    }
  }

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile)
    setError(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      validateAndSetFile(droppedFile)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      validateAndSetFile(selectedFile)
    }
  }

  const validateAndSetFile = (selectedFile: File) => {
    // Validar tipo
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ]
    if (!validTypes.includes(selectedFile.type) &&
        !selectedFile.name.endsWith('.xlsx') &&
        !selectedFile.name.endsWith('.xls') &&
        !selectedFile.name.endsWith('.csv')) {
      setError('Formato no válido. Use Excel (.xlsx, .xls) o CSV.')
      return
    }

    // Validar tamaño (10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('Archivo demasiado grande. Máximo 10MB.')
      return
    }

    handleFileSelect(selectedFile)
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/si/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Error al subir archivo')
      }

      setUploadResult(result)
      setColumns(result.columns)
      setMapping(result.column_mapping)
      setStep('mapping')

    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleConfirmMapping = () => {
    setStep('success')
  }

  const handleStartClassification = async () => {
    if (!uploadResult?.upload_id) return

    router.push(`/sourcing-intelligence/${uploadResult.upload_id}/classify`)
  }

  const requiredFields = [
    { key: 'description', label: 'Descripción *', required: true },
    { key: 'amount', label: 'Monto *', required: true },
    { key: 'supplier_name', label: 'Proveedor', required: false },
    { key: 'purchase_order', label: 'Orden de Compra', required: false },
    { key: 'currency', label: 'Moneda', required: false },
    { key: 'cost_center', label: 'Centro de Costo', required: false },
    { key: 'purchase_date', label: 'Fecha', required: false },
  ]

  const isMappingValid = mapping.description && mapping.amount

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Cargar Archivo de Gasto</h1>
          <p className="text-muted-foreground mt-2">
            Sube un archivo Excel o CSV con órdenes de compra para análisis con IA
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center space-x-4 py-6">
          <div className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step !== 'select' ? 'bg-green-500' : 'bg-blue-500'} text-white`}>
              {step !== 'select' ? <CheckCircle className="h-5 w-5" /> : '1'}
            </div>
            <span className="ml-2 font-medium">Seleccionar Archivo</span>
          </div>
          <div className="w-12 h-0.5 bg-gray-300" />
          <div className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step === 'success' ? 'bg-green-500' : step === 'mapping' ? 'bg-blue-500' : 'bg-gray-300'} text-white`}>
              {step === 'success' ? <CheckCircle className="h-5 w-5" /> : '2'}
            </div>
            <span className="ml-2 font-medium">Mapear Columnas</span>
          </div>
          <div className="w-12 h-0.5 bg-gray-300" />
          <div className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step === 'success' ? 'bg-green-500' : 'bg-gray-300'} text-white`}>
              {step === 'success' ? <CheckCircle className="h-5 w-5" /> : '3'}
            </div>
            <span className="ml-2 font-medium">Listo</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-900">Error</h4>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Step 1: File Selection */}
        {step === 'select' && (
          <Card>
            <CardHeader>
              <CardTitle>Paso 1: Selecciona tu archivo</CardTitle>
              <CardDescription>
                Arrastra un archivo Excel o CSV, o haz click para seleccionar
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!file ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-gray-400 transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                  <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-lg font-medium mb-2">
                    Arrastra un archivo aquí o haz click para seleccionar
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Formatos soportados: Excel (.xlsx, .xls) o CSV
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Máximo 10MB - Hasta 5,000 líneas
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FileSpreadsheet className="h-8 w-8 text-green-600" />
                      <div>
                        <h4 className="font-medium">{file.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" onClick={() => setFile(null)}>
                      Cambiar
                    </Button>
                  </div>

                  <Button
                    onClick={handleUpload}
                    disabled={uploading}
                    size="lg"
                    className="w-full bg-gradient-to-r from-[#2AD4D2] to-[#3BE7AE]"
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        Subir y Analizar
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Column Mapping */}
        {step === 'mapping' && (
          <Card>
            <CardHeader>
              <CardTitle>Paso 2: Mapeo de Columnas</CardTitle>
              <CardDescription>
                Verifica que las columnas se hayan detectado correctamente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Detectadas automáticamente:</strong> {uploadResult?.processed_rows} líneas de {uploadResult?.total_rows}
                </p>
              </div>

              <div className="space-y-4">
                {requiredFields.map((field) => (
                  <div key={field.key} className="flex items-center space-x-4">
                    <label className="w-40 font-medium">
                      {field.label}
                    </label>
                    <Select
                      value={mapping[field.key] || 'none'}
                      onValueChange={(value) => {
                        if (value === 'none') {
                          const newMapping = { ...mapping }
                          delete newMapping[field.key]
                          setMapping(newMapping)
                        } else {
                          setMapping({ ...mapping, [field.key]: value })
                        }
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Seleccionar columna..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin mapear</SelectItem>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="flex space-x-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep('select')
                    setFile(null)
                    setColumns([])
                    setMapping({})
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmMapping}
                  disabled={!isMappingValid}
                  className="flex-1 bg-gradient-to-r from-[#2AD4D2] to-[#3BE7AE]"
                >
                  Confirmar y Continuar
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Success */}
        {step === 'success' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="h-6 w-6 text-green-500" />
                <span>¡Archivo Cargado Exitosamente!</span>
              </CardTitle>
              <CardDescription>
                Tu archivo ha sido procesado. Ahora puedes clasificar las líneas con IA.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                <p className="text-sm text-green-900">
                  <strong>Archivo:</strong> {file?.name}
                </p>
                <p className="text-sm text-green-900">
                  <strong>Líneas procesadas:</strong> {uploadResult?.processed_rows}
                </p>
                <p className="text-sm text-green-900">
                  <strong>Columnas mapeadas:</strong> {Object.keys(mapping).length}
                </p>
              </div>

              <div className="flex space-x-4">
                <Button
                  variant="outline"
                  onClick={() => router.push('/sourcing-intelligence')}
                >
                  Volver al Inicio
                </Button>
                <Button
                  onClick={handleStartClassification}
                  className="flex-1 bg-gradient-to-r from-[#2AD4D2] to-[#3BE7AE]"
                >
                  Comenzar Clasificación con IA
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}

