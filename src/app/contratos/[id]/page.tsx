'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { LoadingSpinner } from '@/components/ui/loading'
import { useToast } from '@/components/ui/toast'
import { supabaseBrowser } from '@/lib/supabase'
import { loadAppSession, type AppSession } from '@/lib/offer-room'
import { errorMessage } from '@/lib/errors'
import { formatCurrency } from '@/lib/utils'

type Extraction = {
  id: string
  field_key: string
  proposed_value: string
  confirmed_value: string | null
  source: string
  confidence: string
  evidence_quote: string
  evidence_location: string
  review_status: string
}
type Finding = {
  id: string
  kind: string
  statement: string
  corrected_statement: string | null
  evidence_quote: string
  evidence_location: string
  confidence: string
  review_status: string
}
type Version = { id: string; version: number; status: string; body: string; approved_at: string | null; created_by: string }

const FIELD_COLUMN: Record<string, string> = {
  currency: 'currency',
  amount: 'amount',
  starts_on: 'starts_on',
  ends_on: 'ends_on',
  renewal: 'renewal',
  notice_days: 'notice_days',
  counterparty: 'counterparty_name',
  object: 'object_text',
  adjustment: 'adjustment_terms',
  payment: 'payment_terms',
}

export default function ContratoPage() {
  const params = useParams()
  const contractId = params.id as string
  const router = useRouter()
  const { addToast } = useToast()
  const [session, setSession] = useState<AppSession | null>(null)
  const [contract, setContract] = useState<Record<string, unknown> | null>(null)
  const [documents, setDocuments] = useState<{ id: string; file_name: string; kind: string; version: number; processing: string; storage_path: string; extracted_text: string | null }[]>([])
  const [extractions, setExtractions] = useState<Extraction[]>([])
  const [findings, setFindings] = useState<Finding[]>([])
  const [versions, setVersions] = useState<Version[]>([])
  const [needle, setNeedle] = useState('')
  const [correction, setCorrection] = useState<Record<string, string>>({})
  const [variance, setVariance] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const appSession = await loadAppSession()
    if (!appSession || appSession.role === 'supplier') {
      router.push('/sala')
      return
    }
    setSession(appSession)
    const supabase = supabaseBrowser()
    const [{ data: row }, { data: docs }, { data: fields }, { data: found }, { data: history }] = await Promise.all([
      supabase.from('contracts').select('*').eq('id', contractId).single(),
      supabase.from('contract_documents').select('*').eq('contract_id', contractId).order('created_at'),
      supabase.from('contract_extractions').select('*').eq('contract_id', contractId).order('created_at'),
      supabase.from('contract_findings').select('*').eq('contract_id', contractId).order('created_at'),
      supabase.from('contract_versions').select('id, version, status, body, approved_at, created_by').eq('contract_id', contractId).order('version'),
    ])
    setContract(row)
    setDocuments(docs || [])
    setExtractions(fields || [])
    setFindings(found || [])
    setVersions(history || [])
    setLoading(false)
  }, [contractId, router])

  useEffect(() => { load() }, [load])

  const confirmField = async (field: Extraction, status: 'confirmed' | 'corrected' | 'rejected') => {
    const value = status === 'rejected' ? null : (correction[field.id] || field.proposed_value)
    const { error } = await supabaseBrowser().from('contract_extractions').update({
      review_status: status,
      confirmed_value: value,
      source: 'confirmed',
      reviewed_by: session?.userId,
      reviewed_at: new Date().toISOString(),
    }).eq('id', field.id)
    if (error) {
      addToast({ type: 'error', title: 'No se confirmó', message: error.message })
      return
    }
    const column = FIELD_COLUMN[field.field_key]
    if (column && status !== 'rejected' && value) {
      await supabaseBrowser().from('contracts').update({
        [column]: field.field_key === 'amount' || field.field_key === 'notice_days' ? Number(value) : value,
        updated_at: new Date().toISOString(),
      }).eq('id', contractId)
    }
    addToast({ type: 'success', title: 'Revisión guardada', message: 'La propuesta original sigue en el historial del campo.' })
    load()
  }

  const reviewFinding = async (finding: Finding, status: 'confirmed' | 'corrected' | 'rejected') => {
    const { error } = await supabaseBrowser().from('contract_findings').update({
      review_status: status,
      corrected_statement: status === 'corrected' ? (correction[finding.id] || finding.statement) : finding.corrected_statement,
      reviewed_by: session?.userId,
      reviewed_at: new Date().toISOString(),
    }).eq('id', finding.id)
    if (error) addToast({ type: 'error', title: 'No se guardó', message: error.message })
    else load()
  }

  const uploadMore = async (file: File, kind: string) => {
    const body = new FormData()
    body.set('file', file)
    body.set('contractId', contractId)
    body.set('kind', kind)
    const response = await fetch('/api/contracts/ingest', { method: 'POST', body })
    const payload = await response.json()
    if (!response.ok) addToast({ type: 'error', title: 'No se adjuntó', message: payload.error || 'Error' })
    else {
      addToast({ type: 'success', title: 'Documento agregado', message: 'El archivo original del contrato sigue en su versión.' })
      load()
    }
  }

  const download = async (path: string, name: string) => {
    const { data, error } = await supabaseBrowser().storage.from('documents').download(path)
    if (error || !data) {
      addToast({ type: 'error', title: 'No se descargó', message: errorMessage(error, 'Sin acceso al archivo.') })
      return
    }
    const url = URL.createObjectURL(data)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const approve = async (versionId: string) => {
    const { error } = await supabaseBrowser().from('contract_versions').update({
      status: 'approved',
      variance_justification: variance.trim() || null,
    }).eq('id', versionId)
    if (error) addToast({ type: 'error', title: 'No se aprobó', message: errorMessage(error, 'La versión sigue en revisión.') })
    else {
      addToast({ type: 'success', title: 'Versión aprobada', message: 'Quedó congelada. Una edición posterior crea otra versión.' })
      load()
    }
  }

  const exportApproved = () => {
    const approved = [...versions].reverse().find(version => version.status === 'approved')
    if (!approved) return
    const blob = new Blob([approved.body], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${contract?.code || 'contrato'}-v${approved.version}.txt`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  if (loading || !session) return <MainLayout><LoadingSpinner /></MainLayout>
  if (!contract) return <MainLayout><p className="text-sm">Este contrato no está disponible.</p></MainLayout>

  const text = documents.map(document => document.extracted_text || '').join('\n')
  const hit = needle.trim() ? text.toLowerCase().indexOf(needle.trim().toLowerCase()) : -1
  const snippet = hit >= 0 ? text.slice(Math.max(0, hit - 80), hit + needle.length + 80) : ''
  const shownAmount = contract.amount == null ? 'pendiente' : formatCurrency(Number(contract.amount), String(contract.currency || 'USD'))

  return (
    <MainLayout user={{ name: session.name, email: session.email, role: session.role }} companyName={session.companyName}>
      <div className="space-y-5">
        <Button variant="outline" onClick={() => router.push('/contratos')}>Volver</Button>
        <div>
          <h1>{String(contract.code)} · {String(contract.name)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Estado {String(contract.status)} · origen {String(contract.origin)} · monto {shownAmount}
            {contract.ends_on ? ` · termina ${String(contract.ends_on)}` : ''}
          </p>
        </div>
        <Card>
          <CardHeader><CardTitle>Ficha</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Contraparte: {String(contract.counterparty_name || 'pendiente de confirmación')}</p>
            <p>Objeto: {String(contract.object_text || 'pendiente de confirmación')}</p>
            <p>Vigencia: {String(contract.starts_on || '—')} a {String(contract.ends_on || '—')}</p>
            <p>Renovación: {String(contract.renewal)} · preaviso {contract.notice_days == null ? 'pendiente' : `${contract.notice_days} días`}</p>
            <p>Pago: {String(contract.payment_terms || 'pendiente de confirmación')}</p>
            <p>Reajuste: {String(contract.adjustment_terms || 'pendiente de confirmación')}</p>
            <p>Observaciones: {String(contract.notes || 'sin observaciones')}</p>
            {contract.award_id ? <p>Vinculado a la adjudicación {String(contract.award_id)}. Cambiar este monto no cambia el ahorro de la licitación.</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Documentos</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {documents.map(document => (
              <div key={document.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{document.kind} v{document.version} · {document.file_name} · {document.processing}</span>
                <Button size="sm" variant="outline" onClick={() => download(document.storage_path, document.file_name)}>Descargar</Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Input type="file" accept=".pdf,.docx" onChange={event => { const next = event.target.files?.[0]; if (next) uploadMore(next, 'annex') }} />
            </div>
            <p className="text-xs text-muted-foreground">Un archivo nuevo queda como anexo. No reemplaza el original.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Información extraída</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {extractions.length === 0 && <p>No hay datos extraídos. Lo que no está en el documento queda pendiente y no se completa por suposición.</p>}
            {extractions.map(field => (
              <div key={field.id} className="rounded-md border p-2">
                <p>{field.field_key}: {field.confirmed_value || field.proposed_value} · {field.review_status} · confianza {field.confidence} · origen {field.source}</p>
                <p className="text-muted-foreground">“{field.evidence_quote}” · {field.evidence_location}</p>
                {field.review_status === 'pending' && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Input value={correction[field.id] ?? field.proposed_value} onChange={event => setCorrection(prev => ({ ...prev, [field.id]: event.target.value }))} />
                    <Button size="sm" onClick={() => confirmField(field, 'confirmed')}>Confirmar</Button>
                    <Button size="sm" variant="outline" onClick={() => confirmField(field, 'corrected')}>Corregir</Button>
                    <Button size="sm" variant="outline" onClick={() => confirmField(field, 'rejected')}>Rechazar</Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Hallazgos y obligaciones</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Obligaciones y pagos: {findings.filter(item => item.kind === 'obligation' || item.kind === 'payment').map(item => item.corrected_statement || item.statement).join(' ') || 'ninguna cita confirmable todavía.'}</p>
            {findings.length === 0 && <p>No se identificaron cláusulas con una cita verificable.</p>}
            {findings.map(finding => (
              <div key={finding.id} className="rounded-md border p-2">
                <p>{finding.kind}: {finding.corrected_statement || finding.statement}</p>
                <p className="text-muted-foreground">“{finding.evidence_quote}” · {finding.evidence_location} · {finding.review_status}</p>
                {finding.review_status === 'pending' && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Textarea value={correction[finding.id] ?? ''} onChange={event => setCorrection(prev => ({ ...prev, [finding.id]: event.target.value }))} placeholder="Corrección, si hace falta" />
                    <Button size="sm" onClick={() => reviewFinding(finding, 'confirmed')}>Confirmar</Button>
                    <Button size="sm" variant="outline" onClick={() => reviewFinding(finding, 'corrected')}>Corregir</Button>
                    <Button size="sm" variant="outline" onClick={() => reviewFinding(finding, 'rejected')}>Rechazar</Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Buscar en el texto</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Input value={needle} onChange={event => setNeedle(event.target.value)} placeholder="Palabra o frase del documento" />
            {needle && hit < 0 && <p>Esa frase no está en el texto extraído.</p>}
            {hit >= 0 && <p>Encontrada en los caracteres {hit + 1}-{hit + needle.length}: …{snippet}…</p>}
            <p className="text-xs text-muted-foreground">ANA no responde todavía. Esta búsqueda usa el texto guardado y no llama a un modelo.</p>
          </CardContent>
        </Card>
        {versions.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Versiones redactadas</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {versions.map(version => (
                <div key={version.id}>
                  <p>Versión {version.version} · {version.status}</p>
                  <pre className="whitespace-pre-wrap text-xs">{version.body}</pre>
                  {version.status !== 'approved' && contract.award_id && (
                    <Textarea value={variance} onChange={event => setVariance(event.target.value)} placeholder="Si el monto, la moneda o el proveedor ya no coinciden con la adjudicación, explica la diferencia." />
                  )}
                  {version.status !== 'approved' && <Button size="sm" onClick={() => approve(version.id)}>Aprobar versión</Button>}
                </div>
              ))}
              <Button variant="outline" onClick={exportApproved}>Exportar versión aprobada</Button>
              {versions.some(version => version.status === 'approved') && (
                <Button variant="outline" onClick={async () => {
                  const approved = [...versions].reverse().find(version => version.status === 'approved')
                  if (!approved || !session.companyId) return
                  const next = Math.max(...versions.map(version => version.version)) + 1
                  const { error } = await supabaseBrowser().from('contract_versions').insert({
                    contract_id: contractId,
                    company_id: session.companyId,
                    version: next,
                    body: `${approved.body}\n\nEdición posterior. La versión ${approved.version} aprobada no cambia.`,
                    status: 'draft',
                    created_by: session.userId,
                  })
                  if (error) addToast({ type: 'error', title: 'No se creó la versión', message: error.message })
                  else {
                    addToast({ type: 'success', title: 'Nueva versión', message: 'La aprobada sigue igual.' })
                    load()
                  }
                }}>Crear versión siguiente</Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}
