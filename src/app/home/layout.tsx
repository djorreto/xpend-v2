import type { Metadata } from 'next'
import './home.css'

export const metadata: Metadata = {
  title: 'Xpend — Abastecimiento más inteligente. Menos complejidad.',
  description: 'Planifica, licita, evalúa y gestiona contratos en una plataforma modular de procurement. ANA trabaja con la información autorizada de tu equipo.',
  applicationName: 'Xpend',
  openGraph: {
    title: 'Xpend — Abastecimiento más inteligente. Menos complejidad.',
    description: 'Software modular de abastecimiento para empresas medianas: gasto, sourcing, contratos e inteligencia artificial con revisión humana.',
    locale: 'es_CL',
    type: 'website',
    siteName: 'Xpend',
  },
}

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return children
}
