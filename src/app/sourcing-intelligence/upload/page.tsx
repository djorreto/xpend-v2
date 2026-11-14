'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, FileSpreadsheet, CheckCircle, ArrowRight, AlertCircle } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase'
import { canManageSpendRole } from '@/lib/spend-privacy'
import * as XLSX from 'xlsx'
import { SpendFlowBar } from '@/components/spend/spend-flow-bar'
import { SpendBrainChip } from '@/components/spend/spend-brain-chip'
import { SpendLoadForm } from '@/components/spend/spend-load-form'
import { TAX_REFERENCES, type TaxReference } from '@/lib/spend-basis'

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
  const [excelSheetNames, setExcelSheetNames] = useState<string[]>([])
  const [selectedExcelSheet, setSelectedExcelSheet] = useState<string>('')
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [references, setReferences] = useState<TaxReference[]>(TAX_REFERENCES)

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
      const [{ data: groupRows }, { data: rateRows }] = await Promise.all([
        supabase.from('si_spend_groups').select('id, name').eq('company_id', profile.company_id).order('name'),
        supabase.from('si_tax_rates').select('country_code, country_name, tax_name, rate, note').order('country_name'),
      ])
      setGroups(groupRows || [])
      if (rateRows?.length) {
        setReferences(rateRows.map(row => ({
          code: row.country_code,
          name: row.country_name,
          taxName: row.tax_name,
          rate: row.rate == null ? null : Number(row.rate),
          note: row.note || '',
        })))
      }
    }
  }

  const loadExcelSheetNames = async (selectedFile: File) => {
    if (!/\.xlsx?$/i.test(selectedFile.name)) {
      setExcelSheetNames([])
      setSelectedExcelSheet('')
      return
    }
    try {
      const buf = await selectedFile.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const names = wb.SheetNames || []
      setExcelSheetNames(names)
      setSelectedExcelSheet(names[0] || '')
    } catch {
      setExcelSheetNames([])
      setSelectedExcelSheet('')
    }
  }

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile)
    setError(null)
    void loadExcelSheetNames(selectedFile)
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

    const maxMb = 80
    if (selectedFile.size > maxMb * 1024 * 1024) {
      setError(`Archivo demasiado grande. Máximo ${maxMb} MB.`)
      return
    }

    handleFileSelect(selectedFile)
  }

  const postFile = async (preview: boolean, decisions?: Record<string, unknown>) => {
    if (!file) return null
    const formData = new FormData()
    formData.append('file', file)
    if (selectedExcelSheet && excelSheetNames.includes(selectedExcelSheet)) {
      formData.append('sheet_name', selectedExcelSheet)
    }
    if (preview) formData.append('preview', '1')
    if (Object.keys(mapping).length) formData.append('mapping', JSON.stringify(mapping))
    if (decisions) formData.append('decisions', JSON.stringify(decisions))
    const response = await fetch('/api/si/upload', { method: 'POST', body: formData })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'No se pudo leer el archivo')
    return result
  }

  const handleUpload = async () => {
    setUploading(true)
    setError(null)
    try {
      const result = await postFile(true)
      setUploadResult(result)
      setColumns(result.columns || [])
      setMapping(result.column_mapping || {})
      setStep('mapping')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleConfirmMapping = async (decisions: Record<string, unknown>) => {
    setUploading(true)
    setError(null)
    try {
      const result = await postFile(false, decisions)
      setUploadResult(result)
      if (decisions.new_group_name && user?.company_id) {
        const { data: groupRows } = await supabase
          .from('si_spend_groups')
          .select('id, name')
          .eq('company_id', user.company_id)
          .order('name')
        setGroups(groupRows || [])
      }
      setStep('success')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleStartClassification = async () => {
    if (!uploadResult?.upload_id) return

    router.push(`/sourcing-intelligence/${uploadResult.upload_id}/classify`)
  }

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Cargar Archivo de Gasto</h1>
            <p className="text-muted-foreground mt-2">
              Sube un Excel o CSV. Se guardan solo las columnas mapeadas, no el archivo original.
            </p>
          </div>
          <SpendBrainChip />
        </div>

        <SpendFlowBar current={step === 'select' ? 'cargar' : 'mapear'} uploadId={uploadResult?.upload_id} />

        {user && !canManageSpendRole(user.role) && (
          <Card>
            <CardHeader>
              <CardTitle>No puedes cargar gasto</CardTitle>
              <CardDescription>
                Solo un manager o un administrador puede subir un archivo de gasto.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

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
        {step === 'select' && canManageSpendRole(user?.role) && (
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
                    Hasta 80 MB · hasta 200.000 filas · elige la hoja si el libro tiene varias
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
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setFile(null)
                        setExcelSheetNames([])
                        setSelectedExcelSheet('')
                      }}
                    >
                      Cambiar
                    </Button>
                  </div>

                  {excelSheetNames.length > 1 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Hoja de Excel a importar</p>
                      <Select value={selectedExcelSheet} onValueChange={setSelectedExcelSheet}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona hoja" />
                        </SelectTrigger>
                        <SelectContent>
                          {excelSheetNames.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Solo se importa una hoja por carga. Repite la carga para otras hojas si lo necesitas.
                      </p>
                    </div>
                  )}

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
                        Revisar archivo
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
              <CardTitle>Paso 2: Confirmar la base</CardTitle>
              <CardDescription>
                {uploadResult?.total_rows?.toLocaleString()} líneas
                {uploadResult?.sheet_used ? ` · hoja ${uploadResult.sheet_used}` : ''}. País, moneda e impuesto quedan guardados y se pueden cambiar después.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SpendLoadForm
                key={`${uploadResult?.stats?.dated || 0}-${(uploadResult?.stats?.currencies || []).map((item: { code: string }) => item.code).join()}-${(uploadResult?.stats?.countries || []).map((item: { code: string }) => item.code).join()}`}
                columns={columns}
                mapping={mapping}
                onMapping={setMapping}
                stats={uploadResult?.stats || { currencies: [], countries: [], dated: 0, min: null, max: null, total: 0 }}
                groups={groups}
                references={references}
                saving={uploading}
                onReread={handleUpload}
                onCancel={() => {
                  setStep('select')
                  setFile(null)
                  setColumns([])
                  setMapping({})
                }}
                onConfirm={handleConfirmMapping}
              />
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
                Las líneas quedaron guardadas en neto, sin el archivo original. Ahora puedes aplicar las reglas de la empresa.
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

