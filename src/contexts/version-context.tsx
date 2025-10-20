'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabaseBrowser } from '@/lib/supabase'

type AppVersion = 'functional' | 'mockup'

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
  const [version, setVersion] = useState<AppVersion>('functional')
  const [isDemo, setIsDemo] = useState(false)

  // Check if user is demo user on mount
  useEffect(() => {
    checkUserRole()
  }, [])

  const checkUserRole = async () => {
    try {
      const supabase = supabaseBrowser()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
        
        if (profile?.role === 'demo') {
          setIsDemo(true)
          setVersion('mockup') // Force mockup mode for demo users
          return
        }
      }
      
      // If not demo user, load version from localStorage
      const savedVersion = localStorage.getItem('xpend-version') as AppVersion
      if (savedVersion && (savedVersion === 'functional' || savedVersion === 'mockup')) {
        setVersion(savedVersion)
      }
    } catch (error) {
      console.error('Error checking user role:', error)
    }
  }

  // Save version to localStorage when it changes (but only if not demo user)
  useEffect(() => {
    if (!isDemo) {
      localStorage.setItem('xpend-version', version)
    }
  }, [version, isDemo])

  const value: VersionContextType = {
    version,
    setVersion: isDemo ? () => {} : setVersion, // Prevent demo users from changing version
    isFunctional: version === 'functional',
    isMockup: version === 'mockup',
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

