'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
import { fetchUnifiedSpendForCompany, describeSpendSource, closeSpendPeriod, totalsByCurrency, primaryCurrency, type SpendSourceInfo, type MoneyTotal } from '@/lib/spend-sources'
import { canReadSpendRole } from '@/lib/spend-privacy'

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
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [spendData, setSpendData] = useState<SpendData[]>([])
  const [spendByCategory, setSpendByCategory] = useState<SpendCategory[]>([])
  const [spendByVendor, setSpendByVendor] = useState<SpendVendor[]>([])
  const [totalSpend, setTotalSpend] = useState<MoneyTotal[]>([])
  const [monthlySpend, setMonthlySpend] = useState<MoneyTotal[]>([])
  const [chartCurrency, setChartCurrency] = useState('CLP')
  const [spendSource, setSpendSource] = useState<SpendSourceInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { addToast } = useToast()

  const exportSpend = () => {
    if (!spendData.length) {
      addToast({ type: 'info', title: 'No hay líneas', message: 'Todavía no hay gasto para exportar.' })
      return
    }
    const header = ['Fecha', 'Categoría', 'Proveedor', 'Monto', 'Moneda']
    const lines = spendData.map(item =>
      [item.date, item.category, item.vendor, item.amount, item.currency]
        .map(value => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(',')
    )
    const blob = new Blob(['\uFEFF' + header.join(',') + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'gasto-xpend.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

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
        id: profile.id,
        name: profile.full_name || authUser.email,
        email: authUser.email,
        role: profile.role,
      })

      if (!canReadSpendRole(profile.role)) {
        setError('Tu rol no puede ver el gasto de la empresa.')
        return
      }

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

        const unified = await fetchUnifiedSpendForCompany(supabase, profile.company_id)
        setSpendSource(await describeSpendSource(supabase, profile.company_id))

        const spendDataArray: SpendData[] = unified.map((item, index) => ({
          id: `u-${index}-${item.date}`,
          amount: item.amount,
          category: item.category,
          vendor: item.supplier,
          date: item.date,
          description: null,
          currency: item.currency,
        })).sort((a, b) => (a.date < b.date ? 1 : -1))
        setSpendData(spendDataArray)

        const totals = totalsByCurrency(spendDataArray)
        setTotalSpend(totals)
        const currentMonth = new Date().toISOString().slice(0, 7)
        setMonthlySpend(totalsByCurrency(spendDataArray.filter(item => item.date.startsWith(currentMonth))))
        const mainCurrency = primaryCurrency(spendDataArray)
        setChartCurrency(mainCurrency)
        const chartRows = spendDataArray.filter(item => item.currency === mainCurrency)
        const chartTotal = chartRows.reduce((sum, item) => sum + Number(item.amount), 0)

        const categoryTotals = chartRows.reduce(
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
            percentage: chartTotal > 0 ? Math.round((data.total / chartTotal) * 100) : 0,
            count: data.count,
          }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 10)

        setSpendByCategory(categoryArray)

        // Calculate spend by vendor
        const vendorTotals = chartRows.reduce(
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
            percentage: chartTotal > 0 ? Math.round((data.total / chartTotal) * 100) : 0,
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
            <h1 className="text-3xl font-bold tracking-tight">Resumen y análisis de gasto</h1>
            <p className="text-muted-foreground">
              {spendSource?.label || 'Análisis y gestión de gastos por categoría y proveedor'}
            </p>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              disabled={closing || !user?.id || !company?.id}
              onClick={async () => {
                if (!user?.id || !company?.id) return
                setClosing(true)
                const result = await closeSpendPeriod(supabase, company.id, user.id)
                setClosing(false)
                addToast(result.mixed
                  ? { type: 'info', title: 'El mes tiene más de una moneda', message: 'Los totales quedan separados. No se guarda un solo número que mezcle pesos y dólares.' }
                  : result.missingTable || result.error
                  ? { type: 'error', title: 'No se guardó el cierre', message: result.missingTable ? 'La base todavía no tiene la tabla de cierres. Los números de esta pantalla sí van por moneda.' : result.error || '' }
                  : { type: 'success', title: 'Período cerrado', message: `${result.period}: ${result.lineCount} líneas.` })
              }}
            >
              {closing ? 'Cerrando…' : 'Cerrar mes'}
            </Button>
            <Button variant="outline" onClick={exportSpend}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
            <Button onClick={() => router.push('/sourcing-intelligence/upload')}>
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
              <div className="space-y-1 text-xl font-bold">
                {(totalSpend.length ? totalSpend : [{ currency: 'CLP', amount: 0 }]).map(item => (
                  <div key={item.currency}>{formatCurrency(item.amount, item.currency)}</div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Este mes:{' '}
                {(monthlySpend.length ? monthlySpend : [{ currency: chartCurrency, amount: 0 }])
                  .map(item => formatCurrency(item.amount, item.currency))
                  .join(' · ')}
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
              <CardDescription>Solo {chartCurrency}. El resto del gasto está en el total, en su moneda.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {spendByCategory.length > 0 ? (
                  spendByCategory.map(item => (
                    <div key={item.category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.category}</span>
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(item.total, chartCurrency)} ({item.percentage}%)
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
              <CardDescription>Top proveedores en {chartCurrency}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {spendByVendor.length > 0 ? (
                  spendByVendor.map(item => (
                    <div key={item.vendor} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.vendor}</span>
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(item.total, chartCurrency)} ({item.percentage}%)
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
                  <Button onClick={() => router.push('/sourcing-intelligence/upload')}>
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
