'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Logo } from '@/components/ui/logo'
import {
  Target,
  Eye,
  Heart,
  Zap,
  Users,
  TrendingUp,
  ArrowRight,
  Menu,
  X,
  ChevronDown
} from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase'

export default function NosotrosPage() {
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
      {/* Header - Elegante con border bottom destacado */}
      <header className="relative z-50 backdrop-blur-md" style={{
        backgroundColor: 'rgba(45, 62, 61, 0.98)',
        borderBottom: '2px solid',
        borderImage: 'linear-gradient(90deg, transparent 0%, #3BE7AE 50%, transparent 100%) 1'
      }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo - Más prominente */}
            <a href="/" className="flex items-center cursor-pointer">
              <Logo size="lg" variant="white" showSlogan={true} />
            </a>

            {/* Desktop Navigation - Elegante */}
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
                    className="absolute top-full left-0 mt-2 w-56 rounded-xl shadow-2xl overflow-hidden"
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

              <a
                href="/nosotros"
                className="text-white/90 font-medium transition-all duration-300"
                onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)'}
              >
                Nosotros
              </a>
              <a
                href="/blog"
                className="text-white/90 font-medium transition-all duration-300"
                onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)'}
              >
                Blog
              </a>
              <a
                href="/faq"
                className="text-white/90 font-medium transition-all duration-300"
                onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)'}
              >
                FAQ
              </a>
            </nav>

            {/* Action Buttons - Elegante */}
            <div className="hidden md:flex items-center space-x-4">
              {isAuthenticated && (
                <Button
                  variant="outline"
                  className="font-medium transition-all duration-300"
                  style={{
                    backgroundColor: 'rgba(100, 116, 139, 0.4)',
                    color: '#f1f5f9',
                    borderColor: 'rgba(241, 245, 249, 0.2)'
                  }}
                  onClick={async () => {
                    const supabase = supabaseBrowser()
                    await supabase.auth.signOut()
                    setIsAuthenticated(false)
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(100, 116, 139, 0.6)'
                    e.currentTarget.style.borderColor = 'rgba(241, 245, 249, 0.4)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(100, 116, 139, 0.4)'
                    e.currentTarget.style.borderColor = 'rgba(241, 245, 249, 0.2)'
                  }}
                >
                  Cerrar Sesión
                </Button>
              )}
              <a href={isAuthenticated ? "/dashboard" : "/login"}>
                <Button
                  className="px-6 py-2.5 rounded-lg font-semibold shadow-lg transition-all duration-300"
                  style={{
                    backgroundColor: '#3BE7AE',
                    color: '#2D3E3D',
                    border: '1px solid rgba(59, 231, 174, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#2AD4D2'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = '0 10px 20px rgba(59, 231, 174, 0.3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#3BE7AE'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = ''
                  }}
                >
                  {isAuthenticated ? "Ir a Xpend" : "Login"}
                </Button>
              </a>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-white"
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden border-t" style={{ backgroundColor: '#2D3E3D', borderTopColor: 'rgba(59, 231, 174, 0.3)' }}>
            <div className="px-2 pt-2 pb-3 space-y-1">
              <div className="px-3 py-2">
                <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#3BE7AE' }}>Soluciones</p>
                <a href="/rfx-maker-info" className="block px-3 py-2 text-white transition-colors" onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'} onMouseLeave={(e) => e.currentTarget.style.color = '#ffffff'}>RFx Maker</a>
                <a href="/sourcing-plan-info" className="block px-3 py-2 text-white transition-colors" onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'} onMouseLeave={(e) => e.currentTarget.style.color = '#ffffff'}>Sourcing Plan</a>
                <a href="/proveedores" className="block px-3 py-2 text-white transition-colors" onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'} onMouseLeave={(e) => e.currentTarget.style.color = '#ffffff'}>Proveedores</a>
              </div>
              <a href="/nosotros" className="block px-3 py-2 text-white transition-colors" onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'} onMouseLeave={(e) => e.currentTarget.style.color = '#ffffff'}>Nosotros</a>
              <a href="/blog" className="block px-3 py-2 text-white transition-colors" onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'} onMouseLeave={(e) => e.currentTarget.style.color = '#ffffff'}>Blog</a>
              <a href="/faq" className="block px-3 py-2 text-white transition-colors" onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'} onMouseLeave={(e) => e.currentTarget.style.color = '#ffffff'}>FAQ</a>
              <div className="px-3 py-2 space-y-2">
                {isAuthenticated && (
                  <Button
                    variant="ghost"
                    className="w-full text-white"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(59, 231, 174, 0.2)'
                      e.currentTarget.style.color = '#3BE7AE'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = '#ffffff'
                    }}
                    onClick={async () => {
                      const supabase = supabaseBrowser()
                      await supabase.auth.signOut()
                      setIsAuthenticated(false)
                    }}
                  >
                    Cerrar Sesión
                  </Button>
                )}
                <a href={isAuthenticated ? "/dashboard" : "/login"} className="block">
                  <Button
                    className="w-full"
                    style={{ backgroundColor: '#3BE7AE', color: '#2D3E3D' }}
                  >
                    {isAuthenticated ? "Ir a Xpend" : "Login"}
                  </Button>
                </a>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-8" style={{ letterSpacing: '-0.02em' }}>
            Sobre <span style={{
              background: 'linear-gradient(135deg, #3BE7AE 0%, #2AD4D2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>Xpend</span>
          </h1>
          <p className="text-2xl mb-12 max-w-4xl mx-auto" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
            Transformando la forma en que las empresas gestionan su Strategic Sourcing
          </p>
        </div>
      </section>

      {/* Separator */}
      <div className="h-20" style={{
        background: 'linear-gradient(to bottom, #1a2625 0%, #f9fafb 100%)'
      }}></div>

      {/* Main Content */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto">
          {/* Nuestra Historia */}
          <div className="mb-20">
            <h2 className="text-4xl font-bold mb-8 text-center" style={{ color: '#2D3E3D' }}>
              Nuestra Historia
            </h2>
            <div className="max-w-4xl mx-auto space-y-6">
              <p className="text-xl text-gray-700 leading-relaxed">
                Detrás de Xpend hay un equipo multidisciplinario con trayectoria en procurement, minería, energía solar y tecnología que vivió de cerca los desafíos de las áreas de abastecimiento: procesos lentos, falta de trazabilidad y escasa integración tecnológica.
              </p>
              <p className="text-xl text-gray-700 leading-relaxed">
                Después de liderar proyectos de optimización de gasto y transformación digital en distintas industrias, entendimos que las empresas necesitan herramientas que combinen tecnología, gestión y estrategia para tomar mejores decisiones de compra.
              </p>
              <p className="text-xl text-gray-700 leading-relaxed">
                Así nació Xpend: una plataforma creada por profesionales que conocen el rubro desde dentro, con la misión de hacer que las compras sean más estratégicas, colaborativas y transparentes, liberando a los equipos de tareas operativas para que puedan enfocarse en generar verdadero valor.
              </p>
            </div>
          </div>

          {/* Misión, Visión, Valores */}
          <div className="grid md:grid-cols-3 gap-8 mb-20">
            {/* Misión */}
            <Card className="backdrop-blur-md border-0 shadow-2xl transition-all duration-300 hover:shadow-3xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
              <CardContent className="p-8 text-center">
                <div className="inline-flex p-4 rounded-xl mb-6" style={{ backgroundColor: 'rgba(42, 212, 210, 0.15)' }}>
                  <Target className="h-12 w-12" style={{ color: '#2AD4D2' }} />
                </div>
                <h3 className="text-2xl font-bold mb-4" style={{ color: '#2D3E3D' }}>Nuestra Misión</h3>
                <p className="text-gray-700 leading-relaxed">
                  Liberar a los equipos de Strategic Sourcing de tareas operativas, permitiéndoles enfocarse en decisiones estratégicas que generen valor real para sus organizaciones.
                </p>
              </CardContent>
            </Card>

            {/* Visión */}
            <Card className="backdrop-blur-md border-0 shadow-2xl transition-all duration-300 hover:shadow-3xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
              <CardContent className="p-8 text-center">
                <div className="inline-flex p-4 rounded-xl mb-6" style={{ backgroundColor: 'rgba(59, 231, 174, 0.15)' }}>
                  <Eye className="h-12 w-12" style={{ color: '#3BE7AE' }} />
                </div>
                <h3 className="text-2xl font-bold mb-4" style={{ color: '#2D3E3D' }}>Nuestra Visión</h3>
                <p className="text-gray-700 leading-relaxed">
                  Ser la plataforma de referencia en Latinoamérica para la gestión de Strategic Sourcing, transformando la manera en que las empresas compran y gestionan sus proveedores.
                </p>
              </CardContent>
            </Card>

            {/* Valores */}
            <Card className="backdrop-blur-md border-0 shadow-2xl transition-all duration-300 hover:shadow-3xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
              <CardContent className="p-8 text-center">
                <div className="inline-flex p-4 rounded-xl mb-6" style={{ backgroundColor: 'rgba(42, 212, 210, 0.15)' }}>
                  <Heart className="h-12 w-12" style={{ color: '#2AD4D2' }} />
                </div>
                <h3 className="text-2xl font-bold mb-4" style={{ color: '#2D3E3D' }}>Nuestros Valores</h3>
                <p className="text-gray-700 leading-relaxed">
                  Innovación constante, transparencia en cada proceso, colaboración con nuestros clientes y compromiso con la excelencia operativa.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Lo que nos hace diferentes */}
          <div className="mb-20">
            <h2 className="text-4xl font-bold mb-12 text-center" style={{ color: '#2D3E3D' }}>
              Lo que nos hace diferentes
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="flex items-start">
                <div className="p-3 rounded-xl mr-4 flex-shrink-0" style={{ backgroundColor: 'rgba(59, 231, 174, 0.15)' }}>
                  <Zap className="h-8 w-8" style={{ color: '#3BE7AE' }} />
                </div>
                <div>
                  <h4 className="text-xl font-bold mb-3" style={{ color: '#2D3E3D' }}>Automatización Inteligente con IA</h4>
                  <p className="text-gray-700">
                    No solo digitalizamos procesos, los inteligentizamos. Nuestra IA analiza patrones, sugiere optimizaciones y automatiza tareas repetitivas para que tu equipo se enfoque en decisiones estratégicas.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="p-3 rounded-xl mr-4 flex-shrink-0" style={{ backgroundColor: 'rgba(42, 212, 210, 0.15)' }}>
                  <Users className="h-8 w-8" style={{ color: '#2AD4D2' }} />
                </div>
                <div>
                  <h4 className="text-xl font-bold mb-3" style={{ color: '#2D3E3D' }}>Diseñado para Latinoamérica</h4>
                  <p className="text-gray-700">
                    Entendemos los desafíos únicos del mercado latinoamericano. Nuestra plataforma se adapta a las normativas locales, integra con sistemas de licitaciones públicas y privadas de la región.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="p-3 rounded-xl mr-4 flex-shrink-0" style={{ backgroundColor: 'rgba(59, 231, 174, 0.15)' }}>
                  <TrendingUp className="h-8 w-8" style={{ color: '#3BE7AE' }} />
                </div>
                <div>
                  <h4 className="text-xl font-bold mb-3" style={{ color: '#2D3E3D' }}>Foco en Resultados Medibles</h4>
                  <p className="text-gray-700">
                    Cada funcionalidad está diseñada para generar ahorros tangibles. Tracking automático de savings, análisis de spend, comparativas de proveedores y reportes ejecutivos que demuestran el valor generado.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="p-3 rounded-xl mr-4 flex-shrink-0" style={{ backgroundColor: 'rgba(42, 212, 210, 0.15)' }}>
                  <Target className="h-8 w-8" style={{ color: '#2AD4D2' }} />
                </div>
                <div>
                  <h4 className="text-xl font-bold mb-3" style={{ color: '#2D3E3D' }}>Colaboración sin Fronteras</h4>
                  <p className="text-gray-700">
                    Conecta equipos de compras, finanzas, operaciones y áreas de negocio en una sola plataforma. Visibilidad compartida, flujos de aprobación configurables y trazabilidad completa de cada decisión.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Nuestro Compromiso */}
          <div className="bg-gradient-to-r rounded-2xl p-12 shadow-2xl text-center" style={{
            background: 'linear-gradient(135deg, rgba(42, 212, 210, 0.1) 0%, rgba(59, 231, 174, 0.1) 100%)'
          }}>
            <h2 className="text-3xl font-bold mb-6" style={{ color: '#2D3E3D' }}>
              Nuestro Compromiso
            </h2>
            <p className="text-xl text-gray-700 mb-8 max-w-3xl mx-auto leading-relaxed">
              Estamos comprometidos con el éxito de nuestros clientes. Esto significa no solo ofrecer una plataforma robusta, sino también acompañarlos en su proceso de transformación digital, entender sus desafíos específicos y evolucionar constantemente para satisfacer sus necesidades.
            </p>
            <div className="flex flex-wrap justify-center gap-8 text-center">
              <div>
                <div className="text-4xl font-bold mb-2" style={{ color: '#3BE7AE' }}>99.9%</div>
                <div className="text-gray-700 font-medium">Uptime garantizado</div>
              </div>
              <div>
                <div className="text-4xl font-bold mb-2" style={{ color: '#2AD4D2' }}>24/7</div>
                <div className="text-gray-700 font-medium">Soporte técnico</div>
              </div>
              <div>
                <div className="text-4xl font-bold mb-2" style={{ color: '#3BE7AE' }}>100%</div>
                <div className="text-gray-700 font-medium">Datos en Chile</div>
              </div>
              <div>
                <div className="text-4xl font-bold mb-2" style={{ color: '#2AD4D2' }}>ISO 27001</div>
                <div className="text-gray-700 font-medium">Certificación en proceso</div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-20">
            <h3 className="text-3xl font-bold mb-6" style={{ color: '#2D3E3D' }}>
              ¿Listo para transformar tu Strategic Sourcing?
            </h3>
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

