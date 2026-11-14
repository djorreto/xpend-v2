'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabaseBrowser } from '@/lib/supabase'
import { BASE_TAXONOMY } from '@/lib/spend-taxonomy'
import { BRAIN, modelInUseLabel } from '@/lib/spend-brain'
import { canReadSpendRole } from '@/lib/spend-privacy'
import { SILearningRule } from '@/types'
import { SpendFlowBar } from '@/components/spend/spend-flow-bar'

type Tab = 'modelo' | 'base' | 'entrenamiento' | 'taxonomia' | 'reglas'

export default function CerebroPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = supabaseBrowser()
  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [rules, setRules] = useState<SILearningRule[]>([])
  const requestedTab = searchParams.get('tab')
  const [tab, setTab] = useState<Tab>(
    requestedTab === 'base' || requestedTab === 'entrenamiento' || requestedTab === 'taxonomia' || requestedTab === 'reglas' || requestedTab === 'modelo'
      ? requestedTab
      : 'modelo'
  )

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (
      requestedTab === 'base' ||
      requestedTab === 'entrenamiento' ||
      requestedTab === 'taxonomia' ||
      requestedTab === 'reglas' ||
      requestedTab === 'modelo'
    ) {
      setTab(requestedTab)
    }
  }, [requestedTab])

  const openTab = (next: Tab) => {
    setTab(next)
    router.replace(`/sourcing-intelligence/cerebro?tab=${next}`)
  }

  const load = async () => {
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
    if (!profile) return
    setUser(profile)
    setCompany(profile.companies)
    if (!canReadSpendRole(profile.role)) return
    const { data } = await supabase
      .from('si_learning_rules')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('updated_at', { ascending: false })
      .limit(80)
    setRules((data || []) as SILearningRule[])
  }

  const families = useMemo(() => {
    const map = new Map<string, typeof BASE_TAXONOMY>()
    for (const node of BASE_TAXONOMY) {
      const list = map.get(node.family) || []
      list.push(node)
      map.set(node.family, list)
    }
    return Array.from(map.entries())
  }, [])

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'modelo', label: 'Modelo que se usa' },
    { id: 'base', label: 'Base actual' },
    { id: 'entrenamiento', label: 'Entrenamiento' },
    { id: 'taxonomia', label: 'Taxonomía' },
    { id: 'reglas', label: 'Reglas de esta empresa' },
  ]

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Cerebro de clasificación</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Aquí se ve qué clasifica el gasto. No es una caja negra: el catálogo, la base y el modelo se pueden abrir.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/sourcing-intelligence/flujo')}>
              Vista del flujo
            </Button>
            <Button variant="outline" onClick={() => router.push('/sourcing-intelligence')}>
              Volver al gasto
            </Button>
          </div>
        </div>

        <SpendFlowBar current="clasificar" />

        <div className="flex flex-wrap gap-2">
          {tabs.map(item => (
            <Button
              key={item.id}
              size="sm"
              variant={tab === item.id ? 'default' : 'outline'}
              onClick={() => openTab(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        {tab === 'modelo' && (
          <Card>
            <CardHeader>
              <CardTitle>Modelo que se usa ahora</CardTitle>
              <CardDescription>{modelInUseLabel()}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p><strong>Estado:</strong> {BRAIN.model.status === 'publicado' ? 'Publicado' : 'Aún no entrenado'}</p>
              <p><strong>Nombre:</strong> {BRAIN.model.name}</p>
              <p><strong>Último entrenamiento:</strong> {BRAIN.model.trained_at || 'ninguno'}</p>
              <p><strong>Acierto en textos no vistos:</strong> {BRAIN.model.held_out_accuracy == null ? 'sin medición' : `${Math.round(BRAIN.model.held_out_accuracy * 100)}%`}</p>
              <p className="text-muted-foreground">{BRAIN.model.note}</p>
              <div className="rounded-md border p-3">
                <p className="font-medium mb-2">Orden al clasificar una línea</p>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Regla de esta empresa (proveedor o palabra clave).</li>
                  <li>Modelo propio, cuando exista y la confianza sea alta.</li>
                  <li>LLM general, solo si un administrador lo autorizó y el texto está limpio.</li>
                  <li>Persona, si la confianza es baja o el texto no alcanza.</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        )}

        {tab === 'base' && (
          <Card>
            <CardHeader>
              <CardTitle>Base de aprendizaje</CardTitle>
              <CardDescription>
                Textos anónimos con la categoría que puso un consultor. Actualizada el {BRAIN.base.updated_at}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                {BRAIN.base.trainable_rows.toLocaleString()} filas entrenables · {BRAIN.base.review_rows.toLocaleString()} en revisión · {BRAIN.base.unmapped.toLocaleString()} sin equivalente Xpend · celdas vacías: {BRAIN.base.empty_cells}
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 font-medium">Industria</th>
                    <th className="py-2 font-medium text-right">Textos</th>
                    <th className="py-2 font-medium">¿Entrena?</th>
                  </tr>
                </thead>
                <tbody>
                  {BRAIN.base.industries.map(item => (
                    <tr key={item.name} className="border-b last:border-0">
                      <td className="py-2">{item.name}</td>
                      <td className="py-2 text-right tabular-nums">{item.rows.toLocaleString()}</td>
                      <td className="py-2">{item.trains ? 'Sí' : item.reason || 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-muted-foreground">
                El archivo vivo está fuera de la app (entrenamiento-optimo.xlsx). Aquí se ve el recuento, no el gasto de un cliente.
              </p>
            </CardContent>
          </Card>
        )}

        {tab === 'entrenamiento' && (
          <Card>
            <CardHeader>
              <CardTitle>Historial de entrenamiento</CardTitle>
              <CardDescription>Cada corrida dice qué se usó y qué quedó afuera.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {BRAIN.trainings.map(run => (
                <div key={run.id} className="rounded-md border p-3 text-sm">
                  <p className="font-medium">{run.title}</p>
                  <p className="text-muted-foreground">{run.at} · {run.rows.toLocaleString()} filas · {run.kind}</p>
                  <p className="mt-1">{run.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {tab === 'taxonomia' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Taxonomía única</CardTitle>
                  <CardDescription>Una lista para todas las empresas. La rama se activa según la industria.</CardDescription>
                </div>
                <Button variant="outline" onClick={() => router.push('/sourcing-intelligence/taxonomia')}>
                  Editar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {families.map(([family, nodes]) => (
                <div key={family}>
                  <p className="font-medium">{family}</p>
                  <ul className="mt-1 text-sm text-muted-foreground space-y-0.5">
                    {nodes.map(node => (
                      <li key={`${node.family}-${node.name}`}>
                        {node.name}
                        {node.branch && node.branch !== 'comun' ? ` · rama ${node.branch}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {tab === 'reglas' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Reglas de {company?.name || 'esta empresa'}</CardTitle>
                  <CardDescription>Valen solo aquí. Un proveedor etiquetado no se comparte con otro cliente.</CardDescription>
                </div>
                <Button variant="outline" onClick={() => router.push('/sourcing-intelligence/learning-rules')}>
                  Abrir lista
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no hay reglas. Aparecen cuando alguien corrige una línea.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 font-medium">Tipo</th>
                      <th className="py-2 font-medium">Patrón</th>
                      <th className="py-2 font-medium">Categoría</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.slice(0, 20).map(rule => (
                      <tr key={rule.id} className="border-b last:border-0">
                        <td className="py-2">{rule.rule_type}</td>
                        <td className="py-2">{rule.pattern}</td>
                        <td className="py-2">{rule.category}{rule.subcategory ? ` › ${rule.subcategory}` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}
