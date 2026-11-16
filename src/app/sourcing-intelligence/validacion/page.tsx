'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabaseBrowser } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { formatCurrency } from '@/lib/utils'
import { taxonomyFromRules, type StoredRule } from '@/lib/spend-taxonomy'
import { buildSpendValidation, type ValidationGroup, type ValidationLine } from '@/lib/spend-validation'
import { canReadSpendRole } from '@/lib/spend-privacy'
import { SpendFlowBar } from '@/components/spend/spend-flow-bar'
import { SpendBrainChip } from '@/components/spend/spend-brain-chip'

const REASON: Record<ValidationGroup['reason'], string> = {
  pareto: 'Gasto abierto, sin sugerencia',
  nuevo: 'Hay una sugerencia por el nombre del proveedor',
  subcategoria: 'La subcategoría no está en la taxonomía',
  muestra: 'Muestra de control',
}

export default function ValidationPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null)
  const [companyName, setCompanyName] = useState<string>()
  const [lines, setLines] = useState<ValidationLine[]>([])
  const [rules, setRules] = useState<StoredRule[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [family, setFamily] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [synonym, setSynonym] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const supabase = supabaseBrowser()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }
    const { data: profile } = await supabase.from('profiles').select('full_name, role, company_id, companies(name)').eq('id', session.user.id).single()
    if (!profile?.company_id) {
      setLoading(false)
      return
    }
    const company = Array.isArray(profile.companies) ? profile.companies[0] : profile.companies
    setUser({ name: profile.full_name || session.user.email || '', email: session.user.email || '', role: profile.role })
    setCompanyName(company?.name)
    if (!canReadSpendRole(profile.role)) {
      setLoading(false)
      return
    }

    const collected: ValidationLine[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('si_spend_lines')
        .select('id, amount, amount_net, currency, supplier_name, description, category, subcategory, needs_review, ai_confidence')
        .eq('company_id', profile.company_id)
        .order('id')
        .range(from, from + 999)
      if (error) throw error
      for (const row of data || []) {
        collected.push({
          id: row.id,
          amount: Number(row.amount_net ?? row.amount) || 0,
          currency: row.currency || 'CLP',
          supplier: row.supplier_name || 'Sin proveedor',
          description: row.description || '',
          category: row.category,
          subcategory: row.subcategory,
          needsReview: !!row.needs_review,
          confidence: row.ai_confidence,
        })
      }
      if (!data || data.length < 1000) break
    }
    setLines(collected)

    const response = await fetch('/api/si/taxonomy')
    const body = await response.json()
    setRules(body.rules || [])
    setLoading(false)
  }

  useEffect(() => {
    load().catch(error => {
      setLoading(false)
      addToast({ type: 'error', title: 'No se armó la cola', message: error instanceof Error ? error.message : 'Error' })
    })
  }, [])

  const nodes = useMemo(() => taxonomyFromRules(rules), [rules])
  const knownSuppliers = rules.filter(rule => rule.rule_type === 'supplier').map(rule => rule.pattern)
  const queue = useMemo(() => buildSpendValidation(lines, nodes, knownSuppliers), [lines, nodes, knownSuppliers])
  const families = useMemo(() => Array.from(new Set(nodes.map(node => node.family))), [nodes])
  const active = queue.groups.find(group => group.id === activeId) || null
  const subcategories = nodes.filter(node => node.family === family)

  const open = (group: ValidationGroup) => {
    setActiveId(group.id)
    setFamily(group.family || families[0] || '')
    setSubcategory(group.subcategory || '')
    setSynonym('')
  }

  const applyGroup = async (group: ValidationGroup, chosenFamily: string, chosenSub: string, chosenSynonym: string) => {
    if (!chosenFamily) {
      addToast({ type: 'error', title: 'Falta la familia', message: 'Elige una familia de la taxonomía.' })
      return
    }
    setSaving(true)
    const response = await fetch('/api/si/validate-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        line_ids: group.lineIds,
        currency: group.currency,
        category: chosenFamily,
        subcategory: chosenSub,
        supplier: group.supplier,
        synonym: chosenSynonym,
        samples: group.samples.slice(0, 5),
      }),
    })
    const body = await response.json()
    setSaving(false)
    if (!response.ok) {
      addToast({ type: 'error', title: 'No se guardó el grupo', message: body.error || 'Error' })
      return
    }
    addToast({
      type: 'success',
      title: 'Proveedor validado',
      message: `${group.supplier}: ${body.lines} líneas quedaron en ${chosenFamily}. La regla queda para la próxima carga.`,
    })
    setActiveId(null)
    setLoading(true)
    await load()
  }

  const apply = async (confirmOnly: boolean) => {
    if (!active) return
    if (confirmOnly) {
      setSaving(true)
      const response = await fetch('/api/si/validate-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true, line_ids: active.lineIds, supplier: active.supplier, currency: active.currency }),
      })
      const body = await response.json()
      setSaving(false)
      if (!response.ok) {
        addToast({ type: 'error', title: 'No se guardó', message: body.error || 'Error' })
        return
      }
      setActiveId(null)
      setLoading(true)
      await load()
      return
    }
    await applyGroup(active, family, subcategory, synonym)
  }

  if (loading || !user) {
    return <MainLayout><p className="p-8 text-sm text-petrol-blue/75">Armando la cola de validación…</p></MainLayout>
  }

  if (!canReadSpendRole(user.role)) {
    return (
      <MainLayout user={user} companyName={companyName}>
        <Card>
          <CardContent className="p-5 text-sm">Tu rol no puede ver el gasto de la empresa.</CardContent>
        </Card>
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName={companyName}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1>Validación del gasto</h1>
            <p className="mt-1 max-w-3xl text-[13px] text-petrol-blue/75">
              Cada moneda se mira sola. Aquí están los proveedores que concentran el gasto abierto. Si hay sugerencia, un clic cierra sus líneas y guarda la regla. Si no, eliges la familia.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SpendBrainChip tab="reglas" />
            <Button variant="outline" onClick={() => router.push('/sourcing-intelligence/taxonomia')}>Editar taxonomía</Button>
          </div>
        </div>
        <SpendFlowBar current="revisar" />

        <div className="grid gap-3 md:grid-cols-2">
          {queue.coverage.map(item => (
            <Card key={item.currency}>
              <CardContent className="p-5">
                <p className="text-[12px] font-medium tracking-wide text-petrol-blue/75">{item.currency}</p>
                <p className="mt-2 text-2xl font-medium text-petrol-blue">{Math.round(item.rate * 100)}%</p>
                <p className="text-xs text-petrol-blue/75">
                  del {item.currency} ya tiene categoría. Sigue abierto {formatCurrency(item.open, item.currency)} en {item.openSuppliers} proveedores.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-5 text-sm text-petrol-blue">
            {queue.ready
              ? 'El gasto de cada moneda ya tiene categoría. Se puede armar el plan.'
              : 'Confirma los proveedores de abajo. Cada uno cierra todas sus líneas abiertas y deja la regla para la próxima carga.'}
          </CardContent>
        </Card>

        <div className="space-y-3">
          {queue.groups.length === 0 ? (
            <Card><CardContent className="p-5 text-sm text-petrol-blue/75">No hay grupos en la cola.</CardContent></Card>
          ) : queue.groups.map(group => (
            <Card key={group.id}>
              <CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_220px]">
                <div>
                  <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-petrol-blue/75">{REASON[group.reason]}</p>
                  <p className="mt-1 text-base font-medium text-petrol-blue">{group.supplier}</p>
                  <p className="text-sm text-petrol-blue/70">
                    {formatCurrency(group.amount, group.currency)} · {group.lineCount} líneas abiertas · {Math.round(group.share * 100)}% de {group.currency}
                  </p>
                  {group.family ? (
                    <p className="mt-1 text-xs text-petrol-blue/75">Sugerencia: {group.family}{group.subcategory ? ` · ${group.subcategory}` : ''}</p>
                  ) : null}
                  {group.samples.length ? (
                    <ul className="mt-2 space-y-1">
                      {group.samples.map(sample => (
                        <li key={sample} className="text-xs text-petrol-blue/75">{sample}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-petrol-blue/75">El texto de las líneas es un número de documento. La decisión se toma por el proveedor.</p>
                  )}
                </div>
                {active?.id === group.id ? (
                  <div className="space-y-2">
                    <select className="h-9 w-full rounded-xl border border-white/70 bg-white/70 px-3 text-[13px]" value={family} onChange={event => { setFamily(event.target.value); setSubcategory('') }}>
                      {families.map(item => <option key={item}>{item}</option>)}
                    </select>
                    <select className="h-9 w-full rounded-xl border border-white/70 bg-white/70 px-3 text-[13px]" value={subcategory} onChange={event => setSubcategory(event.target.value)}>
                      <option value="">Subcategoría</option>
                      {subcategories.map(node => <option key={node.name} value={node.name}>{node.name}</option>)}
                    </select>
                    <input className="h-9 w-full rounded-xl border border-white/70 bg-white/70 px-3 text-[13px]" placeholder="Palabra que debe aprender" value={synonym} onChange={event => setSynonym(event.target.value)} />
                    <div className="flex gap-2">
                      <Button disabled={saving} onClick={() => apply(false)}>Validar grupo</Button>
                      {group.reason === 'muestra' ? <Button variant="outline" disabled={saving} onClick={() => apply(true)}>Está bien</Button> : null}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-stretch gap-2 md:items-end">
                    {group.family ? (
                      <Button disabled={saving} onClick={() => applyGroup(group, group.family || '', group.subcategory || '', '')}>
                        Confirmar sugerencia
                      </Button>
                    ) : null}
                    <Button variant="outline" onClick={() => open(group)}>Elegir otra</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  )
}
