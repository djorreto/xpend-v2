'use client'

import { useState, useEffect, useCallback } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Upload,
  Download,
  TrendingUp,
  DollarSign,
  PieChart,
  BarChart3,
  FileSpreadsheet,
  Calendar,
  Filter,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabaseBrowser } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/loading'
import { ErrorMessage } from '@/components/ui/error'
import { useToast } from '@/components/ui/toast'

interface SpendData {
  id: string
  amount: number
  category: string | null
  vendor: string | null
  date: string
  description: string | null
  currency: string
}

interface SpendCategory {
  category: string
  total: number
  percentage: number
  count: number
}

interface SpendVendor {
  vendor: string
  total: number
  percentage: number
  count: number
}

export default function SpendPage() {
  const supabase = supabaseBrowser()
  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [spendData, setSpendData] = useState<SpendData[]>([])
  const [spendByCategory, setSpendByCategory] = useState<SpendCategory[]>([])
  const [spendByVendor, setSpendByVendor] = useState<SpendVendor[]>([])
  const [totalSpend, setTotalSpend] = useState(0)
  const [monthlySpend, setMonthlySpend] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const { addToast } = useToast()

  const loadSpendData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Get current user
      const {
        data: { user: authUser },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !authUser) {
        throw new Error('Usuario no autenticado')
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (profileError || !profile) {
        throw new Error('Perfil no encontrado')
      }

      setUser({
        name: profile.full_name || authUser.email,
        email: authUser.email,
        role: profile.role,
      })

      // Get company info
      if (profile.company_id) {
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profile.company_id)
          .single()

        if (!companyError && companyData) {
          setCompany(companyData)
        }

        // Load spend data
        const { data: spendDataResult, error: spendError } = await supabase
          .from('spend_data')
          .select('*')
          .eq('company_id', profile.company_id)
          .order('date', { ascending: false })

        if (spendError) throw spendError

        const spendDataArray: SpendData[] = (spendDataResult || []).map((item: any) => ({
          ...item,
          vendor: item.vendor || item.supplier_name || 'Sin proveedor',
          category: item.category || 'Sin categoría',
        }))
        setSpendData(spendDataArray)

        // Calculate totals
        const total = spendDataArray.reduce((sum, item) => sum + Number(item.amount), 0)
        setTotalSpend(total)

        // Calculate monthly spend
        const currentMonth = new Date().toISOString().slice(0, 7)
        const monthly = spendDataArray
          .filter(item => item.date.startsWith(currentMonth))
          .reduce((sum, item) => sum + Number(item.amount), 0)
        setMonthlySpend(monthly)

        // Calculate spend by category
        const categoryTotals = spendDataArray.reduce(
          (acc, item) => {
            const category = item.category || 'Sin categoría'
            if (!acc[category]) {
              acc[category] = { total: 0, count: 0 }
            }
            acc[category].total += Number(item.amount)
            acc[category].count += 1
            return acc
          },
          {} as Record<string, { total: number; count: number }>
        )

        const categoryArray = (
          Object.entries(categoryTotals) as Array<[string, { total: number; count: number }]>
        )
          .map(([category, data]) => ({
            category,
            total: data.total,
            percentage: total > 0 ? Math.round((data.total / total) * 100) : 0,
            count: data.count,
          }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 10)

        setSpendByCategory(categoryArray)

        // Calculate spend by vendor
        const vendorTotals = spendDataArray.reduce(
          (acc, item) => {
            const vendor = item.vendor || 'Sin proveedor'
            if (!acc[vendor]) {
              acc[vendor] = { total: 0, count: 0 }
            }
            acc[vendor].total += Number(item.amount)
            acc[vendor].count += 1
            return acc
          },
          {} as Record<string, { total: number; count: number }>
        )

        const vendorArray = (
          Object.entries(vendorTotals) as Array<[string, { total: number; count: number }]>
        )
          .map(([vendor, data]) => ({
            vendor,
            total: data.total,
            percentage: total > 0 ? Math.round((data.total / total) * 100) : 0,
            count: data.count,
          }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 10)

        setSpendByVendor(vendorArray)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos de spend')
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudieron cargar los datos de spend',
      })
    } finally {
      setLoading(false)
    }
  }, [addToast, supabase])

  useEffect(() => {
    loadSpendData()
  }, [loadSpendData])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // TODO: Implement CSV/XLSX import functionality
    addToast({
      type: 'info',
      title: 'Funcionalidad en desarrollo',
      message: 'La importación de archivos estará disponible próximamente',
    })
  }

  const filteredSpendData = spendData.filter(item => {
    const vendor = item.vendor?.toLowerCase() || ''
    const category = item.category?.toLowerCase() || ''
    const description = item.description?.toLowerCase() || ''
    const query = searchQuery.toLowerCase()

    return vendor.includes(query) || category.includes(query) || description.includes(query)
  })

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
          title="Error al cargar datos de spend"
          message={error}
          onRetry={loadSpendData}
        />
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Spend Analysis</h1>
            <p className="text-muted-foreground">
              Análisis y gestión de gastos por categoría y proveedor
            </p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Importar
            </Button>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Spend Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalSpend)}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(monthlySpend)} este mes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transacciones</CardTitle>
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{spendData.length}</div>
              <p className="text-xs text-muted-foreground">Registros totales</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categorías</CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{spendByCategory.length}</div>
              <p className="text-xs text-muted-foreground">Categorías activas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Proveedores</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{spendByVendor.length}</div>
              <p className="text-xs text-muted-foreground">Proveedores únicos</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Analysis */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Spend by Category */}
          <Card>
            <CardHeader>
              <CardTitle>Spend por Categoría</CardTitle>
              <CardDescription>Distribución del gasto por categorías principales</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {spendByCategory.length > 0 ? (
                  spendByCategory.map(item => (
                    <div key={item.category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.category}</span>
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(item.total)} ({item.percentage}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-secondary">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No hay datos de gastos disponibles
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Spend by Vendor */}
          <Card>
            <CardHeader>
              <CardTitle>Spend por Proveedor</CardTitle>
              <CardDescription>Top proveedores por volumen de gasto</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {spendByVendor.length > 0 ? (
                  spendByVendor.map(item => (
                    <div key={item.vendor} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.vendor}</span>
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(item.total)} ({item.percentage}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-secondary">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No hay datos de proveedores disponibles
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Transacciones Recientes</CardTitle>
                <CardDescription>Últimas transacciones registradas</CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Input
                    placeholder="Buscar transacciones..."
                    className="w-64"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredSpendData.length > 0 ? (
                filteredSpendData.slice(0, 10).map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{item.vendor}</span>
                        <span className="text-sm text-muted-foreground">•</span>
                        <span className="text-sm text-muted-foreground">{item.category}</span>
                      </div>
                      {item.description && (
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      )}
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        <span className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(item.date).toLocaleDateString('es-ES')}</span>
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {formatCurrency(item.amount, item.currency)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center">
                  <FileSpreadsheet className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="mb-2 text-lg font-semibold">No hay transacciones</h3>
                  <p className="mb-4 text-muted-foreground">
                    Importa datos de gastos para comenzar el análisis
                  </p>
                  <Button>
                    <Upload className="mr-2 h-4 w-4" />
                    Importar Datos
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
