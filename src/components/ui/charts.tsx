'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

// Colores para los gráficos
const COLORS = {
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
  purple: '#8b5cf6',
  pink: '#ec4899',
  indigo: '#6366f1',
  teal: '#14b8a6'
}

const CHART_COLORS = [
  COLORS.primary,
  COLORS.secondary,
  COLORS.success,
  COLORS.warning,
  COLORS.danger,
  COLORS.info,
  COLORS.purple,
  COLORS.pink,
  COLORS.indigo,
  COLORS.teal
]

// Gráfico de barras para gastos por categoría
interface SpendByCategoryChartProps {
  data: Array<{
    category: string
    amount: number
    percentage: number
  }>
  title?: string
  description?: string
}

export function SpendByCategoryChart({ data, title = "Gastos por Categoría", description }: SpendByCategoryChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="category" 
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={(value: number) => [formatCurrency(value), 'Gasto']}
                labelStyle={{ color: '#374151' }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Bar 
                dataKey="amount" 
                fill={COLORS.primary}
                radius={[4, 4, 0, 0]}
                stroke={COLORS.primary}
                strokeWidth={1}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// Gráfico de dona para distribución de gastos
interface SpendDistributionChartProps {
  data: Array<{
    category: string
    amount: number
    percentage: number
  }>
  title?: string
  description?: string
}

export function SpendDistributionChart({ data, title = "Distribución de Gastos", description }: SpendDistributionChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                paddingAngle={2}
                dataKey="amount"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [formatCurrency(value), 'Gasto']}
                labelStyle={{ color: '#374151' }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Leyenda */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {data.map((item, index) => (
            <div key={item.category} className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
              />
              <span className="text-sm text-muted-foreground truncate">
                {item.category}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Gráfico de líneas para tendencia de gastos mensuales
interface MonthlyTrendChartProps {
  data: Array<{
    month: string
    gastos: number
    ahorros: number
    proyectos: number
  }>
  title?: string
  description?: string
}

export function MonthlyTrendChart({ data, title = "Tendencia Mensual", description }: MonthlyTrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  formatCurrency(value), 
                  name === 'gastos' ? 'Gastos' : name === 'ahorros' ? 'Ahorros' : 'Proyectos'
                ]}
                labelStyle={{ color: '#374151' }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="gastos" 
                stroke={COLORS.danger} 
                strokeWidth={3}
                dot={{ fill: COLORS.danger, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: COLORS.danger, strokeWidth: 2 }}
              />
              <Line 
                type="monotone" 
                dataKey="ahorros" 
                stroke={COLORS.success} 
                strokeWidth={3}
                dot={{ fill: COLORS.success, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: COLORS.success, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// Gráfico de área para evolución de proyectos
interface ProjectEvolutionChartProps {
  data: Array<{
    month: string
    activos: number
    completados: number
    enPausa: number
  }>
  title?: string
  description?: string
}

export function ProjectEvolutionChart({ data, title = "Evolución de Proyectos", description }: ProjectEvolutionChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  value, 
                  name === 'activos' ? 'Activos' : name === 'completados' ? 'Completados' : 'En Pausa'
                ]}
                labelStyle={{ color: '#374151' }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="activos" 
                stackId="1" 
                stroke={COLORS.primary} 
                fill={COLORS.primary}
                fillOpacity={0.6}
              />
              <Area 
                type="monotone" 
                dataKey="completados" 
                stackId="1" 
                stroke={COLORS.success} 
                fill={COLORS.success}
                fillOpacity={0.6}
              />
              <Area 
                type="monotone" 
                dataKey="enPausa" 
                stackId="1" 
                stroke={COLORS.warning} 
                fill={COLORS.warning}
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// Gráfico de barras horizontales para ahorros por proyecto
interface SavingsByProjectChartProps {
  data: Array<{
    project: string
    ahorro: number
    presupuesto: number
  }>
  title?: string
  description?: string
}

export function SavingsByProjectChart({ data, title = "Ahorros por Proyecto", description }: SavingsByProjectChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-80 w-full flex items-center justify-center">
            <p className="text-muted-foreground">No hay datos de ahorros disponibles</p>
          </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={data} 
                layout="horizontal"
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                type="number"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <YAxis 
                type="category"
                dataKey="project" 
                tick={{ fontSize: 12 }}
                width={100}
              />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  formatCurrency(value), 
                  name === 'ahorro' ? 'Ahorro' : 'Presupuesto'
                ]}
                labelStyle={{ color: '#374151' }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Bar 
                dataKey="presupuesto" 
                fill={COLORS.info}
                radius={[0, 4, 4, 0]}
                opacity={0.3}
              />
              <Bar 
                dataKey="ahorro" 
                fill={COLORS.success}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}
      </CardContent>
    </Card>
  )
}
