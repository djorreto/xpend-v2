'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Logo } from '@/components/ui/logo'
import {
  FileText,
  Sparkles,
  CheckCircle,
  ArrowRight,
  Zap,
  BookOpen,
  Download,
  Clock,
  Menu,
  X,
  ChevronDown
} from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase'

export default function RFxMakerInfoPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showSolutionsMenu, setShowSolutionsMenu] = useState(false)
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
              }}>RFx Maker</span>
            </h1>
            <p className="text-2xl mb-12 max-w-4xl mx-auto" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
              Crea bases técnicas y administrativas para RFI, RFQ y RFP en minutos, no en semanas.
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
              ¿Cuánto tiempo pierdes creando bases de licitación?
            </h2>
            <div className="max-w-4xl mx-auto space-y-6">
              <p className="text-xl text-gray-700 leading-relaxed">
                Crear una base técnica y administrativa desde cero puede tomar <strong>días o incluso semanas</strong>: buscar especificaciones,
                revisar políticas de la empresa, redactar términos legales, definir criterios de evaluación...
              </p>
              <p className="text-xl text-gray-700 leading-relaxed">
                Y al final, cada área hace su propia versión, sin estandarización ni control de calidad.
              </p>
            </div>
          </div>

          {/* La Solución */}
          <div className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4" style={{ color: '#2D3E3D' }}>
                RFx Maker: De semanas a minutos
              </h2>
              <div className="w-24 h-1.5 mx-auto rounded-full" style={{ background: 'linear-gradient(90deg, #3BE7AE 0%, #2AD4D2 100%)' }}></div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
                <CardContent className="p-8">
                  <div className="p-4 rounded-xl mb-6 inline-block" style={{ backgroundColor: 'rgba(59, 231, 174, 0.15)' }}>
                    <BookOpen className="h-10 w-10" style={{ color: '#3BE7AE' }} />
                  </div>
                  <h3 className="text-2xl font-bold mb-4" style={{ color: '#2D3E3D' }}>Plantillas Inteligentes</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Parte de plantillas predefinidas para RFI, RFQ o RFP según el tipo de compra. Cada plantilla incluye
                    las secciones estándar y mejores prácticas del mercado.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
                <CardContent className="p-8">
                  <div className="p-4 rounded-xl mb-6 inline-block" style={{ backgroundColor: 'rgba(42, 212, 210, 0.15)' }}>
                    <Sparkles className="h-10 w-10" style={{ color: '#2AD4D2' }} />
                  </div>
                  <h3 className="text-2xl font-bold mb-4" style={{ color: '#2D3E3D' }}>IA Generativa</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Describe el contexto de tu proyecto y la IA genera automáticamente la base técnica completa,
                    adaptada a tus necesidades específicas y políticas de la empresa.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
                <CardContent className="p-8">
                  <div className="p-4 rounded-xl mb-6 inline-block" style={{ backgroundColor: 'rgba(59, 231, 174, 0.15)' }}>
                    <FileText className="h-10 w-10" style={{ color: '#3BE7AE' }} />
                  </div>
                  <h3 className="text-2xl font-bold mb-4" style={{ color: '#2D3E3D' }}>Políticas Corporativas</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Las bases se generan respetando automáticamente las políticas administrativas de tu empresa:
                    plazos, garantías, condiciones de pago, criterios de evaluación y cláusulas legales.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
                <CardContent className="p-8">
                  <div className="p-4 rounded-xl mb-6 inline-block" style={{ backgroundColor: 'rgba(42, 212, 210, 0.15)' }}>
                    <Download className="h-10 w-10" style={{ color: '#2AD4D2' }} />
                  </div>
                  <h3 className="text-2xl font-bold mb-4" style={{ color: '#2D3E3D' }}>Exportación Profesional</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Descarga tu documento en formato DOCX o PDF listo para publicar. Incluye formato profesional,
                    índice automático, numeración y estilo corporativo.
                  </p>
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
                  <h4 className="text-xl font-bold mb-2" style={{ color: '#2D3E3D' }}>Selecciona el tipo de RFx</h4>
                  <p className="text-gray-700">Elige entre RFI (Request for Information), RFQ (Request for Quotation) o RFP (Request for Proposal).</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center mr-6 font-bold text-white text-xl" style={{ backgroundColor: '#2AD4D2' }}>
                  2
                </div>
                <div>
                  <h4 className="text-xl font-bold mb-2" style={{ color: '#2D3E3D' }}>Define el contexto del proyecto</h4>
                  <p className="text-gray-700">Ingresa: título, categoría de gasto, presupuesto estimado, departamento solicitante y descripción general de lo que necesitas.</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center mr-6 font-bold text-white text-xl" style={{ backgroundColor: '#3BE7AE' }}>
                  3
                </div>
                <div>
                  <h4 className="text-xl font-bold mb-2" style={{ color: '#2D3E3D' }}>La IA genera la base técnica</h4>
                  <p className="text-gray-700">En segundos, obtienes un documento completo con especificaciones técnicas, alcance, entregables y criterios de evaluación.</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center mr-6 font-bold text-white text-xl" style={{ backgroundColor: '#2AD4D2' }}>
                  4
                </div>
                <div>
                  <h4 className="text-xl font-bold mb-2" style={{ color: '#2D3E3D' }}>Edita y personaliza</h4>
                  <p className="text-gray-700">Revisa el contenido, edita lo que necesites con un editor WYSIWYG, y ajusta los parámetros administrativos.</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center mr-6 font-bold text-white text-xl" style={{ backgroundColor: '#3BE7AE' }}>
                  5
                </div>
                <div>
                  <h4 className="text-xl font-bold mb-2" style={{ color: '#2D3E3D' }}>Descarga y publica</h4>
                  <p className="text-gray-700">Exporta el documento en DOCX o PDF y publícalo en tu plataforma de licitaciones. ¡Listo en minutos!</p>
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
                  <Clock className="h-12 w-12" style={{ color: '#3BE7AE' }} />
                </div>
                <h4 className="text-xl font-bold mb-3" style={{ color: '#2D3E3D' }}>90% menos tiempo</h4>
                <p className="text-gray-700">De semanas a minutos. Reduce drásticamente el tiempo de creación de bases.</p>
              </div>

              <div className="text-center">
                <div className="inline-flex p-4 rounded-xl mb-4" style={{ backgroundColor: 'rgba(42, 212, 210, 0.15)' }}>
                  <CheckCircle className="h-12 w-12" style={{ color: '#2AD4D2' }} />
                </div>
                <h4 className="text-xl font-bold mb-3" style={{ color: '#2D3E3D' }}>Estandarización</h4>
                <p className="text-gray-700">Todas las bases siguen las mismas políticas y formato corporativo.</p>
              </div>

              <div className="text-center">
                <div className="inline-flex p-4 rounded-xl mb-4" style={{ backgroundColor: 'rgba(59, 231, 174, 0.15)' }}>
                  <Zap className="h-12 w-12" style={{ color: '#3BE7AE' }} />
                </div>
                <h4 className="text-xl font-bold mb-3" style={{ color: '#2D3E3D' }}>Calidad profesional</h4>
                <p className="text-gray-700">Documentos completos, bien redactados y listos para publicar.</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center bg-gradient-to-r rounded-2xl p-12 shadow-2xl" style={{
            background: 'linear-gradient(135deg, rgba(42, 212, 210, 0.1) 0%, rgba(59, 231, 174, 0.1) 100%)'
          }}>
            <h3 className="text-3xl font-bold mb-6" style={{ color: '#2D3E3D' }}>
              ¿Listo para acelerar tus licitaciones?
            </h3>
            <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
              Prueba RFx Maker y transforma la forma en que creas bases de licitación.
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

