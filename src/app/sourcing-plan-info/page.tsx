'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Logo } from '@/components/ui/logo'
import {
  Target,
  TrendingUp,
  BarChart3,
  CheckCircle,
  ArrowRight,
  Lightbulb,
  Calendar,
  DollarSign,
  Grid3x3,
  Menu,
  X,
  Sparkles,
  ChevronDown
} from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase'

export default function SourcingPlanInfoPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showSolutionsMenu, setShowSolutionsMenu] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [menuTimeout, setMenuTimeout] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const supabase = supabaseBrowser()
    const { data: { session } } = await supabase.auth.getSession()
    setIsAuthenticated(!!session)
  }

  const handleDemo = () => {
    console.log('Agendar demo')
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #1a2625 0%, #2D3E3D 50%, #1a2625 100%)' }}>
      {/* Header */}
      <header className="relative z-50 backdrop-blur-md" style={{
        backgroundColor: 'rgba(45, 62, 61, 0.98)',
        borderBottom: '2px solid',
        borderImage: 'linear-gradient(90deg, transparent 0%, #3BE7AE 50%, transparent 100%) 1'
      }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <a href="/home" className="flex items-center cursor-pointer">
              <Logo size="lg" variant="white" showSlogan={true} />
            </a>

            <nav className="hidden md:flex items-center space-x-8">
              {/* Menú Desplegable Soluciones */}
              <div
                className="relative"
                onMouseEnter={() => {
                  if (menuTimeout) clearTimeout(menuTimeout)
                  setShowSolutionsMenu(true)
                }}
                onMouseLeave={() => {
                  const timeout = setTimeout(() => setShowSolutionsMenu(false), 300)
                  setMenuTimeout(timeout)
                }}
              >
                <button
                  className="text-white/90 font-medium transition-all duration-300 flex items-center"
                  style={{ color: showSolutionsMenu ? '#3BE7AE' : 'rgba(255, 255, 255, 0.9)' }}
                >
                  Soluciones
                  <ChevronDown className={`ml-1 h-4 w-4 transition-transform duration-300 ${showSolutionsMenu ? 'rotate-180' : ''}`} />
                </button>

                {showSolutionsMenu && (
                  <div
                    className="absolute top-full left-0 mt-2 w-56 rounded-xl shadow-2xl overflow-hidden z-50"
                    style={{
                      backgroundColor: 'rgba(45, 62, 61, 0.98)',
                      border: '1px solid rgba(59, 231, 174, 0.2)'
                    }}
                  >
                    <a
                      href="/rfx-maker-info"
                      className="block px-6 py-3 text-white/90 font-medium transition-all duration-200"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(59, 231, 174, 0.15)'
                        e.currentTarget.style.color = '#3BE7AE'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)'
                      }}
                    >
                      RFx Maker
                    </a>
                    <a
                      href="/sourcing-plan-info"
                      className="block px-6 py-3 text-white/90 font-medium transition-all duration-200"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(59, 231, 174, 0.15)'
                        e.currentTarget.style.color = '#3BE7AE'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)'
                      }}
                    >
                      Sourcing Plan
                    </a>
                    <a
                      href="/proveedores"
                      className="block px-6 py-3 text-white/90 font-medium transition-all duration-200"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(59, 231, 174, 0.15)'
                        e.currentTarget.style.color = '#3BE7AE'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)'
                      }}
                    >
                      Proveedores
                    </a>
                  </div>
                )}
              </div>

              <a href="/nosotros" className="text-white/90 font-medium transition-all duration-300 hover:text-[#3BE7AE]">
                Nosotros
              </a>
              <a href="/blog" className="text-white/90 font-medium transition-all duration-300 hover:text-[#3BE7AE]">
                Blog
              </a>
              <a href="/faq" className="text-white/90 font-medium transition-all duration-300 hover:text-[#3BE7AE]">
                FAQ
              </a>
            </nav>

            <div className="hidden md:flex items-center space-x-4">
              <a href={isAuthenticated ? "/dashboard" : "/login"}>
                <Button
                  className="px-6 py-2.5 rounded-lg font-semibold shadow-lg transition-all duration-300"
                  style={{
                    backgroundColor: '#3BE7AE',
                    color: '#2D3E3D',
                  }}
                >
                  {isAuthenticated ? "Ir a Xpend" : "Login"}
                </Button>
              </a>
            </div>

            <div className="md:hidden">
              <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-white">
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden bg-[#2D3E3D] border-t border-white/10">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <div className="px-3 py-2">
                <p className="text-xs font-bold text-[#3BE7AE] uppercase tracking-wide mb-2">Soluciones</p>
                <a href="/rfx-maker-info" className="block px-3 py-2 text-white hover:text-[#3BE7AE]">RFx Maker</a>
                <a href="/sourcing-plan-info" className="block px-3 py-2 text-white hover:text-[#3BE7AE]">Sourcing Plan</a>
                <a href="/proveedores" className="block px-3 py-2 text-white hover:text-[#3BE7AE]">Proveedores</a>
              </div>
              <a href="/nosotros" className="block px-3 py-2 text-white hover:text-[#3BE7AE]">Nosotros</a>
              <a href="/blog" className="block px-3 py-2 text-white hover:text-[#3BE7AE]">Blog</a>
              <a href="/faq" className="block px-3 py-2 text-white hover:text-[#3BE7AE]">FAQ</a>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-4 py-2 rounded-full mb-6" style={{ backgroundColor: 'rgba(59, 231, 174, 0.15)', border: '1px solid rgba(59, 231, 174, 0.3)' }}>
              <Sparkles className="h-5 w-5 mr-2" style={{ color: '#3BE7AE' }} />
              <span className="text-sm font-bold" style={{ color: '#3BE7AE' }}>MÓDULO BETA MVP</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-8" style={{ letterSpacing: '-0.02em' }}>
              <span style={{
                background: 'linear-gradient(135deg, #3BE7AE 0%, #2AD4D2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>Sourcing Plan</span>
            </h1>
            <p className="text-2xl mb-12 max-w-4xl mx-auto" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
              Planificación estratégica de sourcing potenciada con análisis de gasto inteligente y matriz de Kraljic.
            </p>
          </div>
        </div>
      </section>

      {/* Separator */}
      <div className="h-20" style={{
        background: 'linear-gradient(to bottom, #1a2625 0%, #f9fafb 100%)'
      }}></div>

      {/* Main Content */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto">
          {/* El Problema */}
          <div className="mb-20">
            <h2 className="text-4xl font-bold mb-8 text-center" style={{ color: '#2D3E3D' }}>
              ¿Tu plan de sourcing está en Excel?
            </h2>
            <div className="max-w-4xl mx-auto space-y-6">
              <p className="text-xl text-gray-700 leading-relaxed">
                La mayoría de las áreas de procurement planifican en hojas de cálculo desconectadas:
                una para el gasto, otra para los proyectos, otra para los ahorros...
              </p>
              <p className="text-xl text-gray-700 leading-relaxed">
                Y al final del trimestre, nadie sabe con certeza <strong>dónde están, cuánto gastaron realmente,
                qué proyectos van atrasados, ni qué oportunidades de ahorro están dejando pasar.</strong>
              </p>
            </div>
          </div>

          {/* La Solución */}
          <div className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4" style={{ color: '#2D3E3D' }}>
                Planificación estratégica en tiempo real
              </h2>
              <div className="w-24 h-1.5 mx-auto rounded-full" style={{ background: 'linear-gradient(90deg, #3BE7AE 0%, #2AD4D2 100%)' }}></div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
                <CardContent className="p-8">
                  <div className="p-4 rounded-xl mb-6 inline-block" style={{ backgroundColor: 'rgba(59, 231, 174, 0.15)' }}>
                    <BarChart3 className="h-10 w-10" style={{ color: '#3BE7AE' }} />
                  </div>
                  <h3 className="text-2xl font-bold mb-4" style={{ color: '#2D3E3D' }}>Análisis de Gasto con IA</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Importa tu gasto histórico y la IA lo categoriza automáticamente según UNSPSC o tu taxonomía personalizada.
                    Visualiza patrones, tendencias y concentración de gasto por categoría, proveedor y departamento.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
                <CardContent className="p-8">
                  <div className="p-4 rounded-xl mb-6 inline-block" style={{ backgroundColor: 'rgba(42, 212, 210, 0.15)' }}>
                    <Grid3x3 className="h-10 w-10" style={{ color: '#2AD4D2' }} />
                  </div>
                  <h3 className="text-2xl font-bold mb-4" style={{ color: '#2D3E3D' }}>Matriz de Kraljic Automática</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Visualiza tu gasto en la matriz de Kraljic: identifica qué categorías son estratégicas, cuáles son commodities,
                    dónde tienes riesgo de suministro y dónde puedes generar más valor.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
                <CardContent className="p-8">
                  <div className="p-4 rounded-xl mb-6 inline-block" style={{ backgroundColor: 'rgba(59, 231, 174, 0.15)' }}>
                    <Calendar className="h-10 w-10" style={{ color: '#3BE7AE' }} />
                  </div>
                  <h3 className="text-2xl font-bold mb-4" style={{ color: '#2D3E3D' }}>Planificación Anual y Trimestral</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Define tus iniciativas de sourcing por trimestre: qué categorías vas a licitar, cuándo, con qué presupuesto
                    y qué ahorros proyectas. Haz seguimiento del avance real vs. proyectado.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
                <CardContent className="p-8">
                  <div className="p-4 rounded-xl mb-6 inline-block" style={{ backgroundColor: 'rgba(42, 212, 210, 0.15)' }}>
                    <Lightbulb className="h-10 w-10" style={{ color: '#2AD4D2' }} />
                  </div>
                  <h3 className="text-2xl font-bold mb-4" style={{ color: '#2D3E3D' }}>Oportunidades de Ahorro</h3>
                  <p className="text-gray-700 leading-relaxed">
                    La IA identifica automáticamente oportunidades: consolidación de proveedores, categorías con alta dispersión,
                    compras spot que deberían ser contratos marco, y más.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Matriz de Kraljic */}
          <div className="mb-20">
            <h2 className="text-4xl font-bold mb-12 text-center" style={{ color: '#2D3E3D' }}>
              Entiende tu portafolio de compras con Kraljic
            </h2>
            <div className="max-w-5xl mx-auto">
              <Card className="border-0 shadow-2xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
                <CardContent className="p-12">
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    {/* Estratégicos */}
                    <div className="p-8 rounded-xl" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '2px solid rgba(239, 68, 68, 0.3)' }}>
                      <h4 className="text-xl font-bold mb-3 text-red-700">Estratégicos</h4>
                      <p className="text-sm text-gray-700 mb-2"><strong>Alto impacto + Alto riesgo</strong></p>
                      <p className="text-sm text-gray-600">Relaciones a largo plazo, contratos complejos, alianzas estratégicas</p>
                    </div>

                    {/* Cuello de Botella */}
                    <div className="p-8 rounded-xl" style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', border: '2px solid rgba(251, 191, 36, 0.3)' }}>
                      <h4 className="text-xl font-bold mb-3 text-amber-600">Cuello de Botella</h4>
                      <p className="text-sm text-gray-700 mb-2"><strong>Bajo impacto + Alto riesgo</strong></p>
                      <p className="text-sm text-gray-600">Asegurar suministro, proveedores alternativos, inventario de seguridad</p>
                    </div>

                    {/* Apalancamiento */}
                    <div className="p-8 rounded-xl" style={{ backgroundColor: 'rgba(59, 231, 174, 0.1)', border: '2px solid rgba(59, 231, 174, 0.3)' }}>
                      <h4 className="text-xl font-bold mb-3" style={{ color: '#3BE7AE' }}>Apalancamiento</h4>
                      <p className="text-sm text-gray-700 mb-2"><strong>Alto impacto + Bajo riesgo</strong></p>
                      <p className="text-sm text-gray-600">Negociación agresiva, competencia, consolidación de volumen</p>
                    </div>

                    {/* Rutinarios */}
                    <div className="p-8 rounded-xl" style={{ backgroundColor: 'rgba(156, 163, 175, 0.1)', border: '2px solid rgba(156, 163, 175, 0.3)' }}>
                      <h4 className="text-xl font-bold mb-3 text-gray-700">Rutinarios</h4>
                      <p className="text-sm text-gray-700 mb-2"><strong>Bajo impacto + Bajo riesgo</strong></p>
                      <p className="text-sm text-gray-600">Automatizar, catálogos, compras electrónicas, self-service</p>
                    </div>
                  </div>

                  <div className="text-center pt-6 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      <strong>La IA clasifica automáticamente</strong> cada categoría de gasto según su impacto financiero y riesgo de suministro,
                      sugiriendo la estrategia de sourcing más adecuada.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Cómo Funciona */}
          <div className="mb-20">
            <h2 className="text-4xl font-bold mb-12 text-center" style={{ color: '#2D3E3D' }}>
              Cómo funciona
            </h2>
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center mr-6 font-bold text-white text-xl" style={{ backgroundColor: '#3BE7AE' }}>
                  1
                </div>
                <div>
                  <h4 className="text-xl font-bold mb-2" style={{ color: '#2D3E3D' }}>Importa tu gasto histórico</h4>
                  <p className="text-gray-700">Sube un archivo Excel/CSV con tu gasto del último año: categoría, proveedor, monto, departamento, fecha.</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center mr-6 font-bold text-white text-xl" style={{ backgroundColor: '#2AD4D2' }}>
                  2
                </div>
                <div>
                  <h4 className="text-xl font-bold mb-2" style={{ color: '#2D3E3D' }}>La IA categoriza y clasifica</h4>
                  <p className="text-gray-700">La IA normaliza las categorías, identifica patrones, calcula concentración y posiciona cada categoría en la matriz de Kraljic.</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center mr-6 font-bold text-white text-xl" style={{ backgroundColor: '#3BE7AE' }}>
                  3
                </div>
                <div>
                  <h4 className="text-xl font-bold mb-2" style={{ color: '#2D3E3D' }}>Define tus iniciativas</h4>
                  <p className="text-gray-700">Crea iniciativas de sourcing por trimestre: qué vas a licitar, cuándo, presupuesto baseline y ahorro proyectado.</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center mr-6 font-bold text-white text-xl" style={{ backgroundColor: '#2AD4D2' }}>
                  4
                </div>
                <div>
                  <h4 className="text-xl font-bold mb-2" style={{ color: '#2D3E3D' }}>Monitorea en tiempo real</h4>
                  <p className="text-gray-700">Dashboard con avance trimestral, iniciativas atrasadas, ahorros proyectados vs. realizados, y alertas automáticas.</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center mr-6 font-bold text-white text-xl" style={{ backgroundColor: '#3BE7AE' }}>
                  5
                </div>
                <div>
                  <h4 className="text-xl font-bold mb-2" style={{ color: '#2D3E3D' }}>Reporta a gerencia</h4>
                  <p className="text-gray-700">Genera reportes ejecutivos automáticos con KPIs, gráficos y resumen de avance para presentar en reuniones trimestrales.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Beneficios */}
          <div className="mb-20">
            <h2 className="text-4xl font-bold mb-12 text-center" style={{ color: '#2D3E3D' }}>
              Beneficios clave
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="inline-flex p-4 rounded-xl mb-4" style={{ backgroundColor: 'rgba(59, 231, 174, 0.15)' }}>
                  <Target className="h-12 w-12" style={{ color: '#3BE7AE' }} />
                </div>
                <h4 className="text-xl font-bold mb-3" style={{ color: '#2D3E3D' }}>Visibilidad Total</h4>
                <p className="text-gray-700">Sabe siempre dónde estás, qué falta, qué va atrasado y qué oportunidades tienes.</p>
              </div>

              <div className="text-center">
                <div className="inline-flex p-4 rounded-xl mb-4" style={{ backgroundColor: 'rgba(42, 212, 210, 0.15)' }}>
                  <DollarSign className="h-12 w-12" style={{ color: '#2AD4D2' }} />
                </div>
                <h4 className="text-xl font-bold mb-3" style={{ color: '#2D3E3D' }}>Identifica Ahorros</h4>
                <p className="text-gray-700">La IA detecta oportunidades de ahorro que manualmente serían invisibles.</p>
              </div>

              <div className="text-center">
                <div className="inline-flex p-4 rounded-xl mb-4" style={{ backgroundColor: 'rgba(59, 231, 174, 0.15)' }}>
                  <TrendingUp className="h-12 w-12" style={{ color: '#3BE7AE' }} />
                </div>
                <h4 className="text-xl font-bold mb-3" style={{ color: '#2D3E3D' }}>Estrategia Basada en Datos</h4>
                <p className="text-gray-700">Toma decisiones de sourcing fundamentadas en análisis real, no en intuición.</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center bg-gradient-to-r rounded-2xl p-12 shadow-2xl" style={{
            background: 'linear-gradient(135deg, rgba(42, 212, 210, 0.1) 0%, rgba(59, 231, 174, 0.1) 100%)'
          }}>
            <h3 className="text-3xl font-bold mb-6" style={{ color: '#2D3E3D' }}>
              ¿Listo para planificar estratégicamente?
            </h3>
            <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
              Transforma tu sourcing plan de un Excel a una herramienta estratégica en tiempo real.
            </p>
            <Button
              onClick={handleDemo}
              size="lg"
              className="px-10 py-6 text-lg font-bold rounded-xl shadow-2xl transition-all duration-300"
              style={{
                backgroundColor: '#C6FF00',
                color: '#2D3E3D',
                letterSpacing: '0.05em'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#3BE7AE'
                e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)'
                e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(198, 255, 0, 0.5)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#C6FF00'
                e.currentTarget.style.transform = 'translateY(0) scale(1)'
                e.currentTarget.style.boxShadow = ''
              }}
            >
              Agenda una Demo
              <ArrowRight className="ml-2 h-6 w-6" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 text-center" style={{ backgroundColor: '#1a2625' }}>
        <p className="text-gray-400 text-sm font-medium">
          © 2025 <span style={{ color: '#3BE7AE', fontWeight: 'bold' }}>Xpend™</span> - Marca en trámite INAPI.
        </p>
      </footer>
    </div>
  )
}

