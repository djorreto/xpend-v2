'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabaseBrowser } from '@/lib/supabase'
import { useToast } from '@/components/ui/toast'
import { taxonomyFromRules, type StoredRule } from '@/lib/spend-taxonomy'
import { SpendFlowBar } from '@/components/spend/spend-flow-bar'
import { SpendBrainChip } from '@/components/spend/spend-brain-chip'

export default function TaxonomyPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null)
  const [companyName, setCompanyName] = useState<string>()
  const [rules, setRules] = useState<StoredRule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [family, setFamily] = useState('Tecnología')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [synonym, setSynonym] = useState('')

  const load = async () => {
    const supabase = supabaseBrowser()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }
    const { data: profile } = await supabase.from('profiles').select('full_name, role, companies(name)').eq('id', session.user.id).single()
    if (profile) {
      const company = Array.isArray(profile.companies) ? profile.companies[0] : profile.companies
      setUser({ name: profile.full_name || session.user.email || '', email: session.user.email || '', role: profile.role })
      setCompanyName(company?.name)
    }
    const response = await fetch('/api/si/taxonomy')
    const body = await response.json()
    if (!response.ok) {
      addToast({ type: 'error', title: 'No se cargó la taxonomía', message: body.error || 'Error' })
    } else {
      setRules(body.rules || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const nodes = useMemo(() => taxonomyFromRules(rules), [rules])
  const families = useMemo(() => Array.from(new Set(nodes.map(node => node.family))), [nodes])
  const branchLabels: Record<string, string> = {
    comun: 'Todas las industrias',
    salud: 'Salud',
    agro: 'Agro',
    mineria: 'Minería',
    construccion: 'Construcción',
    retail: 'Retail',
    financiera: 'Banca',
  }
  const byBranch = useMemo(() => {
    const map = new Map<string, number>()
    for (const node of nodes) {
      const branch = node.branch || 'comun'
      map.set(branch, (map.get(branch) || 0) + 1)
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [nodes])
  const synonymCount = nodes.reduce((sum, node) => sum + node.synonyms.length, 0)

  const save = async (op: 'node' | 'synonym') => {
    setSaving(true)
    const response = await fetch('/api/si/taxonomy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op, family, name, code, synonym }),
    })
    const body = await response.json()
    setSaving(false)
    if (!response.ok) {
      addToast({ type: 'error', title: 'No se guardó', message: body.error || 'Error' })
      return
    }
    setName('')
    setCode('')
    setSynonym('')
    addToast({ type: 'success', title: 'Taxonomía actualizada', message: 'La próxima clasificación ya usa este dato.' })
    load()
  }

  const remove = async (id?: string) => {
    if (!id) return
    await fetch('/api/si/taxonomy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'delete', id }),
    })
    load()
  }

  if (loading || !user) {
    return <MainLayout><p className="p-8 text-sm text-petrol-blue/75">Cargando taxonomía…</p></MainLayout>
  }

  return (
    <MainLayout user={user} companyName={companyName}>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1>Taxonomía de gasto</h1>
            <p className="mt-1 max-w-3xl text-[13px] text-petrol-blue/75">
              El modelo clasifica solo dentro de esta lista. Agrega la subcategoría, un sinónimo o el código de tu ERP o de UNSPSC.
              Cuando corriges una línea, el proveedor también queda como regla.
            </p>
          </div>
          <SpendBrainChip tab="taxonomia" />
        </div>
        <SpendFlowBar current="clasificar" />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Familias', families.length],
            ['Subcategorías', nodes.length],
            ['Ramas', byBranch.length],
            ['Sinónimos', synonymCount],
          ].map(([label, value]) => (
            <Card key={label}>
              <CardContent className="p-4">
                <p className="text-[12px] text-petrol-blue/75">{label}</p>
                <p className="mt-1 text-2xl font-medium text-petrol-blue">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-medium text-petrol-blue">Mix por rama</p>
            <p className="mt-1 text-[13px] text-petrol-blue/75">La rama común vale para cualquier empresa. Las otras se activan según la industria.</p>
            <div className="mt-3 divide-y">
              {byBranch.map(([branch, count]) => (
                <div key={branch} className="flex items-center justify-between py-2 text-[13px]">
                  <span className="text-petrol-blue">{branchLabels[branch] || branch}</span>
                  <span className="tabular-nums text-petrol-blue/75">{count} subcategorías</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-3 p-5 md:grid-cols-4">
            <select
              className="h-9 rounded-xl border border-white/70 bg-white/70 px-3 text-[13px]"
              value={family}
              onChange={event => setFamily(event.target.value)}
            >
              {families.map(item => <option key={item}>{item}</option>)}
              <option value="">Nueva familia…</option>
            </select>
            <Input placeholder="Familia, si es nueva" value={family} onChange={event => setFamily(event.target.value)} />
            <Input placeholder="Subcategoría" value={name} onChange={event => setName(event.target.value)} />
            <Input placeholder="Código ERP o UNSPSC" value={code} onChange={event => setCode(event.target.value)} />
            <Input className="md:col-span-2" placeholder="Sinónimo o palabra del texto de la factura" value={synonym} onChange={event => setSynonym(event.target.value)} />
            <Button disabled={saving} onClick={() => save('node')}>Agregar subcategoría</Button>
            <Button variant="outline" disabled={saving} onClick={() => save('synonym')}>Agregar sinónimo</Button>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-2">
          {families.map(item => (
            <Card key={item}>
              <CardContent className="p-5">
                <p className="text-sm font-medium text-petrol-blue">{item}</p>
                <ul className="mt-3 space-y-2">
                  {nodes.filter(node => node.family === item).map(node => {
                    const own = rules.find(rule =>
                      rule.rule_type === 'taxonomy' &&
                      rule.source === 'manual' &&
                      rule.category === node.family &&
                      rule.subcategory === node.name
                    )
                    return (
                      <li key={`${node.family}-${node.name}`} className="text-[13px] text-petrol-blue/75">
                        <span className="font-medium text-petrol-blue">{node.name}</span>
                        {node.code ? <span className="ml-2 text-petrol-blue/75">{node.code}</span> : null}
                        {node.synonyms.length ? <span className="mt-0.5 block text-xs text-petrol-blue/75">{node.synonyms.join(' · ')}</span> : null}
                        {own?.id ? (
                          <button type="button" className="mt-1 block text-xs text-red-600" onClick={() => remove(own.id)}>Quitar</button>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  )
}
