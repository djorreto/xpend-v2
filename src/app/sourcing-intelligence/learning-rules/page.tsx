'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { supabaseBrowser } from '@/lib/supabase'
import { Brain, Trash2, Filter, TrendingUp, Search } from 'lucide-react'
import { SILearningRule } from '@/types'

export default function LearningRulesPage() {
  const router = useRouter()
  const supabase = supabaseBrowser()

  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [rules, setRules] = useState<SILearningRule[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'keyword' | 'supplier' | 'correction'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadData()
  }, [])

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

        // Cargar reglas
        const { data: rulesData } = await supabase
          .from('si_learning_rules')
          .select('*')
          .eq('company_id', profile.company_id)
          .order('success_rate', { ascending: false })
          .order('usage_count', { ascending: false })

        if (rulesData) {
          setRules(rulesData)
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta regla?')) return

    try {
      const { error } = await supabase
        .from('si_learning_rules')
        .delete()
        .eq('id', ruleId)

      if (error) throw error

      setRules(rules.filter(r => r.id !== ruleId))
      alert('✅ Regla eliminada exitosamente')
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`)
    }
  }

  const filteredRules = rules.filter(rule => {
    // Filtro por tipo
    if (filter !== 'all' && rule.rule_type !== filter) return false

    // Filtro por búsqueda
    if (search) {
      const searchLower = search.toLowerCase()
      return (
        rule.pattern.toLowerCase().includes(searchLower) ||
        rule.category.toLowerCase().includes(searchLower)
      )
    }

    return true
  })

  const getRuleTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      keyword: 'bg-blue-500',
      supplier: 'bg-green-500',
      correction: 'bg-purple-500',
      pattern: 'bg-yellow-500'
    }
    const labels: Record<string, string> = {
      keyword: 'Keyword',
      supplier: 'Proveedor',
      correction: 'Corrección',
      pattern: 'Patrón'
    }
    return <Badge className={colors[type]}>{labels[type]}</Badge>
  }

  const getSourceBadge = (source: string) => {
    const colors: Record<string, string> = {
      user_correction: 'bg-indigo-500',
      ai_generated: 'bg-cyan-500',
      manual: 'bg-gray-500'
    }
    const labels: Record<string, string> = {
      user_correction: 'Usuario',
      ai_generated: 'IA',
      manual: 'Manual'
    }
    return <Badge variant="outline" className={colors[source]}>{labels[source]}</Badge>
  }

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
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-3">
            <Brain className="h-8 w-8" style={{ color: '#2AD4D2' }} />
            <span>Reglas de Aprendizaje</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            Gestiona las reglas que el sistema ha aprendido para mejorar la clasificación
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Reglas</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rules.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Por Keyword</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {rules.filter(r => r.rule_type === 'keyword').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Por Proveedor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {rules.filter(r => r.rule_type === 'supplier').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasa Éxito Promedio</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {rules.length > 0
                  ? ((rules.reduce((sum, r) => sum + r.success_rate, 0) / rules.length) * 100).toFixed(0)
                  : 0}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Reglas Activas</CardTitle>
                <CardDescription>
                  {filteredRules.length} de {rules.length} reglas
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 w-64"
                  />
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
                    variant={filter === 'keyword' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('keyword')}
                  >
                    Keywords
                  </Button>
                  <Button
                    variant={filter === 'supplier' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('supplier')}
                  >
                    Proveedores
                  </Button>
                  <Button
                    variant={filter === 'correction' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('correction')}
                  >
                    Correcciones
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredRules.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No hay reglas que mostrar
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          {getRuleTypeBadge(rule.rule_type)}
                          {rule.source && getSourceBadge(rule.source)}
                          <Badge variant="outline">
                            Boost: +{(rule.confidence_boost * 100).toFixed(0)}%
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium">
                            Patrón: <span className="text-muted-foreground">"{rule.pattern}"</span>
                          </p>
                          <p className="text-sm">
                            Categoría: <Badge variant="outline">{rule.category}</Badge>
                            {rule.subcategory && (
                              <> → <Badge variant="outline">{rule.subcategory}</Badge></>
                            )}
                          </p>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <span>Usos: {rule.usage_count}</span>
                            <span>•</span>
                            <span>Éxito: {(rule.success_rate * 100).toFixed(0)}%</span>
                            <span>•</span>
                            <span>
                              Creada: {new Date(rule.created_at).toLocaleDateString('es-CL')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}

