'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Logo } from '@/components/ui/logo'
import { 
  Calendar,
  Clock,
  ArrowRight,
  TrendingUp,
  Lightbulb,
  Shield,
  Users
} from 'lucide-react'

export default function BlogPage() {
  const handleDemo = () => {
    console.log('Agendar demo')
  }

  const blogPosts = [
    {
      id: 1,
      title: '5 Estrategias para Optimizar tu Strategic Sourcing con IA',
      excerpt: 'Descubre cómo la inteligencia artificial está transformando la gestión de compras estratégicas y cómo puedes aprovecharla en tu organización.',
      date: '15 Enero 2025',
      readTime: '8 min',
      category: 'Innovación',
      icon: Lightbulb,
      color: '#3BE7AE'
    },
    {
      id: 2,
      title: 'Gestión de Proveedores: Del Excel a la Automatización',
      excerpt: 'El cambio de paradigma en la evaluación y seguimiento de proveedores. Casos de éxito y mejores prácticas del mercado.',
      date: '10 Enero 2025',
      readTime: '6 min',
      category: 'Proveedores',
      icon: Users,
      color: '#2AD4D2'
    },
    {
      id: 3,
      title: 'Cómo Medir el ROI de tu Área de Strategic Sourcing',
      excerpt: 'Métricas clave, KPIs y metodologías para demostrar el valor generado por tu equipo de compras estratégicas.',
      date: '5 Enero 2025',
      readTime: '10 min',
      category: 'Métricas',
      icon: TrendingUp,
      color: '#3BE7AE'
    },
    {
      id: 4,
      title: 'Seguridad de Datos en Plataformas de Sourcing',
      excerpt: 'Todo lo que necesitas saber sobre protección de información sensible, compliance y mejores prácticas de ciberseguridad.',
      date: '28 Diciembre 2024',
      readTime: '7 min',
      category: 'Seguridad',
      icon: Shield,
      color: '#2AD4D2'
    }
  ]

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
            Blog <span style={{ 
              background: 'linear-gradient(135deg, #3BE7AE 0%, #2AD4D2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>Xpend</span>
          </h1>
          <p className="text-2xl mb-12 max-w-4xl mx-auto" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
            Insights, tendencias y mejores prácticas en Strategic Sourcing
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
          {/* Featured Post */}
          <div className="mb-16">
            <Card className="backdrop-blur-md border-0 shadow-2xl transition-all duration-300 hover:shadow-3xl overflow-hidden" style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="p-12">
                  <div className="inline-block px-4 py-2 rounded-lg mb-4 font-bold text-sm" style={{ backgroundColor: 'rgba(59, 231, 174, 0.15)', color: '#3BE7AE' }}>
                    DESTACADO
                  </div>
                  <h2 className="text-4xl font-bold mb-6" style={{ color: '#2D3E3D' }}>
                    El Futuro del Strategic Sourcing: Tendencias 2025
                  </h2>
                  <p className="text-xl text-gray-700 mb-8 leading-relaxed">
                    IA generativa, automatización avanzada, sostenibilidad y nuevas regulaciones. Un análisis profundo de lo que viene para las áreas de compras estratégicas en Latinoamérica.
                  </p>
                  <div className="flex items-center mb-8 text-gray-600">
                    <Calendar className="h-5 w-5 mr-2" style={{ color: '#2AD4D2' }} />
                    <span className="mr-6">20 Enero 2025</span>
                    <Clock className="h-5 w-5 mr-2" style={{ color: '#2AD4D2' }} />
                    <span>12 min lectura</span>
                  </div>
                  <Button 
                    className="px-8 py-3 rounded-xl font-bold transition-all duration-300"
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
                    Leer Artículo
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
                <div className="rounded-2xl p-12 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(42, 212, 210, 0.1) 0%, rgba(59, 231, 174, 0.1) 100%)' }}>
                  <TrendingUp className="h-48 w-48" style={{ color: '#3BE7AE', opacity: 0.3 }} />
                </div>
              </div>
            </Card>
          </div>

          {/* Blog Posts Grid */}
          <div className="mb-16">
            <h3 className="text-3xl font-bold mb-8" style={{ color: '#2D3E3D' }}>Artículos Recientes</h3>
            <div className="grid md:grid-cols-2 gap-8">
              {blogPosts.map((post) => {
                const Icon = post.icon
                return (
                  <Card 
                    key={post.id}
                    className="backdrop-blur-md border-0 shadow-2xl transition-all duration-300 hover:shadow-3xl cursor-pointer group" 
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.98)' }}
                  >
                    <CardContent className="p-8">
                      <div className="flex items-center mb-6">
                        <div className="p-3 rounded-xl mr-4" style={{ backgroundColor: `${post.color}15` }}>
                          <Icon className="h-8 w-8" style={{ color: post.color }} />
                        </div>
                        <span className="px-3 py-1 rounded-lg text-xs font-bold" style={{ backgroundColor: `${post.color}15`, color: post.color }}>
                          {post.category.toUpperCase()}
                        </span>
                      </div>
                      <h4 className="text-2xl font-bold mb-4 group-hover:text-opacity-80 transition-all" style={{ color: '#2D3E3D' }}>
                        {post.title}
                      </h4>
                      <p className="text-gray-700 mb-6 leading-relaxed">
                        {post.excerpt}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="h-4 w-4 mr-2" style={{ color: post.color }} />
                          <span className="mr-4">{post.date}</span>
                          <Clock className="h-4 w-4 mr-2" style={{ color: post.color }} />
                          <span>{post.readTime}</span>
                        </div>
                        <ArrowRight 
                          className="h-5 w-5 group-hover:translate-x-2 transition-transform" 
                          style={{ color: post.color }} 
                        />
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Newsletter */}
          <div className="bg-gradient-to-r rounded-2xl p-12 shadow-2xl text-center" style={{ 
            background: 'linear-gradient(135deg, rgba(42, 212, 210, 0.1) 0%, rgba(59, 231, 174, 0.1) 100%)'
          }}>
            <h3 className="text-3xl font-bold mb-4" style={{ color: '#2D3E3D' }}>
              Suscríbete a nuestro Newsletter
            </h3>
            <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
              Recibe los últimos insights, tendencias y mejores prácticas de Strategic Sourcing directamente en tu inbox
            </p>
            <div className="flex flex-col sm:flex-row gap-4 max-w-xl mx-auto">
              <input 
                type="email" 
                placeholder="tu@email.com" 
                className="flex-1 px-6 py-4 rounded-xl border-2 text-gray-700 focus:outline-none focus:ring-2 transition-all"
                style={{ 
                  borderColor: 'rgba(42, 212, 210, 0.3)',
                  focusRing: '#3BE7AE'
                }}
              />
              <Button 
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
                Suscribirme
              </Button>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-20">
            <h3 className="text-3xl font-bold mb-6" style={{ color: '#2D3E3D' }}>
              ¿Quieres ver Xpend en acción?
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
              Agenda una Demo Personalizada
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

