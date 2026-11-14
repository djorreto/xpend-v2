'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { supabaseBrowser } from '@/lib/supabase'
import { Brain, CheckCircle, AlertCircle, ArrowRight, Sparkles, Filter, Edit, Trash2 } from 'lucide-react'
import { SIUpload, SISpendLine } from '@/types'
import { canManageSpendRole, canReadSpendRole, externalAiAllowed } from '@/lib/spend-privacy'
import { inferClassificationSource, SOURCE_LABEL } from '@/lib/spend-flow'
import { coverageShares, paretoIds, type CoverageRow, type ParetoChoice } from '@/lib/spend-coverage'
import { SpendCoverageBars } from '@/components/spend/spend-coverage-bar'
import { SpendFlowBar } from '@/components/spend/spend-flow-bar'
import { ReprocessButton } from '@/components/spend/reprocess-button'
import { SpendBrainChip } from '@/components/spend/spend-brain-chip'
import { BASE_TAXONOMY } from '@/lib/spend-taxonomy'
import { SpendDownloadButton } from '@/components/spend/spend-download-button'
import { ClassificationSourceBadge } from '@/components/spend/classification-source'

export default function ClassifyPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = supabaseBrowser()
  const uploadId = params.id as string
  const searchParams = useSearchParams()
  const paso = searchParams.get('paso') === 'revisar' ? 'revisar' : 'clasificar'

  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [upload, setUpload] = useState<SIUpload | null>(null)
  const [lines, setLines] = useState<SISpendLine[]>([])
  const [totalLinesCount, setTotalLinesCount] = useState(0)
  const [pendingGlobalCount, setPendingGlobalCount] = useState(0)
  const [classifiedGlobalCount, setClassifiedGlobalCount] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [classifying, setClassifying] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'classified'>('all')
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedLine, setSelectedLine] = useState<SISpendLine | null>(null)
  const [editCategory, setEditCategory] = useState('')
  const [editSubcategory, setEditSubcategory] = useState('')
  const [editScope, setEditScope] = useState<'supplier' | 'line'>('supplier')
  const [editMulti, setEditMulti] = useState(false)
  const [saving, setSaving] = useState(false)
  const [classifyingLineId, setClassifyingLineId] = useState<string | null>(null)
  const [coverage, setCoverage] = useState<CoverageRow[]>([])
  const [pareto, setPareto] = useState<ParetoChoice>(80)
  const [phase, setPhase] = useState<'idle' | 'modelo' | 'ia' | 'manual'>('idle')
  const [manualOnly, setManualOnly] = useState(false)
  const [modelTried, setModelTried] = useState<Set<string>>(new Set())
  const [aiTried, setAiTried] = useState<Set<string>>(new Set())
  const [coverageReady, setCoverageReady] = useState(false)
  const [stepProgress, setStepProgress] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [staleDownstream, setStaleDownstream] = useState(false)

  useEffect(() => {
    loadData()
  }, [uploadId])

  useEffect(() => {
    setFilter(paso === 'revisar' ? 'pending' : 'all')
  }, [paso])

  const PAGE_SIZE = 500

  const loadData = async (options?: { append?: boolean; offset?: number }) => {
    const append = options?.append === true
    const rangeStart = append ? (options?.offset ?? 0) : 0
    try {
      if (append) setLoadingMore(true)
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
        if (!canReadSpendRole(profile.role)) return

        const { data: uploadData } = await supabase
          .from('si_uploads')
          .select('*')
          .eq('id', uploadId)
          .eq('company_id', profile.company_id)
          .single()

        if (uploadData) {
          setUpload(uploadData)
        }

        const base = () =>
          supabase
            .from('si_spend_lines')
            .select('*')
            .eq('upload_id', uploadId)
            .eq('company_id', profile.company_id)

        const countOf = (needsReview?: boolean) => {
          let query = supabase
            .from('si_spend_lines')
            .select('id', { count: 'exact', head: true })
            .eq('upload_id', uploadId)
            .eq('company_id', profile.company_id)
          if (needsReview !== undefined) query = query.eq('needs_review', needsReview)
          return query
        }

        const [{ count: total }, { count: pending }, { count: classified }] = await Promise.all([
          countOf(),
          countOf(true),
          countOf(false),
        ])

        setTotalLinesCount(total ?? 0)
        setPendingGlobalCount(pending ?? 0)
        setClassifiedGlobalCount(classified ?? 0)

        const to = rangeStart + PAGE_SIZE - 1

        const { data: linesData, error: linesErr } = await base()
          .order('line_number', { ascending: true })
          .range(rangeStart, to)

        if (linesErr) throw linesErr

        if (linesData) {
          setLines(prev => (append ? [...prev, ...linesData] : linesData))
        }
        if (!append) await loadCoverage(profile.company_id)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const loadMoreLines = () => {
    if (lines.length >= totalLinesCount || loadingMore) return
    void loadData({ append: true, offset: lines.length })
  }

  const loadCoverage = async (companyId: string) => {
    const rows: CoverageRow[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('si_spend_lines')
        .select('id, amount, amount_net, currency, category, ai_justification, reviewed_at, reviewed_by, needs_review')
        .eq('upload_id', uploadId)
        .eq('company_id', companyId)
        .order('id')
        .range(from, from + 999)
      if (error) throw error
      for (const row of data || []) {
        rows.push({
          id: row.id,
          amount: Number(row.amount_net ?? row.amount) || 0,
          currency: String(row.currency || 'CLP').toUpperCase(),
          source: inferClassificationSource(row),
        })
      }
      if (!data || data.length < 1000) break
    }
    setCoverage(rows)
    setCoverageReady(true)
  }

  const scopeIds = useMemo(() => paretoIds(coverage, pareto), [coverage, pareto])
  const bars = useMemo(() => coverageShares(coverage, scopeIds), [coverage, scopeIds])
  const openIds = useMemo(
    () => coverage.filter(row => row.source === 'pendiente' && scopeIds.has(row.id)).map(row => row.id),
    [coverage, scopeIds]
  )
  const modelLeft = useMemo(() => openIds.filter(id => !modelTried.has(id)), [openIds, modelTried])
  const aiLeft = useMemo(
    () => openIds.filter(id => modelTried.has(id) && !aiTried.has(id)),
    [openIds, modelTried, aiTried]
  )

  const handleClassifyBatch = async () => {
    if (!user?.company_id || !modelLeft.length) return
    setClassifying(true)
    setPhase('modelo')
    setManualOnly(false)
    const total = modelLeft.length
    const tried = new Set(modelTried)
    try {
      let pending = [...modelLeft]
      let done = 0
      let guard = 0
      while (pending.length && guard < 200) {
        guard += 1
        const chunk = pending.slice(0, 200)
        setStepProgress(`Modelo ${done + chunk.length} de ${total}`)
        const response = await fetch('/api/si/classify-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ upload_id: uploadId, line_ids: chunk }),
        })
        const result = await response.json()
        if (!response.ok) {
          alert(result.error || 'No se pudieron aplicar las reglas')
          break
        }
        chunk.forEach(id => tried.add(id))
        setModelTried(new Set(tried))
        pending = pending.slice(chunk.length)
        done += chunk.length
        await loadCoverage(user.company_id)
      }
      await loadData()
    } catch (error: any) {
      alert(error.message)
    } finally {
      setClassifying(false)
      setPhase('idle')
      setStepProgress('')
    }
  }

  const handleFillWithAi = async () => {
    if (!user?.company_id || !aiLeft.length) return
    setClassifying(true)
    setPhase('ia')
    setManualOnly(false)
    const ids = [...aiLeft]
    const tried = new Set(aiTried)
    let cursor = 0
    let done = 0
    const takeOne = async () => {
      while (cursor < ids.length) {
        const lineId = ids[cursor]
        cursor += 1
        try {
          const response = await fetch('/api/si/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ line_id: lineId }),
          })
          const result = await response.json()
          if (response.ok && result.success && result.classification?.category) {
            const source = result.external ? 'llm' : inferClassificationSource({
              category: result.classification.category,
              ai_justification: result.classification.justification,
              needs_review: true,
            })
            setCoverage(current => current.map(row => row.id === lineId ? { ...row, source } : row))
          }
        } catch {
          // La línea queda sin categoría y pasa a la revisión manual.
        }
        tried.add(lineId)
        setAiTried(new Set(tried))
        done += 1
        setStepProgress(`IA ${done} de ${ids.length}`)
      }
    }
    try {
      await Promise.all(Array.from({ length: Math.min(3, ids.length) }, () => takeOne()))
      await loadData()
    } catch (error: any) {
      alert(error.message)
    } finally {
      setClassifying(false)
      setPhase('idle')
      setStepProgress('')
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

  const handleEditLine = (line: SISpendLine) => {
    setSelectedLine(line)
    setEditCategory(line.category || '')
    setEditSubcategory(line.subcategory || '')
    setEditScope(line.supplier_name ? 'supplier' : 'line')
    setEditMulti(false)
    setEditModalOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedLine || !editCategory) return

    setSaving(true)
    try {
      const response = await fetch('/api/si/update-classification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          line_id: selectedLine.id,
          category: editCategory,
          subcategory: editSubcategory || null,
          scope: selectedLine.supplier_name ? editScope : 'line',
          multi_rubro: editScope === 'supplier' && editMulti,
        })
      })

      const result = await response.json()
      if (response.ok) {
        // Actualizar la línea en el estado local
        setLines(lines.map(line =>
          line.id === selectedLine.id
            ? {
                ...line,
                category: editCategory,
                subcategory: editSubcategory,
                needs_review: false,
                reviewed_by: user?.id,
                reviewed_at: new Date().toISOString(),
              }
            : line
        ))
        setCoverage(current => current.map(row => row.id === selectedLine.id ? { ...row, source: 'humano' } : row))
        setEditModalOpen(false)
        setStaleDownstream(true)
        alert(result.message || 'Clasificación actualizada')
      } else {
        alert(`❌ Error: ${result.error}`)
      }
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleClassifyLine = async (lineId: string) => {
    setClassifyingLineId(lineId)
    try {
      const response = await fetch('/api/si/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_id: lineId })
      })
      const result = await response.json()
      setAiTried(prev => {
        const next = new Set(prev)
        next.add(lineId)
        return next
      })
      if (response.ok && result.success) {
        await loadData()
      } else {
        alert(result.message || result.error || 'La línea queda para revisión humana')
      }
    } catch {
      alert('No se pudo categorizar la línea')
    } finally {
      setClassifyingLineId(null)
    }
  }

  const handleDeleteUpload = async () => {
    if (!confirm('Se borrará esta carga y todas sus líneas de gasto. Esta acción no se puede deshacer.')) return
    setDeleting(true)
    try {
      const response = await fetch('/api/si/delete-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upload_id: uploadId })
      })
      const result = await response.json()
      if (!response.ok) {
        alert(result.error || 'No se pudo borrar la carga')
        return
      }
      router.push('/sourcing-intelligence')
    } catch {
      alert('No se pudo borrar la carga')
    } finally {
      setDeleting(false)
    }
  }

  const aiEnabled = externalAiAllowed(company?.settings)
  const manualIds = openIds.filter(id => modelTried.has(id) && (aiTried.has(id) || !aiEnabled))
  const filteredLines = lines.filter(line => {
    if (manualOnly) return manualIds.includes(line.id)
    if (filter === 'pending') return line.needs_review
    if (filter === 'classified') return !line.needs_review
    return true
  })
  if (manualOnly) {
    filteredLines.sort((a, b) => Number(b.amount_net ?? b.amount) - Number(a.amount_net ?? a.amount))
  }

  const openManual = async () => {
    setManualOnly(true)
    setFilter('all')
    if (!user?.company_id || !manualIds.length) return
    const missing = manualIds.filter(id => !lines.some(line => line.id === id))
    if (!missing.length) return
    const fetched: SISpendLine[] = []
    for (let index = 0; index < missing.length; index += 100) {
      const { data, error } = await supabase
        .from('si_spend_lines')
        .select('*')
        .eq('upload_id', uploadId)
        .eq('company_id', user.company_id)
        .in('id', missing.slice(index, index + 100))
      if (error) {
        alert(error.message)
        return
      }
      if (data) fetched.push(...data)
    }
    setLines(current => {
      const seen = new Set(current.map(line => line.id))
      return [...current, ...fetched.filter(line => !seen.has(line.id))]
    })
  }

  const getConfidenceBadge = (confidence?: number) => {
    if (!confidence) return null
    if (confidence >= 0.8) return <Badge className="bg-green-500">Alta: {(confidence * 100).toFixed(0)}%</Badge>
    if (confidence >= 0.5) return <Badge className="bg-yellow-500">Media: {(confidence * 100).toFixed(0)}%</Badge>
    return <Badge className="bg-red-500">Baja: {(confidence * 100).toFixed(0)}%</Badge>
  }

  const pendingInView = lines.filter(l => l.needs_review).length
  const classifiedInView = lines.filter(l => !l.needs_review).length

  const families = useMemo(() => Array.from(new Set(BASE_TAXONOMY.map(node => node.family))), [])
  const familyOptions = !editCategory || families.includes(editCategory) ? families : [editCategory, ...families]
  const subcategoryOptions = BASE_TAXONOMY.filter(node => node.family === editCategory).map(node => node.name)
  const subcategoryChoices = !editSubcategory || subcategoryOptions.includes(editSubcategory)
    ? subcategoryOptions
    : [editSubcategory, ...subcategoryOptions]

  const canRead = canReadSpendRole(user?.role)
  const canManage = canManageSpendRole(user?.role)

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
              <span>{paso === 'revisar' ? 'Revisión de gasto' : 'Clasificación de gasto'}</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Archivo: {upload?.file_name}
              {paso === 'revisar' ? ' · solo lo que falta confirmar o ya corrigió una persona.' : ' · aquí se aplican reglas y modelo.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SpendBrainChip />
            <ReprocessButton uploadId={uploadId} />
            <SpendDownloadButton uploadId={uploadId} />
            {canManage && (
              <Button variant="outline" onClick={handleDeleteUpload} disabled={deleting}>
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting ? 'Borrando...' : 'Borrar carga'}
              </Button>
            )}
            <Button variant="outline" onClick={() => router.push('/sourcing-intelligence/validacion')}>
              Cola de validación
            </Button>
            <Button
              onClick={handleGeneratePlan}
              disabled={classifiedGlobalCount === 0}
              variant="outline"
            >
              Generar Plan
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        <SpendFlowBar
          current={paso}
          uploadId={uploadId}
          pending={pendingGlobalCount}
        />

        <Card>
          <CardHeader>
            <CardTitle>Cobertura del gasto</CardTitle>
            <CardDescription>
              El corte usa el gasto neto de cada moneda, de mayor a menor.
              {pareto === 100 ? ' Entra todo el gasto.' : ` Entra el ${pareto}% de mayor gasto.`}
              {' '}Lo que queda bajo el corte se ve gris y no pasa a la IA ni a la revisión manual. Una línea que ya tiene categoría conserva su color.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>Categorizar hasta</span>
              {([80, 90, 100] as ParetoChoice[]).map(value => (
                <Button key={value} type="button" size="sm" variant={pareto === value ? 'default' : 'outline'} disabled={classifying} onClick={() => { setPareto(value); setManualOnly(false) }}>
                  {value === 80 ? 'Pareto 80%' : `${value}%`}
                </Button>
              ))}
            </div>
            {bars.length > 1 && (
              <p className="text-sm text-muted-foreground">
                Cada moneda tiene su propia barra. El corte no suma CLP con USD.
              </p>
            )}
            <SpendCoverageBars bars={bars} />
            {stepProgress && <p className="text-sm text-muted-foreground">{stepProgress}</p>}
            <div className="flex flex-wrap gap-2">
              {coverageReady && (modelLeft.length > 0 || phase === 'modelo') && (
                <Button onClick={handleClassifyBatch} disabled={classifying || modelLeft.length === 0} className="bg-gradient-to-r from-[#2AD4D2] to-[#3BE7AE]">
                  <Sparkles className="h-4 w-4 mr-2" />
                  {phase === 'modelo' ? 'Categorizando…' : 'Categorizar'}
                </Button>
              )}
              {coverageReady && phase !== 'modelo' && modelLeft.length === 0 && (aiLeft.length > 0 || phase === 'ia') && aiEnabled && (
                <Button onClick={handleFillWithAi} disabled={classifying || aiLeft.length === 0}>
                  {phase === 'ia' ? 'Completando con IA…' : `Completar con IA (${aiLeft.length})`}
                </Button>
              )}
              {coverageReady && !classifying && modelLeft.length === 0 && manualIds.length > 0 && (!aiEnabled || aiLeft.length === 0) && (
                <Button variant="outline" onClick={openManual} disabled={classifying}>
                  Completar a mano ({manualIds.length})
                </Button>
              )}
            </div>
            {coverageReady && !classifying && modelLeft.length > 0 && (
              <p className="text-sm text-muted-foreground">
                El primer paso aplica las reglas de la empresa, la taxonomía y el modelo. Solo entra el gasto dentro del corte.
              </p>
            )}
            {coverageReady && !classifying && modelLeft.length === 0 && aiLeft.length > 0 && aiEnabled && (
              <p className="text-sm text-muted-foreground">
                El modelo ya pasó. La IA puede intentar lo que sigue sin categoría. El gasto gris no sale de Xpend.
              </p>
            )}
            {coverageReady && !classifying && modelLeft.length === 0 && manualIds.length > 0 && !aiEnabled && (
              <p className="text-sm text-muted-foreground">
                La IA de la empresa está apagada. Lo que quedó dentro del corte se completa a mano.
              </p>
            )}
            {coverageReady && !classifying && modelLeft.length === 0 && aiLeft.length === 0 && manualIds.length > 0 && aiEnabled && (
              <p className="text-sm text-muted-foreground">
                La IA no encontró categoría para este gasto. Se completa a mano, de mayor a menor.
              </p>
            )}
            {coverageReady && !classifying && coverage.length > 0 && openIds.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Dentro del corte el gasto ya tiene categoría.
              </p>
            )}
          </CardContent>
        </Card>

        {manualOnly && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm">
            <span>Líneas dentro del corte que siguen sin categoría, de mayor a menor gasto.</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setManualOnly(false)}>
              Ver el archivo completo
            </Button>
          </div>
        )}

        {staleDownstream && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Guardaste un cambio en esta etapa. Kraljic y el plan siguen con el resultado anterior. Se actualizan cuando entras a Ver y generas el plan otra vez.
          </div>
        )}

        {!canRead && user && (
          <Card>
            <CardHeader>
              <CardTitle>Sin acceso al gasto</CardTitle>
              <CardDescription>Tu rol no puede ver las líneas de gasto de la empresa.</CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Líneas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalLinesCount > 0 ? totalLinesCount.toLocaleString() : lines.length}
              </div>
              {totalLinesCount > lines.length && (
                <p className="text-xs text-muted-foreground mt-1">
                  Cargadas en pantalla: {lines.length.toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingGlobalCount.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clasificadas</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{classifiedGlobalCount.toLocaleString()}</div>
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
                  Pendientes ({pendingInView})
                </Button>
                <Button
                  variant={filter === 'classified' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('classified')}
                >
                  Clasificadas ({classifiedInView})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredLines.map((line) => (
                <div key={line.id} className={`border rounded-lg p-5 hover:bg-gray-50 transition-colors ${
                  line.needs_review ? 'border-yellow-300 bg-yellow-50/30' : 'border-green-300 bg-green-50/30'
                }`}>
                  <div className="space-y-3">
                    {/* Header con número y badges */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3 flex-wrap gap-2">
                        <span className="font-bold text-gray-700">#{line.line_number}</span>
                        {line.needs_review && (
                          <Badge className="bg-yellow-500 text-white">⚠️ Requiere Revisión</Badge>
                        )}
                        {line.category && (
                          <>
                            <Badge className="bg-blue-600 text-white">
                              📂 {line.category}
                            </Badge>
                            <ClassificationSourceBadge source={inferClassificationSource(line)} />
                            {line.ai_confidence ? getConfidenceBadge(line.ai_confidence) : null}
                          </>
                        )}
                        {!line.category && (
                          <ClassificationSourceBadge source="pendiente" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {aiEnabled && aiLeft.includes(line.id) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleClassifyLine(line.id)}
                            disabled={classifyingLineId === line.id}
                          >
                            {classifyingLineId === line.id ? 'Categorizando...' : 'Categorizar esta línea'}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditLine(line)}
                          className="flex-shrink-0"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                      </div>
                    </div>

                    {/* Descripción */}
                    <div>
                      <p className="text-lg font-semibold text-gray-900">{line.description}</p>
                    </div>

                    {/* Detalles */}
                    <div className="flex items-center space-x-6 text-sm">
                      {line.supplier_name && (
                        <span className="text-gray-600">
                          <strong>Proveedor:</strong> {line.supplier_name}
                        </span>
                      )}
                      <span className="text-gray-600">
                        <strong>Neto:</strong> ${Number(line.amount_net ?? line.amount).toLocaleString()} {line.currency}
                        {line.amount_net != null && Number(line.amount_net) !== Number(line.amount) ? ` · original ${Number(line.amount).toLocaleString()}` : ''}
                      </span>
                    </div>

                    {/* Justificación de IA (si existe) */}
                    {line.ai_justification && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs font-semibold text-blue-900 mb-1">
                          Origen: {SOURCE_LABEL[inferClassificationSource(line)]}
                        </p>
                        <p className="text-sm text-blue-800 italic">
                          &quot;{line.ai_justification}&quot;
                        </p>
                      </div>
                    )}

                    {/* Mensaje si no está clasificada */}
                    {line.needs_review && !line.category && (
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          Esta línea todavía no tiene categoría. Aplica las reglas internas o edítala a mano.
                          {aiEnabled ? ' Si la descripción alcanza, también puedes categorizar solo esta línea.' : ''}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {filteredLines.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  {manualOnly ? 'Dentro del corte no quedan líneas sin categoría.' : 'No hay líneas para mostrar con este filtro'}
                </div>
              )}
              {totalLinesCount > 0 && lines.length < totalLinesCount && !manualOnly && (
                <div className="flex flex-col items-center gap-2 pt-6 border-t">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {lines.length.toLocaleString()} de {totalLinesCount.toLocaleString()} líneas
                    cargadas en el navegador
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={loadMoreLines}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <span className="inline-block h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin mr-2 align-middle" />
                        Cargando…
                      </>
                    ) : (
                      `Cargar ${Math.min(PAGE_SIZE, totalLinesCount - lines.length).toLocaleString()} más`
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Edit Modal */}
        <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Editar Clasificación</DialogTitle>
              <DialogDescription>
                Elige la familia y la subcategoría de la taxonomía de Xpend.
              </DialogDescription>
            </DialogHeader>

            {selectedLine && (
              <div className="space-y-4 py-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="category">Familia</Label>
                    <select
                      id="category"
                      value={editCategory}
                      onChange={(event) => {
                        const family = event.target.value
                        const first = BASE_TAXONOMY.find(node => node.family === family)
                        setEditCategory(family)
                        setEditSubcategory(first?.name || '')
                      }}
                      className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                    >
                      <option value="">Elige una familia</option>
                      {familyOptions.map(family => (
                        <option key={family} value={family}>{family}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="subcategory">Subcategoría</Label>
                    <select
                      id="subcategory"
                      value={editSubcategory}
                      onChange={(event) => setEditSubcategory(event.target.value)}
                      disabled={!editCategory}
                      className="h-10 w-full rounded-md border bg-white px-3 text-sm disabled:opacity-50"
                    >
                      <option value="">Elige una subcategoría</option>
                      {subcategoryChoices.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-sm font-medium text-gray-900">{selectedLine.description}</p>
                  <p className="mt-1 text-xs text-gray-600">
                    {selectedLine.supplier_name && `${selectedLine.supplier_name} · `}
                    ${selectedLine.amount.toLocaleString()} {selectedLine.currency}
                  </p>
                </div>

                {selectedLine.supplier_name && (
                  <div className="space-y-2 text-sm">
                    <p className="font-medium">Esta corrección vale para</p>
                    <label className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="edit-scope"
                        checked={editScope === 'supplier'}
                        onChange={() => setEditScope('supplier')}
                      />
                      <span>Siempre este proveedor. Una glosa distinta no cambia la familia.</span>
                    </label>
                    <label className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="edit-scope"
                        checked={editScope === 'line'}
                        onChange={() => setEditScope('line')}
                      />
                      <span>Solo esta compra. No se crea una palabra para el resto.</span>
                    </label>
                    {editScope === 'supplier' && (
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={editMulti}
                          onChange={event => setEditMulti(event.target.checked)}
                        />
                        <span>Vende varias cosas. Si la glosa es clara, manda la glosa.</span>
                      </label>
                    )}
                  </div>
                )}

                {/* Botones */}
                <div className="flex space-x-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setEditModalOpen(false)}
                    className="flex-1"
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    className="flex-1 bg-gradient-to-r from-[#2AD4D2] to-[#3BE7AE]"
                    disabled={!editCategory || !editSubcategory || saving}
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Guardando...
                      </>
                    ) : (
                      'Guardar Cambios'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}

