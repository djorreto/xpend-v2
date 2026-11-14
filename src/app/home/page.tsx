'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  ArrowRight,
  CheckCircle,
  BarChart3,
  TrendingUp,
  Target,
  Zap,
  ChevronDown,
  Menu,
  X,
  Package,
  ClipboardList,
  DollarSign,
  FileEdit,
  Sparkles,
  Brain,
  Gavel,
  Scale
} from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { supabaseBrowser } from '@/lib/supabase'

export default function HomePage() {
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

  const solutions = [
    { href: '/home#inteligencia', label: 'Sourcing Intelligence' },
    { href: '/sourcing-plan-info', label: 'Sourcing Plan' },
    { href: '/rfx-maker-info', label: 'RFx Maker' },
    { href: '/home#licitaciones', label: 'Licitaciones' },
    { href: '/home#sala', label: 'Sala de Ofertas' },
    { href: '/home#comite', label: 'Comité' },
    { href: '/proveedores', label: 'Proveedores' },
  ]

  const flow = [
    {
      step: '01',
      module: 'Sourcing Intelligence',
      icon: Brain,
      opera: 'El gasto entra en Excel o CSV. ANA propone la categoría de cada línea y la matriz de Kraljic separa lo que conviene negociar de lo que solo hay que comprar bien.',
      valor: 'Un gasto por moneda. Pesos y dólares no se suman. El comité parte de ese número.',
    },
    {
      step: '02',
      module: 'Sourcing Plan',
      icon: Target,
      opera: 'El año se abre en iniciativas. Cada una tiene trimestre, dueño y ahorro proyectado. Si el trimestre vence sin licitación, aparece en la cola del día.',
      valor: 'Se ve qué se va a correr, quién responde y qué meta de ahorro está comprometida.',
    },
    {
      step: '03',
      module: 'RFx Maker',
      icon: FileEdit,
      opera: 'ANA redacta las bases de un RFI, RFQ o RFP a partir de la iniciativa. El documento se exporta para publicarlo.',
      valor: 'Las bases salen del mismo expediente que el plan. No empiezan en un archivo aparte.',
    },
    {
      step: '04',
      module: 'Licitaciones',
      icon: Gavel,
      opera: 'Se fija la línea base, se invita a proveedores con evaluación vigente y un jefe aprueba publicar o adjudicar. Al guardar el monto adjudicado, el ahorro se calcula solo.',
      valor: 'Base menos adjudicado queda en la iniciativa. El plan no cuenta dos veces el mismo ahorro.',
    },
    {
      step: '05',
      module: 'Sala de Ofertas',
      icon: Scale,
      opera: 'El proveedor entra con su usuario. El comprador elige cómo se compite: sobre cerrado, varias rondas, subasta inversa o tabla de adhesión.',
      valor: 'La oferta ocurre dentro del proceso. El precio no depende de un correo.',
    },
    {
      step: '06',
      module: 'Comité',
      icon: ClipboardList,
      opera: 'Cada mes se lee el gasto, las iniciativas atrasadas y el ahorro comprometido contra el adjudicado.',
      valor: 'La reunión explica un resultado. El número ya viene armado.',
    },
  ]

  const enterApp = () => {
    window.location.href = isAuthenticated ? '/dashboard' : '/login'
  }

  return (
    <div className="relative min-h-screen" style={{ background: 'linear-gradient(135deg, #1a2625 0%, #2D3E3D 50%, #1a2625 100%)' }}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[920px] overflow-hidden">
        <div className="absolute -left-16 top-24 h-80 w-80 rounded-full bg-[#3BE7AE]/30 blur-3xl" />
        <div className="absolute right-[-4%] top-36 h-96 w-96 rounded-full bg-[#2AD4D2]/25 blur-3xl" />
        <div className="absolute left-1/3 top-8 h-64 w-64 rounded-full bg-[#C6FF00]/15 blur-3xl" />
      </div>
      {/* Header */}
      <header className="relative z-50 border-b border-white/10 pt-[env(safe-area-inset-top)] backdrop-blur-xl" style={{
        backgroundColor: 'rgba(45, 62, 61, 0.55)'
      }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo - Más prominente */}
            <a href="/" className="flex items-center cursor-pointer">
              <span className="md:hidden"><Logo size="sm" variant="white" /></span>
              <span className="hidden md:block"><Logo size="lg" variant="white" showSlogan={true} /></span>
            </a>

            {/* Desktop Navigation - Elegante */}
            <nav className="hidden md:flex items-center space-x-7 text-[13px]">
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
                    className="absolute top-full left-0 mt-2 w-72 overflow-hidden rounded-2xl border border-white/15 shadow-2xl backdrop-blur-xl"
                    style={{
                      backgroundColor: 'rgba(45, 62, 61, 0.72)'
                    }}
                  >
                    {solutions.map((item) => (
                      <a
                        key={item.href}
                        href={item.href}
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
                        {item.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <a
                href="/home#flujo"
                className="text-white/90 font-medium transition-all duration-300"
                onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)'}
              >
                Flujo
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
                  variant="outline"
                  className="px-6 py-2.5 rounded-lg font-semibold shadow-lg transition-all duration-300"
                  style={{
                    backgroundColor: 'rgba(100, 116, 139, 0.4)',
                    borderColor: 'rgba(148, 163, 184, 0.5)',
                    color: '#f1f5f9',
                    borderWidth: '2px'
                  }}
                  onClick={async () => {
                    const supabase = supabaseBrowser()
                    await supabase.auth.signOut()
                    setIsAuthenticated(false)
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(100, 116, 139, 0.6)'
                    e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.8)'
                    e.currentTarget.style.color = '#ffffff'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(100, 116, 139, 0.4)'
                    e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.5)'
                    e.currentTarget.style.color = '#f1f5f9'
                    e.currentTarget.style.transform = 'translateY(0)'
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
          <div className="border-t border-white/10 backdrop-blur-xl md:hidden" style={{ backgroundColor: 'rgba(45, 62, 61, 0.72)' }}>
            <div className="px-2 pt-2 pb-3 space-y-1">
              <div className="px-3 py-2">
                <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#3BE7AE' }}>Soluciones</p>
                {solutions.map((item) => (
                  <a key={item.href} href={item.href} className="block px-3 py-2 text-white transition-colors" onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'} onMouseLeave={(e) => e.currentTarget.style.color = '#ffffff'}>{item.label}</a>
                ))}
              </div>
              <a href="/home#flujo" className="block px-3 py-2 text-white transition-colors" onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'} onMouseLeave={(e) => e.currentTarget.style.color = '#ffffff'}>Flujo</a>
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

      {/* Hero Section - Elegante */}
      <section className="relative z-10 px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left Content */}
            <div className="text-white">
              <h1 className="mb-4 text-4xl font-medium leading-[1.12] tracking-tight md:text-5xl lg:text-[3.4rem]">
                Del control operativo a la
                <span style={{
                  background: 'linear-gradient(135deg, #3BE7AE 0%, #2AD4D2 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}> gestión estratégica</span> del procurement.
              </h1>
              <p className="mb-10 max-w-xl text-base leading-relaxed md:text-lg" style={{ color: 'rgba(255, 255, 255, 0.82)' }}>
                Del archivo de gasto al plan, las bases, la licitación y la sala donde oferta el proveedor. El comité ve el ahorro. El ERP sigue pagando.
              </p>
              <Button
                onClick={enterApp}
                size="lg"
                className="rounded-xl px-8 py-5 text-sm font-medium tracking-wide shadow-lg transition-all duration-300"
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
                {isAuthenticated ? 'IR A XPEND' : 'ENTRAR A XPEND'}
                <ArrowRight className="ml-2 h-6 w-6" />
              </Button>
            </div>

            {/* Right Content - Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Análisis de Categorías */}
              <Card className="transition-all duration-300 hover:-translate-y-1 hover:bg-white/90">
                <CardContent className="p-5">
                  <div className="flex items-center mb-5">
                    <div className="p-2.5 rounded-xl mr-3" style={{ backgroundColor: 'rgba(42, 212, 210, 0.18)' }}>
                      <BarChart3 className="h-4 w-4" style={{ color: '#2AD4D2' }} />
                    </div>
                    <h3 className="text-[13px] font-medium tracking-wide" style={{ color: '#2D3E3D' }}>Análisis de Categorías</h3>
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

              {/* Iniciativas del plan */}
              <Card className="transition-all duration-300 hover:-translate-y-1 hover:bg-white/90">
                <CardContent className="p-5">
                  <div className="flex items-center mb-5">
                    <div className="p-2.5 rounded-xl mr-3" style={{ backgroundColor: 'rgba(59, 231, 174, 0.2)' }}>
                      <Target className="h-4 w-4" style={{ color: '#1f8f72' }} />
                    </div>
                    <h3 className="text-[13px] font-medium tracking-wide" style={{ color: '#2D3E3D' }}>Iniciativas del plan</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: '#3BE7AE' }}></div>
                      <span className="text-sm font-medium text-gray-700">Transporte 2026</span>
                      <span className="ml-auto text-sm font-bold text-gray-900">En curso</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: '#2AD4D2' }}></div>
                      <span className="text-sm font-medium text-gray-700">Servicios de TI</span>
                      <span className="ml-auto text-sm font-bold text-gray-900">Bases</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: '#C6FF00' }}></div>
                      <span className="text-sm font-medium text-gray-700">Útiles de oficina</span>
                      <span className="ml-auto text-sm font-bold text-gray-900">Adjudicada</span>
                    </div>
                    <div className="w-full rounded-full h-2.5" style={{ backgroundColor: 'rgba(45, 62, 61, 0.1)' }}>
                      <div className="h-2.5 rounded-full transition-all duration-500" style={{width: '65%', backgroundColor: '#2AD4D2'}}></div>
                    </div>
                    <p className="text-xs font-medium text-gray-500 pt-1">Del plan a la adjudicación</p>
                  </div>
                </CardContent>
              </Card>

              {/* Estadísticas */}
              <div className="md:col-span-2">
                <div className="glass-card flex items-center justify-between p-5 transition-all duration-300 hover:-translate-y-1">
                  <div className="flex items-center">
                    <div className="p-3 rounded-xl mr-4" style={{ backgroundColor: 'rgba(59, 231, 174, 0.15)' }}>
                      <TrendingUp className="h-8 w-8" style={{ color: '#3BE7AE' }} />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-petrol-blue/50">Monto ahorrado</p>
                      <p className="text-2xl font-medium tracking-tight" style={{ color: '#2D3E3D' }}>$2.45M</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-700">3 licitaciones</p>
                    <div className="flex items-center mt-2 justify-end">
                      <Target className="h-4 w-4 mr-2" style={{ color: '#2AD4D2' }} />
                      <span className="text-xs font-medium text-gray-600">adjudicadas</span>
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
        background: 'linear-gradient(to bottom, #1a2625 0%, #e7efed 100%)'
      }}></div>

      {/* El Problema Section */}
      <section className="home-wash px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="mb-5 text-3xl font-medium tracking-tight md:text-4xl" style={{ color: '#2D3E3D' }}>
              Las herramientas actuales procesan, pero no controlan.
            </h2>
            <div className="w-24 h-1.5 mx-auto mb-6 rounded-full" style={{ background: 'linear-gradient(90deg, #3BE7AE 0%, #2AD4D2 100%)' }}></div>
            <p className="text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
              Plataformas como Ariba, Coupa o WherEX automatizan órdenes, aprobaciones y licitaciones, pero dejan fuera lo más importante: la gestión estratégica y el control real del desempeño del procurement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="transition-all duration-300 hover:-translate-y-1" style={{ borderColor: 'rgba(225, 91, 100, 0.28)' }}>
              <CardContent className="p-8">
                <div className="flex items-start">
                  <div className="p-3 rounded-xl mr-4" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                    <ClipboardList className="h-6 w-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-2" style={{ color: '#2D3E3D' }}>Planes dispersos</h3>
                    <p className="text-gray-600 text-sm">Planes de compras dispersos y sin trazabilidad.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="transition-all duration-300 hover:-translate-y-1" style={{ borderColor: 'rgba(225, 91, 100, 0.28)' }}>
              <CardContent className="p-8">
                <div className="flex items-start">
                  <div className="p-3 rounded-xl mr-4" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                    <DollarSign className="h-6 w-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-2" style={{ color: '#2D3E3D' }}>Gasto sin análisis</h3>
                    <p className="text-gray-600 text-sm">Gasto sin análisis ni categorización inteligente.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="transition-all duration-300 hover:-translate-y-1" style={{ borderColor: 'rgba(225, 91, 100, 0.28)' }}>
              <CardContent className="p-8">
                <div className="flex items-start">
                  <div className="p-3 rounded-xl mr-4" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                    <Target className="h-6 w-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold mb-2" style={{ color: '#2D3E3D' }}>Poca visibilidad</h3>
                    <p className="text-gray-600 text-sm">Poca visibilidad sobre iniciativas, plazos y oportunidades de ahorro.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Separator */}
      <div className="h-20" style={{
        background: 'linear-gradient(to bottom, #e7efed 0%, #f4f8f7 100%)'
      }}></div>

      {/* La Solución Section */}
      <section id="gestion" className="home-wash px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="mb-5 text-3xl font-medium tracking-tight md:text-4xl" style={{ color: '#2D3E3D' }}>
              Xpend: la capa que transforma datos en gestión.
            </h2>
            <div className="w-24 h-1.5 mx-auto mb-6 rounded-full" style={{ background: 'linear-gradient(90deg, #3BE7AE 0%, #2AD4D2 100%)' }}></div>
            <p className="text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed mb-6">
              Xpend toma el gasto que ya tienes, en Excel o CSV, y lo convierte en el trabajo del área:
            </p>
            <ul className="text-left text-lg text-gray-700 max-w-3xl mx-auto space-y-3 mb-8">
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 mr-3 mt-1 flex-shrink-0" style={{ color: '#3BE7AE' }} />
                <span>Clasifica el gasto con IA y arma la matriz de Kraljic.</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 mr-3 mt-1 flex-shrink-0" style={{ color: '#3BE7AE' }} />
                <span>Lleva el plan anual: dueño, plazo y ahorro proyectado.</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 mr-3 mt-1 flex-shrink-0" style={{ color: '#3BE7AE' }} />
                <span>Redacta las bases, publica la licitación y adjudica.</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 mr-3 mt-1 flex-shrink-0" style={{ color: '#3BE7AE' }} />
                <span>El proveedor oferta en la sala. El comité cierra el mes.</span>
              </li>
            </ul>
            <p className="text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
              Sobre cerrado, varias rondas, subasta inversa o tabla de adhesión. <strong>Del gasto a la adjudicación, en el mismo entorno.</strong>
            </p>
          </div>

          <div id="flujo" className="scroll-mt-24 mb-20">
            <div className="text-center mb-10">
              <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em]" style={{ color: '#2AD4D2' }}>Operación</p>
              <h3 className="mb-4 text-3xl font-medium tracking-tight md:text-4xl" style={{ color: '#2D3E3D' }}>
                Flujo operacional de Xpend
              </h3>
              <p className="mx-auto max-w-2xl text-base leading-relaxed text-gray-600">
                Seis pasos. Cada módulo entrega un dato que el siguiente usa, hasta que el comité ve el ahorro.
              </p>
            </div>

            <div className="mb-8 flex gap-2 overflow-x-auto pb-1">
              {flow.map((item) => (
                <a
                  key={item.step}
                  href={`#flujo-${item.step}`}
                  className="shrink-0 rounded-full border border-white/70 bg-white/60 px-3 py-1.5 text-[12px] font-medium text-petrol-blue/80"
                >
                  {item.step} {item.module}
                </a>
              ))}
            </div>

            <div className="space-y-4">
              {flow.map((item) => {
                const Icon = item.icon
                return (
                  <article
                    id={`flujo-${item.step}`}
                    key={item.step}
                    className="scroll-mt-24 grid gap-4 rounded-[1.15rem] border border-white/70 bg-white/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] md:grid-cols-[220px_1fr_1fr] md:p-6"
                  >
                    <div className="flex items-center gap-3 md:flex-col md:items-start">
                      <span className="text-[11px] font-medium tracking-[0.16em]" style={{ color: '#2AD4D2' }}>{item.step}</span>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(42, 212, 210, 0.15)' }}>
                        <Icon className="h-5 w-5" style={{ color: '#2AD4D2' }} />
                      </div>
                      <h4 className="text-lg font-medium tracking-tight" style={{ color: '#2D3E3D' }}>{item.module}</h4>
                    </div>
                    <div>
                      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-petrol-blue/45">Cómo opera</p>
                      <p className="text-sm leading-relaxed text-gray-600">{item.opera}</p>
                    </div>
                    <div className="rounded-2xl px-4 py-4" style={{ background: 'linear-gradient(160deg, #314846 0%, #243230 100%)' }}>
                      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: '#3BE7AE' }}>Valor</p>
                      <p className="text-sm leading-relaxed text-white/85">{item.valor}</p>
                    </div>
                  </article>
                )
              })}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/70 bg-white/55 px-4 py-4">
                <p className="mb-1 text-sm font-medium" style={{ color: '#2D3E3D' }}>Proveedores</p>
                <p className="text-sm leading-relaxed text-gray-600">Ficha, categoría y evaluación. Sin evaluación vigente, la licitación no invita.</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/55 px-4 py-4">
                <p className="mb-1 text-sm font-medium" style={{ color: '#2D3E3D' }}>Spend y reportes</p>
                <p className="text-sm leading-relaxed text-gray-600">Leen el mismo gasto, cortado por categoría, proveedor y período, siempre en su moneda.</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/55 px-4 py-4">
                <p className="mb-1 text-sm font-medium" style={{ color: '#2D3E3D' }}>ANA</p>
                <p className="text-sm leading-relaxed text-gray-600">Clasifica el archivo, redacta las bases y responde en el chat de compras.</p>
              </div>
            </div>
          </div>

          <div className="text-center mb-20 mt-16">
            <h3 className="mb-4 text-2xl font-medium tracking-tight" style={{ color: '#2D3E3D' }}>
              Lo que incluye
            </h3>
          </div>

          {/* Grid de Módulos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            <Card id="inteligencia" className="transition-all duration-300 hover:-translate-y-1 group scroll-mt-24">
              <CardContent className="p-8">
                <div className="p-4 rounded-xl mb-6 inline-block" style={{ backgroundColor: 'rgba(42, 212, 210, 0.15)' }}>
                  <Brain className="h-8 w-8" style={{ color: '#2AD4D2' }} />
                </div>
                <h3 className="mb-3 text-xl font-medium tracking-tight" style={{ color: '#2D3E3D' }}>Sourcing Intelligence</h3>
                <p className="text-gray-600 mb-4">
                  Subes el gasto en Excel o CSV. La IA lo clasifica y la matriz de Kraljic muestra dónde está el dinero.
                </p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Carga Excel y CSV
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Clasificación con IA
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Matriz de Kraljic
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="transition-all duration-300 hover:-translate-y-1 group">
              <CardContent className="p-8">
                <div className="p-4 rounded-xl mb-6 inline-block" style={{ backgroundColor: 'rgba(42, 212, 210, 0.15)' }}>
                  <Target className="h-8 w-8" style={{ color: '#2AD4D2' }} />
                </div>
                <h3 className="mb-3 text-xl font-medium tracking-tight" style={{ color: '#2D3E3D' }}>Sourcing Plan</h3>
                <p className="text-gray-600 mb-4">
                  El plan del año: cada iniciativa tiene dueño, plazo y ahorro proyectado. Al adjudicar, el ahorro comprometido queda en la misma ficha.
                </p>
                <ul className="space-y-2 text-sm text-gray-600 mb-6">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Año, trimestre y dueño
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Ahorro proyectado y realizado
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Ligada a la licitación
                  </li>
                </ul>
                <a href="/sourcing-plan-info">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full font-semibold transition-all duration-300 group-hover:bg-[#2AD4D2] group-hover:text-white group-hover:border-[#2AD4D2]"
                    style={{ borderColor: '#2AD4D2', color: '#2AD4D2' }}
                  >
                    Conocer más <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
              </CardContent>
            </Card>

            {/* RFx Maker */}
            <Card className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-4 right-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(198, 255, 0, 0.2)', color: '#2D3E3D' }}>
                <Sparkles className="h-3 w-3 mr-1" />
                BETA
              </div>
              <CardContent className="p-8">
                <div className="p-4 rounded-xl mb-6 inline-block" style={{ backgroundColor: 'rgba(59, 231, 174, 0.15)' }}>
                  <FileEdit className="h-8 w-8" style={{ color: '#3BE7AE' }} />
                </div>
                <h3 className="mb-3 text-xl font-medium tracking-tight" style={{ color: '#2D3E3D' }}>RFx Maker</h3>
                <p className="text-gray-600 mb-4">
                  Crea bases técnicas y administrativas para RFI, RFQ y RFP con IA. De semanas a minutos.
                </p>
                <ul className="space-y-2 text-sm text-gray-600 mb-6">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Generación con IA
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Plantillas inteligentes
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Exportación DOCX/PDF
                  </li>
                </ul>
                <a href="/rfx-maker-info">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full font-semibold transition-all duration-300 group-hover:bg-[#3BE7AE] group-hover:text-white group-hover:border-[#3BE7AE]"
                    style={{ borderColor: '#3BE7AE', color: '#3BE7AE' }}
                  >
                    Conocer más <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
              </CardContent>
            </Card>

            <Card id="licitaciones" className="transition-all duration-300 hover:-translate-y-1 group scroll-mt-24">
              <CardContent className="p-8">
                <div className="p-4 rounded-xl mb-6 inline-block" style={{ backgroundColor: 'rgba(42, 212, 210, 0.15)' }}>
                  <Gavel className="h-8 w-8" style={{ color: '#2AD4D2' }} />
                </div>
                <h3 className="mb-3 text-xl font-medium tracking-tight" style={{ color: '#2D3E3D' }}>Licitaciones</h3>
                <p className="text-gray-600 mb-4">
                  Publicas el proceso, invitas proveedores y adjudicas. La línea base y el monto adjudicado dejan el ahorro en la iniciativa.
                </p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Línea base y ofertas
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Aprobación para publicar y adjudicar
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Ahorro al cerrar
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card id="sala" className="transition-all duration-300 hover:-translate-y-1 group scroll-mt-24">
              <CardContent className="p-8">
                <div className="p-4 rounded-xl mb-6 inline-block" style={{ backgroundColor: 'rgba(59, 231, 174, 0.15)' }}>
                  <Scale className="h-8 w-8" style={{ color: '#3BE7AE' }} />
                </div>
                <h3 className="mb-3 text-xl font-medium tracking-tight" style={{ color: '#2D3E3D' }}>Sala de Ofertas</h3>
                <p className="text-gray-600 mb-4">
                  El proveedor entra con su usuario y oferta. Tú eliges cómo se compite.
                </p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Sobre cerrado
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Varias rondas y subasta inversa
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Tabla de adhesión
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card id="comite" className="transition-all duration-300 hover:-translate-y-1 group scroll-mt-24">
              <CardContent className="p-8">
                <div className="p-4 rounded-xl mb-6 inline-block" style={{ backgroundColor: 'rgba(42, 212, 210, 0.15)' }}>
                  <ClipboardList className="h-8 w-8" style={{ color: '#2AD4D2' }} />
                </div>
                <h3 className="mb-3 text-xl font-medium tracking-tight" style={{ color: '#2D3E3D' }}>Comité</h3>
                <p className="text-gray-600 mb-4">
                  La reunión del mes: cuánto se gastó, qué iniciativa se atrasó y cuánto ahorro se adjudicó frente a lo comprometido.
                </p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Gasto del período
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Iniciativas atrasadas
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Cierre del mes
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Proveedores */}
            <Card className="transition-all duration-300 hover:-translate-y-1 group">
              <CardContent className="p-8">
                <div className="p-4 rounded-xl mb-6 inline-block" style={{ backgroundColor: 'rgba(59, 231, 174, 0.15)' }}>
                  <Package className="h-8 w-8" style={{ color: '#3BE7AE' }} />
                </div>
                <h3 className="mb-3 text-xl font-medium tracking-tight" style={{ color: '#2D3E3D' }}>Proveedores</h3>
                <p className="text-gray-600 mb-4">
                  Ficha, categoría y evaluación. Desde ahí se invita a la licitación con criterio.
                </p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Ficha y categoría
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Evaluación de desempeño
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Invitación al proceso
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Spend Analysis */}
            <Card className="transition-all duration-300 hover:-translate-y-1 group">
              <CardContent className="p-8">
                <div className="p-4 rounded-xl mb-6 inline-block" style={{ backgroundColor: 'rgba(42, 212, 210, 0.15)' }}>
                  <DollarSign className="h-8 w-8" style={{ color: '#2AD4D2' }} />
                </div>
                <h3 className="mb-3 text-xl font-medium tracking-tight" style={{ color: '#2D3E3D' }}>Spend Analysis</h3>
                <p className="text-gray-600 mb-4">
                  Un solo número de gasto, cortado por categoría, proveedor y área. Ese es el número que ve el comité.
                </p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Una fuente de gasto
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Corte por categoría y proveedor
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Lectura del período
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Reportes */}
            <Card className="transition-all duration-300 hover:-translate-y-1 group">
              <CardContent className="p-8">
                <div className="p-4 rounded-xl mb-6 inline-block" style={{ backgroundColor: 'rgba(59, 231, 174, 0.15)' }}>
                  <BarChart3 className="h-8 w-8" style={{ color: '#3BE7AE' }} />
                </div>
                <h3 className="mb-3 text-xl font-medium tracking-tight" style={{ color: '#2D3E3D' }}>Reportes</h3>
                <p className="text-gray-600 mb-4">
                  Informes de gasto, estado de las iniciativas, proveedores y presupuesto, listos para llevar al comité.
                </p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Gasto e iniciativas
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Desempeño de proveedores
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" style={{ color: '#3BE7AE' }} />
                    Exportación del informe
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Banner IA - ANA */}
          <div className="mt-16 p-10 rounded-2xl shadow-2xl" style={{ background: 'linear-gradient(135deg, #2D3E3D 0%, #1a2625 100%)' }}>
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="md:w-2/3 mb-6 md:mb-0">
                <div className="flex items-center mb-4">
                  <Zap className="h-10 w-10 mr-3" style={{ color: '#C6FF00' }} />
                  <h3 className="text-2xl font-medium tracking-tight text-white">ANA, IA de compras</h3>
                </div>
                <p className="text-xl text-white/85 mb-4">
                  El mismo asistente clasifica el gasto, redacta las bases y responde en el chat de compras.
                </p>
                <ul className="space-y-2 text-white/80">
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 mr-2" style={{ color: '#3BE7AE' }} />
                    Clasificación del archivo de gasto
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 mr-2" style={{ color: '#3BE7AE' }} />
                    Bases técnicas de RFI, RFQ y RFP
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-5 w-5 mr-2" style={{ color: '#3BE7AE' }} />
                    Chat sobre estrategia, línea base y negociación
                  </li>
                </ul>
              </div>
              <div className="md:w-1/3 text-center md:text-right">
                <div className="inline-block p-6 rounded-full mb-4" style={{ backgroundColor: 'rgba(198, 255, 0, 0.15)' }}>
                  <Target className="h-16 w-16" style={{ color: '#C6FF00' }} />
                </div>
                <p className="text-sm text-white/60 font-medium">Chat, clasificación y bases</p>
              </div>
            </div>
          </div>

          <div className="mt-12 rounded-2xl border border-white/40 bg-white/50 px-6 py-8 text-center backdrop-blur-xl">
            <p className="text-sm font-medium uppercase tracking-[0.18em]" style={{ color: '#2AD4D2' }}>El recorrido</p>
            <p className="mt-3 text-lg leading-relaxed text-gray-700 md:text-xl">
              Gasto → plan → bases → licitación → sala de ofertas → comité
            </p>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-500">
              El archivo entra hoy. El ERP sigue a cargo de la orden y el pago.
            </p>
          </div>
        </div>
      </section>

      {/* Por qué importa Section */}
      <section className="home-wash px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="mb-5 text-3xl font-medium tracking-tight md:text-4xl" style={{ color: '#2D3E3D' }}>
              Resolvemos las preguntas que toda gerencia se hace cada trimestre.
            </h2>
            <div className="w-24 h-1.5 mx-auto mb-6 rounded-full" style={{ background: 'linear-gradient(90deg, #3BE7AE 0%, #2AD4D2 100%)' }}></div>
          </div>

          <div className="max-w-4xl mx-auto mb-12">
            <Card>
              <CardContent className="p-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-center">
                  <div className="space-y-6">
                    <div className="glass-chip px-4 py-5">
                      <h3 className="text-lg font-medium tracking-tight" style={{ color: '#2D3E3D' }}>¿Dónde estamos?</h3>
                    </div>
                    <div className="glass-chip px-4 py-5">
                      <h3 className="text-lg font-medium tracking-tight" style={{ color: '#2D3E3D' }}>¿Cuánto gastamos?</h3>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="glass-chip px-4 py-5">
                      <h3 className="text-lg font-medium tracking-tight" style={{ color: '#2D3E3D' }}>¿Qué iniciativa se atrasó?</h3>
                    </div>
                    <div className="glass-chip px-4 py-5">
                      <h3 className="text-lg font-medium tracking-tight" style={{ color: '#2D3E3D' }}>¿Qué oportunidades de ahorro tenemos?</h3>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <p className="text-2xl text-gray-600 mb-4 max-w-2xl mx-auto">
              Ningún ERP o plataforma responde bien a eso.
            </p>
            <p className="text-3xl font-bold" style={{ color: '#3BE7AE' }}>
              Xpend sí.
            </p>
          </div>
        </div>
      </section>

      {/* Partners Section - Elegante */}
      <section className="home-wash px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="mb-5 text-3xl font-medium tracking-tight md:text-4xl" style={{ color: '#2D3E3D' }}>
              Nuestros <span style={{
                background: 'linear-gradient(135deg, #3BE7AE 0%, #2AD4D2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>Partners</span> Estratégicos
            </h2>
            <div className="w-24 h-1.5 mx-auto mb-6 rounded-full" style={{ background: 'linear-gradient(90deg, #3BE7AE 0%, #2AD4D2 100%)' }}></div>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Colaboramos con empresas líderes para ofrecer la mejor experiencia en Strategic Sourcing
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {[
              {
                name: 'Xinergy',
                description: 'Consultora de eficiencias, procurement y operaciones.',
                logo: 'https://vlyqrosqapwgzyovbqpg.supabase.co/storage/v1/object/public/Partners/Xinergy.png',
                website: 'https://xinergy.cl'
              },
              {
                name: 'Dux Partners',
                description: 'Consultora de optimización de operaciones logísticas y productivas.',
                logo: 'https://vlyqrosqapwgzyovbqpg.supabase.co/storage/v1/object/public/Partners/Dux.png',
                website: 'https://duxpartners.cl/'
              },
              {
                name: 'Opticks',
                description: 'SaaS de gestión de inventarios y optimización de capital de trabajo.',
                logo: 'https://vlyqrosqapwgzyovbqpg.supabase.co/storage/v1/object/public/Partners/Opticks.png',
                website: 'https://opticks.cl/'
              },
              {
                name: 'Reverse',
                description: 'SaaS de venta de activos (Reverse sourcing).',
                logo: 'https://vlyqrosqapwgzyovbqpg.supabase.co/storage/v1/object/public/Partners/Reverse.png',
                website: ''
              }
            ].map((partner) => (
              <Card
                key={partner.name}
                className="group cursor-pointer transition-all duration-300 hover:-translate-y-1"
              >
                <CardContent className="p-10 md:p-12">
                  <div className="flex flex-col items-center text-center space-y-6">
                    <div
                      className="w-full max-w-sm mx-auto rounded-2xl flex items-center justify-center transition-all duration-300 overflow-hidden shadow-inner"
                      style={{
                        background: 'linear-gradient(135deg, rgba(42, 212, 210, 0.12), rgba(59, 231, 174, 0.12))',
                        border: '1px solid rgba(42, 212, 210, 0.18)',
                        minHeight: '140px'
                      }}
                    >
                      <img
                        src={partner.logo}
                        alt={partner.name}
                        className="object-contain max-h-24 w-auto px-6 py-4"
                      />
                    </div>

                    <div className="w-full space-y-2">
                      <h3 className="text-lg font-bold text-gray-700">{partner.name}</h3>
                      <p className="text-sm text-gray-500">{partner.description}</p>
                    </div>

                    {partner.website ? (
                      <div className="w-full pt-4 border-t" style={{ borderColor: 'rgba(42, 212, 210, 0.15)' }}>
                        <a
                          href={partner.website}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center px-6 py-3 rounded-xl font-bold transition-all duration-300 group-hover:scale-105"
                          style={{
                            backgroundColor: 'rgba(42, 212, 210, 0.1)',
                            color: '#2AD4D2',
                            border: '2px solid rgba(42, 212, 210, 0.3)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#2AD4D2'
                            e.currentTarget.style.color = '#ffffff'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(42, 212, 210, 0.1)'
                            e.currentTarget.style.color = '#2AD4D2'
                          }}
                        >
                          Visitar Sitio Web
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </a>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Partnership CTA */}
          <div className="mt-16 text-center">
            <div className="inline-block px-8 py-6 rounded-2xl shadow-xl" style={{ backgroundColor: 'rgba(59, 231, 174, 0.1)' }}>
              <h3 className="text-2xl font-bold mb-3" style={{ color: '#2D3E3D' }}>
                ¿Quieres ser nuestro Partner?
              </h3>
              <p className="text-gray-600 mb-4 max-w-2xl">
                Únete a nuestro ecosistema de partners estratégicos y ofrece valor agregado a empresas líderes en Strategic Sourcing
              </p>
              <Button
                onClick={() => { window.location.href = '/nosotros' }}
                className="px-8 py-3 rounded-xl font-bold shadow-lg transition-all duration-300"
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
                Contáctanos para Partnerships
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
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
          <h2 className="mb-6 text-3xl font-medium tracking-tight text-white md:text-5xl">
            La inteligencia que tu área de compras necesitaba.
          </h2>
          <div className="mb-8 space-y-2 text-base md:text-lg" style={{ color: 'rgba(255, 255, 255, 0.82)' }}>
            <p>Xpend convierte el gasto en estrategia,</p>
            <p>los datos en decisiones,</p>
            <p>y el procurement en una verdadera palanca de valor.</p>
          </div>
          <p className="text-3xl font-bold mb-12" style={{
            background: 'linear-gradient(135deg, #3BE7AE 0%, #2AD4D2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Del control operativo a la gestión estratégica del procurement.
          </p>
          <div className="flex justify-center">
            <Button
              onClick={enterApp}
              size="lg"
              className="rounded-xl px-8 py-5 text-sm font-medium tracking-wide shadow-lg transition-all duration-300"
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
              {isAuthenticated ? 'Ir a Xpend' : 'Entrar a Xpend'}
              <ArrowRight className="ml-2 h-6 w-6" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer - Elegante */}
      <footer className="py-16 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#1a2625' }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center text-center mb-12">
            <Logo size="md" variant="white" />
            <p className="mt-6 text-gray-400 leading-relaxed max-w-2xl">
              Del gasto a la adjudicación: plan, bases, licitación, sala de ofertas y comité.
            </p>
          </div>
          <div className="border-t pt-10 flex flex-col md:flex-row justify-between items-center" style={{ borderTopColor: 'rgba(59, 231, 174, 0.2)' }}>
            <p className="text-gray-400 text-sm font-medium">
              © 2026 <span style={{ color: '#3BE7AE', fontWeight: 'bold' }}>Xpend™</span> - Marca en trámite INAPI.
            </p>
            <div className="flex space-x-8 mt-4 md:mt-0">
              <button
                type="button"
                className="text-gray-400 text-sm font-medium transition-colors duration-200 cursor-default"
                onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'}
                onMouseLeave={(e) => e.currentTarget.style.color = ''}
              >
                Privacidad
              </button>
              <button
                type="button"
                className="text-gray-400 text-sm font-medium transition-colors duration-200 cursor-default"
                onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'}
                onMouseLeave={(e) => e.currentTarget.style.color = ''}
              >
                Términos
              </button>
              <button
                type="button"
                className="text-gray-400 text-sm font-medium transition-colors duration-200 cursor-default"
                onMouseEnter={(e) => e.currentTarget.style.color = '#3BE7AE'}
                onMouseLeave={(e) => e.currentTarget.style.color = ''}
              >
                Cookies
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
