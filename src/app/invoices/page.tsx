'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LoadingSpinner } from '@/components/ui/loading'
import { ErrorMessage } from '@/components/ui/error'
import { useToast } from '@/components/ui/toast'
import { supabaseBrowser } from '@/lib/supabase'
import { formatCurrency, formatDate, generateId } from '@/lib/utils'
import { Plus, Receipt } from 'lucide-react'

type LicOption = { id: string; name: string }
type Invoice = {
  id: string
  licitacion_id: string
  amount: number
  currency: string
  category: string | null
  description: string | null
  invoice_date: string | null
  provider: string | null
  created_at: string | null
}

export default function InvoicesPage() {
  const router = useRouter()
  const { addToast } = useToast()

  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [licitaciones, setLicitaciones] = useState<LicOption[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<any | null>(null)
  const [aiFileName, setAiFileName] = useState<string | null>(null)
  const [aiFile, setAiFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    licitacion_id: '',
    amount: '',
    currency: 'CLP',
    category: '',
    description: '',
    rut: '',
    invoice_date: '',
    provider: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const supabase = supabaseBrowser()
      let { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        await new Promise(r => setTimeout(r, 150))
        ;({ data: { session } } = await supabase.auth.getSession())
      }
      const authUser = session?.user
      if (!authUser) throw new Error('Usuario no autenticado')

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()
      if (profileError || !profile) throw new Error('Perfil no encontrado')

      setUser({
        id: authUser.id,
        name: profile.full_name || authUser.email,
        email: authUser.email,
        role: profile.role
      })

      if (profile.company_id) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profile.company_id)
          .single()
        if (companyData) setCompany(companyData)

        const { data: licData } = await supabase
          .from('licitaciones')
          .select('id, name')
          .eq('company_id', profile.company_id)
          .order('created_at', { ascending: false })
        setLicitaciones((licData || []).map(l => ({ id: l.id, name: l.name })))

        const { data: invData } = await supabase
          .from('service_invoices')
          .select('*')
          .eq('company_id', profile.company_id)
          .order('created_at', { ascending: false })
        setInvoices(invData || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar facturas')
    } finally {
      setLoading(false)
    }
  }

  const ensureSupplierByRut = async (rut: string, providerName: string) => {
    if (!company) throw new Error('Empresa no identificada')
    const supabase = supabaseBrowser()

    // Buscar proveedor por RUT y empresa
    const { data: existing, error: findError } = await supabase
      .from('suppliers')
      .select('id')
      .eq('company_id', company.id)
      .eq('rut', rut)
      .maybeSingle()

    if (findError) throw findError
    if (existing?.id) return existing.id

    // Crear proveedor minimal "pendiente"
    const newSupplier = {
      id: generateId(),
      company_id: company.id,
      rut,
      fantasy_name: providerName || 'Pendiente',
      legal_name: providerName || 'Pendiente',
      service_type: 'Pendiente',
      comments: 'Creado automáticamente desde factura; completar datos pendientes.',
      created_by: user?.id || null,
      is_active: true,
    }

    const { data: inserted, error: insertError } = await supabase
      .from('suppliers')
      .insert(newSupplier)
      .select('id')
      .single()

    if (insertError) throw insertError
    return inserted.id
  }

  const handleSave = async () => {
    if (!company || !form.licitacion_id || !form.amount || !form.rut.trim()) {
      addToast({ type: 'error', title: 'Error', message: 'Selecciona licitación, monto y RUT' })
      return
    }
    if (!form.provider.trim()) {
      addToast({ type: 'error', title: 'Proveedor requerido', message: 'Ingresa el nombre del proveedor' })
      return
    }
    setSaving(true)
    try {
      const supabase = supabaseBrowser()

      // Validar/crear proveedor por RUT
      const supplierId = await ensureSupplierByRut(form.rut.trim(), form.provider.trim())

      const { error } = await supabase
        .from('service_invoices')
        .insert({
          licitacion_id: form.licitacion_id,
          company_id: company.id,
          amount: parseFloat(form.amount),
          currency: form.currency,
          category: form.category || null,
          description: form.description || null,
          invoice_date: form.invoice_date || null,
          provider: form.provider || null,
          created_by: user?.id || null,
          supplier_id: supplierId
        })
      if (error) throw error
      addToast({ type: 'success', title: 'Factura guardada', message: 'Gasto registrado correctamente' })
      setForm({
        licitacion_id: '',
        amount: '',
        currency: 'CLP',
        category: '',
        description: '',
        rut: '',
        invoice_date: '',
        provider: ''
      })
      await loadData()
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err instanceof Error ? err.message : 'No se pudo guardar la factura' })
    } finally {
      setSaving(false)
    }
  }

  const handleAiExtract = async () => {
    if (!aiFile) {
      addToast({ type: 'error', title: 'Archivo requerido', message: 'Adjunta un archivo .docx o .txt' })
      return
    }
    setAiLoading(true)
    setAiResult(null)
    try {
      const fd = new FormData()
      fd.append('file', aiFile)
      const res = await fetch('/api/invoices/ai-extract', {
        method: 'POST',
        body: fd
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo extraer la factura')
      }
      setAiResult(data.data)
      addToast({ type: 'success', title: 'IA lista', message: 'Datos extraídos, revisa y usa en el formulario' })
    } catch (err) {
      addToast({ type: 'error', title: 'Error IA', message: err instanceof Error ? err.message : 'No se pudo procesar el archivo' })
    } finally {
      setAiLoading(false)
    }
  }

  const applyAiResult = () => {
    if (!aiResult) return
    setForm(prev => ({
      ...prev,
      amount: aiResult.amount ? String(aiResult.amount) : prev.amount,
      currency: aiResult.currency || prev.currency,
      category: aiResult.category || prev.category,
      description: aiResult.description || prev.description,
      invoice_date: aiResult.invoice_date || prev.invoice_date,
      provider: aiResult.provider || prev.provider,
    }))
    addToast({ type: 'info', title: 'Aplicado', message: 'Se copiaron los datos de IA al formulario' })
  }

  if (loading) {
    return (
      <MainLayout user={user} companyName={company?.name}>
        <LoadingSpinner />
      </MainLayout>
    )
  }

  if (error) {
    return (
      <MainLayout user={user} companyName={company?.name}>
        <ErrorMessage
          title="Error al cargar facturas"
          message={error}
          onRetry={loadData}
        />
      </MainLayout>
    )
  }

  const total = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0)

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
              Facturas de servicios
            </CardTitle>
            <CardDescription>
              Instrucciones: selecciona la licitación, ingresa el monto y datos básicos. Cada factura queda asociada a una licitación (y, si esa licitación pertenece a una iniciativa, el gasto se reflejará allí). Objetivo: registrar gasto real de servicios. También puedes usar el extractor IA (solo .docx/.txt) para prellenar. Ahora toda factura exige un proveedor por RUT: si no existe, se crea uno “pendiente” automáticamente.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ingreso asistido por IA (beta)</CardTitle>
            <CardDescription>Sube una factura (.docx o .txt) y extraemos monto, proveedor, fecha y concepto. Revisa y aplica al formulario.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Licitación (opcional para prellenar)</label>
                <Select
                  value={form.licitacion_id}
                  onValueChange={(value) => setForm(prev => ({ ...prev, licitacion_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona licitación" />
                  </SelectTrigger>
                  <SelectContent>
                    {licitaciones.map(lic => (
                      <SelectItem key={lic.id} value={lic.id}>
                        {lic.name} ({lic.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Archivo factura (.docx / .txt)</label>
                <Input
                  type="file"
                  accept=".docx,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setAiFile(file)
                    setAiFileName(file ? file.name : null)
                  }}
                />
                {aiFileName && <p className="text-xs text-muted-foreground">Seleccionado: {aiFileName}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleAiExtract} disabled={aiLoading || !aiFile}>
                {aiLoading ? 'Procesando...' : 'Extraer con IA'}
              </Button>
              {aiResult && (
                <Button variant="outline" onClick={applyAiResult}>
                  Usar datos extraídos
                </Button>
              )}
            </div>
            {aiResult && (
              <div className="rounded-lg border p-4 text-sm space-y-2 bg-muted/30">
                <div className="font-semibold">Datos detectados</div>
                <div>Monto: {aiResult.amount || '-'}</div>
                <div>Moneda: {aiResult.currency || '-'}</div>
                <div>Proveedor: {aiResult.provider || '-'}</div>
                <div>Fecha: {aiResult.invoice_date || '-'}</div>
                <div>Categoría: {aiResult.category || '-'}</div>
                <div>Descripción: {aiResult.description || '-'}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registrar factura</CardTitle>
            <CardDescription>Ingresa una factura de servicio para una licitación</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Licitación</label>
                <Select
                  value={form.licitacion_id}
                  onValueChange={(value) => setForm(prev => ({ ...prev, licitacion_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona licitación" />
                  </SelectTrigger>
                  <SelectContent>
                    {licitaciones.map(lic => (
                      <SelectItem key={lic.id} value={lic.id}>
                        {lic.name} ({lic.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Monto</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="1000000"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">RUT proveedor</label>
                <Input
                  value={form.rut}
                  onChange={(e) => setForm(prev => ({ ...prev, rut: e.target.value }))}
                  placeholder="12.345.678-9"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Moneda</label>
                <Input
                  value={form.currency}
                  onChange={(e) => setForm(prev => ({ ...prev, currency: e.target.value }))}
                  placeholder="CLP"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Categoría</label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="Categoría de gasto"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Proveedor</label>
                <Input
                  value={form.provider}
                  onChange={(e) => setForm(prev => ({ ...prev, provider: e.target.value }))}
                  placeholder="Nombre del proveedor"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha factura</label>
                <Input
                  type="date"
                  value={form.invoice_date}
                  onChange={(e) => setForm(prev => ({ ...prev, invoice_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Descripción</label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detalle del gasto"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                <Plus className="mr-2 h-4 w-4" />
                Guardar factura
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Facturas registradas</CardTitle>
            <CardDescription>Total: {formatCurrency(total)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay facturas registradas.</p>
            ) : (
              invoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div className="flex flex-col text-sm">
                    <span className="font-semibold">{formatCurrency(inv.amount, inv.currency)}</span>
                    <span className="text-muted-foreground">
                      Licitación: {inv.licitacion_id}
                      {inv.invoice_date ? ` • ${formatDate(inv.invoice_date)}` : ''}
                    </span>
                    {inv.provider && <span className="text-muted-foreground text-xs">Proveedor: {inv.provider}</span>}
                    {inv.category && <span className="text-muted-foreground text-xs">Categoría: {inv.category}</span>}
                    {inv.description && <span className="text-muted-foreground text-xs">{inv.description}</span>}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}

