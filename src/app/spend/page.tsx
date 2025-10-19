'use client'

import { useState, useEffect } from 'react'
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
  Filter
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabaseBrowser } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/loading'
import { ErrorMessage } from '@/components/ui/error'
import { useToast } from '@/components/ui/toast'
import { useVersion } from '@/contexts/version-context'
import { mockSpendData } from '@/lib/mock-data'

interface SpendData {
  id: string
  amount: number
  category: string
  vendor: string
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
  const { isMockup } = useVersion()
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

  useEffect(() => {
    loadSpendData()
  }, [isMockup])

  const loadSpendData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Si Supabase no está configurado, usar modo mockup
      const isSupabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      if (isMockup || !isSupabaseConfigured) {
        // Use mock data
        setUser({
          name: 'Juan Pérez',
          email: 'juan.perez@empresa.com',
          role: 'admin'
        })
        setCompany({
          id: 'company-1',
          name: 'Perico los Palotes S.A.',
          industry: 'Tecnología'
        })
        
        const spendDataArray = mockSpendData
        setSpendData(spendDataArray)
        
        // Calculate totals
        const total = spendDataArray.reduce((sum, item) => sum + item.amount, 0)
        setTotalSpend(total)
        
        // Calculate monthly spend (current month)
        const currentMonth = new Date().getMonth()
        const currentYear = new Date().getFullYear()
        const monthly = spendDataArray
          .filter(item => {
            const itemDate = new Date(item.date)
            return itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear
          })
          .reduce((sum, item) => sum + item.amount, 0)
        setMonthlySpend(monthly)
        
        // Calculate spend by category
        const categoryMap = new Map<string, { total: number; count: number }>()
        spendDataArray.forEach(item => {
          const existing = categoryMap.get(item.category) || { total: 0, count: 0 }
          categoryMap.set(item.category, {
            total: existing.total + item.amount,
            count: existing.count + 1
          })
        })
        
        const categoryData: SpendCategory[] = Array.from(categoryMap.entries()).map(([category, data]) => ({
          category,
          total: data.total,
          percentage: (data.total / total) * 100,
          count: data.count
        })).sort((a, b) => b.total - a.total)
        
        setSpendByCategory(categoryData)
        
        // Calculate spend by vendor
        const vendorMap = new Map<string, { total: number; count: number }>()
        spendDataArray.forEach(item => {
          const existing = vendorMap.get(item.vendor) || { total: 0, count: 0 }
          vendorMap.set(item.vendor, {
            total: existing.total + item.amount,
            count: existing.count + 1
          })
        })
        
        const vendorData: SpendVendor[] = Array.from(vendorMap.entries()).map(([vendor, data]) => ({
          vendor,
          total: data.total,
          percentage: (data.total / total) * 100,
          count: data.count
        })).sort((a, b) => b.total - a.total)
        
        setSpendByVendor(vendorData)
        setLoading(false)
        return
      }

      // Get current user
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser()
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
        role: profile.role
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

        const spendDataArray = spendDataResult || []
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
        const categoryTotals = spendDataArray.reduce((acc, item) => {
          if (!acc[item.category]) {
            acc[item.category] = { total: 0, count: 0 }
          }
          acc[item.category].total += Number(item.amount)
          acc[item.category].count += 1
          return acc
        }, {} as Record<string, { total: number; count: number }>)

        const categoryArray = Object.entries(categoryTotals)
          .map(([category, data]) => ({
            category,
            total: data.total,
            percentage: total > 0 ? Math.round((data.total / total) * 100) : 0,
            count: data.count
          }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 10)

        setSpendByCategory(categoryArray)

        // Calculate spend by vendor
        const vendorTotals = spendDataArray.reduce((acc, item) => {
          if (!acc[item.vendor]) {
            acc[item.vendor] = { total: 0, count: 0 }
          }
          acc[item.vendor].total += Number(item.amount)
          acc[item.vendor].count += 1
          return acc
        }, {} as Record<string, { total: number; count: number }>)

        const vendorArray = Object.entries(vendorTotals)
          .map(([vendor, data]) => ({
            vendor,
            total: data.total,
            percentage: total > 0 ? Math.round((data.total / total) * 100) : 0,
            count: data.count
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
        message: 'No se pudieron cargar los datos de spend'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // TODO: Implement CSV/XLSX import functionality
    addToast({
      type: 'info',
      title: 'Funcionalidad en desarrollo',
      message: 'La importación de archivos estará disponible próximamente'
    })
  }

  const filteredSpendData = spendData.filter(item =>
    item.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  if (loading) {
    return (
      <MainLayout user={user} companyName={company?.name || 'Spendora'}>
        <LoadingSpinner />
      </MainLayout>
    )
  }

  if (error) {
    return (
      <MainLayout user={user} companyName={company?.name || 'Spendora'}>
        <ErrorMessage
          title="Error al cargar datos de spend"
          message={error}
          onRetry={loadSpendData}
        />
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName={company?.name || 'Spendora'}>
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
              <p className="text-xs text-muted-foreground">
                Registros totales
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categorías</CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{spendByCategory.length}</div>
              <p className="text-xs text-muted-foreground">
                Categorías activas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Proveedores</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{spendByVendor.length}</div>
              <p className="text-xs text-muted-foreground">
                Proveedores únicos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Analysis */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Spend by Category */}
          <Card>
            <CardHeader>
              <CardTitle>Spend por Categoría</CardTitle>
              <CardDescription>
                Distribución del gasto por categorías principales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {spendByCategory.length > 0 ? (
                  spendByCategory.map((item) => (
                    <div key={item.category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.category}</span>
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(item.total)} ({item.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
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
              <CardDescription>
                Top proveedores por volumen de gasto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {spendByVendor.length > 0 ? (
                  spendByVendor.map((item) => (
                    <div key={item.vendor} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.vendor}</span>
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(item.total)} ({item.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
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
                <CardDescription>
                  Últimas transacciones registradas
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Input
                    placeholder="Buscar transacciones..."
                    className="w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
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
                filteredSpendData.slice(0, 10).map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
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
                      <div className="font-semibold">{formatCurrency(item.amount, item.currency)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No hay transacciones</h3>
                  <p className="text-muted-foreground mb-4">
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