'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  ArrowRight,
  CheckCircle,
  BarChart3,
  Users,
  FileText,
  TrendingUp,
  Target,
  Zap,
  Shield,
  Globe,
  ChevronDown,
  Menu,
  X
} from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { supabaseBrowser } from '@/lib/supabase'

export default function HomePage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)



  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const supabase = supabaseBrowser()
    const { data: { session } } = await supabase.auth.getSession()
    setIsAuthenticated(!!session)
  }

  const handleDemo = () => {
    // Aquí podrías agregar lógica para abrir un modal de demo o redirigir
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
            <div className="flex items-center">
              <Logo size="lg" variant="white" />
            </div>

            {/* Desktop Navigation - Elegante */}
            <nav className="hidden md:flex items-center space-x-8">
              <div className="relative group">
                <button
                  className="text-white/90 flex items-center space-x-1 font-medium transition-all duration-300"
                  onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)'}
                >
                  <span>Soluciones</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <a
                href="/proveedores"
                className="text-white/90 font-medium transition-all duration-300"
                onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)'}
              >
                Proveedores
              </a>
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
                  variant="ghost"
                  className="text-white/90 font-medium transition-all duration-300"
                  onClick={async () => {
                    const supabase = supabaseBrowser()
                    await supabase.auth.signOut()
                    setIsAuthenticated(false)
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
                    e.currentTarget.style.color = '#ffffff'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)'
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
          <div className="md:hidden bg-blue-900 border-t border-blue-800">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <a href="#soluciones" className="block px-3 py-2 text-white hover:text-blue-200">Soluciones</a>
              <a href="/proveedores" className="block px-3 py-2 text-white hover:text-blue-200">Proveedores</a>
              <a href="/nosotros" className="block px-3 py-2 text-white hover:text-blue-200">Nosotros</a>
              <a href="/blog" className="block px-3 py-2 text-white hover:text-blue-200">Blog</a>
              <a href="/faq" className="block px-3 py-2 text-white hover:text-blue-200">FAQ</a>
              <div className="px-3 py-2 space-y-2">
                {isAuthenticated && (
                  <Button
                    variant="ghost"
                    className="w-full text-white hover:text-blue-200 hover:bg-blue-800"
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

      {/* Hero Section - Elegante */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left Content */}
            <div className="text-white">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-8" style={{ letterSpacing: '-0.02em' }}>
                Coordina y optimiza tu
                <span style={{
                  background: 'linear-gradient(135deg, #3BE7AE 0%, #2AD4D2 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}> Strategic Sourcing</span> con IA
              </h1>
              <p className="text-xl mb-10 leading-relaxed" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                Libera a tu área de Strategic Sourcing de tareas operativas, desde el análisis de categorías hasta la gestión de proyectos, conectándola con el negocio para tomar decisiones más estratégicas.
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
                  e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(198, 255, 0, 0.4)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#C6FF00'
                  e.currentTarget.style.transform = 'translateY(0) scale(1)'
                  e.currentTarget.style.boxShadow = ''
                }}
              >
                AGENDAR DEMO
                <ArrowRight className="ml-2 h-6 w-6" />
              </Button>
            </div>

            {/* Right Content - Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Análisis de Categorías */}
              <Card className="backdrop-blur-md border-0 shadow-2xl transition-all duration-300 hover:shadow-3xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
                <CardContent className="p-6">
                  <div className="flex items-center mb-5">
                    <div className="p-3 rounded-xl mr-4" style={{ backgroundColor: 'rgba(42, 212, 210, 0.15)' }}>
                      <BarChart3 className="h-6 w-6" style={{ color: '#2AD4D2' }} />
                    </div>
                    <h3 className="text-lg font-bold" style={{ color: '#2D3E3D' }}>Análisis de Categorías</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Tecnología</span>
                      <span className="text-sm font-bold" style={{ color: '#3BE7AE' }}>$850K</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Servicios</span>
                      <span className="text-sm font-bold" style={{ color: '#3BE7AE' }}>$620K</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Suministros</span>
                      <span className="text-sm font-bold" style={{ color: '#3BE7AE' }}>$480K</span>
                    </div>
                    <div className="w-full rounded-full h-2.5" style={{ backgroundColor: 'rgba(45, 62, 61, 0.1)' }}>
                      <div className="h-2.5 rounded-full transition-all duration-500" style={{width: '75%', background: 'linear-gradient(90deg, #3BE7AE 0%, #2AD4D2 100%)'}}></div>
                    </div>
                    <p className="text-xs font-medium text-gray-500 pt-1">Ahorro potencial identificado</p>
                  </div>
                </CardContent>
              </Card>

              {/* Gestión de Proyectos */}
              <Card className="backdrop-blur-md border-0 shadow-2xl transition-all duration-300 hover:shadow-3xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
                <CardContent className="p-6">
                  <div className="flex items-center mb-5">
                    <div className="p-3 rounded-xl mr-4" style={{ backgroundColor: 'rgba(59, 231, 174, 0.15)' }}>
                      <Target className="h-6 w-6" style={{ color: '#3BE7AE' }} />
                    </div>
                    <h3 className="text-lg font-bold" style={{ color: '#2D3E3D' }}>Proyectos Activos</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: '#3BE7AE' }}></div>
                      <span className="text-sm font-medium text-gray-700">Modernización IT</span>
                      <span className="ml-auto text-sm font-bold text-gray-900">65%</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: '#2AD4D2' }}></div>
                      <span className="text-sm font-medium text-gray-700">Optimización Proveedores</span>
                      <span className="ml-auto text-sm font-bold text-gray-900">100%</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: '#C6FF00' }}></div>
                      <span className="text-sm font-medium text-gray-700">Implementación ERP</span>
                      <span className="ml-auto text-sm font-bold text-gray-900">30%</span>
                    </div>
                    <div className="w-full rounded-full h-2.5" style={{ backgroundColor: 'rgba(45, 62, 61, 0.1)' }}>
                      <div className="h-2.5 rounded-full transition-all duration-500" style={{width: '65%', backgroundColor: '#2AD4D2'}}></div>
                    </div>
                    <p className="text-xs font-medium text-gray-500 pt-1">Progreso promedio</p>
                  </div>
                </CardContent>
              </Card>

              {/* Estadísticas */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between backdrop-blur-md rounded-xl p-6 shadow-2xl transition-all duration-300 hover:shadow-3xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
                  <div className="flex items-center">
                    <div className="p-3 rounded-xl mr-4" style={{ backgroundColor: 'rgba(59, 231, 174, 0.15)' }}>
                      <TrendingUp className="h-8 w-8" style={{ color: '#3BE7AE' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Monto Ahorrado</p>
                      <p className="text-3xl font-bold" style={{ color: '#2D3E3D' }}>$2.45M</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-700">+12 proyectos</p>
                    <div className="flex items-center mt-2 justify-end">
                      <Target className="h-4 w-4 mr-2" style={{ color: '#2AD4D2' }} />
                      <span className="text-xs font-medium text-gray-600">activos</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Separator elegante */}
      <div className="h-20" style={{
        background: 'linear-gradient(to bottom, #1a2625 0%, #f9fafb 100%)'
      }}></div>

      {/* Services Section - Elegante */}
      <section id="soluciones" className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold mb-6" style={{ color: '#2D3E3D', letterSpacing: '-0.02em' }}>
              CONOCE NUESTROS SERVICIOS
            </h2>
            <div className="w-24 h-1.5 mx-auto rounded-full" style={{ background: 'linear-gradient(90deg, #3BE7AE 0%, #2AD4D2 100%)' }}></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left Content */}
            <div>
              <h3 className="text-4xl font-bold mb-6" style={{ color: '#2D3E3D' }}>
                Xpend Strategic Sourcing
              </h3>
              <h4 className="text-2xl font-semibold mb-8" style={{ color: '#2AD4D2' }}>
                Tu centro de coordinación para Strategic Sourcing
              </h4>
              <p className="text-lg text-gray-700 mb-10 leading-relaxed">
                Coordina y optimiza cada etapa de tu proceso de Strategic Sourcing, desde el análisis de categorías hasta la gestión de proyectos, con visibilidad total del negocio y análisis impulsado por IA.
              </p>

              <div className="space-y-6">
                <div className="flex items-start group">
                  <div className="p-2 rounded-lg mr-4 transition-all duration-300" style={{ backgroundColor: 'rgba(59, 231, 174, 0.15)' }}>
                    <CheckCircle className="h-6 w-6" style={{ color: '#3BE7AE' }} />
                  </div>
                  <div>
                    <h5 className="font-bold text-lg mb-2" style={{ color: '#2D3E3D' }}>Análisis de Categorías</h5>
                    <p className="text-gray-600">Clasificación inteligente y análisis de gastos por categoría con insights de ahorro.</p>
                  </div>
                </div>
                <div className="flex items-start group">
                  <div className="p-2 rounded-lg mr-4 transition-all duration-300" style={{ backgroundColor: 'rgba(42, 212, 210, 0.15)' }}>
                    <CheckCircle className="h-6 w-6" style={{ color: '#2AD4D2' }} />
                  </div>
                  <div>
                    <h5 className="font-bold text-lg mb-2" style={{ color: '#2D3E3D' }}>Plan de Compras</h5>
                    <p className="text-gray-600">Planificación estratégica y seguimiento de proyectos de sourcing con hitos y dependencias.</p>
                  </div>
                </div>
                <div className="flex items-start group">
                  <div className="p-2 rounded-lg mr-4 transition-all duration-300" style={{ backgroundColor: 'rgba(59, 231, 174, 0.15)' }}>
                    <CheckCircle className="h-6 w-6" style={{ color: '#3BE7AE' }} />
                  </div>
                  <div>
                    <h5 className="font-bold text-lg mb-2" style={{ color: '#2D3E3D' }}>Gestión de Proyectos</h5>
                    <p className="text-gray-600">Coordinación de equipos y seguimiento de iniciativas de Strategic Sourcing.</p>
                  </div>
                </div>
                <div className="flex items-start group">
                  <div className="p-2 rounded-lg mr-4 transition-all duration-300" style={{ backgroundColor: 'rgba(42, 212, 210, 0.15)' }}>
                    <CheckCircle className="h-6 w-6" style={{ color: '#2AD4D2' }} />
                  </div>
                  <div>
                    <h5 className="font-bold text-lg mb-2" style={{ color: '#2D3E3D' }}>Integración con Herramientas</h5>
                    <p className="text-gray-600">Conecta con plataformas de licitaciones RFP/RFQ y herramientas de sourcing existentes.</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleDemo}
                className="mt-10 px-8 py-4 rounded-xl font-bold text-lg shadow-xl transition-all duration-300"
                style={{ backgroundColor: '#3BE7AE', color: '#2D3E3D' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2AD4D2'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 20px 40px rgba(59, 231, 174, 0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#3BE7AE'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = ''
                }}
              >
                Ver más de Xpend Strategic Sourcing
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            {/* Right Content - Demo Table */}
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center">
                  <Logo size="sm" />
                </div>
                <Menu className="h-5 w-5 text-gray-400" />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Análisis de Categorías
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tecnología
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Servicios
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Suministros
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Marketing
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        Gasto Total
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">$850K</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">$620K</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">$480K</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">$320K</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        Ahorro Potencial
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">$75K</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">$45K</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">$25K</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">$15K</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        Proveedores
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">12</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">8</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">15</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">6</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        Proyectos Activos
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                          <span className="text-sm text-gray-900">3</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                          <span className="text-sm text-gray-900">2</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                          <span className="text-sm text-gray-900">1</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                          <span className="text-sm text-gray-900">0</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Elegante */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold mb-6" style={{ color: '#2D3E3D', letterSpacing: '-0.02em' }}>
              ¿Por qué elegir Xpend?
            </h2>
            <div className="w-24 h-1.5 mx-auto mb-6 rounded-full" style={{ background: 'linear-gradient(90deg, #3BE7AE 0%, #2AD4D2 100%)' }}></div>
            <p className="text-xl font-medium text-gray-600">
              La plataforma de coordinación que tu equipo de Strategic Sourcing necesita
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            <div className="text-center group">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 transition-all duration-300 shadow-lg group-hover:shadow-2xl" style={{ backgroundColor: 'rgba(42, 212, 210, 0.15)' }}>
                <Zap className="h-10 w-10" style={{ color: '#2AD4D2' }} />
              </div>
              <h3 className="text-2xl font-bold mb-4" style={{ color: '#2D3E3D' }}>Automatización Inteligente</h3>
              <p className="text-gray-600 leading-relaxed">Automatiza tareas repetitivas y enfócate en decisiones estratégicas con IA.</p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 transition-all duration-300 shadow-lg group-hover:shadow-2xl" style={{ backgroundColor: 'rgba(59, 231, 174, 0.15)' }}>
                <Shield className="h-10 w-10" style={{ color: '#3BE7AE' }} />
              </div>
              <h3 className="text-2xl font-bold mb-4" style={{ color: '#2D3E3D' }}>Seguridad Empresarial</h3>
              <p className="text-gray-600 leading-relaxed">Datos seguros con encriptación de nivel empresarial y cumplimiento normativo.</p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 transition-all duration-300 shadow-lg group-hover:shadow-2xl" style={{ backgroundColor: 'rgba(42, 212, 210, 0.15)' }}>
                <Globe className="h-10 w-10" style={{ color: '#2AD4D2' }} />
              </div>
              <h3 className="text-2xl font-bold mb-4" style={{ color: '#2D3E3D' }}>Integración Total</h3>
              <p className="text-gray-600 leading-relaxed">Se integra con tus herramientas existentes de sourcing y licitaciones.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Elegante */}
      <section className="py-28 px-4 sm:px-6 lg:px-8 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #2D3E3D 0%, #1a2625 100%)' }}>
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #3BE7AE 0%, transparent 70%)' }}></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #2AD4D2 0%, transparent 70%)' }}></div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-8" style={{ letterSpacing: '-0.02em' }}>
            ¿Listo para optimizar tu <span style={{
              background: 'linear-gradient(135deg, #3BE7AE 0%, #2AD4D2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>Strategic Sourcing</span>?
          </h2>
          <p className="text-2xl mb-12" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
            Únete a las empresas que ya están transformando su gestión de compras estratégicas
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
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
              Agendar Demo Gratuita
              <ArrowRight className="ml-2 h-6 w-6" />
            </Button>
            <a href={isAuthenticated ? "/dashboard" : "/login"}>
              <Button
                variant="outline"
                size="lg"
                className="px-10 py-6 text-lg font-bold rounded-xl transition-all duration-300"
                style={{
                  borderColor: '#3BE7AE',
                  color: '#3BE7AE',
                  borderWidth: '2px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#3BE7AE'
                  e.currentTarget.style.color = '#2D3E3D'
                  e.currentTarget.style.transform = 'translateY(-3px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = '#3BE7AE'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                {isAuthenticated ? "Ir a Dashboard" : "Acceder a la Plataforma"}
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer - Elegante */}
      <footer className="py-16 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#1a2625' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div>
              <Logo size="md" variant="white" />
              <p className="mt-6 text-gray-400 leading-relaxed">
                La plataforma de coordinación para Strategic Sourcing que tu equipo necesita.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-6 text-white">Producto</h3>
              <ul className="space-y-3 text-gray-400">
                <li>
                  <a
                    href="#"
                    className="transition-colors duration-200"
                    onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'}
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                  >
                    Características
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="transition-colors duration-200"
                    onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'}
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                  >
                    Precios
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="transition-colors duration-200"
                    onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'}
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                  >
                    Integraciones
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="transition-colors duration-200"
                    onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'}
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                  >
                    API
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-6 text-white">Empresa</h3>
              <ul className="space-y-3 text-gray-400">
                <li>
                  <a
                    href="#"
                    className="transition-colors duration-200"
                    onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'}
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                  >
                    Nosotros
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="transition-colors duration-200"
                    onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'}
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                  >
                    Carreras
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="transition-colors duration-200"
                    onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'}
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                  >
                    Blog
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="transition-colors duration-200"
                    onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'}
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                  >
                    Contacto
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-6 text-white">Soporte</h3>
              <ul className="space-y-3 text-gray-400">
                <li>
                  <a
                    href="#"
                    className="transition-colors duration-200"
                    onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'}
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                  >
                    Centro de Ayuda
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="transition-colors duration-200"
                    onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'}
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                  >
                    Documentación
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="transition-colors duration-200"
                    onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'}
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                  >
                    Estado del Sistema
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="transition-colors duration-200"
                    onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'}
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                  >
                    Comunidad
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-10 flex flex-col md:flex-row justify-between items-center" style={{ borderTopColor: 'rgba(59, 231, 174, 0.2)' }}>
            <p className="text-gray-400 text-sm font-medium">
              © 2025 <span style={{ color: '#3BE7AE', fontWeight: 'bold' }}>xpend.cl</span> - Todos los derechos reservados.
            </p>
            <div className="flex space-x-8 mt-4 md:mt-0">
              <a
                href="#"
                className="text-gray-400 text-sm font-medium transition-colors duration-200"
                onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'}
                onMouseLeave={(e) => e.currentTarget.style.color = ''}
              >
                Privacidad
              </a>
              <a
                href="#"
                className="text-gray-400 text-sm font-medium transition-colors duration-200"
                onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'}
                onMouseLeave={(e) => e.currentTarget.style.color = ''}
              >
                Términos
              </a>
              <a
                href="#"
                className="text-gray-400 text-sm font-medium transition-colors duration-200"
                onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'}
                onMouseLeave={(e) => e.currentTarget.style.color = ''}
              >
                Cookies
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
