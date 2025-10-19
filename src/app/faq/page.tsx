'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Logo } from '@/components/ui/logo'
import { 
  ChevronDown,
  ChevronUp,
  MessageCircle,
  ArrowRight
} from 'lucide-react'

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const handleDemo = () => {
    console.log('Agendar demo')
  }

  const faqs = [
    {
      category: 'General',
      questions: [
        {
          q: '¿Qué es Xpend?',
          a: 'Xpend es una plataforma de coordinación para Strategic Sourcing que combina automatización inteligente con IA, gestión colaborativa y visibilidad total del proceso. Liberamos a los equipos de compras de tareas operativas para que se enfoquen en decisiones estratégicas que generen valor real.'
        },
        {
          q: '¿Cómo se diferencia Xpend de otras plataformas de sourcing?',
          a: 'Xpend no es solo un digitalizador de procesos, es un inteligentizador. Nuestra IA analiza patrones, sugiere optimizaciones y automatiza tareas repetitivas. Además, estamos diseñados específicamente para el mercado latinoamericano, con integración a sistemas locales de licitaciones y adaptación a normativas regionales.'
        },
        {
          q: '¿Para qué tipo de empresas está diseñado Xpend?',
          a: 'Xpend está diseñado para empresas medianas y grandes de cualquier industria que cuenten con un área de Strategic Sourcing o Compras. Es especialmente útil para organizaciones que gestionan múltiples proveedores, licitaciones complejas y buscan centralizar y optimizar sus procesos de sourcing.'
        }
      ]
    },
    {
      category: 'Funcionalidades',
      questions: [
        {
          q: '¿Qué módulos incluye la plataforma?',
          a: 'Xpend incluye módulos de: Gestión de Licitaciones (con tracking completo desde origen hasta ahorro final), Gestión de Proveedores (con evaluaciones administrativas y técnicas), Análisis de Categorías de Gasto, Plan de Compras Estratégico, Gestión de Proyectos de Sourcing, y Reportes Ejecutivos con dashboards en tiempo real.'
        },
        {
          q: '¿Cómo funciona el sistema de evaluación de proveedores?',
          a: 'Contamos con un sistema dual: Evaluación Administrativa (válida por 12 meses) que incluye documentación base, análisis financiero y experiencia; y Evaluación Técnica (por licitación) que evalúa prevención de riesgos y propuesta técnica. El sistema calcula automáticamente scores ponderados y muestra estados con semáforo visual (verde/amarillo/rojo).'
        },
        {
          q: '¿Puedo integrar Xpend con mis sistemas actuales?',
          a: 'Sí, Xpend ofrece APIs robustas para integración con ERPs, plataformas de licitaciones públicas y privadas, sistemas contables y herramientas de BI. También ofrecemos integración con Microsoft 365 y Google Workspace para gestión de documentos.'
        },
        {
          q: '¿Cómo se calculan los ahorros?',
          a: 'Los ahorros se calculan automáticamente comparando la baseline (línea base de gasto) con el valor adjudicado final. Puedes definir la fuente de baseline (presupuesto, mercado, último año) y el sistema actualiza el porcentaje y monto ahorrado en tiempo real. Todos los datos quedan trazados para auditorías.'
        }
      ]
    },
    {
      category: 'Implementación',
      questions: [
        {
          q: '¿Cuánto tiempo toma implementar Xpend?',
          a: 'La implementación típica toma entre 2 a 4 semanas, dependiendo del tamaño de la organización y la complejidad de las integraciones. Incluye: configuración inicial, migración de datos históricos, capacitación de usuarios y puesta en marcha asistida.'
        },
        {
          q: '¿Necesito conocimientos técnicos para usar Xpend?',
          a: 'No. Xpend está diseñado para ser intuitivo y fácil de usar por cualquier profesional de compras o sourcing. Ofrecemos capacitación completa y documentación detallada. Nuestro equipo de soporte también está disponible 24/7 para ayudar.'
        },
        {
          q: '¿Ofrecen capacitación para mi equipo?',
          a: 'Sí, incluimos capacitación completa como parte del proceso de implementación. Ofrecemos sesiones en vivo, videos tutoriales, documentación interactiva y soporte continuo. También organizamos webinars mensuales sobre mejores prácticas.'
        }
      ]
    },
    {
      category: 'Seguridad y Cumplimiento',
      questions: [
        {
          q: '¿Dónde se almacenan mis datos?',
          a: 'Todos los datos se almacenan en servidores ubicados en Chile, cumpliendo con la legislación local de protección de datos. Utilizamos AWS con redundancia geográfica para garantizar disponibilidad y recuperación ante desastres.'
        },
        {
          q: '¿Qué medidas de seguridad implementa Xpend?',
          a: 'Implementamos encriptación end-to-end, autenticación multifactor, control de acceso basado en roles (RBAC), auditoría completa de acciones, backups diarios automáticos, y cumplimos con estándares de seguridad ISO 27001 (certificación en proceso). Contamos con 99.9% de uptime garantizado.'
        },
        {
          q: '¿Cumplen con las normativas de protección de datos?',
          a: 'Sí, cumplimos con la Ley N° 19.628 de Protección de Datos Personales de Chile y estamos preparados para cumplir con regulaciones internacionales como GDPR. Ofrecemos DPA (Data Processing Agreements) personalizados para nuestros clientes.'
        }
      ]
    },
    {
      category: 'Precios y Soporte',
      questions: [
        {
          q: '¿Cómo funciona el modelo de precios?',
          a: 'Ofrecemos planes flexibles basados en el número de usuarios y módulos activos. Contamos con planes mensuales y anuales (con descuento). También ofrecemos pricing personalizado para grandes empresas. Todos los planes incluyen soporte 24/7 y actualizaciones gratuitas.'
        },
        {
          q: '¿Ofrecen período de prueba?',
          a: 'Sí, ofrecemos una demo personalizada donde mostramos la plataforma con datos de ejemplo relevantes para tu industria. Para clientes calificados, ofrecemos un piloto de 30 días con implementación asistida.'
        },
        {
          q: '¿Qué tipo de soporte ofrecen?',
          a: 'Ofrecemos soporte técnico 24/7 por email, chat en vivo y teléfono. Contamos con un equipo especializado en Strategic Sourcing que puede asesorarte no solo en aspectos técnicos, sino también en mejores prácticas de la industria. Todos los planes incluyen un Customer Success Manager dedicado.'
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
      {/* Header Simple */}
      <header className="relative z-50 backdrop-blur-md" style={{ 
        backgroundColor: 'rgba(45, 62, 61, 0.98)', 
        borderBottom: '2px solid',
        borderImage: 'linear-gradient(90deg, transparent 0%, #3BE7AE 50%, transparent 100%) 1'
      }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <a href="/">
              <Logo size="lg" variant="white" />
            </a>
            <div className="flex items-center space-x-4">
              <a href="/">
                <Button 
                  variant="ghost" 
                  className="text-white/90 font-medium transition-all duration-300"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(59, 231, 174, 0.15)'
                    e.currentTarget.style.color = '#3BE7AE'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)'
                  }}
                >
                  Volver al Inicio
                </Button>
              </a>
              <Button 
                onClick={handleDemo}
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
                Agendar Demo
              </Button>
            </div>
          </div>
        </div>
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

