'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Logo } from '@/components/ui/logo'
import { 
  CheckCircle, 
  Shield, 
  Users, 
  FileCheck, 
  Award,
  TrendingUp,
  Search,
  ArrowRight
} from 'lucide-react'

export default function ProveedoresPage() {
  const handleDemo = () => {
    console.log('Agendar demo')
  }

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
            Gestión Inteligente de <span style={{ 
              background: 'linear-gradient(135deg, #3BE7AE 0%, #2AD4D2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>Proveedores</span>
          </h1>
          <p className="text-2xl mb-12 max-w-4xl mx-auto" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
            Centraliza toda la información de tus proveedores, evalúalos de manera integral y toma decisiones basadas en datos reales
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
          {/* Introducción */}
          <div className="mb-20">
            <h2 className="text-4xl font-bold mb-8 text-center" style={{ color: '#2D3E3D' }}>
              Sistema Integral de Gestión de Proveedores
            </h2>
            <p className="text-xl text-gray-700 text-center max-w-4xl mx-auto leading-relaxed">
              Xpend te permite gestionar todo el ciclo de vida de tus proveedores, desde el registro inicial hasta evaluaciones técnicas y administrativas, asegurando transparencia y trazabilidad en cada etapa.
            </p>
          </div>

          {/* Características Principales */}
          <div className="grid md:grid-cols-2 gap-8 mb-20">
            {/* Card 1: Registro Centralizado */}
            <Card className="backdrop-blur-md border-0 shadow-2xl transition-all duration-300 hover:shadow-3xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
              <CardContent className="p-8">
                <div className="flex items-center mb-6">
                  <div className="p-4 rounded-xl mr-4" style={{ backgroundColor: 'rgba(42, 212, 210, 0.15)' }}>
                    <Users className="h-8 w-8" style={{ color: '#2AD4D2' }} />
                  </div>
                  <h3 className="text-2xl font-bold" style={{ color: '#2D3E3D' }}>Registro Centralizado</h3>
                </div>
                <ul className="space-y-4">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 mr-3 mt-1" style={{ color: '#3BE7AE' }} />
                    <span className="text-gray-700">Información completa: razón social, RUT, contactos, tipo de servicio</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 mr-3 mt-1" style={{ color: '#3BE7AE' }} />
                    <span className="text-gray-700">Gestión de NDAs (acuerdos de confidencialidad) con firma digital</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 mr-3 mt-1" style={{ color: '#3BE7AE' }} />
                    <span className="text-gray-700">Documentación adjunta y almacenamiento seguro</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 mr-3 mt-1" style={{ color: '#3BE7AE' }} />
                    <span className="text-gray-700">Historial completo de interacciones y cambios</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Card 2: Evaluación Administrativa */}
            <Card className="backdrop-blur-md border-0 shadow-2xl transition-all duration-300 hover:shadow-3xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
              <CardContent className="p-8">
                <div className="flex items-center mb-6">
                  <div className="p-4 rounded-xl mr-4" style={{ backgroundColor: 'rgba(59, 231, 174, 0.15)' }}>
                    <FileCheck className="h-8 w-8" style={{ color: '#3BE7AE' }} />
                  </div>
                  <h3 className="text-2xl font-bold" style={{ color: '#2D3E3D' }}>Evaluación Administrativa</h3>
                </div>
                <ul className="space-y-4">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 mr-3 mt-1" style={{ color: '#3BE7AE' }} />
                    <span className="text-gray-700">Evaluación de documentación base (certificados, permisos)</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 mr-3 mt-1" style={{ color: '#3BE7AE' }} />
                    <span className="text-gray-700">Análisis financiero (estados contables, solvencia)</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 mr-3 mt-1" style={{ color: '#3BE7AE' }} />
                    <span className="text-gray-700">Evaluación de experiencia y track record</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 mr-3 mt-1" style={{ color: '#3BE7AE' }} />
                    <span className="text-gray-700">Vigencia de 12 meses con alertas de renovación</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Card 3: Evaluación Técnica */}
            <Card className="backdrop-blur-md border-0 shadow-2xl transition-all duration-300 hover:shadow-3xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
              <CardContent className="p-8">
                <div className="flex items-center mb-6">
                  <div className="p-4 rounded-xl mr-4" style={{ backgroundColor: 'rgba(42, 212, 210, 0.15)' }}>
                    <Award className="h-8 w-8" style={{ color: '#2AD4D2' }} />
                  </div>
                  <h3 className="text-2xl font-bold" style={{ color: '#2D3E3D' }}>Evaluación Técnica por Licitación</h3>
                </div>
                <ul className="space-y-4">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 mr-3 mt-1" style={{ color: '#3BE7AE' }} />
                    <span className="text-gray-700">Evaluación de prevención de riesgos específicos</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 mr-3 mt-1" style={{ color: '#3BE7AE' }} />
                    <span className="text-gray-700">Análisis de propuesta técnica por licitación</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 mr-3 mt-1" style={{ color: '#3BE7AE' }} />
                    <span className="text-gray-700">Scoring automático con ponderación configurable</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 mr-3 mt-1" style={{ color: '#3BE7AE' }} />
                    <span className="text-gray-700">Comparativa entre proveedores en tiempo real</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Card 4: Sistema de Semáforo */}
            <Card className="backdrop-blur-md border-0 shadow-2xl transition-all duration-300 hover:shadow-3xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
              <CardContent className="p-8">
                <div className="flex items-center mb-6">
                  <div className="p-4 rounded-xl mr-4" style={{ backgroundColor: 'rgba(59, 231, 174, 0.15)' }}>
                    <TrendingUp className="h-8 w-8" style={{ color: '#3BE7AE' }} />
                  </div>
                  <h3 className="text-2xl font-bold" style={{ color: '#2D3E3D' }}>Sistema de Semáforo Visual</h3>
                </div>
                <ul className="space-y-4">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 mr-3 mt-1" style={{ color: '#3BE7AE' }} />
                    <span className="text-gray-700">Visualización rápida del estado de evaluación</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 mr-3 mt-1" style={{ color: '#3BE7AE' }} />
                    <span className="text-gray-700">Verde: Evaluación vigente y completa</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 mr-3 mt-1" style={{ color: '#3BE7AE' }} />
                    <span className="text-gray-700">Amarillo: Por vencer o incompleta</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 mr-3 mt-1" style={{ color: '#3BE7AE' }} />
                    <span className="text-gray-700">Rojo: Vencida o rechazada</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Integración con Licitaciones */}
          <div className="bg-gradient-to-r rounded-2xl p-12 mb-20 shadow-2xl" style={{ 
            background: 'linear-gradient(135deg, rgba(42, 212, 210, 0.1) 0%, rgba(59, 231, 174, 0.1) 100%)'
          }}>
            <div className="flex items-center mb-6">
              <div className="p-4 rounded-xl mr-4" style={{ backgroundColor: 'rgba(42, 212, 210, 0.2)' }}>
                <Search className="h-10 w-10" style={{ color: '#2AD4D2' }} />
              </div>
              <h2 className="text-3xl font-bold" style={{ color: '#2D3E3D' }}>
                Integración Total con Licitaciones
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-xl font-bold mb-4" style={{ color: '#2D3E3D' }}>Desde la Licitación</h4>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <ArrowRight className="h-5 w-5 mr-2 mt-1" style={{ color: '#3BE7AE' }} />
                    Asocia múltiples proveedores participantes
                  </li>
                  <li className="flex items-start">
                    <ArrowRight className="h-5 w-5 mr-2 mt-1" style={{ color: '#3BE7AE' }} />
                    Visualiza evaluaciones administrativas vigentes
                  </li>
                  <li className="flex items-start">
                    <ArrowRight className="h-5 w-5 mr-2 mt-1" style={{ color: '#3BE7AE' }} />
                    Realiza evaluaciones técnicas específicas
                  </li>
                  <li className="flex items-start">
                    <ArrowRight className="h-5 w-5 mr-2 mt-1" style={{ color: '#3BE7AE' }} />
                    Compara scores ponderados automáticamente
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-xl font-bold mb-4" style={{ color: '#2D3E3D' }}>Desde el Proveedor</h4>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <ArrowRight className="h-5 w-5 mr-2 mt-1" style={{ color: '#2AD4D2' }} />
                    Consulta histórico de licitaciones participadas
                  </li>
                  <li className="flex items-start">
                    <ArrowRight className="h-5 w-5 mr-2 mt-1" style={{ color: '#2AD4D2' }} />
                    Acceso rápido al perfil desde cada licitación
                  </li>
                  <li className="flex items-start">
                    <ArrowRight className="h-5 w-5 mr-2 mt-1" style={{ color: '#2AD4D2' }} />
                    Filtros por servicio, NDA y evaluación
                  </li>
                  <li className="flex items-start">
                    <ArrowRight className="h-5 w-5 mr-2 mt-1" style={{ color: '#2AD4D2' }} />
                    Búsqueda inteligente por múltiples criterios
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Seguridad y Compliance */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center p-6 rounded-2xl shadow-xl" style={{ backgroundColor: 'rgba(59, 231, 174, 0.1)' }}>
              <Shield className="h-12 w-12 mr-4" style={{ color: '#3BE7AE' }} />
              <div className="text-left">
                <h3 className="text-2xl font-bold mb-2" style={{ color: '#2D3E3D' }}>
                  Seguridad y Cumplimiento Normativo
                </h3>
                <p className="text-gray-700">
                  Todos los datos de proveedores están protegidos con encriptación de nivel empresarial y cumplen con las normativas de protección de datos vigentes
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
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
              Solicita una Demo Personalizada
              <ArrowRight className="ml-2 h-6 w-6" />
            </Button>
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

