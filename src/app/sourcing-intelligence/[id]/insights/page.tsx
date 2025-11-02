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

  // Función para exportar a PDF con diseño profesional Xpend
  const handleExportPDF = () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 15

    // Colores Xpend
    const xpendTeal: [number, number, number] = [42, 212, 210]
    const xpendGreen: [number, number, number] = [59, 231, 174]
    const xpendDark: [number, number, number] = [45, 62, 61]
    const xpendRed: [number, number, number] = [239, 68, 68]

    // ===== PÁGINA 1: PORTADA =====
    // Fondo degradado simulado con rectángulos
    doc.setFillColor(45, 62, 61)
    doc.rect(0, 0, pageWidth, pageHeight, 'F')

    // Header con línea turquesa
    doc.setFillColor(...xpendTeal)
    doc.rect(0, 0, pageWidth, 8, 'F')

    // Logo "XPEND" simulado
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(32)
    doc.setFont('helvetica', 'bold')
    doc.text('XPEND', margin, 35)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Sourcing Intelligence', margin, 42)

    // Título principal
    doc.setFontSize(28)
    doc.setFont('helvetica', 'bold')
    doc.text('INFORME', pageWidth / 2, 80, { align: 'center' })
    doc.text('PRELIMINAR', pageWidth / 2, 92, { align: 'center' })

    // Subtítulo
    doc.setFontSize(16)
    doc.setTextColor(...xpendGreen)
    doc.text('Análisis de Gasto & Estrategia', pageWidth / 2, 105, { align: 'center' })

    // Info del plan
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(`Plan: ${plan.name}`, pageWidth / 2, 130, { align: 'center' })
    doc.setFontSize(10)
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-CL')}`, pageWidth / 2, 138, { align: 'center' })
    doc.text(`${items.length} Categorías Analizadas`, pageWidth / 2, 146, { align: 'center' })

    // Disclaimer en la portada
    const disclaimerY = 170
    doc.setFillColor(255, 243, 205)
    doc.roundedRect(margin, disclaimerY, pageWidth - 2 * margin, 40, 3, 3, 'F')

    doc.setTextColor(180, 83, 9)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('DISCLAIMER - GENERADO POR IA EXPERIMENTAL', pageWidth / 2, disclaimerY + 8, { align: 'center' })

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    const disclaimerLines = doc.splitTextToSize(
      'Este informe ha sido generado automáticamente mediante inteligencia artificial. La información y recomendaciones deben ser validadas por profesionales de procurement antes de su implementación. Los análisis pueden contener errores o imprecisiones.',
      pageWidth - 2 * margin - 10
    )
    doc.text(disclaimerLines, pageWidth / 2, disclaimerY + 18, { align: 'center' })

    // Footer portada
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text('Powered by Xpend™ - Strategic Sourcing Platform', pageWidth / 2, pageHeight - 10, { align: 'center' })

    // ===== PÁGINA 2: RESUMEN EJECUTIVO =====
    doc.addPage()
    let yPos = margin

    // Header de página
    doc.setFillColor(...xpendTeal)
    doc.rect(0, 0, pageWidth, 6, 'F')

    doc.setTextColor(...xpendDark)
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    yPos = 20
    doc.text('RESUMEN EJECUTIVO', margin, yPos)

    // Línea decorativa
    doc.setDrawColor(...xpendGreen)
    doc.setLineWidth(0.5)
    doc.line(margin, yPos + 2, 60, yPos + 2)

    yPos = 35

    // Métricas en cajas
    const boxWidth = (pageWidth - 3 * margin) / 2
    const boxHeight = 25

    // Caja 1: Gasto Total
    doc.setFillColor(240, 253, 253)
    doc.roundedRect(margin, yPos, boxWidth, boxHeight, 2, 2, 'F')
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text('Gasto Total Analizado', margin + 5, yPos + 6)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...xpendDark)
    doc.text(`$${totalSpend.toLocaleString()} USD`, margin + 5, yPos + 16)

    // Caja 2: Categorías
    doc.setFillColor(240, 253, 253)
    doc.roundedRect(margin + boxWidth + 5, yPos, boxWidth, boxHeight, 2, 2, 'F')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text('Categorías Principales', margin + boxWidth + 10, yPos + 6)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...xpendDark)
    doc.text(`${items.length}`, margin + boxWidth + 10, yPos + 16)

    yPos += boxHeight + 10

    // Caja 3: Concentración
    doc.setFillColor(254, 243, 199)
    doc.roundedRect(margin, yPos, boxWidth, boxHeight, 2, 2, 'F')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text('Concentración (Top 5)', margin + 5, yPos + 6)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(180, 83, 9)
    doc.text(`${topSpendPercentage.toFixed(1)}%`, margin + 5, yPos + 16)

    // Caja 4: Ahorro Proyectado
    doc.setFillColor(220, 252, 231)
    doc.roundedRect(margin + boxWidth + 5, yPos, boxWidth, boxHeight, 2, 2, 'F')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text('Ahorro Proyectado', margin + boxWidth + 10, yPos + 6)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(34, 197, 94)
    doc.text(`${plan.projected_savings_percentage?.toFixed(1)}%`, margin + boxWidth + 10, yPos + 16)
    doc.setFontSize(10)
    doc.text(`($${plan.projected_savings_amount?.toLocaleString()})`, margin + boxWidth + 10, yPos + 21)

    yPos += boxHeight + 15

    // Texto explicativo del análisis
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 35, 2, 2, 'F')

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...xpendDark)
    doc.text('RESUMEN DEL ANALISIS', margin + 5, yPos + 7)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 60)

    const analysisText = `Se ha realizado un análisis exhaustivo de ${items.length} categorías de gasto, representando un total de $${totalSpend.toLocaleString()} USD. El análisis revela que las 5 categorías principales concentran el ${topSpendPercentage.toFixed(1)}% del gasto total, lo que indica ${topSpendPercentage > 80 ? 'una alta concentración que puede representar riesgos de dependencia' : 'una distribución relativamente equilibrada'}. Se han identificado oportunidades de ahorro por $${plan.projected_savings_amount?.toLocaleString()} USD (${plan.projected_savings_percentage?.toFixed(1)}% del gasto total) mediante la implementación de estrategias de sourcing diferenciadas según la matriz de Kraljic.`

    const analysisLines = doc.splitTextToSize(analysisText, pageWidth - 2 * margin - 10)
    doc.text(analysisLines, margin + 5, yPos + 14)

    yPos += 45

    // Tabla de Oportunidades
    if (savingsOpportunities.length > 0) {
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...xpendDark)
      doc.text('PRINCIPALES OPORTUNIDADES DE AHORRO', margin, yPos)
      yPos += 8

      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Categoría', 'Gasto Actual', 'Ahorro %', 'Ahorro USD']],
        body: savingsOpportunities.map((item, index) => [
          (index + 1).toString(),
          item.category,
          `$${item.total_spend.toLocaleString()}`,
          `${item.projected_savings_percentage?.toFixed(1)}%`,
          `$${item.projected_savings_amount?.toLocaleString()}`
        ]),
        theme: 'striped',
        headStyles: {
          fillColor: xpendTeal,
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 9,
          textColor: xpendDark
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          2: { halign: 'right' },
          3: { halign: 'center', textColor: [34, 197, 94], fontStyle: 'bold' },
          4: { halign: 'right', textColor: [34, 197, 94], fontStyle: 'bold' }
        },
        margin: { left: margin, right: margin }
      })

      yPos = (doc as any).lastAutoTable.finalY + 15
    }

    // Nueva página si es necesario
    if (yPos > pageHeight - 80) {
      doc.addPage()
      yPos = margin + 10
      // Header
      doc.setFillColor(...xpendTeal)
      doc.rect(0, 0, pageWidth, 6, 'F')
    }

    // Tabla de Riesgos
    if (highConcentration.length > 0) {
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...xpendDark)
      doc.text('ALTA CONCENTRACION DE PROVEEDORES (RIESGO)', margin, yPos)
      yPos += 8

      autoTable(doc, {
        startY: yPos,
        head: [['Categoría', 'Concentración', 'Proveedor Principal']],
        body: highConcentration.map(item => [
          item.category,
          `${item.supplier_concentration?.toFixed(0)}%`,
          item.main_supplier || 'N/A'
        ]),
        theme: 'striped',
        headStyles: {
          fillColor: xpendRed,
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 9,
          textColor: xpendDark
        },
        alternateRowStyles: {
          fillColor: [254, 242, 242]
        },
        columnStyles: {
          1: { halign: 'center', textColor: xpendRed, fontStyle: 'bold' }
        },
        margin: { left: margin, right: margin }
      })

      yPos = (doc as any).lastAutoTable.finalY + 15

      // Texto explicativo de riesgos
      if (yPos < pageHeight - 60) {
        doc.setFillColor(254, 242, 242)
        doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 25, 2, 2, 'F')

        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...xpendRed)
        doc.text('ANALISIS DE RIESGO:', margin + 5, yPos + 7)

        doc.setFont('helvetica', 'normal')
        doc.setTextColor(60, 60, 60)

        const riskText = `Se han detectado ${highConcentration.length} categorías con alta concentración de proveedores (>70% del gasto en un solo proveedor). Esta situación representa un riesgo significativo para la continuidad operacional. Se recomienda implementar estrategias de diversificación y dual sourcing para mitigar la dependencia de proveedores únicos.`

        const riskLines = doc.splitTextToSize(riskText, pageWidth - 2 * margin - 10)
        doc.text(riskLines, margin + 5, yPos + 14)

        yPos += 30
      }
    }

    // ===== PÁGINA 3: RECOMENDACIONES =====
    doc.addPage()
    yPos = margin

    // Header
    doc.setFillColor(...xpendTeal)
    doc.rect(0, 0, pageWidth, 6, 'F')

    doc.setTextColor(...xpendDark)
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    yPos = 20
    doc.text('RECOMENDACIONES ESTRATÉGICAS', margin, yPos)

    doc.setDrawColor(...xpendGreen)
    doc.setLineWidth(0.5)
    doc.line(margin, yPos + 2, 100, yPos + 2)

    yPos = 35

    // Introducción a recomendaciones
    doc.setFillColor(240, 249, 255)
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 30, 2, 2, 'F')

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...xpendDark)
    doc.text('ESTRATEGIA DE SOURCING DIFERENCIADA', margin + 5, yPos + 7)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 60)

    const introText = `Basándose en la Matriz de Kraljic, se propone una estrategia diferenciada según el impacto en el negocio y el riesgo de suministro de cada categoría. Las recomendaciones se organizan en tres enfoques principales: maximizar ahorros en categorías de apalancamiento, asegurar continuidad en cuellos de botella, y desarrollar asociaciones estratégicas en categorías críticas.`

    const introLines = doc.splitTextToSize(introText, pageWidth - 2 * margin - 10)
    doc.text(introLines, margin + 5, yPos + 14)

    yPos = 75

    // Recomendaciones por cuadrante
    if (leverage.length > 0) {
      doc.setFillColor(220, 252, 231)
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 28, 2, 2, 'F')

      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(22, 163, 74)
      doc.text(`CATEGORIAS DE APALANCAMIENTO (${leverage.length})`, margin + 5, yPos + 7)

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...xpendDark)
      doc.text('→ Mayor oportunidad de ahorro mediante licitaciones competitivas', margin + 5, yPos + 14)

      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      const leverageText = doc.splitTextToSize(
        `Categorías: ${leverage.map(i => i.category).join(', ')}`,
        pageWidth - 2 * margin - 10
      )
      doc.text(leverageText, margin + 5, yPos + 20)

      yPos += 35
    }

    if (strategic.length > 0) {
      doc.setFillColor(254, 242, 242)
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 28, 2, 2, 'F')

      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(220, 38, 38)
      doc.text(`CATEGORIAS ESTRATEGICAS (${strategic.length})`, margin + 5, yPos + 7)

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...xpendDark)
      doc.text('→ Requieren relaciones estratégicas a largo plazo y monitoreo constante', margin + 5, yPos + 14)

      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      const strategicText = doc.splitTextToSize(
        `Categorías: ${strategic.map(i => i.category).join(', ')}`,
        pageWidth - 2 * margin - 10
      )
      doc.text(strategicText, margin + 5, yPos + 20)

      yPos += 35
    }

    if (bottleneck.length > 0) {
      doc.setFillColor(254, 249, 195)
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 28, 2, 2, 'F')

      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(161, 98, 7)
      doc.text(`CUELLOS DE BOTELLA (${bottleneck.length})`, margin + 5, yPos + 7)

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...xpendDark)
      doc.text('→ Priorizar dual sourcing y aseguramiento de suministro', margin + 5, yPos + 14)

      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      const bottleneckText = doc.splitTextToSize(
        `Categorías: ${bottleneck.map(i => i.category).join(', ')}`,
        pageWidth - 2 * margin - 10
      )
      doc.text(bottleneckText, margin + 5, yPos + 20)

      yPos += 35
    }

    // Plan de Acción
    yPos += 10
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...xpendDark)
    doc.text('PLAN DE ACCION TRIMESTRAL', margin, yPos)

    yPos += 10

    const actionItems: Array<{ q: string; text: string; color: [number, number, number] }> = [
      { q: 'Q1', text: 'Iniciar licitaciones en categorías de Apalancamiento para capturar ahorros rápidos', color: [59, 231, 174] },
      { q: 'Q2', text: 'Desarrollar estrategias de dual sourcing para Cuellos de Botella', color: [42, 212, 210] },
      { q: 'Q3', text: 'Negociar acuerdos marco con proveedores estratégicos', color: [59, 231, 174] },
      { q: 'Q4', text: 'Establecer KPIs de desempeño y monitoreo continuo', color: [42, 212, 210] }
    ]

    actionItems.forEach((action, index) => {
      doc.setFillColor(...action.color)
      doc.circle(margin + 3, yPos + 3, 3, 'F')

      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...xpendDark)
      doc.text(action.q, margin + 10, yPos + 5)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      const actionText = doc.splitTextToSize(action.text, pageWidth - margin - 35)
      doc.text(actionText, margin + 22, yPos + 5)

      yPos += 12
    })

    // Footer en todas las páginas
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)

      // Línea footer
      doc.setDrawColor(...xpendTeal)
      doc.setLineWidth(0.3)
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15)

      doc.setFontSize(7)
      doc.setTextColor(120, 120, 120)
      doc.text('Xpend™ - Sourcing Intelligence Platform', margin, pageHeight - 10)
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' })
      doc.text('Generado por IA - Validar antes de implementar', pageWidth / 2, pageHeight - 10, { align: 'center' })
    }

    // Guardar
    doc.save(`Xpend-Informe-SI-${new Date().toISOString().split('T')[0]}.pdf`)
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

