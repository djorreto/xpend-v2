'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabaseBrowser } from '@/lib/supabase'
import { ArrowLeft, TrendingUp, AlertTriangle, Target, Users, FileText, Download, AlertCircle } from 'lucide-react'
import { SIPlanItem } from '@/types'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function InsightsPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = supabaseBrowser()
  const uploadId = params.id as string

  const [user, setUser] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [plan, setPlan] = useState<any>(null)
  const [items, setItems] = useState<SIPlanItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [uploadId])

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

        const { data: planData } = await supabase
          .from('si_procurement_plans')
          .select('*')
          .eq('upload_id', uploadId)
          .eq('company_id', profile.company_id)
          .single()

        if (planData) {
          setPlan(planData)

          const { data: itemsData } = await supabase
            .from('si_plan_items')
            .select('*')
            .eq('plan_id', planData.id)
            .order('total_spend', { ascending: false })

          if (itemsData) {
            setItems(itemsData)
          }
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Análisis de datos
  const totalSpend = items.reduce((sum, item) => sum + item.total_spend, 0)
  const topCategories = items.slice(0, 5)
  const topSpend = topCategories.reduce((sum, item) => sum + item.total_spend, 0)
  const topSpendPercentage = (topSpend / totalSpend) * 100

  // Oportunidades de ahorro
  const savingsOpportunities = items
    .filter(item => (item.projected_savings_percentage || 0) > 5)
    .sort((a, b) => (b.projected_savings_amount || 0) - (a.projected_savings_amount || 0))
    .slice(0, 5)

  // Concentración de proveedores
  const highConcentration = items.filter(item => (item.supplier_concentration || 0) > 70)
  const lowConcentration = items.filter(item => item.supplier_count >= 5)

  // Categorías estratégicas
  const strategic = items.filter(item => item.kraljic_quadrant === 'strategic')
  const leverage = items.filter(item => item.kraljic_quadrant === 'leverage')
  const bottleneck = items.filter(item => item.kraljic_quadrant === 'bottleneck')

  // Función para exportar a PDF
  const handleExportPDF = () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    let yPos = 20

    // Título
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('INFORME PRELIMINAR DE SOURCING INTELLIGENCE', pageWidth / 2, yPos, { align: 'center' })

    yPos += 10
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(`Plan: ${plan.name}`, pageWidth / 2, yPos, { align: 'center' })

    yPos += 6
    doc.setFontSize(10)
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-CL')}`, pageWidth / 2, yPos, { align: 'center' })

    // DISCLAIMER
    yPos += 15
    doc.setFillColor(255, 243, 205)
    doc.rect(10, yPos - 5, pageWidth - 20, 25, 'F')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('⚠️ DISCLAIMER', 15, yPos)
    yPos += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const disclaimerText = 'Este informe ha sido generado por un sistema de IA experimental. La información y recomendaciones aquí presentadas deben ser validadas por profesionales de procurement antes de su implementación. Los análisis pueden contener errores o imprecisiones.'
    const splitDisclaimer = doc.splitTextToSize(disclaimerText, pageWidth - 30)
    doc.text(splitDisclaimer, 15, yPos)

    // Resumen Ejecutivo
    yPos += 25
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('RESUMEN EJECUTIVO', 14, yPos)

    yPos += 8
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Gasto Total Analizado: $${totalSpend.toLocaleString()} USD`, 14, yPos)
    yPos += 6
    doc.text(`Categorías: ${items.length} principales`, 14, yPos)
    yPos += 6
    doc.text(`Concentración: Top 5 representan ${topSpendPercentage.toFixed(1)}% del gasto`, 14, yPos)
    yPos += 6
    doc.text(`Ahorro Proyectado: $${plan.projected_savings_amount?.toLocaleString()} (${plan.projected_savings_percentage?.toFixed(1)}%)`, 14, yPos)

    // Oportunidades de Ahorro
    if (savingsOpportunities.length > 0) {
      yPos += 15
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('PRINCIPALES OPORTUNIDADES DE AHORRO', 14, yPos)

      yPos += 8
      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Categoría', 'Gasto', 'Ahorro %', 'Ahorro $']],
        body: savingsOpportunities.map((item, index) => [
          (index + 1).toString(),
          item.category,
          `$${item.total_spend.toLocaleString()}`,
          `${item.projected_savings_percentage?.toFixed(1)}%`,
          `$${item.projected_savings_amount?.toLocaleString()}`
        ]),
        theme: 'grid',
        headStyles: { fillColor: [42, 212, 210] }
      })
      yPos = (doc as any).lastAutoTable.finalY + 10
    }

    // Alta Concentración
    if (highConcentration.length > 0 && yPos < 250) {
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('ALTA CONCENTRACIÓN DE PROVEEDORES (RIESGO)', 14, yPos)

      yPos += 8
      autoTable(doc, {
        startY: yPos,
        head: [['Categoría', 'Concentración', 'Proveedor Principal']],
        body: highConcentration.map(item => [
          item.category,
          `${item.supplier_concentration?.toFixed(0)}%`,
          item.main_supplier || 'N/A'
        ]),
        theme: 'grid',
        headStyles: { fillColor: [239, 68, 68] }
      })
      yPos = (doc as any).lastAutoTable.finalY + 10
    }

    // Nueva página para recomendaciones si es necesario
    if (yPos > 220) {
      doc.addPage()
      yPos = 20
    }

    // Recomendaciones Estratégicas
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('RECOMENDACIONES ESTRATÉGICAS', 14, yPos)

    yPos += 8
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')

    if (leverage.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.text(`Categorías de Apalancamiento (${leverage.length}):`, 14, yPos)
      yPos += 5
      doc.setFont('helvetica', 'normal')
      doc.text('→ Mayor oportunidad de ahorro mediante licitaciones', 14, yPos)
      yPos += 5
      doc.setFontSize(9)
      doc.text(leverage.map(i => i.category).join(', '), 14, yPos, { maxWidth: pageWidth - 28 })
      yPos += 10
    }

    if (strategic.length > 0) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(`Categorías Estratégicas (${strategic.length}):`, 14, yPos)
      yPos += 5
      doc.setFont('helvetica', 'normal')
      doc.text('→ Requieren relaciones estratégicas a largo plazo', 14, yPos)
      yPos += 10
    }

    if (bottleneck.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.text(`Cuellos de Botella (${bottleneck.length}):`, 14, yPos)
      yPos += 5
      doc.setFont('helvetica', 'normal')
      doc.text('→ Priorizar dual sourcing para reducir riesgo', 14, yPos)
      yPos += 10
    }

    // Plan de Acción
    yPos += 5
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('PLAN DE ACCIÓN RECOMENDADO', 14, yPos)

    yPos += 8
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Q1: Iniciar licitaciones en categorías de Apalancamiento', 14, yPos)
    yPos += 5
    doc.text('Q2-Q3: Desarrollar estrategias de dual sourcing para Cuellos de Botella', 14, yPos)
    yPos += 5
    doc.text('Q4: Establecer acuerdos marco con proveedores estratégicos', 14, yPos)
    yPos += 5
    doc.text('Continuo: Monitorear concentración de proveedores', 14, yPos)

    // Footer en todas las páginas
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(128)
      doc.text(
        `Xpend - Sourcing Intelligence | Página ${i} de ${pageCount} | Generado por IA`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      )
    }

    // Guardar PDF
    doc.save(`Informe-Sourcing-Intelligence-${new Date().toISOString().split('T')[0]}.pdf`)
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

  if (!plan) {
    return (
      <MainLayout user={user} companyName={company?.name}>
        <div className="text-center py-12">
          <p className="text-muted-foreground">No hay plan generado para este análisis</p>
          <Button onClick={() => router.push(`/sourcing-intelligence/${uploadId}/classify`)} className="mt-4">
            Volver a Clasificación
          </Button>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout user={user} companyName={company?.name}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Button
            variant="ghost"
            onClick={() => router.push(`/sourcing-intelligence/${uploadId}/plan`)}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al Plan
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center space-x-3">
                <FileText className="h-8 w-8" style={{ color: '#2AD4D2' }} />
                <span>Informe Preliminar</span>
              </h1>
              <p className="text-muted-foreground mt-2">
                Análisis objetivo de la situación actual del gasto
              </p>
            </div>
            <Button
              onClick={handleExportPDF}
              className="bg-gradient-to-r from-[#2AD4D2] to-[#3BE7AE]"
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar Informe PDF
            </Button>
          </div>
        </div>

        {/* Disclaimer - Visible en la página */}
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-yellow-900 mb-1">⚠️ Informe Generado por IA Experimental</h3>
                <p className="text-sm text-yellow-800">
                  Este informe ha sido generado automáticamente mediante inteligencia artificial.
                  La información y recomendaciones aquí presentadas deben ser <strong>validadas por profesionales de procurement</strong> antes de su implementación.
                  Los análisis pueden contener errores o imprecisiones. Use este documento como una guía inicial, no como una decisión final.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resumen Ejecutivo */}
        <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-blue-600" />
              <span>Resumen Ejecutivo</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-gray-800">
              <strong>Gasto Total Analizado:</strong> ${totalSpend.toLocaleString()} USD distribuido en {items.length} categorías principales.
            </p>
            <p className="text-gray-800">
              <strong>Concentración de Gasto:</strong> Las 5 categorías principales representan el <strong>{topSpendPercentage.toFixed(1)}%</strong> del gasto total.
            </p>
            <p className="text-gray-800">
              <strong>Ahorro Proyectado:</strong> ${plan.projected_savings_amount?.toLocaleString() || 0} USD
              ({plan.projected_savings_percentage?.toFixed(1)}% del gasto total) mediante optimización estratégica.
            </p>
          </CardContent>
        </Card>

        {/* Oportunidades Principales */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span>Principales Oportunidades de Ahorro</span>
            </CardTitle>
            <CardDescription>
              Categorías con mayor potencial de optimización
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {savingsOpportunities.length > 0 ? (
                savingsOpportunities.map((item, index) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {index + 1}. {item.category}
                      </p>
                      <p className="text-sm text-gray-600">
                        Gasto: ${item.total_spend.toLocaleString()} • {item.supplier_count} proveedores
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">
                        {item.projected_savings_percentage?.toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-600">
                        ${item.projected_savings_amount?.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No se identificaron oportunidades significativas</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Análisis de Riesgos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Alta Concentración */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                <span>Alta Concentración de Proveedores</span>
              </CardTitle>
              <CardDescription>
                Categorías con riesgo de dependencia
              </CardDescription>
            </CardHeader>
            <CardContent>
              {highConcentration.length > 0 ? (
                <div className="space-y-2">
                  {highConcentration.map(item => (
                    <div key={item.id} className="p-2 bg-red-50 rounded border border-red-200">
                      <p className="font-medium text-sm">{item.category}</p>
                      <p className="text-xs text-gray-600">
                        {item.supplier_concentration?.toFixed(0)}% del gasto en 1 proveedor ({item.main_supplier})
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Sin concentración alta detectada</p>
              )}
            </CardContent>
          </Card>

          {/* Buena Diversificación */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-green-600">
                <Users className="h-5 w-5" />
                <span>Buena Diversificación</span>
              </CardTitle>
              <CardDescription>
                Categorías con múltiples proveedores
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lowConcentration.length > 0 ? (
                <div className="space-y-2">
                  {lowConcentration.slice(0, 5).map(item => (
                    <div key={item.id} className="p-2 bg-green-50 rounded border border-green-200">
                      <p className="font-medium text-sm">{item.category}</p>
                      <p className="text-xs text-gray-600">
                        {item.supplier_count} proveedores activos
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No hay categorías con alta diversificación</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recomendaciones Estratégicas */}
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <CardHeader>
            <CardTitle>🎯 Recomendaciones Estratégicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {strategic.length > 0 && (
              <div className="p-4 bg-white rounded-lg border border-red-300">
                <h4 className="font-bold text-red-900 mb-2">🔴 Categorías Estratégicas ({strategic.length})</h4>
                <p className="text-sm text-gray-700 mb-2">
                  Alto impacto y alto riesgo. Requieren relaciones estratégicas a largo plazo y monitoreo constante.
                </p>
                <div className="flex flex-wrap gap-2">
                  {strategic.map(item => (
                    <Badge key={item.id} variant="outline" className="bg-red-50">
                      {item.category}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {leverage.length > 0 && (
              <div className="p-4 bg-white rounded-lg border border-green-300">
                <h4 className="font-bold text-green-900 mb-2">🟢 Categorías de Apalancamiento ({leverage.length})</h4>
                <p className="text-sm text-gray-700 mb-2">
                  Alto impacto, bajo riesgo. <strong>Mayor oportunidad de ahorro mediante licitaciones y consolidación.</strong>
                </p>
                <div className="flex flex-wrap gap-2">
                  {leverage.map(item => (
                    <Badge key={item.id} variant="outline" className="bg-green-50">
                      {item.category}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {bottleneck.length > 0 && (
              <div className="p-4 bg-white rounded-lg border border-yellow-300">
                <h4 className="font-bold text-yellow-900 mb-2">🟡 Cuellos de Botella ({bottleneck.length})</h4>
                <p className="text-sm text-gray-700 mb-2">
                  Bajo impacto, alto riesgo. Priorizar aseguramiento de suministro y dual sourcing.
                </p>
                <div className="flex flex-wrap gap-2">
                  {bottleneck.map(item => (
                    <Badge key={item.id} variant="outline" className="bg-yellow-50">
                      {item.category}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 bg-white rounded-lg border border-blue-300">
              <h4 className="font-bold text-blue-900 mb-2">💡 Plan de Acción Recomendado</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                <li><strong>Corto Plazo (Q1):</strong> Iniciar licitaciones en categorías de Apalancamiento para capturar ahorros rápidos.</li>
                <li><strong>Medio Plazo (Q2-Q3):</strong> Desarrollar estrategias de dual sourcing para Cuellos de Botella.</li>
                <li><strong>Largo Plazo (Q4):</strong> Establecer acuerdos marco con proveedores estratégicos en categorías críticas.</li>
                <li><strong>Continuo:</strong> Monitorear concentración de proveedores y ajustar estrategias según performance.</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Navegación */}
        <div className="flex space-x-4">
          <Button
            variant="outline"
            onClick={() => router.push(`/sourcing-intelligence/${uploadId}/plan`)}
          >
            Ver Plan Detallado
          </Button>
          <Button
            onClick={() => router.push(`/sourcing-intelligence/${uploadId}/kraljic`)}
            className="bg-gradient-to-r from-[#2AD4D2] to-[#3BE7AE]"
          >
            Ver Matriz de Kraljic
          </Button>
        </div>
      </div>
    </MainLayout>
  )
}

