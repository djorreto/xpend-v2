import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { buildContractDocx, buildContractPdf, contractExportModel } from '@/lib/contract-document'

export const runtime = 'nodejs'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const format = new URL(request.url).searchParams.get('format')
  if (format !== 'docx' && format !== 'pdf') {
    return NextResponse.json({ error: 'El formato debe ser docx o pdf' }, { status: 400 })
  }

  const { data: contract } = await supabase.from('contracts').select('*').eq('id', params.id).maybeSingle()
  if (!contract) return NextResponse.json({ error: 'Contrato no disponible' }, { status: 404 })
  const { data: version } = await supabase
    .from('contract_versions')
    .select('version, body, status')
    .eq('contract_id', contract.id)
    .eq('status', 'approved')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!version) return NextResponse.json({ error: 'No hay una versión aprobada para exportar' }, { status: 409 })

  const model = contractExportModel({
    code: contract.code,
    title: contract.name,
    version: version.version,
    body: version.body,
    buyer: contract.source_snapshot?.buyer || null,
    supplier: contract.counterparty_name || contract.source_snapshot?.supplierName || null,
    supplierRut: contract.source_snapshot?.supplierRut || null,
    currency: contract.currency || contract.source_snapshot?.currency || null,
    amount: contract.amount ?? contract.source_snapshot?.amount ?? null,
    lines: Array.isArray(contract.source_snapshot?.lines) ? contract.source_snapshot.lines : [],
  })
  const filename = `${contract.code}-v${version.version}`
  if (format === 'docx') {
    const buffer = await buildContractDocx(model)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}.docx"`,
      },
    })
  }
  const pdf = buildContractPdf(model)
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}.pdf"`,
    },
  })
}
