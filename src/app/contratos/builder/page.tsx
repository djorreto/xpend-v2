'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/ui/loading'
import { useToast } from '@/components/ui/toast'
import { supabaseBrowser } from '@/lib/supabase'
import { loadAppSession, type AppSession } from '@/lib/offer-room'
import { errorMessage } from '@/lib/errors'
import { OPTIONAL_CLAUSES, SERVICE_TEMPLATE, renderContract } from '@/lib/contract-extract'

type Template = { id: string; name: string; body: string; status: string }
type Clause = { id: string; title: string; body: string }

export default function BuilderPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const [session, setSession] = useState<AppSession | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [clauses, setClauses] = useState<Clause[]>([])
  const [templateId, setTemplateId] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [vars, setVars] = useState({ contratante: '', contraparte: '', objeto: '', inicio: '', termino: '', moneda: 'USD', monto: '', periodicidad: 'mensual', renovacion: 'manual', preaviso: '60' })
  const [code, setCode] = useState('')
  const [name, setName] = useState('')

  const load = async (companyId: string) => {
    const supabase = supabaseBrowser()
    const [{ data: templateRows }, { data: clauseRows }] = await Promise.all([
      supabase.from('contract_templates').select('id, name, body, status').eq('company_id', companyId),
      supabase.from('contract_clauses').select('id, title, body').eq('company_id', companyId),
    ])
    setTemplates(templateRows || [])
    setClauses(clauseRows || [])
    if (templateRows?.[0]) setTemplateId(templateRows[0].id)
  }

  useEffect(() => {
    loadAppSession().then(appSession => {
      if (!appSession || appSession.role === 'supplier') {
        router.push('/sala')
        return
      }
      setSession(appSession)
      if (appSession.companyId) {
        setVars(prev => ({ ...prev, contratante: appSession.companyName || '' }))
        load(appSession.companyId)
      }
    })
  }, [router])

  const createTemplate = async () => {
    if (!session?.companyId) return
    const { data, error } = await supabaseBrowser().from('contract_templates').insert({
      company_id: session.companyId,
      name: 'Servicio',
      body: SERVICE_TEMPLATE,
      status: 'approved',
      approved_by: session.userId,
      approved_at: new Date().toISOString(),
      created_by: session.userId,
    }).select('id').single()
    if (error || !data) {
      addToast({ type: 'error', title: 'No se creó la plantilla', message: errorMessage(error, 'Error') })
      return
    }
    await supabaseBrowser().from('contract_clauses').insert(OPTIONAL_CLAUSES.map(clause => ({
      company_id: session.companyId,
      template_id: data.id,
      title: clause.title,
      body: clause.body,
      optional: true,
    })))
    addToast({ type: 'success', title: 'Plantilla lista', message: 'Quedó disponible para redactar.' })
    load(session.companyId)
  }

  const draft = async () => {
    if (!session?.companyId || !templateId || !code.trim() || !name.trim()) return
    const template = templates.find(item => item.id === templateId)
    if (!template) return
    const chosen = clauses.filter(clause => selected[clause.id]).map(clause => `${clause.title}. ${clause.body}`)
    const body = renderContract(template.body, vars, chosen)
    const { data: contract, error } = await supabaseBrowser().from('contracts').insert({
      company_id: session.companyId,
      code: code.trim(),
      name: name.trim(),
      contract_type: 'Servicio',
      counterparty_name: vars.contraparte || null,
      origin: 'builder',
      owner_id: session.userId,
      starts_on: vars.inicio || null,
      ends_on: vars.termino || null,
      renewal: vars.renovacion === 'automática' ? 'automatic' : 'manual',
      notice_days: Number(vars.preaviso) || null,
      currency: vars.moneda || null,
      amount: vars.monto ? Number(vars.monto) : null,
      periodicity: vars.periodicidad || null,
      object_text: vars.objeto || null,
      status: 'in_review',
      created_by: session.userId,
    }).select('id').single()
    if (error || !contract) {
      addToast({ type: 'error', title: 'No se creó el borrador', message: errorMessage(error, 'Revisa el código.') })
      return
    }
    const { error: versionError } = await supabaseBrowser().from('contract_versions').insert({
      contract_id: contract.id,
      company_id: session.companyId,
      version: 1,
      body,
      status: 'in_review',
      created_by: session.userId,
    })
    if (versionError) {
      addToast({ type: 'error', title: 'No se guardó la versión', message: versionError.message })
      return
    }
    router.push(`/contratos/${contract.id}`)
  }

  if (!session) return <MainLayout><LoadingSpinner /></MainLayout>
  const template = templates.find(item => item.id === templateId)
  const preview = template ? renderContract(template.body, vars, clauses.filter(clause => selected[clause.id]).map(clause => `${clause.title}. ${clause.body}`)) : ''

  return (
    <MainLayout user={{ name: session.name, email: session.email, role: session.role }} companyName={session.companyName}>
      <div className="space-y-5">
        <h1>Redactar contrato</h1>
        {templates.length === 0 && <Button onClick={createTemplate}>Crear plantilla de servicio</Button>}
        {templates.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Datos</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Input placeholder="Código" value={code} onChange={event => setCode(event.target.value)} />
              <Input placeholder="Nombre" value={name} onChange={event => setName(event.target.value)} />
              <select className="rounded-md border bg-background p-2" value={templateId} onChange={event => setTemplateId(event.target.value)}>
                {templates.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {Object.entries(vars).map(([key, value]) => (
                <Input key={key} placeholder={key} value={value} onChange={event => setVars(prev => ({ ...prev, [key]: event.target.value }))} />
              ))}
              <div className="space-y-1 md:col-span-2">
                {clauses.map(clause => (
                  <label key={clause.id} className="block text-sm">
                    <input type="checkbox" checked={Boolean(selected[clause.id])} onChange={event => setSelected(prev => ({ ...prev, [clause.id]: event.target.checked }))} /> {clause.title}
                  </label>
                ))}
              </div>
              <Button onClick={draft}>Crear borrador</Button>
            </CardContent>
          </Card>
        )}
        {preview && <pre className="whitespace-pre-wrap rounded-lg border p-3 text-sm">{preview}</pre>}
      </div>
    </MainLayout>
  )
}
