import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createHash } from 'crypto'
import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'
import { extractContractSignals } from '@/lib/contract-extract'
import { contractFilePath } from '@/lib/storage-paths'

export const runtime = 'nodejs'

async function readText(fileName: string, buffer: Buffer) {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer })
    return { text: result.value || '', format: 'docx' as const }
  }
  if (lower.endsWith('.pdf')) {
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    const pages = (result.pages || []).map(page => `Página ${page.num}\n${page.text}`).join('\n')
    return { text: pages || result.text || '', format: 'pdf' as const }
  }
  return { text: '', format: 'other' as const }
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('company_id, role').eq('id', session.user.id).single()
  if (!profile?.company_id || !['admin', 'manager', 'analyst'].includes(profile.role)) {
    return NextResponse.json({ error: 'No puedes cargar contratos de esta empresa' }, { status: 403 })
  }

  const form = await request.formData()
  const file = form.get('file')
  const contractId = String(form.get('contractId') || '')
  const kind = String(form.get('kind') || 'original')
  if (!(file instanceof File) || !contractId) {
    return NextResponse.json({ error: 'Falta el archivo o el contrato' }, { status: 400 })
  }
  if (!['original', 'annex', 'amendment', 'renewal'].includes(kind)) {
    return NextResponse.json({ error: 'El tipo de documento no es válido' }, { status: 400 })
  }

  const { data: contract } = await supabase.from('contracts').select('id, company_id').eq('id', contractId).single()
  if (!contract || contract.company_id !== profile.company_id) {
    return NextResponse.json({ error: 'El contrato no es de tu empresa' }, { status: 404 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const { count } = await supabase.from('contract_documents').select('id', { count: 'exact', head: true }).eq('contract_id', contractId).eq('kind', kind)
  const version = (count || 0) + 1
  const path = contractFilePath(profile.company_id, contractId, file.name)
  const uploaded = await supabase.storage.from('documents').upload(path, buffer, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (uploaded.error) return NextResponse.json({ error: uploaded.error.message }, { status: 400 })

  let extracted = ''
  let processing: 'processed' | 'unprocessable' = 'unprocessable'
  try {
    const read = await readText(file.name, buffer)
    extracted = read.text.trim()
    processing = extracted.length >= 40 ? 'processed' : 'unprocessable'
  } catch {
    processing = 'unprocessable'
  }

  const { data: document, error } = await supabase.from('contract_documents').insert({
    contract_id: contractId,
    company_id: profile.company_id,
    kind,
    version,
    file_name: file.name,
    storage_path: path,
    mime: file.type,
    size_bytes: buffer.length,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    processing,
    extracted_text: extracted || null,
    uploaded_by: session.user.id,
  }).select('id').single()
  if (error || !document) return NextResponse.json({ error: error?.message || 'No se guardó el documento' }, { status: 400 })

  if (processing === 'processed') {
    const signals = extractContractSignals(extracted)
    if (signals.fields.length) {
      await supabase.from('contract_extractions').insert(signals.fields.map(field => ({
        contract_id: contractId,
        document_id: document.id,
        field_key: field.fieldKey,
        proposed_value: field.value,
        source: 'extracted',
        confidence: field.confidence,
        evidence_quote: field.quote,
        evidence_location: field.location,
      })))
    }
    if (signals.findings.length) {
      await supabase.from('contract_findings').insert(signals.findings.map(finding => ({
        contract_id: contractId,
        document_id: document.id,
        kind: finding.kind,
        statement: finding.statement,
        evidence_quote: finding.quote,
        evidence_location: finding.location,
        confidence: finding.confidence,
      })))
    }
  }

  return NextResponse.json({ documentId: document.id, processing, extracted: processing === 'processed' })
}
