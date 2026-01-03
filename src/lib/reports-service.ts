import { supabaseBrowser } from './supabase'
import { StorageService } from './storage'

export interface ReportParameters {
  dateFrom?: string
  dateTo?: string
  categories?: string[]
  vendors?: string[]
  projects?: string[]
  includeCharts?: boolean
  format?: 'pdf' | 'excel' | 'csv'
}

export interface ReportData {
  summary: any
  details: any[]
  charts?: any[]
  metadata: {
    generatedAt: string
    generatedBy: string
    parameters: ReportParameters
  }
}

export class ReportsService {
  // Generar reporte de análisis de gastos
  static async generateSpendAnalysisReport(
    companyId: string,
    userId: string,
    parameters: ReportParameters = {}
  ): Promise<ReportData> {
    const supabase = supabaseBrowser()

    // Obtener datos de gastos
    const { data: spendData, error } = await supabase
      .from('spend_data')
      .select('*')
      .eq('company_id', companyId)
      .gte('date', parameters.dateFrom || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
      .lte('date', parameters.dateTo || new Date().toISOString())

    if (error) throw error

    // Filtrar por categorías si se especifican
    let filteredData = spendData || []
    if (parameters.categories?.length) {
      filteredData = filteredData.filter(item =>
        parameters.categories!.includes(item.category)
      )
    }

    // Filtrar por proveedores si se especifican
    if (parameters.vendors?.length) {
      filteredData = filteredData.filter(item =>
        parameters.vendors!.includes(item.vendor)
      )
    }

    // Calcular resumen
    const totalSpend = filteredData.reduce((sum, item) => sum + Number(item.amount), 0)
    const categoryTotals = filteredData.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + Number(item.amount)
      return acc
    }, {} as Record<string, number>)

    const vendorTotals = filteredData.reduce((acc, item) => {
      acc[item.vendor] = (acc[item.vendor] || 0) + Number(item.amount)
      return acc
    }, {} as Record<string, number>)

    // Generar datos para gráficos
    const charts = parameters.includeCharts ? [
      {
        type: 'pie',
        title: 'Distribución por Categoría',
        data: (Object.entries(categoryTotals) as Array<[string, number]>).map(([category, amount]) => ({
          name: category,
          value: amount,
          percentage: totalSpend > 0 ? Math.round((amount / totalSpend) * 100) : 0
        }))
      },
      {
        type: 'bar',
        title: 'Top 10 Proveedores',
        data: (Object.entries(vendorTotals) as Array<[string, number]>)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .map(([vendor, amount]) => ({
            name: vendor,
            value: amount
          }))
      }
    ] : undefined

    return {
      summary: {
        totalSpend,
        transactionCount: filteredData.length,
        categoryCount: Object.keys(categoryTotals).length,
        vendorCount: Object.keys(vendorTotals).length,
        averageTransaction: filteredData.length > 0 ? totalSpend / filteredData.length : 0
      },
      details: filteredData,
      charts,
      metadata: {
        generatedAt: new Date().toISOString(),
        generatedBy: userId,
        parameters
      }
    }
  }

  // Generar reporte de estado de proyectos
  static async generateProjectStatusReport(
    companyId: string,
    userId: string,
    parameters: ReportParameters = {}
  ): Promise<ReportData> {
    const supabase = supabaseBrowser()

    // Obtener proyectos
    const { data: projects, error } = await supabase
      .from('projects')
      .select(`
        *,
        project_milestones(*)
      `)
      .eq('company_id', companyId)

    if (error) throw error

    let filteredProjects = projects || []
    if (parameters.projects?.length) {
      filteredProjects = filteredProjects.filter(project =>
        parameters.projects!.includes(project.id)
      )
    }

    // Calcular métricas
    const statusCounts = filteredProjects.reduce((acc, project) => {
      acc[project.status] = (acc[project.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const totalBudget = filteredProjects.reduce((sum, project) =>
      sum + (project.budget || 0), 0
    )

    const activeProjects = filteredProjects.filter(p => p.status === 'active').length
    const completedProjects = filteredProjects.filter(p => p.status === 'completed').length

    // Obtener hitos próximos
    const upcomingMilestones = filteredProjects
      .flatMap(project =>
        project.project_milestones?.map((milestone: any) => ({
          ...milestone,
          project_name: project.name
        })) || []
      )
      .filter(milestone =>
        !milestone.completed &&
        new Date(milestone.due_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      )
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      .slice(0, 10)

    return {
      summary: {
        totalProjects: filteredProjects.length,
        activeProjects,
        completedProjects,
        totalBudget,
        averageBudget: filteredProjects.length > 0 ? totalBudget / filteredProjects.length : 0,
        completionRate: filteredProjects.length > 0 ? (completedProjects / filteredProjects.length) * 100 : 0
      },
      details: filteredProjects,
      charts: parameters.includeCharts ? [
        {
          type: 'pie',
          title: 'Distribución por Estado',
          data: Object.entries(statusCounts).map(([status, count]) => ({
            name: status,
            value: count
          }))
        }
      ] : undefined,
      metadata: {
        generatedAt: new Date().toISOString(),
        generatedBy: userId,
        parameters
      }
    }
  }

  // Generar reporte de rendimiento de proveedores
  static async generateVendorPerformanceReport(
    companyId: string,
    userId: string,
    parameters: ReportParameters = {}
  ): Promise<ReportData> {
    const supabase = supabaseBrowser()

    // Obtener datos de gastos por proveedor
    const { data: spendData, error } = await supabase
      .from('spend_data')
      .select('*')
      .eq('company_id', companyId)
      .gte('date', parameters.dateFrom || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
      .lte('date', parameters.dateTo || new Date().toISOString())

    if (error) throw error

    let filteredData = spendData || []
    if (parameters.vendors?.length) {
      filteredData = filteredData.filter(item =>
        parameters.vendors!.includes(item.vendor)
      )
    }

    // Agrupar por proveedor
    const vendorData = filteredData.reduce((acc, item) => {
      if (!acc[item.vendor]) {
        acc[item.vendor] = {
          vendor: item.vendor,
          totalSpend: 0,
          transactionCount: 0,
          categories: new Set(),
          firstTransaction: item.date,
          lastTransaction: item.date
        }
      }

      acc[item.vendor].totalSpend += Number(item.amount)
      acc[item.vendor].transactionCount += 1
      acc[item.vendor].categories.add(item.category)
      acc[item.vendor].firstTransaction = item.date < acc[item.vendor].firstTransaction ? item.date : acc[item.vendor].firstTransaction
      acc[item.vendor].lastTransaction = item.date > acc[item.vendor].lastTransaction ? item.date : acc[item.vendor].lastTransaction

      return acc
    }, {} as Record<string, any>)

    // Convertir a array y calcular métricas adicionales
    const vendorPerformance = Object.values(vendorData).map((vendor: any) => ({
      ...vendor,
      categories: Array.from(vendor.categories),
      averageTransaction: vendor.transactionCount > 0 ? vendor.totalSpend / vendor.transactionCount : 0,
      categoryCount: vendor.categories.size
    })).sort((a, b) => b.totalSpend - a.totalSpend)

    const totalSpend = vendorPerformance.reduce((sum, vendor) => sum + vendor.totalSpend, 0)
    const topVendors = vendorPerformance.slice(0, 10)

    return {
      summary: {
        totalVendors: vendorPerformance.length,
        totalSpend,
        averageSpendPerVendor: vendorPerformance.length > 0 ? totalSpend / vendorPerformance.length : 0,
        topVendor: topVendors[0]?.vendor || 'N/A',
        topVendorSpend: topVendors[0]?.totalSpend || 0
      },
      details: vendorPerformance,
      charts: parameters.includeCharts ? [
        {
          type: 'bar',
          title: 'Top 10 Proveedores por Volumen',
          data: topVendors.map(vendor => ({
            name: vendor.vendor,
            value: vendor.totalSpend
          }))
        },
        {
          type: 'pie',
          title: 'Distribución de Gastos (Top 5)',
          data: topVendors.slice(0, 5).map(vendor => ({
            name: vendor.vendor,
            value: vendor.totalSpend,
            percentage: totalSpend > 0 ? Math.round((vendor.totalSpend / totalSpend) * 100) : 0
          }))
        }
      ] : undefined,
      metadata: {
        generatedAt: new Date().toISOString(),
        generatedBy: userId,
        parameters
      }
    }
  }

  // Guardar reporte en la base de datos
  static async saveReport(
    name: string,
    type: string,
    description: string | null,
    companyId: string,
    userId: string,
    parameters: ReportParameters = {}
  ) {
    const supabase = supabaseBrowser()

    const { data, error } = await supabase
      .from('reports')
      .insert({
        name,
        type,
        description,
        status: 'generating',
        parameters,
        company_id: companyId,
        created_by: userId
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Actualizar estado del reporte
  static async updateReportStatus(
    reportId: string,
    status: 'generating' | 'completed' | 'failed',
    filePath?: string,
    fileSize?: number
  ) {
    const supabase = supabaseBrowser()

    const updateData: any = { status }
    if (filePath) updateData.file_path = filePath
    if (fileSize) updateData.file_size = fileSize
    if (status === 'completed') updateData.completed_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('reports')
      .update(updateData)
      .eq('id', reportId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Obtener reportes de la empresa
  static async getCompanyReports(companyId: string) {
    const supabase = supabaseBrowser()

    const { data, error } = await supabase
      .from('reports')
      .select(`
        *,
        created_by:profiles(full_name, email)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  // Generar archivo Excel
  static async generateExcelFile(reportData: ReportData, reportName: string): Promise<Blob> {
    // Esta función requeriría una librería como xlsx
    // Por ahora retornamos un blob vacío como placeholder
    const csvContent = this.generateCSVContent(reportData)
    return new Blob([csvContent], { type: 'text/csv' })
  }

  // Generar contenido CSV
  static generateCSVContent(reportData: ReportData): string {
    const headers = Object.keys(reportData.details[0] || {})
    const csvRows = [
      headers.join(','),
      ...reportData.details.map(row =>
        headers.map(header => {
          const value = row[header]
          return typeof value === 'string' && value.includes(',')
            ? `"${value}"`
            : value
        }).join(',')
      )
    ]
    return csvRows.join('\n')
  }

  // Subir archivo a storage
  static async uploadReportFile(
    file: Blob,
    fileName: string,
    companyId: string
  ): Promise<string> {
    const filePath = `reports/${companyId}/${Date.now()}-${fileName}`

    const { data, error } = await StorageService.uploadFile({
      bucket: 'reports',
      path: filePath,
      file: new File([file], fileName, { type: file.type })
    })

    if (error) throw error
    return filePath
  }

  // Descargar archivo de reporte
  static async downloadReportFile(filePath: string): Promise<Blob> {
    const { data, error } = await StorageService.downloadFile({
      bucket: 'reports',
      path: filePath
    })

    if (error) throw error
    if (!data) {
      throw new Error('Archivo no encontrado en storage')
    }
    return data
  }
}

