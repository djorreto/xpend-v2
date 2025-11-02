'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Logo } from '@/components/ui/logo'
import {
  ChevronDown,
  ChevronUp,
  MessageCircle,
  ArrowRight,
  Menu,
  X
} from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase'

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
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

  const faqs = [
    {
      category: 'General',
      questions: [
        {
          q: '¿Qué es Xpend?',
          a: 'Xpend es la capa de inteligencia y gestión que conecta gasto, planificación y ejecución de compras. Transforma el procurement del control operativo a la gestión estratégica. Incluye ANA, tu asistente de IA especializado en procurement. Actualmente en versión Beta MVP.'
        },
        {
          q: '¿Qué significa que está en versión Beta MVP?',
          a: 'Estamos en fase Beta MVP (Producto Mínimo Viable), lo que significa que la plataforma tiene las funcionalidades core operativas y está siendo mejorada continuamente con feedback de usuarios reales. Algunas funciones avanzadas están en desarrollo activo.'
        },
        {
          q: '¿Para qué tipo de empresas está diseñado Xpend?',
          a: 'Xpend está diseñado para empresas que necesitan optimizar su proceso de compras estratégicas. Es ideal para áreas de Procurement, Strategic Sourcing y Abastecimiento que gestionan múltiples licitaciones y proveedores.'
        },
        {
          q: '¿Necesito instalar algo en mi computador?',
          a: 'No, Xpend es 100% web. Solo necesitas un navegador moderno (Chrome, Firefox, Safari o Edge) y conexión a internet. Puedes acceder desde cualquier dispositivo.'
        }
      ]
    },
    {
      category: 'Módulos Disponibles',
      questions: [
        {
          q: '¿Qué módulos están actualmente disponibles en Xpend?',
          a: 'Actualmente Xpend cuenta con: RFx Maker (generación de bases RFI/RFQ/RFP con IA), Gestión de Licitaciones, Gestión de Proveedores, Proyectos de Sourcing, Sourcing Plan con análisis de gasto y matriz de Kraljic, Spend Analysis con categorización inteligente, Reportes Ejecutivos, y ANA Chat (asistente de IA 24/7).'
        },
        {
          q: '¿Cómo funciona la Gestión de Licitaciones?',
          a: 'Puedes crear licitaciones tipo RFP, RFQ o RFI con toda la información: título, descripción, fechas límite, baseline, departamento responsable y archivos adjuntos. El sistema te permite hacer seguimiento del estado (Borrador, Publicada, En Evaluación, Adjudicada, Cerrada) y calcular ahorros comparando baseline vs. monto adjudicado.'
        },
        {
          q: '¿Qué es el Sourcing Plan?',
          a: 'Es un módulo de planificación estratégica donde defines tus iniciativas de sourcing por trimestre y año, proyectas ahorros esperados y haces seguimiento del avance real. Incluye análisis de gasto potenciado con IA, visualización de la matriz de Kraljic, y detección automática de oportunidades de ahorro por categoría.'
        },
        {
          q: '¿Qué es RFx Maker?',
          a: 'RFx Maker es un módulo que te ayuda a crear bases técnicas y administrativas para RFI, RFQ y RFP utilizando inteligencia artificial. Puedes partir de plantillas predefinidas, políticas de tu empresa, y generar documentos profesionales listos para publicar. Acelera drásticamente el proceso de creación de licitaciones.'
        },
        {
          q: '¿Cómo funciona la gestión de Proveedores?',
          a: 'Puedes registrar proveedores con su información completa (RUT, razón social, contacto, tipo de servicio) y hacer seguimiento de evaluaciones administrativas y técnicas. El sistema usa un semáforo visual (verde/amarillo/rojo) para ver rápidamente el estado de cada proveedor.'
        },
        {
          q: '¿Qué es ANA Chat?',
          a: 'ANA (Asistente de Negociaciones y Abastecimiento) es tu asistente de IA experto en Strategic Sourcing. Puedes consultarle sobre estrategia de categorías, negociación con proveedores, RFP/RFQ/RFI, análisis de costos y más. Está disponible 24/7 desde un botón flotante en la plataforma.'
        }
      ]
    },
    {
      category: 'Usuarios y Permisos',
      questions: [
        {
          q: '¿Puedo tener múltiples usuarios en mi cuenta?',
          a: 'Sí, Xpend soporta múltiples usuarios con diferentes roles y permisos. El Super Admin puede invitar usuarios y asignarles permisos específicos para ver, crear, editar o eliminar información en cada módulo.'
        },
        {
          q: '¿Qué roles de usuario existen?',
          a: 'Actualmente existen: Super Admin (acceso total), Admin (acceso completo excepto gestión de usuarios y configuración avanzada), y Viewer (solo lectura). Los permisos se pueden personalizar por módulo.'
        },
        {
          q: '¿Puedo cambiar mi contraseña?',
          a: 'Sí, puedes cambiar tu contraseña desde el módulo de Settings en cualquier momento. Los nuevos usuarios invitados deben cambiar su contraseña en el primer inicio de sesión por seguridad.'
        }
      ]
    },
    {
      category: 'Reportes y Análisis',
      questions: [
        {
          q: '¿Qué tipo de reportes puedo generar?',
          a: 'Puedes generar reportes ejecutivos de licitaciones, proveedores, spend analysis, y savings tracking. Los reportes se pueden exportar en formato Excel o PDF. También hay dashboards visuales con gráficos en tiempo real.'
        },
        {
          q: '¿Puedo hacer análisis de gasto por categoría?',
          a: 'Sí, el módulo de Spend Analysis te permite visualizar tu gasto por categoría, proveedor y departamento. Puedes identificar oportunidades de ahorro y ver tendencias de gasto en el tiempo.'
        }
      ]
    },
    {
      category: 'Datos y Seguridad',
      questions: [
        {
          q: '¿Dónde se guardan mis datos?',
          a: 'Todos los datos se almacenan en Supabase, una plataforma de base de datos segura con servidores en la nube. Los datos están encriptados y protegidos con autenticación y control de acceso estricto.'
        },
        {
          q: '¿Mi información está segura?',
          a: 'Sí, implementamos autenticación robusta, encriptación de datos, control de acceso por roles, y políticas de seguridad estrictas. Solo los usuarios autorizados de tu empresa pueden acceder a tu información.'
        },
        {
          q: '¿Puedo subir archivos a la plataforma?',
          a: 'Sí, puedes adjuntar archivos a licitaciones y proyectos. Los archivos se almacenan de forma segura en el storage de la plataforma y solo son accesibles para usuarios autorizados.'
        }
      ]
    },
    {
      category: 'Soporte y Ayuda',
      questions: [
        {
          q: '¿Cómo puedo obtener ayuda si tengo dudas?',
          a: 'Puedes usar ANA Chat dentro de la plataforma para consultas sobre sourcing. Para soporte técnico, contáctanos por email. Estamos trabajando en expandir nuestros canales de soporte.'
        },
        {
          q: '¿La plataforma está en desarrollo activo?',
          a: 'Sí, Xpend está en versión Beta MVP en constante evolución. Agregamos nuevas funcionalidades regularmente basándonos en feedback de usuarios y necesidades del mercado de Strategic Sourcing. Tu participación como usuario beta es fundamental para mejorar la plataforma.'
        },
        {
          q: '¿Puedo solicitar nuevas funcionalidades?',
          a: 'Por supuesto! Valoramos el feedback de nuestros usuarios. Puedes enviarnos sugerencias de nuevas funcionalidades que te gustaría ver en la plataforma y las evaluaremos para próximas versiones.'
        }
      ]
    }
  ]

  const toggleQuestion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  let questionIndex = 0

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
          <div className="md:hidden bg-blue-900 border-t border-blue-800">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <a href="/#gestion" className="block px-3 py-2 text-white hover:text-blue-200">Gestión Integral</a>
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

      {/* Hero Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-8" style={{ letterSpacing: '-0.02em' }}>
            Preguntas <span style={{
              background: 'linear-gradient(135deg, #3BE7AE 0%, #2AD4D2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>Frecuentes</span>
          </h1>
          <p className="text-2xl mb-12 max-w-4xl mx-auto" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
            Todo lo que necesitas saber sobre Xpend
          </p>
        </div>
      </section>

      {/* Separator */}
      <div className="h-20" style={{
        background: 'linear-gradient(to bottom, #1a2625 0%, #f9fafb 100%)'
      }}></div>

      {/* Main Content */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto">
          {faqs.map((category, categoryIndex) => (
            <div key={categoryIndex} className="mb-12">
              <h2 className="text-3xl font-bold mb-6" style={{ color: '#2D3E3D' }}>
                {category.category}
              </h2>
              <div className="space-y-4">
                {category.questions.map((faq) => {
                  const currentIndex = questionIndex++
                  const isOpen = openIndex === currentIndex

                  return (
                    <Card
                      key={currentIndex}
                      className="backdrop-blur-md border-0 shadow-lg transition-all duration-300 hover:shadow-xl cursor-pointer"
                      style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}
                      onClick={() => toggleQuestion(currentIndex)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold pr-8" style={{ color: '#2D3E3D' }}>
                            {faq.q}
                          </h3>
                          <div className="flex-shrink-0 p-2 rounded-lg transition-all" style={{ backgroundColor: isOpen ? 'rgba(59, 231, 174, 0.15)' : 'rgba(42, 212, 210, 0.1)' }}>
                            {isOpen ? (
                              <ChevronUp className="h-5 w-5" style={{ color: '#3BE7AE' }} />
                            ) : (
                              <ChevronDown className="h-5 w-5" style={{ color: '#2AD4D2' }} />
                            )}
                          </div>
                        </div>
                        {isOpen && (
                          <p className="mt-4 text-gray-700 leading-relaxed">
                            {faq.a}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Contact CTA */}
          <div className="mt-16 bg-gradient-to-r rounded-2xl p-12 shadow-2xl text-center" style={{
            background: 'linear-gradient(135deg, rgba(42, 212, 210, 0.1) 0%, rgba(59, 231, 174, 0.1) 100%)'
          }}>
            <div className="inline-flex p-4 rounded-xl mb-6" style={{ backgroundColor: 'rgba(59, 231, 174, 0.15)' }}>
              <MessageCircle className="h-12 w-12" style={{ color: '#3BE7AE' }} />
            </div>
            <h3 className="text-3xl font-bold mb-4" style={{ color: '#2D3E3D' }}>
              ¿No encontraste tu respuesta?
            </h3>
            <p className="text-xl text-gray-700 mb-8">
              Nuestro equipo está aquí para ayudarte. Contáctanos y resolveremos todas tus dudas.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={handleDemo}
                className="px-8 py-4 rounded-xl font-bold shadow-lg transition-all duration-300"
                style={{ backgroundColor: '#3BE7AE', color: '#2D3E3D' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2AD4D2'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#3BE7AE'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                Agendar Demo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                className="px-8 py-4 rounded-xl font-bold transition-all duration-300"
                style={{
                  borderColor: '#2AD4D2',
                  color: '#2AD4D2',
                  borderWidth: '2px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2AD4D2'
                  e.currentTarget.style.color = '#ffffff'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = '#2AD4D2'
                }}
              >
                Contactar Soporte
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 text-center" style={{ backgroundColor: '#1a2625' }}>
        <p className="text-gray-400 text-sm font-medium">
          © 2025 <span style={{ color: '#3BE7AE', fontWeight: 'bold' }}>xpend.cl</span> - Todos los derechos reservados.
        </p>
      </footer>
    </div>
  )
}

