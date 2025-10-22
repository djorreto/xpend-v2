'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { supabaseBrowser } from '@/lib/supabase'
import { Brain, CheckCircle, AlertCircle, ArrowRight, Sparkles, Filter } from 'lucide-react'
import { SIUpload, SISpendLine } from '@/types'

export default function ClassifyPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = supabaseBrowser()
  const uploadId = params.id as string

  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [upload, setUpload] = useState<SIUpload | null>(null)
  const [lines, setLines] = useState<SISpendLine[]>([])
  const [loading, setLoading] = useState(true)
  const [classifying, setClassifying] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'classified'>('all')

  useEffect(() => {
    loadData()
  }, [uploadId])

  const loadData = async () => {
    try {
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

        // Cargar upload
        const { data: uploadData } = await supabase
          .from('si_uploads')
          .select('*')
          .eq('id', uploadId)
          .eq('company_id', profile.company_id)
          .single()

        if (uploadData) {
          setUpload(uploadData)
        }

        // Cargar líneas
        const { data: linesData } = await supabase
          .from('si_spend_lines')
          .select('*')
          .eq('upload_id', uploadId)
          .eq('company_id', profile.company_id)
          .order('line_number', { ascending: true })
          .limit(100)

        if (linesData) {
          setLines(linesData)
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClassifyBatch = async () => {
    setClassifying(true)
    try {
      const response = await fetch('/api/si/classify-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upload_id: uploadId })
      })

      const result = await response.json()
      if (response.ok) {
        await loadData()
        alert(`✅ ${result.classified_count} líneas clasificadas exitosamente`)
      } else {
        alert(`❌ Error: ${result.error}`)
      }
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`)
    } finally {
      setClassifying(false)
    }
  }

  const handleGeneratePlan = async () => {
    try {
      const response = await fetch('/api/si/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upload_id: uploadId,
          plan_name: `Plan ${new Date().getFullYear()}`,
          plan_year: new Date().getFullYear()
        })
      })

      const result = await response.json()
      if (response.ok) {
        router.push(`/sourcing-intelligence/${uploadId}/plan`)
      } else {
        alert(`❌ Error: ${result.error}`)
      }
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`)
    }
  }

  const filteredLines = lines.filter(line => {
    if (filter === 'pending') return line.needs_review
    if (filter === 'classified') return !line.needs_review
    return true
  })

  const getConfidenceBadge = (confidence?: number) => {
    if (!confidence) return null
    if (confidence >= 0.8) return <Badge className="bg-green-500">Alta: {(confidence * 100).toFixed(0)}%</Badge>
    if (confidence >= 0.5) return <Badge className="bg-yellow-500">Media: {(confidence * 100).toFixed(0)}%</Badge>
    return <Badge className="bg-red-500">Baja: {(confidence * 100).toFixed(0)}%</Badge>
  }

  const pendingCount = lines.filter(l => l.needs_review).length
  const classifiedCount = lines.filter(l => !l.needs_review).length

  if (loading) {
    return (
      <MainLayout user={user} companyName={company?.name}>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <Brain className="h-8 w-8" style={{ color: '#2AD4D2' }} />
              <span>Clasificación con IA</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Archivo: {upload?.file_name}
            </p>
          </div>
          <div className="flex space-x-3">
            <Button
              onClick={handleClassifyBatch}
              disabled={classifying || pendingCount === 0}
              className="bg-gradient-to-r from-[#2AD4D2] to-[#3BE7AE]"
            >
              {classifying ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Clasificando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Clasificar Automáticamente
                </>
              )}
            </Button>
            <Button
              onClick={handleGeneratePlan}
              disabled={classifiedCount === 0}
              variant="outline"
            >
              Generar Plan
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Instructions Banner */}
        {pendingCount > 0 && (
          <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Brain className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-blue-900 mb-2">
                    🤖 Listo para clasificar con IA
                  </h3>
                  <p className="text-blue-800 mb-3">
                    Tus {pendingCount} líneas están marcadas como "Requiere Revisión" porque aún no han sido clasificadas. 
                    La IA las analizará y asignará categorías automáticamente.
                  </p>
                  <div className="bg-white/50 rounded-lg p-3 mb-3">
                    <p className="text-sm font-medium text-blue-900 mb-2">📋 ¿Qué hará la IA?</p>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                      <li>Analizar la descripción y el proveedor de cada línea</li>
                      <li>Asignar una categoría de gasto (ej: Servicios de TI, Suministros, etc.)</li>
                      <li>Calcular un nivel de confianza (alta, media o baja)</li>
                      <li>Proporcionar una justificación de la clasificación</li>
                    </ul>
                  </div>
                  <Button
                    onClick={handleClassifyBatch}
                    disabled={classifying}
                    size="lg"
                    className="bg-gradient-to-r from-[#2AD4D2] to-[#3BE7AE] hover:opacity-90"
                  >
                    {classifying ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Clasificando... Esto puede tomar 10-30 segundos
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5 mr-2" />
                        Comenzar Clasificación Automática
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Líneas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lines.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clasificadas</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{classifiedCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Líneas de Gasto</CardTitle>
                <CardDescription>Revisa y aprueba las clasificaciones</CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  Todas
                </Button>
                <Button
                  variant={filter === 'pending' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('pending')}
                >
                  Pendientes ({pendingCount})
                </Button>
                <Button
                  variant={filter === 'classified' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('classified')}
                >
                  Clasificadas ({classifiedCount})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredLines.slice(0, 50).map((line) => (
                <div key={line.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-sm text-muted-foreground">#{line.line_number}</span>
                        {line.category && (
                          <Badge variant="outline">{line.category}</Badge>
                        )}
                        {line.ai_confidence && getConfidenceBadge(line.ai_confidence)}
                        {line.needs_review && (
                          <Badge variant="outline" className="bg-yellow-50">Requiere Revisión</Badge>
                        )}
                      </div>
                      <p className="font-medium mb-1">{line.description}</p>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        {line.supplier_name && <span>Proveedor: {line.supplier_name}</span>}
                        <span>Monto: ${line.amount.toLocaleString()} {line.currency}</span>
                      </div>
                      {line.ai_justification && (
                        <p className="text-sm text-muted-foreground mt-2 italic">
                          {line.ai_justification}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {filteredLines.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No hay líneas para mostrar con este filtro
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}

