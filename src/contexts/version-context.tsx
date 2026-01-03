'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabaseBrowser } from '@/lib/supabase'

type AppVersion = 'functional'

interface VersionContextType {
  version: AppVersion
  setVersion: (version: AppVersion) => void
  isFunctional: boolean
  isMockup: boolean
  isDemo: boolean
}

const VersionContext = createContext<VersionContextType | undefined>(undefined)

interface VersionProviderProps {
  children: ReactNode
}

export function VersionProvider({ children }: VersionProviderProps) {
  const [version] = useState<AppVersion>('functional')
  const [isDemo, setIsDemo] = useState(false)

  // Solo verifica si es demo, pero mantiene modo funcional siempre
  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const supabase = supabaseBrowser()
        let { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          await new Promise(r => setTimeout(r, 150))
          ;({ data: { session } } = await supabase.auth.getSession())
        }
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single()
          if (profile?.role === 'demo') {
            setIsDemo(true)
          }
        }
      } catch (error) {
        console.error('Error checking user role:', error)
      }
    }
    checkUserRole()
  }, [])

  const value: VersionContextType = {
    version,
    setVersion: () => {}, // modo único funcional
    isFunctional: true,
    isMockup: false,
    isDemo
  }

  return (
    <VersionContext.Provider value={value}>
      {children}
    </VersionContext.Provider>
  )
}

export function useVersion() {
  const context = useContext(VersionContext)
  if (context === undefined) {
    throw new Error('useVersion must be used within a VersionProvider')
  }
  return context
}

