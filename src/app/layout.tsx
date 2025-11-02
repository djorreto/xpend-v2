import type { Metadata } from 'next'
import { Work_Sans } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/ui/toast'
import { VersionProvider } from '@/contexts/version-context'

// Work Sans is similar to Graphik - clean, modern geometric sans-serif
const workSans = Work_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-work-sans'
})

export const metadata: Metadata = {
  title: 'Xpend - Del control operativo a la gestión estratégica del procurement',
  description: 'Xpend potencia el Procurement Performance conectando gasto, planificación y ejecución. Del control operativo a la gestión estratégica del procurement.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    }
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={workSans.className}>
        <VersionProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </VersionProvider>
      </body>
    </html>
  )
}

